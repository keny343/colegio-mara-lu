const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
require('dotenv').config();

const cloudinaryUpload = require('../config/cloudinaryUpload');
const uploadAvatar = cloudinaryUpload('avatars', 3);

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
  try {
    const [existing] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'E-mail já cadastrado.' });
    }
    const hash = await bcrypt.hash(senha, 10);
    const [result] = await db.query(
      'INSERT INTO usuarios (nome, email, senha, telefone, cpf, endereco, ativo) VALUES (?,?,?,?,?,?,?)',
      [nome, email, hash, telefone || null, cpf || null, endereco || null, 1]
    );
    return res.status(201).json({ message: 'Cadastro realizado com sucesso!', id: result.insertId });
  } catch (err) {
    console.error(err);
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
    return res.json({ token, usuario: mapUsuario(usuario) });
  } catch (err) {
    console.error('[login] ERRO:', err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
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
    return res.status(500).json({ message: 'Erro ao actualizar perfil.' });
  }
};

const atualizarFotoPerfil = async (req, res) => {
  try {
    await ensureFotoColumn();
    if (!req.file) return res.status(400).json({ message: 'Seleccione uma fotografia.' });
    const fotoPath = req.file.path;
    await db.query('UPDATE usuarios SET foto_url = ? WHERE id = ?', [fotoPath, req.user.id]);
    return res.json({ message: 'Fotografia actualizada.', foto_url: fotoPath });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Erro ao guardar fotografia.' });
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
      const ok = await bcrypt.compare(current_password, userRow.senha);
      if (!ok) return res.status(401).json({ message: 'Senha atual inválida.' });
      const hash = await bcrypt.hash(nova_senha, 10);
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
  perfil,
  atualizarPerfil,
  uploadAvatar,
  atualizarFotoPerfil,
  atualizarCredenciais,
};