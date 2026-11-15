'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateBatches, DISCIPLINAS_CATALOGO } = require('./generator');
const { AvroFileWriter, ParquetFileWriter } = require('./binaryFormats');
const {
  FIELDS, FIELD_NAMES, ALUNO_FIELD_NAMES, TABLE_NOTAS, TABLE_ALUNOS,
  notaRowSql, alunoRowSql, createTablesSql, dropTablesSql, sqlHeader,
} = require('./schema');
const { READERS, readParquet, fingerprint, primeiraDiferenca, canon } = require('./readers');
const db = require('../config/database');

// Ficheiros que o admin pode descarregar. O destino SQL gera DOIS scripts: criar (+ dados) e eliminar.
const DEST_FILES = {
  jsonl: 'notas.jsonl',
  csv: 'notas.csv',
  avro: 'notas.avro',
  parquet: 'notas.parquet',
  sql: 'lab_notas_criar.sql',
};
const SQL_DROP_FILE = 'lab_notas_eliminar.sql';
const REPORT_FILES = ['run_meta.json', 'benchmark_report.json', 'validation_report.json'];

const MAX_RECORDS = 25000;
const SQL_CHUNK = 500;
let running = false;

const labRoot = () => path.join(__dirname, '..', '..', 'lab-output');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const secs = (t0) => Number(process.hrtime.bigint() - t0) / 1e9;

// ---------- CSV ----------

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowCsv(r) {
  return FIELDS.map((f) => {
    const v = r[f.name];
    if (v === null || v === undefined) return '';
    return csvEscape(f.kind === 'json' ? JSON.stringify(v) : v);
  }).join(',');
}

// ---------- escritores (um lote de cada vez: memória constante) ----------

function fileResult(filePath, records, t0) {
  return { path: path.basename(filePath), records, bytes: fs.statSync(filePath).size, write_seconds: secs(t0) };
}

function writeJsonl(batches, filePath) {
  const fd = fs.openSync(filePath, 'w');
  let count = 0;
  const t0 = process.hrtime.bigint();
  try {
    for (const { notas } of batches) {
      fs.writeSync(fd, notas.map((r) => `${JSON.stringify(r)}\n`).join(''));
      count += notas.length;
    }
  } finally { fs.closeSync(fd); }
  return fileResult(filePath, count, t0);
}

function writeCsv(batches, filePath) {
  const fd = fs.openSync(filePath, 'w');
  let count = 0;
  const t0 = process.hrtime.bigint();
  try {
    fs.writeSync(fd, `${FIELD_NAMES.join(',')}\n`); // sem BOM (igual ao CLI Python)
    for (const { notas } of batches) {
      fs.writeSync(fd, notas.map((r) => `${rowCsv(r)}\n`).join(''));
      count += notas.length;
    }
  } finally { fs.closeSync(fd); }
  return fileResult(filePath, count, t0);
}

function writeWith(Writer, batches, filePath) {
  const w = new Writer(filePath);
  const t0 = process.hrtime.bigint();
  let count = 0;
  try {
    for (const { notas } of batches) {
      w.writeBatch(notas);
      count += notas.length;
    }
  } finally { w.close(); }
  return fileResult(filePath, count, t0);
}

const writeAvro = (batches, filePath) => writeWith(AvroFileWriter, batches, filePath);
const writeParquet = (batches, filePath) => writeWith(ParquetFileWriter, batches, filePath);

function sqlInsertBlock(tabela, colunas, linhas) {
  const out = [];
  for (let i = 0; i < linhas.length; i += SQL_CHUNK) {
    out.push(`INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES\n${linhas.slice(i, i + SQL_CHUNK).join(',\n')};\n`);
  }
  return out.join('');
}

const dbRow = (r) => FIELDS.map((f) => (f.kind === 'json' ? (r[f.name] == null ? null : JSON.stringify(r[f.name])) : r[f.name]));
const dbAlunoRow = (a) => ALUNO_FIELD_NAMES.map((k) => a[k]);

