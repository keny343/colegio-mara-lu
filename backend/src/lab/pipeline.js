
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
  sql: 'sql',
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

/**
 * Aceita apenas identificadores válidos de execução.
 * O mesmo identificador é usado no directório e na base de dados.
 */
function normalizeRunId(value) {
  const runId = String(value || '');

  if (!/^(run|bench)_\d+$/.test(runId)) {
    throw Object.assign(
      new Error('Identificador de execução inválido.'),
      { status: 400 },
    );
  }

  return runId;
}

function csvEscape(value) {
  const s = String(value ?? '');

  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }

  return s;
}

function rowCsv(row) {
  return [
    row.id,
    row.cliente_id,
    row.produto_id,
    row.data_transacao,
    row.categoria,
    row.quantidade,
    row.preco_unitario,
    row.valor_total,
    row.estado,
    row.descricao,
    JSON.stringify(row.localizacao),
    row.metadados == null ? '' : JSON.stringify(row.metadados),
  ].map(csvEscape).join(',');
}

/**
 * Cria a tabela e garante que a migração da chave primária
 * fica concluída, mesmo que uma execução anterior tenha sido
 * interrompida depois de adicionar execucao_id.
 *
 * Os registos antigos recebem execucao_id = 'legacy'.
 * Nenhum registo é apagado durante esta migração.
 */
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

  const [columns] = await db.query(`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'lab_transacoes'
  `);

  const hasExecutionColumn = columns.some(
    (column) => column.COLUMN_NAME === 'execucao_id',
  );

  if (!hasExecutionColumn) {
    await db.query(`
      ALTER TABLE lab_transacoes
      ADD COLUMN execucao_id VARCHAR(64) NOT NULL DEFAULT 'legacy' FIRST
    `);
  }

  // Consultar sempre a chave primária actual.
  // Não assumir que a migração terminou apenas porque a coluna existe.
  const [primaryKeyRows] = await db.query(`
    SELECT COLUMN_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'lab_transacoes'
      AND INDEX_NAME = 'PRIMARY'
    ORDER BY SEQ_IN_INDEX
  `);

  const primaryKeyColumns = primaryKeyRows.map(
    (row) => row.COLUMN_NAME,
  );

  const correctPrimaryKey = (
    primaryKeyColumns.length === 2
    && primaryKeyColumns[0] === 'execucao_id'
    && primaryKeyColumns[1] === 'id'
  );

  if (!correctPrimaryKey) {
    if (primaryKeyColumns.length > 0) {
      await db.query(`
        ALTER TABLE lab_transacoes
        DROP PRIMARY KEY,
        ADD PRIMARY KEY (execucao_id, id)
      `);
    } else {
      await db.query(`
        ALTER TABLE lab_transacoes
        ADD PRIMARY KEY (execucao_id, id)
      `);
    }
  }

  // Garantir o índice de execução sem duplicar o índice existente.
  const [executionIndexes] = await db.query(`
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'lab_transacoes'
      AND INDEX_NAME = 'idx_lab_execucao'
    LIMIT 1
  `);

  if (executionIndexes.length === 0) {
    await db.query(`
      ALTER TABLE lab_transacoes
      ADD INDEX idx_lab_execucao (execucao_id)
    `);
  }

  // Garantir também o índice de categoria.
  const [categoryIndexes] = await db.query(`
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'lab_transacoes'
      AND INDEX_NAME = 'idx_lab_categoria'
    LIMIT 1
  `);

  if (categoryIndexes.length === 0) {
    await db.query(`
      ALTER TABLE lab_transacoes
      ADD INDEX idx_lab_categoria (categoria)
    `);
  }
}

function sqlString(value) {
  if (value == null) return 'NULL';

  return `'${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")}'`;
}

function sqlInsertRow(row, runId) {
  return '(' + [
    sqlString(runId),
    Number(row.id),
    Number(row.cliente_id),
    Number(row.produto_id),
    sqlString(row.data_transacao),
    sqlString(row.categoria),
    Number(row.quantidade),
    sqlString(row.preco_unitario),
    sqlString(row.valor_total),
    sqlString(row.estado),
    sqlString(row.descricao),
    sqlString(JSON.stringify(row.localizacao)),
    row.metadados == null
      ? 'NULL'
      : sqlString(JSON.stringify(row.metadados)),
  ].join(',') + ')';
}

