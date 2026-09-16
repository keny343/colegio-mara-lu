/**
 * Creates (or refreshes) the public demo: one account per role, plus enough
 * academic data for every screen to have something in it.
 *
 * The credentials are published in the README, so the demo is going to be poked
 * at and eventually broken. Re-running this script puts it back. It only ever
 * adds or updates its own records — nothing else in the database is touched,
 * which is why every write is keyed on a natural key and repeats are no-ops.
 *
 *   node scripts/seed-demo.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const SENHA = process.env.DEMO_SENHA || 'demo1234';
const TURMA = 'Demo 10A';
const SERIE_CLASSE = 10;

/**
 * The demo class is pinned to whichever school year it was first created in.
 * Without this, a re-run in January would build a second class in the new year
 * and the student portal — which follows the most recent enrolment — would show
 * the empty one.
 */
async function anoLetivoDaDemo(conn) {
  const [rows] = await conn.query(
    'SELECT ano_letivo FROM turmas WHERE nome = ? ORDER BY ano_letivo DESC LIMIT 1',
    [TURMA]
  );
  if (rows.length) return Number(rows[0].ano_letivo);
  return Number(process.env.DEMO_ANO_LETIVO || new Date().getFullYear());
}

/** Everything this script owns carries the tag, so a later cleanup can find it. */
const TAG = '[demo]';

const CONTAS = [
  { email: 'admin.demo@colegio.ao', nome: 'Ana Demo (Direcção)', role: 'admin' },
  {
    email: 'coordenador.demo@colegio.ao',
    nome: 'Carlos Demo (Coordenação)',
    role: 'coordenador',
    curso_coordenado: 'Informática',
    nivel_coordenado: 'II Ciclo (Ensino Secundário 10ª–13ª)',
  },
  { email: 'professor.demo@colegio.ao', nome: 'Paula Demo (Docente)', role: 'professor' },
  { email: 'aluno.demo@colegio.ao', nome: 'Joana Demo', role: 'aluno' },
];

const DISCIPLINAS = ['Matemática', 'Português', 'Física', 'Programação'];

/** A grade sheet that is neither perfect nor failing, so the averages mean something. */
const PAUTA = {
  Matemática: { '1PP': 14, '1PT': 13, '2PP': 15, '2PT': 16 },
  Português: { '1PP': 16, '1PT': 15, '2PP': 15, '2PT': 17 },
  Física: { '1PP': 11, '1PT': 9, '2PP': 12, '2PT': 12 },
  Programação: { '1PP': 18, '1PT': 17, '2PP': 19, '2PT': 18 },
};

const HORARIO = [
  ['segunda', '07:30:00', '09:00:00', 'Sala 12', 'Matemática'],
  ['segunda', '09:15:00', '10:45:00', 'Sala 12', 'Português'],
  ['terca', '07:30:00', '09:00:00', 'Lab 2', 'Programação'],
  ['quarta', '07:30:00', '09:00:00', 'Sala 12', 'Física'],
  ['quinta', '09:15:00', '10:45:00', 'Lab 2', 'Programação'],
  ['sexta', '07:30:00', '09:00:00', 'Sala 12', 'Matemática'],
];

const FALTAS = [
  ['Física', 14, 'Consulta médica com justificação entregue'],
  ['Física', 21, null],
  ['Matemática', 28, null],
];

