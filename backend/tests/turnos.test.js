const { TURNOS, normalizarTurno, rotuloTurno } = require('../src/utils/turnos');

describe('normalizarTurno', () => {
  test('stores the spelling the enum declares, not the accented one', () => {
    expect(normalizarTurno('manhã')).toBe('manha');
    expect(TURNOS).toContain(normalizarTurno('manhã'));
  });

  test('accepts the other shifts', () => {
    expect(normalizarTurno('tarde')).toBe('tarde');
    expect(normalizarTurno('noite')).toBe('noite');
  });

  test('tolerates casing, padding and truncated forms sent by older clients', () => {
    expect(normalizarTurno(' MANHÃ ')).toBe('manha');
    expect(normalizarTurno('Manha')).toBe('manha');
    expect(normalizarTurno('tar')).toBe('tarde');
  });

  test('falls back to the morning shift on anything unrecognisable', () => {
    for (const valor of [null, undefined, '', 'qualquer coisa', 42]) {
      expect(normalizarTurno(valor)).toBe('manha');
    }
  });

  test('never returns a value the column would reject', () => {
    for (const valor of ['manhã', 'MANHA', 'Tarde', 'noi', null, 'x']) {
      expect(TURNOS).toContain(normalizarTurno(valor));
    }
  });
});

describe('rotuloTurno', () => {
  test('puts the diacritic back for the reader', () => {
    expect(rotuloTurno('manha')).toBe('Manhã');
    expect(rotuloTurno('manhã')).toBe('Manhã');
    expect(rotuloTurno('tarde')).toBe('Tarde');
    expect(rotuloTurno('noite')).toBe('Noite');
  });
});
