const {
  podeAcederNotas,
  podeAcederInformacaoGeral,
  coordenadorPodeGerirTurma,
  validarNota,
  limitesNota,
  situacaoAprovacao,
  situacaoFinalAluno,
  mediaPeriodos,
} = require('../src/utils/academicoRules');

describe('RBAC helpers', () => {
  test('admin accesses grades and general info', () => {
    const admin = { role: 'admin' };
    expect(podeAcederNotas(admin)).toBe(true);
    expect(podeAcederInformacaoGeral(admin)).toBe(true);
  });

  test('coordenador without scope is denied general info', () => {
    const coord = { role: 'coordenador' };
    expect(podeAcederNotas(coord)).toBe(false);
    expect(podeAcederInformacaoGeral(coord)).toBe(false);
  });

  test('coordenador with ciclo1 scope manages series 0–6 only', () => {
    const coord = { role: 'coordenador', nivel_coordenado: '1º ciclo' };
    expect(podeAcederInformacaoGeral(coord)).toBe(true);
    expect(coordenadorPodeGerirTurma(coord, { serie_classe: 4 })).toBe(true);
    expect(coordenadorPodeGerirTurma(coord, { serie_classe: 8 })).toBe(false);
  });

  test('aluno cannot access grades module', () => {
    expect(podeAcederNotas({ role: 'aluno' })).toBe(false);
  });
});

describe('grade validation', () => {
  test('primary scale is 0–10', () => {
    expect(limitesNota(3)).toEqual({ min: 0, max: 10 });
    expect(validarNota(11, 3).ok).toBe(false);
    expect(validarNota(8, 3)).toEqual({ ok: true, value: 8 });
  });

  test('secondary scale is 0–20', () => {
    expect(limitesNota(10)).toEqual({ min: 0, max: 20 });
    expect(validarNota(18, 10).ok).toBe(true);
  });
});

describe('approval rules', () => {
  const fullPrimaryPass = {
    '1PP': 6, '1PT': 6, '2PP': 6, '2PT': 6, '3PP': 6, '3PT': 6,
  };
  const fullPrimaryFail = {
    '1PP': 3, '1PT': 3, '2PP': 3, '2PT': 3, '3PP': 3, '3PT': 3,
  };

  test('situacaoAprovacao waits for all periods', () => {
    expect(situacaoAprovacao({ '1PP': 8 }, 5)).toBeNull();
  });

  test('situacaoAprovacao uses primary threshold 5', () => {
    expect(situacaoAprovacao(fullPrimaryPass, 5)).toBe('aprovado');
    expect(situacaoAprovacao(fullPrimaryFail, 5)).toBe('reprovado');
    expect(mediaPeriodos(fullPrimaryPass)).toBe('6.0');
  });

  test('primary class fails with any failed subject (no recurso)', () => {
    const result = situacaoFinalAluno(
      [
        { nome: 'Matemática', situacao: 'aprovado' },
        { nome: 'Ciências', situacao: 'reprovado' },
      ],
      4
    );
    expect(result.resultado).toBe('reprovado');
  });

  test('7ª–9ª allows recurso with one failed subject', () => {
    const result = situacaoFinalAluno(
      [
        { nome: 'História', situacao: 'aprovado' },
        { nome: 'Geografia', situacao: 'reprovado' },
      ],
      8
    );
    expect(result.resultado).toBe('recurso');
  });
});