/**
 * Destino SQL: (1) gera lab_notas_criar.sql (CREATE + INSERT) e lab_notas_eliminar.sql (DROP);
 * (2) carrega as mesmas tabelas lab_* na base MySQL do sistema. Se (2) falhar, os scripts ficam
 * disponíveis na mesma.
 */
async function writeSql(batches, filePath) {
  const dropPath = path.join(path.dirname(filePath), SQL_DROP_FILE);
  const t0 = process.hrtime.bigint();

  fs.writeFileSync(dropPath, `${sqlHeader('ELIMINAR dados do laboratório', [
    'Remove as tabelas lab_notas, lab_alunos (e lab_transacoes, da versão antiga).',
    'Pode ser executado várias vezes (DROP TABLE IF EXISTS).',
  ])}${dropTablesSql().map((s) => `${s};`).join('\n')}\n`);

  const fd = fs.openSync(filePath, 'w');
  fs.writeSync(fd, `${sqlHeader('CRIAR tabelas e dados', [
    'Execute este script no MySQL (Workbench ou CLI) na base de dados do sistema.',
    'Para repetir, execute primeiro lab_notas_eliminar.sql.',
  ])}SET NAMES utf8mb4;\n\n${createTablesSql().map((s) => `${s};`).join('\n\n')}\n\n`);

  let dbOk = true;
  let dbError = null;
  let dbInsert = 0;
  const dbRun = async (sql, params) => {
    if (!dbOk) return;
    const t = process.hrtime.bigint();
    try { await db.query(sql, params); } catch (e) { dbOk = false; dbError = e.message; }
    dbInsert += secs(t);
  };
  for (const s of dropTablesSql()) await dbRun(s);
  for (const s of createTablesSql()) await dbRun(s);

  let count = 0;
  let alunosCount = 0;
  try {
    for (const { notas, alunos } of batches) {
      if (alunos.length) {
        fs.writeSync(fd, sqlInsertBlock(TABLE_ALUNOS, ALUNO_FIELD_NAMES, alunos.map(alunoRowSql)));
        for (let i = 0; i < alunos.length; i += SQL_CHUNK) {
          await dbRun(`INSERT INTO ${TABLE_ALUNOS} (${ALUNO_FIELD_NAMES.join(',')}) VALUES ?`, [alunos.slice(i, i + SQL_CHUNK).map(dbAlunoRow)]);
        }
        alunosCount += alunos.length;
      }
      fs.writeSync(fd, sqlInsertBlock(TABLE_NOTAS, FIELD_NAMES, notas.map(notaRowSql)));
      for (let i = 0; i < notas.length; i += SQL_CHUNK) {
        await dbRun(`INSERT INTO ${TABLE_NOTAS} (${FIELD_NAMES.join(',')}) VALUES ?`, [notas.slice(i, i + SQL_CHUNK).map(dbRow)]);
      }
      count += notas.length;
    }
  } finally { fs.closeSync(fd); }

  let dbBytes = null;
  if (dbOk) {
    try {
      const [[row]] = await db.query(
        `SELECT COALESCE(SUM(DATA_LENGTH + INDEX_LENGTH),0) AS bytes FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?)`, [TABLE_NOTAS, TABLE_ALUNOS],
      );
      dbBytes = Number(row.bytes) || 0;
    } catch (_) { dbBytes = null; }
  }

  const res = fileResult(filePath, count, t0);
  return {
    ...res,
    drop_path: SQL_DROP_FILE,
    alunos: alunosCount,
    tables: [TABLE_ALUNOS, TABLE_NOTAS],
    db_loaded: dbOk,
    db_error: dbError,
    db_bytes: dbBytes,
    db_insert_seconds: dbInsert,
  };
}

const WRITERS = { jsonl: writeJsonl, csv: writeCsv, avro: writeAvro, parquet: writeParquet, sql: writeSql };

