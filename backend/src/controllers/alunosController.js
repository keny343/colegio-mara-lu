const db = require('../config/database');

// Listar alunos do usuário logado
const listarAlunos = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM alunos WHERE usuario_id = ? ORDER BY nome',
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao buscar alunos.' });
  }
};

// Criar aluno
const criarAluno = async (req, res) => {
  const { nome, data_nascimento, cpf, rg, sexo, nacionalidade, nome_mae, nome_pai, responsavel, telefone_emergencia, necessidades_especiais } = req.body;

  if (!nome || !data_nascimento) {
    return res.status(400).json({ message: 'Nome e data de nascimento são obrigatórios.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO alunos (usuario_id, nome, data_nascimento, cpf, rg, sexo, nacionalidade, nome_mae, nome_pai, responsavel, telefone_emergencia, necessidades_especiais)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, nome, data_nascimento, cpf||null, rg||null, sexo||null, nacionalidade||null, nome_mae||null, nome_pai||null, responsavel||null, telefone_emergencia||null, necessidades_especiais||null]
    );
    return res.status(201).json({ message: 'Aluno cadastrado com sucesso!', id: result.insertId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erro ao cadastrar aluno.' });
  }
};

// Atualizar aluno
const atualizarAluno = async (req, res) => {
  const { id } = req.params;
  const campos = req.body;

  try {
    const [check] = await db.query('SELECT id FROM alunos WHERE id = ? AND usuario_id = ?', [id, req.user.id]);
    if (check.length === 0) return res.status(404).json({ message: 'Aluno não encontrado.' });

    const sets = Object.keys(campos).map(k => `${k} = ?`).join(', ');
    await db.query(`UPDATE alunos SET ${sets} WHERE id = ?`, [...Object.values(campos), id]);

    return res.json({ message: 'Aluno atualizado com sucesso!' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao atualizar aluno.' });
  }
};

// Remover aluno
const removerAluno = async (req, res) => {
  const { id } = req.params;
  try {
    const [check] = await db.query('SELECT id FROM alunos WHERE id = ? AND usuario_id = ?', [id, req.user.id]);
    if (check.length === 0) return res.status(404).json({ message: 'Aluno não encontrado.' });

    await db.query('DELETE FROM alunos WHERE id = ?', [id]);
    return res.json({ message: 'Aluno removido.' });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao remover aluno.' });
  }
};

module.exports = { listarAlunos, criarAluno, atualizarAluno, removerAluno };
