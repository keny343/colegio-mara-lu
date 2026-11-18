'use strict';

/**
 * Leitores em streaming para os cinco destinos. Usados pela validação e pelo benchmark,
 * por isso medem descodificação real (não apenas leitura de bytes).
 * Cada leitor é um async generator: nunca carrega o ficheiro inteiro em memória.
 */

const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

/* ---------------------------- JSONL / CSV ---------------------------- */

async function* readLines(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 1 << 20 });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) yield line;
  } finally {
    rl.close();
    stream.destroy();
  }
}

async function* readJsonl(filePath) {
  for await (const line of readLines(filePath)) {
    if (line) yield JSON.parse(line);
  }
}

function csvRow(line) {
  const fields = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { value += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { fields.push(value); value = ''; }
    else value += char;
  }
  fields.push(value);
  return fields;
}

async function* readCsv(filePath) {
  let headers = null;
  for await (let line of readLines(filePath)) {
    if (!line) continue;
    if (!headers) { headers = csvRow(line.replace(/^\uFEFF/, '')); continue; }
    const values = csvRow(line);
    const row = Object.fromEntries(headers.map((key, index) => [key, values[index]]));
    try { row.notas = JSON.parse(row.notas || '[]'); } catch { row.notas = []; }
    row.id = Number(row.id);
    row.turma_id = Number(row.turma_id);
    yield row;
  }
}

/* ------------------------------- Avro -------------------------------- */

class FdReader {
  constructor(fd, size) { this.fd = fd; this.size = size; this.pos = 0; }
  async read(n) {
    const buf = Buffer.allocUnsafe(n);
    let got = 0;
    while (got < n) {
      const { bytesRead } = await this.fd.read(buf, got, n - got, this.pos + got);
      if (!bytesRead) throw new Error('Ficheiro truncado.');
      got += bytesRead;
    }
    this.pos += n;
    return buf;
  }
  async varint() {
    let result = 0n; let shift = 0n;
    for (;;) {
      const b = (await this.read(1))[0];
      result |= BigInt(b & 0x7f) << shift;
      if (!(b & 0x80)) break;
      shift += 7n;
    }
    return (result >> 1n) ^ -(result & 1n);
  }
  get eof() { return this.pos >= this.size; }
}

class BufCursor {
  constructor(buf) { this.buf = buf; this.pos = 0; }
  varint() {
    let result = 0n; let shift = 0n;
    for (;;) {
      const b = this.buf[this.pos++];
      result |= BigInt(b & 0x7f) << shift;
      if (!(b & 0x80)) break;
      shift += 7n;
    }
    return (result >> 1n) ^ -(result & 1n);
  }
  long() { return Number(this.varint()); }
  string() {
    const n = Number(this.varint());
    const s = this.buf.toString('utf8', this.pos, this.pos + n);
    this.pos += n;
    return s;
  }
}

function decodeAvroRecord(c) {
  const row = {
    id: c.long(), nome: c.string(), email: c.string(), role: c.string(), ativo: c.long(),
    data_nascimento: c.string(), sexo: c.string(), nacionalidade: c.string(),
    nome_mae: c.string(), nome_pai: c.string(), responsavel: c.string(),
    telefone_emergencia: c.string(), turma_id: c.long(), turma_nome: c.string(),
  };
  row.curso_id = c.long() === 0 ? null : c.long();
  row.curso_nome = c.string();
  row.serie_classe = c.long();
  row.ano_letivo = c.long();
  row.turno = c.string();
  try { row.notas = JSON.parse(c.string() || '[]'); } catch { row.notas = []; }
  return row;
}

async function* readAvro(filePath) {
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const { size } = await fd.stat();
    const r = new FdReader(fd, size);
    const magic = await r.read(4);
    if (magic.toString('binary') !== 'Obj\x01') throw new Error('Avro inválido: magic number.');
    let codec = 'null';
    for (;;) { // mapa de metadados (blocos de pares chave/valor)
      let count = Number(await r.varint());
      if (count === 0) break;
      if (count < 0) { count = -count; await r.varint(); }
      for (let i = 0; i < count; i += 1) {
        const key = (await r.read(Number(await r.varint()))).toString('utf8');
        const value = await r.read(Number(await r.varint()));
        if (key === 'avro.codec') codec = value.toString('utf8');
      }
    }
    const sync = await r.read(16);
    while (!r.eof) {
      const count = Number(await r.varint());
      const length = Number(await r.varint());
      let body = await r.read(length);
      const marker = await r.read(16);
      if (!marker.equals(sync)) throw new Error('Avro corrompido: marcador de sincronização inválido.');
      if (codec === 'deflate') body = zlib.inflateRawSync(body);
      else if (codec !== 'null') throw new Error(`Codec Avro não suportado: ${codec}`);
      const c = new BufCursor(body);
      for (let i = 0; i < count; i += 1) yield decodeAvroRecord(c);
    }
  } finally {
    await fd.close();
  }
}

/* ------------------------------ Parquet ------------------------------ */

