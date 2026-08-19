import React from 'react';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { NotificationProvider, useNotification } from './NotificationContext';
import { useAuth } from './AuthContext';
import api from '../services/api';

jest.mock('./AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

function Harness() {
  const { unreadCount } = useNotification();
  return <span data-testid="unread">{unreadCount}</span>;
}

function renderProvider() {
  return render(
    <NotificationProvider>
      <Harness />
    </NotificationProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  // jsdom default: hidden é false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
});

describe('NotificationContext — fonte única de notificações', () => {
  test('sem sessão → não faz polling nem altera o contador', () => {
    useAuth.mockReturnValue({ user: null });
    renderProvider();
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.getByTestId('unread')).toHaveTextContent('0');
  });

  test('com sessão → busca inicial e interval 30s (polling único centralizado)', async () => {
    useAuth.mockReturnValue({ user: { id: 1, nome: 'Ana', role: 'admin' } });
    api.get.mockResolvedValue({ data: [{ id: 1, lida: false }, { id: 2, lida: true }, { id: 3, lida: false }] });

    renderProvider();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/notificacoes');
      expect(screen.getByTestId('unread')).toHaveTextContent('2');
    });

    // Próximo ciclo de polling (30s) — apenas UM chamador, nenhum request duplicado por sidebar
    api.get.mockResolvedValue({ data: [] });
    act(() => {
      jest.advanceTimersByTime(30 * 1000);
    });
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('unread')).toHaveTextContent('0');
    });
  });

  test('aba oculta → polling pausado; ao voltar → busca imediata', async () => {
    useAuth.mockReturnValue({ user: { id: 1, nome: 'Ana', role: 'admin' } });
    api.get.mockResolvedValue({ data: [] });

    renderProvider();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));

    // Aba escondida: interval não dispara requests
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    act(() => {
      jest.advanceTimersByTime(2 * 30 * 1000);
    });
    expect(api.get).toHaveBeenCalledTimes(1);

    // Volta a ficar visível → refetch imediato
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  test('falha no fetch de notificações não quebra a aplicação (contador fica estável)', async () => {
    useAuth.mockReturnValue({ user: { id: 1, nome: 'Ana', role: 'admin' } });
    api.get.mockRejectedValue(new Error('network'));

    renderProvider();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByTestId('unread')).toHaveTextContent('0');
  });
});
