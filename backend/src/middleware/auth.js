const jwt = require('jsonwebtoken');
const db = require('../config/database');
require('dotenv').config();

// Lê o token JWT do cookie httpOnly ou do header Authorization
function getToken(req) {
  const cookieToken = req.cookies && req.cookies.token;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
}

const authMiddleware = async (req, res, next) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ message: 'Sessão não iniciada.' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, role, curso_coordenado, nivel_coordenado, token_version, ativo
       FROM usuarios WHERE id = ? LIMIT 1`,
      [decoded.id]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
    }
    const row = rows[0];
    if (row.ativo !== 1) {
      return res.status(401).json({ message: 'Conta desactivada. Contacte a administração.' });
    }
    // Se a senha foi alterada, a versão do token foi incrementada → todas as sessões antigas morrem.
    const versaoBD = row.token_version == null ? 1 : Number(row.token_version);
    const versaoToken = decoded.v == null ? 1 : Number(decoded.v);
    if (versaoToken !== versaoBD) {
      return res.status(401).json({ message: 'Sessão expirada. Faça login novamente.' });
    }
    // Preenche o user com dados FRESCOS do banco (role/âmbito mudam se forem editados)
    req.user = {
      id: row.id,
      role: row.role,
      nome: decoded.nome || null,
      email: decoded.email || null,
      curso_coordenado: row.curso_coordenado || null,
      nivel_coordenado: row.nivel_coordenado || null,
    };
    next();
  } catch (err) {
    console.error('[auth] ERRO ao validar sessão:', err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

const adminMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso restrito a administradores.' });
    }
    next();
  });
};

const staffMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    const { podeAcederInformacaoGeral } = require('../utils/academicoRules');
    if (!podeAcederInformacaoGeral(req.user)) {
      return res.status(403).json({ message: 'Acesso restrito.' });
    }
    next();
  });
};

/** Admin ou coordenador com âmbito (designar coordenador, etc.) */
const coordenadorOuAdminMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    const { podeDesignarCoordenador } = require('../utils/academicoRules');
    if (!podeDesignarCoordenador(req.user)) {
      return res.status(403).json({ message: 'Acesso restrito a administradores e coordenadores.' });
    }
    next();
  });
};

const professorMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'professor') {
      return res.status(403).json({ message: 'Acesso restrito a professores.' });
    }
    next();
  });
};

/** Admin, coordenador (com âmbito) ou professor — notas (permissões finas no controller) */
const notasAccessMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    const { podeAcederNotas } = require('../utils/academicoRules');
    if (!podeAcederNotas(req.user)) {
      return res.status(403).json({ message: 'Sem permissão para aceder às notas.' });
    }
    next();
  });
};

const notasStaffMiddleware = notasAccessMiddleware;

module.exports = {
  authMiddleware,
  adminMiddleware,
  staffMiddleware,
  coordenadorOuAdminMiddleware,
  professorMiddleware,
  notasAccessMiddleware,
  notasStaffMiddleware,
};
