const db = require('../config/database');
const { PERIODOS_VALIDOS } = require('../utils/academicoRules');
const { ensureNotasPeriodosSchema } = require('../utils/ensureNotasSchema');
const NotasService = require('../domain/NotasService');

// CORRIGIDO: inclui dados da inscrição (série, encarregado, etc.)
const minhaMatricula = async (req, res) => {
  try {
    const usuario_id = req.user.id;
    const [alunos] = await db.query(
      'SELECT * FROM alunos WHERE usuario_id = ? LIMIT 1',
      [usuario_id]
    );
    if (alunos.length === 0) return res.json({ matricula: null, aluno: null, inscricao: null });
    const aluno = alunos[0];

    const [matriculas] = await db.query(
      `SELECT m.id, m.ano_letivo, m.status, m.data_matricula,
              t.id as turma_id, t.nome as turma_nome, t.serie_classe, t.turno,
              c.nome as curso_nome
       FROM matriculas m
       JOIN turmas t ON m.turma_id = t.id
       LEFT JOIN cursos c ON t.curso_id = c.id
       WHERE m.aluno_id = ? AND m.status = 'ativa'
       ORDER BY m.ano_letivo DESC LIMIT 1`,
      [aluno.id]
    );

    // Buscar dados da inscrição mais recente (aprovada ou pendente)
    const [inscricaoRows] = await db.query(
      `SELECT i.id as inscricao_id, i.ano_letivo as inscricao_ano, i.status as inscricao_status,
              i.data_inscricao, i.observacao_admin, i.motivo_rejeicao,
              s.nome as serie_nome, s.nivel, s.curso
       FROM inscricoes i
       JOIN series s ON i.serie_id = s.id
       WHERE i.aluno_id = ?
       ORDER BY i.data_inscricao DESC LIMIT 1`,
      [aluno.id]
    );

    const inscricao = inscricaoRows.length > 0 ? inscricaoRows[0] : null;

    return res.json({
      aluno,
      matricula: matriculas.length > 0 ? matriculas[0] : null,
      inscricao,
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ matricula: null, aluno: null, inscricao: null });
    return res.status(500).json({ message: err.message });
  }
};

const minhasDisciplinasAluno = async (req, res) => {
  try {
    const [alunos] = await db.query(
      'SELECT id FROM alunos WHERE usuario_id = ? LIMIT 1',
      [req.user.id]
    );
    if (alunos.length === 0) return res.json([]);
    const [matriculas] = await db.query(
      `SELECT m.id as matricula_id, m.turma_id FROM matriculas m
       WHERE m.aluno_id = ? AND m.status = 'ativa'
       ORDER BY m.ano_letivo DESC LIMIT 1`,
      [alunos[0].id]
    );
    if (matriculas.length === 0) return res.json([]);
    const turma_id = matriculas[0].turma_id;
    const [rows] = await db.query(
      `SELECT DISTINCT d.id, d.nome as disciplina, u.nome as professor
       FROM (
         SELECT disciplina_id FROM turma_professores WHERE turma_id = ?
         UNION
         SELECT disciplina_id FROM horarios WHERE turma_id = ?
       ) disc_ids
       JOIN disciplinas d ON d.id = disc_ids.disciplina_id
       LEFT JOIN turma_professores tp ON tp.turma_id = ? AND tp.disciplina_id = d.id
       LEFT JOIN usuarios u ON tp.professor_id = u.id
       ORDER BY d.nome`,
      [turma_id, turma_id, turma_id]
    );
    return res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    return res.status(500).json({ message: err.message });
  }
};

