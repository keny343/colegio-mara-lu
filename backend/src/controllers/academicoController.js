const db = require('../config/database');
const {
  normalizarDisciplinaNome,
  podeAcederNotas,
  podeAlterarNotasComoCoordenador,
  coordenadorPodeGerirTurma,
  disciplinaNoAmbitoCoordenador,
  turmaVisivelParaNotas,
  validarPeriodo,
  validarNota,
  PERIODOS_VALIDOS,
  limitesNota,
  normalizarPeriodoKey,
} = require('../utils/academicoRules');
const { ensureNotasPeriodosSchema } = require('../utils/ensureNotasSchema');

const professorLecionaDisciplina = async (professorId, turmaId, disciplinaId) => {
  const [rows] = await db.query(
    'SELECT id FROM turma_professores WHERE professor_id = ? AND turma_id = ? AND disciplina_id = ? LIMIT 1',
    [professorId, turmaId, disciplinaId]
  );
  return rows.length > 0;
};

const idsTurmasLecionadas = async (professorId) => {
  const [rows] = await db.query(
    'SELECT DISTINCT turma_id FROM turma_professores WHERE professor_id = ?',
    [professorId]
  );
  return new Set(rows.map((r) => Number(r.turma_id)));
};

const filtrarTurmasPorAcesso = async (user, turmas) => {
  if (!user || user.role === 'admin') return turmas;
  const lecionadas = await idsTurmasLecionadas(user.id);
  return turmas.filter((t) => turmaVisivelParaNotas(user, t, lecionadas));
};

const verificarAcessoTurmaStaff = async (user, turma) => {
  if (!user || !turma) return false;
  if (user.role === 'admin') return true;
  return coordenadorPodeGerirTurma(user, turma);
};

const handleDb = (res, err) => {
  if (err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(503).json({
      message: 'Tabelas académicas em falta. Execute: node backend/scripts/migrate-academico.js',
      detail: err.message,
    });
  }
  return res.status(500).json({ message: err.message || 'Erro no servidor.' });
};

// ===== CURSOS =====
const listarCursos = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM cursos WHERE ativo = 1 ORDER BY nome');
    return res.json(rows);
  } catch (err) { return handleDb(res, err); }
};

const criarCurso = async (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome) return res.status(400).json({ message: 'Nome do curso é obrigatório.' });
  const [r] = await db.query('INSERT INTO cursos (nome, descricao) VALUES (?,?)', [nome, descricao || null]);
  return res.status(201).json({ id: r.insertId, message: 'Curso criado.' });
};

const atualizarCurso = async (req, res) => {
  const { id } = req.params;
  const { nome, descricao, ativo } = req.body;
  const campos = {};
  if (nome !== undefined) campos.nome = nome;
  if (descricao !== undefined) campos.descricao = descricao;
  if (ativo !== undefined) campos.ativo = ativo ? 1 : 0;
  const keys = Object.keys(campos);
  if (keys.length === 0) return res.status(400).json({ message: 'Nada para atualizar.' });
  const sets = keys.map(k => `${k} = ?`).join(', ');
  await db.query(`UPDATE cursos SET ${sets} WHERE id = ?`, [...keys.map(k => campos[k]), id]);
  return res.json({ message: 'Curso atualizado.' });
};

const removerCurso = async (req, res) => {
  await db.query('UPDATE cursos SET ativo = 0 WHERE id = ?', [req.params.id]);
  return res.json({ message: 'Curso removido.' });
};

