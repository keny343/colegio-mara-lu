'use strict';

/**
 * Gerador determinístico de linhas aluno×disciplina (espelha data-engineering/generator).
 * Alinhado ao Colégio Mara & Lu / sistema angolano:
 * 3 trimestres × (parcial + trimestral) = 1PP, 1PT, 2PP, 2PT, 3PP, 3PT.
 * Seed local via Mulberry32 — reproduzível no Node; o CLI Python usa random.Random.
 */

const PERIODOS = ['1PP', '1PT', '2PP', '2PT', '3PP', '3PT'];

const DISCIPLINAS = [
  'Língua Portuguesa',
  'Matemática',
  'História',
  'Geografia',
  'Ciências',
  'Educação Física',
  'Educação Moral e Cívica',
  'Inglês',
  'Física',
  'Química',
  'Biologia',
  'Informática',
];

const TURNOS = ['manhã', 'tarde', 'noite'];

const CURSOS_SEC = [
  null,
  'Ciências Físicas e Biológicas',
  'Ciências Económicas e Jurídicas',
  'Humanidades',
];

const PROVINCIAS = [
  ['Luanda', 'Luanda', -8.8383, 13.2344],
  ['Benguela', 'Benguela', -12.5763, 13.4055],
  ['Huambo', 'Huambo', -12.7761, 15.7393],
  ['Huíla', 'Lubango', -14.9172, 13.4925],
  ['Cabinda', 'Cabinda', -5.55, 12.2],
];

const NOMES = [
  'Ana', 'Bruno', 'Carla', 'Daniel', 'Elena', 'Fábio', 'Gisela', 'Hugo',
  'Inês', 'João', 'Katia', 'Luis', 'Maria', 'Nuno', 'Olga', 'Paulo',
  'Quintino', 'Rita', 'Sara', 'Tiago', 'Úrsula', 'Vítor', 'Wanda', 'Xavier',
];

const SOBRENOMES = [
  'Silva', 'Santos', 'Costa', 'Pereira', 'Oliveira', 'Fernandes', 'Rodrigues',
  'Martins', 'Almeida', 'Nascimento', 'Dos Santos', 'Manuel', 'João',
];

const BASE_MS = Date.UTC(2025, 1, 1, 8, 0, 0); // 2025-02-01

const SCHEMA_FIELDS = [
  'id', 'aluno_id', 'matricula_id', 'aluno_nome', 'turma_id', 'turma_nome',
  'serie_classe', 'curso', 'ano_letivo', 'turno', 'disciplina_id', 'disciplina',
  'periodos', 'media_anual', 'situacao', 'nota_minima', 'data_atualizacao',
  'turma_info', 'metadados',
];

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function randint(rng, a, b) {
  return a + Math.floor(rng() * (b - a + 1));
}

function uniform(rng, a, b) {
  return a + rng() * (b - a);
}

/** Box–Muller (aproxima random.gauss do Python). */
function gauss(rng, mu, sigma) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mu + z * sigma;
}

function qNota(n) {
  return (Math.round(Number(n) * 10) / 10).toFixed(1);
}

function notaMinimaPara(serie) {
  return serie >= 1 && serie <= 6 ? 5 : 10;
}

function limiteMaxPara(serie) {
  return serie <= 6 ? 10 : 20;
}

function mediaTrimestre(a, b) {
  const vals = [a, b].filter((x) => x != null).map(Number);
  if (!vals.length) return null;
  return vals.reduce((s, x) => s + x, 0) / vals.length;
}

function mediaPeriodos(periodos) {
  const t1 = mediaTrimestre(periodos['1PP'], periodos['1PT']);
  const t2 = mediaTrimestre(periodos['2PP'], periodos['2PT']);
  const t3 = mediaTrimestre(periodos['3PP'], periodos['3PT']);
  const trimestres = [t1, t2, t3].filter((t) => t != null);
  if (!trimestres.length) return null;
  const m = trimestres.reduce((s, x) => s + x, 0) / trimestres.length;
  return qNota(m);
}

