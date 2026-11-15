'use strict';

/**
 * Escritores Avro (OCF) e Parquet (PLAIN, sem compressão) em streaming — um bloco / row group por
 * lote, sem dependências nativas. Os tipos vêm do schema do laboratório:
 * int64/int32, enum, timestamp, decimal(5,2), texto e JSON (localizacao obrigatório, metadados opcional).
 *
 * Nota Avro: os símbolos de um enum têm de casar com [A-Za-z_][A-Za-z0-9_]*. Os períodos '1PP'..'3PT'
 * começam por dígito, por isso `periodo` é gravado como string (ENUM só no MySQL). `situacao` é enum válido.
 */

const fs = require('fs');
const crypto = require('crypto');
const { FIELDS, SITUACOES } = require('./schema');

const cat = (chunks) => Buffer.concat(chunks.map((c) => Buffer.from(c)));

/** fs.writeSync pode escrever menos bytes do que pedido: repete até gravar tudo. */
function writeAll(fd, buf) {
  let off = 0;
  while (off < buf.length) off += fs.writeSync(fd, buf, off, buf.length - off);
}

function u32le(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32LE(n >>> 0, 0);
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
  return uvarint(BigInt.asUintN(64, (v << 1n) ^ (v >> 63n)));
}

const tsMillis = (s) => Date.parse(`${s.replace(' ', 'T')}Z`);
const unscaled = (dec) => Number(String(dec).replace('.', '')); // '12.50' -> 1250 (scale 2)

// ============================ AVRO ============================

const AVRO_SCHEMA = {
  type: 'record',
  name: 'NotaLancada',
  namespace: 'ao.colegio.mara_lu.lab',
  fields: [
    { name: 'id', type: 'long' },
    { name: 'aluno_id', type: 'long' },
    { name: 'matricula_id', type: 'long' },
    { name: 'turma_id', type: 'int' },
    { name: 'disciplina_id', type: 'int' },
    { name: 'professor_id', type: 'int' },
    { name: 'ano_letivo', type: 'int' },
    { name: 'serie_classe', type: 'int' },
    { name: 'periodo', type: 'string' }, // 1PP..3PT: não são símbolos Avro válidos (começam por dígito)
    { name: 'data_lancamento', type: { type: 'long', logicalType: 'timestamp-millis' } },
    { name: 'disciplina', type: 'string' },
    { name: 'nota', type: { type: 'bytes', logicalType: 'decimal', precision: 5, scale: 2 } },
    { name: 'escala_max', type: 'int' },
    { name: 'nota_minima', type: 'int' },
    { name: 'situacao', type: { type: 'enum', name: 'SituacaoNota', symbols: SITUACOES } },
    { name: 'observacao', type: 'string' },
    {
      name: 'localizacao',
      type: {
        type: 'record',
        name: 'Localizacao',
        fields: [
          { name: 'provincia', type: 'string' },
          { name: 'municipio', type: 'string' },
          { name: 'bairro', type: 'string' },
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
            { name: 'lancado_por', type: 'string' },
            { name: 'turno', type: 'string' },
            { name: 'repetente', type: 'boolean' },
            { name: 'apoio_pedagogico', type: 'boolean' },
          ],
        },
      ],
      default: null,
    },
  ],
};

const avroBytes = (buf) => cat([zigzag(buf.length), buf]);
const avroString = (s) => avroBytes(Buffer.from(String(s ?? ''), 'utf8'));
const avroBool = (b) => Buffer.from([b ? 1 : 0]);

/** Decimal Avro: inteiro não escalado em complemento para 2, big-endian, mínimo de bytes. */
function avroDecimalBytes(dec) {
  let v = BigInt(unscaled(dec));
  const out = [];
  while (true) {
    out.unshift(Number(v & 0xffn));
    v >>= 8n; // aritmético para BigInt negativo
    const sign = out[0] & 0x80;
    if ((v === 0n && !sign) || (v === -1n && sign)) break;
  }
  return avroBytes(Buffer.from(out));
}

