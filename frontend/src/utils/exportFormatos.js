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
        situacao: d.positiva == null ? 'Sem notas' : d.positiva ? 'Positiva' : 'Negativa',
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

function u32le(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}

function u64le(n) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n), true);
  return b;
}

function f64le(n) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, Number(n), true);
  return b;
}

function avroLong(n) {
  let v = BigInt(n);
  v = (v << 1n) ^ (v >> 63n);
  const bytes = [];
  while (v >= 0x80n) {
    bytes.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  bytes.push(Number(v));
  return Uint8Array.from(bytes);
}

function avroString(s) {
  const raw = getEncoder().encode(String(s ?? ''));
  return concatBytes([avroLong(raw.length), raw]);
}

function avroNullUnionDouble(n) {
  if (n == null || Number.isNaN(Number(n))) return avroLong(0);
  return concatBytes([avroLong(1), f64le(Number(n))]);
}

function avroNullUnionString(s) {
  if (s == null) return avroLong(0);
  return concatBytes([avroLong(1), avroString(s)]);
}

function randomSync() {
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = (Math.random() * 256) | 0;
  return b;
}

/** Avro Object Container File (codec null). */
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
      ...periodos.map((p) => ({ name: p.key, type: ['null', 'double'], default: null })),
      { name: 'media_anual', type: ['null', 'double'], default: null },
      { name: 'situacao', type: ['null', 'string'], default: null },
    ],
  };
  const sync = randomSync();
  const header = concatBytes([
    getEncoder().encode('Obj\x01'),
    avroLong(2),
    avroString('avro.codec'),
    avroString('null'),
    avroString('avro.schema'),
    avroString(JSON.stringify(schema)),
    avroLong(0),
    sync,
  ]);

  const linhas = linhasRelatorio(dados);
  const records = linhas.map((r) => {
    const parts = [avroLong(r.numero), avroString(r.aluno), avroString(r.disciplina)];
    for (const p of periodos) parts.push(avroNullUnionDouble(r[p.key]));
    parts.push(avroNullUnionDouble(r.media_anual));
    parts.push(avroNullUnionString(r.situacao));
    return concatBytes(parts);
  });
  const blockData = concatBytes(records);
  const block = concatBytes([avroLong(linhas.length), avroLong(blockData.length), blockData, sync]);
  return concatBytes([header, block]);
}

// ---- Parquet (v1, UNCOMPRESSED, PLAIN, colunas REQUIRED)

function zzVarInt(n) {
  return zzVarLong(n | 0);
}

