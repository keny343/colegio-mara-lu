const db = require('../config/database');
const { podeDesignarCoordenador, tipoDesignacaoNoAmbito, coordenadorPodeGerirTurma, filtroSqlSeriesCoordenador } = require('../utils/academicoRules');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// --- SÉRIES ---
const listarSeries = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM series WHERE ativo = 1 ORDER BY ordem, nivel, nome');
    return res.json(rows);
  } catch (err) {
    console.error('listarSeries:', err.message);
    return res.status(500).json({ message: err.message || 'Erro ao buscar séries.' });
  }
};

const criarSerie = async (req, res) => {
  const { nome, nivel, vagas_total, ano_letivo } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO series (nome, nivel, vagas_total, vagas_disponiveis, ano_letivo) VALUES (?,?,?,?,?)',
      [nome, nivel, vagas_total, vagas_total, ano_letivo]
    );
    return res.status(201).json({ message: 'Série criada!', id: result.insertId });
  } catch (err) {
    console.error('[criarSerie] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao criar série.', detail: err.message });
  }
};

const atualizarSerie = async (req, res) => {
  const { id } = req.params;
  const campos = req.body;
  try {
    const sets = Object.keys(campos).map(k => `${k} = ?`).join(', ');
    await db.query(`UPDATE series SET ${sets} WHERE id = ?`, [...Object.values(campos), id]);
    return res.json({ message: 'Série atualizada!' });
  } catch (err) {
    console.error('[atualizarSerie] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao atualizar série.', detail: err.message });
  }
};

const deletarSerie = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE series SET ativo = 0 WHERE id = ?', [id]);
    return res.json({ message: 'Série desativada.' });
  } catch (err) {
    console.error('[deletarSerie] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao deletar série.', detail: err.message });
  }
};

// --- DOCUMENTOS ---
const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const enviarDocumento = async (req, res) => {
  const { inscricao_id, tipo } = req.body;
  if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado.' });

  try {
    await db.query(
      'INSERT INTO documentos (inscricao_id, tipo, nome_arquivo, caminho_arquivo) VALUES (?,?,?,?)',
      [inscricao_id, tipo, req.file.originalname, req.file.filename]
    );
    return res.status(201).json({ message: 'Documento enviado com sucesso!' });
  } catch (err) {
    console.error('[enviarDocumento] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao salvar documento.', detail: err.message });
  }
};

const atualizarDocumento = async (req, res) => {
  const { id } = req.params;
  const { status, observacao } = req.body;
  try {
    await db.query('UPDATE documentos SET status = ?, observacao = ? WHERE id = ?', [status, observacao || null, id]);
    return res.json({ message: 'Documento atualizado.' });
  } catch (err) {
    console.error('[atualizarDocumento] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao atualizar documento.', detail: err.message });
  }
};

// --- UTILIZADORES ---

// Listar todos os utilizadores (admin)
const listarUsuarios = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, nome, email, telefone, cpf, role,
              curso_coordenado, nivel_coordenado, ativo, criado_em
       FROM usuarios
       ORDER BY nome`
    );
    return res.json(rows);
  } catch (err) {
    console.error('listarUsuarios:', err.message);
    return res.status(500).json({ message: err.message || 'Erro ao buscar usuários.' });
  }
};

// Equipa do coordenador: professores atribuídos às turmas do seu âmbito
const listarEquipaCoordenador = async (req, res) => {
  if (req.user.role === 'admin') {
    return listarUsuarios(req, res);
  }
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT u.id, u.nome, u.email, u.telefone, u.cpf, u.role, u.ativo,
              u.curso_coordenado, u.nivel_coordenado, u.criado_em,
              t.serie_classe, c.nome as curso_nome
       FROM usuarios u
       INNER JOIN turma_professores tp ON tp.professor_id = u.id
       INNER JOIN turmas t ON t.id = tp.turma_id AND t.ativo = 1
       LEFT JOIN cursos c ON t.curso_id = c.id
       WHERE u.role IN ('professor', 'coordenador') AND u.ativo = 1
       ORDER BY u.nome`
    );
    const vistos = new Set();
    const equipa = [];
    for (const r of rows) {
      if (!coordenadorPodeGerirTurma(req.user, { serie_classe: r.serie_classe, curso_nome: r.curso_nome })) continue;
      if (vistos.has(r.id)) continue;
      vistos.add(r.id);
      const { serie_classe, curso_nome, ...user } = r;
      equipa.push(user);
    }
    return res.json(equipa);
  } catch (err) {
    console.error('listarEquipaCoordenador:', err.message);
    return res.status(500).json({ message: err.message || 'Erro ao buscar equipa.' });
  }
};