function parseDestinations(raw) {
  const list = String(raw || 'jsonl,csv,avro,parquet,sql').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const unknown = list.filter((d) => !WRITERS[d]);
  if (unknown.length) throw new Error(`Destinos desconhecidos: ${unknown.join(',')}`);
  if (!list.length) throw new Error('Informe ao menos um destino');
  return [...new Set(list)];
}

function clampRecords(n) {
  const v = Number(n) || 0;
  if (v < 1) throw new Error('records deve ser >= 1');
  if (v > MAX_RECORDS) throw new Error(`No painel admin o máximo é ${MAX_RECORDS} registos (use o CLI Python para S/M).`);
  return v;
}

async function generateOnce(n, seed, batchSize, dests, outDir) {
  const writes = {};
  for (const dest of dests) {
    const filePath = path.join(outDir, DEST_FILES[dest]);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    writes[dest] = await WRITERS[dest](generateBatches(n, seed, batchSize), filePath);
  }
  return writes;
}

async function runGenerate({ records, seed = 42, batchSize = 2000, destinations, outName }) {
  if (running) throw Object.assign(new Error('Já existe uma tarefa do laboratório em execução.'), { status: 409 });
  running = true;
  try {
    const n = clampRecords(records);
    const dests = parseDestinations(destinations);
    const outDir = path.join(labRoot(), safeName(outName) || `run_${Date.now()}`);
    ensureDir(outDir);
    const t0 = process.hrtime.bigint();
    const writes = await generateOnce(n, seed, batchSize, dests, outDir);
    const result = {
      out_dir: path.basename(outDir),
      out_path: outDir,
      records: n,
      seed,
      batch_size: batchSize,
      destinations: dests,
      domain: 'notas-alunos-angola',
      writes,
      elapsed_seconds: secs(t0),
      created_at: new Date().toISOString(),
      engine: 'node-admin',
    };
    fs.writeFileSync(path.join(outDir, 'run_meta.json'), JSON.stringify(result, null, 2));
    saveLatest(result);
    return result;
  } finally { running = false; }
}

function safeName(n) {
  const s = String(n || '').replace(/[^A-Za-z0-9_.-]/g, '');
  return s && s !== '.' && s !== '..' ? s : '';
}

// ---------- validação ----------

/** Regras de negócio do sistema (academicoRules.js) verificadas sobre os registos do JSONL. */
function checkRegras(records) {
  const v = { nota_fora_da_escala: 0, situacao_inconsistente: 0, escala_incoerente: 0, minimo_incoerente: 0, periodo_invalido: 0, nota_mais_de_2_decimais: 0 };
  let total = 0;
  for (const r of records) {
    total += 1;
    const nota = Number(r.nota);
    const escala = r.serie_classe <= 6 ? 10 : 20;
    const minimo = r.serie_classe <= 6 ? 5 : 10;
    if (nota < 0 || nota > r.escala_max) v.nota_fora_da_escala += 1;
    if (r.escala_max !== escala) v.escala_incoerente += 1;
    if (r.nota_minima !== minimo) v.minimo_incoerente += 1;
    if ((nota >= r.nota_minima ? 'positiva' : 'negativa') !== r.situacao) v.situacao_inconsistente += 1;
    if (!['1PP', '1PT', '2PP', '2PT', '3PP', '3PT'].includes(r.periodo)) v.periodo_invalido += 1;
    if (!/^\d+\.\d{2}$/.test(String(r.nota))) v.nota_mais_de_2_decimais += 1;
  }
  return { registos_verificados: total, violacoes: v, ok: Object.values(v).every((x) => x === 0) };
}