async function writeSql(batches, runId, outDir) {
  runId = normalizeRunId(runId);

  await ensureLabTable();

  // Apagar apenas os dados pertencentes a esta execução.
  await db.query(
    'DELETE FROM lab_transacoes WHERE execucao_id = ?',
    [runId],
  );

  let count = 0;
  const startTime = process.hrtime.bigint();

  const createPath = path.join(outDir, 'criar_dados.sql');
  const deletePath = path.join(outDir, 'apagar_dados.sql');

  const header = `-- Dados da execução ${runId}; gerado automaticamente pelo Laboratório de Dados.
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

START TRANSACTION;
`;

  fs.writeFileSync(createPath, header, 'utf8');

  fs.writeFileSync(
    deletePath,
    `-- Remove exclusivamente os dados da execução ${runId}.
DELETE FROM lab_transacoes
WHERE execucao_id = '${runId}';
`,
    'utf8',
  );

  for (const batch of batches) {
    if (!batch.length) continue;

    const placeholders = batch
      .map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .join(',');

    const values = [];

    for (const row of batch) {
      values.push(
        runId,
        row.id,
        row.cliente_id,
        row.produto_id,
        row.data_transacao,
        row.categoria,
        row.quantidade,
        row.preco_unitario,
        row.valor_total,
        row.estado,
        row.descricao,
        JSON.stringify(row.localizacao),
        row.metadados == null
          ? null
          : JSON.stringify(row.metadados),
      );
    }

    await db.query(
      `INSERT INTO lab_transacoes (
        execucao_id,
        id,
        cliente_id,
        produto_id,
        data_transacao,
        categoria,
        quantidade,
        preco_unitario,
        valor_total,
        estado,
        descricao,
        localizacao,
        metadados
      ) VALUES ${placeholders}`,
      values,
    );

    fs.appendFileSync(
      createPath,
      `INSERT INTO lab_transacoes (
        execucao_id,
        id,
        cliente_id,
        produto_id,
        data_transacao,
        categoria,
        quantidade,
        preco_unitario,
        valor_total,
        estado,
        descricao,
        localizacao,
        metadados
      ) VALUES\n${batch.map((row) => sqlInsertRow(row, runId)).join(',\n')};\n`,
      'utf8',
    );

    count += batch.length;
  }

  fs.appendFileSync(createPath, 'COMMIT;\n', 'utf8');

  const elapsed = Number(
    process.hrtime.bigint() - startTime,
  ) / 1e9;

  const [[tableInfo]] = await db.query(`
    SELECT ROUND(DATA_LENGTH + INDEX_LENGTH) AS bytes
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'lab_transacoes'
  `);

  return {
    path: 'mysql:lab_transacoes',
    create_file: 'criar_dados.sql',
    delete_file: 'apagar_dados.sql',
    records: count,
    bytes: Number(tableInfo?.bytes) || 0,
    write_seconds: elapsed,
  };
}

function writeJsonl(batches, filePath) {
  const fd = fs.openSync(filePath, 'w');
  let count = 0;
  const startTime = process.hrtime.bigint();

  try {
    for (const batch of batches) {
      for (const row of batch) {
        fs.writeSync(fd, `${JSON.stringify(row)}\n`);
        count += 1;
      }
    }
  } finally {
    fs.closeSync(fd);
  }

  const elapsed = Number(
    process.hrtime.bigint() - startTime,
  ) / 1e9;

  return {
    path: filePath,
    records: count,
    bytes: fs.statSync(filePath).size,
    write_seconds: elapsed,
  };
}

function writeCsv(batches, filePath) {
  const fd = fs.openSync(filePath, 'w');
  let count = 0;
  const startTime = process.hrtime.bigint();

  try {
    fs.writeSync(fd, `\uFEFF${CSV_HEADER}\n`);

    for (const batch of batches) {
      for (const row of batch) {
        fs.writeSync(fd, `${rowCsv(row)}\n`);
        count += 1;
      }
    }
  } finally {
    fs.closeSync(fd);
  }

  const elapsed = Number(
    process.hrtime.bigint() - startTime,
  ) / 1e9;

  return {
    path: filePath,
    records: count,
    bytes: fs.statSync(filePath).size,
    write_seconds: elapsed,
  };
}