// ===== DISCIPLINAS =====
const listarDisciplinas = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.*, c.nome as curso_nome
       FROM disciplinas d
       LEFT JOIN cursos c ON d.curso_id = c.id
       WHERE d.ativo = 1
       ORDER BY (c.nome IS NULL), c.nome, d.nome`
    );
    return res.json(rows);
  } catch (err) { return handleDb(res, err); }
};

const criarDisciplina = async (req, res) => {
  try {
    const { nome, curso_id, serie_min, serie_max } = req.body;
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ message: 'Nome da disciplina é obrigatório.' });
    }
    let cursoNome = null;
    if (curso_id) {
      const [[c]] = await db.query('SELECT nome FROM cursos WHERE id = ? LIMIT 1', [curso_id]);
      cursoNome = c?.nome || null;
    }
    if (req.user.role !== 'admin') {
      const discCtx = {
        serie_min: serie_min != null ? Number(serie_min) : 0,
        serie_max: serie_max != null ? Number(serie_max) : 13,
      };
      if (!disciplinaNoAmbitoCoordenador(req.user, discCtx, cursoNome)) {
        return res.status(403).json({
          message: 'Só pode criar disciplinas para classes/cursos do seu âmbito de coordenação.',
        });
      }
    }
    const nomeNorm = normalizarDisciplinaNome(nome);
    const [dup] = await db.query(
      `SELECT id, nome FROM disciplinas WHERE ativo = 1 AND LOWER(TRIM(nome)) = LOWER(TRIM(?)) LIMIT 1`,
      [nome]
    );
    if (dup.length > 0) {
      return res.status(409).json({
        message: `Já existe uma disciplina com o nome "${dup[0].nome}".`,
      });
    }
    const [r] = await db.query(
      'INSERT INTO disciplinas (nome, curso_id, serie_min, serie_max) VALUES (?,?,?,?)',
      [String(nome).trim(), curso_id || null, serie_min || null, serie_max || null]
    );
    return res.status(201).json({ id: r.insertId, message: 'Disciplina criada.' });
  } catch (err) {
    return handleDb(res, err);
  }
};

const atualizarDisciplina = async (req, res) => {
  try {
  const { id } = req.params;
  const { nome, curso_id, serie_min, serie_max, ativo } = req.body;
  const campos = {};
  if (nome !== undefined) {
    const [dup] = await db.query(
    `SELECT id, nome FROM disciplinas WHERE ativo = 1 AND LOWER(TRIM(nome)) = LOWER(TRIM(?)) AND id != ? LIMIT 1`,
      [nome, id]
    );
    if (dup.length > 0) {
      return res.status(409).json({ message: `Já existe a disciplina "${dup[0].nome}".` });
    }
    campos.nome = String(nome).trim();
  }
  if (curso_id !== undefined) campos.curso_id = curso_id || null;
  if (serie_min !== undefined) campos.serie_min = serie_min || null;
  if (serie_max !== undefined) campos.serie_max = serie_max || null;
  if (ativo !== undefined) campos.ativo = ativo ? 1 : 0;
  const keys = Object.keys(campos);
  if (keys.length === 0) return res.status(400).json({ message: 'Nada para atualizar.' });
  const sets = keys.map(k => `${k} = ?`).join(', ');
  await db.query(`UPDATE disciplinas SET ${sets} WHERE id = ?`, [...keys.map(k => campos[k]), id]);
  return res.json({ message: 'Disciplina atualizada.' });
  } catch (err) {
    return handleDb(res, err);
  }
};

// ===== TURMAS =====
const listarTurmas = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, c.nome as curso_nome
       FROM turmas t
       LEFT JOIN cursos c ON t.curso_id = c.id
       WHERE t.ativo = 1
       ORDER BY t.ano_letivo DESC, t.serie_classe, t.nome`
    );
    const scope = req.query.scope;
    if (scope === 'coordenacao' || scope === 'notas') {
      if (!podeAcederNotas(req.user)) {
        return res.status(403).json({ message: 'Sem permissão para gerir notas.' });
      }
      const filtradas = await filtrarTurmasPorAcesso(req.user, rows);
      return res.json(filtradas);
    }
    const { temEscopoCoordenacao } = require('../utils/academicoRules');
    if (req.user.role !== 'admin' && temEscopoCoordenacao(req.user) && scope !== 'notas') {
      return res.json(rows.filter((t) => coordenadorPodeGerirTurma(req.user, t)));
    }
    return res.json(rows);
  } catch (err) { return handleDb(res, err); }
};

