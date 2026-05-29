const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token não fornecido.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token inválido ou expirado.' });
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
