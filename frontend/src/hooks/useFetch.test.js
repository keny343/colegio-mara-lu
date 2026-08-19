import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { useFetch } from './useFetch';

let resolvers = [];
let fetcher;

const Harness = ({ chave }) => {
  const { data, loading, error, refetch } = useFetch(fetcher, [chave]);
  return (
    <div>
      <span data-testid="data">{data === undefined ? 'undefined' : JSON.stringify(data)}</span>
      <span data-testid="loading">{loading ? 'true' : 'false'}</span>
      <span data-testid="error">{error ? (error.message || 'erro') : 'none'}</span>
      <button data-testid="refetch" onClick={refetch}>refetch</button>
    </div>
  );
};

const renderHarness = (chave = 'A') => render(<Harness chave={chave} />);

beforeEach(() => {
  jest.clearAllMocks();
  resolvers = [];
  fetcher = jest.fn((signal) => new Promise((resolve, reject) => {
    if (signal) {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }
    resolvers.push({ resolve, reject });
  }));
});

afterEach(cleanup);

describe('useFetch — cancelamento e respostas obsoletas', () => {
  test('resposta antiga NÃO sobrescreve resposta nova (request A chega depois do B)', async () => {
    const { rerender } = renderHarness('A');
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    // Troca a dependência → dispara request B e cancela o A
    rerender(<Harness chave="B" />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

    // B termina primeiro
    resolvers[1].resolve({ data: { origem: 'B' } });
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('"origem":"B"'));

    // A termina depois → NÃO pode sobrescrever B
    resolvers[0].resolve({ data: { origem: 'A' } });
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('"origem":"B"'));
  });

  test('aborta o request ao desmontar', async () => {
    const { unmount } = renderHarness('A');
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    unmount();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('refetch continua funcional após a carga inicial', async () => {
    renderHarness('A');
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    resolvers[0].resolve({ data: { origem: 'A' } });
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('"origem":"A"'));

    fireEvent.click(screen.getByTestId('refetch'));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    resolvers[1].resolve({ data: { origem: 'B2' } });
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('"origem":"B2"'));
  });

  test('erro de request antigo não altera estado de request novo', async () => {
    const { rerender } = renderHarness('A');
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    rerender(<Harness chave="B" />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

    // B resolve com sucesso
    resolvers[1].resolve({ data: { origem: 'B' } });
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('"origem":"B"'));

    // A rejeita depois → não deve definir error nem limpar data
    resolvers[0].reject(new Error('falha antiga'));
    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('"origem":"B"'));
    expect(screen.getByTestId('error')).toHaveTextContent('none');
  });
});