const atualizarTurma = async (req, res) => {
  const { id } = req.params;
  const { nome, turno, ano_letivo, serie_classe, curso_id } = req.body;
  if (!nome) return res.status(400).json({ message: 'Nome é obrigatório.' });
  try {
    const _turno = (turno || 'manhã').toString().toLowerCase();
    const turnoMap = _turno.startsWith('man') ? 'manhã' : _turno.startsWith('tar') ? 'tarde' : _turno.startsWith('noi') ? 'noite' : 'manhã';
    await db.query(
      'UPDATE turmas SET nome = ?, turno = ?, ano_letivo = ?, serie_classe = ?, curso_id = ? WHERE id = ?',
      [nome, turnoMap, ano_letivo || null, serie_classe || null, curso_id || null, id]
    );
    return res.json({ message: 'Turma actualizada.' });
  } catch (err) { return handleDb(res, err); }
};

const criarTurma = async (req, res) => {
  const { nome, ano_letivo, serie_classe, curso_id, turno } = req.body;
  if (!nome || !ano_letivo || !serie_classe) {
    return res.status(400).json({ message: 'Nome, ano letivo e classe são obrigatórios.' });
  }
  const serie = Number(serie_classe);
  if (!Number.isFinite(serie) || serie < 0) {
    return res.status(400).json({ message: 'Classe inválida.' });
  }
  if (serie >= 10 && !curso_id) {
    return res.status(400).json({ message: 'Da 10ª à 13ª classe, selecione um curso válido.' });
  }

  try {
    const _turno = (turno || 'manhã').toString().toLowerCase();
    const turnoMap = _turno.startsWith('man') ? 'manhã' : _turno.startsWith('tar') ? 'tarde' : _turno.startsWith('noi') ? 'noite' : 'manhã';
    const [r] = await db.query(
      'INSERT INTO turmas (nome, ano_letivo, serie_classe, curso_id, turno) VALUES (?,?,?,?,?)',
      [nome, ano_letivo, serie, curso_id || null, turnoMap]
    );
    return res.status(201).json({ id: r.insertId, message: 'Turma criada.' });
  } catch (err) {
    return handleDb(res, err);
  }
};

// ===== ATRIBUIR PROFESSOR (admin ou coordenador no âmbito) =====
const atribuirProfessor = async (req, res) => {
  const { turma_id, disciplina_id, professor_id } = req.body;
  if (!turma_id || !disciplina_id || !professor_id) {
    return res.status(400).json({ message: 'Turma, disciplina e professor são obrigatórios.' });
  }

  if (req.user.role !== 'admin') {
    const [[turmaCtx]] = await db.query(
      `SELECT t.*, c.nome as curso_nome FROM turmas t LEFT JOIN cursos c ON t.curso_id = c.id WHERE t.id = ?`,
      [turma_id]
    );
    if (!turmaCtx || !coordenadorPodeGerirTurma(req.user, turmaCtx)) {
      return res.status(403).json({ message: 'Só pode atribuir professores em turmas do seu ciclo ou curso.' });
    }
  }

  const [jaExiste] = await db.query(
    'SELECT id, professor_id FROM turma_professores WHERE turma_id = ? AND disciplina_id = ? LIMIT 1',
    [turma_id, disciplina_id]
  );
  if (jaExiste.length > 0) {
    if (String(jaExiste[0].professor_id) === String(professor_id)) {
      return res.status(400).json({ message: 'Este professor já está atribuído a esta disciplina nesta turma.' });
    }
    await db.query(
      'UPDATE turma_professores SET professor_id = ? WHERE turma_id = ? AND disciplina_id = ?',
      [professor_id, turma_id, disciplina_id]
    );
  } else {
    await db.query(
      'INSERT INTO turma_professores (turma_id, disciplina_id, professor_id) VALUES (?,?,?)',
      [turma_id, disciplina_id, professor_id]
    );
  }

  try {
    const [[disc]]  = await db.query('SELECT nome FROM disciplinas WHERE id = ? LIMIT 1', [disciplina_id]);
    const [[turma]] = await db.query('SELECT nome, serie_classe FROM turmas WHERE id = ? LIMIT 1', [turma_id]);
    const [[prof]]  = await db.query('SELECT id FROM usuarios WHERE id = ? LIMIT 1', [professor_id]);
    if (disc && turma && prof) {
      await db.query(
        `INSERT INTO notificacoes (usuario_id, titulo, mensagem, tipo) VALUES (?, ?, ?, ?)`,
        [professor_id, 'Nova atribuição', `Foi-lhe atribuída a disciplina "${disc.nome}" na turma ${turma.nome} (${turma.serie_classe}ª classe).`, 'atribuicao']
      );
    }
  } catch (_) { /* notificação opcional */ }

  return res.status(201).json({ message: 'Professor atribuído com sucesso.' });
};

