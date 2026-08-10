const db = require('../config/database');
const { podeDesignarCoordenador, tipoDesignacaoNoAmbito, coordenadorPodeGerirTurma, filtroSqlSeriesCoordenador, temEscopoCoordenacao } = require('../utils/academicoRules');
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
    return res.status(500).json({ message: 'Erro ao buscar séries.' });
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
    return res.status(500).json({ message: 'Erro ao criar série.' });
  }
};

const CAMPOS_SERIE_PERMITIDOS = ['nome', 'nivel', 'vagas_total', 'ano_letivo', 'ordem', 'curso', 'ativo'];

const atualizarSerie = async (req, res) => {
  const { id } = req.params;
  const campos = {};
  for (const k of CAMPOS_SERIE_PERMITIDOS) {
    if (req.body[k] !== undefined) campos[k] = req.body[k];
  }
  const keys = Object.keys(campos);
  if (keys.length === 0) return res.status(400).json({ message: 'Nada para atualizar.' });
  try {
    const sets = keys.map(k => `${k} = ?`).join(', ');
    await db.query(`UPDATE series SET ${sets} WHERE id = ?`, [...keys.map(k => campos[k]), id]);
    return res.json({ message: 'Série atualizada!' });
  } catch (err) {
    console.error('[atualizarSerie] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao atualizar série.' });
  }
};

const deletarSerie = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE series SET ativo = 0 WHERE id = ?', [id]);
    return res.json({ message: 'Série desativada.' });
  } catch (err) {
    console.error('[deletarSerie] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao deletar série.' });
  }
};

// --- DOCUMENTOS ---
const supabaseUpload = require('../config/supabaseUpload');
const upload = supabaseUpload('documentos', 5);

const enviarDocumento = async (req, res) => {
  const { inscricao_id, tipo } = req.body;
  if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado.' });
  if (!inscricao_id) return res.status(400).json({ message: 'Inscrição não indicada.' });

  try {
    // Só admin ou o dono da inscrição pode anexar documentos a ela
    if (req.user.role !== 'admin') {
      const [[insc]] = await db.query('SELECT usuario_id FROM inscricoes WHERE id = ? LIMIT 1', [inscricao_id]);
      if (!insc || Number(insc.usuario_id) !== Number(req.user.id)) {
        return res.status(403).json({ message: 'Não tem permissão para esta inscrição.' });
      }
    }
    await db.query(
      'INSERT INTO documentos (inscricao_id, tipo, nome_arquivo, caminho_arquivo) VALUES (?,?,?,?)',
[inscricao_id, tipo, req.file.originalname, req.file.secure_url || req.file.path]
    );
    return res.status(201).json({ message: 'Documento enviado com sucesso!' });
  } catch (err) {
    console.error('[enviarDocumento] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao salvar documento.' });
  }
};

const atualizarDocumento = async (req, res) => {
  const { id } = req.params;
  const { status, observacao } = req.body;
  // Ajusta esta lista se coordenador/professor também puderem validar documentos
  if (!['admin', 'coordenador'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Sem permissão para actualizar documentos.' });
  }
  try {
    await db.query('UPDATE documentos SET status = ?, observacao = ? WHERE id = ?', [status, observacao || null, id]);
    return res.json({ message: 'Documento atualizado.' });
  } catch (err) {
    console.error('[atualizarDocumento] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao atualizar documento.' });
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
    return res.status(500).json({ message: 'Erro ao buscar usuários.' });
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
    return res.status(500).json({ message: 'Erro ao buscar equipa.' });
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
    return res.status(500).json({ message: 'Erro ao sincronizar vagas.' });
  }
};

