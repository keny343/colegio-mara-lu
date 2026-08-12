const db = require('../config/database');

// Migrações idempotentes. Cada entrada é executada apenas se a coluna/tabela ainda não existir.
const MIGRATIONS = [
  // Versão do token: usada para invalidar todas as sessões quando a senha é alterada.
  `ALTER TABLE usuarios ADD COLUMN token_version INT NOT NULL DEFAULT 1`,
  // updated_at: base do locking otimista (deteta edições concorrentes e previne perda de dados).
  `ALTER TABLE series ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE inscricoes ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE alunos ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
];

// Backfill: registos antigos ficam sem updated_at até à primeira edição (ON UPDATE).
// Para que o cliente já receba uma versão inicial, preenche os NULL com o momento atual.
const BACKFILLS = [
  'UPDATE series SET updated_at = NOW() WHERE updated_at IS NULL',
  'UPDATE inscricoes SET updated_at = NOW() WHERE updated_at IS NULL',
  'UPDATE alunos SET updated_at = NOW() WHERE updated_at IS NULL',
];

async function ensureSchema() {
  for (const sql of MIGRATIONS) {
    try {
      await db.query(sql);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_DUP_COLNAME') throw err;
    }
  }
  for (const sql of BACKFILLS) {
    try {
      await db.query(sql);
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
    }
  }
}

module.exports = { ensureSchema };
