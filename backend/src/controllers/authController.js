const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { validarSenha } = require('../utils/passwordPolicy');
require('dotenv').config();

const supabaseUpload = require('../config/supabaseUpload');
const uploadAvatar = supabaseUpload('avatars', 3);

let fotoColumnEnsured = false;

async function ensureFotoColumn() {
  if (fotoColumnEnsured) return;
  try {
    await db.query('ALTER TABLE usuarios ADD COLUMN foto_url VARCHAR(512) NULL');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') throw err;
  }
  fotoColumnEnsured = true;
}

// Cookie adaptativo: se o frontend estiver na MESMA origem (proxy /api ou localhost),
// usa SameSite=Lax e a sessão é "first-party" (guarda em qualquer browser mobile).
// Se o frontend chamar a API diretamente cross-origin, usa SameSite=None (requer HTTPS).
function getCookieOptions(req) {
  let sameSite = 'none';
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).hostname === req.hostname) sameSite = 'lax';
    } catch (err) {
      // origem inválida → tratar como cross-site
    }
  } else {
    sameSite = 'lax';
  }
  return {
    httpOnly: true,
    sameSite,
    secure: req.secure, // honra X-Forwarded-Proto (trust proxy 1)
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24h
  };
}

function mapUsuario(row) {
  if (!row) return null;
  const { senha, ...safe } = row;
  return {
    id: safe.id,
    nome: safe.nome,
    email: safe.email,
    telefone: safe.telefone,
    cpf: safe.cpf,
    endereco: safe.endereco,
    role: safe.role,
    foto_url: safe.foto_url || null,
    curso_coordenado: safe.curso_coordenado || null,
    nivel_coordenado: safe.nivel_coordenado || null,
    ativo: safe.ativo,
  };
}

const register = async (req, res) => {
  const { nome, email, senha, telefone, cpf, endereco } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
  }
  const politica = validarSenha(senha);
  if (!politica.ok) {
    return res.status(400).json({ message: politica.message });
  }
  try {
    const [existing] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'E-mail já cadastrado.' });
    }
    const hash = await bcrypt.hash(senha, 12);
    const [result] = await db.query(
      'INSERT INTO usuarios (nome, email, senha, telefone, cpf, endereco, ativo) VALUES (?,?,?,?,?,?,?)',
      [nome, email, hash, telefone || null, cpf || null, endereco || null, 1]
    );
    return res.status(201).json({ message: 'Cadastro realizado com sucesso!', id: result.insertId });
  } catch (err) {
    console.error('[register] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

const login = async (req, res) => {
  const { email, senha } = req.body;
  const loginId = (email || '').trim();
  if (!loginId || !senha) {
    return res.status(400).json({ message: 'E-mail/BI e senha são obrigatórios.' });
  }
  try {
    const [rows] = await db.query(
      'SELECT * FROM usuarios WHERE (email = ? OR cpf = ?) LIMIT 1',
      [loginId, loginId]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    const usuario = rows[0];
    if (usuario.ativo === 0) {
      return res.status(403).json({ message: 'Conta ainda não foi aprovada pelo colégio.' });
    }
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    const token = jwt.sign(
      {
        id:               usuario.id,
        email:            usuario.email,
        role:             usuario.role,
        nome:             usuario.nome,
        curso_coordenado: usuario.curso_coordenado || null,
        nivel_coordenado: usuario.nivel_coordenado || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    // Sessão via cookie httpOnly (protege contra roubo de token por XSS)
    res.cookie('token', token, getCookieOptions(req));
    return res.json({ usuario: mapUsuario(usuario) });
  } catch (err) {
    console.error('[login] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

const logout = (req, res) => {
  res.clearCookie('token', getCookieOptions(req));
  return res.json({ message: 'Sessão encerrada.' });
};

const perfil = async (req, res) => {
  try {
    await ensureFotoColumn();
    const [rows] = await db.query(
      'SELECT id, nome, email, telefone, cpf, endereco, role, foto_url, curso_coordenado, nivel_coordenado, criado_em FROM usuarios WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado.' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('[perfil] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro interno.' });
  }
};

const atualizarPerfil = async (req, res) => {
  const { nome, telefone, endereco } = req.body;
  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ message: 'Nome é obrigatório.' });
  }
  try {
    await db.query(
      'UPDATE usuarios SET nome = ?, telefone = ?, endereco = ? WHERE id = ?',
      [String(nome).trim(), telefone || null, endereco || null, req.user.id]
    );
    const [rows] = await db.query(
      'SELECT id, nome, email, telefone, cpf, endereco, role, foto_url, curso_coordenado, nivel_coordenado FROM usuarios WHERE id = ?',
      [req.user.id]
    );
    return res.json({ message: 'Perfil actualizado.', usuario: rows[0] });
  } catch (err) {
    console.error('[atualizarPerfil] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao actualizar perfil.' });
  }
};

const atualizarFotoPerfil = async (req, res) => {
  try {
    await ensureFotoColumn();
    if (!req.file) return res.status(400).json({ message: 'Seleccione uma fotografia.' });
    const fotoPath = req.file.secure_url || req.file.path;
    await db.query('UPDATE usuarios SET foto_url = ? WHERE id = ?', [fotoPath, req.user.id]);
    return res.json({ message: 'Fotografia actualizada.', foto_url: fotoPath });
  } catch (err) {
    console.error('[atualizarFotoPerfil] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao guardar fotografia.' });
  }
};

const atualizarCredenciais = async (req, res) => {
  try {
    const { email, current_password, nova_senha } = req.body;
    const [[userRow]] = await db.query('SELECT id, email, senha FROM usuarios WHERE id = ? LIMIT 1', [req.user.id]);
    if (!userRow) return res.status(404).json({ message: 'Usuário não encontrado.' });

    if (email && String(email).trim() && String(email).trim() !== userRow.email) {
      const [exists] = await db.query('SELECT id FROM usuarios WHERE email = ? AND id != ? LIMIT 1', [email.trim(), req.user.id]);
      if (exists.length > 0) return res.status(409).json({ message: 'E-mail já cadastrado.' });
      await db.query('UPDATE usuarios SET email = ? WHERE id = ?', [email.trim(), req.user.id]);
    }

    if (nova_senha) {
      if (!current_password) return res.status(400).json({ message: 'Senha atual é necessária para alterar a senha.' });
      const politica = validarSenha(nova_senha);
      if (!politica.ok) return res.status(400).json({ message: politica.message });
      const ok = await bcrypt.compare(current_password, userRow.senha);
      if (!ok) return res.status(401).json({ message: 'Senha atual inválida.' });
      const hash = await bcrypt.hash(nova_senha, 12);
      await db.query('UPDATE usuarios SET senha = ? WHERE id = ?', [hash, req.user.id]);
    }

    const [rows] = await db.query(
      'SELECT id, nome, email, telefone, cpf, endereco, role, foto_url, curso_coordenado, nivel_coordenado FROM usuarios WHERE id = ?',
      [req.user.id]
    );
    return res.json({ message: 'Credenciais actualizadas.', usuario: rows[0] });
  } catch (err) {
    console.error('[atualizarCredenciais] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao actualizar credenciais.' });
  }
};

module.exports = {
  register,
  login,
  logout,
  perfil,
  atualizarPerfil,
  uploadAvatar,
  atualizarFotoPerfil,
  atualizarCredenciais,
};
