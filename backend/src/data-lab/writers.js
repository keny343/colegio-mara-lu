const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const avro = require('avsc');
const parquet = require('parquetjs-lite');
const Database = require('better-sqlite3');

const { computeHash, computeStats, generateRecordsBatches } = require('../src/data-lab/generator');

function parseCsvLine(line) {
  let current = '';
  const values = [];
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current.replace(/\r$/, ''));
  return values;
}

function csvRowFromRecord(record) {
  const fields = [
    record.id,
    record.cliente_id,
    record.produto_id,
    record.data_transacao,
    record.categoria,
    record.quantidade,
    record.preco_unitario,
    record.valor_total,
    record.estado,
    record.descricao,
    JSON.stringify(record.localizacao),
    JSON.stringify(record.metadados)
  ];

  return fields.map((value) => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(',');
}

function recordFromCsvRow(row) {
  const [
    id, cliente_id, produto_id, data_transacao, categoria, quantidade,
    preco_unitario, valor_total, estado, descricao, localizacao, metadados
  ] = row;

  return {
    id: Number(id),
    cliente_id: Number(cliente_id),
    produto_id: Number(produto_id),
    data_transacao,
    categoria,
    quantidade: Number(quantidade),
    preco_unitario,
    valor_total,
    estado,
    descricao,
    localizacao: JSON.parse(localizacao),
    metadados: JSON.parse(metadados)
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function writeJsonl(filePath, records) {
  const text = records.map((record) => JSON.stringify(record)).join('\n');
  fs.writeFileSync(filePath, `${text}\n`, 'utf8');
  return records.length;
}

async function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeCsv(filePath, records) {
  const header = [
    'id', 'cliente_id', 'produto_id', 'data_transacao', 'categoria', 'quantidade',
    'preco_unitario', 'valor_total', 'estado', 'descricao', 'localizacao', 'metadados'
  ].join(',');

  const rows = [header, ...records.map((record) => csvRowFromRecord(record))];
  fs.writeFileSync(filePath, `${rows.join('\n')}\n`, 'utf8');
  return records.length;
}

async function readCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => recordFromCsvRow(parseCsvLine(line)));
}

const AVRO_SCHEMA = {
  type: 'record',
  name: 'transacoes_sinteticas',
  fields: [
    { name: 'id', type: 'long' },
    { name: 'cliente_id', type: 'long' },
    { name: 'produto_id', type: 'long' },
    { name: 'data_transacao', type: 'string' },
    { name: 'categoria', type: 'string' },
    { name: 'quantidade', type: 'int' },
    { name: 'preco_unitario', type: 'string' },
    { name: 'valor_total', type: 'string' },
    { name: 'estado', type: 'string' },
    { name: 'descricao', type: 'string' },
    {
      name: 'localizacao',
      type: {
        type: 'record',
        name: 'Localizacao',
        fields: [
          { name: 'provincia', type: 'string' },
          { name: 'municipio', type: 'string' },
          { name: 'zona', type: 'string' }
        ]
      }
    },
    {
      name: 'metadados',
      type: {
        type: 'record',
        name: 'Metadados',
        fields: [
          { name: 'canal', type: 'string' },
          { name: 'origem', type: 'string' },
          { name: 'terminal', type: 'string' },
          { name: 'tags', type: { type: 'array', items: 'string' } }
        ]
      }
    }
  ]
};

async function writeAvro(filePath, records) {
  const type = avro.Type.forSchema(AVRO_SCHEMA);
  const encoder = avro.createFileEncoder(filePath, type);
  for (const record of records) {
    encoder.write(record);
  }
  encoder.end();
  return records.length;
}

async function readAvro(filePath) {
  const decoder = avro.createFileDecoder(filePath);
  const output = [];
  for (const row of decoder) output.push(row);
  return output;
}

const PARQUET_SCHEMA = new parquet.ParquetSchema({
  id: { type: 'INT64', optional: false },
  cliente_id: { type: 'INT64', optional: false },
  produto_id: { type: 'INT64', optional: false },
  data_transacao: { type: 'BYTE_ARRAY', convertedType: 'UTF8', optional: false },
  categoria: { type: 'BYTE_ARRAY', convertedType: 'UTF8', optional: false },
  quantidade: { type: 'INT32', optional: false },
  preco_unitario: { type: 'BYTE_ARRAY', convertedType: 'UTF8', optional: false },
  valor_total: { type: 'BYTE_ARRAY', convertedType: 'UTF8', optional: false },
  estado: { type: 'BYTE_ARRAY', convertedType: 'UTF8', optional: false },
  descricao: { type: 'BYTE_ARRAY', convertedType: 'UTF8', optional: false },
  localizacao: { type: 'BYTE_ARRAY', convertedType: 'UTF8', optional: false },
  metadados: { type: 'BYTE_ARRAY', convertedType: 'UTF8', optional: false }
});

async function writeParquet(filePath, records) {
  const writer = await parquet.ParquetWriter.openFile(PARQUET_SCHEMA, filePath);
  for (const record of records) {
    await writer.append({
      id: record.id,
      cliente_id: record.cliente_id,
      produto_id: record.produto_id,
      data_transacao: record.data_transacao,
      categoria: record.categoria,
      quantidade: record.quantidade,
      preco_unitario: record.preco_unitario,
      valor_total: record.valor_total,
      estado: record.estado,
      descricao: record.descricao,
      localizacao: JSON.stringify(record.localizacao),
      metadados: JSON.stringify(record.metadados)
    });
  }
  await writer.close();
  return records.length;
}

async function readParquet(filePath) {
  const reader = await parquet.ParquetReader.openFile(filePath);
  const rows = [];
  let row = null;
  while ((row = await reader.read()) !== null) {
    rows.push({
      id: Number(row.id),
      cliente_id: Number(row.cliente_id),
      produto_id: Number(row.produto_id),
      data_transacao: row.data_transacao,
      categoria: row.categoria,
      quantidade: Number(row.quantidade),
      preco_unitario: row.preco_unitario,
      valor_total: row.valor_total,
      estado: row.estado,
      descricao: row.descricao,
      localizacao: JSON.parse(row.localizacao),
      metadados: JSON.parse(row.metadados)
    });
  }
  await reader.close();
  return rows;
}

async function writeSqlite(filePath, records) {
  const db = new Database(filePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS transacoes (
      id INTEGER PRIMARY KEY,
      cliente_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      data_transacao TEXT NOT NULL,
      categoria TEXT NOT NULL,
      quantidade INTEGER NOT NULL,
      preco_unitario REAL NOT NULL,
      valor_total REAL NOT NULL,
      estado TEXT NOT NULL,
      descricao TEXT NOT NULL,
      localizacao TEXT NOT NULL,
      metadados TEXT NOT NULL
    );
  `);

  const stmt = db.prepare(`
    INSERT INTO transacoes (
      id, cliente_id, produto_id, data_transacao, categoria, quantidade,
      preco_unitario, valor_total, estado, descricao, localizacao, metadados
    ) VALUES (
      @id, @cliente_id, @produto_id, @data_transacao, @categoria, @quantidade,
      @preco_unitario, @valor_total, @estado, @descricao, @localizacao, @metadados
    )
  `);

  db.transaction(() => {
    for (const record of records) {
      stmt.run({
        id: record.id,
        cliente_id: record.cliente_id,
        produto_id: record.produto_id,
        data_transacao: record.data_transacao,
        categoria: record.categoria,
        quantidade: record.quantidade,
        preco_unitario: Number(record.preco_unitario),
        valor_total: Number(record.valor_total),
        estado: record.estado,
        descricao: record.descricao,
        localizacao: JSON.stringify(record.localizacao),
        metadados: JSON.stringify(record.metadados)
      });
    }
  })();

  db.close();
  return records.length;
}

async function readSqlite(filePath) {
  const db = new Database(filePath);
  const rows = db.prepare(`
    SELECT id, cliente_id, produto_id, data_transacao, categoria, quantidade,
           preco_unitario, valor_total, estado, descricao, localizacao, metadados
    FROM transacoes ORDER BY id ASC
  `).all();
  db.close();

  return rows.map((row) => ({
    id: Number(row.id),
    cliente_id: Number(row.cliente_id),
    produto_id: Number(row.produto_id),
    data_transacao: row.data_transacao,
    categoria: row.categoria,
    quantidade: Number(row.quantidade),
    preco_unitario: Number(row.preco_unitario).toFixed(2),
    valor_total: Number(row.valor_total).toFixed(2),
    estado: row.estado,
    descricao: row.descricao,
    localizacao: JSON.parse(row.localizacao),
    metadados: JSON.parse(row.metadados)
  }));
}

async function writeDestination(destination, filePath, records) {
  switch (destination) {
    case 'jsonl': return writeJsonl(filePath, records);
    case 'csv': return writeCsv(filePath, records);
    case 'avro': return writeAvro(filePath, records);
    case 'parquet': return writeParquet(filePath, records);
    case 'sql': return writeSqlite(filePath, records);
    default: throw new Error(`Destino desconhecido: ${destination}`);
  }
}

async function readDestination(destination, filePath) {
  switch (destination) {
    case 'jsonl': return readJsonl(filePath);
    case 'csv': return readCsv(filePath);
    case 'avro': return readAvro(filePath);
    case 'parquet': return readParquet(filePath);
    case 'sql': return readSqlite(filePath);
    default: throw new Error(`Destino desconhecido: ${destination}`);
  }
}

function validateRecords(expected, actual) {
  if (expected.length !== actual.length) {
    throw new Error(`Contagem divergente: esperado ${expected.length} e obtido ${actual.length}`);
  }

  const expectedSum = expected.reduce((sum, record) => sum + Number(record.valor_total), 0);
  const actualSum = actual.reduce((sum, record) => sum + Number(record.valor_total), 0);
  if (Math.abs(expectedSum - actualSum) > 0.01) {
    throw new Error(`Soma divergente: esperado ${expectedSum.toFixed(2)} e obtido ${actualSum.toFixed(2)}`);
  }

  for (let i = 0; i < expected.length; i += 1) {
    if (computeHash(expected[i]) !== computeHash(actual[i])) {
      throw new Error(`Hash divergente no registo ${i}`);
    }
  }

  return {
    count: actual.length,
    total: Number(actualSum.toFixed(2)),
    sampleHashes: actual.slice(0, 5).map((record) => computeHash(record))
  };
}

async function benchmarkDestination(destination, outputDir, count, batchSize, seed) {
  ensureDir(outputDir);
  const fileName = destination === 'sql' ? 'dataset.sqlite' : `${destination}.${destination === 'jsonl' ? 'jsonl' : destination === 'csv' ? 'csv' : destination === 'avro' ? 'avro' : 'parquet'}`;
  const filePath = path.join(outputDir, fileName);

  const batches = [];
  let expectedCount = 0;
  let accumulatedTotal = 0;

  for (const batch of generateRecordsBatches({ count, batchSize, seed })) {
    batches.push(batch);
    for (const record of batch) {
      expectedCount += 1;
      accumulatedTotal += Number(record.valor_total);
    }
  }

  const flatRecords = batches.flat();
  const writeStart = Date.now();
  await writeDestination(destination, filePath, flatRecords);
  const writeMs = Date.now() - writeStart;

  const readStart = Date.now();
  const readRecords = await readDestination(destination, filePath);
  const readMs = Date.now() - readStart;

  const validation = validateRecords(flatRecords, readRecords);
  const stats = computeStats(readRecords);
  const fileSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;

  return {
    destination,
    file: filePath,
    rows: readRecords.length,
    writeMs,
    readMs,
    fileSize,
    total: stats.total,
    validationPassed: true,
    expectedCount,
    expectedTotal: Number(accumulatedTotal.toFixed(2)),
    sampleHashes: validation.sampleHashes
  };
}

function parseArgs(argv) {
  const result = {
    count: 100000,
    batch: 10000,
    seed: 42,
    destinations: ['jsonl', 'csv', 'avro', 'parquet', 'sql'],
    outputDir: path.resolve(path.join(__dirname, '..', 'data-lab-output')),
    repetitions: 1
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];
    if (current === '--count') result.count = Number(next || result.count);
    if (current === '--batch') result.batch = Number(next || result.batch);
    if (current === '--seed') result.seed = Number(next || result.seed);
    if (current === '--destinations') result.destinations = String(next || result.destinations).split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (current === '--output') result.outputDir = path.resolve(next || result.outputDir);
    if (current === '--repetitions') result.repetitions = Number(next || result.repetitions);
  }

  return result;
}

function buildMarkdownReport(results) {
  const rows = results.map((result) => `| ${result.destination} | ${path.basename(result.file)} | ${result.rows} | ${result.writeMs} | ${result.readMs} | ${result.fileSize} | ${result.total.toFixed(2)} | ${result.validationPassed ? 'OK' : 'FAIL'} |` );
  return [
    '# Relatório do Laboratório de Dados',
    '',
    '| Destino | Arquivo | Registos | Write (ms) | Read (ms) | Tamanho (bytes) | Total | Validação |',
    '|---|---|---:|---:|---:|---:|---:|---|',
    ...rows,
    ''
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = [];

  for (let rep = 1; rep <= args.repetitions; rep += 1) {
    for (const destination of args.destinations) {
      const outDir = path.join(args.outputDir, `run-${rep}`);
      const result = await benchmarkDestination(destination, outDir, args.count, args.batch, args.seed);
      result.seed = args.seed;
      result.count = args.count;
      result.batch = args.batch;
      result.rep = rep;
      results.push(result);
    }
  }

  const summaryPath = path.join(args.outputDir, 'lab-summary.json');
  const reportPath = path.join(args.outputDir, 'lab-report.md');
  fs.writeFileSync(summaryPath, JSON.stringify({ generatedAt: new Date().toISOString(), args, results }, null, 2), 'utf8');
  fs.writeFileSync(reportPath, buildMarkdownReport(results), 'utf8');

  console.log(`\n[LAB] Benchmark concluído. Arquivos em ${args.outputDir}`);
  for (const result of results) {
    console.log(`[LAB] ${result.destination}: ${result.rows} registos | write=${result.writeMs}ms | read=${result.readMs}ms | size=${result.fileSize} bytes | total=${result.total.toFixed(2)} | valid=${result.validationPassed ? 'OK' : 'FAIL'}`);
  }
}

main().catch((error) => {
  console.error('[LAB] Erro:', error);
  process.exitCode = 1;
});

module.exports = {
  benchmarkDestination,
  writeDestination,
  readDestination,
  validateRecords,
  AVRO_SCHEMA,
  PARQUET_SCHEMA
};