const meusHorarios = async (req, res) => {
  try {
    const [alunos] = await db.query(
      'SELECT id FROM alunos WHERE usuario_id = ? LIMIT 1',
      [req.user.id]
    );
    if (alunos.length === 0) return res.json([]);
    const [matriculas] = await db.query(
      `SELECT m.turma_id FROM matriculas m
       WHERE m.aluno_id = ? AND m.status = 'ativa'
       ORDER BY m.ano_letivo DESC LIMIT 1`,
      [alunos[0].id]
    );
    if (matriculas.length === 0) return res.json([]);
    const [rows] = await db.query(
      `SELECT h.id, h.dia_semana, h.hora_inicio, h.hora_fim, h.sala, d.nome as disciplina
       FROM horarios h
       JOIN disciplinas d ON h.disciplina_id = d.id
       WHERE h.turma_id = ?
       ORDER BY
         CASE LOWER(TRIM(h.dia_semana))
           WHEN 'segunda' THEN 1 WHEN 'segunda-feira' THEN 1
           WHEN 'terca'   THEN 2 WHEN 'terça'  THEN 2 WHEN 'terca-feira' THEN 2 WHEN 'terça-feira' THEN 2
           WHEN 'quarta'  THEN 3 WHEN 'quarta-feira' THEN 3
           WHEN 'quinta'  THEN 4 WHEN 'quinta-feira' THEN 4
           WHEN 'sexta'   THEN 5 WHEN 'sexta-feira'  THEN 5
           WHEN 'sabado'  THEN 6 WHEN 'sábado' THEN 6
           ELSE 7
         END, h.hora_inicio`,
      [matriculas[0].turma_id]
    );
    return res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    return res.status(500).json({ message: err.message });
  }
};

const minhasNotas = async (req, res) => {
  try {
    await ensureNotasPeriodosSchema();
    const [alunos] = await db.query(
      'SELECT id FROM alunos WHERE usuario_id = ? LIMIT 1',
      [req.user.id]
    );
    if (alunos.length === 0) return res.json({ notas: [], periodos: PERIODOS_VALIDOS });
    const [matriculas] = await db.query(
      `SELECT m.id as matricula_id, t.serie_classe FROM matriculas m
       JOIN turmas t ON m.turma_id = t.id
       WHERE m.aluno_id = ? AND m.status = 'ativa'
       ORDER BY m.ano_letivo DESC LIMIT 1`,
      [alunos[0].id]
    );
    if (matriculas.length === 0) return res.json({ notas: [], periodos: PERIODOS_VALIDOS });
    const serieClasse = matriculas[0].serie_classe;
    const [rows] = await db.query(
      `SELECT d.nome as disciplina, n.periodo, n.nota
       FROM notas n JOIN disciplinas d ON n.disciplina_id = d.id
       WHERE n.matricula_id = ?
       ORDER BY d.nome, FIELD(n.periodo,'1PP','1PT','2PP','2PT','3PP','3PT')`,
      [matriculas[0].matricula_id]
    );
    return res.json(NotasService.respostaPortal(rows, serieClasse));
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ notas: [], periodos: PERIODOS_VALIDOS });
    return res.status(500).json({ message: err.message });
  }
};

const minhasFaltas = async (req, res) => {
  try {
    const [alunos] = await db.query(
      'SELECT id FROM alunos WHERE usuario_id = ? LIMIT 1',
      [req.user.id]
    );
    if (alunos.length === 0) return res.json([]);
    const [matriculas] = await db.query(
      `SELECT m.id as matricula_id FROM matriculas m
       WHERE m.aluno_id = ? AND m.status = 'ativa'
       ORDER BY m.ano_letivo DESC LIMIT 1`,
      [alunos[0].id]
    );
    if (matriculas.length === 0) return res.json([]);
    const [rows] = await db.query(
      `SELECT f.id, f.data_falta, f.justificativa, d.nome as disciplina
       FROM faltas f JOIN disciplinas d ON f.disciplina_id = d.id
       WHERE f.matricula_id = ?
       ORDER BY f.data_falta DESC`,
      [matriculas[0].matricula_id]
    );
    return res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { minhaMatricula, minhasDisciplinasAluno, meusHorarios, minhasNotas, minhasFaltas };