const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 49152;

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
const additionalOrigins = (process.env.ADDITIONAL_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([frontendUrl, ...additionalOrigins]));

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

app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// Set UTF-8 charset header for all JSON responses
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson.call(this, data);
  };
  next();
});

app.get('/api/test', (req, res) => res.json({ message: 'Backend OK!' }));

app.get('/api/debug/usuarios', async (req, res) => {
  try {
    const db = require('./config/database');
    const [usuarios] = await db.query('SELECT id, nome, email, ativo, role FROM usuarios');
    return res.json(usuarios);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const routes = require('./routes/index');
app.use('/api', routes);

app.get('/', (req, res) => res.json({ message: 'API Colégio Mara e Lu 🎓' }));

app.listen(PORT, () => {
  console.log(`\n📁 CWD: ${process.cwd()}`);
  console.log(`\n🎓 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`📡 API disponível em: http://localhost:${PORT}/api`);
   console.log(`🌐 FRONTEND_URL: ${process.env.FRONTEND_URL}`);

  
});