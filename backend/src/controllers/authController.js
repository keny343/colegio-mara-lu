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

// ---------- Proteção contra força bruta por conta (cooldown após falhas repetidas) ----------
const ATTEMPT_LIMIT = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map(); // key: loginId (minúsculas) → { count, blockedUntil, firstAttemptAt }

function registrarFalha(loginId) {
  const key = String(loginId).toLowerCase();
  const now = Date.now();
  const rec = loginAttempts.get(key) || { count: 0, blockedUntil: 0, firstAttemptAt: now };
  if (now - rec.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    rec.count = 0;
    rec.firstAttemptAt = now;
  }
  rec.count += 1;
  if (rec.count >= ATTEMPT_LIMIT) {
    rec.blockedUntil = now + ATTEMPT_WINDOW_MS;
    rec.count = 0;
  }
  loginAttempts.set(key, rec);
  if (loginAttempts.size > 5000) {
    for (const [k, v] of loginAttempts) {
      if (now - v.firstAttemptAt > ATTEMPT_WINDOW_MS && !v.blockedUntil) loginAttempts.delete(k);
    }
  }
}

function verificarBloqueio(loginId) {
  const key = String(loginId).toLowerCase();
  const rec = loginAttempts.get(key);
  if (!rec) return null;
  if (rec.blockedUntil && Date.now() < rec.blockedUntil) return rec.blockedUntil;
  if (rec.blockedUntil && Date.now() >= rec.blockedUntil) loginAttempts.delete(key);
  return null;
}

function limparFalhas(loginId) {
  loginAttempts.delete(String(loginId).toLowerCase());
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

const login = async (req, res) => {
  const { email, senha } = req.body;
  const loginId = (email || '').trim();
  if (!loginId || !senha) {
    return res.status(400).json({ message: 'E-mail/BI e senha são obrigatórios.' });
  }
  const bloqueado = verificarBloqueio(loginId);
  if (bloqueado) {
    const mins = Math.max(1, Math.ceil((bloqueado - Date.now()) / 60000));
    console.log('[AUTH] LOGIN_FAILURE reason=account_locked');
    return res.status(429).json({ message: `Demasiadas tentativas. Tente novamente em ${mins} minuto(s).` });
  }
  try {
    const [rows] = await db.query(
      'SELECT * FROM usuarios WHERE (email = ? OR cpf = ?) LIMIT 1',
      [loginId, loginId]
    );
    if (rows.length === 0) {
      registrarFalha(loginId);
      console.log('[AUTH] LOGIN_FAILURE reason=user_not_found');
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    const usuario = rows[0];
    if (usuario.ativo === 0) {
      registrarFalha(loginId);
      console.log('[AUTH] LOGIN_FAILURE reason=inactive_user id=' + usuario.id);
      return res.status(403).json({ message: 'Conta ainda não foi aprovada pelo colégio.' });
    }
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      registrarFalha(loginId);
      console.log('[AUTH] LOGIN_FAILURE reason=wrong_password id=' + usuario.id);
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    limparFalhas(loginId);
    const token = jwt.sign(
      {
        id:               usuario.id,
        email:            usuario.email,
        role:             usuario.role,
        nome:             usuario.nome,
        curso_coordenado: usuario.curso_coordenado || null,
        nivel_coordenado: usuario.nivel_coordenado || null,
        v:                usuario.token_version == null ? 1 : Number(usuario.token_version),
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    // Sessão via cookie httpOnly (protege contra roubo de token por XSS)
    res.cookie('token', token, getCookieOptions(req));
    console.log('[AUTH] LOGIN_SUCCESS id=' + usuario.id + ' role=' + usuario.role);
    return res.json({ usuario: mapUsuario(usuario) });
  } catch (err) {
    console.error('[login] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

const logout = (req, res) => {
  res.clearCookie('token', getCookieOptions(req));
  if (req.user && req.user.id) console.log('[AUTH] LOGOUT id=' + req.user.id);
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

    let sessaoInvalidada = false;
    if (nova_senha) {
      if (!current_password) return res.status(400).json({ message: 'Senha atual é necessária para alterar a senha.' });
      const politica = validarSenha(nova_senha);
      if (!politica.ok) return res.status(400).json({ message: politica.message });
      const ok = await bcrypt.compare(current_password, userRow.senha);
      if (!ok) return res.status(401).json({ message: 'Senha atual inválida.' });
      const hash = await bcrypt.hash(nova_senha, 12);
      await db.query('UPDATE usuarios SET senha = ?, token_version = token_version + 1 WHERE id = ?', [hash, req.user.id]);
      // Política: trocou a senha → todas as sessões anteriores são invalidadas.
      sessaoInvalidada = true;
      res.clearCookie('token', getCookieOptions(req));
      limparFalhas(userRow.email);
      console.log('[AUTH] PASSWORD_CHANGED id=' + req.user.id + ' sessões_invalidadas=true');
    }

    const [rows] = await db.query(
      'SELECT id, nome, email, telefone, cpf, endereco, role, foto_url, curso_coordenado, nivel_coordenado FROM usuarios WHERE id = ?',
      [req.user.id]
    );
    return res.json({
      message: sessaoInvalidada ? 'Credenciais actualizadas. Faça login novamente.' : 'Credenciais actualizadas.',
      usuario: rows[0],
      sessao_invalidada: sessaoInvalidada,
    });
  } catch (err) {
    console.error('[atualizarCredenciais] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro ao actualizar credenciais.' });
  }
};

module.exports = {
  login,
  logout,
  perfil,
  atualizarPerfil,
  uploadAvatar,
  atualizarFotoPerfil,
  atualizarCredenciais,
};
