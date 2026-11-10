/* eslint-env es2020 */
// Exportação tabular de alunos/notas → CSV, JSON, Avro, Parquet e ORC.

/** TextEncoder compatível com browser e Jest (sem polyfill webpack de `util`). */
const getEncoder = () => {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder();
  return {
    encode(str) {
      const s = String(str ?? '');
      const bytes = [];
      for (let i = 0; i < s.length; i++) {
        let code = s.charCodeAt(i);
        if (code < 0x80) bytes.push(code);
        else if (code < 0x800) {
          bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < s.length) {
          const next = s.charCodeAt(++i);
          code = 0x10000 + ((code & 0x3ff) << 10) + (next & 0x3ff);
          bytes.push(
            0xf0 | (code >> 18),
            0x80 | ((code >> 12) & 0x3f),
            0x80 | ((code >> 6) & 0x3f),
            0x80 | (code & 0x3f)
          );
        } else {
          bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        }
      }
      return Uint8Array.from(bytes);
    },
  };
};

/** "1PP" → "p_1PP": nomes válidos na spec Avro ([A-Za-z_][A-Za-z0-9_]*) e seguros em Parquet/ORC. */
export const nomeColuna = (key) => `p_${String(key).replace(/[^A-Za-z0-9_]/g, '_')}`;

export function linhasRelatorio(dados) {
  const discPorId = new Map((dados.disciplinas || []).map((d) => [d.id, d.nome]));
  const periodos = dados.periodos || [];
  const linhas = [];
  (dados.alunos || []).forEach((a, i) => {
    (a.disciplinas || []).forEach((d) => {
      const row = {
        numero: i + 1,
        aluno: a.aluno_nome,
        disciplina: discPorId.get(d.disciplina_id) || '',
        media_anual: d.media == null ? null : Number(d.media),
        // positiva só é definitiva com os 6 períodos lançados (ver backend); antes disso "Em curso".
        situacao: d.positiva == null
          ? (d.media == null ? 'Sem notas' : 'Em curso')
          : d.positiva ? 'Positiva' : 'Negativa',
      };
      for (const p of periodos) {
        const v = d.periodos?.[p.key];
        row[p.key] = v == null || v === '' ? null : Number(v);
      }
      linhas.push(row);
    });
  });
  return linhas;
}

export function metaRelatorio(dados) {
  const t = dados.turma || {};
  return {
    escola: 'Colégio Mara Lu',
    turma: t.nome || '',
    serie_classe: t.serie_classe ?? null,
    curso: t.curso_nome || null,
    ano_letivo: t.ano_letivo ?? null,
    turno: t.turno || null,
    gerado_em: dados.gerado_em || new Date().toISOString(),
    disciplina_selecionada: dados.disciplina_selecionada?.nome || null,
  };
}

const celulaCsv = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

const fmtDecimal = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (Number.isNaN(n)) return '';
  return String(Math.round(n * 10) / 10).replace('.', ',');
};

export function gerarCsv(dados) {
  const periodos = dados.periodos || [];
  const cab = ['Nº', 'Aluno', 'Disciplina', ...periodos.map((p) => p.label), 'Média anual', 'Situação'];
  const linhas = [cab];
  for (const r of linhasRelatorio(dados)) {
    linhas.push([
      r.numero,
      r.aluno,
      r.disciplina,
      ...periodos.map((p) => fmtDecimal(r[p.key])),
      fmtDecimal(r.media_anual),
      r.situacao,
    ]);
  }
  const meta = metaRelatorio(dados);
  const topo = [
    [meta.escola],
    ['Relatório de notas', `${meta.turma} (${meta.ano_letivo})`],
    ['Gerado em', meta.gerado_em],
  ];
  if (meta.disciplina_selecionada) topo.push(['Disciplina', meta.disciplina_selecionada]);
  topo.push([]);
  return '\uFEFF' + [...topo, ...linhas].map((l) => l.map(celulaCsv).join(';')).join('\r\n');
}

export function gerarJson(dados) {
  return JSON.stringify(
    {
      meta: metaRelatorio(dados),
      periodos: (dados.periodos || []).map((p) => ({ key: p.key, label: p.label })),
      linhas: linhasRelatorio(dados),
    },
    null,
    2
  );
}

function concatBytes(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

const byteArr = (...b) => Uint8Array.from(b);

function u32le(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}

function f64le(n) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, Number(n), true);
  return b;
}

