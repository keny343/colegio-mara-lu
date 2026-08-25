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
const isE2E = process.env.E2E_TEST === 'true';

// ============================================================
// PROTEÇÃO CONTRA E2E EM PRODUÇÃO
// ============================================================
//
// E2E_TEST aumenta temporariamente os rate limits para permitir
// que a suíte Playwright execute vários logins.
//
// Essa configuração NUNCA deve estar ativa em produção.
//
// Se alguém configurar acidentalmente E2E_TEST=true no Render,
// o backend será encerrado em vez de iniciar com proteção
// de rate limit reduzida.
// ============================================================

if (isProd && isE2E) {
  console.error(
    '[SEGURANÇA] E2E_TEST=true não pode ser utilizado em produção.'
  );
  console.error(
    '[SEGURANÇA] Remova E2E_TEST ou defina E2E_TEST=false antes de iniciar o servidor.'
  );
  process.exit(1);
}

// ============================================================
// PROXY
// ============================================================

// Render / Vercel / ambiente de desenvolvimento
app.set('trust proxy', 1);

// ============================================================
// CORS
// ============================================================

const frontendUrl = (
  process.env.FRONTEND_URL || 'http://localhost:3000'
)
  .trim()
  .replace(/\/+$/, '');

const additionalOrigins = (
  process.env.ADDITIONAL_ORIGINS || ''
)
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([
    frontendUrl,
    ...additionalOrigins,
  ])
);

// ============================================================
// REQUEST ID + LOG ESTRUTURADO
// ============================================================

app.use((req, res, next) => {
  const requestId =
    (
      req.headers['x-request-id'] &&
      String(req.headers['x-request-id']).slice(0, 64)
    ) ||
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
      user:
        req.user && req.user.id
          ? String(req.user.id)
          : null,
    };

    console.log(
      `[REQ] ${JSON.stringify(entry)}`
    );
  });

  next();
});

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', async (req, res) => {
  try {
    const db = require('./config/database');

    await db.query('SELECT 1');

    return res.json({
      status: 'ok',
      database: 'ok',
    });
  } catch (err) {
    console.error(
      '[HEALTH] Banco indisponível:',
      err.message
    );

    return res.status(503).json({
      status: 'degraded',
      database: 'unavailable',
    });
  }
});

// ============================================================
// COOKIES
// ============================================================

app.use(cookieParser());

// ============================================================
// JWT SECRET CHECK
// ============================================================

if (
  isProd &&
  (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32
  )
) {
  console.warn(
    '[AVISO] JWT_SECRET ausente ou fraco em produção. ' +
    'Use um segredo aleatório com pelo menos 48 bytes.'
  );
}

// ============================================================
// HELMET
// ============================================================

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: ["'self'"],

        styleSrc: ["'self'"],

        imgSrc: [
          "'self'",
          'data:',
        ],

        objectSrc: ["'none'"],

        frameAncestors: ["'none'"],

        baseUri: ["'self'"],

        formAction: ["'self'"],

        ...(isProd
          ? {
              upgradeInsecureRequests: [],
            }
          : {}),
      },
    },

    crossOriginEmbedderPolicy: false,
  })
);

// ============================================================
// CORS SECURITY CHECK
// ============================================================
//
// Rejeita origens que não estejam na allowlist.
// ============================================================

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (
    origin &&
    !allowedOrigins.includes(origin)
  ) {
    console.warn(
      `[CORS] Origin denied: ${origin}`
    );

    return res.status(403).json({
      message: 'Origem não autorizada.',
    });
  }

  next();
});

// ============================================================
// BODY LIMITS
// ============================================================

app.use(
  express.json({
    charset: 'utf-8',
    limit: '1mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    charset: 'utf-8',
    limit: '1mb',
  })
);

// ============================================================
// RATE LIMITING
// ============================================================
//
// PRODUÇÃO:
//
//   API geral       → 300 / 15 min
//   LOGIN           → 15 / 15 min
//   INSCRIÇÕES      → 10 / 15 min
//
// E2E:
//
//   API geral       → 1000 / 15 min
//   LOGIN           → 1000 / 15 min
//   INSCRIÇÕES      → 100 / 15 min
//
// IMPORTANTE:
//
// E2E_TEST=true deve ser utilizado APENAS no ambiente de testes.
//
// Nunca colocar E2E_TEST=true no Render de produção.
// ============================================================


// ============================================================
// LIMITADOR GLOBAL DA API
// ============================================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: isE2E
    ? 1000
    : 300,

  standardHeaders: 'draft-8',

  legacyHeaders: false,

  handler: (req, res) => {
    return res.status(429).json({
      message:
        'Demasiados pedidos. Tente novamente mais tarde.',
    });
  },
});

app.use(
  '/api',
  apiLimiter
);


// ============================================================
// LIMITADOR DE LOGIN
// ============================================================
//
// Protege contra:
//
// - brute force
// - credential stuffing
// - tentativas automáticas de password
//
// Produção: 15 / 15 minutos
// E2E:      1000 / 15 minutos
// ============================================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: isE2E
    ? 1000
    : 15,

  standardHeaders: 'draft-8',

  legacyHeaders: false,

  handler: (req, res) => {
    return res.status(429).json({
      message:
        'Demasiadas tentativas de login. ' +
        'Tente novamente em 15 minutos.',
    });
  },
});

