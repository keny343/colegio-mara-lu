'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generateBatches, SCHEMA_FIELDS } = require('./generator');
const { AVRO_SCHEMA, avroHeader, avroBlock, ParquetStreamWriter } = require('./binaryFormats');
const readers = require('./readers');
const { FileSink, LineBuffer, yieldLoop } = require('./sinks');
const { benchmarkReads, environment } = require('./benchmark');

const DEST_FILES = {
  jsonl: 'alunos_notas.jsonl', csv: 'alunos_notas.csv', avro: 'alunos_notas.avro',
  parquet: 'alunos_notas.parquet', sql: 'criar_dados.sql',
};
// Nomes antigos (execuções anteriores) continuam descarregáveis.
const LEGACY_FILES = ['transacoes.jsonl', 'transacoes.csv', 'transacoes.avro', 'transacoes.parquet'];
const EXTRA_FILES = ['apagar_dados.sql', 'run_meta.json', 'benchmark_report.json', 'validation_report.json', 'schema.avsc', 'run.log'];

// Limites configuráveis por variável de ambiente (Render → Environment).
const MAX_RECORDS = Number(process.env.LAB_MAX_RECORDS) || 100000;
const MAX_BATCH = Number(process.env.LAB_MAX_BATCH) || 20000;
const KEEP_RUNS = Number(process.env.LAB_KEEP_RUNS) || 3;
const AVRO_CODEC = process.env.LAB_AVRO_CODEC === 'null' ? 'null' : 'deflate';
const PARQUET_COMPRESSION = process.env.LAB_PARQUET_COMPRESSION === 'none' ? 'none' : 'gzip';

const CSV_HEADER = SCHEMA_FIELDS.join(',');
const PASSWORD_PLACEHOLDER_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const jobs = new Map();
let currentJob = null;

/* ------------------------------ utilitários ------------------------------ */