/** Varint sem sinal (LEB128). */
function uvarint(n) {
  let v = BigInt(n);
  const bytes = [];
  while (v >= 0x80n) {
    bytes.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  bytes.push(Number(v));
  return Uint8Array.from(bytes);
}

/** Varint com zig-zag (inteiros com sinal: Avro, Thrift Compact, ORC RLE v1 com sinal). */
function zigzag(n) {
  const v = BigInt(n);
  return uvarint((v << 1n) ^ (v >> 63n));
}

// ---------------------------------------------------------------- Avro

const avroString = (s) => {
  const raw = getEncoder().encode(String(s ?? ''));
  return concatBytes([zigzag(raw.length), raw]);
};

function avroNullUnionDouble(n) {
  if (n == null || Number.isNaN(Number(n))) return zigzag(0);
  return concatBytes([zigzag(1), f64le(Number(n))]);
}

function avroNullUnionString(s) {
  if (s == null) return zigzag(0);
  return concatBytes([zigzag(1), avroString(s)]);
}

function randomSync() {
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = (Math.random() * 256) | 0;
  return b;
}

/** Avro Object Container File (codec null). Colunas de período: p_1PP, p_1PT, ... */
export function gerarAvro(dados) {
  const periodos = dados.periodos || [];
  const schema = {
    type: 'record',
    name: 'NotaAluno',
    namespace: 'colegio.mara.lu',
    fields: [
      { name: 'numero', type: 'int' },
      { name: 'aluno', type: 'string' },
      { name: 'disciplina', type: 'string' },
      ...periodos.map((p) => ({ name: nomeColuna(p.key), type: ['null', 'double'], default: null })),
      { name: 'media_anual', type: ['null', 'double'], default: null },
      { name: 'situacao', type: ['null', 'string'], default: null },
    ],
  };
  const sync = randomSync();
  const header = concatBytes([
    getEncoder().encode('Obj\x01'),
    zigzag(2),
    avroString('avro.codec'),
    getEncoder().encode('\x08null'),
    avroString('avro.schema'),
    avroString(JSON.stringify(schema)),
    zigzag(0),
    sync,
  ]);

  const linhas = linhasRelatorio(dados);
  const records = linhas.map((r) => {
    const parts = [zigzag(r.numero), avroString(r.aluno), avroString(r.disciplina)];
    for (const p of periodos) parts.push(avroNullUnionDouble(r[p.key]));
    parts.push(avroNullUnionDouble(r.media_anual));
    parts.push(avroNullUnionString(r.situacao));
    return concatBytes(parts);
  });
  if (!linhas.length) return header;
  const blockData = concatBytes(records);
  const block = concatBytes([zigzag(linhas.length), zigzag(blockData.length), blockData, sync]);
  return concatBytes([header, block]);
}

// ---------------------------------------------------------------- Parquet
// Parquet v1, página de dados PLAIN, sem compressão, um row group.
// Thrift Compact: cabeçalho de campo = (delta de id << 4) | tipo; tamanhos = varint SEM zig-zag.

const TT = { I32: 5, I64: 6, BINARY: 8, LIST: 9, STRUCT: 12 };

/** campos: [id, tipo, corpo][] com ids por ordem crescente. */
function tStruct(campos) {
  const out = [];
  let ultimo = 0;
  for (const [id, tipo, corpo] of campos) {
    const delta = id - ultimo;
    if (delta > 0 && delta <= 15) out.push(byteArr((delta << 4) | tipo));
    else out.push(byteArr(tipo), zigzag(id));
    out.push(corpo);
    ultimo = id;
  }
  out.push(byteArr(0));
  return concatBytes(out);
}
const tInt = (n) => zigzag(n);
const tBinary = (bytes) => concatBytes([uvarint(bytes.length), bytes]);
const tString = (s) => tBinary(getEncoder().encode(String(s ?? '')));
function tList(tipo, itens) {
  const n = itens.length;
  const cab = n < 15 ? byteArr((n << 4) | tipo) : concatBytes([byteArr(0xf0 | tipo), uvarint(n)]);
  return concatBytes([cab, ...itens]);
}

// Tipos físicos Parquet
const PQ = { INT32: 1, DOUBLE: 5, BYTE_ARRAY: 6 };

/** Definition levels (largura 1 bit) em RLE/bit-packed híbrido, só com runs RLE. */
function pqDefLevels(presentes) {
  const runs = [];
  let i = 0;
  while (i < presentes.length) {
    let j = i;
    while (j < presentes.length && presentes[j] === presentes[i]) j++;
    runs.push(uvarint((j - i) << 1), byteArr(presentes[i]));
    i = j;
  }
  const corpo = concatBytes(runs);
  return concatBytes([u32le(corpo.length), corpo]);
}

export function gerarParquet(dados) {
  const periodos = dados.periodos || [];
  const rows = linhasRelatorio(dados);
  const numRows = rows.length;
  const enc = getEncoder();

  const colunas = [
    { nome: 'numero', tipo: PQ.INT32, opcional: false, get: (r) => Number(r.numero) || 0 },
    { nome: 'aluno', tipo: PQ.BYTE_ARRAY, opcional: false, get: (r) => String(r.aluno ?? '') },
    { nome: 'disciplina', tipo: PQ.BYTE_ARRAY, opcional: false, get: (r) => String(r.disciplina ?? '') },
    ...periodos.map((p) => ({
      nome: nomeColuna(p.key), tipo: PQ.DOUBLE, opcional: true, get: (r) => (r[p.key] == null ? null : Number(r[p.key])),
    })),
    { nome: 'media_anual', tipo: PQ.DOUBLE, opcional: true, get: (r) => (r.media_anual == null ? null : Number(r.media_anual)) },
    { nome: 'situacao', tipo: PQ.BYTE_ARRAY, opcional: false, get: (r) => String(r.situacao ?? '') },
  ];

  const MAGIC = enc.encode('PAR1');
  const paginas = [];
  const chunks = [];
  let offset = 4;

  if (numRows > 0) {
    for (const col of colunas) {
      const valores = rows.map(col.get);
      const presentes = valores.map((v) => (v === null || Number.isNaN(v) ? 0 : 1));
      const naoNulos = valores.filter((v, i) => presentes[i] === 1);
      const partes = [];
      if (col.opcional) partes.push(pqDefLevels(presentes));
      for (const v of naoNulos) {
        if (col.tipo === PQ.INT32) {
          const b = new Uint8Array(4);
          new DataView(b.buffer).setInt32(0, v | 0, true);
          partes.push(b);
        } else if (col.tipo === PQ.DOUBLE) {
          partes.push(f64le(v));
        } else {
          const raw = enc.encode(v);
          partes.push(u32le(raw.length), raw);
        }
      }
      const dados_ = concatBytes(partes);
      const dph = tStruct([
        [1, TT.I32, tInt(numRows)],
        [2, TT.I32, tInt(0)], // encoding PLAIN
        [3, TT.I32, tInt(3)], // definition levels: RLE
        [4, TT.I32, tInt(3)], // repetition levels: RLE
      ]);
      const cab = tStruct([
        [1, TT.I32, tInt(0)], // DATA_PAGE
        [2, TT.I32, tInt(dados_.length)],
        [3, TT.I32, tInt(dados_.length)],
        [5, TT.STRUCT, dph],
      ]);
      const pagina = concatBytes([cab, dados_]);
      const meta = tStruct([
        [1, TT.I32, tInt(col.tipo)],
        [2, TT.LIST, tList(TT.I32, col.opcional ? [tInt(0), tInt(3)] : [tInt(0)])],
        [3, TT.LIST, tList(TT.BINARY, [tString(col.nome)])],
        [4, TT.I32, tInt(0)], // UNCOMPRESSED
        [5, TT.I64, tInt(numRows)],
        [6, TT.I64, tInt(pagina.length)],
        [7, TT.I64, tInt(pagina.length)],
        [9, TT.I64, tInt(offset)],
      ]);
      chunks.push(tStruct([[2, TT.I64, tInt(offset)], [3, TT.STRUCT, meta]]));
      paginas.push(pagina);
      offset += pagina.length;
    }
  }
  const corpo = concatBytes(paginas);

  const schema = [
    tStruct([[4, TT.BINARY, tString('schema')], [5, TT.I32, tInt(colunas.length)]]),
    ...colunas.map((col) => {
      const campos = [
        [1, TT.I32, tInt(col.tipo)],
        [3, TT.I32, tInt(col.opcional ? 1 : 0)], // 0 REQUIRED, 1 OPTIONAL
        [4, TT.BINARY, tString(col.nome)],
      ];
      if (col.tipo === PQ.BYTE_ARRAY) campos.push([6, TT.I32, tInt(0)]); // converted_type UTF8
      return tStruct(campos);
    }),
  ];

  const rowGroups = numRows > 0
    ? [tStruct([
      [1, TT.LIST, tList(TT.STRUCT, chunks)],
      [2, TT.I64, tInt(corpo.length)],
      [3, TT.I64, tInt(numRows)],
    ])]
    : [];

  const fileMeta = tStruct([
    [1, TT.I32, tInt(1)],
    [2, TT.LIST, tList(TT.STRUCT, schema)],
    [3, TT.I64, tInt(numRows)],
    [4, TT.LIST, tList(TT.STRUCT, rowGroups)],
    [6, TT.BINARY, tString('colegio-mara-lu')],
  ]);

  return concatBytes([MAGIC, corpo, fileMeta, u32le(fileMeta.length), MAGIC]);
}

// ---------------------------------------------------------------- ORC
// ORC v0.12 real: um stripe, sem compressão, colunas DIRECT (RLE v1), protobuf escrito à mão.

const pbVar = (campo, n) => concatBytes([uvarint(campo << 3), uvarint(n)]);
const pbBytes = (campo, bytes) => concatBytes([uvarint((campo << 3) | 2), uvarint(bytes.length), bytes]);
const pbPacked = (campo, nums) => pbBytes(campo, concatBytes(nums.map((n) => uvarint(n))));

/** RLE v1 de inteiros: só literais (até 128 por bloco). */
function orcRleInts(valores, comSinal) {
  const out = [];
  for (let i = 0; i < valores.length; i += 128) {
    const bloco = valores.slice(i, i + 128);
    out.push(byteArr(256 - bloco.length));
    for (const v of bloco) out.push(comSinal ? zigzag(v) : uvarint(v));
  }
  return concatBytes(out);
}

/** Byte RLE: só literais (até 128 por bloco). */
function orcByteRle(bytes) {
  const out = [];
  for (let i = 0; i < bytes.length; i += 128) {
    const bloco = bytes.slice(i, i + 128);
    out.push(byteArr(256 - bloco.length), Uint8Array.from(bloco));
  }
  return concatBytes(out);
}

/** Boolean RLE (stream PRESENT): bits MSB primeiro, depois byte RLE. */
function orcBooleans(flags) {
  const bytes = [];
  for (let i = 0; i < flags.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) if (flags[i + k]) b |= 0x80 >> k;
    bytes.push(b);
  }
  return orcByteRle(bytes);
}

