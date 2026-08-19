const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');
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

// ---------- Log estruturado de requisições (Request ID para rastreio) ----------
app.use((req, res, next) => {
  const requestId =
    (req.headers['x-request-id'] && String(req.headers['x-request-id']).slice(0, 64)) ||
    crypto.randomBytes(6).toString('hex');
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const start = Date.now();
  res.on('finish', () => {
    const entry = {
      ts: new Date().toISOString(),
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      user: req.user && req.user.id ? String(req.user.id) : null,
    };
    console.log(`[REQ] ${JSON.stringify(entry)}`);
  });
  next();
});
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// ---------- Health check (monitorização de API + banco) ----------
// Registado DEPOIS do middleware de CORS: o BootCheck do frontend chama
// esta rota via fetch() do browser, e sem os headers de CORS a resposta
// (mesmo com 200) fica bloqueada para leitura pelo JS — parecendo "API inacessível".
app.get('/health', async (req, res) => {
  try {
    const db = require('./config/database');
    await db.query('SELECT 1');
    return res.json({ status: 'ok', database: 'ok' });
  } catch (err) {
    return res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});

app.use(cookieParser());

// Aviso explícito se o segredo JWT for fraco (configuração errada em produção)
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.warn('[AVISO] JWT_SECRET ausente ou fraco em produção. Troque por um segredo aleatório com 48+ bytes.');
}

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
// Rejeita antes de qualquer rota: origens não autorizadas recebem 403 (não 500) e
// pedidos cross-origin com cookies são bloqueados de verdade (defesa anti-CSRF).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    console.warn(`[CORS] Origin denied: ${origin}`);
    return res.status(403).json({ message: 'Origem não autorizada.' });
  }
  next();
});
app.use(cors({
  origin: allowedOrigins,
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

// Inscrição pública cria contas e faz upload de ficheiros → limite apertado por IP
// (global apiLimiter=300/15min não travaria abuso de criação de contas)
const publicInscricaoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ message: 'Demasiadas inscrições. Tente novamente mais tarde.' }),
});
app.use('/api/public/inscricoes', publicInscricaoLimiter);

app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson.call(this, data);
  };
  next();
});

app.get('/api/test', (req, res) => res.json({ message: 'Backend OK!' }));

// Respostas autenticadas contêm dados pessoais → nunca guardar em cache (browser/proxy)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

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

const { ensureSchema } = require('./utils/ensureSchema');
const { ensureIndexes } = require('./utils/ensureIndexes');

Promise.all([ensureSchema(), ensureIndexes()])
  .then(() => app.listen(PORT, () => logStart(PORT)))
  .catch((err) => {
    console.error('[DB] Falha ao preparar o esquema do banco:', err.message);
    console.warn('[DB] O servidor inicia mesmo assim — o middleware de sessão poderá falhar até a coluna token_version existir.');
    app.listen(PORT, () => logStart(PORT));
  });

function logStart(port) {
  console.log(`\n📁 CWD: ${process.cwd()}`);
  console.log(`\n🎓 Servidor rodando em: http://localhost:${port}`);
  console.log(`📡 API disponível em: http://localhost:${port}/api`);
  console.log(`🌐 FRONTEND_URL: ${process.env.FRONTEND_URL}`);
  console.log(`☁️ CLOUDINARY: ${process.env.CLOUDINARY_CLOUD_NAME}`);
}