// ===== PROFESSOR: as suas disciplinas/turmas =====
const minhasDisciplinas = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT tp.id as atribuicao_id, t.id as turma_id, t.nome as turma_nome, t.ano_letivo, t.serie_classe,
              d.id as disciplina_id, d.nome as disciplina_nome
       FROM turma_professores tp
       JOIN turmas t ON tp.turma_id = t.id
       JOIN disciplinas d ON tp.disciplina_id = d.id
       WHERE tp.professor_id = ?
       ORDER BY t.ano_letivo DESC, t.serie_classe, t.nome, d.nome`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    return res.status(500).json({ message: err.message });
  }
};

// ===== PROFESSOR: alunos da turma =====
const alunosDaTurma = async (req, res) => {
  try {
    const { turma_id } = req.params;
    if (req.user.role === 'professor' || req.user.role === 'coordenador') {
      const [[turma]] = await db.query(
        `SELECT t.*, c.nome as curso_nome FROM turmas t LEFT JOIN cursos c ON t.curso_id = c.id WHERE t.id = ?`,
        [turma_id]
      );
      const lecionadas = await idsTurmasLecionadas(req.user.id);
      const porCoord = turma && coordenadorPodeGerirTurma(req.user, turma);
      const porLecao = lecionadas.has(Number(turma_id));
      if (!porCoord && !porLecao) {
        return res.status(403).json({ message: 'Não tem acesso a esta turma.' });
      }
    }
    const [rows] = await db.query(
      `SELECT a.id, a.nome, a.data_nascimento, a.sexo, m.id as matricula_id, m.status as matricula_status
       FROM matriculas m
       JOIN alunos a ON m.aluno_id = a.id
       WHERE m.turma_id = ? AND m.status = 'ativa'
       ORDER BY a.nome`,
      [turma_id]
    );
    return res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    return res.status(500).json({ message: err.message });
  }
};

// ===== Notas: professor lança | coordenador altera no âmbito | admin tudo =====
const lancarNota = async (req, res) => {
  try {
    await ensureNotasPeriodosSchema();
    if (!podeAcederNotas(req.user)) {
      return res.status(403).json({ message: 'Sem permissão para gerir notas.' });
    }

    const autor_id = req.user.id;
    const { matricula_id, disciplina_id, periodo, nota } = req.body;
    if (!matricula_id || !disciplina_id || !periodo || nota === undefined) {
      return res.status(400).json({ message: 'Matrícula, disciplina, período e nota são obrigatórios.' });
    }
    if (!validarPeriodo(periodo)) {
      return res.status(400).json({ message: 'Período inválido. Use 1PP, 1PT, 2PP, 2PT, 3PP ou 3PT.' });
    }

    const [[ctx]] = await db.query(
      `SELECT m.id, t.serie_classe, t.id as turma_id, c.nome as curso_nome
       FROM matriculas m
       JOIN turmas t ON m.turma_id = t.id
       LEFT JOIN cursos c ON t.curso_id = c.id
       WHERE m.id = ? AND m.status = 'ativa' LIMIT 1`,
      [matricula_id]
    );
    if (!ctx) return res.status(404).json({ message: 'Matrícula não encontrada.' });

    const comoCoord = podeAlterarNotasComoCoordenador(req.user) && coordenadorPodeGerirTurma(req.user, ctx);
    const comoProfessor = await professorLecionaDisciplina(req.user.id, ctx.turma_id, disciplina_id);
    const isAdmin = req.user.role === 'admin';

    const [existing] = await db.query(
      'SELECT id FROM notas WHERE matricula_id = ? AND disciplina_id = ? AND periodo = ? LIMIT 1',
      [matricula_id, disciplina_id, periodo]
    );
    const jaExiste = existing.length > 0;

    if (jaExiste) {
      if (!isAdmin && !comoCoord) {
        return res.status(403).json({
          message: 'Apenas o coordenador do ciclo/curso (ou administrador) pode alterar notas já lançadas.',
        });
      }
    } else if (!isAdmin && !comoProfessor) {
      return res.status(403).json({
        message: 'Só os professores da disciplina podem lançar novas notas. O coordenador pode alterar notas já lançadas.',
      });
    }

    const validacao = validarNota(nota, ctx.serie_classe);
    if (!validacao.ok) return res.status(400).json({ message: validacao.message });

    if (!jaExiste) {
      await db.query(
        'INSERT INTO notas (matricula_id, disciplina_id, periodo, nota, professor_id) VALUES (?,?,?,?,?)',
        [matricula_id, disciplina_id, periodo, validacao.value, autor_id]
      );
    } else {
      await db.query(
        'UPDATE notas SET nota = ?, professor_id = ?, data_lancamento = CURRENT_TIMESTAMP WHERE id = ?',
        [validacao.value, autor_id, existing[0].id]
      );
    }

    const [[alunoInfo]] = await db.query(
      `SELECT a.usuario_id, d.nome AS disciplina_nome
       FROM matriculas m
       JOIN alunos a ON m.aluno_id = a.id
       JOIN disciplinas d ON d.id = ?
       WHERE m.id = ? LIMIT 1`,
      [disciplina_id, matricula_id]
    );
    if (alunoInfo && alunoInfo.usuario_id) {
      await db.query(
        'INSERT INTO notificacoes (usuario_id, titulo, mensagem, tipo) VALUES (?,?,?,?)',
        [
          alunoInfo.usuario_id,
          'Nota lançada',
          `A sua nota de ${alunoInfo.disciplina_nome} (${periodo}) foi lançada: ${validacao.value}.`,
          'nota_lancada',
        ]
      );
    }

    return res.json({
      message: 'Nota guardada.',
      limites: limitesNota(ctx.serie_classe),
      periodos: PERIODOS_VALIDOS,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ===== PROFESSOR: lançar falta =====
const lancarFalta = async (req, res) => {
  try {
    const professor_id = req.user.id;
    const { matricula_id, disciplina_id, data_falta, justificativa } = req.body;
    if (!matricula_id || !disciplina_id || !data_falta) {
      return res.status(400).json({ message: 'Matrícula, disciplina e data são obrigatórios.' });
    }
    if (req.user.role === 'professor') {
      const [ok] = await db.query(
        `SELECT tp.id FROM matriculas m
         JOIN turma_professores tp ON tp.turma_id = m.turma_id AND tp.disciplina_id = ?
         WHERE m.id = ? AND tp.professor_id = ?`,
        [disciplina_id, matricula_id, professor_id]
      );
      if (ok.length === 0) return res.status(403).json({ message: 'Não está atribuído a esta disciplina/turma.' });
    }
    const [existe] = await db.query(
      'SELECT id FROM faltas WHERE matricula_id = ? AND disciplina_id = ? AND data_falta = ? LIMIT 1',
      [matricula_id, disciplina_id, data_falta]
    );
    if (existe.length > 0) {
      await db.query('UPDATE faltas SET justificativa = ? WHERE id = ?', [justificativa || null, existe[0].id]);
    } else {
      await db.query(
        'INSERT INTO faltas (matricula_id, disciplina_id, data_falta, justificativa, professor_id) VALUES (?,?,?,?,?)',
        [matricula_id, disciplina_id, data_falta, justificativa || null, professor_id]
      );
    }
    return res.json({ message: 'Falta registada.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ===== STAFF: gerir horários =====
const listarTodosHorarios = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT h.id, h.turma_id, h.disciplina_id, h.dia_semana, h.hora_inicio, h.hora_fim, h.sala,
              d.nome as disciplina_nome, t.nome as turma_nome, t.serie_classe, c.nome as curso_nome, t.curso_id
       FROM horarios h
       JOIN disciplinas d ON h.disciplina_id = d.id
       JOIN turmas t ON h.turma_id = t.id
       LEFT JOIN cursos c ON t.curso_id = c.id
       WHERE t.ativo = 1
       ORDER BY
         CASE LOWER(TRIM(h.dia_semana))
           WHEN 'segunda' THEN 1 WHEN 'segunda-feira' THEN 1
           WHEN 'terca'   THEN 2 WHEN 'terça'  THEN 2 WHEN 'terca-feira' THEN 2 WHEN 'terça-feira' THEN 2
           WHEN 'quarta'  THEN 3 WHEN 'quarta-feira' THEN 3
           WHEN 'quinta'  THEN 4 WHEN 'quinta-feira' THEN 4
           WHEN 'sexta'   THEN 5 WHEN 'sexta-feira'  THEN 5
           WHEN 'sabado'  THEN 6 WHEN 'sábado' THEN 6
           ELSE 7
         END, h.hora_inicio, t.nome`
    );
    const { temEscopoCoordenacao } = require('../utils/academicoRules');
    if (req.user.role !== 'admin' && temEscopoCoordenacao(req.user)) {
      const filtrados = rows.filter((h) =>
        coordenadorPodeGerirTurma(req.user, { serie_classe: h.serie_classe, curso_nome: h.curso_nome })
      );
      return res.json(filtrados);
    }
    return res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    return res.status(500).json({ message: err.message });
  }
};