const ORC_KIND = { INT: 3, DOUBLE: 6, STRING: 7, STRUCT: 12 };
const ORC_STREAM = { PRESENT: 0, DATA: 1, LENGTH: 2 };

export function gerarOrc(dados) {
  const periodos = dados.periodos || [];
  const rows = linhasRelatorio(dados);
  const n = rows.length;
  const enc = getEncoder();

  const colunas = [
    { nome: 'numero', kind: ORC_KIND.INT, get: (r) => Number(r.numero) || 0 },
    { nome: 'aluno', kind: ORC_KIND.STRING, get: (r) => String(r.aluno ?? '') },
    { nome: 'disciplina', kind: ORC_KIND.STRING, get: (r) => String(r.disciplina ?? '') },
    ...periodos.map((p) => ({
      nome: nomeColuna(p.key), kind: ORC_KIND.DOUBLE, get: (r) => (r[p.key] == null ? null : Number(r[p.key])),
    })),
    { nome: 'media_anual', kind: ORC_KIND.DOUBLE, get: (r) => (r.media_anual == null ? null : Number(r.media_anual)) },
    { nome: 'situacao', kind: ORC_KIND.STRING, get: (r) => String(r.situacao ?? '') },
  ];

  const header = enc.encode('ORC');

  // Tipos: coluna 0 = struct raiz; colunas 1..N = campos
  const tipos = [
    concatBytes([
      pbVar(1, ORC_KIND.STRUCT),
      pbPacked(2, colunas.map((_, i) => i + 1)),
      ...colunas.map((c) => pbBytes(3, enc.encode(c.nome))),
    ]),
    ...colunas.map((c) => pbVar(1, c.kind)),
  ];

  const stats = [pbVar(1, n), ...colunas.map(() => pbVar(1, n))].map((s) => pbBytes(7, s));

  let stripes = [];
  let stripeBytes = new Uint8Array(0);

  if (n > 0) {
    const streams = []; // { kind, coluna, dados }
    colunas.forEach((col, i) => {
      const id = i + 1;
      const valores = rows.map(col.get);
      const presentes = valores.map((v) => v !== null && !Number.isNaN(v));
      const naoNulos = valores.filter((_, k) => presentes[k]);
      if (presentes.some((p) => !p)) {
        streams.push({ kind: ORC_STREAM.PRESENT, coluna: id, dados: orcBooleans(presentes) });
      }
      if (col.kind === ORC_KIND.INT) {
        streams.push({ kind: ORC_STREAM.DATA, coluna: id, dados: orcRleInts(naoNulos, true) });
      } else if (col.kind === ORC_KIND.DOUBLE) {
        streams.push({ kind: ORC_STREAM.DATA, coluna: id, dados: concatBytes(naoNulos.map(f64le)) });
      } else {
        const raws = naoNulos.map((s) => enc.encode(s));
        streams.push({ kind: ORC_STREAM.DATA, coluna: id, dados: concatBytes(raws) });
        streams.push({ kind: ORC_STREAM.LENGTH, coluna: id, dados: orcRleInts(raws.map((r) => r.length), false) });
      }
    });

    const dadosStripe = concatBytes(streams.map((s) => s.dados));
    const rodape = concatBytes([
      ...streams.map((s) => pbBytes(1, concatBytes([
        pbVar(1, s.kind), pbVar(2, s.coluna), pbVar(3, s.dados.length),
      ]))),
      ...[0, ...colunas.map(() => 0)].map(() => pbBytes(2, pbVar(1, 0))), // DIRECT
    ]);
    stripeBytes = concatBytes([dadosStripe, rodape]);
    stripes = [pbBytes(3, concatBytes([
      pbVar(1, header.length), // offset
      pbVar(2, 0), // indexLength
      pbVar(3, dadosStripe.length),
      pbVar(4, rodape.length),
      pbVar(5, n),
    ]))];
  }

  const footer = concatBytes([
    pbVar(1, header.length),
    pbVar(2, stripeBytes.length),
    ...stripes,
    ...tipos.map((t) => pbBytes(4, t)),
    pbVar(6, n),
    ...stats,
  ]);

  const postscript = concatBytes([
    pbVar(1, footer.length),
    pbVar(2, 0), // compressão: NONE
    pbPacked(4, [0, 12]),
    pbVar(5, 0), // metadataLength
    pbBytes(8000, enc.encode('ORC')),
  ]);

  return concatBytes([header, stripeBytes, footer, postscript, byteArr(postscript.length)]);
}