// Recalcular vagas_disponiveis com base em matrículas activas
const sincronizarVagasSeries = async (req, res) => {
  try {
    const [series] = await db.query('SELECT id, ordem, ano_letivo, curso, vagas_total FROM series WHERE ativo = 1');
    let atualizadas = 0;
    for (const s of series) {
      let sql = `SELECT COUNT(DISTINCT m.id) as ocupadas
        FROM matriculas m
        JOIN turmas t ON m.turma_id = t.id
        WHERE m.status = 'ativa' AND m.ano_letivo = ? AND t.serie_classe = ?`;
      const params = [s.ano_letivo, s.ordem];
      if (s.ordem >= 10 && s.curso) {
        sql += ' AND EXISTS (SELECT 1 FROM cursos c WHERE c.id = t.curso_id AND c.nome = ?)';
        params.push(s.curso);
      }
      const [[row]] = await db.query(sql, params);
      const ocupadas = Number(row?.ocupadas || 0);
      const disp = Math.max(0, Number(s.vagas_total) - ocupadas);
      await db.query('UPDATE series SET vagas_disponiveis = ? WHERE id = ?', [disp, s.id]);
      atualizadas++;
    }
    return res.json({ message: `Vagas sincronizadas em ${atualizadas} classe(s).`, atualizadas });
  } catch (err) {
    console.error('sincronizarVagasSeries:', err.message);
    return res.status(500).json({ message: err.message || 'Erro ao sincronizar vagas.' });
  }
};