app.use(
  '/api/auth/login',
  loginLimiter
);


// ============================================================
// LIMITADOR DE INSCRIÇÕES PÚBLICAS
// ============================================================
//
// Inscrições podem:
//
// - criar contas
// - enviar dados
// - fazer upload de documentos
//
// Por isso possuem limite próprio.
//
// Produção: 10 / 15 minutos
// E2E:      100 / 15 minutos
// ============================================================

const publicInscricaoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: isE2E
    ? 100
    : 10,

  standardHeaders: 'draft-8',

  legacyHeaders: false,

  handler: (req, res) => {
    return res.status(429).json({
      message:
        'Demasiadas inscrições. ' +
        'Tente novamente mais tarde.',
    });
  },
});

app.use(
  '/api/public/inscricoes',
  publicInscricaoLimiter
);

// ============================================================
// JSON RESPONSE HEADER
// ============================================================

app.use((req, res, next) => {
  const originalJson = res.json;

  res.json = function (data) {
    res.setHeader(
      'Content-Type',
      'application/json; charset=utf-8'
    );

    return originalJson.call(
      this,
      data
    );
  };

  next();
});

// ============================================================
// TEST API
// ============================================================

app.get('/api/test', (req, res) => {
  return res.json({
    message: 'Backend OK!',
  });
});

// ============================================================
// NO CACHE PARA API
// ============================================================
//
// Dados autenticados podem conter informações pessoais.
// ============================================================

app.use(
  '/api',
  (req, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store'
    );

    next();
  }
);

// ============================================================
// UPLOADS PÚBLICOS
// ============================================================
//
// Somente avatares legados ficam públicos.
// Documentos e materiais continuam protegidos
// pelos respectivos endpoints autenticados.
// ============================================================

app.use(
  '/uploads/avatars',
  express.static(
    path.join(
      __dirname,
      'uploads',
      'avatars'
    )
  )
);

// ============================================================
// ROTAS DA API
// ============================================================

const routes = require('./routes/index');

app.use(
  '/api',
  routes
);

// ============================================================
// API 404
// ============================================================

app.use(
  '/api',
  (req, res) => {
    return res.status(404).json({
      message: 'Endpoint não encontrado.',
    });
  }
);

// ============================================================
// ROOT
// ============================================================

app.get(
  '/',
  (req, res) => {
    return res.json({
      message:
        'API Colégio Mara e Lu 🎓',
    });
  }
);

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

// eslint-disable-next-line no-unused-vars
app.use(
  (err, req, res, next) => {
    console.error(
      `[ERRO] ${req.method} ${req.originalUrl}:`,
      err.message
    );

    // Upload demasiado grande
    if (
      err.code === 'LIMIT_FILE_SIZE'
    ) {
      return res.status(413).json({
        message:
          'Ficheiro demasiado grande.',
      });
    }

    // Corpo demasiado grande
    if (
      err.type === 'entity.too.large'
    ) {
      return res.status(413).json({
        message:
          'Corpo da requisição demasiado grande.',
      });
    }

    // Erros HTTP controlados
    if (
      err.status &&
      err.expose
    ) {
      return res.status(
        err.status
      ).json({
        message: err.message,
      });
    }

    // Erro genérico
    return res.status(500).json({
      message:
        'Erro interno do servidor.',
    });
  }
);

// ============================================================
// DATABASE INITIALIZATION
// ============================================================

const {
  ensureSchema,
} = require('./utils/ensureSchema');

const {
  ensureIndexes,
} = require('./utils/ensureIndexes');

Promise.all([
  ensureSchema(),
  ensureIndexes(),
])
  .then(() => {
    app.listen(
      PORT,
      () => {
        logStart(PORT);
      }
    );
  })
  .catch((err) => {
    console.error(
      '[DB] Falha ao preparar o esquema do banco:',
      err.message
    );

    console.warn(
      '[DB] O servidor inicia mesmo assim — ' +
      'o middleware de sessão poderá falhar até ' +
      'a coluna token_version existir.'
    );

    app.listen(
      PORT,
      () => {
        logStart(PORT);
      }
    );
  });

// ============================================================
// STARTUP LOG
// ============================================================

function logStart(port) {
  console.log(
    `\n📁 CWD: ${process.cwd()}`
  );

  console.log(
    `\n🎓 Servidor rodando em: http://localhost:${port}`
  );

  console.log(
    `📡 API disponível em: http://localhost:${port}/api`
  );

  console.log(
    `🌐 FRONTEND_URL: ${process.env.FRONTEND_URL || 'não definido'}`
  );

  console.log(
    `☁️ CLOUDINARY: ${
      process.env.CLOUDINARY_CLOUD_NAME ||
      'não configurado'
    }`
  );

  console.log(
    `🧪 E2E_TEST: ${
      isE2E
        ? 'ATIVO'
        : 'desativado'
    }`
  );

  console.log(
    `🔐 LOGIN RATE LIMIT: ${
      isE2E
        ? '1000'
        : '15'
    } / 15min`
  );

  console.log(
    `🛡️ API RATE LIMIT: ${
      isE2E
        ? '1000'
        : '300'
    } / 15min`
  );

  console.log(
    `📝 INSCRIÇÃO RATE LIMIT: ${
      isE2E
        ? '100'
        : '10'
    } / 15min`
  );
}