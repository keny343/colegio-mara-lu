-- ============================================
-- BANCO DE DADOS - COLÉGIO MARA E LU
-- Execute este script no MySQL Workbench ou CLI
-- ============================================

CREATE DATABASE IF NOT EXISTS colegio_mara_lu CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE colegio_mara_lu;

-- Tabela de Usuários (pais/responsáveis e admins)
CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  cpf VARCHAR(30) UNIQUE,
  endereco TEXT,
  role ENUM('aluno', 'admin', 'professor', 'coordenador') DEFAULT 'aluno',
  curso_coordenado VARCHAR(150) DEFAULT NULL,
  nivel_coordenado VARCHAR(100) DEFAULT NULL,
  ativo TINYINT(1) DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de Anos/Séries disponíveis
CREATE TABLE series (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  nivel VARCHAR(60) NOT NULL,
  curso VARCHAR(80),
  ordem INT DEFAULT 0,
  vagas_total INT DEFAULT 30,
  vagas_disponiveis INT DEFAULT 30,
  ano_letivo YEAR NOT NULL,
  ativo TINYINT(1) DEFAULT 1
);

-- Tabela de Alunos
CREATE TABLE alunos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  nome VARCHAR(150) NOT NULL,
  data_nascimento DATE NOT NULL,
  cpf VARCHAR(14),
  rg VARCHAR(20),
  sexo ENUM('M', 'F', 'Outro'),
  nacionalidade VARCHAR(60),
  nome_mae VARCHAR(150),
  nome_pai VARCHAR(150),
  responsavel VARCHAR(150),
  telefone_emergencia VARCHAR(20),
  necessidades_especiais TEXT,
  foto_url VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabela de Inscrições
CREATE TABLE inscricoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  aluno_id INT NOT NULL,
  serie_id INT NOT NULL,
  ano_letivo YEAR NOT NULL,
  status ENUM('pendente', 'em_analise', 'aprovada', 'rejeitada', 'cancelada') DEFAULT 'pendente',
  observacao_admin TEXT,
  motivo_rejeicao TEXT,
  data_inscricao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (aluno_id) REFERENCES alunos(id),
  FOREIGN KEY (serie_id) REFERENCES series(id)
);

-- Tabela de Documentos
CREATE TABLE documentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inscricao_id INT NOT NULL,
  tipo ENUM('rg', 'cpf', 'certidao_nascimento', 'comprovante_residencia', 'historico_escolar', 'foto', 'outro') NOT NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  caminho_arquivo VARCHAR(500) NOT NULL,
  status ENUM('pendente', 'aprovado', 'rejeitado') DEFAULT 'pendente',
  observacao VARCHAR(255),
  enviado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inscricao_id) REFERENCES inscricoes(id) ON DELETE CASCADE
);

-- Tabela de Notificações
CREATE TABLE notificacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  remetente_id INT DEFAULT NULL,
  titulo VARCHAR(200) NOT NULL,
  mensagem TEXT NOT NULL,
  tipo VARCHAR(50) DEFAULT 'mensagem',
  lida TINYINT(1) DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (remetente_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ============================================
-- ESTRUTURA ACADÉMICA (Cursos, Disciplinas, Turmas)
-- ============================================

CREATE TABLE cursos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  descricao TEXT,
  ativo TINYINT(1) DEFAULT 1
);

CREATE TABLE disciplinas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  curso_id INT,
  serie_min INT,
  serie_max INT,
  ativo TINYINT(1) DEFAULT 1,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE SET NULL
);

CREATE TABLE turmas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  ano_letivo YEAR NOT NULL,
  serie_classe INT NOT NULL,
  curso_id INT,
  turno ENUM('manhã','tarde','noite') DEFAULT 'manhã',
  ativo TINYINT(1) DEFAULT 1,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE SET NULL
);

CREATE TABLE turma_professores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  turma_id INT NOT NULL,
  disciplina_id INT NOT NULL,
  professor_id INT NOT NULL,
  FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE,
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
  FOREIGN KEY (professor_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE matriculas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  aluno_id INT NOT NULL,
  turma_id INT NOT NULL,
  ano_letivo YEAR NOT NULL,
  status ENUM('ativa','transferida','concluida','cancelada') DEFAULT 'ativa',
  data_matricula TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
  FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE
);

