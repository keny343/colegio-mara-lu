'use strict';

/** Escritores Avro OCF e Parquet simples para o registo aluno + notas. */
const crypto = require('crypto');

const AVRO_SCHEMA = {
  type: 'record',
  name: 'AlunoNotas',
  namespace: 'colegio.mara_lu.lab',
  fields: [
    { name: 'id', type: 'long' },
    { name: 'nome', type: 'string' },
    { name: 'email', type: 'string' },
    { name: 'role', type: 'string' },
    { name: 'ativo', type: 'int' },
    { name: 'data_nascimento', type: 'string' },
    { name: 'sexo', type: 'string' },
    { name: 'nacionalidade', type: 'string' },
    { name: 'nome_mae', type: 'string' },
    { name: 'nome_pai', type: 'string' },
    { name: 'responsavel', type: 'string' },
    { name: 'telefone_emergencia', type: 'string' },
    { name: 'turma_id', type: 'long' },
    { name: 'turma_nome', type: 'string' },
    { name: 'curso_id', type: ['null', 'long'], default: null },
    { name: 'curso_nome', type: 'string' },
    { name: 'serie_classe', type: 'int' },
    { name: 'ano_letivo', type: 'int' },
    { name: 'turno', type: 'string' },
    { name: 'notas', type: 'string' },
  ],
};

function concatBytes(chunks) {
  const total = chunks.reduce((n, chunk) => n + chunk.length, 0);
  const out = Buffer.allocUnsafe(total);
  let offset = 0;
  for (const chunk of chunks) {
    Buffer.from(chunk).copy(out, offset);
    offset += chunk.length;
  }
  return out;
}

function u32le(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}
function f64le(n) {
  const b = Buffer.allocUnsafe(8);
  b.writeDoubleLE(Number(n), 0);
  return b;
}
function uvarint(n) {
  let value = BigInt(n);
  const bytes = [];
  while (value >= 0x80n) {
    bytes.push(Number((value & 0x7fn) | 0x80n));
    value >>= 7n;
  }
  bytes.push(Number(value));
  return Buffer.from(bytes);
}
function zigzag(n) {
  const value = BigInt(n);
  return uvarint((value << 1n) ^ (value >> 63n));
}
function avroString(value) {
  const raw = Buffer.from(String(value ?? ''), 'utf8');
  return concatBytes([zigzag(raw.length), raw]);
}
function avroLong(value) { return zigzag(value); }
function avroInt(value) { return zigzag(value); }

function encodeRecord(row) {
  const parts = [
    avroLong(row.id), avroString(row.nome), avroString(row.email),
    avroString(row.role), avroInt(row.ativo), avroString(row.data_nascimento),
    avroString(row.sexo), avroString(row.nacionalidade), avroString(row.nome_mae),
    avroString(row.nome_pai), avroString(row.responsavel),
    avroString(row.telefone_emergencia), avroLong(row.turma_id),
    avroString(row.turma_nome),
  ];
  if (row.curso_id == null) parts.push(zigzag(0));
  else parts.push(zigzag(1), avroLong(row.curso_id));
  parts.push(
    avroString(row.curso_nome), avroInt(row.serie_classe),
    avroInt(row.ano_letivo), avroString(row.turno),
    avroString(JSON.stringify(row.notas || [])),
  );
  return concatBytes(parts);
}

function writeAvroBuffer(records) {
  const schemaJson = JSON.stringify(AVRO_SCHEMA);
  const sync = crypto.createHash('sha256')
    .update(records.map((r) => `${r.id}:${r.email}`).join('|'))
    .digest().subarray(0, 16);
  const header = concatBytes([
    Buffer.from('Obj\x01', 'binary'), zigzag(2),
    avroString('avro.codec'), Buffer.from('\x08null', 'binary'),
    avroString('avro.schema'), avroString(schemaJson), zigzag(0), sync,
  ]);
  if (!records.length) return header;
  const body = concatBytes(records.map(encodeRecord));
  const block = concatBytes([zigzag(records.length), zigzag(body.length), body, sync]);
  return concatBytes([header, block]);
}

// ---- Parquet: colunas planas; o array de notas é serializado como JSON. ----
const TT = { I32: 5, I64: 6, BINARY: 8, LIST: 9, STRUCT: 12, STRING: 8 };
const PQ = { INT64: 2, INT32: 1, BYTE_ARRAY: 6 };
function tStruct(fields) {
  const out = [];
  let previous = 0;
  for (const [id, type, body] of fields) {
    const delta = id - previous;
    if (delta > 0 && delta <= 15) out.push(Buffer.from([(delta << 4) | type]));
    else out.push(Buffer.from([type]), zigzag(id));
    out.push(body);
    previous = id;
  }
  out.push(Buffer.from([0]));
  return concatBytes(out);
}
const tInt = (n) => zigzag(n);
const tBinary = (bytes) => concatBytes([uvarint(bytes.length), bytes]);
const tString = (value) => tBinary(Buffer.from(String(value ?? ''), 'utf8'));
function tList(type, items) {
  const header = items.length < 15
    ? Buffer.from([(items.length << 4) | type])
    : concatBytes([Buffer.from([0xf0 | type]), uvarint(items.length)]);
  return concatBytes([header, ...items]);
}
function pqDefLevels(present) {
  const runs = [];
  let i = 0;
  while (i < present.length) {
    let j = i;
    while (j < present.length && present[j] === present[i]) j += 1;
    runs.push(uvarint((j - i) << 1), Buffer.from([present[i]]));
    i = j;
  }
  const body = concatBytes(runs);
  return concatBytes([u32le(body.length), body]);
}