function encodeAvroRecord(r) {
  const parts = [
    zigzag(r.id), zigzag(r.aluno_id), zigzag(r.matricula_id),
    zigzag(r.turma_id), zigzag(r.disciplina_id), zigzag(r.professor_id),
    zigzag(r.ano_letivo), zigzag(r.serie_classe),
    avroString(r.periodo),
    zigzag(tsMillis(r.data_lancamento)),
    avroString(r.disciplina),
    avroDecimalBytes(r.nota),
    zigzag(r.escala_max), zigzag(r.nota_minima),
    zigzag(SITUACOES.indexOf(r.situacao)),
    avroString(r.observacao),
    avroString(r.localizacao.provincia), avroString(r.localizacao.municipio), avroString(r.localizacao.bairro),
  ];
  if (r.metadados == null) parts.push(zigzag(0));
  else {
    parts.push(zigzag(1), avroString(r.metadados.lancado_por), avroString(r.metadados.turno),
      avroBool(r.metadados.repetente), avroBool(r.metadados.apoio_pedagogico));
  }
  return cat(parts);
}

class AvroFileWriter {
  constructor(filePath) {
    this.fd = fs.openSync(filePath, 'w');
    // Marcador de sincronização determinístico (md5 do schema): mesma seed => mesmo ficheiro.
    this.sync = crypto.createHash('md5').update(JSON.stringify(AVRO_SCHEMA)).digest();
    this.records = 0;
    const header = cat([
      Buffer.from([0x4f, 0x62, 0x6a, 0x01]), // 'Obj' + versão 1
      zigzag(2),
      avroString('avro.codec'), avroBytes(Buffer.from('null')),
      avroString('avro.schema'), avroBytes(Buffer.from(JSON.stringify(AVRO_SCHEMA))),
      zigzag(0),
      this.sync,
    ]);
    writeAll(this.fd, header);
  }

  writeBatch(notas) {
    if (!notas.length) return;
    const body = cat(notas.map(encodeAvroRecord));
    writeAll(this.fd, cat([zigzag(notas.length), zigzag(body.length), body, this.sync]));
    this.records += notas.length;
  }

  close() { fs.closeSync(this.fd); }
}

// ============================ PARQUET ============================

// Tipos do protocolo compacto Thrift
const TT = { I32: 5, I64: 6, BINARY: 8, LIST: 9, STRUCT: 12 };
const PQ = { INT32: 1, INT64: 2, BYTE_ARRAY: 6 };
const CONVERTED = { UTF8: 0, DECIMAL: 5, TIMESTAMP_MILLIS: 9, JSON: 19 };

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
  return cat(out);
}
const tInt = (n) => zigzag(n);
const tBinary = (buf) => cat([uvarint(buf.length), buf]);
const tString = (s) => tBinary(Buffer.from(String(s), 'utf8'));
function tList(tipo, itens) {
  const n = itens.length;
  const cab = n < 15 ? Buffer.from([(n << 4) | tipo]) : cat([Buffer.from([0xf0 | tipo]), uvarint(n)]);
  return cat([cab, ...itens]);
}

/** Níveis de definição (RLE, largura 1 bit) para colunas opcionais, com prefixo de tamanho. */
function defLevels(presentes) {
  const runs = [];
  let i = 0;
  while (i < presentes.length) {
    let j = i;
    while (j < presentes.length && presentes[j] === presentes[i]) j++;
    runs.push(uvarint((j - i) << 1), Buffer.from([presentes[i]]));
    i = j;
  }
  const corpo = cat(runs);
  return cat([u32le(corpo.length), corpo]);
}

function colunaParquet(f) {
  switch (f.kind) {
    case 'int64': return { f, phys: PQ.INT64, get: (r) => BigInt(r[f.name]) };
    case 'int32': return { f, phys: PQ.INT32, get: (r) => Number(r[f.name]) };
    case 'timestamp': return { f, phys: PQ.INT64, conv: CONVERTED.TIMESTAMP_MILLIS, get: (r) => BigInt(tsMillis(r[f.name])) };
    case 'decimal': return { f, phys: PQ.INT32, conv: CONVERTED.DECIMAL, get: (r) => unscaled(r[f.name]) };
    // UTF8 (e não ENUM): leitores como pyarrow/pandas devolvem texto em vez de bytes.
    case 'enum': return { f, phys: PQ.BYTE_ARRAY, conv: CONVERTED.UTF8, get: (r) => String(r[f.name]) };
    case 'json': return {
      f, phys: PQ.BYTE_ARRAY, conv: CONVERTED.JSON, get: (r) => (r[f.name] == null ? null : JSON.stringify(r[f.name])),
    };
    default: return { f, phys: PQ.BYTE_ARRAY, conv: CONVERTED.UTF8, get: (r) => String(r[f.name]) };
  }
}