function httpError(message, status = 400) { return Object.assign(new Error(message), { status }); }
function labRoot() { return process.env.LAB_OUTPUT_DIR || path.join(__dirname, '..', '..', 'lab-output'); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
const hr = () => process.hrtime.bigint();
const secondsSince = (t) => Number(hr() - t) / 1e9;

function normalizeRunId(value) {
  const runId = String(value || '');
  if (!/^(run|bench)_\d+$/.test(runId)) throw httpError('Identificador de execução inválido.');
  return runId;
}
const seedTag = (seed) => `s${seed}`;

function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function rowCsv(row) {
  return SCHEMA_FIELDS.map((field) => csvEscape(field === 'notas' ? JSON.stringify(row[field] || []) : row[field])).join(',');
}

function logLine(outDir, message) {
  try { fs.appendFileSync(path.join(outDir, 'run.log'), `${new Date().toISOString()} ${message}\n`); } catch { /* log é best-effort */ }
}

function freeDiskBytes(dir) {
  try {
    ensureDir(dir);
    const st = fs.statfsSync(dir);
    return Number(st.bavail) * Number(st.bsize);
  } catch { return null; }
}

/* --------------------------- catálogo (BD real) --------------------------- */

async function loadCatalog() {
  const db = require('../config/database');
  const [rows] = await db.query(`
    SELECT t.id AS turma_id, t.nome AS turma_nome, t.ano_letivo, t.serie_classe,
      t.curso_id, c.nome AS curso_nome, t.turno, d.id AS disciplina_id,
      d.nome AS disciplina_nome, d.disciplina_chave, tp.professor_id
    FROM turmas t
    LEFT JOIN cursos c ON c.id = t.curso_id
    INNER JOIN disciplinas d ON d.ativo = 1
      AND (d.curso_id IS NULL OR d.curso_id = t.curso_id)
      AND (d.serie_min IS NULL OR t.serie_classe >= d.serie_min)
      AND (d.serie_max IS NULL OR t.serie_classe <= d.serie_max)
    LEFT JOIN turma_professores tp ON tp.turma_id = t.id AND tp.disciplina_id = d.id
    WHERE t.ativo = 1 ORDER BY t.id, d.id, tp.professor_id
  `);
  let configs = [];
  try {
    const [configRows] = await db.query('SELECT serie_classe, curso_id, exame_nacional, defesa_final FROM config_avaliacao');
    configs = configRows;
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  const grouped = new Map();
  for (const row of rows) {
    const key = String(row.turma_id);
    if (!grouped.has(key)) {
      const config = configs.find((item) => Number(item.serie_classe) === Number(row.serie_classe)
        && item.curso_id != null && Number(item.curso_id) === Number(row.curso_id))
        || configs.find((item) => Number(item.serie_classe) === Number(row.serie_classe) && item.curso_id == null) || {};
      grouped.set(key, {
        turma_id: Number(row.turma_id), turma_nome: row.turma_nome, ano_letivo: Number(row.ano_letivo),
        serie_classe: Number(row.serie_classe), curso_id: row.curso_id == null ? null : Number(row.curso_id),
        curso_nome: row.curso_nome || '', turno: row.turno || 'manha',
        exame_nacional: !!Number(config.exame_nacional || 0), defesa_final: !!Number(config.defesa_final || 0), disciplinas: [],
      });
    }
    const turma = grouped.get(key);
    let subject = turma.disciplinas.find((item) => item.disciplina_id === Number(row.disciplina_id));
    if (!subject) {
      subject = {
        disciplina_id: Number(row.disciplina_id), disciplina_nome: row.disciplina_nome,
        disciplina_chave: !!Number(row.disciplina_chave || 0),
        professor_id: row.professor_id == null ? null : Number(row.professor_id),
      };
      turma.disciplinas.push(subject);
    } else if (subject.professor_id == null && row.professor_id != null) subject.professor_id = Number(row.professor_id);
  }
  const catalog = [...grouped.values()].filter((item) => item.disciplinas.length);
  if (!catalog.length) throw httpError('Não existem turmas activas com disciplinas compatíveis.', 409);
  return catalog;
}

function catalogHash(catalog) {
  return crypto.createHash('sha256').update(JSON.stringify(catalog)).digest('hex').slice(0, 16);
}

/* ------------------------------ escritores ------------------------------- */

/** Mede o tempo gasto a GERAR dados para o separar do tempo de ESCRITA. */
function* timedBatches(iterator, acc) {
  for (;;) {
    const t = hr();
    const next = iterator.next();
    acc.generation += Number(hr() - t) / 1e9;
    if (next.done) return;
    yield next.value;
  }
}

async function runWriter(ctx, body) {
  const started = hr();
  const acc = { generation: 0 };
  const stats = { records: 0, grade_records: 0 };
  const batches = timedBatches(generateBatches(ctx.records, ctx.seed, ctx.batchSize, ctx.catalog, ctx.tag), acc);
  const result = await body(batches, stats);
  const total = secondsSince(started);
  const writeSeconds = Math.max(0, total - acc.generation);
  return {
    ...result, ...stats,
    total_seconds: total,
    generation_seconds: acc.generation,
    write_seconds: writeSeconds,
    write_records_per_sec: writeSeconds > 0 ? stats.records / writeSeconds : 0,
  };
}

function afterBatch(ctx, stats, batch) {
  stats.records += batch.length;
  for (const row of batch) stats.grade_records += (row.notas || []).length;
  ctx.onRecords(batch.length);
  return yieldLoop();
}

async function writeJsonl(ctx) {
  const sink = new FileSink(ctx.filePath);
  const buf = new LineBuffer(sink);
  try {
    const out = await runWriter(ctx, async (batches, stats) => {
      for (const batch of batches) {
        for (const row of batch) await buf.push(`${JSON.stringify(row)}\n`);
        await afterBatch(ctx, stats, batch);
      }
      await buf.flush();
      await sink.close();
      return {};
    });
    return { ...out, path: path.basename(ctx.filePath), bytes: sink.bytes };
  } catch (err) { sink.abort(); throw err; }
}

async function writeCsv(ctx) {
  const sink = new FileSink(ctx.filePath);
  const buf = new LineBuffer(sink);
  try {
    const out = await runWriter(ctx, async (batches, stats) => {
      await buf.push(`${CSV_HEADER}\n`);
      for (const batch of batches) {
        for (const row of batch) await buf.push(`${rowCsv(row)}\n`);
        await afterBatch(ctx, stats, batch);
      }
      await buf.flush();
      await sink.close();
      return {};
    });
    return { ...out, path: path.basename(ctx.filePath), bytes: sink.bytes };
  } catch (err) { sink.abort(); throw err; }
}

async function writeAvro(ctx) {
  const sink = new FileSink(ctx.filePath);
  try {
    const out = await runWriter(ctx, async (batches, stats) => {
      await sink.write(avroHeader(AVRO_CODEC));
      for (const batch of batches) {
        await sink.write(await avroBlock(batch, AVRO_CODEC));
        await afterBatch(ctx, stats, batch);
      }
      await sink.close();
      return {};
    });
    return { ...out, path: path.basename(ctx.filePath), bytes: sink.bytes, codec: AVRO_CODEC };
  } catch (err) { sink.abort(); throw err; }
}

async function writeParquet(ctx) {
  const sink = new FileSink(ctx.filePath);
  const writer = new ParquetStreamWriter({ compression: PARQUET_COMPRESSION });
  try {
    const out = await runWriter(ctx, async (batches, stats) => {
      await sink.write(writer.header());
      for (const batch of batches) {
        await sink.write(await writer.rowGroup(batch));
        await afterBatch(ctx, stats, batch);
      }
      await sink.write(writer.footer());
      await sink.close();
      return {};
    });
    return { ...out, path: path.basename(ctx.filePath), bytes: sink.bytes, codec: PARQUET_COMPRESSION, row_groups: writer.rowGroups.length };
  } catch (err) { sink.abort(); throw err; }
}

function sqlCleanup(tag) {
  const prefix = `lab.${tag}.`;
  const condition = `LEFT(u.email, CHAR_LENGTH(${sqlString(prefix)})) = ${sqlString(prefix)}`;
  return `-- Remove apenas alunos criados pelo laboratório com a tag ${tag}.\nDELETE n FROM notas n INNER JOIN matriculas m ON m.id=n.matricula_id INNER JOIN alunos a ON a.id=m.aluno_id INNER JOIN usuarios u ON u.id=a.usuario_id WHERE ${condition};\nDELETE m FROM matriculas m INNER JOIN alunos a ON a.id=m.aluno_id INNER JOIN usuarios u ON u.id=a.usuario_id WHERE ${condition};\nDELETE a FROM alunos a INNER JOIN usuarios u ON u.id=a.usuario_id WHERE ${condition};\nDELETE FROM usuarios WHERE LEFT(email, CHAR_LENGTH(${sqlString(prefix)})) = ${sqlString(prefix)};\n`;
}
function sqlStudent(row) {
  const notes = (row.notas || []).map((note) => `(@lab_matricula_id, ${Number(note.disciplina_id)}, ${sqlString(note.periodo)}, ${Number(note.nota).toFixed(2)}, ${note.professor_id == null ? 'NULL' : Number(note.professor_id)})`);
  return `\nINSERT INTO usuarios (nome,email,senha,role,ativo) VALUES (${sqlString(row.nome)},${sqlString(row.email)},${sqlString(PASSWORD_PLACEHOLDER_HASH)},'aluno',0);\nSET @lab_usuario_id := LAST_INSERT_ID();\nINSERT INTO alunos (usuario_id,nome,data_nascimento,sexo,nacionalidade,nome_mae,nome_pai,responsavel,telefone_emergencia) VALUES (@lab_usuario_id,${sqlString(row.nome)},${sqlString(row.data_nascimento)},${sqlString(row.sexo)},'Angolana',${sqlString(row.nome_mae)},${sqlString(row.nome_pai)},${sqlString(row.responsavel)},${sqlString(row.telefone_emergencia)});\nSET @lab_aluno_id := LAST_INSERT_ID();\nINSERT INTO matriculas (aluno_id,turma_id,ano_letivo,status) VALUES (@lab_aluno_id,${Number(row.turma_id)},${Number(row.ano_letivo)},'ativa');\nSET @lab_matricula_id := LAST_INSERT_ID();\nINSERT INTO notas (matricula_id,disciplina_id,periodo,nota,professor_id) VALUES\n${notes.join(',\n')};\n`;
}

async function writeSql(ctx) {
  const sink = new FileSink(ctx.filePath);
  const buf = new LineBuffer(sink);
  try {
    const out = await runWriter(ctx, async (batches, stats) => {
      await buf.push(`SET NAMES utf8mb4;\nSTART TRANSACTION;\n${sqlCleanup(ctx.tag)}COMMIT;\nSTART TRANSACTION;\n`);
      for (const batch of batches) {
        for (const row of batch) await buf.push(sqlStudent(row));
        // Uma transacção por lote: nunca existe uma transacção gigante no MySQL.
        await buf.push('\nCOMMIT;\nSTART TRANSACTION;\n');
        await afterBatch(ctx, stats, batch);
      }
      await buf.push('\nCOMMIT;\n');
      await buf.flush();
      await sink.close();
      return {};
    });
    fs.writeFileSync(path.join(ctx.dir, 'apagar_dados.sql'), `SET NAMES utf8mb4;\nSTART TRANSACTION;\n${sqlCleanup(ctx.tag)}COMMIT;\n`, 'utf8');
    return { ...out, path: path.basename(ctx.filePath), create_file: 'criar_dados.sql', delete_file: 'apagar_dados.sql', bytes: sink.bytes };
  } catch (err) { sink.abort(); throw err; }
}

const WRITERS = { jsonl: writeJsonl, csv: writeCsv, avro: writeAvro, parquet: writeParquet, sql: writeSql };

/* ------------------------------ parâmetros ------------------------------- */

function parseDestinations(raw) {
  const list = String(raw || 'jsonl,csv,avro,parquet,sql').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  const unknown = list.filter((item) => !WRITERS[item]);
  if (unknown.length) throw httpError(`Destinos desconhecidos: ${unknown.join(',')}`);
  if (!list.length) throw httpError('Informe ao menos um destino.');
  return [...new Set(list)];
}

function parseParams({ records, seed = 42, batchSize = 1000, destinations, outName, repeats }, prefix = 'run') {
  const n = Number(records);
  if (!Number.isInteger(n) || n < 1) throw httpError('records deve ser um inteiro >= 1.');
  if (n > MAX_RECORDS) throw httpError(`O máximo neste servidor é ${MAX_RECORDS.toLocaleString('pt-PT')} alunos por execução (variável LAB_MAX_RECORDS). Para escalas maiores use o CLI.`);
  const numericSeed = Number.isFinite(Number(seed)) ? Math.trunc(Number(seed)) : 42;
  const size = Number(batchSize) || 1000;
  if (!Number.isInteger(size) || size < 1 || size > MAX_BATCH) throw httpError(`batch_size deve estar entre 1 e ${MAX_BATCH}.`);
  const reps = repeats == null ? 5 : Number(repeats);
  if (!Number.isInteger(reps) || reps < 1 || reps > 10) throw httpError('repeats deve estar entre 1 e 10.');
  return {
    records: n, seed: numericSeed, batchSize: size, destinations: parseDestinations(destinations),
    runId: normalizeRunId(outName || `${prefix}_${Date.now()}`), repeats: reps,
  };
}

/** Estima o espaço necessário a partir de uma amostra real (as primeiras linhas são determinísticas). */
function estimateBytes(catalog, p) {
  const sample = Math.min(p.records, 200);
  let bytes = 0; let counted = 0;
  for (const batch of generateBatches(sample, p.seed, sample, catalog, seedTag(p.seed))) {
    for (const row of batch) { bytes += Buffer.byteLength(JSON.stringify(row)) + 1; counted += 1; }
  }
  const perRecord = counted ? bytes / counted : 0;
  const factor = { jsonl: 1, csv: 0.9, sql: 1.2, avro: AVRO_CODEC === 'deflate' ? 0.25 : 1, parquet: PARQUET_COMPRESSION === 'gzip' ? 0.2 : 0.9 };
  const total = p.destinations.reduce((sum, d) => sum + perRecord * p.records * factor[d], 0);
  return { per_record_bytes: Math.round(perRecord), total_bytes: Math.round(total * 1.15) };
}

function assertDisk(catalog, p) {
  const estimate = estimateBytes(catalog, p);
  const free = freeDiskBytes(labRoot());
  if (free != null && estimate.total_bytes > free * 0.9) {
    const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;
    throw httpError(`Espaço em disco insuficiente: a execução precisa de ~${mb(estimate.total_bytes)} e há ${mb(free)} livres. Reduza o volume ou o número de destinos.`, 409);
  }
  return estimate;
}

/* ----------------------------- gestão de jobs ----------------------------- */

function publicJob(job) {
  if (!job) return null;
  const { id, type, status, phase, percent, started_at, finished_at, error, error_status, result, params } = job;
  return { id, type, status, phase, percent: Math.round(percent * 10) / 10, started_at, finished_at, error, error_status, params, result };
}

function startJob(type, params, work) {
  if (currentJob && currentJob.status === 'running') throw httpError('Já existe uma tarefa do laboratório em execução.', 409);
  const job = {
    id: `job_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, type, status: 'running', phase: 'a preparar',
    percent: 0, started_at: new Date().toISOString(), finished_at: null, error: null, error_status: null, result: null, params,
  };
  jobs.set(job.id, job);
  currentJob = job;
  while (jobs.size > 20) jobs.delete(jobs.keys().next().value);
  setImmediate(async () => {
    try {
      job.result = await work(job);
      job.status = 'done';
      job.percent = 100;
      job.phase = 'concluído';
    } catch (err) {
      job.status = 'error';
      job.error = err.message || 'Erro desconhecido.';
      job.error_status = err.status || 500;
      job.phase = 'falhou';
      if (!err.status || err.status >= 500) console.error(`[lab] ${type} falhou:`, err);
    } finally {
      job.finished_at = new Date().toISOString();
    }
  });
  return job;
}

function getJob(id) { return publicJob(jobs.get(String(id))); }
function isRunning() { return !!(currentJob && currentJob.status === 'running'); }
function currentJobSummary() { return currentJob ? publicJob(currentJob) : null; }

/* ------------------------------- geração --------------------------------- */

async function writeAll({ job, p, catalog, outDir, weightStart = 0, weightSpan = 100, phasePrefix = 'a gravar' }) {
  const writes = {};
  const done = { n: 0 };
  const perDest = p.destinations.length;
  for (let i = 0; i < perDest; i += 1) {
    const destination = p.destinations[i];
    const filePath = path.join(outDir, DEST_FILES[destination]);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const ctx = {
      filePath, dir: outDir, records: p.records, seed: p.seed, batchSize: p.batchSize, catalog, tag: seedTag(p.seed),
      onRecords: (count) => {
        done.n += count;
        const frac = (i + Math.min(1, (done.n - i * p.records) / p.records)) / perDest;
        job.percent = weightStart + weightSpan * Math.max(0, Math.min(1, frac));
      },
    };
    job.phase = `${phasePrefix} ${destination.toUpperCase()}`;
    logLine(outDir, `início ${destination} (${p.records} registos, lote ${p.batchSize})`);
    writes[destination] = await WRITERS[destination](ctx);
    logLine(outDir, `fim ${destination}: ${writes[destination].bytes} bytes, ${writes[destination].write_seconds.toFixed(3)} s de escrita`);
  }
  return writes;
}

function pruneRuns(keepId) {
  try {
    const runs = listRuns();
    for (const run of runs.slice(KEEP_RUNS)) {
      if (run.out_dir === keepId) continue;
      fs.rmSync(path.join(labRoot(), run.out_dir), { recursive: true, force: true });
    }
  } catch (err) { console.warn('[lab] limpeza de execuções antigas falhou:', err.message); }
}

function startGenerate(input) {
  const p = parseParams(input, 'run');
  return startJob('generate', { records: p.records, seed: p.seed, batch_size: p.batchSize, destinations: p.destinations }, async (job) => {
    const catalog = await loadCatalog();
    const estimate = assertDisk(catalog, p);
    const outDir = path.join(labRoot(), p.runId);
    ensureDir(outDir);
    fs.writeFileSync(path.join(outDir, 'schema.avsc'), JSON.stringify(AVRO_SCHEMA, null, 2));
    const started = hr();
    const writes = await writeAll({ job, p, catalog, outDir });
    const first = Object.values(writes)[0] || {};
    const result = {
      out_dir: p.runId, records: p.records, grade_records: Number(first.grade_records || 0), seed: p.seed,
      batch_size: p.batchSize, destinations: p.destinations, writes, estimate,
      catalog_hash: catalogHash(catalog), elapsed_seconds: secondsSince(started), created_at: new Date().toISOString(),
      engine: 'node-streaming', avro_codec: AVRO_CODEC, parquet_compression: PARQUET_COMPRESSION,
      environment: environment(),
    };
    fs.writeFileSync(path.join(outDir, 'run_meta.json'), JSON.stringify(result, null, 2));
    saveLatest(result);
    pruneRuns(p.runId);
    return result;
  });
}

/* ------------------------------- validação ------------------------------- */

const canonical = (row) => `${row.id}|${row.email}|${row.turma_id}|${(row.notas || []).map((n) => `${n.disciplina_id}:${n.periodo}:${Math.round(Number(n.nota) * 100)}:${n.professor_id ?? ''}`).join(',')}`;
const SQL_NOTE = /^\(@lab_matricula_id, (\d+), '([^']*)', ([0-9.]+), (NULL|\d+)\)/;

async function fingerprintRows(iterable, sampleSize) {
  let count = 0; let grades = 0; let cents = 0; let hi = 0; let lo = 0;
  const sample = [];
  for await (const row of iterable) {
    count += 1;
    for (const n of row.notas || []) { grades += 1; cents += Math.round(Number(n.nota) * 100); }
    const text = canonical(row);
    const digest = crypto.createHash('sha1').update(text).digest();
    hi = (hi + digest.readUInt32LE(0)) % 4294967296;
    lo = (lo + digest.readUInt32LE(4)) % 4294967296;
    if (sample.length < sampleSize) sample.push(`${row.id}:${crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)}`);
    if ((count & 0x3ff) === 0) await yieldLoop();
  }
  return {
    count, grade_records: grades, sum_notas: (cents / 100).toFixed(2),
    rows_digest: `${hi.toString(16).padStart(8, '0')}${lo.toString(16).padStart(8, '0')}`,
    sample_hash: crypto.createHash('sha256').update(sample.join('|')).digest('hex'),
  };
}

async function fingerprintSql(filePath) {
  let count = 0; let grades = 0; let cents = 0; let n = 0;
  for await (const line of readers.readLines(filePath)) {
    if (line.startsWith('INSERT INTO alunos')) count += 1;
    else if (line.startsWith('(@lab_matricula_id,')) {
      const m = SQL_NOTE.exec(line);
      if (m) { grades += 1; cents += Math.round(Number(m[3]) * 100); }
    }
    n += 1;
    if ((n & 0x3fff) === 0) await yieldLoop();
  }
  return { count, grade_records: grades, sum_notas: (cents / 100).toFixed(2), rows_digest: null, sample_hash: null };
}

function readMeta(runId) {
  const outDir = path.join(labRoot(), normalizeRunId(runId));
  const metaPath = path.join(outDir, 'run_meta.json');
  if (!fs.existsSync(metaPath)) throw httpError('Execução ou metadados não encontrados.', 404);
  return { outDir, meta: JSON.parse(fs.readFileSync(metaPath, 'utf8')) };
}

function fileFor(outDir, meta, format) {
  const preferred = path.join(outDir, DEST_FILES[format]);
  if (fs.existsSync(preferred)) return preferred;
  const legacy = path.join(outDir, `transacoes.${format}`);
  if (fs.existsSync(legacy)) return legacy;
  throw httpError(`Ficheiro do destino ${format} não encontrado (foi apagado?).`, 404);
}

async function validateInternal(job, runId, sampleSize) {
  const { outDir, meta } = readMeta(runId);
  const expectedRecords = Number(meta.records);
  const expectedGrades = Number(meta.grade_records || 0);
  const fingerprints = {};
  const dests = meta.destinations;
  for (let i = 0; i < dests.length; i += 1) {
    const format = dests[i];
    job.phase = `a validar ${format.toUpperCase()}`;
    const file = fileFor(outDir, meta, format);
    fingerprints[format] = format === 'sql'
      ? await fingerprintSql(file)
      : await fingerprintRows({ jsonl: readers.readJsonl, csv: readers.readCsv, avro: readers.readAvro, parquet: readers.readParquet }[format](file), sampleSize);
    fingerprints[format].bytes = fs.statSync(file).size;
    job.percent = ((i + 1) / dests.length) * 100;
  }
  const checks = Object.entries(fingerprints).map(([format, fp]) => ({
    format, count: fp.count, expected: expectedRecords, count_ok: fp.count === expectedRecords,
    grade_records: fp.grade_records, expected_grade_records: expectedGrades, grades_ok: fp.grade_records === expectedGrades,
    sum_notas: fp.sum_notas, rows_digest: fp.rows_digest, sample_hash: fp.sample_hash,
  }));
  const refSum = checks[0]?.sum_notas;
  const sumsOk = checks.every((c) => c.sum_notas === refSum);
  const digests = new Set(checks.filter((c) => c.rows_digest).map((c) => c.rows_digest));
  const samples = new Set(checks.filter((c) => c.sample_hash).map((c) => c.sample_hash));
  const equivalent = checks.every((c) => c.count_ok && c.grades_ok) && sumsOk && digests.size <= 1 && samples.size <= 1;
  const result = {
    out_dir: runId,
    status: equivalent ? 'equivalent' : 'mismatch',
    equivalent,
    summary: equivalent
      ? 'Todos os destinos foram descodificados: contagens, número de notas, soma das notas e digest de todas as linhas coincidem (SQL: contagens e soma).'
      : 'Foram detectadas diferenças entre destinos — ver detalhes.',
    checks, fingerprints, sum_notas_ok: sumsOk, digests_equal: digests.size <= 1,
    quality: { schema_fields: SCHEMA_FIELDS.length, student_records_expected: expectedRecords, grade_records_expected: expectedGrades, deterministic_seed: meta.seed },
    checked_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'validation_report.json'), JSON.stringify(result, null, 2));
  logLine(outDir, `validação: ${result.status}`);
  return result;
}

function startValidate(runId, sampleSize = 100) {
  const id = normalizeRunId(runId);
  readMeta(id); // falha já (404) se a execução não existir
  return startJob('validate', { out_dir: id }, (job) => validateInternal(job, id, Math.max(1, Number(sampleSize) || 100)));
}

/* ------------------------------- benchmark ------------------------------- */

function startBenchmark(input) {
  const p = parseParams(input, 'bench');
  return startJob('benchmark', { records: p.records, seed: p.seed, batch_size: p.batchSize, destinations: p.destinations, repeats: p.repeats }, async (job) => {
    const catalog = await loadCatalog();
    assertDisk(catalog, p);
    const outDir = path.join(labRoot(), p.runId);
    ensureDir(outDir);
    fs.writeFileSync(path.join(outDir, 'schema.avsc'), JSON.stringify(AVRO_SCHEMA, null, 2));
    const started = hr();
    // Escrita: 1 execução fria (reportada à parte) + `repeats` medidas.
    const rounds = p.repeats + 1;
    const writeRuns = {};
    let lastWrites = null;
    for (let r = 0; r < rounds; r += 1) {
      lastWrites = await writeAll({
        job, p, catalog, outDir, weightStart: (r / rounds) * 60, weightSpan: 60 / rounds,
        phasePrefix: `escrita ${r === 0 ? '(fria)' : `${r}/${p.repeats}`} ·`,
      });
      for (const [dest, w] of Object.entries(lastWrites)) {
        (writeRuns[dest] ||= []).push(w);
      }
    }
    const files = Object.fromEntries(p.destinations.map((d) => [d, path.join(outDir, DEST_FILES[d])]));
    job.phase = 'a medir leituras';
    const reads = await benchmarkReads({
      files, destinations: p.destinations, repeats: p.repeats,
      onProgress: (frac, label) => { job.percent = 60 + frac * 40; job.phase = label; },
    });
    const { summary } = require('./benchmark');
    const csvBytes = lastWrites.csv?.bytes || null;
    const formats = {};
    for (const dest of p.destinations) {
      const runs = writeRuns[dest];
      const measured = runs.slice(1);
      const w = lastWrites[dest];
      formats[dest] = {
        bytes: w.bytes || 0,
        student_records: w.records,
        grade_records: w.grade_records,
        codec: w.codec || null,
        write_seconds: summary(measured.map((x) => x.write_seconds)),
        generation_seconds: summary(measured.map((x) => x.generation_seconds)),
        write_records_per_sec: summary(measured.map((x) => x.write_records_per_sec)),
        cold_write_seconds: runs[0].write_seconds,
        compression_vs_csv: csvBytes ? (w.bytes || 0) / csvBytes : null,
        compression_formula: 'tamanho do formato / tamanho do CSV',
        ...reads.formats[dest],
      };
    }
    const first = lastWrites[p.destinations[0]];
    const report = {
      out_dir: p.runId, records: p.records, grade_records: first.grade_records, seed: p.seed, batch_size: p.batchSize,
      destinations: p.destinations, elapsed_seconds: secondsSince(started), writes: lastWrites, formats,
      repeats: p.repeats, environment: { ...reads.environment, lab: { avro_codec: AVRO_CODEC, parquet_compression: PARQUET_COMPRESSION, batch_size: p.batchSize } },
      cold_cache_note: 'A 1.ª execução de cada teste é reportada à parte (cold_*) e excluída das estatísticas; a cache do SO não é limpa.',
      memory_note: 'Pico de RSS do processo Node durante cada operação (inclui o servidor).',
      created_at: new Date().toISOString(), engine: 'node-streaming',
    };
    const meta = {
      out_dir: p.runId, records: p.records, grade_records: first.grade_records, seed: p.seed, batch_size: p.batchSize,
      destinations: p.destinations, writes: lastWrites, elapsed_seconds: report.elapsed_seconds, created_at: report.created_at,
      engine: 'node-streaming', catalog_hash: catalogHash(catalog), avro_codec: AVRO_CODEC, parquet_compression: PARQUET_COMPRESSION,
    };
    fs.writeFileSync(path.join(outDir, 'run_meta.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(outDir, 'benchmark_report.json'), JSON.stringify(report, null, 2));
    logLine(outDir, `benchmark concluído em ${report.elapsed_seconds.toFixed(1)} s`);
    saveLatest({ ...meta, benchmark: report });
    pruneRuns(p.runId);
    return report;
  });
}

/* --------------------------- histórico / ficheiros ------------------------ */

function saveLatest(payload) {
  ensureDir(labRoot());
  fs.writeFileSync(path.join(labRoot(), 'latest.json'), JSON.stringify(payload, null, 2));
}
function getLatest() {
  const file = path.join(labRoot(), 'latest.json');
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; } catch { return null; }
}
function listRuns() {
  const root = labRoot();
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter((name) => /^(run|bench)_\d+$/.test(name) && fs.existsSync(path.join(root, name, 'run_meta.json')))
    .map((name) => {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(root, name, 'run_meta.json'), 'utf8'));
        return { out_dir: name, records: meta.records, grade_records: meta.grade_records, seed: meta.seed, destinations: meta.destinations, created_at: meta.created_at, elapsed_seconds: meta.elapsed_seconds };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
function resolveArtifact(outName, file) {
  const runId = normalizeRunId(outName);
  const base = path.basename(String(file || ''));
  const allowed = [...Object.values(DEST_FILES), ...LEGACY_FILES, ...EXTRA_FILES];
  if (!allowed.includes(base)) throw httpError('Ficheiro não permitido.', 403);
  const root = path.resolve(labRoot());
  const fullPath = path.resolve(root, runId, base);
  if (!fullPath.startsWith(root + path.sep) || !fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    throw httpError('Ficheiro não encontrado (a execução pode ter sido apagada pela limpeza automática ou por um reinício do servidor).', 404);
  }
  return fullPath;
}
function diskInfo() { return { free_bytes: freeDiskBytes(labRoot()), keep_runs: KEEP_RUNS }; }

module.exports = {
  MAX_RECORDS, MAX_BATCH, DEST_FILES,
  startGenerate, startValidate, startBenchmark, getJob, currentJobSummary, isRunning,
  listRuns, getLatest, resolveArtifact, parseDestinations, diskInfo,
};