const listarHorariosTurma = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      const [[turma]] = await db.query(
        `SELECT t.*, c.nome as curso_nome FROM turmas t LEFT JOIN cursos c ON t.curso_id = c.id WHERE t.id = ?`,
        [req.params.turma_id]
      );
      if (!turma || !(await verificarAcessoTurmaStaff(req.user, turma))) {
        return res.status(403).json({ message: 'Turma fora da sua área de coordenação.' });
      }
    }
    const [rows] = await db.query(
      `SELECT h.id, h.dia_semana, h.hora_inicio, h.hora_fim, h.sala, d.nome as disciplina, d.id as disciplina_id
       FROM horarios h JOIN disciplinas d ON h.disciplina_id = d.id
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
      [req.params.turma_id]
    );
    return res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    return res.status(500).json({ message: err.message });
  }
};

const criarHorario = async (req, res) => {
  try {
    const { turma_id, disciplina_id, dia_semana, hora_inicio, hora_fim, sala } = req.body;
    if (!turma_id || !disciplina_id || !dia_semana || !hora_inicio || !hora_fim) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }
    const [r] = await db.query(
      'INSERT INTO horarios (turma_id, disciplina_id, dia_semana, hora_inicio, hora_fim, sala) VALUES (?,?,?,?,?,?)',
      [turma_id, disciplina_id, dia_semana, hora_inicio, hora_fim, sala || null]
    );
    return res.status(201).json({ id: r.insertId, message: 'Horário criado.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const removerHorario = async (req, res) => {
  try {
    await db.query('DELETE FROM horarios WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Horário removido.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ===== STAFF: alunos por turma =====
const alunosDaTurmaStaff = async (req, res) => {
  try {
    const turma_id = req.params.id || req.params.turma_id;
    if (req.user.role !== 'admin') {
      const [[turma]] = await db.query(
        `SELECT t.*, c.nome as curso_nome FROM turmas t LEFT JOIN cursos c ON t.curso_id = c.id WHERE t.id = ?`,
        [turma_id]
      );
      if (!turma || !(await verificarAcessoTurmaStaff(req.user, turma))) {
        return res.status(403).json({ message: 'Turma fora da sua área de coordenação.' });
      }
    }
    const [rows] = await db.query(
      `SELECT a.id as aluno_id, a.nome as aluno_nome, a.cpf, a.data_nascimento, a.sexo,
              m.id as matricula_id, m.status, m.data_matricula
       FROM matriculas m
       JOIN alunos a ON m.aluno_id = a.id
       WHERE m.turma_id = ? AND m.status = 'ativa'
       ORDER BY a.nome`,
      [turma_id]
    );
    return res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    return res.status(500).json({ message: err.message });
  }
};

// ===== STAFF: matrículas =====
const criarMatricula = async (req, res) => {
  try {
    const { aluno_id, turma_id, ano_letivo } = req.body;
    if (!aluno_id || !turma_id || !ano_letivo) {
      return res.status(400).json({ message: 'Aluno, turma e ano letivo são obrigatórios.' });
    }

    const [[turma]] = await db.query(
      `SELECT t.id, t.ano_letivo, t.ativo, t.serie_classe, t.curso_id, c.nome as curso_nome
       FROM turmas t LEFT JOIN cursos c ON t.curso_id = c.id WHERE t.id = ? LIMIT 1`,
      [turma_id]
    );
    if (!turma || !turma.ativo) {
      return res.status(400).json({ message: 'Turma não encontrada ou inativa.' });
    }
    if (req.user.role !== 'admin' && !coordenadorPodeGerirTurma(req.user, turma)) {
      return res.status(403).json({ message: 'Turma fora da sua área de coordenação.' });
    }

    const [[aluno]] = await db.query('SELECT id FROM alunos WHERE id = ? LIMIT 1', [aluno_id]);
    if (!aluno) return res.status(404).json({ message: 'Aluno não encontrado.' });

    const [existing] = await db.query(
      `SELECT id, turma_id FROM matriculas WHERE aluno_id = ? AND ano_letivo = ? AND status = 'ativa' LIMIT 1`,
      [aluno_id, ano_letivo]
    );

    const ajustarVagasSerie = async (serieClasse, anoLetivo, delta, cursoNome) => {
      if (serieClasse == null) return;
      let clause = 'ordem = ? AND ano_letivo = ? AND ativo = 1';
      const params = [serieClasse, anoLetivo];
      if (serieClasse >= 10 && cursoNome) {
        clause += ' AND curso = ?';
        params.push(cursoNome);
      }
      await db.query(
        `UPDATE series SET vagas_disponiveis = GREATEST(0, LEAST(vagas_total, vagas_disponiveis + ?)) WHERE ${clause}`,
        [delta, ...params]
      );
    };

    if (existing.length > 0) {
      const antigaId = existing[0].turma_id;
      await db.query('UPDATE matriculas SET turma_id = ? WHERE id = ?', [turma_id, existing[0].id]);
      if (Number(antigaId) !== Number(turma_id)) {
        const [[antiga]] = await db.query(
          `SELECT t.serie_classe, t.ano_letivo, c.nome as curso_nome FROM turmas t LEFT JOIN cursos c ON t.curso_id = c.id WHERE t.id = ?`,
          [antigaId]
        );
        if (antiga) await ajustarVagasSerie(antiga.serie_classe, antiga.ano_letivo, 1, antiga.curso_nome);
        await ajustarVagasSerie(turma.serie_classe, turma.ano_letivo, -1, turma.curso_nome);
      }
      return res.json({ message: 'Matrícula atualizada para a turma selecionada.', id: existing[0].id });
    }

    const [vagaCheck] = await db.query(
      `SELECT id, vagas_disponiveis FROM series WHERE ordem = ? AND ano_letivo = ? AND ativo = 1
       ${turma.serie_classe >= 10 && turma.curso_nome ? 'AND curso = ?' : ''} LIMIT 1`,
      turma.serie_classe >= 10 && turma.curso_nome
        ? [turma.serie_classe, ano_letivo, turma.curso_nome]
        : [turma.serie_classe, ano_letivo]
    );
    if (vagaCheck.length > 0 && vagaCheck[0].vagas_disponiveis <= 0) {
      return res.status(400).json({ message: 'Não há vagas disponíveis nesta classe/curso.' });
    }

    const [r] = await db.query(
      `INSERT INTO matriculas (aluno_id, turma_id, ano_letivo, status) VALUES (?,?,?,'ativa')`,
      [aluno_id, turma_id, ano_letivo]
    );
    await ajustarVagasSerie(turma.serie_classe, turma.ano_letivo, -1, turma.curso_nome);
    return res.status(201).json({ id: r.insertId, message: 'Aluno matriculado na turma com sucesso.' });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ message: 'Tabelas académicas em falta. Execute: node backend/scripts/migrate-academico.js' });
    }
    return res.status(500).json({ message: err.message });
  }
};

const listarAlunosParaMatricula = async (req, res) => {
  try {
    const { ano_letivo } = req.query;
    let where = `i.status = 'aprovada'
      AND NOT EXISTS (
        SELECT 1 FROM matriculas m WHERE m.aluno_id = a.id AND m.status = 'ativa'
      )`;
    const params = [];
    if (ano_letivo) { where += ' AND i.ano_letivo = ?'; params.push(ano_letivo); }

    const [rows] = await db.query(
      `SELECT DISTINCT a.id as aluno_id, a.nome as aluno_nome, a.cpf,
              i.id as inscricao_id, i.ano_letivo, s.nome as serie_nome
       FROM inscricoes i
       JOIN alunos a ON i.aluno_id = a.id
       JOIN series s ON i.serie_id = s.id
       WHERE ${where}
       ORDER BY a.nome`,
      params
    );
    return res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    return res.status(500).json({ message: err.message });
  }
};

// ===== STAFF: notas de turma/disciplina =====
const notasDaTurma = async (req, res) => {
  try {
    await ensureNotasPeriodosSchema();
    if (!podeAcederNotas(req.user)) {
      return res.status(403).json({ message: 'Sem permissão para consultar notas.' });
    }
    const turma_id = req.params.turma_id || req.params.id;
    const { disciplina_id } = req.params;
    const [[turma]] = await db.query(
      `SELECT t.*, c.nome as curso_nome FROM turmas t LEFT JOIN cursos c ON t.curso_id = c.id WHERE t.id = ?`,
      [turma_id]
    );
    if (!turma) return res.status(404).json({ message: 'Turma não encontrada.' });

    const lecionadas = await idsTurmasLecionadas(req.user.id);
    if (!turmaVisivelParaNotas(req.user, turma, lecionadas)) {
      return res.status(403).json({ message: 'Não tem acesso a notas desta turma.' });
    }
    if (req.user.role === 'professor') {
      const leciona = await professorLecionaDisciplina(req.user.id, turma_id, disciplina_id);
      if (!leciona && !coordenadorPodeGerirTurma(req.user, turma)) {
        return res.status(403).json({ message: 'Não leciona esta disciplina nesta turma.' });
      }
    }

    const [rows] = await db.query(
      `SELECT a.nome as aluno_nome, a.id as aluno_id, m.id as matricula_id,
              n.periodo, n.nota, n.data_lancamento
       FROM matriculas m
       JOIN alunos a ON m.aluno_id = a.id
       LEFT JOIN notas n ON n.matricula_id = m.id AND n.disciplina_id = ?
       WHERE m.turma_id = ? AND m.status = 'ativa'
       ORDER BY a.nome, FIELD(n.periodo,'1PP','1PT','2PP','2PT','3PP','3PT')`,
      [disciplina_id, turma_id]
    );

    const alunosMap = {};
    for (const r of rows) {
      if (!alunosMap[r.matricula_id]) {
        alunosMap[r.matricula_id] = {
          aluno_id: r.aluno_id,
          aluno_nome: r.aluno_nome,
          matricula_id: r.matricula_id,
          periodos: {},
        };
      }
      if (r.periodo) {
        alunosMap[r.matricula_id].periodos[normalizarPeriodoKey(r.periodo)] = r.nota;
      }
    }

    const podeAlterar = req.user.role === 'admin'
      || (podeAlterarNotasComoCoordenador(req.user) && coordenadorPodeGerirTurma(req.user, turma));

    return res.json({
      turma: { id: turma.id, nome: turma.nome, serie_classe: turma.serie_classe },
      limites: limitesNota(turma.serie_classe),
      periodos: PERIODOS_VALIDOS,
      alunos: Object.values(alunosMap),
      pode_alterar_como_coordenador: podeAlterar,
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ alunos: [], periodos: PERIODOS_VALIDOS });
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  listarCursos, criarCurso, atualizarCurso, removerCurso,
  listarDisciplinas, criarDisciplina, atualizarDisciplina,
  listarTurmas, criarTurma, atualizarTurma,
  atribuirProfessor,
  minhasDisciplinas,
  alunosDaTurma, lancarNota, lancarFalta,
  listarTodosHorarios, listarHorariosTurma, criarHorario, removerHorario,
  alunosDaTurmaStaff, notasDaTurma,
  criarMatricula, listarAlunosParaMatricula,
};