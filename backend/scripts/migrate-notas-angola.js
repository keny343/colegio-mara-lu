/**
 * Migração: 6 períodos (3 trimestres × parcial + trimestral).
 * Execute: node backend/scripts/migrate-notas-angola.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../src/config/database');

async function run() {
  try {
    await db.query(`
      ALTER TABLE notas
      MODIFY COLUMN periodo VARCHAR(10) NOT NULL
    `);
    await db.query(`UPDATE notas SET periodo = '1PP' WHERE periodo IN ('1º', '1o', '1')`);
    await db.query(`UPDATE notas SET periodo = '1PT' WHERE periodo IN ('2º', '2o', '2', '3º', '3o', 'final')`);
    await db.query(`
      ALTER TABLE notas
      MODIFY COLUMN periodo VARCHAR(3) NOT NULL
    `);
    console.log('✓ Tabela notas actualizada: períodos 1PP, 1PT, 2PP, 2PT, 3PP, 3PT.');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

run();