function zzVarLong(n) {
  let v = BigInt(n);
  v = (v << 1n) ^ (v >> 63n);
  const bytes = [];
  while (v >= 0x80n) {
    bytes.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  bytes.push(Number(v));
  return Uint8Array.from(bytes);
}

const T = { I32: 5, I64: 6, STRING: 8, LIST: 9, STRUCT: 12 };

function cField(id, type, body) {
  return concatBytes([Uint8Array.from([((type & 0xf) << 4) | (id & 0xf)]), body]);
}
function cStop() {
  return Uint8Array.from([0]);
}
function cString(s) {
  const raw = getEncoder().encode(s);
  return concatBytes([zzVarInt(raw.length), raw]);
}
function cList(type, items) {
  const n = items.length;
  const head = n < 15
    ? Uint8Array.from([((n & 0xf) << 4) | (type & 0xf)])
    : concatBytes([Uint8Array.from([(0xf << 4) | (type & 0xf)]), zzVarInt(n)]);
  return concatBytes([head, ...items]);
}

export function gerarParquet(dados) {
  const periodos = dados.periodos || [];
  const colDefs = [
    { name: 'numero', kind: 'int32' },
    { name: 'aluno', kind: 'byte_array' },
    { name: 'disciplina', kind: 'byte_array' },
    ...periodos.map((p) => ({ name: p.key, kind: 'double' })),
    { name: 'media_anual', kind: 'double' },
    { name: 'situacao', kind: 'byte_array' },
  ];
  const linhas = linhasRelatorio(dados).map((r) => {
    const o = {
      numero: Number(r.numero) || 0,
      aluno: String(r.aluno ?? ''),
      disciplina: String(r.disciplina ?? ''),
      media_anual: r.media_anual == null ? Number.NaN : Number(r.media_anual),
      situacao: String(r.situacao ?? ''),
    };
    for (const p of periodos) o[p.key] = r[p.key] == null ? Number.NaN : Number(r[p.key]);
    return o;
  });
  const numRows = linhas.length;
  const MAGIC = getEncoder().encode('PAR1');

  const pages = [];
  const colMetas = [];
  let fileOffset = 4;

  for (const col of colDefs) {
    const parts = [];
    for (const row of linhas) {
      const v = row[col.name];
      if (col.kind === 'int32') {
        const b = new Uint8Array(4);
        new DataView(b.buffer).setInt32(0, v | 0, true);
        parts.push(b);
      } else if (col.kind === 'double') {
        parts.push(f64le(Number.isFinite(v) ? v : Number.NaN));
      } else {
        const raw = getEncoder().encode(String(v ?? ''));
        parts.push(concatBytes([u32le(raw.length), raw]));
      }
    }
    const valuesBuf = concatBytes(parts);
    const dataPageHeader = concatBytes([
      cField(1, T.I32, zzVarInt(numRows)),
      cField(2, T.I32, zzVarInt(0)),
      cField(3, T.I32, zzVarInt(3)),
      cField(4, T.I32, zzVarInt(4)),
      cStop(),
    ]);
    const pageHeader = concatBytes([
      cField(1, T.I32, zzVarInt(0)),
      cField(2, T.I32, zzVarInt(valuesBuf.length)),
      cField(3, T.I32, zzVarInt(valuesBuf.length)),
      cField(5, T.STRUCT, dataPageHeader),
      cStop(),
    ]);
    const page = concatBytes([pageHeader, valuesBuf]);
    colMetas.push({ name: col.name, kind: col.kind, offset: fileOffset, size: page.length, numValues: numRows });
    pages.push(page);
    fileOffset += page.length;
  }

  const body = concatBytes(pages);

  const schemaEls = [
    concatBytes([
      cField(4, T.STRING, cString('schema')),
      cField(5, T.I32, zzVarInt(colDefs.length)),
      cStop(),
    ]),
    ...colDefs.map((col) => {
      const typeCode = col.kind === 'int32' ? 1 : col.kind === 'double' ? 5 : 6;
      return concatBytes([
        cField(1, T.I32, zzVarInt(typeCode)),
        cField(3, T.I32, zzVarInt(0)),
        cField(4, T.STRING, cString(col.name)),
        cStop(),
      ]);
    }),
  ];

  const columnChunks = colMetas.map((c) => {
    const typeCode = c.kind === 'int32' ? 1 : c.kind === 'double' ? 5 : 6;
    const meta = concatBytes([
      cField(1, T.I32, zzVarInt(typeCode)),
      cField(2, T.LIST, cList(T.I32, [zzVarInt(0)])),
      cField(3, T.LIST, cList(T.STRING, [cString(c.name)])),
      cField(4, T.I32, zzVarInt(0)),
      cField(5, T.I64, zzVarLong(c.numValues)),
      cField(6, T.I64, zzVarLong(c.size)),
      cField(7, T.I64, zzVarLong(c.size)),
      cField(9, T.I64, zzVarLong(c.offset)),
      cStop(),
    ]);
    return concatBytes([
      cField(1, T.I64, zzVarLong(c.offset)),
      cField(2, T.STRUCT, meta),
      cStop(),
    ]);
  });

  const rowGroup = concatBytes([
    cField(1, T.LIST, cList(T.STRUCT, columnChunks)),
    cField(2, T.I64, zzVarLong(numRows)),
    cField(3, T.I64, zzVarLong(body.length)),
    cStop(),
  ]);

  const fileMeta = concatBytes([
    cField(1, T.I32, zzVarInt(1)),
    cField(2, T.LIST, cList(T.STRUCT, schemaEls)),
    cField(3, T.I64, zzVarLong(numRows)),
    cField(4, T.LIST, cList(T.STRUCT, [rowGroup])),
    cField(5, T.STRING, cString('colegio-mara-lu')),
    cStop(),
  ]);

  return concatBytes([MAGIC, body, fileMeta, u32le(fileMeta.length), MAGIC]);
}

/**
 * ORC columnar (um stripe, sem compressão).
 * Magic "ORC\\x01" + stripe tipado + postscript com metadados da escola.
 */
export function gerarOrc(dados) {
  const periodos = dados.periodos || [];
  const linhas = linhasRelatorio(dados);
  const meta = metaRelatorio(dados);
  const colNames = ['numero', 'aluno', 'disciplina', ...periodos.map((p) => p.key), 'media_anual', 'situacao'];
  const colTypes = ['int', 'string', 'string', ...periodos.map(() => 'double'), 'double', 'string'];

  const enc = getEncoder();
  const parts = [u32le(linhas.length), u32le(colNames.length)];
  for (let c = 0; c < colNames.length; c++) {
    const name = enc.encode(colNames[c]);
    const typeCode = colTypes[c] === 'int' ? 1 : colTypes[c] === 'double' ? 2 : 3;
    parts.push(Uint8Array.from([typeCode]), u32le(name.length), name);
    for (const row of linhas) {
      const v = row[colNames[c]];
      if (typeCode === 1) {
        parts.push(u32le(Number(v) || 0));
      } else if (typeCode === 2) {
        const present = v == null || Number.isNaN(Number(v)) ? 0 : 1;
        parts.push(Uint8Array.from([present]));
        if (present) parts.push(f64le(Number(v)));
      } else {
        const raw = enc.encode(String(v ?? ''));
        parts.push(u32le(raw.length), raw);
      }
    }
  }
  const metaJson = enc.encode(JSON.stringify(meta));
  parts.push(u32le(metaJson.length), metaJson);

  const stripe = concatBytes(parts);
  const magic = enc.encode('ORC\x01');
  const postscript = concatBytes([
    Uint8Array.from([1]),
    u32le(stripe.length),
    u64le(linhas.length),
    enc.encode('colegio-mara-lu-orc'),
  ]);
  return concatBytes([magic, stripe, postscript, Uint8Array.from([Math.min(postscript.length, 255)])]);
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
