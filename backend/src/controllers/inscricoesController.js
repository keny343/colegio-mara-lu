const db = require('../config/database');
const { filtroSqlSeriesCoordenador, inscricaoNoAmbitoCoordenador, temEscopoCoordenacao } = require('../utils/academicoRules');

// --- ROTAS DO USUÁRIO ---

// Listar inscrições do usuário
const minhasInscricoes = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT i.*, a.nome as aluno_nome, a.data_nascimento, s.nome as serie_nome, s.nivel
      FROM inscricoes i
      JOIN alunos a ON i.aluno_id = a.id
      JOIN series s ON i.serie_id = s.id
      WHERE i.usuario_id = ?
      ORDER BY i.data_inscricao DESC
    `, [req.user.id]);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao buscar inscrições.' });
  }
};

// Criar nova inscrição
const criarInscricao = async (req, res) => {
  const { aluno_id, serie_id, ano_letivo } = req.body;

  if (!aluno_id || !serie_id || !ano_letivo) {
    return res.status(400).json({ message: 'Aluno, série e ano letivo são obrigatórios.' });
  }

  try {
    const [aluno] = await db.query('SELECT id FROM alunos WHERE id = ? AND usuario_id = ?', [aluno_id, req.user.id]);
    if (aluno.length === 0) return res.status(403).json({ message: 'Aluno não encontrado.' });

    const [dupla] = await db.query(
      'SELECT id FROM inscricoes WHERE aluno_id = ? AND serie_id = ? AND ano_letivo = ? AND status != "cancelada"',
      [aluno_id, serie_id, ano_letivo]
    );
    if (dupla.length > 0) return res.status(409).json({ message: 'Já existe uma inscrição para este aluno nesta série.' });

    const [serie] = await db.query('SELECT vagas_disponiveis FROM series WHERE id = ?', [serie_id]);
    if (serie.length === 0 || serie[0].vagas_disponiveis <= 0) {
      return res.status(400).json({ message: 'Não há vagas disponíveis nesta série.' });
    }

    const [result] = await db.query(
      'INSERT INTO inscricoes (usuario_id, aluno_id, serie_id, ano_letivo) VALUES (?,?,?,?)',
      [req.user.id, aluno_id, serie_id, ano_letivo]
    );

    await db.query(
      'INSERT INTO notificacoes (usuario_id, titulo, mensagem) VALUES (?,?,?)',
      [req.user.id, 'Inscrição Recebida', 'Sua inscrição foi recebida e está sendo analisada pela equipe do colégio.']
    );

    return res.status(201).json({ message: 'Inscrição realizada com sucesso!', id: result.insertId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erro ao criar inscrição.' });
  }
};

// Cancelar inscrição
const cancelarInscricao = async (req, res) => {
  const { id } = req.params;
  try {
    const [check] = await db.query(
      'SELECT id, status FROM inscricoes WHERE id = ? AND usuario_id = ?', [id, req.user.id]
    );
    if (check.length === 0) return res.status(404).json({ message: 'Inscrição não encontrada.' });
    if (['aprovada', 'cancelada'].includes(check[0].status)) {
      return res.status(400).json({ message: 'Não é possível cancelar esta inscrição.' });
    }
    await db.query('UPDATE inscricoes SET status = "cancelada" WHERE id = ?', [id]);
    return res.json({ message: 'Inscrição cancelada.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao cancelar inscrição.' });
  }
};

// --- ROTAS DO ADMIN + COORDENADOR ---

// Listar todas as inscrições
const listarTodas = async (req, res) => {
  const { status, ano_letivo, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];

  if (status)     { where += ' AND i.status = ?';     params.push(status); }
  if (ano_letivo) { where += ' AND i.ano_letivo = ?';  params.push(ano_letivo); }

  if (req.user.role === 'coordenador' || (req.user.role === 'professor' && temEscopoCoordenacao(req.user))) {
    const filtro = filtroSqlSeriesCoordenador(req.user);
    where += ` AND (${filtro.clause})`;
    params.push(...filtro.params);
  }

  const baseFrom = `
    FROM inscricoes i
    JOIN alunos a   ON i.aluno_id  = a.id
    JOIN series s   ON i.serie_id  = s.id
    JOIN usuarios u ON i.usuario_id = u.id
  `;

  try {
    // CORRIGIDO: inclui encarregado_nome e telefone_emergencia da tabela alunos
    // + matrícula ACTUAL do aluno (turma/classe/curso reais), não só a série pedida na inscrição —
    // essencial para reflectir transferências entre cursos/turmas depois da aprovação.
    const [rows] = await db.query(`
      SELECT i.*, a.nome as aluno_nome, a.data_nascimento, a.cpf as aluno_cpf,
             a.responsavel as encarregado_nome, a.telefone_emergencia,
             s.nome as serie_nome, s.nivel, s.curso, s.ordem,
             u.nome as responsavel_nome, u.email as responsavel_email, u.telefone as responsavel_telefone,
             m.id as matricula_id, t.nome as matricula_turma_nome,
             t.serie_classe as matricula_serie_classe, mc.nome as matricula_curso_nome
      ${baseFrom}
      LEFT JOIN matriculas m ON m.aluno_id = a.id AND m.ano_letivo = i.ano_letivo AND m.status = 'ativa'
      LEFT JOIN turmas t ON m.turma_id = t.id
      LEFT JOIN cursos mc ON t.curso_id = mc.id
      WHERE ${where}
      ORDER BY i.data_inscricao DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    const [total] = await db.query(
      `SELECT COUNT(*) as total ${baseFrom} WHERE ${where}`,
      params
    );

    return res.json({ data: rows, total: total[0].total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[listarTodas] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar inscrições.' });
  }
};

