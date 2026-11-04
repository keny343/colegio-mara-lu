const {
  normalizarPeriodoKey,
  PERIODOS_VALIDOS,
  periodosCompletos,
  mediaPeriodos,
  situacaoAprovacao,
} = require('./academicoRules');

describe('regras de períodos académicos', () => {
  test('preserva códigos canónicos sem os deslocar', () => {
    for (const periodo of PERIODOS_VALIDOS) {
      expect(normalizarPeriodoKey(periodo)).toBe(periodo);
    }
  });

  test('não converte rótulos legados ambíguos para 1PP ou 1PT', () => {
    expect(normalizarPeriodoKey('1º')).toBe('1º');
    expect(normalizarPeriodoKey('2º')).toBe('2º');
    expect(normalizarPeriodoKey('3º')).toBe('3º');
    expect(normalizarPeriodoKey('final')).toBe('final');
    expect(periodosCompletos({ '1º': 12, '2º': 14, '3º': 15 })).toBe(false);
  });

  test('só considera completa a disciplina com os seis períodos canónicos', () => {
    const completos = {
      '1PP': 10, '1PT': 12, '2PP': 11,
      '2PT': 13, '3PP': 14, '3PT': 16,
    };
    expect(periodosCompletos(completos)).toBe(true);
    expect(periodosCompletos({ ...completos, '3PT': null })).toBe(false);
  });

  test('não calcula aprovação a partir de uma média parcial', () => {
    const parciais = { '1PP': 10, '1PT': 12, '2PP': 11, '2PT': 13 };
    expect(mediaPeriodos(parciais)).not.toBeNull();
    expect(situacaoAprovacao(parciais, 10)).toBeNull();
  });
});
