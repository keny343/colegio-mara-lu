const bcrypt = require('bcryptjs');
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Kenykeny1()',
  database: 'colegio_mara_lu'
});

const aluno = {
  nome: 'Aluno Teste',
  email: 'aluno@gmail.com',
  senha: '123456',
  role: 'aluno'
};

async function criarAluno() {
  const hash = await bcrypt.hash(aluno.senha, 10);

  const sql = `
    INSERT INTO usuarios (nome, email, senha, role, ativo)
    VALUES (?, ?, ?, ?, 1)
  `;

  db.query(sql, [aluno.nome, aluno.email, hash, aluno.role], (err) => {
    if (err) {
      console.error('Erro aluno:', err);
      return;
    }

    console.log('✅ Aluno criado!');
    process.exit();
  });
}

criarAluno();