// Detalhes de uma inscrição
const detalhesInscricao = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(`
      SELECT i.*, a.*, s.nome as serie_nome, s.nivel, s.curso, s.ordem,
             u.nome as responsavel_nome, u.email as responsavel_email, u.telefone as responsavel_telefone,
             u.cpf as responsavel_cpf, u.endereco as responsavel_endereco
      FROM inscricoes i
      JOIN alunos a   ON i.aluno_id  = a.id
      JOIN series s   ON i.serie_id  = s.id
      JOIN usuarios u ON i.usuario_id = u.id
      WHERE i.id = ?
    `, [id]);

    if (rows.length === 0) return res.status(404).json({ message: 'Inscrição não encontrada.' });

    if (req.user.role === 'coordenador' || (req.user.role === 'professor' && temEscopoCoordenacao(req.user))) {
      if (!inscricaoNoAmbitoCoordenador(req.user, rows[0])) {
        return res.status(403).json({ message: 'Inscrição fora do seu âmbito de coordenação.' });
      }
    }

    const [docs] = await db.query('SELECT * FROM documentos WHERE inscricao_id = ?', [id]);
    return res.json({ ...rows[0], documentos: docs });
  } catch (err) {
    console.error('[detalhesInscricao] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar inscrição.' });
  }
};