// Criar utilizador (professor / coordenador / admin)
const criarUsuario = async (req, res) => {
  const { nome, bi, email, telefone, role, curso_coordenado, nivel_coordenado } = req.body;

  if (!nome || !bi || !role) {
    return res.status(400).json({ message: 'Nome, BI e perfil são obrigatórios.' });
  }
  if (!['admin', 'professor'].includes(role)) {
    return res.status(400).json({ message: 'Perfil inválido. Coordenadores são designados pelo administrador.' });
  }

  const biLimpo    = String(bi).trim();
  const emailFinal = (email && String(email).trim()) || `${biLimpo}@staff.local`;

  try {
    const [dupBi] = await db.query('SELECT id FROM usuarios WHERE cpf = ? LIMIT 1', [biLimpo]);
    if (dupBi.length > 0) return res.status(409).json({ message: 'Já existe um usuário com este BI.' });

    const [dupEmail] = await db.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [emailFinal]);
    if (dupEmail.length > 0) return res.status(409).json({ message: 'E-mail já está em uso.' });

    const hash = await bcrypt.hash(biLimpo, 10);
    const [r] = await db.query(
      `INSERT INTO usuarios
         (nome, email, senha, telefone, cpf, role, curso_coordenado, nivel_coordenado, ativo)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        nome,
        emailFinal,
        hash,
        telefone || null,
        biLimpo,
        role,
        curso_coordenado || null,
        nivel_coordenado || null,
        1
      ]
    );
    return res.status(201).json({ id: r.insertId, message: 'Usuário criado.' });
  } catch (err) {
    console.error('[criarUsuario] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao criar usuário.' });
  }
};

// Actualizar utilizador
const atualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const { nome, email, telefone, role, ativo, curso_coordenado, nivel_coordenado } = req.body;

  const campos = {};
  if (nome             !== undefined) campos.nome             = nome;
  if (email            !== undefined) campos.email            = email;
  if (telefone         !== undefined) campos.telefone         = telefone;
  if (role             !== undefined) campos.role             = role;
  if (ativo            !== undefined) campos.ativo            = ativo ? 1 : 0;
  if (curso_coordenado !== undefined || nivel_coordenado !== undefined) {
    return res.status(400).json({ message: 'Coordenação só pode ser alterada em "Designar coordenador".' });
  }

  const keys = Object.keys(campos);
  if (keys.length === 0) return res.status(400).json({ message: 'Nada para atualizar.' });

  try {
    if (campos.role) {
      if (!['admin', 'professor', 'aluno'].includes(campos.role)) {
        return res.status(400).json({ message: 'Use "Designar coordenador" para atribuir função de coordenação.' });
      }
      if (campos.role !== 'coordenador') {
        campos.curso_coordenado = null;
        campos.nivel_coordenado = null;
      }
    }
    if (campos.role === 'coordenador') {
      return res.status(400).json({ message: 'Coordenadores só podem ser designados pelo administrador.' });
    }
    const sets = keys.map(k => `${k} = ?`).join(', ');
    await db.query(`UPDATE usuarios SET ${sets} WHERE id = ?`, [...keys.map(k => campos[k]), id]);
    return res.json({ message: 'Usuário atualizado.' });
  } catch (err) {
    console.error('[atualizarUsuario] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao atualizar usuário.' });
  }
};

// Designar / remover coordenador (admin: tudo; coordenador: só no seu ciclo/curso)
const designarCoordenador = async (req, res) => {
  const { id } = req.params;
  const { tipo, curso_id, curso_nome, manter_role_professor } = req.body;

  if (!podeDesignarCoordenador(req.user)) {
    return res.status(403).json({ message: 'Sem permissão para designar coordenadores.' });
  }

  const tiposValidos = ['1_ciclo', '2_ciclo', 'curso', 'remover'];
  if (!tiposValidos.includes(tipo)) {
    return res.status(400).json({ message: 'Tipo inválido. Use: 1_ciclo, 2_ciclo, curso ou remover.' });
  }

  if (req.user.role !== 'admin' && tipo === 'remover') {
    return res.status(403).json({ message: 'Apenas o administrador pode remover coordenação.' });
  }

  try {
    const [[user]] = await db.query(
      'SELECT id, role, nome FROM usuarios WHERE id = ? LIMIT 1',
      [id]
    );
    if (!user) return res.status(404).json({ message: 'Utilizador não encontrado.' });
    if (!['professor', 'coordenador'].includes(user.role)) {
      return res.status(400).json({ message: 'Só professores ou coordenadores podem ser designados.' });
    }

    if (tipo === 'remover') {
      const novaRole = user.role === 'coordenador' ? 'professor' : user.role;
      await db.query(
        'UPDATE usuarios SET role = ?, curso_coordenado = NULL, nivel_coordenado = NULL WHERE id = ?',
        [novaRole === 'coordenador' ? 'professor' : novaRole, id]
      );
      return res.json({ message: 'Coordenação removida.' });
    }

    let nivel_coordenado = null;
    let curso_coordenado = null;
    let role = user.role;
    let cursoNomeDesignado = null;

    if (tipo === '1_ciclo') {
      nivel_coordenado = '1º ciclo';
    } else if (tipo === '2_ciclo') {
      nivel_coordenado = '2º ciclo';
    } else if (tipo === 'curso') {
      if (curso_id) {
        const [[c]] = await db.query('SELECT nome FROM cursos WHERE id = ? AND ativo = 1', [curso_id]);
        if (!c) return res.status(400).json({ message: 'Curso não encontrado.' });
        curso_coordenado = c.nome;
        cursoNomeDesignado = c.nome;
      } else if (curso_nome) {
        curso_coordenado = String(curso_nome).trim();
        cursoNomeDesignado = curso_coordenado;
      } else {
        return res.status(400).json({ message: 'Indique o curso a coordenar.' });
      }
    }

    if (!tipoDesignacaoNoAmbito(req.user, tipo, cursoNomeDesignado)) {
      return res.status(403).json({
        message: 'Só pode designar coordenadores no mesmo ciclo ou curso que coordena.',
      });
    }

    if (manter_role_professor && user.role === 'professor') {
      role = 'professor';
    } else {
      role = 'coordenador';
    }

    await db.query(
      'UPDATE usuarios SET role = ?, curso_coordenado = ?, nivel_coordenado = ? WHERE id = ?',
      [role, curso_coordenado, nivel_coordenado, id]
    );

    return res.json({
      message: 'Coordenador designado com sucesso.',
      role,
      curso_coordenado,
      nivel_coordenado,
    });
  } catch (err) {
    console.error('[designarCoordenador]', err.message);
    return res.status(500).json({ message: 'Erro ao designar coordenador.' });
  }
};

// Notificações do utilizador
const minhasNotificacoes = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT n.id, n.titulo, n.mensagem, n.tipo, n.lida, n.criado_em,
              u.nome AS remetente_nome, u.role AS remetente_role
       FROM notificacoes n
       LEFT JOIN usuarios u ON n.remetente_id = u.id
       WHERE n.usuario_id = ?
       ORDER BY n.criado_em DESC
       LIMIT 50`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[minhasNotificacoes] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar notificações.', detail: err.message });
  }
};

const marcarNotificacaoLida = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT usuario_id FROM notificacoes WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Notificação não encontrada.' });
    if (rows[0].usuario_id !== req.user.id) return res.status(403).json({ message: 'Não tem permissão para actualizar esta notificação.' });
    await db.query('UPDATE notificacoes SET lida = 1 WHERE id = ?', [id]);
    return res.json({ message: 'Notificação marcada como lida.' });
  } catch (err) {
    console.error('[marcarNotificacaoLida] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao atualizar notificação.' });
  }
};

