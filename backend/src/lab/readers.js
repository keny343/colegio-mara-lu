'use strict';

/**
 * Leitores independentes dos escritores: reabrem cada ficheiro e reconstroem os registos a partir
 * do próprio ficheiro (schema Avro do cabeçalho, rodapé Thrift do Parquet, cabeçalho CSV, tuplas
 * INSERT do .sql). A validação compara o conteúdo real, não o tamanho do ficheiro.
 */

const fs = require('fs');
const crypto = require('crypto');
const { FIELDS, TABLE_NOTAS } = require('./schema');

const pad = (n) => String(n).padStart(2, '0');
const msToStr = (ms) => new Date(Number(ms)).toISOString().slice(0, 19).replace('T', ' ');
const centsToStr = (c) => {
  const v = BigInt(c);
  const neg = v < 0n;
  const a = (neg ? -v : v).toString().padStart(3, '0');
  return `${neg ? '-' : ''}${a.slice(0, -2)}.${a.slice(-2)}`;
};

// ---------- forma canónica (igual para todos os formatos) ----------

function stable(v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(stable);
  if (typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  return v;
}

function canonArray(r) {
  return FIELDS.map((f) => {
    const v = r[f.name];
    if (f.kind === 'json') return stable(v);
    if (v === null || v === undefined) return null;
    if (f.kind === 'int64' || f.kind === 'int32') return Number(v);
    if (f.kind === 'decimal') return Number(v).toFixed(2);
    return String(v);
  });
}

const canon = (r) => JSON.stringify(canonArray(r));

function fingerprint(records) {
  const h = crypto.createHash('sha256');
  let count = 0;
  let cents = 0;
  let positivas = 0;
  const porPeriodo = {};
  for (const r of records) {
    count += 1;
    cents += Math.round(Number(r.nota) * 100);
    if (r.situacao === 'positiva') positivas += 1;
    porPeriodo[r.periodo] = (porPeriodo[r.periodo] || 0) + 1;
    h.update(`${canon(r)}\n`);
  }
  return {
    count,
    soma_notas: centsToStr(cents),
    positivas,
    por_periodo: porPeriodo,
    hash_conteudo: h.digest('hex'),
  };
}

/** Primeira diferença entre dois conjuntos de registos (para diagnóstico). */
function primeiraDiferenca(a, b) {
  const A = [...a];
  const B = [...b];
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) {
    if (!A[i] || !B[i]) return { posicao: i + 1, motivo: 'número de registos diferente' };
    const ca = canonArray(A[i]);
    const cb = canonArray(B[i]);
    for (let j = 0; j < ca.length; j++) {
      if (JSON.stringify(ca[j]) !== JSON.stringify(cb[j])) {
        return { posicao: i + 1, id: A[i].id, campo: FIELDS[j].name, esperado: ca[j], obtido: cb[j] };
      }
    }
  }
  return null;
}

// ---------- JSONL ----------

function* readJsonl(p) {
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    if (line.trim()) yield JSON.parse(line);
  }
}

// ---------- CSV ----------

function* csvRows(text) {
  let row = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      yield row;
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); yield row; }
}

function* readCsv(p) {
  const text = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  let header = null;
  for (const cells of csvRows(text)) {
    if (!header) { header = cells; continue; }
    const r = {};
    header.forEach((name, i) => {
      const f = FIELDS.find((x) => x.name === name);
      const raw = cells[i];
      if (!f) return;
      if (f.kind === 'json') r[name] = raw === '' ? null : JSON.parse(raw);
      else if (f.kind === 'int64' || f.kind === 'int32') r[name] = Number(raw);
      else r[name] = raw;
    });
    yield r;
  }
}

// ---------- Avro ----------

class Cursor {
  constructor(buf, pos = 0) { this.buf = buf; this.pos = pos; }
  byte() { return this.buf[this.pos++]; }
  take(n) { const b = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return b; }
  varint() {
    let shift = 0n;
    let v = 0n;
    for (;;) {
      const b = this.buf[this.pos++];
      v |= BigInt(b & 0x7f) << shift;
      if (!(b & 0x80)) break;
      shift += 7n;
    }
    return v;
  }
  long() { const z = this.varint(); return (z >> 1n) ^ -(z & 1n); }
}

