// The database column is enum('manha','tarde','noite'), so 'manha' is what comes
// back from the API. Capitalising it raw printed "Manha" on the portal header.
export const TURNOS = ['manha', 'tarde', 'noite'];

const ROTULOS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

export const normalizeTurno = (valor) => {
  const bruto = (valor == null ? '' : String(valor)).trim().toLowerCase();
  if (bruto.startsWith('man')) return 'manha';
  if (bruto.startsWith('tar')) return 'tarde';
  if (bruto.startsWith('noi')) return 'noite';
  return '';
};

/** Empty input gives an empty label, so callers can hide the field entirely. */
export const turnoLabel = (valor) => ROTULOS[normalizeTurno(valor)] || '';

export default turnoLabel;
