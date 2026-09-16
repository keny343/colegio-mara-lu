/**
 * The `turmas.turno` column is enum('manha','tarde','noite') — no diacritic.
 * Writing 'manhã' only works because the live collation is accent-insensitive
 * (utf8mb4_0900_ai_ci); on an accent-sensitive one the insert is rejected. So the
 * database spelling is what gets stored, and the accented form is a label the UI
 * puts back on top.
 */
const TURNOS = ['manha', 'tarde', 'noite'];

const ROTULOS = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

/** Accepts anything a form or an older client may send, including 'manhã'. */
function normalizarTurno(valor) {
  const bruto = (valor == null ? '' : String(valor)).trim().toLowerCase();
  if (bruto.startsWith('man')) return 'manha';
  if (bruto.startsWith('tar')) return 'tarde';
  if (bruto.startsWith('noi')) return 'noite';
  return 'manha';
}

function rotuloTurno(valor) {
  return ROTULOS[normalizarTurno(valor)];
}

module.exports = { TURNOS, normalizarTurno, rotuloTurno };