async function dbRecords() {
  const cols = FIELD_NAMES.map((c) => (c === 'data_lancamento' ? "DATE_FORMAT(data_lancamento, '%Y-%m-%d %H:%i:%s') AS data_lancamento" : c));
  const out = [];
  let last = 0;
  for (;;) {
    const [rows] = await db.query(`SELECT ${cols.join(', ')} FROM ${TABLE_NOTAS} WHERE id > ? ORDER BY id LIMIT 5000`, [last]);
    if (!rows.length) break;
    for (const r of rows) {
      for (const f of FIELDS) if (f.kind === 'json' && typeof r[f.name] === 'string') r[f.name] = JSON.parse(r[f.name]);
      out.push(r);
    }
    last = rows[rows.length - 1].id;
  }
  return out;
}

async function validateRun(outName) {
  const outDir = path.join(labRoot(), safeName(outName));
  if (!safeName(outName) || !fs.existsSync(path.join(outDir, 'run_meta.json'))) {
    throw Object.assign(new Error('Execução não encontrada.'), { status: 404 });
  }
  const meta = JSON.parse(fs.readFileSync(path.join(outDir, 'run_meta.json'), 'utf8'));
  if (meta.domain !== 'notas-alunos-angola') {
    throw Object.assign(new Error('Esta execução é da versão antiga do laboratório (transacções). Gere novamente.'), { status: 409 });
  }
  const dests = meta.destinations || [];
  const fingerprints = {};
  const fontes = {};
  for (const d of dests) {
    const p = path.join(outDir, DEST_FILES[d]);
    if (!fs.existsSync(p)) { fingerprints[d] = { erro: 'ficheiro em falta (disco efémero?) — gere novamente' }; continue; }
    try {
      fontes[d] = () => READERS[d](p);
      fingerprints[d] = fingerprint(fontes[d]());
    } catch (e) { fingerprints[d] = { erro: `leitura falhou: ${e.message}` }; }
  }
  if (dests.includes('sql') && meta.writes?.sql?.db_loaded) {
    try {
      const rows = await dbRecords();
      fontes.sql_mysql = () => rows;
      fingerprints.sql_mysql = fingerprint(rows);
    } catch (e) { fingerprints.sql_mysql = { erro: `consulta falhou: ${e.message}` }; }
  }

  const refKey = fingerprints.jsonl && !fingerprints.jsonl.erro ? 'jsonl' : Object.keys(fingerprints).find((k) => !fingerprints[k].erro);
  const diferencas = {};
  let equivalent = !!refKey;
  for (const [k, fp] of Object.entries(fingerprints)) {
    if (k === refKey) continue;
    if (fp.erro || fp.hash_conteudo !== fingerprints[refKey].hash_conteudo) {
      equivalent = false;
      diferencas[k] = fp.erro ? fp.erro : (primeiraDiferenca(fontes[refKey](), fontes[k]()) || 'hash diferente');
    }
  }

  const regras = refKey ? checkRegras(fontes[refKey]()) : null;
  const result = {
    out_dir: safeName(outName),
    equivalent,
    referencia: refKey,
    criterio: 'hash SHA-256 do conteúdo completo de cada registo (todos os campos), lido do próprio ficheiro / da tabela MySQL',
    fingerprints,
    diferencas,
    regras_negocio: regras,
    quality: {
      campos: FIELDS.length,
      disciplinas_no_catalogo: DISCIPLINAS_CATALOGO.length,
      deterministic_seed: meta.seed,
    },
    checked_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'validation_report.json'), JSON.stringify(result, null, 2));
  return result;
}

// ---------- benchmark ----------

function stats(arr) {
  if (!arr.length) return { median: null, min: null, max: null, runs: 0 };
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return { median: m, min: s[0], max: s[s.length - 1], runs: s.length };
}

function timeSync(fn) { const t = process.hrtime.bigint(); const r = fn(); return [secs(t), r]; }

