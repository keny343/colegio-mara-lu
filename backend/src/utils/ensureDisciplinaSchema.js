const db = require('../config/database');

let ensured = false;

/** Garante a coluna disciplina_chave (nuclear) na tabela disciplinas. */
async function ensureDisciplinaChaveSchema() {
  if (ensured) return;
  try {
    await db.query(`
      ALTER TABLE disciplinas
      ADD COLUMN disciplina_chave TINYINT(1) NOT NULL DEFAULT 0
    `);
  } catch (err) {
    // ER_DUP_FIELDNAME = coluna já existe, ok ignorar
    if (err.code !== 'ER_DUP_FIELDNAME') {
      console.warn('[ensureDisciplinaChaveSchema]', err.message);
    }
  }
  ensured = true;
}

module.exports = { ensureDisciplinaChaveSchema };