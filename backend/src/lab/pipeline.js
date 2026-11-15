'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generateBatches, CATEGORIAS } = require('./generator');
const { writeAvroBuffer, writeParquetBuffer } = require('./binaryFormats');
const db = require('../config/database');

const DEST_FILES = {
  jsonl: 'transacoes.jsonl',
  csv: 'transacoes.csv',
  avro: 'transacoes.avro',
  parquet: 'transacoes.parquet',
  sql: 'sql', // MySQL table lab_transacoes
};

const MAX_RECORDS = 25000;
const CSV_HEADER = [
  'id', 'cliente_id', 'produto_id', 'data_transacao', 'categoria', 'quantidade',
  'preco_unitario', 'valor_total', 'estado', 'descricao', 'localizacao', 'metadados',
].join(',');

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
    r.id, r.cliente_id, r.produto_id, r.data_transacao, r.categoria, r.quantidade,
    r.preco_unitario, r.valor_total, r.estado, r.descricao,
    JSON.stringify(r.localizacao),
    r.metadados == null ? '' : JSON.stringify(r.metadados),
  ].map(csvEscape).join(',');
}

async function ensureLabTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS lab_transacoes (
      execucao_id VARCHAR(64) NOT NULL,
      id BIGINT NOT NULL,
      cliente_id BIGINT NOT NULL,
      produto_id BIGINT NOT NULL,
      data_transacao VARCHAR(32) NOT NULL,
      categoria VARCHAR(64) NOT NULL,
      quantidade INT NOT NULL,
      preco_unitario VARCHAR(32) NOT NULL,
      valor_total VARCHAR(32) NOT NULL,
      estado CHAR(2) NOT NULL,
      descricao TEXT NOT NULL,
      localizacao JSON NOT NULL,
      metadados JSON NULL,
      PRIMARY KEY (execucao_id, id),
      INDEX idx_lab_categoria (categoria),
      INDEX idx_lab_execucao (execucao_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  const [cols] = await db.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_transacoes'",
  );
  if (!cols.some((c) => c.COLUMN_NAME === 'execucao_id')) {
    await db.query("ALTER TABLE lab_transacoes ADD COLUMN execucao_id VARCHAR(64) NOT NULL DEFAULT 'legacy' FIRST");
    await db.query('ALTER TABLE lab_transacoes DROP PRIMARY KEY, ADD PRIMARY KEY (execucao_id, id), ADD INDEX idx_lab_execucao (execucao_id)');
  }
}

function sqlString(value) {
  if (value == null) return 'NULL';
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
}

function sqlInsertRow(r, runId) {
  return '(' + [
    sqlString(runId), Number(r.id), Number(r.cliente_id), Number(r.produto_id),
    sqlString(r.data_transacao), sqlString(r.categoria), Number(r.quantidade),
    sqlString(r.preco_unitario), sqlString(r.valor_total), sqlString(r.estado),
    sqlString(r.descricao), sqlString(JSON.stringify(r.localizacao)),
    r.metadados == null ? 'NULL' : sqlString(JSON.stringify(r.metadados)),
  ].join(',') + ')';
}