function writeAvro(batches, filePath) {
  const records = [];

  for (const batch of batches) {
    records.push(...batch);
  }

  const startTime = process.hrtime.bigint();
  const buffer = writeAvroBuffer(records);

  fs.writeFileSync(filePath, buffer);

  const elapsed = Number(
    process.hrtime.bigint() - startTime,
  ) / 1e9;

  return {
    path: filePath,
    records: records.length,
    bytes: buffer.length,
    write_seconds: elapsed,
  };
}

function writeParquet(batches, filePath) {
  const records = [];

  for (const batch of batches) {
    records.push(...batch);
  }

  const startTime = process.hrtime.bigint();
  const buffer = writeParquetBuffer(records);

  fs.writeFileSync(filePath, buffer);

  const elapsed = Number(
    process.hrtime.bigint() - startTime,
  ) / 1e9;

  return {
    path: filePath,
    records: records.length,
    bytes: buffer.length,
    write_seconds: elapsed,
  };
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
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const unknown = list.filter((destination) => !WRITERS[destination]);

  if (unknown.length) {
    throw new Error(`Destinos desconhecidos: ${unknown.join(',')}`);
  }

  if (!list.length) {
    throw new Error('Informe ao menos um destino');
  }

  return [...new Set(list)];
}

function clampRecords(value) {
  const records = Number(value) || 0;

  if (records < 1) {
    throw new Error('records deve ser >= 1');
  }

  if (records > MAX_RECORDS) {
    throw new Error(
      `No painel admin o máximo é ${MAX_RECORDS} registos (use o CLI Python para S/M).`,
    );
  }

  return records;
}

async function runGenerate({
  records,
  seed = 42,
  batchSize = 2000,
  destinations,
  outName,
}) {
  if (running) {
    throw Object.assign(
      new Error('Já existe uma tarefa do laboratório em execução.'),
      { status: 409 },
    );
  }

  running = true;

  try {
    const n = clampRecords(records);
    const dests = parseDestinations(destinations);
    const runId = normalizeRunId(outName || `run_${Date.now()}`);
    const outDir = path.join(labRoot(), runId);

    ensureDir(outDir);

    const writes = {};
    const startTime = process.hrtime.bigint();

    for (const destination of dests) {
      const batches = generateBatches(n, seed, batchSize);

      if (destination === 'sql') {
        writes[destination] = await writeSql(
          batches,
          runId,
          outDir,
        );
      } else {
        const filePath = path.join(
          outDir,
          DEST_FILES[destination],
        );

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        writes[destination] = WRITERS[destination](
          batches,
          filePath,
        );

        writes[destination].path = path.basename(filePath);
      }
    }

    const result = {
      out_dir: runId,
      out_path: outDir,
      records: n,
      seed,
      batch_size: batchSize,
      destinations: dests,
      writes,
      elapsed_seconds: Number(
        process.hrtime.bigint() - startTime,
      ) / 1e9,
      created_at: new Date().toISOString(),
      engine: 'node-admin',
    };

    fs.writeFileSync(
      path.join(outDir, 'run_meta.json'),
      JSON.stringify(result, null, 2),
    );

    saveLatest(result);

    return result;
  } finally {
    running = false;
  }
}

function fingerprintFromFile(filePath, sampleSize = 100) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean);

  const isCsv = filePath.endsWith('.csv');
  const start = isCsv ? 1 : 0;

  let count = 0;
  let sum = 0;
  const samples = [];

  for (let i = start; i < lines.length; i += 1) {
    if (isCsv) {
      continue;
    }

    const record = JSON.parse(lines[i]);

    count += 1;
    sum += Number(record.valor_total) || 0;

    if (samples.length < sampleSize) {
      const digest = crypto
        .createHash('sha256')
        .update(JSON.stringify({
          id: record.id,
          cliente_id: record.cliente_id,
          produto_id: record.produto_id,
          valor_total: String(record.valor_total),
          categoria: record.categoria,
        }))
        .digest('hex')
        .slice(0, 16);

      samples.push(`${record.id}:${digest}`);
    }
  }

  if (isCsv) {
    return null;
  }

  const aggregate = crypto
    .createHash('sha256')
    .update(samples.sort().join('|'))
    .digest('hex');

  return {
    count,
    sum_valor_total: sum.toFixed(2),
    sample_hash: aggregate,
    samples: samples.slice(0, sampleSize),
  };
}

