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

const zlib = require('zlib');
const { promisify } = require('util');
const deflateRaw = promisify(zlib.deflateRaw);
const gzip = promisify(zlib.gzip);

/** Marcador de sincronização determinístico (mesmo schema → mesmo marcador). */
function avroSyncMarker() {
  return crypto.createHash('sha256').update(JSON.stringify(AVRO_SCHEMA)).digest().subarray(0, 16);
}

/** Cabeçalho OCF. codec: 'null' | 'deflate'. */
function avroHeader(codec = 'deflate') {
  const schemaJson = JSON.stringify(AVRO_SCHEMA);
  return concatBytes([
    Buffer.from('Obj\x01', 'binary'), zigzag(2),
    avroString('avro.codec'), avroString(codec),
    avroString('avro.schema'), avroString(schemaJson), zigzag(0), avroSyncMarker(),
  ]);
}

/** Um bloco OCF por lote: nunca é preciso ter todos os registos em memória. */
async function avroBlock(records, codec = 'deflate') {
  if (!records.length) return Buffer.alloc(0);
  let body = concatBytes(records.map(encodeRecord));
  if (codec === 'deflate') body = await deflateRaw(body, { level: 1 });
  return concatBytes([zigzag(records.length), zigzag(body.length), body, avroSyncMarker()]);
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

const PARQUET_COLUMNS = [
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
  { name: 'curso_id', type: PQ.INT64, optional: true, get: (r) => (r.curso_id == null ? null : BigInt(r.curso_id)) },
  { name: 'curso_nome', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.curso_nome },
  { name: 'serie_classe', type: PQ.INT32, optional: false, get: (r) => r.serie_classe },
  { name: 'ano_letivo', type: PQ.INT32, optional: false, get: (r) => r.ano_letivo },
  { name: 'turno', type: PQ.BYTE_ARRAY, optional: false, get: (r) => r.turno },
  { name: 'notas', type: PQ.BYTE_ARRAY, optional: false, get: (r) => JSON.stringify(r.notas || []) },
];
const typeEnum = (type) => (type === PQ.INT64 ? 2 : type === PQ.INT32 ? 1 : 6);

/**
 * Escritor Parquet incremental: um row group por lote.
 * Uso: header() → rowGroup(lote)* → footer(). Cada chamada devolve Buffers prontos a escrever,
 * por isso a memória fica limitada ao tamanho de um lote.
 */
class ParquetStreamWriter {
  constructor({ compression = 'gzip' } = {}) {
    this.compression = compression === 'none' ? 'none' : 'gzip';
    this.codec = this.compression === 'gzip' ? 2 : 0; // 0 UNCOMPRESSED, 2 GZIP
    this.offset = 0;
    this.numRows = 0;
    this.rowGroups = [];
  }

  header() {
    const magic = Buffer.from('PAR1');
    this.offset += magic.length;
    return magic;
  }

  async rowGroup(records) {
    if (!records.length) return Buffer.alloc(0);
    const numRows = records.length;
    const parts = [];
    const chunks = [];
    let groupSize = 0;
    for (const column of PARQUET_COLUMNS) {
      const values = records.map(column.get);
      const present = values.map((value) => (value === null ? 0 : 1));
      const dataParts = [];
      if (column.optional) dataParts.push(pqDefLevels(present));
      for (let i = 0; i < values.length; i += 1) {
        const value = values[i];
        if (value === null) continue;
        if (column.type === PQ.INT32) {
          const b = Buffer.allocUnsafe(4);
          b.writeInt32LE(Number(value) | 0, 0);
          dataParts.push(b);
        } else if (column.type === PQ.INT64) {
          const b = Buffer.allocUnsafe(8);
          b.writeBigInt64LE(BigInt(value), 0);
          dataParts.push(b);
        } else {
          const raw = Buffer.from(String(value), 'utf8');
          dataParts.push(u32le(raw.length), raw);
        }
      }
      const raw = concatBytes(dataParts);
      const pageData = this.codec === 2 ? await gzip(raw, { level: 1 }) : raw;
      const dataPageHeader = tStruct([
        [1, TT.I32, tInt(numRows)],
        [2, TT.I32, tInt(0)], // PLAIN
        [3, TT.I32, tInt(3)], // RLE (níveis de definição)
        [4, TT.I32, tInt(3)], // RLE (níveis de repetição)
      ]);
      const pageHeader = tStruct([
        [1, TT.I32, tInt(0)], // DATA_PAGE
        [2, TT.I32, tInt(raw.length)],
        [3, TT.I32, tInt(pageData.length)],
        [5, TT.STRUCT, dataPageHeader],
      ]);
      const pageOffset = this.offset;
      parts.push(pageHeader, pageData);
      const written = pageHeader.length + pageData.length;
      this.offset += written;
      groupSize += pageHeader.length + raw.length;
      const columnMetaData = tStruct([
        [1, TT.I32, tInt(typeEnum(column.type))],
        [2, TT.LIST, tList(TT.I32, [tInt(0), tInt(3)])],
        [3, TT.LIST, tList(TT.STRING, [tString(column.name)])],
        [4, TT.I32, tInt(this.codec)],
        [5, TT.I64, tInt(numRows)],
        [6, TT.I64, tInt(pageHeader.length + raw.length)],
        [7, TT.I64, tInt(written)],
        [9, TT.I64, tInt(pageOffset)],
      ]);
      chunks.push(tStruct([
        [2, TT.I64, tInt(pageOffset)],
        [3, TT.STRUCT, columnMetaData],
      ]));
    }
    this.rowGroups.push(tStruct([
      [1, TT.LIST, tList(TT.STRUCT, chunks)],
      [2, TT.I64, tInt(groupSize)],
      [3, TT.I64, tInt(numRows)],
    ]));
    this.numRows += numRows;
    return concatBytes(parts);
  }

  footer() {
    const schemaElements = [tStruct([
      [4, TT.STRING, tString('schema')],
      [5, TT.I32, tInt(PARQUET_COLUMNS.length)],
    ])];
    for (const column of PARQUET_COLUMNS) {
      const fields = [
        [1, TT.I32, tInt(typeEnum(column.type))],
        [3, TT.I32, tInt(column.optional ? 1 : 0)], // 0 REQUIRED, 1 OPTIONAL
        [4, TT.STRING, tString(column.name)],
      ];
      if (column.type === PQ.BYTE_ARRAY) fields.push([6, TT.I32, tInt(0)]); // converted_type UTF8
      schemaElements.push(tStruct(fields));
    }
    const fileMetaData = tStruct([
      [1, TT.I32, tInt(1)],
      [2, TT.LIST, tList(TT.STRUCT, schemaElements)],
      [3, TT.I64, tInt(this.numRows)],
      [4, TT.LIST, tList(TT.STRUCT, this.rowGroups)],
      [6, TT.STRING, tString('colegio-mara-lu data-lab')],
    ]);
    return concatBytes([fileMetaData, u32le(fileMetaData.length), Buffer.from('PAR1')]);
  }
}

module.exports = { AVRO_SCHEMA, avroHeader, avroBlock, ParquetStreamWriter, PARQUET_COLUMNS };