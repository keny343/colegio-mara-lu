const fs = require('fs');
const path = require('path');
const avro = require('avsc');
const parquet = require('parquetjs-lite');
const Database = require('better-sqlite3');

const { computeHash, computeStats } = require('./generator');

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

  values.push(current);
  return values.map((value) => value.replace(/\r$/, ''));
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
    const stringValue = String(value ?? '');
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }).join(',');
}

function recordFromCsvRow(row) {
  const [
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

async function writeJsonl(filePath, records) {
  const lines = records.map((record) => JSON.stringify(record));
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  return records.length;
}

async function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeCsv(filePath, records) {
  const header = [
    'id',
    'cliente_id',
    'produto_id',
    'data_transacao',
    'categoria',
    'quantidade',
    'preco_unitario',
    'valor_total',
    'estado',
    'descricao',
    'localizacao',
    'metadados'
  ].join(',');

  const lines = [header, ...records.map((record) => csvRowFromRecord(record))];
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  return records.length;
}

async function readCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return rows.map((row) => recordFromCsvRow(row));
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
    { name: 'localizacao', type: { type: 'record', name: 'Localizacao', fields: [
      { name: 'provincia', type: 'string' },
      { name: 'municipio', type: 'string' },
      { name: 'zona', type: 'string' }
    ]}},
    { name: 'metadados', type: { type: 'record', name: 'Metadados', fields: [
      { name: 'canal', type: 'string' },
      { name: 'origem', type: 'string' },
      { name: 'terminal', type: 'string' },
      { name: 'tags', type: { type: 'array', items: 'string' } }
    ]}}
  ]
};

function avroType() {
  return avro.Type.forSchema(AVRO_SCHEMA);
}

async function writeAvro(filePath, records) {
  const type = avroType();
  const encoder = avro.createFileEncoder(filePath, type);
  for (const record of records) {
    encoder.write(record);
  }
  encoder.end();
  return records.length;
}

async function readAvro(filePath) {
  const decoder = avro.createFileDecoder(filePath);
  const records = [];
  for (const row of decoder) {
    records.push(row);
  }
  return records;
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
  let record = null;

  while ((record = await reader.read()) !== null) {
    rows.push({
      id: Number(record.id),
      cliente_id: Number(record.cliente_id),
      produto_id: Number(record.produto_id),
      data_transacao: record.data_transacao,
      categoria: record.categoria,
      quantidade: Number(record.quantidade),
      preco_unitario: record.preco_unitario,
      valor_total: record.valor_total,
      estado: record.estado,
      descricao: record.descricao,
      localizacao: JSON.parse(record.localizacao),
      metadados: JSON.parse(record.metadados)
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

  const tx = db.transaction(() => {
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
  });

  tx();
  db.close();
  return records.length;
}

async function readSqlite(filePath) {
  const db = new Database(filePath);
  const rows = db.prepare(`
    SELECT id, cliente_id, produto_id, data_transacao, categoria, quantidade,
      preco_unitario, valor_total, estado, descricao, localizacao, metadados
    FROM transacoes
    ORDER BY id ASC
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

async function ensureOutputDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function writeDestination({ destination, filePath, records }) {
  switch (destination) {
    case 'jsonl':
      return writeJsonl(filePath, records);
    case 'csv':
      return writeCsv(filePath, records);
    case 'avro':
      return writeAvro(filePath, records);
    case 'parquet':
      return writeParquet(filePath, records);
    case 'sql':
      return writeSqlite(filePath, records);
    default:
      throw new Error(`Destino desconhecido: ${destination}`);
  }
}

async function readDestination({ destination, filePath }) {
  switch (destination) {
    case 'jsonl':
      return readJsonl(filePath);
    case 'csv':
      return readCsv(filePath);
    case 'avro':
      return readAvro(filePath);
    case 'parquet':
      return readParquet(filePath);
    case 'sql':
      return readSqlite(filePath);
    default:
      throw new Error(`Destino desconhecido: ${destination}`);
  }
}

function validateRecords(expectedRecords, actualRecords) {
  if (expectedRecords.length !== actualRecords.length) {
    throw new Error(`Contagem divergente: esperado ${expectedRecords.length}, obtido ${actualRecords.length}`);
  }

  const expectedSum = expectedRecords.reduce((sum, record) => sum + Number(record.valor_total), 0);
  const actualSum = actualRecords.reduce((sum, record) => sum + Number(record.valor_total), 0);

  if (Math.abs(expectedSum - actualSum) > 0.01) {
    throw new Error(`Soma divergente: esperado ${expectedSum.toFixed(2)}, obtido ${actualSum.toFixed(2)}`);
  }

  for (let i = 0; i < expectedRecords.length; i += 1) {
    const expected = computeHash(expectedRecords[i]);
    const actual = computeHash(actualRecords[i]);
    if (expected !== actual) {
      throw new Error(`Hash divergente no registo ${i}: ${expected} != ${actual}`);
    }
  }

  return {
    count: actualRecords.length,
    total: Number(actualSum.toFixed(2)),
    sampleHashes: actualRecords.slice(0, 5).map((record) => computeHash(record))
  };
}

async function benchmarkDestination({ destination, outputDir, recordCount, batchSize, seed }) {
  const fileName = `${destination === 'sql' ? 'database' : destination}.${destination === 'jsonl' ? 'jsonl' : destination === 'csv' ? 'csv' : destination === 'avro' ? 'avro' : destination === 'parquet' ? 'parquet' : 'db'}`;
  const filePath = path.join(outputDir, fileName);
  const recordsByBatch = [];
  let expectedRecords = 0;
  let expectedTotal = 0;
  let sampleHashes = [];

  await ensureOutputDir(outputDir);
  const writeStart = Date.now();

  for (const batch of require('./generator').generateRecordsBatches({ count: recordCount, batchSize, seed })) {
    recordsByBatch.push(batch);
    for (const record of batch) {
      expectedTotal += Number(record.valor_total);
      sampleHashes.push(computeHash(record));
    }
    expectedRecords += batch.length;
  }

  const flattenedRecords = recordsByBatch.flat();
  const writeTarget = destination === 'sql' ? filePath.replace(/\.db$/, '.sqlite') : filePath;

  await writeDestination({ destination, filePath: writeTarget, records: flattenedRecords });
  const writeElapsed = Date.now() - writeStart;

  const readStart = Date.now();
  const actualRecords = await readDestination({ destination, filePath: writeTarget });
  const readElapsed = Date.now() - readStart;

  const validation = validateRecords(flattenedRecords, actualRecords);
  const stats = computeStats(actualRecords);
  const fileSize = fs.existsSync(writeTarget) ? fs.statSync(writeTarget).size : 0;

  return {
    destination,
    file: writeTarget,
    fileSize,
    writeMs: writeElapsed,
    readMs: readElapsed,
    rows: actualRecords.length,
    total: stats.total,
    counts: stats.count,
    sumTotal: stats.total,
    sampleHashes: validation.sampleHashes,
    validationPassed: true,
    expectedCount: expectedRecords,
    expectedTotal: Number(expectedTotal.toFixed(2)),
    validationDetails: {
      matches: validation.count,
      total: validation.total,
      sampleHashes: validation.sampleHashes
    }
  };
}

module.exports = {
  writeJsonl,
  readJsonl,
  writeCsv,
  readCsv,
  writeAvro,
  readAvro,
  writeParquet,
  readParquet,
  writeSqlite,
  readSqlite,
  writeDestination,
  readDestination,
  ensureOutputDir,
  validateRecords,
  benchmarkDestination,
  AVRO_SCHEMA,
  PARQUET_SCHEMA
};