function diaDoMes(dia) {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${hoje.getFullYear()}-${mes}-${String(dia).padStart(2, '0')}`;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const ANO = await anoLetivoDaDemo(conn);
  const resumo = [];
  const senhaHash = await bcrypt.hash(SENHA, 12);

  // ---- Accounts -----------------------------------------------------------
  const utilizadores = {};
  for (const conta of CONTAS) {
    const [existente] = await conn.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [
      conta.email,
    ]);
    if (existente.length) {
      // The password is reset on every run: it is public, and someone may have changed it.
      await conn.query(
        'UPDATE usuarios SET nome = ?, senha = ?, role = ?, ativo = 1, curso_coordenado = ?, nivel_coordenado = ? WHERE id = ?',
        [
          conta.nome,
          senhaHash,
          conta.role,
          conta.curso_coordenado || null,
          conta.nivel_coordenado || null,
          existente[0].id,
        ]
      );
      utilizadores[conta.role] = existente[0].id;
      resumo.push(`conta ${conta.role}: reposta (id ${existente[0].id})`);
    } else {
      const [r] = await conn.query(
        'INSERT INTO usuarios (nome, email, senha, role, ativo, curso_coordenado, nivel_coordenado) VALUES (?, ?, ?, ?, 1, ?, ?)',
        [
          conta.nome,
          conta.email,
          senhaHash,
          conta.role,
          conta.curso_coordenado || null,
          conta.nivel_coordenado || null,
        ]
      );
      utilizadores[conta.role] = r.insertId;
      resumo.push(`conta ${conta.role}: criada (id ${r.insertId})`);
    }
  }

  // ---- Course, subjects, class -------------------------------------------
  const [cursoRows] = await conn.query('SELECT id FROM cursos WHERE nome = ? LIMIT 1', [
    'Informática',
  ]);
  let cursoId = cursoRows[0]?.id;
  if (!cursoId) {
    const [r] = await conn.query('INSERT INTO cursos (nome, descricao, ativo) VALUES (?, ?, 1)', [
      'Informática',
      `${TAG} Curso do II ciclo`,
    ]);
    cursoId = r.insertId;
  }

  const disciplinaIds = {};
  for (const nome of DISCIPLINAS) {
    const [rows] = await conn.query('SELECT id FROM disciplinas WHERE nome = ? LIMIT 1', [nome]);
    if (rows.length) {
      disciplinaIds[nome] = rows[0].id;
    } else {
      const [r] = await conn.query(
        'INSERT INTO disciplinas (nome, curso_id, serie_min, serie_max, ativo) VALUES (?, ?, 10, 13, 1)',
        [nome, cursoId]
      );
      disciplinaIds[nome] = r.insertId;
    }
  }
  resumo.push(`disciplinas: ${DISCIPLINAS.join(', ')}`);

  const [turmaRows] = await conn.query(
    'SELECT id FROM turmas WHERE nome = ? AND ano_letivo = ? LIMIT 1',
    [TURMA, ANO]
  );
  let turmaId = turmaRows[0]?.id;
  if (!turmaId) {
    const [r] = await conn.query(
      'INSERT INTO turmas (nome, ano_letivo, serie_classe, curso_id, turno, ativo) VALUES (?, ?, ?, ?, ?, 1)',
      [TURMA, ANO, SERIE_CLASSE, cursoId, 'manha']
    );
    turmaId = r.insertId;
  }
  resumo.push(`turma: ${TURMA} (${ANO}, id ${turmaId})`);

  // ---- Who teaches what --------------------------------------------------
  for (const nome of DISCIPLINAS) {
    const [rows] = await conn.query(
      'SELECT id FROM turma_professores WHERE turma_id = ? AND disciplina_id = ? LIMIT 1',
      [turmaId, disciplinaIds[nome]]
    );
    if (!rows.length) {
      await conn.query(
        'INSERT INTO turma_professores (turma_id, disciplina_id, professor_id) VALUES (?, ?, ?)',
        [turmaId, disciplinaIds[nome], utilizadores.professor]
      );
    } else {
      await conn.query('UPDATE turma_professores SET professor_id = ? WHERE id = ?', [
        utilizadores.professor,
        rows[0].id,
      ]);
    }
  }

  // ---- Timetable ---------------------------------------------------------
  for (const [dia, inicio, fim, sala, disciplina] of HORARIO) {
    const [rows] = await conn.query(
      'SELECT id FROM horarios WHERE turma_id = ? AND disciplina_id = ? AND dia_semana = ? AND hora_inicio = ? LIMIT 1',
      [turmaId, disciplinaIds[disciplina], dia, inicio]
    );
    if (!rows.length) {
      await conn.query(
        'INSERT INTO horarios (turma_id, disciplina_id, dia_semana, hora_inicio, hora_fim, sala) VALUES (?, ?, ?, ?, ?, ?)',
        [turmaId, disciplinaIds[disciplina], dia, inicio, fim, sala]
      );
    }
  }
  resumo.push(`horário: ${HORARIO.length} aulas`);

  // ---- The demo student, enrolled ---------------------------------------
  const [alunoRows] = await conn.query('SELECT id FROM alunos WHERE usuario_id = ? LIMIT 1', [
    utilizadores.aluno,
  ]);
  let alunoId = alunoRows[0]?.id;
  if (!alunoId) {
    const [r] = await conn.query(
      `INSERT INTO alunos (usuario_id, nome, data_nascimento, sexo, nacionalidade, nome_mae, nome_pai, responsavel, telefone_emergencia)
       VALUES (?, ?, ?, 'F', 'Angolana', ?, ?, ?, ?)`,
      [
        utilizadores.aluno,
        'Joana Demo',
        '2009-04-12',
        'Maria Demo',
        'José Demo',
        'Maria Demo',
        '+244 900 000 000',
      ]
    );
    alunoId = r.insertId;
  }

  const [matriculaRows] = await conn.query(
    'SELECT id FROM matriculas WHERE aluno_id = ? AND turma_id = ? AND ano_letivo = ? LIMIT 1',
    [alunoId, turmaId, ANO]
  );
  let matriculaId = matriculaRows[0]?.id;
  if (!matriculaId) {
    const [r] = await conn.query(
      "INSERT INTO matriculas (aluno_id, turma_id, ano_letivo, status) VALUES (?, ?, ?, 'ativa')",
      [alunoId, turmaId, ANO]
    );
    matriculaId = r.insertId;
  } else {
    await conn.query("UPDATE matriculas SET status = 'ativa' WHERE id = ?", [matriculaId]);
  }
  resumo.push(`aluno: Joana Demo matriculada (matrícula ${matriculaId})`);

  // ---- Grades and absences ----------------------------------------------
  let notasEscritas = 0;
  for (const [disciplina, periodos] of Object.entries(PAUTA)) {
    for (const [periodo, nota] of Object.entries(periodos)) {
      const [rows] = await conn.query(
        'SELECT id FROM notas WHERE matricula_id = ? AND disciplina_id = ? AND periodo = ? LIMIT 1',
        [matriculaId, disciplinaIds[disciplina], periodo]
      );
      if (rows.length) {
        await conn.query('UPDATE notas SET nota = ?, professor_id = ? WHERE id = ?', [
          nota,
          utilizadores.professor,
          rows[0].id,
        ]);
      } else {
        await conn.query(
          'INSERT INTO notas (matricula_id, disciplina_id, periodo, nota, professor_id) VALUES (?, ?, ?, ?, ?)',
          [matriculaId, disciplinaIds[disciplina], periodo, nota, utilizadores.professor]
        );
      }
      notasEscritas += 1;
    }
  }
  resumo.push(`notas: ${notasEscritas} lançamentos em ${Object.keys(PAUTA).length} disciplinas`);

  for (const [disciplina, dia, justificativa] of FALTAS) {
    const data = diaDoMes(dia);
    const [rows] = await conn.query(
      'SELECT id FROM faltas WHERE matricula_id = ? AND disciplina_id = ? AND data_falta = ? LIMIT 1',
      [matriculaId, disciplinaIds[disciplina], data]
    );
    if (!rows.length) {
      await conn.query(
        'INSERT INTO faltas (matricula_id, disciplina_id, data_falta, justificativa, professor_id) VALUES (?, ?, ?, ?, ?)',
        [matriculaId, disciplinaIds[disciplina], data, justificativa, utilizadores.professor]
      );
    }
  }
  resumo.push(`faltas: ${FALTAS.length}`);

  // Course material is deliberately not seeded. A row in materiais_didaticos
  // needs a caminho pointing at a file in Supabase storage, and a listing with a
  // dead download link reads worse than an empty one. Upload one by hand as the
  // professor if that screen needs to be shown.

  // ---- A pending application, so the review workflow has something to show
  const [serieRows] = await conn.query(
    'SELECT id FROM series WHERE nome LIKE ? ORDER BY ano_letivo DESC LIMIT 1',
    ['10%']
  );
  const serieId = serieRows[0]?.id;
  if (serieId) {
    const [candidatoRows] = await conn.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [
      'candidato.demo@colegio.ao',
    ]);
    let candidatoId = candidatoRows[0]?.id;
    if (!candidatoId) {
      const [r] = await conn.query(
        'INSERT INTO usuarios (nome, email, senha, role, ativo) VALUES (?, ?, ?, ?, 0)',
        ['Pedro Demo (candidato)', 'candidato.demo@colegio.ao', senhaHash, 'aluno']
      );
      candidatoId = r.insertId;
    }

    const [candAlunoRows] = await conn.query('SELECT id FROM alunos WHERE usuario_id = ? LIMIT 1', [
      candidatoId,
    ]);
    let candAlunoId = candAlunoRows[0]?.id;
    if (!candAlunoId) {
      const [r] = await conn.query(
        `INSERT INTO alunos (usuario_id, nome, data_nascimento, sexo, nacionalidade, responsavel, telefone_emergencia)
         VALUES (?, ?, ?, 'M', 'Angolana', ?, ?)`,
        [candidatoId, 'Pedro Demo', '2010-08-03', 'Ana Demo', '+244 900 000 001']
      );
      candAlunoId = r.insertId;
    }

    const [inscricaoRows] = await conn.query(
      'SELECT id, status FROM inscricoes WHERE aluno_id = ? ORDER BY id DESC LIMIT 1',
      [candAlunoId]
    );
    if (!inscricaoRows.length) {
      await conn.query(
        "INSERT INTO inscricoes (usuario_id, aluno_id, serie_id, ano_letivo, status) VALUES (?, ?, ?, ?, 'pendente')",
        [candidatoId, candAlunoId, serieId, ANO]
      );
      resumo.push('inscrição pendente: criada (Pedro Demo)');
    } else {
      // Someone reviewing the demo may have approved it; put it back to pending.
      await conn.query(
        "UPDATE inscricoes SET status = 'pendente', observacao_admin = NULL, motivo_rejeicao = NULL WHERE id = ?",
        [inscricaoRows[0].id]
      );
      resumo.push(`inscrição pendente: reposta (era '${inscricaoRows[0].status}')`);
    }
  } else {
    resumo.push('inscrição pendente: ignorada, nenhuma série da 10.ª classe encontrada');
  }

  // ---- One notification, so the bell is not empty ------------------------
  const [notifRows] = await conn.query(
    'SELECT id FROM notificacoes WHERE usuario_id = ? AND titulo = ? LIMIT 1',
    [utilizadores.aluno, 'Pauta do 2.º período disponível']
  );
  if (!notifRows.length) {
    await conn.query(
      'INSERT INTO notificacoes (usuario_id, remetente_id, titulo, mensagem, tipo) VALUES (?, ?, ?, ?, ?)',
      [
        utilizadores.aluno,
        utilizadores.professor,
        'Pauta do 2.º período disponível',
        'As notas do 2.º período já estão lançadas. Consulta as tuas notas no portal.',
        'mensagem',
      ]
    );
  }

  await conn.end();

  console.log('Demonstração pronta:\n');
  for (const linha of resumo) console.log(`  - ${linha}`);
  console.log(`\nEntrar com qualquer destas contas, senha "${SENHA}":`);
  for (const c of CONTAS) console.log(`  ${c.role.padEnd(12)} ${c.email}`);
}

main().catch((err) => {
  console.error('Semeadura falhou:', err.message);
  process.exit(1);
});
