const db = require('../config/database');

let ensured = false;

/** Garante coluna periodo VARCHAR e migra valores antigos (1º/2º → 1PP/1PT). */
async function ensureNotasPeriodosSchema() {
  if (ensured) return;
  try {
    await db.query(`
      ALTER TABLE notas
      MODIFY COLUMN periodo VARCHAR(10) NOT NULL
    `);
    await db.query(`
      UPDATE notas SET periodo = '1PP' WHERE periodo IN ('1º', '1o', '1')
    `);
    await db.query(`
      UPDATE notas SET periodo = '1PT' WHERE periodo IN ('2º', '2o', '2', '3º', '3o', 'final')
    `);
    await db.query(`
      ALTER TABLE notas
      MODIFY COLUMN periodo VARCHAR(3) NOT NULL
    `);
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') {
      console.warn('[ensureNotasPeriodosSchema]', err.message);
    }
  }
  ensured = true;
}

module.exports = { ensureNotasPeriodosSchema };