export function nomeFicheiro(dados, ext) {
  const slug = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  const turma = slug(dados.turma?.nome) || 'turma';
  const disc = dados.disciplina_selecionada?.nome ? `-${slug(dados.disciplina_selecionada.nome)}` : '';
  return `notas-${turma}${disc}-${dados.turma?.ano_letivo || 'ano'}.${ext}`;
}

export function descarregarBlob(conteudo, nomeFicheiroFinal, mime) {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFicheiroFinal;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const FORMATOS_EXPORT = [
  { id: 'csv', label: 'CSV (Excel)', ext: 'csv' },
  { id: 'json', label: 'JSON', ext: 'json' },
  { id: 'avro', label: 'Avro', ext: 'avro' },
  { id: 'parquet', label: 'Parquet', ext: 'parquet' },
  { id: 'orc', label: 'ORC', ext: 'orc' },
];

export function gerarPorFormato(formato, dados) {
  switch (formato) {
    case 'csv':
      return { body: gerarCsv(dados), mime: 'text/csv;charset=utf-8', ext: 'csv' };
    case 'json':
      return { body: gerarJson(dados), mime: 'application/json;charset=utf-8', ext: 'json' };
    case 'avro':
      return { body: gerarAvro(dados), mime: 'application/avro', ext: 'avro' };
    case 'parquet':
      return { body: gerarParquet(dados), mime: 'application/vnd.apache.parquet', ext: 'parquet' };
    case 'orc':
      return { body: gerarOrc(dados), mime: 'application/vnd.apache.orc', ext: 'orc' };
    default:
      throw new Error(`Formato não suportado: ${formato}`);
  }
}