function groupByRecords(it) {
  const g = {};
  for (const r of it) {
    const x = g[r.disciplina] || (g[r.disciplina] = { count: 0, cents: 0 });
    x.count += 1;
    x.cents += Math.round(Number(r.nota) * 100);
  }
  return Object.fromEntries(Object.keys(g).sort().map((k) => [k, { count: g[k].count, soma_notas: (g[k].cents / 100).toFixed(2) }]));
}

async function runBenchmark({ records, seed = 42, batchSize = 2000, destinations, outName, repeats = 5 }) {
  if (running) throw Object.assign(new Error('Já existe uma tarefa do laboratório em execução.'), { status: 409 });
  running = true;
  try {
    const n = clampRecords(records);
    const dests = parseDestinations(destinations);
    const reps = Math.min(10, Math.max(2, Number(repeats) || 5)); // 1.ª = cold (à parte) + restantes = quentes
    const outDir = path.join(labRoot(), safeName(outName) || `bench_${Date.now()}`);
    ensureDir(outDir);

    const W = {}; const R = {}; const G = {}; const C = {}; const cold = {};
    for (const d of dests) { W[d] = []; R[d] = []; G[d] = []; C[d] = []; cold[d] = {}; }
    let writes = {};
    let sqlG = [];
    let sqlC = [];
    let groupSql = null;
    let groupFile = null;
    const t0 = process.hrtime.bigint();

    for (let i = 0; i < reps; i++) {
      writes = await generateOnce(n, seed, batchSize, dests, outDir);
      for (const d of dests) {
        const p = path.join(outDir, DEST_FILES[d]);
        const wsec = writes[d].write_seconds;
        const [rsec] = timeSync(() => { let c = 0; for (const r of READERS[d](p)) c += r ? 1 : 0; return c; });
        const [gsec, g] = timeSync(() => groupByRecords(READERS[d](p)));
        const [csec] = timeSync(() => {
          let s = 0;
          const it = d === 'parquet' ? readParquet(p, ['nota']) : READERS[d](p);
          for (const r of it) s += Number(r.nota);
          return s;
        });
        if (i === 0) { cold[d] = { write_seconds: wsec, read_seconds: rsec, group_by_seconds: gsec, column_read_seconds: csec }; } else {
          W[d].push(wsec); R[d].push(rsec); G[d].push(gsec); C[d].push(csec);
        }
        if (d === 'jsonl') groupFile = g;
      }
      if (dests.includes('sql') && writes.sql.db_loaded) {
        const t1 = process.hrtime.bigint();
        const [rows] = await db.query(`SELECT disciplina, COUNT(*) AS c, SUM(nota) AS s FROM ${TABLE_NOTAS} GROUP BY disciplina ORDER BY disciplina`);
        const gs = secs(t1);
        const t2 = process.hrtime.bigint();
        await db.query(`SELECT nota FROM ${TABLE_NOTAS}`);
        const cs = secs(t2);
        if (i > 0) { sqlG.push(gs); sqlC.push(cs); }
        groupSql = Object.fromEntries(rows.map((r) => [r.disciplina, { count: Number(r.c), soma_notas: Number(r.s).toFixed(2) }]));
      }
    }

    const formats = {};
    let csvBytes = null;
    for (const d of dests) {
      const bytes = writes[d].bytes || 0;
      if (d === 'csv') csvBytes = bytes;
      const ws = stats(W[d]);
      formats[d] = {
        bytes,
        write_seconds: ws,
        write_records_per_sec: { median: ws.median ? n / ws.median : 0 },
        read_seconds: stats(R[d]),
        group_by_seconds: stats(G[d]),
        column_read_seconds: stats(C[d]),
        cold_run: cold[d],
        compression_vs_csv: null,
      };
    }
    if (csvBytes) for (const d of dests) formats[d].compression_vs_csv = formats[d].bytes / csvBytes;
    if (formats.sql) {
      formats.sql.db_bytes = writes.sql.db_bytes;
      formats.sql.db_loaded = writes.sql.db_loaded;
      formats.sql.db_error = writes.sql.db_error;
      formats.sql.db_insert_seconds = writes.sql.db_insert_seconds;
      if (writes.sql.db_loaded) {
        // No SQL, GROUP BY e leitura de coluna executam no motor (MySQL), não em JavaScript.
        formats.sql.group_by_seconds_engine = stats(sqlG);
        formats.sql.column_read_seconds_engine = stats(sqlC);
      }
    }

    let dbVersion = null;
    try { const [[v]] = await db.query('SELECT VERSION() AS v'); dbVersion = v.v; } catch (_) { /* opcional */ }
    const cpus = os.cpus();
    const report = {
      records: n,
      seed,
      batch_size: batchSize,
      repeats: { total: reps, cold: 1, warm_stats: reps - 1 },
      destinations: dests,
      out_dir: path.basename(outDir),
      formats,
      group_by_disciplina: {
        consistente_ficheiros_vs_sql: groupSql && groupFile ? JSON.stringify(groupSql) === JSON.stringify(groupFile) : null,
        resultado: groupSql || groupFile,
      },
      ambiente: {
        so: `${os.type()} ${os.release()} (${os.platform()}/${os.arch()})`,
        cpu: cpus[0]?.model, cpu_nucleos: cpus.length,
        ram_gb: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
        node: process.version,
        mysql: dbVersion,
        nota: 'Render/instância partilhada: tempos são indicativos. Escalas S/M (1M/10M) via CLI Python.',
      },
      created_at: new Date().toISOString(),
      elapsed_seconds: secs(t0),
      engine: 'node-admin',
      note: 'A 1.ª repetição (cache fria) é reportada em cold_run e excluída das estatísticas (mediana/mín/máx).',
    };
    const meta = {
      out_dir: path.basename(outDir), out_path: outDir, records: n, seed, batch_size: batchSize, destinations: dests,
      domain: 'notas-alunos-angola', writes, elapsed_seconds: report.elapsed_seconds, created_at: report.created_at, engine: 'node-admin',
    };
    fs.writeFileSync(path.join(outDir, 'run_meta.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(outDir, 'benchmark_report.json'), JSON.stringify(report, null, 2));
    saveLatest({ ...meta, benchmark: report });
    return report;
  } finally { running = false; }
}

// ---------- histórico / downloads ----------

function saveLatest(payload) {
  ensureDir(labRoot());
  fs.writeFileSync(path.join(labRoot(), 'latest.json'), JSON.stringify(payload, null, 2));
}

function listRuns() {
  const root = labRoot();
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const name of fs.readdirSync(root)) {
    const mp = path.join(root, name, 'run_meta.json');
    if (!fs.existsSync(mp)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(mp, 'utf8'));
      out.push({ out_dir: name, records: meta.records, seed: meta.seed, destinations: meta.destinations, created_at: meta.created_at, elapsed_seconds: meta.elapsed_seconds });
    } catch (_) { /* ignora */ }
  }
  return out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function getLatest() {
  const p = path.join(labRoot(), 'latest.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

function resolveArtifact(outName, file) {
  const base = path.basename(String(file));
  const permitidos = [...Object.values(DEST_FILES), SQL_DROP_FILE, ...REPORT_FILES];
  if (!permitidos.includes(base)) throw Object.assign(new Error('Ficheiro não permitido.'), { status: 403 });
  const dir = safeName(outName);
  const full = path.join(labRoot(), dir, base);
  if (!dir || !full.startsWith(labRoot()) || !fs.existsSync(full)) {
    throw Object.assign(new Error('Ficheiro não encontrado — o disco do servidor é efémero; gere novamente e descarregue logo a seguir.'), { status: 404 });
  }
  return full;
}

module.exports = {
  MAX_RECORDS, DEST_FILES, SQL_DROP_FILE,
  runGenerate, validateRun, runBenchmark, listRuns, getLatest, resolveArtifact, parseDestinations,
  isRunning: () => running,
};