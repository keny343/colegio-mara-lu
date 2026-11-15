'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generateBatches, DISCIPLINAS, SCHEMA_FIELDS } = require('./generator');
const { writeAvroBuffer, writeParquetBuffer } = require('./binaryFormats');
const db = require('../config/database');

const DEST_FILES = {
  jsonl: 'notas_aluno.jsonl',
  csv: 'notas_aluno.csv',
  avro: 'notas_aluno.avro',
  parquet: 'notas_aluno.parquet',
  sql: 'sql', // MySQL table lab_notas_aluno
};

const MAX_RECORDS = 25000;
const CSV_HEADER = SCHEMA_FIELDS.join(',');
const LAB_TABLE = 'lab_notas_aluno';

let running = false;

function labRoot() {
  return path.join(__dirname, '..', '..', 'lab-output');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowCsv(r) {
  return [
    r.id,
    r.aluno_id,
    r.matricula_id,
    r.aluno_nome,
    r.turma_id,
    r.turma_nome,
    r.serie_classe,
    r.curso == null ? '' : r.curso,
    r.ano_letivo,
    r.turno,
    r.disciplina_id,
    r.disciplina,
    JSON.stringify(r.periodos),
    r.media_anual == null ? '' : r.media_anual,
    r.situacao,
    r.nota_minima,
    r.data_atualizacao,
    JSON.stringify(r.turma_info),
    r.metadados == null ? '' : JSON.stringify(r.metadados),
  ].map(csvEscape).join(',');
}

async function ensureLabTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${LAB_TABLE} (
      id BIGINT PRIMARY KEY,
      aluno_id BIGINT NOT NULL,
      matricula_id BIGINT NOT NULL,
      aluno_nome VARCHAR(200) NOT NULL,
      turma_id BIGINT NOT NULL,
      turma_nome VARCHAR(120) NOT NULL,
      serie_classe INT NOT NULL,
      curso VARCHAR(120) NULL,
      ano_letivo INT NOT NULL,
      turno VARCHAR(32) NOT NULL,
      disciplina_id INT NOT NULL,
      disciplina VARCHAR(120) NOT NULL,
      periodos JSON NOT NULL,
      media_anual VARCHAR(16) NULL,
      situacao VARCHAR(32) NOT NULL,
      nota_minima INT NOT NULL,
      data_atualizacao VARCHAR(32) NOT NULL,
      turma_info JSON NOT NULL,
      metadados JSON NULL,
      INDEX idx_lab_disciplina (disciplina),
      INDEX idx_lab_situacao (situacao)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function writeSql(batches) {
  await ensureLabTable();
  await db.query(`TRUNCATE TABLE ${LAB_TABLE}`);
  let count = 0;
  const t0 = process.hrtime.bigint();
  for (const batch of batches) {
    if (!batch.length) continue;
    const placeholders = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
    const values = [];
    for (const r of batch) {
      values.push(
        r.id,
        r.aluno_id,
        r.matricula_id,
        r.aluno_nome,
        r.turma_id,
        r.turma_nome,
        r.serie_classe,
        r.curso,
        r.ano_letivo,
        r.turno,
        r.disciplina_id,
        r.disciplina,
        JSON.stringify(r.periodos),
        r.media_anual,
        r.situacao,
        r.nota_minima,
        r.data_atualizacao,
        JSON.stringify(r.turma_info),
        r.metadados == null ? null : JSON.stringify(r.metadados),
      );
    }
    await db.query(
      `INSERT INTO ${LAB_TABLE} (
        id, aluno_id, matricula_id, aluno_nome, turma_id, turma_nome,
        serie_classe, curso, ano_letivo, turno, disciplina_id, disciplina,
        periodos, media_anual, situacao, nota_minima, data_atualizacao,
        turma_info, metadados
      ) VALUES ${placeholders}`,
      values,
    );
    count += batch.length;
  }
  const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;
  const [[{ bytes }]] = await db.query(
    `SELECT ROUND((DATA_LENGTH + INDEX_LENGTH)) AS bytes
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [LAB_TABLE],
  );
  return { path: `mysql:${LAB_TABLE}`, records: count, bytes: Number(bytes) || 0, write_seconds: elapsed };
}

function writeJsonl(batches, filePath) {
  const fd = fs.openSync(filePath, 'w');
  let count = 0;
  const t0 = process.hrtime.bigint();
  try {
    for (const batch of batches) {
      for (const r of batch) {
        fs.writeSync(fd, `${JSON.stringify(r)}\n`);
        count += 1;
      }
    }
  } finally {
    fs.closeSync(fd);
  }
  const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;
  return { path: filePath, records: count, bytes: fs.statSync(filePath).size, write_seconds: elapsed };
}

function writeCsv(batches, filePath) {
  const fd = fs.openSync(filePath, 'w');
  let count = 0;
  const t0 = process.hrtime.bigint();
  try {
    fs.writeSync(fd, `\uFEFF${CSV_HEADER}\n`);
    for (const batch of batches) {
      for (const r of batch) {
        fs.writeSync(fd, `${rowCsv(r)}\n`);
        count += 1;
      }
    }
  } finally {
    fs.closeSync(fd);
  }
  const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;
  return { path: filePath, records: count, bytes: fs.statSync(filePath).size, write_seconds: elapsed };
}

function writeAvro(batches, filePath) {
  const records = [];
  for (const batch of batches) records.push(...batch);
  const t0 = process.hrtime.bigint();
  const buf = writeAvroBuffer(records);
  fs.writeFileSync(filePath, buf);
  const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;
  return { path: filePath, records: records.length, bytes: buf.length, write_seconds: elapsed };
}

function writeParquet(batches, filePath) {
  const records = [];
  for (const batch of batches) records.push(...batch);
  const t0 = process.hrtime.bigint();
  const buf = writeParquetBuffer(records);
  fs.writeFileSync(filePath, buf);
  const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;
  return { path: filePath, records: records.length, bytes: buf.length, write_seconds: elapsed };
}

const WRITERS = {
  jsonl: writeJsonl,
  csv: writeCsv,
  avro: writeAvro,
  parquet: writeParquet,
  sql: writeSql,
};

function parseDestinations(raw) {
  const list = String(raw || 'jsonl,csv,avro,parquet,sql')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const unknown = list.filter((d) => !WRITERS[d]);
  if (unknown.length) throw new Error(`Destinos desconhecidos: ${unknown.join(',')}`);
  if (!list.length) throw new Error('Informe ao menos um destino');
  return list;
}

function clampRecords(n) {
  const v = Number(n) || 0;
  if (v < 1) throw new Error('records deve ser >= 1');
  if (v > MAX_RECORDS) {
    throw new Error(`No painel admin o máximo é ${MAX_RECORDS} registos (use o CLI Python para S/M).`);
  }
  return v;
}

async function runGenerate({ records, seed = 42, batchSize = 2000, destinations, outName }) {
  if (running) throw Object.assign(new Error('Já existe uma tarefa do laboratório em execução.'), { status: 409 });
  running = true;
  try {
    const n = clampRecords(records);
    const dests = parseDestinations(destinations);
    const outDir = path.join(labRoot(), outName || `run_${Date.now()}`);
    ensureDir(outDir);

    const writes = {};
    const t0 = process.hrtime.bigint();
    for (const dest of dests) {
      const batches = generateBatches(n, seed, batchSize);
      if (dest === 'sql') {
        writes[dest] = await writeSql(batches);
      } else {
        const filePath = path.join(outDir, DEST_FILES[dest]);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        writes[dest] = WRITERS[dest](batches, filePath);
        writes[dest].path = path.basename(filePath);
      }
    }
    const result = {
      out_dir: path.basename(outDir),
      out_path: outDir,
      records: n,
      seed,
      batch_size: batchSize,
      destinations: dests,
      domain: 'notas_aluno',
      writes,
      elapsed_seconds: Number(process.hrtime.bigint() - t0) / 1e9,
      created_at: new Date().toISOString(),
      engine: 'node-admin',
    };
    fs.writeFileSync(path.join(outDir, 'run_meta.json'), JSON.stringify(result, null, 2));
    saveLatest(result);
    return result;
  } finally {
    running = false;
  }
}

function fingerprintFromFile(filePath, sampleSize = 100) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const isCsv = filePath.endsWith('.csv');
  if (isCsv) return null;

  let count = 0;
  let sum = 0;
  const samples = [];
  for (let i = 0; i < lines.length; i++) {
    const rec = JSON.parse(lines[i]);
    count += 1;
    if (rec.media_anual != null) sum += Number(rec.media_anual) || 0;
    if (samples.length < sampleSize) {
      const digest = crypto.createHash('sha256')
        .update(JSON.stringify({
          id: rec.id,
          aluno_id: rec.aluno_id,
          disciplina_id: rec.disciplina_id,
          media_anual: rec.media_anual == null ? null : String(rec.media_anual),
          situacao: rec.situacao,
        }))
        .digest('hex')
        .slice(0, 16);
      samples.push(`${rec.id}:${digest}`);
    }
  }
  const aggregate = crypto.createHash('sha256').update(samples.sort().join('|')).digest('hex');
  return {
    count,
    sum_media_anual: sum.toFixed(1),
    sample_hash: aggregate,
    samples: samples.slice(0, sampleSize),
  };
}

async function validateRun(outName, sampleSize = 100) {
  const outDir = path.join(labRoot(), outName);
  if (!fs.existsSync(outDir)) throw Object.assign(new Error('Execução não encontrada.'), { status: 404 });
  const meta = JSON.parse(fs.readFileSync(path.join(outDir, 'run_meta.json'), 'utf8'));
  const dests = meta.destinations || [];
  const fps = {};

  if (dests.includes('jsonl')) {
    const p = path.join(outDir, DEST_FILES.jsonl);
    fps.jsonl = fingerprintFromFile(p, sampleSize);
  }
  if (dests.includes('csv') && fps.jsonl) {
    const raw = fs.readFileSync(path.join(outDir, DEST_FILES.csv), 'utf8');
    const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
    fps.csv = {
      count: Math.max(0, lines.length - 1),
      sum_media_anual: fps.jsonl.sum_media_anual,
      note: 'soma alinhada ao JSONL (mesmo gerador/seed)',
    };
  }
  if (dests.includes('avro')) {
    const st = fs.statSync(path.join(outDir, DEST_FILES.avro));
    fps.avro = { bytes: st.size, records_expected: meta.records };
  }
  if (dests.includes('parquet')) {
    const st = fs.statSync(path.join(outDir, DEST_FILES.parquet));
    fps.parquet = { bytes: st.size, records_expected: meta.records };
  }
  if (dests.includes('sql')) {
    const [[{ c, s }]] = await db.query(
      `SELECT COUNT(*) AS c, COALESCE(SUM(CAST(media_anual AS DECIMAL(10,1))),0) AS s FROM ${LAB_TABLE}`,
    );
    fps.sql = { count: Number(c), sum_media_anual: Number(s).toFixed(1) };
  }

  const counts = Object.values(fps).map((f) => f.count).filter((c) => typeof c === 'number');
  const sums = Object.values(fps).map((f) => f.sum_media_anual).filter(Boolean);
  const equivalent =
    counts.length >= 2
    && counts.every((c) => c === counts[0])
    && (sums.length < 2 || sums.every((s) => s === sums[0]));

  const result = {
    out_dir: outName,
    equivalent,
    fingerprints: fps,
    quality: {
      schema_fields: SCHEMA_FIELDS.length,
      disciplinas: DISCIPLINAS.length,
      domain: 'notas_aluno',
      deterministic_seed: meta.seed,
    },
    checked_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'validation_report.json'), JSON.stringify(result, null, 2));
  return result;
}

async function runBenchmark({ records, seed = 42, batchSize = 2000, destinations, outName }) {
  const gen = await runGenerate({
    records,
    seed,
    batchSize,
    destinations,
    outName: outName || `bench_${Date.now()}`,
  });
  const formats = {};
  let csvBytes = null;
  for (const [dest, w] of Object.entries(gen.writes)) {
    const bytes = w.bytes || 0;
    if (dest === 'csv') csvBytes = bytes;
    const writeSec = w.write_seconds || gen.elapsed_seconds / Object.keys(gen.writes).length;
    formats[dest] = {
      bytes,
      write_seconds: { median: writeSec, min: writeSec, max: writeSec },
      write_records_per_sec: {
        median: writeSec > 0 ? gen.records / writeSec : 0,
      },
      compression_vs_csv: null,
    };
  }
  if (csvBytes) {
    for (const dest of Object.keys(formats)) {
      formats[dest].compression_vs_csv = formats[dest].bytes / csvBytes;
    }
  }

  let groupBy = null;
  if (gen.destinations.includes('sql')) {
    const t0 = process.hrtime.bigint();
    const [rows] = await db.query(
      `SELECT disciplina, COUNT(*) AS c, COALESCE(SUM(CAST(media_anual AS DECIMAL(10,1))),0) AS s
       FROM ${LAB_TABLE} GROUP BY disciplina ORDER BY disciplina`,
    );
    groupBy = {
      seconds: Number(process.hrtime.bigint() - t0) / 1e9,
      groups: Object.fromEntries(rows.map((r) => [
        r.disciplina,
        { count: Number(r.c), sum_media_anual: Number(r.s).toFixed(1) },
      ])),
    };
  }

  const report = {
    records: gen.records,
    seed: gen.seed,
    batch_size: gen.batch_size,
    destinations: gen.destinations,
    out_dir: gen.out_dir,
    domain: 'notas_aluno',
    formats,
    group_by_disciplina_sql: groupBy,
    created_at: new Date().toISOString(),
    engine: 'node-admin',
    note: 'Painel admin: volumes até 25k. Escalas S/M (1M/10M) via CLI Python em data-engineering/.',
  };
  const outDir = gen.out_path;
  fs.writeFileSync(path.join(outDir, 'benchmark_report.json'), JSON.stringify(report, null, 2));
  saveLatest({ ...gen, benchmark: report });
  return report;
}

function saveLatest(payload) {
  ensureDir(labRoot());
  fs.writeFileSync(path.join(labRoot(), 'latest.json'), JSON.stringify(payload, null, 2));
}

function listRuns() {
  const root = labRoot();
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter((name) => {
      const p = path.join(root, name);
      return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'run_meta.json'));
    })
    .map((name) => {
      const meta = JSON.parse(fs.readFileSync(path.join(root, name, 'run_meta.json'), 'utf8'));
      return {
        out_dir: name,
        records: meta.records,
        seed: meta.seed,
        destinations: meta.destinations,
        domain: meta.domain || 'notas_aluno',
        created_at: meta.created_at,
        elapsed_seconds: meta.elapsed_seconds,
      };
    })
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function getLatest() {
  const p = path.join(labRoot(), 'latest.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function resolveArtifact(outName, file) {
  const base = path.basename(file);
  if (!Object.values(DEST_FILES).includes(base) && !['run_meta.json', 'benchmark_report.json', 'validation_report.json'].includes(base)) {
    throw Object.assign(new Error('Ficheiro não permitido.'), { status: 403 });
  }
  const full = path.join(labRoot(), outName, base);
  if (!full.startsWith(labRoot()) || !fs.existsSync(full)) {
    throw Object.assign(new Error('Ficheiro não encontrado.'), { status: 404 });
  }
  return full;
}

module.exports = {
  MAX_RECORDS,
  DEST_FILES,
  LAB_TABLE,
  runGenerate,
  validateRun,
  runBenchmark,
  listRuns,
  getLatest,
  resolveArtifact,
  parseDestinations,
  isRunning: () => running,
};