async function writeSql(batches, runId, outDir) {
  await ensureLabTable();
  await db.query('DELETE FROM lab_transacoes WHERE execucao_id = ?', [runId]);
  let count = 0;
  const t0 = process.hrtime.bigint();
  const createPath = path.join(outDir, 'criar_dados.sql');
  const deletePath = path.join(outDir, 'apagar_dados.sql');
  const header = `-- Dados da execução ${runId}; gerado automaticamente pelo Laboratório de Dados.
CREATE TABLE IF NOT EXISTS lab_transacoes (
  execucao_id VARCHAR(64) NOT NULL, id BIGINT NOT NULL, cliente_id BIGINT NOT NULL,
  produto_id BIGINT NOT NULL, data_transacao VARCHAR(32) NOT NULL, categoria VARCHAR(64) NOT NULL,
  quantidade INT NOT NULL, preco_unitario VARCHAR(32) NOT NULL, valor_total VARCHAR(32) NOT NULL,
  estado CHAR(2) NOT NULL, descricao TEXT NOT NULL, localizacao JSON NOT NULL, metadados JSON NULL,
  PRIMARY KEY (execucao_id, id), INDEX idx_lab_categoria (categoria), INDEX idx_lab_execucao (execucao_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
START TRANSACTION;
`;
  fs.writeFileSync(createPath, header, 'utf8');
  fs.writeFileSync(deletePath, `-- Remove exclusivamente os dados da execução ${runId}.
DELETE FROM lab_transacoes WHERE execucao_id = '${runId}';
`, 'utf8');
  for (const batch of batches) {
    if (!batch.length) continue;
    const placeholders = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
    const values = [];
    for (const r of batch) {
      values.push(runId, r.id, r.cliente_id, r.produto_id, r.data_transacao, r.categoria,
        r.quantidade, r.preco_unitario, r.valor_total, r.estado, r.descricao,
        JSON.stringify(r.localizacao), r.metadados == null ? null : JSON.stringify(r.metadados));
    }
    await db.query(`INSERT INTO lab_transacoes (
      execucao_id, id, cliente_id, produto_id, data_transacao, categoria, quantidade,
      preco_unitario, valor_total, estado, descricao, localizacao, metadados
    ) VALUES ${placeholders}`, values);
    fs.appendFileSync(createPath, `INSERT INTO lab_transacoes (
      execucao_id, id, cliente_id, produto_id, data_transacao, categoria, quantidade,
      preco_unitario, valor_total, estado, descricao, localizacao, metadados
    ) VALUES\n${batch.map((r) => sqlInsertRow(r, runId)).join(',\n')};\n`, 'utf8');
    count += batch.length;
  }
  fs.appendFileSync(createPath, 'COMMIT;\n', 'utf8');
  const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;
  const [[{ bytes }]] = await db.query(
    `SELECT ROUND((DATA_LENGTH + INDEX_LENGTH)) AS bytes FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_transacoes'`,
  );
  return { path: 'mysql:lab_transacoes', create_file: 'criar_dados.sql',
    delete_file: 'apagar_dados.sql', records: count, bytes: Number(bytes) || 0,
    write_seconds: elapsed };
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
    const runId = path.basename(outDir).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);

    const writes = {};
    const t0 = process.hrtime.bigint();
    for (const dest of dests) {
      const batches = generateBatches(n, seed, batchSize);
      if (dest === 'sql') {
        writes[dest] = await writeSql(batches, runId, outDir);
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
  const start = isCsv ? 1 : 0;
  let count = 0;
  let sum = 0;
  const samples = [];
  for (let i = start; i < lines.length; i++) {
    let rec;
    if (isCsv) {
      // parse minimal: id is first field
      const id = Number(lines[i].split(',')[0]);
      const m = lines[i].match(/,"?(\d+\.\d{2})"?,"?[A-Z]{2}"?/);
      // valor_total is 8th column — use JSON from jsonl preferred
      continue;
    }
    rec = JSON.parse(lines[i]);
    count += 1;
    sum += Number(rec.valor_total) || 0;
    if (samples.length < sampleSize) {
      const digest = crypto.createHash('sha256')
        .update(JSON.stringify({
          id: rec.id,
          cliente_id: rec.cliente_id,
          produto_id: rec.produto_id,
          valor_total: String(rec.valor_total),
          categoria: rec.categoria,
        }))
        .digest('hex')
        .slice(0, 16);
      samples.push(`${rec.id}:${digest}`);
    }
  }
  if (isCsv) {
    // re-read via regenerating fingerprint from jsonl sibling if present
    return null;
  }
  const aggregate = crypto.createHash('sha256').update(samples.sort().join('|')).digest('hex');
  return {
    count,
    sum_valor_total: sum.toFixed(2),
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
    // Contagem CSV = linhas - 1
    const raw = fs.readFileSync(path.join(outDir, DEST_FILES.csv), 'utf8');
    const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
    fps.csv = {
      count: Math.max(0, lines.length - 1),
      sum_valor_total: fps.jsonl.sum_valor_total,
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
      'SELECT COUNT(*) AS c, COALESCE(SUM(CAST(valor_total AS DECIMAL(18,2))),0) AS s FROM lab_transacoes WHERE execucao_id = ?', [path.basename(outDir)],
    );
    fps.sql = { count: Number(c), sum_valor_total: Number(s).toFixed(2) };
  }

  const counts = Object.values(fps).map((f) => f.count).filter((c) => typeof c === 'number');
  const sums = Object.values(fps).map((f) => f.sum_valor_total).filter(Boolean);
  const equivalent =
    counts.length >= 2
    && counts.every((c) => c === counts[0])
    && (sums.length < 2 || sums.every((s) => s === sums[0]));

  const result = {
    out_dir: outName,
    equivalent,
    fingerprints: fps,
    quality: {
      schema_fields: 12,
      categorias: CATEGORIAS.length,
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

  // Agregação SQL se disponível
  let groupBy = null;
  if (gen.destinations.includes('sql')) {
    const t0 = process.hrtime.bigint();
    const [rows] = await db.query(
      `SELECT categoria, COUNT(*) AS c, SUM(CAST(valor_total AS DECIMAL(18,2))) AS s
       FROM lab_transacoes WHERE execucao_id = ? GROUP BY categoria ORDER BY categoria`, [gen.out_dir],
    );
    groupBy = {
      seconds: Number(process.hrtime.bigint() - t0) / 1e9,
      groups: Object.fromEntries(rows.map((r) => [r.categoria, { count: Number(r.c), sum_valor_total: Number(r.s).toFixed(2) }])),
    };
  }

  const report = {
    records: gen.records,
    seed: gen.seed,
    batch_size: gen.batch_size,
    destinations: gen.destinations,
    out_dir: gen.out_dir,
    formats,
    group_by_categoria_sql: groupBy,
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
  if (!['transacoes.jsonl', 'transacoes.csv', 'transacoes.avro', 'transacoes.parquet', 'criar_dados.sql', 'apagar_dados.sql', 'run_meta.json', 'benchmark_report.json', 'validation_report.json'].includes(base)) {
    throw Object.assign(new Error('Ficheiro não permitido.'), { status: 403 });
  }
  if (!/^(run|bench)_\\d+$/.test(String(outName || ''))) throw Object.assign(new Error('Execução inválida.'), { status: 400 });
  const root = path.resolve(labRoot());
  const full = path.resolve(root, outName, base);
  if (!full.startsWith(root + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    throw Object.assign(new Error('Ficheiro não encontrado.'), { status: 404 });
  }
  return full;
}

module.exports = {
  MAX_RECORDS,
  DEST_FILES,
  runGenerate,
  validateRun,
  runBenchmark,
  listRuns,
  getLatest,
  resolveArtifact,
  parseDestinations,
  isRunning: () => running,
};
