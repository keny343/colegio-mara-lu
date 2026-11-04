import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Relatorios from './Relatorios';
import { useFetch } from '../hooks/useFetch';
import { baixarCsv } from '../utils/relatoriosCsv';

jest.mock('../hooks/useFetch', () => ({ useFetch: jest.fn() }));
jest.mock('../utils/relatoriosCsv', () => ({ baixarCsv: jest.fn() }));

const relatorio = {
  ano_letivo: 2026,
  anos_letivos: ['2026'],
  alunos: [
    {
      matricula_id: 12,
      aluno_id: 21,
      ano_letivo: 2026,
      matricula_status: 'ativa',
      data_matricula: '2026-01-15T00:00:00.000Z',
      aluno_nome: 'Joana Demo',
      turma_id: 4,
      turma_nome: '10A',
      serie_classe: 10,
      curso_nome: 'Ciências',
      total_disciplinas: 1,
      total_disciplinas_com_notas: 1,
      total_notas_lancadas: 2,
      media_geral: '12.5',
      disciplinas: [
        {
          disciplina_id: 8,
          disciplina_nome: 'Matemática',
          periodos: { '1PP': 12, '1PT': 13, '2PP': null, '2PT': null, '3PP': null, '3PT': null },
          media: '12.5',
          total_notas_lancadas: 2,
        },
      ],
    },
  ],
};

describe('Relatorios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFetch.mockReturnValue({ data: relatorio, loading: false, error: null, refetch: jest.fn() });
    jest.spyOn(window, 'print').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('alterna entre matrículas e notas e disponibiliza os exports', () => {
    render(<Relatorios />);

    expect(screen.getByRole('heading', { name: 'Relatórios escolares' })).toBeInTheDocument();
    expect(screen.getByText('Joana Demo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /notas por disciplina/i }));
    expect(screen.getByText('Matemática')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /descarregar csv/i }));
    expect(baixarCsv).toHaveBeenCalledWith(
      'relatorio-notas-2026.csv',
      expect.any(Array),
      expect.arrayContaining([expect.arrayContaining(['Joana Demo', '10A'])])
    );

    fireEvent.click(screen.getByRole('button', { name: /imprimir \/ pdf/i }));
    expect(window.print).toHaveBeenCalledTimes(1);
  });
});
