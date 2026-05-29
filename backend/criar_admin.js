const bcrypt = require('bcryptjs');
const mysql = require('mysql2');

// 🔌 conexão com a base
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Kenykeny1()',
  database: 'colegio_mara_lu' // usa o nome correto da tua base
});

// 👤 dados do admin
const admin = {
  nome: 'Administrador',
  email: 'admin@gmail.com',
  senha: '123456',
  role: 'admin'
};

// 🔐 criar admin
async function criarAdmin() {
  try {
    const hash = await bcrypt.hash(admin.senha, 10);

    const sql = `
      INSERT INTO usuarios (nome, email, senha, role, ativo)
      VALUES (?, ?, ?, ?, 1)
    `;

    db.query(sql, [admin.nome, admin.email, hash, admin.role], (err, result) => {
      if (err) {
        console.error('Erro ao criar admin:', err);
        return;
      }

      console.log('✅ Admin criado com sucesso!');
      process.exit();
    });

  } catch (error) {
    console.error('Erro:', error);
  }
}

criarAdmin();