function periodosCompletos(periodos) {
  return PERIODOS.every((k) => periodos[k] != null);
}

function situacaoDe(periodos, media, minimo) {
  if (media == null) return 'Sem notas';
  if (!periodosCompletos(periodos)) return 'Em curso';
  return Number(media) >= minimo ? 'Positiva' : 'Negativa';
}

function makeRecord(rng, rowId) {
  const serie = randint(rng, 1, 12);
  const maxNota = limiteMaxPara(serie);
  const minimo = notaMinimaPara(serie);
  const curso = serie >= 10 ? pick(rng, CURSOS_SEC) : null;
  const turno = pick(rng, TURNOS);
  const turmaId = 1 + (serie - 1) * 3 + randint(rng, 0, 2);
  let turmaNome = `${serie}ª ${turno[0].toUpperCase()}${turno.slice(1)}`;
  if (curso) turmaNome = `${serie}ª ${curso.split(' ')[0]} ${turno}`;

  const alunoId = randint(rng, 1, 80000);
  const matriculaId = alunoId * 10 + randint(rng, 0, 9);
  const nome = `${pick(rng, NOMES)} ${pick(rng, SOBRENOMES)}`;
  const discIdx = randint(rng, 0, DISCIPLINAS.length - 1);
  const disciplina = DISCIPLINAS[discIdx];
  const disciplinaId = discIdx + 1;

  const fillProb = uniform(rng, 0.55, 1.0);
  const periodos = {};
  for (const key of PERIODOS) {
    if (rng() < fillProb) {
      let raw = gauss(rng, maxNota * 0.62, maxNota * 0.18);
      raw = Math.round(raw * 10) / 10;
      if (raw < 0) raw = 0;
      if (raw > maxNota) raw = maxNota;
      periodos[key] = qNota(raw);
    } else {
      periodos[key] = null;
    }
  }

  const media = mediaPeriodos(periodos);
  const situacao = situacaoDe(periodos, media, minimo);

  const [prov, mun, lat0, lon0] = pick(rng, PROVINCIAS);
  const lat = lat0 + uniform(rng, -0.05, 0.05);
  const lon = lon0 + uniform(rng, -0.05, 0.05);

  const seconds = randint(rng, 0, 86400 * 200);
  const data = new Date(BASE_MS + seconds * 1000);
  const iso = data.toISOString().slice(0, 19);

  let metadados = null;
  if (rng() < 0.75) {
    metadados = {
      professor_id: randint(rng, 1, 200),
      origem: pick(rng, ['lancamento', 'importacao', 'laboratorio']),
      observacao: rng() < 0.7 ? null : 'recuperação',
    };
  }

  return {
    id: rowId,
    aluno_id: alunoId,
    matricula_id: matriculaId,
    aluno_nome: nome,
    turma_id: turmaId,
    turma_nome: turmaNome,
    serie_classe: serie,
    curso,
    ano_letivo: 2025,
    turno,
    disciplina_id: disciplinaId,
    disciplina,
    periodos,
    media_anual: media,
    situacao,
    nota_minima: minimo,
    data_atualizacao: iso,
    turma_info: {
      escola: 'Colégio Mara & Lu',
      provincia: prov,
      municipio: mun,
      latitude: Math.round(lat * 1e6) / 1e6,
      longitude: Math.round(lon * 1e6) / 1e6,
    },
    metadados,
  };
}

function* generateBatches(n, seed = 42, batchSize = 5000, startId = 1) {
  if (batchSize < 1) throw new Error('batch_size deve ser >= 1');
  const rng = mulberry32(seed >>> 0);
  let batch = [];
  for (let i = 0; i < n; i++) {
    batch.push(makeRecord(rng, startId + i));
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length) yield batch;
}

module.exports = {
  PERIODOS,
  DISCIPLINAS,
  generateBatches,
  SCHEMA_FIELDS,
  notaMinimaPara,
  limiteMaxPara,
  mediaPeriodos,
  situacaoDe,
};