function writeParquetBuffer(records) {
  const numRows = records.length;
  const columns = [
    { name: 'id', type: PQ.INT64, optional: false, get: (r) => BigInt(r.id) },
    { name: 'nome', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.nome },
    { name: 'email', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.email },
    { name: 'role', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.role },
    { name: 'ativo', type: PQ.INT32, optional: false, get: (r) => r.ativo },
    { name: 'data_nascimento', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.data_nascimento },
    { name: 'sexo', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.sexo },
    { name: 'nacionalidade', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.nacionalidade },
    { name: 'nome_mae', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.nome_mae },
    { name: 'nome_pai', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.nome_pai },
    { name: 'responsavel', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.responsavel },
    { name: 'telefone_emergencia', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.telefone_emergencia },
    { name: 'turma_id', type: PQ.INT64, optional: false, get: (r) => BigInt(r.turma_id) },
    { name: 'turma_nome', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.turma_nome },
    { name: 'curso_id', type: PQ.INT64, optional: true, get: (r) => r.curso_id == null ? null : BigInt(r.curso_id) },
    { name: 'curso_nome', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.curso_nome },
    { name: 'serie_classe', type: PQ.INT32, optional: false, get: (r) => r.serie_classe },
    { name: 'ano_letivo', type: PQ.INT32, optional: false, get: (r) => r.ano_letivo },
    { name: 'turno', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.turno },
    { name: 'notas', type: PQ.BYTE_ARRAY, optional: false, get: (r) => JSON.stringify(r.notas || []) },
  ];

  const typeEnum = (type) => type === PQ.INT64 ? 2 : type === PQ.INT32 ? 1 : 6;
  const magic = Buffer.from('PAR1');
  const pages = [];
  const columnChunks = [];
  const schemaElements = [];
  let offset = 4;
  let rowGroupUncompressedSize = 0;

  schemaElements.push(tStruct([
    [4, TT.STRING, tString('schema')],
    [5, TT.I32, tInt(columns.length)],
  ]));

  for (const column of columns) {
    schemaElements.push(tStruct([
      [1, TT.I32, tInt(typeEnum(column.type))],
      [3, TT.I32, tInt(column.optional ? 1 : 0)], // OPTIONAL / REQUIRED
      [4, TT.STRING, tString(column.name)],
    ]));
  }

  if (numRows > 0) {
    for (const column of columns) {
      const values = records.map(column.get);
      const present = values.map((value) => value === null ? 0 : 1);
      const nonNull = values.filter((_, index) => present[index] === 1);
      const dataParts = [];

      if (column.optional) dataParts.push(pqDefLevels(present));
      for (const value of nonNull) {
        if (column.type === PQ.INT32) {
          const buffer = Buffer.allocUnsafe(4);
          buffer.writeInt32LE(Number(value) | 0, 0);
          dataParts.push(buffer);
        } else if (column.type === PQ.INT64) {
          const buffer = Buffer.allocUnsafe(8);
          buffer.writeBigInt64LE(BigInt(value), 0);
          dataParts.push(buffer);
        } else {
          const raw = Buffer.from(String(value), 'utf8');
          dataParts.push(u32le(raw.length), raw);
        }
      }

      const pageData = concatBytes(dataParts);
      const dataPageHeader = tStruct([
        [1, TT.I32, tInt(numRows)], // num_values
        [2, TT.I32, tInt(0)], // PLAIN
        [3, TT.I32, tInt(3)], // RLE definition levels
        [4, TT.I32, tInt(3)], // RLE repetition levels
      ]);
      const pageHeader = tStruct([
        [1, TT.I32, tInt(0)], // DATA_PAGE
        [2, TT.I32, tInt(pageData.length)],
        [3, TT.I32, tInt(pageData.length)],
        [5, TT.STRUCT, dataPageHeader],
      ]);
      const page = concatBytes([pageHeader, pageData]);
      const pageOffset = offset;
      pages.push(page);
      offset += page.length;
      rowGroupUncompressedSize += page.length;

      const columnMetaData = tStruct([
        [1, TT.I32, tInt(typeEnum(column.type))],
        [2, TT.LIST, tList(TT.I32, [tInt(0), tInt(3)])], // PLAIN, RLE
        [3, TT.LIST, tList(TT.STRING, [tString(column.name)])],
        [4, TT.I32, tInt(0)], // UNCOMPRESSED
        [5, TT.I64, tInt(numRows)],
        [6, TT.I64, tInt(page.length)],
        [7, TT.I64, tInt(page.length)],
        [9, TT.I64, tInt(pageOffset)], // data_page_offset
      ]);
      columnChunks.push(tStruct([
        [2, TT.I64, tInt(pageOffset)],
        [3, TT.STRUCT, columnMetaData],
      ]));
    }
  }

  const rowGroups = numRows > 0 ? [tStruct([
    [1, TT.LIST, tList(TT.STRUCT, columnChunks)],
    [2, TT.I64, tInt(rowGroupUncompressedSize)],
    [3, TT.I64, tInt(numRows)],
  ])] : [];

  const fileMetaData = tStruct([
    [1, TT.I32, tInt(1)],
    [2, TT.LIST, tList(TT.STRUCT, schemaElements)],
    [3, TT.I64, tInt(numRows)],
    [4, TT.LIST, tList(TT.STRUCT, rowGroups)],
    [6, TT.STRING, tString('colegio-mara-lu data-lab')],
  ]);

  return concatBytes([
    magic,
    ...pages,
    fileMetaData,
    u32le(fileMetaData.length),
    magic,
  ]);
}

module.exports = { writeAvroBuffer, writeParquetBuffer, AVRO_SCHEMA };