function decodeAvro(schema, cur, names) {
  if (Array.isArray(schema)) return decodeAvro(schema[Number(cur.long())], cur, names);
  const t = typeof schema === 'string' ? schema : schema.type;
  if (typeof schema === 'string' && names[schema]) return decodeAvro(names[schema], cur, names);
  switch (t) {
    case 'null': return null;
    case 'boolean': return cur.byte() === 1;
    case 'int': return Number(cur.long());
    case 'long': {
      const v = cur.long();
      return schema.logicalType === 'timestamp-millis' ? msToStr(v) : Number(v);
    }
    case 'string': return cur.take(Number(cur.long())).toString('utf8');
    case 'bytes': {
      const b = cur.take(Number(cur.long()));
      if (schema.logicalType === 'decimal') {
        let v = 0n;
        for (const x of b) v = (v << 8n) | BigInt(x);
        if (b.length && (b[0] & 0x80)) v -= 1n << BigInt(8 * b.length);
        return centsToStr(v); // scale 2
      }
      return b;
    }
    case 'enum': return schema.symbols[Number(cur.long())];
    case 'record': {
      if (schema.name) names[schema.name] = schema;
      const o = {};
      for (const f of schema.fields) o[f.name] = decodeAvro(f.type, cur, names);
      return o;
    }
    default: throw new Error(`Tipo Avro não suportado: ${t}`);
  }
}

function* readAvro(p) {
  const cur = new Cursor(fs.readFileSync(p));
  if (cur.take(4).toString('binary') !== 'Obj\x01') throw new Error('Avro: magic inválido');
  const meta = {};
  for (;;) {
    let n = Number(cur.long());
    if (n === 0) break;
    if (n < 0) { n = -n; cur.long(); }
    for (let i = 0; i < n; i++) {
      const k = cur.take(Number(cur.long())).toString('utf8');
      meta[k] = cur.take(Number(cur.long()));
    }
  }
  const sync = cur.take(16);
  const schema = JSON.parse(meta['avro.schema'].toString('utf8'));
  if (meta['avro.codec'] && meta['avro.codec'].toString() !== 'null') throw new Error('Avro: codec não suportado');
  const names = {};
  while (cur.pos < cur.buf.length) {
    const count = Number(cur.long());
    const size = Number(cur.long());
    const block = new Cursor(cur.take(size));
    for (let i = 0; i < count; i++) yield decodeAvro(schema, block, names);
    if (!cur.take(16).equals(sync)) throw new Error('Avro: marcador de sincronização inválido');
  }
}

// ---------- Parquet (decoder Thrift compacto) ----------

function readThrift(cur, type) {
  switch (type) {
    case 1: return true;
    case 2: return false;
    case 3: return cur.byte();
    case 4: case 5: case 6: { const z = cur.varint(); return Number((z >> 1n) ^ -(z & 1n)); }
    case 7: return cur.take(8).readDoubleLE(0);
    case 8: return cur.take(Number(cur.varint()));
    case 9: {
      const h = cur.byte();
      let size = h >> 4;
      const et = h & 0x0f;
      if (size === 15) size = Number(cur.varint());
      const out = [];
      for (let i = 0; i < size; i++) out.push(readThrift(cur, et));
      return out;
    }
    case 12: return readThriftStruct(cur);
    default: throw new Error(`Thrift: tipo ${type} não suportado`);
  }
}

function readThriftStruct(cur) {
  const o = {};
  let last = 0;
  for (;;) {
    const h = cur.byte();
    if (h === 0) break;
    const type = h & 0x0f;
    const delta = h >> 4;
    let id;
    if (delta) id = last + delta;
    else { const z = cur.varint(); id = Number((z >> 1n) ^ -(z & 1n)); }
    o[id] = readThrift(cur, type);
    last = id;
  }
  return o;
}

