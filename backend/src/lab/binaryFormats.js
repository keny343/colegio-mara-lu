'use strict';

/** Escritores Avro OCF e Parquet v1 (PLAIN) para Transacao — sem deps nativas. */

const AVRO_SCHEMA = {
  type: 'record',
  name: 'Transacao',
  namespace: 'colegio.mara_lu.lab',
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
          { name: 'cidade', type: 'string' },
          { name: 'latitude', type: 'double' },
          { name: 'longitude', type: 'double' },
        ],
      },
    },
    {
      name: 'metadados',
      type: [
        'null',
        {
          type: 'record',
          name: 'Metadados',
          fields: [
            { name: 'canal', type: 'string' },
            { name: 'promocao', type: 'boolean' },
            { name: 'vendedor_id', type: ['null', 'long'], default: null },
          ],
        },
      ],
      default: null,
    },
  ],
};

function concatBytes(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = Buffer.allocUnsafe(total);
  let off = 0;
  for (const c of chunks) {
    Buffer.from(c).copy(out, off);
    off += c.length;
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
  let v = BigInt(n);
  const bytes = [];
  while (v >= 0x80n) {
    bytes.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  bytes.push(Number(v));
  return Buffer.from(bytes);
}

function zigzag(n) {
  const v = BigInt(n);
  return uvarint((v << 1n) ^ (v >> 63n));
}

function avroString(s) {
  const raw = Buffer.from(String(s ?? ''), 'utf8');
  return concatBytes([zigzag(raw.length), raw]);
}

function avroLong(n) {
  return zigzag(n);
}

function avroBool(b) {
  return Buffer.from([b ? 1 : 0]);
}

function encodeRecord(r) {
  const parts = [
    avroLong(r.id),
    avroLong(r.cliente_id),
    avroLong(r.produto_id),
    avroString(r.data_transacao),
    avroString(r.categoria),
    zigzag(r.quantidade),
    avroString(r.preco_unitario),
    avroString(r.valor_total),
    avroString(r.estado),
    avroString(r.descricao),
    avroString(r.localizacao.cidade),
    f64le(r.localizacao.latitude),
    f64le(r.localizacao.longitude),
  ];
  if (r.metadados == null) {
    parts.push(zigzag(0));
  } else {
    parts.push(zigzag(1));
    parts.push(avroString(r.metadados.canal));
    parts.push(avroBool(!!r.metadados.promocao));
    if (r.metadados.vendedor_id == null) parts.push(zigzag(0));
    else parts.push(zigzag(1), avroLong(r.metadados.vendedor_id));
  }
  return concatBytes(parts);
}

function writeAvroBuffer(records) {
  const sync = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) sync[i] = (Math.random() * 256) | 0;
  const schemaJson = JSON.stringify(AVRO_SCHEMA);
  const header = concatBytes([
    Buffer.from('Obj\x01', 'binary'),
    zigzag(2),
    avroString('avro.codec'),
    Buffer.from('\x08null', 'binary'),
    avroString('avro.schema'),
    avroString(schemaJson),
    zigzag(0),
    sync,
  ]);
  if (!records.length) return header;
  const body = concatBytes(records.map(encodeRecord));
  const block = concatBytes([zigzag(records.length), zigzag(body.length), body, sync]);
  return concatBytes([header, block]);
}

// ---- Parquet (colunas planas; nested como JSON string) ----

const TT = { I32: 5, I64: 6, BINARY: 8, LIST: 9, STRUCT: 12 };
const PQ = { INT64: 2, INT32: 1, DOUBLE: 5, BYTE_ARRAY: 6 };

function tStruct(campos) {
  const out = [];
  let ultimo = 0;
  for (const [id, tipo, corpo] of campos) {
    const delta = id - ultimo;
    if (delta > 0 && delta <= 15) out.push(Buffer.from([(delta << 4) | tipo]));
    else out.push(Buffer.from([tipo]), zigzag(id));
    out.push(corpo);
    ultimo = id;
  }
  out.push(Buffer.from([0]));
  return concatBytes(out);
}
const tInt = (n) => zigzag(n);
const tBinary = (bytes) => concatBytes([uvarint(bytes.length), bytes]);
const tString = (s) => tBinary(Buffer.from(String(s ?? ''), 'utf8'));
function tList(tipo, itens) {
  const n = itens.length;
  const cab = n < 15
    ? Buffer.from([(n << 4) | tipo])
    : concatBytes([Buffer.from([0xf0 | tipo]), uvarint(n)]);
  return concatBytes([cab, ...itens]);
}

function pqDefLevels(presentes) {
  const runs = [];
  let i = 0;
  while (i < presentes.length) {
    let j = i;
    while (j < presentes.length && presentes[j] === presentes[i]) j++;
    runs.push(uvarint((j - i) << 1), Buffer.from([presentes[i]]));
    i = j;
  }
  const corpo = concatBytes(runs);
  return concatBytes([u32le(corpo.length), corpo]);
}

function writeParquetBuffer(records) {
  const numRows = records.length;
  const colunas = [
    { nome: 'id', tipo: PQ.INT64, opcional: false, get: (r) => BigInt(r.id) },
    { nome: 'cliente_id', tipo: PQ.INT64, opcional: false, get: (r) => BigInt(r.cliente_id) },
    { nome: 'produto_id', tipo: PQ.INT64, opcional: false, get: (r) => BigInt(r.produto_id) },
    { nome: 'data_transacao', tipo: PQ.BYTE_ARRAY, opcional: false, get: (r) => String(r.data_transacao) },
    { nome: 'categoria', tipo: PQ.BYTE_ARRAY, opcional: false, get: (r) => String(r.categoria) },
    { nome: 'quantidade', tipo: PQ.INT32, opcional: false, get: (r) => Number(r.quantidade) },
    { nome: 'preco_unitario', tipo: PQ.BYTE_ARRAY, opcional: false, get: (r) => String(r.preco_unitario) },
    { nome: 'valor_total', tipo: PQ.BYTE_ARRAY, opcional: false, get: (r) => String(r.valor_total) },
    { nome: 'estado', tipo: PQ.BYTE_ARRAY, opcional: false, get: (r) => String(r.estado) },
    { nome: 'descricao', tipo: PQ.BYTE_ARRAY, opcional: false, get: (r) => String(r.descricao) },
    {
      nome: 'localizacao',
      tipo: PQ.BYTE_ARRAY,
      opcional: false,
      get: (r) => JSON.stringify(r.localizacao),
    },
    {
      nome: 'metadados',
      tipo: PQ.BYTE_ARRAY,
      opcional: true,
      get: (r) => (r.metadados == null ? null : JSON.stringify(r.metadados)),
    },
  ];

  const MAGIC = Buffer.from('PAR1');
  const paginas = [];
  const chunks = [];
  let offset = 4;

  if (numRows > 0) {
    for (const col of colunas) {
      const valores = records.map(col.get);
      const presentes = valores.map((v) => (v === null ? 0 : 1));
      const naoNulos = valores.filter((_, i) => presentes[i] === 1);
      const partes = [];
      if (col.opcional) partes.push(pqDefLevels(presentes));
      for (const v of naoNulos) {
        if (col.tipo === PQ.INT32) {
          const b = Buffer.allocUnsafe(4);
          b.writeInt32LE(Number(v) | 0, 0);
          partes.push(b);
        } else if (col.tipo === PQ.INT64) {
          const b = Buffer.allocUnsafe(8);
          b.writeBigInt64LE(BigInt(v), 0);
          partes.push(b);
        } else {
          const raw = Buffer.from(String(v), 'utf8');
          partes.push(u32le(raw.length), raw);
        }
      }
      const dados = concatBytes(partes);
      const dph = tStruct([
        [1, TT.I32, tInt(numRows)],
        [2, TT.I32, tInt(0)],
        [3, TT.I32, tInt(3)],
        [4, TT.I32, tInt(3)],
      ]);
      const page = concatBytes([
        u32le(0), // DATA_PAGE
        u32le(dados.length),
        u32le(dph.length),
        dph,
        dados,
      ]);
      const pageOffset = offset;
      paginas.push(page);
      offset += page.length;

      const meta = tStruct([
        [1, TT.I32, tInt(col.tipo === PQ.INT64 ? 2 : col.tipo === PQ.INT32 ? 1 : 6)],
        [2, TT.LIST, tList(TT.I32, [tInt(0)])],
        [3, TT.LIST, tList(TT.I32, [tInt(col.opcional ? 3 : 0)])],
        [4, TT.I64, tInt(pageOffset)],
        [5, TT.I64, tInt(page.length)],
        [6, TT.I64, tInt(numRows)],
        [7, TT.I64, tInt(naoNulos.length)],
      ]);
      chunks.push(tStruct([
        [1, TT.STRUCT, meta],
        [2, TT.I64, tInt(pageOffset)],
      ]));
    }
  }

  const schemaElements = colunas.map((col, i) => {
    const campos = [
      [1, TT.I32, tInt(col.tipo === PQ.INT64 ? 2 : col.tipo === PQ.INT32 ? 1 : 6)],
      [2, TT.I32, tInt(col.opcional ? 1 : 0)], // OPTIONAL / REQUIRED
      [3, TT.STRING, tString(col.nome)],
      [4, TT.I32, tInt(1)], // num_children = 0 for leaves → use repetition
    ];
    // Parquet SchemaElement: type, repetition_type, name, num_children
    return tStruct([
      [1, TT.I32, tInt(col.tipo === PQ.INT64 ? 2 : col.tipo === PQ.INT32 ? 1 : 6)],
      [3, TT.I32, tInt(col.opcional ? 1 : 0)],
      [4, TT.STRING, tString(col.nome)],
      [5, TT.I32, tInt(0)],
    ]);
  });

  const root = tStruct([
    [4, TT.STRING, tString('schema')],
    [5, TT.I32, tInt(colunas.length)],
  ]);

  const rowGroup = tStruct([
    [1, TT.LIST, tList(TT.STRUCT, chunks)],
    [2, TT.I64, tInt(offset - 4)],
    [3, TT.I64, tInt(numRows)],
  ]);

  const footer = tStruct([
    [1, TT.I32, tInt(1)], // version
    [2, TT.LIST, tList(TT.STRUCT, [root, ...schemaElements])],
    [3, TT.I64, tInt(numRows)],
    [4, TT.LIST, tList(TT.STRUCT, numRows ? [rowGroup] : [])],
  ]);

  const footerLen = footer.length;
  return concatBytes([
    MAGIC,
    ...paginas,
    footer,
    u32le(footerLen),
    MAGIC,
  ]);
}

module.exports = { writeAvroBuffer, writeParquetBuffer, AVRO_SCHEMA };