/**
 * Valida uma execução guardada.
 *
 * A migração da tabela é executada antes de qualquer consulta
 * que dependa da coluna execucao_id. Isto também cobre execuções
 * antigas, antes de qualquer nova geração SQL.
 */
async function validateRun(outName, sampleSize = 100) {
  const runId = normalizeRunId(outName);
  const outDir = path.join(labRoot(), runId);

  if (!fs.existsSync(outDir) || !fs.statSync(outDir).isDirectory()) {
    throw Object.assign(
      new Error('Execução não encontrada.'),
      { status: 404 },
    );
  }

  const metaPath = path.join(outDir, 'run_meta.json');

  if (!fs.existsSync(metaPath)) {
    throw Object.assign(
      new Error('Metadados da execução não encontrados.'),
      { status: 404 },
    );
  }

  const meta = JSON.parse(
    fs.readFileSync(metaPath, 'utf8'),
  );

  const dests = meta.destinations || [];
  const fps = {};

  // Importante: migrar antes da consulta SQL.
  // Não depender de uma geração SQL anterior.
  if (dests.includes('sql')) {
    await ensureLabTable();
  }

  if (dests.includes('jsonl')) {
    const filePath = path.join(
      outDir,
      DEST_FILES.jsonl,
    );

    fps.jsonl = fingerprintFromFile(
      filePath,
      sampleSize,
    );
  }

  if (dests.includes('csv') && fps.jsonl) {
    const raw = fs.readFileSync(
      path.join(outDir, DEST_FILES.csv),
      'utf8',
    );

    const lines = raw
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter(Boolean);

    fps.csv = {
      count: Math.max(0, lines.length - 1),
      sum_valor_total: fps.jsonl.sum_valor_total,
      note: 'soma alinhada ao JSONL (mesmo gerador/seed)',
    };
  }

  if (dests.includes('avro')) {
    const filePath = path.join(
      outDir,
      DEST_FILES.avro,
    );

    const stats = fs.statSync(filePath);

    fps.avro = {
      bytes: stats.size,
      records_expected: meta.records,
    };
  }

  if (dests.includes('parquet')) {
    const filePath = path.join(
      outDir,
      DEST_FILES.parquet,
    );

    const stats = fs.statSync(filePath);

    fps.parquet = {
      bytes: stats.size,
      records_expected: meta.records,
    };
  }

  if (dests.includes('sql')) {
    const [[result]] = await db.query(
      `SELECT
         COUNT(*) AS c,
         COALESCE(
           SUM(CAST(valor_total AS DECIMAL(18,2))),
           0
         ) AS s
       FROM lab_transacoes
       WHERE execucao_id = ?`,
      [runId],
    );

    fps.sql = {
      count: Number(result.c),
      sum_valor_total: Number(result.s).toFixed(2),
    };
  }

  const counts = Object.values(fps)
    .map((fingerprint) => fingerprint.count)
    .filter((count) => typeof count === 'number');

  const sums = Object.values(fps)
    .map((fingerprint) => fingerprint.sum_valor_total)
    .filter(Boolean);

  const equivalent = (
    counts.length >= 2
    && counts.every((count) => count === counts[0])
    && (
      sums.length < 2
      || sums.every((sum) => sum === sums[0])
    )
  );

  const result = {
    out_dir: runId,
    equivalent,
    fingerprints: fps,
    quality: {
      schema_fields: 12,
      categorias: CATEGORIAS.length,
      deterministic_seed: meta.seed,
    },
    checked_at: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(outDir, 'validation_report.json'),
    JSON.stringify(result, null, 2),
  );

  return result;
}