class ParquetFileWriter {
  constructor(filePath) {
    this.fd = fs.openSync(filePath, 'w');
    this.cols = FIELDS.map(colunaParquet);
    this.offset = 0;
    this.rowGroups = [];
    this.numRows = 0;
    this.write(Buffer.from('PAR1'));
  }

  write(buf) {
    writeAll(this.fd, buf);
    this.offset += buf.length;
  }

  writeBatch(notas) {
    const n = notas.length;
    if (!n) return;
    const chunks = [];
    let totalBytes = 0;
    for (const col of this.cols) {
      const valores = notas.map(col.get);
      const opcional = !!col.f.nullable;
      const presentes = valores.map((v) => (v === null ? 0 : 1));
      const naoNulos = valores.filter((v) => v !== null);
      const partes = [];
      if (opcional) partes.push(defLevels(presentes));
      for (const v of naoNulos) {
        if (col.phys === PQ.INT32) {
          const b = Buffer.allocUnsafe(4);
          b.writeInt32LE(v | 0, 0);
          partes.push(b);
        } else if (col.phys === PQ.INT64) {
          const b = Buffer.allocUnsafe(8);
          b.writeBigInt64LE(v, 0);
          partes.push(b);
        } else {
          const raw = Buffer.from(v, 'utf8');
          partes.push(u32le(raw.length), raw);
        }
      }
      const dados = cat(partes);
      const dph = tStruct([
        [1, TT.I32, tInt(n)], // num_values
        [2, TT.I32, tInt(0)], // encoding PLAIN
        [3, TT.I32, tInt(3)], // definition_level_encoding RLE
        [4, TT.I32, tInt(3)], // repetition_level_encoding RLE
      ]);
      const header = tStruct([
        [1, TT.I32, tInt(0)], // DATA_PAGE
        [2, TT.I32, tInt(dados.length)],
        [3, TT.I32, tInt(dados.length)],
        [5, TT.STRUCT, dph],
      ]);
      const pageOffset = this.offset;
      const page = cat([header, dados]);
      this.write(page);
      totalBytes += page.length;

      const meta = tStruct([
        [1, TT.I32, tInt(col.phys)],
        [2, TT.LIST, tList(TT.I32, [tInt(0), tInt(3)])],
        [3, TT.LIST, tList(TT.BINARY, [tString(col.f.name)])],
        [4, TT.I32, tInt(0)], // UNCOMPRESSED
        [5, TT.I64, tInt(n)],
        [6, TT.I64, tInt(page.length)],
        [7, TT.I64, tInt(page.length)],
        [9, TT.I64, tInt(pageOffset)],
      ]);
      chunks.push(tStruct([
        [2, TT.I64, tInt(pageOffset)],
        [3, TT.STRUCT, meta],
      ]));
    }
    this.rowGroups.push(tStruct([
      [1, TT.LIST, tList(TT.STRUCT, chunks)],
      [2, TT.I64, tInt(totalBytes)],
      [3, TT.I64, tInt(n)],
    ]));
    this.numRows += n;
  }

  close() {
    const root = tStruct([
      [4, TT.BINARY, tString('schema')],
      [5, TT.I32, tInt(this.cols.length)],
    ]);
    const elementos = this.cols.map((col) => {
      const campos = [
        [1, TT.I32, tInt(col.phys)],
        [3, TT.I32, tInt(col.f.nullable ? 1 : 0)],
        [4, TT.BINARY, tString(col.f.name)],
      ];
      if (col.conv !== undefined) campos.push([6, TT.I32, tInt(col.conv)]);
      if (col.conv === CONVERTED.DECIMAL) {
        campos.push([7, TT.I32, tInt(col.f.scale)], [8, TT.I32, tInt(col.f.precision)]);
      }
      return tStruct(campos);
    });
    const footer = tStruct([
      [1, TT.I32, tInt(1)],
      [2, TT.LIST, tList(TT.STRUCT, [root, ...elementos])],
      [3, TT.I64, tInt(this.numRows)],
      [4, TT.LIST, tList(TT.STRUCT, this.rowGroups)],
      [6, TT.BINARY, tString('colegio-mara-lu lab')],
    ]);
    this.write(cat([footer, u32le(footer.length), Buffer.from('PAR1')]));
    fs.closeSync(this.fd);
  }
}

module.exports = { AvroFileWriter, ParquetFileWriter, AVRO_SCHEMA };