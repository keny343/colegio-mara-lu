'use strict';

/**
 * Gerador determinístico de notas de alunos — contexto angolano.
 * Mesma seed => mesmos dados, independentemente do tamanho do lote.
 *
 * Regras (backend/src/utils/academicoRules.js):
 *  - 3 trimestres, 6 períodos por disciplina: 1PP 1PT 2PP 2PT 3PP 3PT
 *  - 1ª–6ª classe: notas 0–10, mínimo 5 | 7ª–13ª classe: notas 0–20, mínimo 10
 *  - situacao = nota >= nota_minima ? 'positiva' : 'negativa'
 * Cada aluno tem todas as notas das disciplinas da sua classe/curso (pauta completa).
 */

const { PERIODOS } = require('./schema');

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hash32(...parts) {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x9e3779b9;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const pad = (n, w = 2) => String(n).padStart(w, '0');

// ---------- Catálogo angolano ----------

const CURSOS = {
  INFO: 'Informática',
  CFB: 'Ciências Físicas e Biológicas',
  CEJ: 'Ciências Económicas e Jurídicas',
};

const DISC_1_4 = ['Língua Portuguesa', 'Matemática', 'Estudo do Meio', 'Educação Manual e Plástica', 'Educação Musical', 'Educação Física'];
const DISC_5_6 = ['Língua Portuguesa', 'Matemática', 'Ciências da Natureza', 'História', 'Geografia', 'Educação Moral e Cívica', 'Educação Visual e Plástica', 'Educação Física'];
const DISC_7_9 = ['Língua Portuguesa', 'Matemática', 'Inglês', 'Biologia', 'Física', 'Química', 'História', 'Geografia', 'Educação Moral e Cívica', 'Educação Física'];
const DISC_CURSO = {
  [CURSOS.INFO]: ['Matemática', 'Física', 'Informática', 'Programação', 'Redes de Computadores', 'Empreendedorismo'],
  [CURSOS.CFB]: ['Matemática', 'Física', 'Química', 'Biologia', 'Geologia', 'Desenho'],
  [CURSOS.CEJ]: ['Matemática', 'Economia', 'Direito', 'Contabilidade', 'Geografia', 'História'],
};
const DISC_COMUM_II_CICLO = ['Língua Portuguesa', 'Inglês', 'Educação Física'];

const DISCIPLINAS_CATALOGO = [...new Set([
  ...DISC_1_4, ...DISC_5_6, ...DISC_7_9, ...DISC_COMUM_II_CICLO, ...Object.values(DISC_CURSO).flat(),
])];
const DISCIPLINA_ID = Object.fromEntries(DISCIPLINAS_CATALOGO.map((n, i) => [n, i + 1]));

function disciplinasDaClasse(serie, curso) {
  if (serie <= 4) return DISC_1_4;
  if (serie <= 6) return DISC_5_6;
  if (serie <= 9) return DISC_7_9;
  return [...DISC_COMUM_II_CICLO, ...DISC_CURSO[curso]];
}

// Grupos classe/curso que existem no sistema (ver séries em backend/database.sql)
const GRUPOS = [];
for (let s = 1; s <= 9; s++) GRUPOS.push({ serie: s, curso: null, cursoIdx: 0 });
for (let s = 10; s <= 13; s++) GRUPOS.push({ serie: s, curso: CURSOS.INFO, cursoIdx: 1 });
for (let s = 10; s <= 12; s++) GRUPOS.push({ serie: s, curso: CURSOS.CFB, cursoIdx: 2 });
for (let s = 10; s <= 12; s++) GRUPOS.push({ serie: s, curso: CURSOS.CEJ, cursoIdx: 3 });

const NOMES_M = ['Manuel', 'António', 'João', 'José', 'Domingos', 'Fernando', 'Paulo', 'Pedro', 'Miguel', 'Sebastião', 'Francisco', 'Mateus', 'Bernardo', 'Adilson', 'Hélder', 'Nelson', 'Jorge', 'Délcio', 'Abel', 'Garcia', 'Eduardo', 'Cláudio'];
const NOMES_F = ['Maria', 'Ana', 'Joana', 'Isabel', 'Luzia', 'Esperança', 'Domingas', 'Teresa', 'Catarina', 'Beatriz', 'Ermelinda', 'Filomena', 'Natália', 'Sandra', 'Paula', 'Eunice', 'Albertina', 'Madalena', 'Celeste', 'Graça', 'Vanda', 'Zulmira'];
const APELIDOS = ['Silva', 'Santos', 'Gomes', 'Fernandes', 'Pereira', 'Neto', 'Cardoso', 'Mendes', 'Ferreira', 'Domingos', 'Manuel', 'Francisco', 'Baptista', 'Quintas', 'Capita', 'Lopes', 'Sebastião', 'Tomás', 'Cassoma', 'Mateus', 'Vicente', 'Ngola', 'Kiala', 'Mbala', 'Lukamba', 'Nzuzi', 'Costa', 'Afonso', 'Bento', 'Cunha'];

// Província -> municípios (a maioria dos alunos está em Luanda)
const LOCAIS = [
  { provincia: 'Luanda', peso: 70, municipios: { Belas: ['Camama', 'Benfica', 'Vila Flor'], Cazenga: ['Hoji-ya-Henda', 'Tala Hady'], Cacuaco: ['Sequele', 'Kicolo'], Viana: ['Zango', 'Km 30'], 'Kilamba Kiaxi': ['Golfe', 'Palanca'], Talatona: ['Talatona', 'Cidade Financeira'], Luanda: ['Maianga', 'Rangel', 'Sambizanga'] } },
  { provincia: 'Benguela', peso: 4, municipios: { Benguela: ['Centro', 'Compão'], Lobito: ['Restinga', 'Canata'] } },
  { provincia: 'Huambo', peso: 3, municipios: { Huambo: ['Centro', 'São Pedro'] } },
  { provincia: 'Huíla', peso: 3, municipios: { Lubango: ['Centro', 'Mapunda'], Matala: ['Centro'] } },
  { provincia: 'Bengo', peso: 3, municipios: { Caxito: ['Centro', 'Mabubas'] } },
  { provincia: 'Cabinda', peso: 2, municipios: { Cabinda: ['Centro', 'Cabassango'] } },
  { provincia: 'Malanje', peso: 2, municipios: { Malanje: ['Centro', 'Cangambo'] } },
  { provincia: 'Uíge', peso: 2, municipios: { Uíge: ['Centro', 'Bairro Popular'] } },
  { provincia: 'Namibe', peso: 2, municipios: { Moçâmedes: ['Centro', 'Saco Mar'] } },
  { provincia: 'Cuanza Sul', peso: 2, municipios: { Sumbe: ['Centro', 'Chingo'] } },
  { provincia: 'Cuanza Norte', peso: 1, municipios: { "N'dalatando": ['Centro'] } },
  { provincia: 'Bié', peso: 1, municipios: { Cuíto: ['Centro', 'Sambo'] } },
  { provincia: 'Moxico', peso: 1, municipios: { Luena: ['Centro'] } },
  { provincia: 'Lunda Norte', peso: 1, municipios: { Dundo: ['Centro'] } },
  { provincia: 'Lunda Sul', peso: 1, municipios: { Saurimo: ['Centro'] } },
  { provincia: 'Zaire', peso: 1, municipios: { "M'Banza Kongo": ['Centro'] } },
  { provincia: 'Cunene', peso: 1, municipios: { Ondjiva: ['Centro'] } },
];
const LOCAIS_TOTAL = LOCAIS.reduce((n, l) => n + l.peso, 0);

function pickLocal(rng) {
  let x = rng() * LOCAIS_TOTAL;
  let loc = LOCAIS[0];
  for (const l of LOCAIS) {
    x -= l.peso;
    if (x < 0) { loc = l; break; }
  }
  const municipio = pick(rng, Object.keys(loc.municipios));
  return { provincia: loc.provincia, municipio, bairro: pick(rng, loc.municipios[municipio]) };
}

const OBS_POSITIVA = ['Aproveitamento satisfatório.', 'Bom desempenho na prova.', 'Participação activa nas aulas.', 'Evolução positiva face ao período anterior.', 'Cumpriu os objectivos do período.'];
const OBS_NEGATIVA = ['Necessita de apoio pedagógico.', 'Dificuldades nos conteúdos do período.', 'Recomenda-se acompanhamento do encarregado de educação.', 'Resultado abaixo do mínimo exigido.', 'Faltou a aulas de revisão.'];
const OBS_ESPECIAL = ['Prova realizada em 2ª chamada por falta justificada.', 'Avaliação com apoio de aulas de reforço.'];

// ---------- Datas do ano lectivo (Setembro a Julho) ----------

function dataLancamento(rng, anoLetivo, periodo) {
  // [ano offset, mês (1-12), dia mínimo, dia máximo]
  const mapa = {
    '1PP': [0, 10, 15, 25], '1PT': [0, 12, 1, 10],
    '2PP': [1, 2, 10, 20], '2PT': [1, 3, 15, 25],
    '3PP': [1, 5, 10, 20], '3PT': [1, 7, 1, 10],
  };
  const [off, mes, d0, d1] = mapa[periodo];
  const dia = d0 + Math.floor(rng() * (d1 - d0 + 1));
  const h = 8 + Math.floor(rng() * 10);
  const m = Math.floor(rng() * 60);
  const s = Math.floor(rng() * 60);
  return `${anoLetivo + off}-${pad(mes)}-${pad(dia)} ${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ---------- Aluno ----------

function criarAluno(seed, idx) {
  const rng = mulberry32(hash32(seed, 'aluno', idx));
  const grupo = pick(rng, GRUPOS);
  const sexo = rng() < 0.5 ? 'M' : 'F';
  const nome = `${pick(rng, sexo === 'M' ? NOMES_M : NOMES_F)} ${pick(rng, APELIDOS)} ${pick(rng, APELIDOS)}`;
  const anoLetivo = idx % 2 === 0 ? 2024 : 2025;
  const repetente = rng() < 0.08;
  const idade = 5 + grupo.serie + (repetente ? 1 : 0) + Math.floor(rng() * 2);
  const nascAno = anoLetivo - idade;
  const nascimento = `${nascAno}-${pad(1 + Math.floor(rng() * 12))}-${pad(1 + Math.floor(rng() * 28))}`;
  const letra = Math.floor(rng() * 3);
  const turmaId = grupo.serie * 100 + grupo.cursoIdx * 10 + letra + 1;
  const turno = grupo.serie >= 10 && letra === 2 ? 'noite' : (letra === 1 ? 'tarde' : 'manhã');
  // "nível" do aluno entre ~0.35 e ~0.9 da escala (soma de 3 uniformes ≈ gaussiana)
  const nivel = 0.62 + ((rng() + rng() + rng()) / 3 - 0.5) * 0.7;
  const disciplinas = disciplinasDaClasse(grupo.serie, grupo.curso).map((nome_) => ({
    nome: nome_,
    id: DISCIPLINA_ID[nome_],
    offset: (rng() - 0.5) * 0.2,
  }));
  return {
    idx,
    id: idx + 1,
    matriculaId: 500000 + idx + 1,
    nome,
    sexo,
    nascimento,
    serie: grupo.serie,
    curso: grupo.curso,
    turmaId,
    turno,
    anoLetivo,
    repetente,
    nivel,
    localizacao: pickLocal(rng),
    disciplinas,
  };
}

function linhaAluno(a) {
  return {
    id: a.id,
    nome: a.nome,
    sexo: a.sexo,
    data_nascimento: a.nascimento,
    nacionalidade: 'Angolana',
    serie_classe: a.serie,
    curso: a.curso,
    turma_id: a.turmaId,
    ano_letivo: a.anoLetivo,
  };
}

// ---------- Registo de nota ----------

function criarNota(seed, id, aluno, disc, periodo) {
  const rng = mulberry32(hash32(seed, 'nota', id));
  const escala = aluno.serie <= 6 ? 10 : 20;
  const minimo = aluno.serie <= 6 ? 5 : 10;
  const frac = aluno.nivel + disc.offset + (rng() + rng() - 1) * 0.16;
  let nota = Math.round(Math.max(0, Math.min(1, frac)) * escala * 2) / 2; // meios-valores
  nota = Math.max(0, Math.min(escala, nota));
  const situacao = nota >= minimo ? 'positiva' : 'negativa';
  const observacao = rng() < 0.06
    ? pick(rng, OBS_ESPECIAL)
    : pick(rng, situacao === 'positiva' ? OBS_POSITIVA : OBS_NEGATIVA);
  const professorId = 1000 + ((aluno.turmaId * 31 + disc.id * 17) % 60);

  let metadados = null;
  if (rng() < 0.75) {
    metadados = {
      lancado_por: rng() < 0.9 ? 'professor' : 'admin',
      turno: aluno.turno,
      repetente: aluno.repetente,
      apoio_pedagogico: situacao === 'negativa' && rng() < 0.5,
    };
  }

  return {
    id,
    aluno_id: aluno.id,
    matricula_id: aluno.matriculaId,
    turma_id: aluno.turmaId,
    disciplina_id: disc.id,
    professor_id: professorId,
    ano_letivo: aluno.anoLetivo,
    serie_classe: aluno.serie,
    periodo,
    data_lancamento: dataLancamento(rng, aluno.anoLetivo, periodo),
    disciplina: disc.nome,
    nota: nota.toFixed(2),
    escala_max: escala,
    nota_minima: minimo,
    situacao,
    observacao,
    localizacao: aluno.localizacao,
    metadados,
  };
}

/**
 * Gera n notas em lotes. Cada lote: { notas: [...], alunos: [...] } — `alunos` traz os alunos
 * que aparecem pela primeira vez nesse lote (para inserir antes das notas, respeitando a FK).
 */
function* generateBatches(n, seed = 42, batchSize = 5000) {
  if (batchSize < 1) throw new Error('batch_size deve ser >= 1');
  let id = 1;
  let alunoIdx = 0;
  let notas = [];
  let alunos = [];
  while (id <= n) {
    const aluno = criarAluno(seed, alunoIdx++);
    alunos.push(linhaAluno(aluno));
    for (const disc of aluno.disciplinas) {
      for (const periodo of PERIODOS) {
        if (id > n) break;
        notas.push(criarNota(seed, id, aluno, disc, periodo));
        id += 1;
        if (notas.length >= batchSize) {
          yield { notas, alunos };
          notas = [];
          alunos = [];
        }
      }
      if (id > n) break;
    }
  }
  if (notas.length || alunos.length) yield { notas, alunos };
}

module.exports = {
  CURSOS,
  DISCIPLINAS_CATALOGO,
  PROVINCIAS: LOCAIS.map((l) => l.provincia),
  generateBatches,
};