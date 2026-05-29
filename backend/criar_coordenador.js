const bcrypt = require('bcryptjs');
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Kenykeny1()',
  database: 'colegio_mara_lu'
});

const coordenador = {
  nome: 'Coordenador Teste',
  email: 'coordenador@gmail.com',
  senha: '123456',
  role: 'coordenador'
};

async function criarCoordenador() {
  const hash = await bcrypt.hash(coordenador.senha, 10);

  const sql = `
    INSERT INTO usuarios (nome, email, senha, role, ativo)
    VALUES (?, ?, ?, ?, 1)
  `;

  db.query(sql, [coordenador.nome, coordenador.email, hash, coordenador.role], (err) => {
    if (err) {
      console.error('Erro coordenador:', err);
      return;
    }

    console.log('✅ Coordenador criado!');
    process.exit();
  });
}

criarCoordenador();