CREATE TABLE notas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  matricula_id INT NOT NULL,
  disciplina_id INT NOT NULL,
  periodo VARCHAR(3) NOT NULL COMMENT '1PP,1PT,2PP,2PT,3PP,3PT',
  nota DECIMAL(5,2) NOT NULL,
  professor_id INT NULL,
  data_lancamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE,
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
  FOREIGN KEY (professor_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE faltas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  matricula_id INT NOT NULL,
  disciplina_id INT NOT NULL,
  data_falta DATE NOT NULL,
  justificativa TEXT,
  professor_id INT NULL,
  FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE,
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
  FOREIGN KEY (professor_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE materiais (
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
);

CREATE TABLE horarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  turma_id INT NOT NULL,
  disciplina_id INT NOT NULL,
  dia_semana ENUM('segunda','terca','quarta','quinta','sexta','sabado') NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  sala VARCHAR(50),
  FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE,
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE
);

-- Tabela de Justificações de Faltas
CREATE TABLE IF NOT EXISTS justificacoes_falta (
  id INT AUTO_INCREMENT PRIMARY KEY,
  falta_id INT NOT NULL,
  aluno_id INT NOT NULL,
  motivo TEXT NOT NULL,
  documento_path VARCHAR(500),
  documento_nome VARCHAR(255),
  status ENUM('pendente', 'aprovada', 'rejeitada') DEFAULT 'pendente',
  decisao_motivo TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (falta_id) REFERENCES faltas(id) ON DELETE CASCADE,
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
);

-- ============================================
-- DADOS INICIAIS
-- ============================================

-- Cursos iniciais
INSERT INTO cursos (nome, descricao) VALUES
('Informática', 'II ciclo — 13ª classe'),
('Ciências Físicas e Biológicas', NULL),
('Ciências Económicas e Jurídicas', NULL);

-- Séries disponíveis
INSERT INTO series (nome, nivel, curso, ordem, vagas_total, vagas_disponiveis, ano_letivo) VALUES
('Pré-escolar', 'Ensino Primário (pré até 6ª)', NULL, 0, 25, 25, 2025),
('1ª Classe', 'Ensino Primário (pré até 6ª)', NULL, 1, 30, 30, 2025),
('2ª Classe', 'Ensino Primário (pré até 6ª)', NULL, 2, 30, 30, 2025),
('3ª Classe', 'Ensino Primário (pré até 6ª)', NULL, 3, 30, 30, 2025),
('4ª Classe', 'Ensino Primário (pré até 6ª)', NULL, 4, 30, 30, 2025),
('5ª Classe', 'Ensino Primário (pré até 6ª)', NULL, 5, 30, 30, 2025),
('6ª Classe', 'Ensino Primário (pré até 6ª)', NULL, 6, 30, 30, 2025),
('7ª Classe', 'I Ciclo (Ensino Secundário 7ª–9ª)', NULL, 7, 35, 35, 2025),
('8ª Classe', 'I Ciclo (Ensino Secundário 7ª–9ª)', NULL, 8, 35, 35, 2025),
('9ª Classe', 'I Ciclo (Ensino Secundário 7ª–9ª)', NULL, 9, 35, 35, 2025),
('10ª Classe (Informática)', 'II Ciclo (Ensino Secundário 10ª–13ª)', 'Informática', 10, 40, 40, 2025),
('11ª Classe (Informática)', 'II Ciclo (Ensino Secundário 10ª–13ª)', 'Informática', 11, 40, 40, 2025),
('12ª Classe (Informática)', 'II Ciclo (Ensino Secundário 10ª–13ª)', 'Informática', 12, 40, 40, 2025),
('13ª Classe (Informática)', 'II Ciclo (Ensino Secundário 10ª–13ª)', 'Informática', 13, 40, 40, 2025),
('10ª Classe (Ciências Físicas e Biológicas)', 'II Ciclo (Ensino Secundário 10ª–13ª)', 'Ciências Físicas e Biológicas', 10, 40, 40, 2025),
('11ª Classe (Ciências Físicas e Biológicas)', 'II Ciclo (Ensino Secundário 10ª–13ª)', 'Ciências Físicas e Biológicas', 11, 40, 40, 2025),
('12ª Classe (Ciências Físicas e Biológicas)', 'II Ciclo (Ensino Secundário 10ª–13ª)', 'Ciências Físicas e Biológicas', 12, 40, 40, 2025),
('10ª Classe (Ciências Económicas e Jurídicas)', 'II Ciclo (Ensino Secundário 10ª–13ª)', 'Ciências Económicas e Jurídicas', 10, 40, 40, 2025),
('11ª Classe (Ciências Económicas e Jurídicas)', 'II Ciclo (Ensino Secundário 10ª–13ª)', 'Ciências Económicas e Jurídicas', 11, 40, 40, 2025),
('12ª Classe (Ciências Económicas e Jurídicas)', 'II Ciclo (Ensino Secundário 10ª–13ª)', 'Ciências Económicas e Jurídicas', 12, 40, 40, 2025);