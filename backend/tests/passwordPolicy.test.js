const { validarSenha } = require('../src/utils/passwordPolicy');

describe('validarSenha', () => {
  test('rejects short passwords', () => {
    expect(validarSenha('Ab1')).toEqual({
      ok: false,
      message: 'A senha deve ter pelo menos 8 caracteres.',
    });
  });

  test('requires letters and numbers', () => {
    expect(validarSenha('abcdefgh').ok).toBe(false);
    expect(validarSenha('12345678').ok).toBe(false);
  });

  test('accepts compliant passwords', () => {
    expect(validarSenha('Senha123')).toEqual({ ok: true });
  });

  test('handles null/undefined', () => {
    expect(validarSenha(null).ok).toBe(false);
    expect(validarSenha(undefined).ok).toBe(false);
  });
});
