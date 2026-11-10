import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

import CoordenadorNotas from './CoordenadorNotas';
import api from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

// O utilizador tem de ser a MESMA referência em todos os renders (a página usa-o em dependências de useEffect).
const mockContexto = { user: { id: 1, role: 'admin', nome: 'Admin' } };
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockContexto,
}));

jest.mock('../components/RelatorioNotasBotoes', () => ({
  __esModule: true,
  default: () => null,
}));

const pautaCom = (faltam) => ({
  turma: { id: 1, nome: '10ª A', serie_classe: 10 },
  config_avaliacao: { exame_nacional: false, defesa_final: false },
  disciplinas: [{ id: 1, nome: 'Programação' }],
  alunos: [{
    matricula_id: 1,
    aluno_nome: 'Aluno Um',
    disciplinas: [],
    resultado: 'incompleto',
    negativas: [],
    disciplinas_incompletas: faltam.length
      ? [{ disciplina_id: 1, nome: 'Programação', periodos_em_falta: faltam }]
      : [],
  }],
});

describe('CoordenadorNotas — pendências da pauta', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  test('guardar uma nota remove logo essa pendência da lista "faltam"', async () => {
    let faltam = ['1PT', '2PP', '2PT', '3PP', '3PT'];
    api.get.mockImplementation((url) => {
      if (url === '/staff/turmas') {
        return Promise.resolve({ data: [{ id: 1, nome: '10ª A', serie_classe: 10, ano_letivo: 2026 }] });
      }
      if (url === '/staff/turmas/1/disciplinas') return Promise.resolve({ data: [{ id: 1, nome: 'Programação' }] });
      if (url === '/staff/turmas/1/pauta') return Promise.resolve({ data: pautaCom(faltam) });
      if (url === '/staff/turmas/1/notas/1') {
        return Promise.resolve({
          data: {
            limites: { min: 0, max: 20 },
            turma: { serie_classe: 10 },
            pode_alterar_como_coordenador: false,
            alunos: [{ matricula_id: 1, aluno_nome: 'Aluno Um', periodos: { '1PP': 12 } }],
          },
        });
      }
      return Promise.reject(new Error(`GET inesperado: ${url}`));
    });
    api.post.mockImplementation(() => {
      faltam = faltam.filter((p) => p !== '1PT'); // o backend passa a ter a nota 1PT
      return Promise.resolve({ data: {} });
    });

    const { container } = render(<CoordenadorNotas />);

    await waitFor(() => expect(container.querySelector('#cn-turma')).toBeTruthy());
    fireEvent.change(container.querySelector('#cn-turma'), { target: { value: '1' } });
    expect(await screen.findByText(/Programação: faltam 1PT, 2PP, 2PT, 3PP, 3PT/)).toBeTruthy();

    await waitFor(() => expect(container.querySelector('#cn-disciplina option[value="1"]')).toBeTruthy());
    fireEvent.change(container.querySelector('#cn-disciplina'), { target: { value: '1' } });

    const inputTrimestral = await screen.findByLabelText(/Guardar nota de Aluno Um \(Trimestral\)/)
      .then((btn) => btn.closest('.nota-celula').querySelector('input'));
    fireEvent.change(inputTrimestral, { target: { value: '15' } });
    fireEvent.click(screen.getByLabelText(/Guardar nota de Aluno Um \(Trimestral\)/));

    // A pendência 1PT desaparece sem recarregar a página nem mudar de turma.
    expect(await screen.findByText(/Programação: faltam 2PP, 2PT, 3PP, 3PT/)).toBeTruthy();
    expect(screen.queryByText(/faltam 1PT/)).toBeNull();
    expect(api.post).toHaveBeenCalledWith('/staff/notas', expect.objectContaining({ periodo: '1PT', nota: 15 }));
  });

  test('a pendência sai de imediato, antes de o servidor responder à nova pauta', async () => {
    let guardou = false;
    api.get.mockImplementation((url) => {
      if (url === '/staff/turmas') {
        return Promise.resolve({ data: [{ id: 1, nome: '10ª A', serie_classe: 10, ano_letivo: 2026 }] });
      }
      if (url === '/staff/turmas/1/disciplinas') return Promise.resolve({ data: [{ id: 1, nome: 'Programação' }] });
      if (url === '/staff/turmas/1/pauta') {
        // Depois de guardar, o servidor "demora": a lista só pode mudar por atualização imediata.
        return guardou ? new Promise(() => {}) : Promise.resolve({ data: pautaCom(['1PT', '2PP']) });
      }
      if (url === '/staff/turmas/1/notas/1') {
        return Promise.resolve({
          data: {
            limites: { min: 0, max: 20 },
            turma: { serie_classe: 10 },
            pode_alterar_como_coordenador: false,
            alunos: [{ matricula_id: 1, aluno_nome: 'Aluno Um', periodos: { '1PP': 12 } }],
          },
        });
      }
      return Promise.reject(new Error(`GET inesperado: ${url}`));
    });
    api.post.mockImplementation(() => { guardou = true; return Promise.resolve({ data: {} }); });

    const { container } = render(<CoordenadorNotas />);
    await waitFor(() => expect(container.querySelector('#cn-turma')).toBeTruthy());
    fireEvent.change(container.querySelector('#cn-turma'), { target: { value: '1' } });
    expect(await screen.findByText(/Programação: faltam 1PT, 2PP/)).toBeTruthy();

    await waitFor(() => expect(container.querySelector('#cn-disciplina option[value="1"]')).toBeTruthy());
    fireEvent.change(container.querySelector('#cn-disciplina'), { target: { value: '1' } });

    const botao = await screen.findByLabelText(/Guardar nota de Aluno Um \(Trimestral\)/);
    fireEvent.change(botao.closest('.nota-celula').querySelector('input'), { target: { value: '15' } });
    fireEvent.click(botao);

    expect(await screen.findByText(/Programação: faltam 2PP/)).toBeTruthy();
    expect(screen.queryByText(/faltam 1PT/)).toBeNull();
  });
});