function* readParquet(p, onlyCols = null) {
  const buf = fs.readFileSync(p);
  if (buf.subarray(0, 4).toString() !== 'PAR1' || buf.subarray(-4).toString() !== 'PAR1') throw new Error('Parquet: magic inválido');
  const footerLen = buf.readUInt32LE(buf.length - 8);
  const meta = readThriftStruct(new Cursor(buf.subarray(buf.length - 8 - footerLen, buf.length - 8)));
  const leaves = meta[2].slice(1);
  for (const rg of meta[4] || []) {
    const cols = {};
    rg[1].forEach((chunk, ci) => {
      const cm = chunk[3];
      const leaf = leaves[ci];
      const name = leaf[4].toString('utf8');
      if (onlyCols && !onlyCols.includes(name)) return;
      const cur = new Cursor(buf, cm[9]);
      const ph = readThriftStruct(cur);
      const numValues = ph[5][1];
      const page = new Cursor(cur.take(ph[3]));
      let presentes = null;
      if (leaf[3] === 1) { // OPTIONAL
        const len = page.take(4).readUInt32LE(0);
        const lv = new Cursor(page.take(len));
        presentes = [];
        while (presentes.length < numValues) {
          const hdr = Number(lv.varint());
          if (hdr & 1) throw new Error('Parquet: níveis bit-packed não suportados');
          const run = hdr >> 1;
          const val = lv.byte();
          for (let i = 0; i < run; i++) presentes.push(val);
        }
      }
      const vals = [];
      for (let i = 0; i < numValues; i++) {
        if (presentes && !presentes[i]) { vals.push(null); continue; }
        let v;
        if (leaf[1] === 1) v = page.take(4).readInt32LE(0);
        else if (leaf[1] === 2) v = page.take(8).readBigInt64LE(0);
        else v = page.take(page.take(4).readUInt32LE(0)).toString('utf8');
        const conv = leaf[6];
        if (conv === 5) v = centsToStr(v); // DECIMAL scale 2
        else if (conv === 9) v = msToStr(v);
        else if (conv === 19) v = JSON.parse(v);
        else if (typeof v === 'bigint') v = Number(v);
        vals.push(v);
      }
      cols[name] = vals;
    });
    const n = rg[3];
    for (let i = 0; i < n; i++) {
      const r = {};
      for (const k of Object.keys(cols)) r[k] = cols[k][i];
      yield r;
    }
  }
}

// ---------- SQL (.sql gerado) ----------

function parseTuple(line) {
  const s = line.trim().replace(/[,;]$/, '');
  const out = [];
  let i = 1; // depois de '('
  while (i < s.length) {
    if (s[i] === "'") {
      let v = '';
      i++;
      while (i < s.length) {
        if (s[i] === '\\') { v += s[i + 1]; i += 2; }
        else if (s[i] === "'" && s[i + 1] === "'") { v += "'"; i += 2; }
        else if (s[i] === "'") { i++; break; }
        else { v += s[i]; i++; }
      }
      out.push({ str: v });
    } else {
      let j = i;
      while (j < s.length && s[j] !== ',' && s[j] !== ')') j++;
      const tok = s.slice(i, j);
      out.push(tok === 'NULL' ? null : { num: tok });
      i = j;
    }
    if (s[i] === ',') i++;
    else break;
  }
  return out;
}

function* readSql(p) {
  let tabela = null;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^INSERT INTO (\w+)/);
    if (m) { tabela = m[1]; continue; }
    if (tabela !== TABLE_NOTAS || line[0] !== '(') continue;
    const cells = parseTuple(line);
    const r = {};
    FIELDS.forEach((f, i) => {
      const c = cells[i];
      if (c === null) { r[f.name] = null; return; }
      if (f.kind === 'json') r[f.name] = JSON.parse(c.str);
      else if (f.kind === 'int64' || f.kind === 'int32') r[f.name] = Number(c.num);
      else if (f.kind === 'decimal') r[f.name] = c.num;
      else r[f.name] = c.str;
    });
    yield r;
  }
}

const READERS = { jsonl: readJsonl, csv: readCsv, avro: readAvro, parquet: readParquet, sql: readSql };

module.exports = {
  READERS, readJsonl, readCsv, readAvro, readParquet, readSql,
  canon, canonArray, fingerprint, primeiraDiferenca, stable, centsToStr,
};