// Criar utilizador (professor / coordenador / admin)
const criarUsuario = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Apenas o administrador pode criar utilizadores.' });
  }
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
      `SELECT n.id, n.titulo, n.mensagem, n.tipo, n.lida, n.criado_em, n.remetente_id,
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
    return res.status(500).json({ message: 'Erro ao buscar notificações.' });
  }
};

const marcarNotificacaoLida = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT usuario_id FROM notificacoes WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Notificação não encontrada.' });
    if (Number(rows[0].usuario_id) !== Number(req.user.id)) return res.status(403).json({ message: 'Não tem permissão para actualizar esta notificação.' });
    await db.query('UPDATE notificacoes SET lida = 1 WHERE id = ?', [id]);
    return res.json({ message: 'Notificação marcada como lida.' });
  } catch (err) {
    console.error('[marcarNotificacaoLida] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao atualizar notificação.' });
  }
};

// Contactos que o utilizador pode mensagear individualmente, respeitando a hierarquia
const obterContatosPermitidos = async (user) => {
  if (user.role === 'admin') {
    // Admin: TODOS os usuários do sistema, ordem alfabética. Busca por nome/email é feita no frontend.
    const [rows] = await db.query(
      `SELECT id, nome, email, role FROM usuarios WHERE ativo = 1 AND id != ? ORDER BY nome`,
      [user.id]
    );
    return rows;
  }

  if (user.role === 'coordenador') {
    const [turmas] = await db.query(
      `SELECT t.id, t.serie_classe, c.nome AS curso_nome FROM turmas t LEFT JOIN cursos c ON t.curso_id = c.id WHERE t.ativo = 1`
    );
    const minhasTurmas = turmas.filter(t => coordenadorPodeGerirTurma(user, t));
    const turmaIds = minhasTurmas.map(t => t.id);
    if (!turmaIds.length) return [];
    const [profs] = await db.query(
      `SELECT DISTINCT u.id, u.nome, u.email, u.role FROM turma_professores tp
       JOIN usuarios u ON tp.professor_id = u.id
       WHERE tp.turma_id IN (?)`,
      [turmaIds]
    );
    const [alunos] = await db.query(
      `SELECT DISTINCT u.id, u.nome, u.email, u.role FROM matriculas m
       JOIN alunos a ON m.aluno_id = a.id
       JOIN usuarios u ON a.usuario_id = u.id
       WHERE m.turma_id IN (?) AND m.status = 'ativa'`,
      [turmaIds]
    );
    return [...profs, ...alunos].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  if (user.role === 'professor') {
    console.log('[DEBUG contactos-professor] user recebido:', { id: user.id, role: user.role, curso_coordenado: user.curso_coordenado, nivel_coordenado: user.nivel_coordenado });
    const [turmasEnsino] = await db.query(
      `SELECT DISTINCT t.id, t.nome, t.serie_classe, c.nome AS curso_nome FROM turma_professores tp
       JOIN turmas t ON tp.turma_id = t.id
       LEFT JOIN cursos c ON t.curso_id = c.id
       WHERE tp.professor_id = ?`,
      [user.id]
    );

    let turmasCoordenadas = [];
    if (temEscopoCoordenacao(user)) {
      const [todasTurmas] = await db.query(
        `SELECT t.id, t.serie_classe, c.nome AS curso_nome FROM turmas t LEFT JOIN cursos c ON t.curso_id = c.id WHERE t.ativo = 1`
      );
      turmasCoordenadas = todasTurmas.filter(t => coordenadorPodeGerirTurma(user, t));
    }

    const turmaIdsEnsino = turmasEnsino.map(t => t.id);
    const turmaIdsCoord = turmasCoordenadas.map(t => t.id);
    const turmaIdsTodos = Array.from(new Set([...turmaIdsEnsino, ...turmaIdsCoord]));

    let alunos = [];
    if (turmaIdsTodos.length) {
      const [rows] = await db.query(
        `SELECT u.id, u.nome, u.email, u.role, m.turma_id FROM matriculas m
         JOIN alunos a ON m.aluno_id = a.id
         JOIN usuarios u ON a.usuario_id = u.id
         WHERE m.turma_id IN (?) AND m.status = 'ativa'`,
        [turmaIdsTodos]
      );
      const mapa = new Map();
      rows.forEach(r => {
        if (!mapa.has(r.id)) {
          mapa.set(r.id, { id: r.id, nome: r.nome, email: r.email, role: r.role, turma_ids: [] });
        }
        mapa.get(r.id).turma_ids.push(r.turma_id);
      });
      alunos = Array.from(mapa.values());
    }

    // outros professores que leccionam nas turmas que ele coordena (não nas que só lecciona)
    let outrosProfessores = [];
    if (turmaIdsCoord.length) {
      const [rows] = await db.query(
        `SELECT DISTINCT u.id, u.nome, u.email, u.role FROM turma_professores tp
         JOIN usuarios u ON tp.professor_id = u.id
         WHERE tp.turma_id IN (?) AND u.id != ?`,
        [turmaIdsCoord, user.id]
      );
      outrosProfessores = rows;
    }

    const [coordenadores] = await db.query(
      `SELECT id, nome, email, role, curso_coordenado, nivel_coordenado FROM usuarios WHERE (role = 'coordenador' OR curso_coordenado IS NOT NULL OR nivel_coordenado IS NOT NULL) AND ativo = 1 AND id != ?`,
      [user.id]
    );
    const meusCoordenadores = coordenadores
      .filter(c => turmasEnsino.some(t => coordenadorPodeGerirTurma(c, t)))
      .map(({ id, nome, email, role }) => ({ id, nome, email, role }));

    return [...meusCoordenadores, ...outrosProfessores, ...alunos].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  if (user.role === 'aluno') {
    const [minhasTurmas] = await db.query(
      `SELECT DISTINCT t.id, t.serie_classe, c.nome AS curso_nome FROM matriculas m
       JOIN alunos a ON m.aluno_id = a.id
       JOIN turmas t ON m.turma_id = t.id
       LEFT JOIN cursos c ON t.curso_id = c.id
       WHERE a.usuario_id = ? AND m.status = 'ativa'`,
      [user.id]
    );
    const turmaIds = minhasTurmas.map(t => t.id);
    let professores = [];
    if (turmaIds.length) {
      const [rows] = await db.query(
        `SELECT DISTINCT u.id, u.nome, u.email, u.role FROM turma_professores tp
         JOIN usuarios u ON tp.professor_id = u.id
         WHERE tp.turma_id IN (?)`,
        [turmaIds]
      );
      professores = rows;
    }
    const [coordenadores] = await db.query(
      `SELECT id, nome, email, role, curso_coordenado, nivel_coordenado FROM usuarios WHERE (role = 'coordenador' OR curso_coordenado IS NOT NULL OR nivel_coordenado IS NOT NULL) AND ativo = 1`
    );
    const meusCoordenadores = coordenadores
      .filter(c => minhasTurmas.some(t => coordenadorPodeGerirTurma(c, t)))
      .map(({ id, nome, email, role }) => ({ id, nome, email, role }));
    return [...meusCoordenadores, ...professores].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  return [];
};

const listarContatosPermitidos = async (req, res) => {
  try {
    const contatos = await obterContatosPermitidos(req.user);
    const unique = Array.from(new Map(contatos.map(c => [c.id, c])).values());

    // Quantidade de mensagens não lidas por remetente, para mostrar o "badge" junto de cada contacto
    const [naoLidasRows] = await db.query(
      `SELECT remetente_id, COUNT(*) AS total
       FROM notificacoes
       WHERE usuario_id = ? AND lida = 0 AND remetente_id IS NOT NULL
       GROUP BY remetente_id`,
      [req.user.id]
    );
    const mapaNaoLidas = new Map(naoLidasRows.map(r => [Number(r.remetente_id), Number(r.total)]));
    const comContagem = unique.map(c => ({ ...c, nao_lidas: mapaNaoLidas.get(Number(c.id)) || 0 }));

    return res.json(comContagem);
  } catch (err) {
    console.error('[listarContatosPermitidos] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar contactos.' });
  }
};

// Histórico de conversa 1-a-1 com um contacto permitido (chat)
const listarConversa = async (req, res) => {
  const outroId = Number(req.params.outroId);
  if (!outroId) return res.status(400).json({ message: 'Utilizador inválido.' });

  try {
    const permitidos = await obterContatosPermitidos(req.user);
    const podeConversar = permitidos.some(c => Number(c.id) === outroId);
    if (!podeConversar) {
      return res.status(403).json({ message: 'Não tem permissão para ver esta conversa.' });
    }

    const [rows] = await db.query(
      `SELECT n.id, n.titulo, n.mensagem, n.tipo, n.criado_em, n.lida, n.remetente_id, n.usuario_id
       FROM notificacoes n
       WHERE (n.usuario_id = ? AND n.remetente_id = ?) OR (n.usuario_id = ? AND n.remetente_id = ?)
       ORDER BY n.criado_em ASC
       LIMIT 200`,
      [req.user.id, outroId, outroId, req.user.id]
    );

    await db.query(
      `UPDATE notificacoes SET lida = 1 WHERE usuario_id = ? AND remetente_id = ? AND lida = 0`,
      [req.user.id, outroId]
    );

    return res.json(rows);
  } catch (err) {
    console.error('[listarConversa] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar conversa.' });
  }
};

const enviarNotificacao = async (req, res) => {
  const { titulo, mensagem, alvo, turma_id } = req.body;
  if (!mensagem || !alvo) {
    return res.status(400).json({ message: 'Mensagem e alvo são obrigatórios.' });
  }
  const tituloFinal = titulo || (alvo === 'usuario' ? 'Mensagem' : null);
  if (!tituloFinal) {
    return res.status(400).json({ message: 'Título é obrigatório.' });
  }

  try {
    let destinatarios = [];
    if (alvo === 'usuario') {
      const { destinatario_id } = req.body;
      if (!destinatario_id) return res.status(400).json({ message: 'Seleccione o destinatário.' });
      const permitidos = await obterContatosPermitidos(req.user);
      const alvo_valido = permitidos.some(c => Number(c.id) === Number(destinatario_id));
      if (!alvo_valido) {
        return res.status(403).json({ message: 'Não tem permissão para enviar mensagem a este utilizador.' });
      }
      destinatarios = [Number(destinatario_id)];
    } else if (req.user.role === 'admin') {
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
      batch.push([usuario_id, req.user.id, tituloFinal, mensagem, 'mensagem']);
    }
    await db.query('INSERT INTO notificacoes (usuario_id, remetente_id, titulo, mensagem, tipo) VALUES ?',[batch]);
    return res.status(201).json({ message: `Mensagem enviada para ${unique.length} destinatários.` });
  } catch (err) {
    console.error('[enviarNotificacao] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao enviar notificação.' });
  }
};

// --- LISTAR DOCUMENTOS DO UTILIZADOR ---
const listarMeusDocumentos = async (req, res) => {
  try {
    const usuario_id = req.user.id;
    const [docs] = await db.query(`
      SELECT d.* FROM documentos d
      INNER JOIN inscricoes i ON d.inscricao_id = i.id
      WHERE i.usuario_id = ?
      ORDER BY d.enviado_em DESC
    `, [usuario_id]);
    return res.json(docs);
  } catch (err) {
    console.error('[listarMeusDocumentos] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar documentos.' });
  }
};

module.exports = {
  listarSeries, criarSerie, atualizarSerie, deletarSerie,
  upload, enviarDocumento, atualizarDocumento, listarMeusDocumentos,
  listarUsuarios, listarEquipaCoordenador, sincronizarVagasSeries,
  criarUsuario, atualizarUsuario, designarCoordenador, minhasNotificacoes,
  marcarNotificacaoLida, enviarNotificacao, listarContatosPermitidos,
  listarConversa
};