// Atualizar status da inscrição
const atualizarStatus = async (req, res) => {
  const { id } = req.params;
  const { status, observacao_admin, motivo_rejeicao, turma_id } = req.body;

  const statusValidos = ['pendente', 'em_analise', 'aprovada', 'rejeitada', 'cancelada'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ message: 'Status inválido.' });
  }

  try {
    const [inscricao] = await db.query(`
      SELECT i.*, u.id as uid, s.curso, s.nivel
      FROM inscricoes i
      JOIN usuarios u ON i.usuario_id = u.id
      JOIN series s   ON i.serie_id   = s.id
      WHERE i.id = ?
    `, [id]);

    if (inscricao.length === 0) return res.status(404).json({ message: 'Inscrição não encontrada.' });

    if (req.user.role === 'coordenador' || (req.user.role === 'professor' && temEscopoCoordenacao(req.user))) {
      if (!inscricaoNoAmbitoCoordenador(req.user, inscricao[0])) {
        return res.status(403).json({ message: 'Inscrição fora do seu âmbito de coordenação.' });
      }
    }

    await db.query(
      'UPDATE inscricoes SET status = ?, observacao_admin = ?, motivo_rejeicao = ? WHERE id = ?',
      [status, observacao_admin || null, motivo_rejeicao || null, id]
    );

    if (status === 'aprovada') {
      await db.query('UPDATE usuarios SET ativo = 1 WHERE id = ?', [inscricao[0].uid]);
      await db.query('UPDATE series SET vagas_disponiveis = vagas_disponiveis - 1 WHERE id = ? AND vagas_disponiveis > 0', [inscricao[0].serie_id]);

      if (turma_id) {
        const aluno_id = inscricao[0].aluno_id;
        const ano_letivo = inscricao[0].ano_letivo;
        const [matExistente] = await db.query(
          `SELECT id FROM matriculas WHERE aluno_id = ? AND ano_letivo = ? AND status = 'ativa' LIMIT 1`,
          [aluno_id, ano_letivo]
        );
        if (matExistente.length > 0) {
          await db.query('UPDATE matriculas SET turma_id = ? WHERE id = ?', [turma_id, matExistente[0].id]);
        } else {
          await db.query(
            `INSERT INTO matriculas (aluno_id, turma_id, ano_letivo, status) VALUES (?,?,?,'ativa')`,
            [aluno_id, turma_id, ano_letivo]
          );
        }
      }
    } else if (status === 'cancelada' || status === 'rejeitada') {
      if (inscricao[0].status === 'aprovada') {
        await db.query('UPDATE series SET vagas_disponiveis = vagas_disponiveis + 1 WHERE id = ?', [inscricao[0].serie_id]);
      }
    }

    const mensagens = {
      aprovada:   'Parabéns! Sua inscrição foi APROVADA. Entre em contacto com o colégio para finalizar a matrícula.',
      rejeitada:  `Sua inscrição foi rejeitada. Motivo: ${motivo_rejeicao || 'Não especificado.'}`,
      em_analise: 'Sua inscrição está sendo analisada pela equipe administrativa.',
      cancelada:  'Sua inscrição foi cancelada.'
    };

    if (mensagens[status]) {
      await db.query(
        'INSERT INTO notificacoes (usuario_id, titulo, mensagem) VALUES (?,?,?)',
        [inscricao[0].uid, `Inscrição ${status.charAt(0).toUpperCase() + status.slice(1)}`, mensagens[status]]
      );
    }

    return res.json({ message: 'Status atualizado com sucesso!' });
  } catch (err) {
    console.error('[atualizarStatus] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao atualizar status.' });
  }
};

// Dashboard stats (admin + coordenador)
const dashboardStats = async (req, res) => {
  try {
    // CORRIGIDO: COALESCE garante que valores null viram 0
    const [stats] = await db.query(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(status = 'pendente'), 0)    as pendentes,
        COALESCE(SUM(status = 'em_analise'), 0)  as em_analise,
        COALESCE(SUM(status = 'aprovada'), 0)    as aprovadas,
        COALESCE(SUM(status = 'rejeitada'), 0)   as rejeitadas,
        COALESCE(SUM(status = 'cancelada'), 0)   as canceladas
      FROM inscricoes
    `);

    const filtro = filtroSqlSeriesCoordenador(req.user);
    const [porSerie] = await db.query(`
      SELECT s.id, s.nome, s.nivel, s.ordem, s.curso, s.ano_letivo,
             COALESCE(COUNT(i.id), 0) as total_inscricoes,
             COALESCE(SUM(i.status = 'aprovada'), 0) as aprovadas,
             s.vagas_total, s.vagas_disponiveis,
             (SELECT COUNT(DISTINCT m.id) FROM matriculas m
              JOIN turmas t ON m.turma_id = t.id
              LEFT JOIN cursos c ON t.curso_id = c.id
              WHERE m.status = 'ativa' AND m.ano_letivo = s.ano_letivo AND t.serie_classe = s.ordem
              AND (s.ordem < 10 OR s.curso IS NULL OR c.nome = s.curso)) as matriculados
      FROM series s
      LEFT JOIN inscricoes i ON s.id = i.serie_id
      WHERE ${filtro.clause}
      GROUP BY s.id
      ORDER BY s.ordem, s.nivel, s.nome
    `, filtro.params);

    const [totalUsuarios] = await db.query("SELECT COUNT(*) as total FROM usuarios WHERE role = 'aluno'");
const [totalAlunos]   = await db.query('SELECT COUNT(*) as total FROM alunos');

    return res.json({
      inscricoes:      stats[0],
      por_serie:       porSerie,
      total_usuarios:  totalUsuarios[0].total,
      total_alunos:    totalAlunos[0].total
    });
  } catch (err) {
    console.error('[dashboardStats] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar estatísticas.' });
  }
};

module.exports = { minhasInscricoes, criarInscricao, cancelarInscricao, listarTodas, detalhesInscricao, atualizarStatus, dashboardStats };