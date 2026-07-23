const db = require('../config/database');

let ensured = false;

/**
 * Garante a tabela config_avaliacao: define, por classe (+curso opcional),
 * se a turma usa Exame Nacional (7ª prova) ou Defesa Final.
 * curso_id = NULL cobre classes sem curso (1ª–9ª).
 */
async function ensureConfigAvaliacaoSchema() {
  if (ensured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS config_avaliacao (
        id INT AUTO_INCREMENT PRIMARY KEY,
        serie_classe INT NOT NULL,
        curso_id INT NULL,
        exame_nacional TINYINT(1) NOT NULL DEFAULT 0,
        defesa_final TINYINT(1) NOT NULL DEFAULT 0,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.warn('[ensureConfigAvaliacaoSchema]', err.message);
  }
  ensured = true;
}

module.exports = { ensureConfigAvaliacaoSchema };