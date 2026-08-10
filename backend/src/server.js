const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const { rateLimit } = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 49152;
const isProd = process.env.NODE_ENV === 'production';

// Confiar em proxies (Render/Vercel) para obter o IP real do cliente
app.set('trust proxy', 1);

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
const additionalOrigins = (process.env.ADDITIONAL_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([frontendUrl, ...additionalOrigins]));

// ---------- Segurança: headers ----------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      ...(isProd ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ---------- CORS (allowlist) ----------
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Origin denied: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(cookieParser());

// ---------- Limite do corpo das requisições ----------
app.use(express.json({ charset: 'utf-8', limit: '1mb' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8', limit: '1mb' }));

// ---------- Rate limiting ----------
// Limite global da API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ message: 'Demasiados pedidos. Tente novamente mais tarde.' }),
});
app.use('/api', apiLimiter);

// Limite apertado no login (força bruta)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ message: 'Demasiadas tentativas de login. Tente novamente em 15 minutos.' }),
});
app.use('/api/auth/login', loginLimiter);

app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson.call(this, data);
  };
  next();
});

app.get('/api/test', (req, res) => res.json({ message: 'Backend OK!' }));

// Só avatares legados são servidos publicamente (fotos de perfil, não-sensíveis).
// Documentos/materiais/justificações usam endpoints autenticados.
app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads', 'avatars')));

const routes = require('./routes/index');
app.use('/api', routes);

// ---------- 404 (API) ----------
app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint não encontrado.' }));

app.get('/', (req, res) => res.json({ message: 'API Colégio Mara e Lu 🎓' }));

// ---------- Error handler global (não expõe detalhes internos) ----------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[ERRO] ${req.method} ${req.originalUrl}:`, err.message);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Ficheiro demasiado grande.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Corpo da requisição demasiado grande.' });
  }
  if (err.status && err.expose) {
    return res.status(err.status).json({ message: err.message });
  }
  return res.status(500).json({ message: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`\n📁 CWD: ${process.cwd()}`);
  console.log(`\n🎓 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`📡 API disponível em: http://localhost:${PORT}/api`);
  console.log(`🌐 FRONTEND_URL: ${process.env.FRONTEND_URL}`);
  console.log(`☁️ CLOUDINARY: ${process.env.CLOUDINARY_CLOUD_NAME}`);
});
