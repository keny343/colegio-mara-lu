const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 49152;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const routes = require('./routes/index');
app.use('/api', routes);

app.get('/', (req, res) => res.json({ message: 'API Colégio Mara e Lu 🎓' }));

app.listen(PORT, () => {
  console.log(`\n📁 CWD: ${process.cwd()}`);
  console.log(`\n🎓 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`📡 API disponível em: http://localhost:${PORT}/api`);
  
});