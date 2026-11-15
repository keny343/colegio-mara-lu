'use strict';

/**
 * Geração determinística de alunos e respectivas notas para o sistema escolar angolano.
 * Um registo representa um aluno; as notas são armazenadas no campo `notas`.
 * As turmas, disciplinas, cursos e professores são recebidos do catálogo real da BD.
 */

const PERIODOS = ['1PP', '1PT', '2PP', '2PT', '3PP', '3PT'];

const NOMES = [
  'Adriano', 'Afonso', 'Alda', 'Alberto', 'Amélia', 'Ana', 'André', 'António',
  'Bento', 'Bruna', 'Carlos', 'Carolina', 'Catarina', 'Celso', 'Dário', 'Domingos',
  'Edson', 'Elisa', 'Emília', 'Ernesto', 'Fábio', 'Felicidade', 'Fernando', 'Filomena',
  'Francisco', 'Gerson', 'Helena', 'Hélder', 'Inês', 'Isaac', 'Joana', 'João',
  'Joaquim', 'José', 'Júlia', 'Laura', 'Lázaro', 'Lídia', 'Manuel', 'Mário',
  'Mateus', 'Miguel', 'Mónica', 'Nelson', 'Paulo', 'Pedro', 'Rafael', 'Rosa',
  'Sérgio', 'Teresa', 'Tomás', 'Vera', 'Vicente', 'Zenaida', 'Zuleica',
];

const APELIDOS = [
  'Afonso', 'Almeida', 'André', 'António', 'Baptista', 'Bunga', 'Cabral',
  'Cassule', 'Domingos', 'Fernandes', 'Francisco', 'Gomes', 'Jamba', 'João',
  'José', 'Kapapelo', 'Kiala', 'Lopes', 'Manuel', 'Mateus', 'Mendes', 'Miguel',
  'Neto', 'Pereira', 'Quiala', 'Santos', 'Tavares', 'Zau', 'Zulu',
];

const PROGENITORES = [
  'Ana', 'Antónia', 'Benvinda', 'Cecília', 'Domingas', 'Eugénia', 'Fátima',
  'Isabel', 'Joana', 'Joaquina', 'Maria', 'Rosa', 'Teresa', 'Adão', 'António',
  'Bento', 'Domingos', 'Fernando', 'Joaquim', 'José', 'Manuel', 'Mateus', 'Paulo',
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

function pick(rng, values) {
  return values[Math.floor(rng() * values.length)];
}

function integer(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function makeDateOfBirth(rng, serieClasse, anoLetivo) {
  const age = Math.max(4, Number(serieClasse) + 5 + integer(rng, 0, 1));
  const year = Number(anoLetivo) - age;
  const month = integer(rng, 1, 12);
  const day = integer(rng, 1, 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function makePhone(rng) {
  const prefix = pick(rng, ['91', '92', '93', '94', '95', '99']);
  let rest = '';
  for (let i = 0; i < 7; i += 1) rest += integer(rng, 0, 9);
  return `+244 ${prefix} ${rest.slice(0, 3)} ${rest.slice(3)}`;
}

function makeName(rng) {
  return `${pick(rng, NOMES)} ${pick(rng, APELIDOS)} ${pick(rng, APELIDOS)}`;
}

function makeGrade(rng, serieClasse) {
  const max = Number(serieClasse) >= 1 && Number(serieClasse) <= 6 ? 10 : 20;
  const minimum = max === 10 ? 5 : 10;
  // Distribuição sintética com maioria positiva e uma fracção de notas negativas.
  const value = rng() < 0.76
    ? minimum + rng() * (max - minimum)
    : rng() * (minimum - 0.1);
  return Number(Math.min(max, Math.max(0, value)).toFixed(2));
}

function makeNotes(rng, turma) {
  const notes = [];
  for (const disciplina of turma.disciplinas) {
    const periodos = {};
    for (const periodo of PERIODOS) {
      const nota = makeGrade(rng, turma.serie_classe);
      periodos[periodo] = nota;
      notes.push({
        disciplina_id: Number(disciplina.disciplina_id),
        disciplina: disciplina.disciplina_nome,
        periodo,
        nota,
        professor_id: disciplina.professor_id == null ? null : Number(disciplina.professor_id),
      });
    }

    if (turma.exame_nacional || turma.defesa_final) {
      const periodoFinal = turma.exame_nacional ? 'EXN' : 'DEF';
      notes.push({
        disciplina_id: Number(disciplina.disciplina_id),
        disciplina: disciplina.disciplina_nome,
        periodo: periodoFinal,
        nota: makeGrade(rng, turma.serie_classe),
        professor_id: disciplina.professor_id == null ? null : Number(disciplina.professor_id),
      });
    }
  }
  return notes;
}

function makeRecord(rng, id, turma, runId) {
  const nome = makeName(rng);
  const sexo = rng() < 0.5 ? 'M' : 'F';
  const nomeMae = makeName(rng);
  const nomePai = makeName(rng);
  const email = `lab.${runId}.${id}@aluno.colegiomaralu.local`;
  return {
    id,
    nome,
    email,
    role: 'aluno',
    ativo: 0,
    data_nascimento: makeDateOfBirth(rng, turma.serie_classe, turma.ano_letivo),
    sexo,
    nacionalidade: 'Angolana',
    nome_mae: nomeMae,
    nome_pai: nomePai,
    responsavel: rng() < 0.7 ? nomeMae : nomePai,
    telefone_emergencia: makePhone(rng),
    turma_id: Number(turma.turma_id),
    turma_nome: turma.turma_nome,
    curso_id: turma.curso_id == null ? null : Number(turma.curso_id),
    curso_nome: turma.curso_nome || '',
    serie_classe: Number(turma.serie_classe),
    ano_letivo: Number(turma.ano_letivo),
    turno: turma.turno || 'manha',
    notas: makeNotes(rng, turma),
  };
}

function* generateBatches(n, seed = 42, batchSize = 2000, catalog = [], runId = 'run_0', startId = 1) {
  if (!Number.isInteger(Number(batchSize)) || Number(batchSize) < 1) {
    throw new Error('batch_size deve ser >= 1');
  }
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw Object.assign(new Error('Não existem turmas activas com disciplinas disponíveis na base de dados.'), { status: 409 });
  }
  const rng = mulberry32(Number(seed) >>> 0);
  let batch = [];
  for (let i = 0; i < n; i += 1) {
    const turma = pick(rng, catalog);
    batch.push(makeRecord(rng, startId + i, turma, runId));
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length) yield batch;
}

module.exports = {
  PERIODOS,
  generateBatches,
  SCHEMA_FIELDS: [
    'id', 'nome', 'email', 'role', 'ativo', 'data_nascimento', 'sexo',
    'nacionalidade', 'nome_mae', 'nome_pai', 'responsavel',
    'telefone_emergencia', 'turma_id', 'turma_nome', 'curso_id',
    'curso_nome', 'serie_classe', 'ano_letivo', 'turno', 'notas',
  ],
};
