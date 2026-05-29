const bcrypt = require('bcryptjs');
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Kenykeny1()',
  database: 'colegio_mara_lu'
});

const professor = {
  nome: 'Professor Teste',
  email: 'professor@gmail.com',
  senha: '123456',
  role: 'professor'
};

async function criarProfessor() {
  const hash = await bcrypt.hash(professor.senha, 10);

  const sql = `
    INSERT INTO usuarios (nome, email, senha, role, ativo)
    VALUES (?, ?, ?, ?, 1)
  `;

  db.query(sql, [professor.nome, professor.email, hash, professor.role], (err) => {
    if (err) {
      console.error('Erro professor:', err);
      return;
    }

    console.log('✅ Professor criado!');
    process.exit();
  });
}

criarProfessor();