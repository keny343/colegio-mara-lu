const { agruparRelatorioAlunos } = require('../src/domain/RelatorioAlunosService');

const linhaBase = (overrides = {}) => ({
  matricula_id: 101,
  aluno_id: 11,
  aluno_nome: 'Ana Silva',
  turma_id: 5,
  turma_nome: 'Turma A',
  serie_classe: 7,
  curso_nome: null,
  ano_letivo: 2026,
  matricula_status: 'ativa',
  data_matricula: '2026-01-15T00:00:00.000Z',
  disciplina_id: 2,
  disciplina_nome: 'Matemática',
  periodo: null,
  nota: null,
  ...overrides,
});

describe('agruparRelatorioAlunos', () => {
  test('groups grades by enrollment and calculates subject and overall averages', () => {
    const alunos = agruparRelatorioAlunos([
      linhaBase({ disciplina_id: 1, disciplina_nome: 'Português', periodo: '1PP', nota: '8' }),
      linhaBase({ disciplina_id: 1, disciplina_nome: 'Português', periodo: '1PT', nota: '10' }),
      linhaBase({ disciplina_id: 2, disciplina_nome: 'Matemática', periodo: '1PP', nota: '6' }),
      linhaBase({ matricula_id: 102, aluno_id: 12, aluno_nome: 'Bruno Costa', disciplina_id: null }),
    ]);

    expect(alunos).toHaveLength(2);
    expect(alunos[0]).toMatchObject({
      matricula_id: 101,
      aluno_nome: 'Ana Silva',
      total_disciplinas: 2,
      total_disciplinas_com_notas: 2,
      total_notas_lancadas: 3,
      media_geral: '7.5',
    });
    expect(alunos[0].disciplinas).toEqual([
      expect.objectContaining({
        disciplina_nome: 'Matemática',
        periodos: expect.objectContaining({ '1PP': 6, '1PT': null }),
        media: '6.0',
        total_notas_lancadas: 1,
      }),
      expect.objectContaining({
        disciplina_nome: 'Português',
        periodos: expect.objectContaining({ '1PP': 8, '1PT': 10 }),
        media: '9.0',
        total_notas_lancadas: 2,
      }),
    ]);
    expect(alunos[1]).toMatchObject({
      matricula_id: 102,
      total_disciplinas: 0,
      total_notas_lancadas: 0,
      media_geral: null,
    });
  });

  test('returns an empty list when there are no rows', () => {
    expect(agruparRelatorioAlunos()).toEqual([]);
  });
});