function thriftReadVarint(buf, state) {
  let result = 0n; let shift = 0n;
  for (;;) {
    const b = buf[state.pos++];
    result |= BigInt(b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7n;
  }
  return result;
}
const unzig = (n) => (n >> 1n) ^ -(n & 1n);

function thriftValue(buf, state, type) {
  switch (type) {
    case 1: return true;
    case 2: return false;
    case 3: return buf[state.pos++];
    case 4: case 5: case 6: return Number(unzig(thriftReadVarint(buf, state)));
    case 7: { const v = buf.readDoubleLE(state.pos); state.pos += 8; return v; }
    case 8: {
      const n = Number(thriftReadVarint(buf, state));
      const v = buf.subarray(state.pos, state.pos + n);
      state.pos += n;
      return v;
    }
    case 9: case 10: {
      const head = buf[state.pos++];
      let size = head >> 4;
      const elem = head & 0x0f;
      if (size === 15) size = Number(thriftReadVarint(buf, state));
      const list = [];
      for (let i = 0; i < size; i += 1) list.push(thriftValue(buf, state, elem));
      return list;
    }
    case 12: return thriftStruct(buf, state);
    default: throw new Error(`Tipo thrift não suportado: ${type}`);
  }
}

function thriftStruct(buf, state) {
  const out = {};
  let last = 0;
  for (;;) {
    const head = buf[state.pos++];
    if (head === 0) break;
    const type = head & 0x0f;
    const delta = head >> 4;
    const id = delta ? last + delta : Number(unzig(thriftReadVarint(buf, state)));
    out[id] = thriftValue(buf, state, type);
    last = id;
  }
  return out;
}

function decodeColumnPage(raw, type, optional, numValues) {
  let pos = 0;
  let present = null;
  if (optional) {
    const levelsLength = raw.readUInt32LE(0);
    pos = 4;
    const end = 4 + levelsLength;
    present = [];
    while (pos < end) {
      const state = { pos };
      const run = Number(thriftReadVarint(raw, state)) >> 1;
      pos = state.pos;
      const bit = raw[pos++];
      for (let i = 0; i < run; i += 1) present.push(bit);
    }
  }
  const values = [];
  for (let i = 0; i < numValues; i += 1) {
    if (present && !present[i]) { values.push(null); continue; }
    if (type === 1) { values.push(raw.readInt32LE(pos)); pos += 4; }
    else if (type === 2) { values.push(Number(raw.readBigInt64LE(pos))); pos += 8; }
    else {
      const n = raw.readUInt32LE(pos); pos += 4;
      values.push(raw.toString('utf8', pos, pos + n));
      pos += n;
    }
  }
  return values;
}

/** Lê só as colunas pedidas (projecção), row group a row group. */
async function* readParquetColumns(filePath, columns) {
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const { size } = await fd.stat();
    const tail = Buffer.alloc(8);
    await fd.read(tail, 0, 8, size - 8);
    if (tail.toString('binary', 4, 8) !== 'PAR1') throw new Error('Parquet inválido: magic number.');
    const footerLength = tail.readUInt32LE(0);
    const footerBuf = Buffer.alloc(footerLength);
    await fd.read(footerBuf, 0, footerLength, size - 8 - footerLength);
    const meta = thriftStruct(footerBuf, { pos: 0 });
    const schema = meta[2].slice(1).map((el) => ({
      type: el[1], optional: el[3] === 1, name: el[4].toString('utf8'),
    }));
    const wanted = columns || schema.map((c) => c.name);
    for (const group of meta[4] || []) {
      const out = {};
      let rows = 0;
      for (const chunk of group[1]) {
        const cm = chunk[3];
        const name = cm[3][0].toString('utf8');
        if (!wanted.includes(name)) continue;
        const col = schema.find((c) => c.name === name);
        const start = cm[9];
        const total = cm[7];
        const buf = Buffer.alloc(total);
        await fd.read(buf, 0, total, start);
        const state = { pos: 0 };
        const header = thriftStruct(buf, state);
        let page = buf.subarray(state.pos, state.pos + header[3]);
        if (cm[4] === 2) page = zlib.gunzipSync(page);
        else if (cm[4] !== 0) throw new Error(`Codec Parquet não suportado: ${cm[4]}`);
        out[name] = decodeColumnPage(page, col.type, col.optional, cm[5]);
        rows = cm[5];
      }
      yield { rows, columns: out };
    }
  } finally {
    await fd.close();
  }
}

async function* readParquet(filePath) {
  for await (const { rows, columns } of readParquetColumns(filePath, null)) {
    for (let i = 0; i < rows; i += 1) {
      const row = {};
      for (const [name, values] of Object.entries(columns)) row[name] = values[i];
      try { row.notas = JSON.parse(row.notas || '[]'); } catch { row.notas = []; }
      yield row;
    }
  }
}

/** Número de linhas do Parquet a partir do rodapé (sem ler dados). */
async function parquetNumRows(filePath) {
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const { size } = await fd.stat();
    const tail = Buffer.alloc(8);
    await fd.read(tail, 0, 8, size - 8);
    const footerLength = tail.readUInt32LE(0);
    const footerBuf = Buffer.alloc(footerLength);
    await fd.read(footerBuf, 0, footerLength, size - 8 - footerLength);
    return thriftStruct(footerBuf, { pos: 0 })[3];
  } finally {
    await fd.close();
  }
}

module.exports = {
  readLines, readJsonl, readCsv, readAvro, readParquet, readParquetColumns, parquetNumRows, csvRow,
};