const db = require('../config/database');
const path = require('path');

// Aluno envia pedido de justificação para uma falta
const justificarFalta = async (req, res) => {
  const { falta_id, motivo } = req.body;
  if (!falta_id || !motivo) {
    return res.status(400).json({ message: 'Falta e motivo são obrigatórios.' });
  }
  try {
    // Verificar que a falta pertence ao aluno
    const [alunos] = await db.query('SELECT id FROM alunos WHERE usuario_id = ? LIMIT 1', [req.user.id]);
    if (alunos.length === 0) return res.status(404).json({ message: 'Aluno não encontrado.' });

    const [falta] = await db.query(
      `SELECT f.id, f.matricula_id, f.disciplina_id, f.data_falta, f.professor_id
       FROM faltas f
       JOIN matriculas m ON f.matricula_id = m.id
       WHERE f.id = ? AND m.aluno_id = ? LIMIT 1`,
      [falta_id, alunos[0].id]
    );
    if (falta.length === 0) return res.status(404).json({ message: 'Falta não encontrada.' });

    const documento_path = req.file ? req.file.filename : null;
    const documento_nome = req.file ? req.file.originalname : null;

    // Verificar se já existe pedido pendente para esta falta
    const [existe] = await db.query(
      'SELECT id FROM justificacoes_falta WHERE falta_id = ? AND status = "pendente" LIMIT 1',
      [falta_id]
    );
    if (existe.length > 0) {
      return res.status(409).json({ message: 'Já existe um pedido de justificação pendente para esta falta.' });
    }

    await db.query(
      `INSERT INTO justificacoes_falta (falta_id, aluno_id, motivo, documento_path, documento_nome, status)
       VALUES (?, ?, ?, ?, ?, 'pendente')`,
      [falta_id, alunos[0].id, motivo, documento_path, documento_nome]
    );

    // Notificar o professor (se houver)
    if (falta[0].professor_id) {
      await db.query(
        'INSERT INTO notificacoes (usuario_id, titulo, mensagem) VALUES (?,?,?)',
        [falta[0].professor_id, 'Pedido de Justificação', `Um aluno enviou um pedido de justificação para a falta de ${new Date(falta[0].data_falta).toLocaleDateString('pt-PT')}.`]
      );
    }

    return res.status(201).json({ message: 'Pedido de justificação enviado com sucesso.' });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ message: 'Tabela de justificações não existe. Execute a migração.' });
    }
    console.error('[justificarFalta]', err.message);
    return res.status(500).json({ message: err.message });
  }
};

// Professor vê pedidos de justificação das suas turmas
const listarPedidosJustificacao = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT j.id, j.motivo, j.status, j.documento_path, j.documento_nome, j.criado_em,
              j.decisao_motivo,
              f.data_falta, d.nome as disciplina,
              a.nome as aluno_nome
       FROM justificacoes_falta j
       JOIN faltas f ON j.falta_id = f.id
       JOIN disciplinas d ON f.disciplina_id = d.id
       JOIN alunos a ON j.aluno_id = a.id
       WHERE f.professor_id = ?
       ORDER BY j.criado_em DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    return res.status(500).json({ message: err.message });
  }
};

// Professor decide sobre justificação (aprovada / rejeitada)
const decidirJustificacao = async (req, res) => {
  const { id } = req.params;
  const { status, decisao_motivo } = req.body;
  if (!['aprovada', 'rejeitada'].includes(status)) {
    return res.status(400).json({ message: 'Status deve ser "aprovada" ou "rejeitada".' });
  }
  try {
    const [jrows] = await db.query(
      `SELECT j.id, j.falta_id, f.professor_id, j.aluno_id
       FROM justificacoes_falta j
       JOIN faltas f ON j.falta_id = f.id
       WHERE j.id = ? LIMIT 1`,
      [id]
    );
    if (jrows.length === 0) return res.status(404).json({ message: 'Justificação não encontrada.' });
    if (String(jrows[0].professor_id) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Não tem permissão para decidir esta justificação.' });
    }

    await db.query(
      'UPDATE justificacoes_falta SET status = ?, decisao_motivo = ? WHERE id = ?',
      [status, decisao_motivo || null, id]
    );

    // Se aprovada, atualizar o campo justificativa na falta
    if (status === 'aprovada') {
      await db.query(
        'UPDATE faltas SET justificativa = ? WHERE id = ?',
        [decisao_motivo || 'Justificada por documento', jrows[0].falta_id]
      );
    }

    // Notificar o aluno (via usuario_id)
    const [alunoUser] = await db.query(
      'SELECT usuario_id FROM alunos WHERE id = ? LIMIT 1',
      [jrows[0].aluno_id]
    );
    if (alunoUser.length > 0) {
      const msg = status === 'aprovada'
        ? 'A sua justificação de falta foi APROVADA pelo professor.'
        : `A sua justificação de falta foi REJEITADA. ${decisao_motivo || ''}`;
      await db.query(
        'INSERT INTO notificacoes (usuario_id, titulo, mensagem) VALUES (?,?,?)',
        [alunoUser[0].usuario_id, `Justificação ${status === 'aprovada' ? 'Aprovada' : 'Rejeitada'}`, msg]
      );
    }

    return res.json({ message: `Justificação ${status}.` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { justificarFalta, listarPedidosJustificacao, decidirJustificacao };
