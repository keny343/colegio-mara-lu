/**
 * Cria tabelas académicas se ainda não existirem (para bases criadas antes do database.sql atual).
 * Execute: node scripts/migrate-academico.js
 */
const db = require('../src/config/database');

const statements = [
  `CREATE TABLE IF NOT EXISTS cursos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT,
    ativo TINYINT(1) DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS disciplinas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    curso_id INT,
    serie_min INT,
    serie_max INT,
    ativo TINYINT(1) DEFAULT 1,
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS turmas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    ano_letivo YEAR NOT NULL,
    serie_classe INT NOT NULL,
    curso_id INT,
    turno ENUM('manhã','tarde','noite') DEFAULT 'manhã',
    ativo TINYINT(1) DEFAULT 1,
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS turma_professores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    turma_id INT NOT NULL,
    disciplina_id INT NOT NULL,
    professor_id INT NOT NULL,
    FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
    FOREIGN KEY (professor_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS matriculas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    aluno_id INT NOT NULL,
    turma_id INT NOT NULL,
    ano_letivo YEAR NOT NULL,
    status ENUM('ativa','transferida','concluida','cancelada') DEFAULT 'ativa',
    data_matricula TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
    FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS notas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    matricula_id INT NOT NULL,
    disciplina_id INT NOT NULL,
    periodo ENUM('1º','2º','3º','final') NOT NULL,
    nota DECIMAL(5,2) NOT NULL,
    professor_id INT NULL,
    data_lancamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
    FOREIGN KEY (professor_id) REFERENCES usuarios(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS faltas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    matricula_id INT NOT NULL,
    disciplina_id INT NOT NULL,
    data_falta DATE NOT NULL,
    justificativa TEXT,
    professor_id INT NULL,
    FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
    FOREIGN KEY (professor_id) REFERENCES usuarios(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS materiais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    turma_id INT NOT NULL,
    disciplina_id INT NOT NULL,
    professor_id INT NULL,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    arquivo_url VARCHAR(500),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
    FOREIGN KEY (professor_id) REFERENCES usuarios(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS horarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    turma_id INT NOT NULL,
    disciplina_id INT NOT NULL,
    dia_semana ENUM('segunda','terca','quarta','quinta','sexta','sabado') NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    sala VARCHAR(50),
    FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE
  )`,
];

const seedCursos = `
  INSERT INTO cursos (nome, descricao)
  SELECT v.nome, v.descricao
  FROM (
    SELECT 'Informática' AS nome, 'II ciclo — 13ª classe' AS descricao
    UNION ALL SELECT 'Ciências Físicas e Biológicas', NULL
    UNION ALL SELECT 'Ciências Económicas e Jurídicas', NULL
  ) v
  WHERE NOT EXISTS (SELECT 1 FROM cursos c WHERE c.nome = v.nome LIMIT 1)
`;

(async () => {
  try {
    for (const sql of statements) {
      await db.query(sql);
    }
    await db.query(seedCursos);
    console.log('OK: tabelas académicas verificadas/criadas; cursos iniciais garantidos.');
    process.exit(0);
  } catch (e) {
    console.error('Erro:', e.message);
    process.exit(1);
  }
})();
