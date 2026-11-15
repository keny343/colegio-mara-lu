'use strict';

/**
 * Schema único do laboratório (fonte da verdade para JSONL, CSV, Avro, Parquet e SQL).
 * Domínio: notas lançadas a alunos do Colégio Mara e Lu (sistema angolano).
 * Espelha a tabela real `notas` (periodo 1PP..3PT, nota DECIMAL(5,2)) e as regras de
 * backend/src/utils/academicoRules.js (escala 0-10 até à 6ª classe, 0-20 da 7ª à 13ª;
 * nota mínima 5 e 10 respectivamente).
 *
 * As tabelas do laboratório usam o prefixo lab_ para NUNCA tocar nos dados reais.
 */

const PERIODOS = ['1PP', '1PT', '2PP', '2PT', '3PP', '3PT'];
const SITUACOES = ['positiva', 'negativa'];
const SEXOS = ['M', 'F'];

const TABLE_NOTAS = 'lab_notas';
const TABLE_ALUNOS = 'lab_alunos';
const TABLE_LEGADO = 'lab_transacoes';

// kind: int64 | int32 | enum | timestamp | decimal | string | text | json
const FIELDS = [
  { name: 'id', kind: 'int64', sql: 'BIGINT NOT NULL' },
  { name: 'aluno_id', kind: 'int64', sql: 'BIGINT NOT NULL' },
  { name: 'matricula_id', kind: 'int64', sql: 'BIGINT NOT NULL' },
  { name: 'turma_id', kind: 'int32', sql: 'INT NOT NULL' },
  { name: 'disciplina_id', kind: 'int32', sql: 'INT NOT NULL' },
  { name: 'professor_id', kind: 'int32', sql: 'INT NOT NULL' },
  { name: 'ano_letivo', kind: 'int32', sql: 'YEAR NOT NULL' },
  { name: 'serie_classe', kind: 'int32', sql: 'TINYINT NOT NULL' },
  { name: 'periodo', kind: 'enum', values: PERIODOS, sql: `ENUM(${PERIODOS.map((p) => `'${p}'`).join(',')}) NOT NULL` },
  { name: 'data_lancamento', kind: 'timestamp', sql: 'DATETIME NOT NULL' },
  { name: 'disciplina', kind: 'string', sql: 'VARCHAR(80) NOT NULL' },
  { name: 'nota', kind: 'decimal', precision: 5, scale: 2, sql: 'DECIMAL(5,2) NOT NULL' },
  { name: 'escala_max', kind: 'int32', sql: 'TINYINT NOT NULL' },
  { name: 'nota_minima', kind: 'int32', sql: 'TINYINT NOT NULL' },
  { name: 'situacao', kind: 'enum', values: SITUACOES, sql: `ENUM(${SITUACOES.map((p) => `'${p}'`).join(',')}) NOT NULL` },
  { name: 'observacao', kind: 'text', sql: 'TEXT NOT NULL' },
  { name: 'localizacao', kind: 'json', sql: 'JSON NOT NULL' },
  { name: 'metadados', kind: 'json', nullable: true, sql: 'JSON NULL' },
];

const FIELD_NAMES = FIELDS.map((f) => f.name);

const ALUNO_FIELDS = [
  { name: 'id', sql: 'BIGINT NOT NULL' },
  { name: 'nome', sql: 'VARCHAR(150) NOT NULL' },
  { name: 'sexo', sql: `ENUM('M','F') NOT NULL` },
  { name: 'data_nascimento', sql: 'DATE NOT NULL' },
  { name: 'nacionalidade', sql: 'VARCHAR(60) NOT NULL' },
  { name: 'serie_classe', sql: 'TINYINT NOT NULL' },
  { name: 'curso', sql: 'VARCHAR(80) NULL' },
  { name: 'turma_id', sql: 'INT NOT NULL' },
  { name: 'ano_letivo', sql: 'YEAR NOT NULL' },
];
const ALUNO_FIELD_NAMES = ALUNO_FIELDS.map((f) => f.name);

// ---------- SQL ----------

function sqlString(v) {
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function sqlValue(field, v) {
  if (v === null || v === undefined) return 'NULL';
  if (field.kind === 'json') return sqlString(JSON.stringify(v));
  if (field.kind === 'enum' || field.kind === 'string' || field.kind === 'text' || field.kind === 'timestamp') return sqlString(v);
  if (field.kind === 'decimal') return String(v);
  return String(Number(v));
}

function alunoSqlValue(name, v) {
  if (v === null || v === undefined) return 'NULL';
  if (['id', 'serie_classe', 'turma_id', 'ano_letivo'].includes(name)) return String(Number(v));
  return sqlString(v);
}

function notaRowSql(r) {
  return `(${FIELDS.map((f) => sqlValue(f, r[f.name])).join(',')})`;
}

function alunoRowSql(a) {
  return `(${ALUNO_FIELDS.map((f) => alunoSqlValue(f.name, a[f.name])).join(',')})`;
}

function createTablesSql() {
  const alunos = ALUNO_FIELDS.map((f) => `  ${f.name} ${f.sql}`).join(',\n');
  const notas = FIELDS.map((f) => `  ${f.name} ${f.sql}`).join(',\n');
  return [
    `CREATE TABLE ${TABLE_ALUNOS} (\n${alunos},\n  PRIMARY KEY (id),\n  KEY idx_lab_alunos_turma (turma_id)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE ${TABLE_NOTAS} (\n${notas},\n  PRIMARY KEY (id),\n  KEY idx_lab_notas_aluno (aluno_id),\n  KEY idx_lab_notas_disciplina (disciplina),\n  KEY idx_lab_notas_periodo (periodo),\n  CONSTRAINT fk_lab_notas_aluno FOREIGN KEY (aluno_id) REFERENCES ${TABLE_ALUNOS}(id) ON DELETE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ];
}

function dropTablesSql() {
  // ordem: filha (notas) antes da mãe (alunos); remove também a tabela da versão antiga do laboratório
  return [
    `DROP TABLE IF EXISTS ${TABLE_NOTAS}`,
    `DROP TABLE IF EXISTS ${TABLE_ALUNOS}`,
    `DROP TABLE IF EXISTS ${TABLE_LEGADO}`,
  ];
}

function sqlHeader(titulo, extra = []) {
  return [
    '-- ============================================================',
    `-- COLÉGIO MARA E LU — Laboratório de dados: ${titulo}`,
    ...extra.map((l) => `-- ${l}`),
    '-- Todas as tabelas têm o prefixo lab_ e NÃO alteram os dados reais do sistema.',
    '-- ============================================================',
    '',
  ].join('\n');
}

module.exports = {
  PERIODOS, SITUACOES, SEXOS, FIELDS, FIELD_NAMES, ALUNO_FIELDS, ALUNO_FIELD_NAMES,
  TABLE_NOTAS, TABLE_ALUNOS, TABLE_LEGADO,
  sqlString, notaRowSql, alunoRowSql, createTablesSql, dropTablesSql, sqlHeader,
};