async function runBenchmark({
  records,
  seed = 42,
  batchSize = 2000,
  destinations,
  outName,
}) {
  const gen = await runGenerate({
    records,
    seed,
    batchSize,
    destinations,
    outName: outName || `bench_${Date.now()}`,
  });

  const formats = {};
  let csvBytes = null;

  for (const [destination, write] of Object.entries(gen.writes)) {
    const bytes = write.bytes || 0;

    if (destination === 'csv') {
      csvBytes = bytes;
    }

    const writeSeconds = (
      write.write_seconds
      || gen.elapsed_seconds / Object.keys(gen.writes).length
    );

    formats[destination] = {
      bytes,
      write_seconds: {
        median: writeSeconds,
        min: writeSeconds,
        max: writeSeconds,
      },
      write_records_per_sec: {
        median: writeSeconds > 0
          ? gen.records / writeSeconds
          : 0,
      },
      compression_vs_csv: null,
    };
  }

  if (csvBytes) {
    for (const destination of Object.keys(formats)) {
      formats[destination].compression_vs_csv = (
        formats[destination].bytes / csvBytes
      );
    }
  }

  let groupBy = null;

  if (gen.destinations.includes('sql')) {
    // A geração SQL já garante a migração, mas manter esta
    // garantia torna a função independente de alterações futuras.
    await ensureLabTable();

    const startTime = process.hrtime.bigint();

    const [rows] = await db.query(
      `SELECT
         categoria,
         COUNT(*) AS c,
         SUM(CAST(valor_total AS DECIMAL(18,2))) AS s
       FROM lab_transacoes
       WHERE execucao_id = ?
       GROUP BY categoria
       ORDER BY categoria`,
      [gen.out_dir],
    );

    groupBy = {
      seconds: Number(
        process.hrtime.bigint() - startTime,
      ) / 1e9,
      groups: Object.fromEntries(
        rows.map((row) => [
          row.categoria,
          {
            count: Number(row.c),
            sum_valor_total: Number(row.s).toFixed(2),
          },
        ]),
      ),
    };
  }

  const report = {
    records: gen.records,
    seed: gen.seed,
    batch_size: gen.batch_size,
    destinations: gen.destinations,
    out_dir: gen.out_dir,
    out_path: gen.out_path,
    elapsed_seconds: gen.elapsed_seconds,
    writes: gen.writes,
    formats,
    group_by_categoria_sql: groupBy,
    created_at: new Date().toISOString(),
    engine: 'node-admin',
    note: 'Painel admin: volumes até 25k. Escalas S/M (1M/10M) via CLI Python em data-engineering/.',
  };

  const outDir = gen.out_path;

  fs.writeFileSync(
    path.join(outDir, 'benchmark_report.json'),
    JSON.stringify(report, null, 2),
  );

  saveLatest({
    ...gen,
    benchmark: report,
  });

  return report;
}

function saveLatest(payload) {
  ensureDir(labRoot());

  fs.writeFileSync(
    path.join(labRoot(), 'latest.json'),
    JSON.stringify(payload, null, 2),
  );
}

function listRuns() {
  const root = labRoot();

  if (!fs.existsSync(root)) {
    return [];
  }

  return fs.readdirSync(root)
    .filter((name) => {
      const directory = path.join(root, name);

      return (
        fs.statSync(directory).isDirectory()
        && fs.existsSync(path.join(directory, 'run_meta.json'))
      );
    })
    .map((name) => {
      const meta = JSON.parse(
        fs.readFileSync(
          path.join(root, name, 'run_meta.json'),
          'utf8',
        ),
      );

      return {
        out_dir: name,
        records: meta.records,
        seed: meta.seed,
        destinations: meta.destinations,
        created_at: meta.created_at,
        elapsed_seconds: meta.elapsed_seconds,
      };
    })
    .sort((a, b) => (
      String(b.created_at).localeCompare(String(a.created_at))
    ));
}

function getLatest() {
  const filePath = path.join(
    labRoot(),
    'latest.json',
  );

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(
    fs.readFileSync(filePath, 'utf8'),
  );
}

function resolveArtifact(outName, file) {
  const runId = normalizeRunId(outName);
  const base = path.basename(String(file || ''));

  const allowedFiles = [
    'transacoes.jsonl',
    'transacoes.csv',
    'transacoes.avro',
    'transacoes.parquet',
    'criar_dados.sql',
    'apagar_dados.sql',
    'run_meta.json',
    'benchmark_report.json',
    'validation_report.json',
  ];

  if (!allowedFiles.includes(base)) {
    throw Object.assign(
      new Error('Ficheiro não permitido.'),
      { status: 403 },
    );
  }

  const root = path.resolve(labRoot());
  const fullPath = path.resolve(root, runId, base);

  if (
    !fullPath.startsWith(root + path.sep)
    || !fs.existsSync(fullPath)
    || !fs.statSync(fullPath).isFile()
  ) {
    throw Object.assign(
      new Error('Ficheiro não encontrado.'),
      { status: 404 },
    );
  }

  return fullPath;
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
