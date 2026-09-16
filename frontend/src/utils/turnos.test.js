import { turnoLabel, normalizeTurno } from './turnos';

describe('turnoLabel', () => {
  test('reads the stored value back with its diacritic', () => {
    expect(turnoLabel('manha')).toBe('Manhã');
  });

  test('labels the other shifts', () => {
    expect(turnoLabel('tarde')).toBe('Tarde');
    expect(turnoLabel('noite')).toBe('Noite');
  });

  test('gives nothing to show when the class has no shift', () => {
    expect(turnoLabel(null)).toBe('');
    expect(turnoLabel(undefined)).toBe('');
    expect(turnoLabel('')).toBe('');
  });
});

describe('normalizeTurno', () => {
  test('maps the accented form onto the value the select offers', () => {
    expect(normalizeTurno('manhã')).toBe('manha');
  });

  test('leaves an unknown shift empty rather than guessing morning', () => {
    expect(normalizeTurno('qualquer coisa')).toBe('');
  });
});
