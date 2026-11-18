const db = require('../config/database');

let ensured = false;

/**
 * Garante espaço para os códigos canónicos (1PP..3PT), complementares
 * (EXN, DEF, CH2, REC) e eventuais rótulos legados que precisam de auditoria.
 *
 * IMPORTANTE: não converter automaticamente '1º', '2º', '3º' ou 'final'.
 * Esses valores antigos não identificam de forma inequívoca a avaliação
 * parcial/trimestral. A conversão automática anterior deslocava '2º', '3º'
 * e 'final' para '1PT', contaminando as médias e ocultando dados inválidos.
 */
async function ensureNotasPeriodosSchema() {
  if (ensured) return;
  try {
    await db.query(`
      ALTER TABLE notas
      MODIFY COLUMN periodo VARCHAR(10) NOT NULL
    `);
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') {
      console.warn('[ensureNotasPeriodosSchema]', err.message);
      throw err;
    }
  }
  ensured = true;
}

module.exports = { ensureNotasPeriodosSchema };