const enviarNotificacao = async (req, res) => {
  const { titulo, mensagem, alvo, turma_id } = req.body;
  if (!titulo || !mensagem || !alvo) {
    return res.status(400).json({ message: 'Título, mensagem e alvo são obrigatórios.' });
  }

  try {
    let destinatarios = [];
    if (req.user.role === 'admin') {
      if (alvo === 'todos') {
        const [rows] = await db.query('SELECT id FROM usuarios WHERE ativo = 1');
        destinatarios = rows.map(r => r.id);
      } else if (alvo === 'alunos') {
        const [rows] = await db.query('SELECT id FROM usuarios WHERE role = ?', ['aluno']);
        destinatarios = rows.map(r => r.id);
      } else if (alvo === 'professores') {
        const [rows] = await db.query('SELECT id FROM usuarios WHERE role = ?', ['professor']);
        destinatarios = rows.map(r => r.id);
      } else if (alvo === 'coordenadores') {
        const [rows] = await db.query('SELECT id FROM usuarios WHERE role = ?', ['coordenador']);
        destinatarios = rows.map(r => r.id);
      } else {
        return res.status(400).json({ message: 'Alvo inválido.' });
      }
    } else if (req.user.role === 'coordenador' || (req.user.role === 'professor' && (req.user.curso_coordenado || req.user.nivel_coordenado))) {
      if (!['alunos', 'professores'].includes(alvo)) {
        return res.status(400).json({ message: 'Alvo inválido para esta função.' });
      }
      if (!turma_id) return res.status(400).json({ message: 'Seleccione a turma.' });
      const [turmaRows] = await db.query(
        'SELECT t.id, t.serie_classe, c.nome as curso_nome FROM turmas t LEFT JOIN cursos c ON t.curso_id = c.id WHERE t.id = ? LIMIT 1',
        [turma_id]
      );
      if (turmaRows.length === 0) return res.status(404).json({ message: 'Turma não encontrada.' });
      const turma = turmaRows[0];
      if (req.user.role === 'coordenador') {
        if (!coordenadorPodeGerirTurma(req.user, turma)) {
          return res.status(403).json({ message: 'Não tem permissão para esta turma.' });
        }
      } else {
        const [profRows] = await db.query('SELECT id FROM turma_professores WHERE professor_id = ? AND turma_id = ? LIMIT 1', [req.user.id, turma_id]);
        if (profRows.length === 0) {
          return res.status(403).json({ message: 'Não está atribuído a esta turma.' });
        }
      }
      if (alvo === 'alunos') {
        const [rows] = await db.query(
          `SELECT DISTINCT a.usuario_id FROM matriculas m
           JOIN alunos a ON m.aluno_id = a.id
           WHERE m.turma_id = ? AND m.status = 'ativa' AND a.usuario_id IS NOT NULL`,
          [turma_id]
        );
        destinatarios = rows.map(r => r.usuario_id);
      } else {
        const [rows] = await db.query(
          `SELECT DISTINCT u.id FROM turma_professores tp
           JOIN usuarios u ON tp.professor_id = u.id
           WHERE tp.turma_id = ?`,
          [turma_id]
        );
        destinatarios = rows.map(r => r.id);
      }
    } else if (req.user.role === 'professor') {
      if (alvo !== 'alunos') return res.status(400).json({ message: 'Professores só podem enviar mensagens para alunos.' });
      if (!turma_id) return res.status(400).json({ message: 'Seleccione a turma.' });
      const [profRows] = await db.query('SELECT id FROM turma_professores WHERE professor_id = ? AND turma_id = ? LIMIT 1', [req.user.id, turma_id]);
      if (profRows.length === 0) {
        return res.status(403).json({ message: 'Não está atribuído a esta turma.' });
      }
      const [rows] = await db.query(
        `SELECT DISTINCT a.usuario_id FROM matriculas m
         JOIN alunos a ON m.aluno_id = a.id
         WHERE m.turma_id = ? AND m.status = 'ativa' AND a.usuario_id IS NOT NULL`,
        [turma_id]
      );
      destinatarios = rows.map(r => r.usuario_id);
    } else {
      return res.status(403).json({ message: 'Não tem permissão para enviar mensagens.' });
    }

    if (destinatarios.length === 0) {
      return res.status(404).json({ message: 'Nenhum destinatário encontrado para este envio.' });
    }

    const batch = [];
    const unique = Array.from(new Set(destinatarios.filter(Boolean)));
    for (const usuario_id of unique) {
      batch.push([usuario_id, req.user.id, titulo, mensagem, 'mensagem']);
    }
    await db.query('INSERT INTO notificacoes (usuario_id, remetente_id, titulo, mensagem, tipo) VALUES ?',[batch]);
    return res.status(201).json({ message: `Mensagem enviada para ${unique.length} destinatários.` });
  } catch (err) {
    console.error('[enviarNotificacao] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao enviar notificação.' });
  }
};

module.exports = {
  listarSeries, criarSerie, atualizarSerie, deletarSerie,
  upload, enviarDocumento, atualizarDocumento,
  listarUsuarios, listarEquipaCoordenador, sincronizarVagasSeries,
  criarUsuario, atualizarUsuario, designarCoordenador, minhasNotificacoes,
  marcarNotificacaoLida, enviarNotificacao
};