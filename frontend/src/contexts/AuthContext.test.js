import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth, SESSION_STATUS } from './AuthContext';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import api from '../services/api';

function Harness() {
  const { user, status, login, logout, checkSession } = useAuth();
  const [loginError, setLoginError] = useState(null);
  const doLogin = () => {
    login('ana@colegio.ao', 'segredo123').catch((e) => setLoginError(e.message || 'erro'));
  };
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user ? user.nome : 'none'}</span>
      <span data-testid="err">{loginError || ''}</span>
      <button data-testid="login" onClick={doLogin}>login</button>
      <button data-testid="logout" onClick={logout}>logout</button>
      <button data-testid="check" onClick={checkSession}>check</button>
    </div>
  );
}

function renderHarness() {
  return render(
    <AuthProvider><Harness /></AuthProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('AuthContext — fluxo de sessão', () => {
  test('login só conclui depois de o servidor confirmar via /auth/perfil', async () => {
    api.get.mockRejectedValue({ response: { status: 401 } }); // verificação inicial: sem sessão
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('UNAUTHENTICATED'));

    api.post.mockResolvedValue({ data: { usuario: { nome: 'Ana', role: 'admin' } } });
    api.get.mockResolvedValue({ data: { nome: 'Ana', role: 'admin' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('login'));
    });

    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'ana@colegio.ao', senha: 'segredo123' });
    expect(api.get).toHaveBeenCalledWith('/auth/perfil');
    expect(screen.getByTestId('status')).toHaveTextContent('AUTHENTICATED');
    expect(screen.getByTestId('user')).toHaveTextContent('Ana');
  });

  test('credenciais erradas: login falha sem destruir o estado (continua UNAUTHENTICATED)', async () => {
    api.get.mockRejectedValue({ response: { status: 401 } });
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('UNAUTHENTICATED'));

    api.post.mockRejectedValue({ message: 'Request failed with status code 401' });

    await act(async () => {
      fireEvent.click(screen.getByTestId('login'));
    });

    await waitFor(() => expect(screen.getByTestId('err')).toHaveTextContent('Request failed'));
    expect(screen.getByTestId('status')).toHaveTextContent('UNAUTHENTICATED');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  test('erro de rede ao verificar sessão → estado ERROR (não vira logout)', async () => {
    api.get.mockRejectedValue({ request: {}, message: 'Network Error' });
    renderHarness();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ERROR'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  test('logout limpa a identidade e chama o endpoint', async () => {
    api.get.mockRejectedValue({ response: { status: 401 } });
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('UNAUTHENTICATED'));

    api.get.mockResolvedValue({ data: { nome: 'Ana', role: 'admin' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('check'));
    });
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('AUTHENTICATED'));

    api.post.mockResolvedValue({ data: {} });
    await act(async () => {
      fireEvent.click(screen.getByTestId('logout'));
    });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('UNAUTHENTICATED'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(api.post).toHaveBeenCalledWith('/auth/logout');
  });

  test('sessão expirada em tempo real (evento auth:session-expired) limpa a identidade', async () => {
    api.get.mockResolvedValue({ data: { nome: 'Ana', role: 'admin' } });
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('AUTHENTICATED'));

    act(() => {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('UNAUTHENTICATED'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  test('estados disponíveis na máquina de estados', () => {
    expect(SESSION_STATUS).toMatchObject({
      CHECKING: 'CHECKING_SESSION',
      AUTHENTICATED: 'AUTHENTICATED',
      UNAUTHENTICATED: 'UNAUTHENTICATED',
      ERROR: 'ERROR',
    });
  });
});
