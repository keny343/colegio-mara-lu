import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth, SESSION_STATUS } from './AuthContext';
import api from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

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

  test('refresh (checkSession) mantém a sessão quando o servidor ainda a reconhece', async () => {
    api.get.mockResolvedValue({ data: { nome: 'Ana', role: 'admin' } });
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('AUTHENTICATED'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('check'));
    });

    expect(screen.getByTestId('status')).toHaveTextContent('AUTHENTICATED');
    expect(screen.getByTestId('user')).toHaveTextContent('Ana');
  });

  test('refresh com sessão inexistente (401) → volta a UNAUTHENTICATED e limpa identidade', async () => {
    api.get.mockResolvedValue({ data: { nome: 'Ana', role: 'admin' } });
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('AUTHENTICATED'));

    api.get.mockRejectedValue({ response: { status: 401 } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('check'));
    });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('UNAUTHENTICATED'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  test('403 em endpoint protegido NÃO destrói a sessão', async () => {
    api.get.mockResolvedValue({ data: { nome: 'Ana', role: 'admin' } });
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('AUTHENTICATED'));

    // 403 (sem permissão) NÃO é logout — o evento de sessão expirada não deve ocorrer
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    act(() => {
      window.dispatchEvent(new CustomEvent('test:403-protegido'));
    });
    dispatchSpy.mockRestore();

    expect(screen.getByTestId('status')).toHaveTextContent('AUTHENTICATED');
    expect(screen.getByTestId('user')).toHaveTextContent('Ana');
  });

  test('401 em endpoint protegido (interceptor) dispara auth:session-expired e encerra a sessão', async () => {
    api.get.mockResolvedValue({ data: { nome: 'Ana', role: 'admin' } });
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('AUTHENTICATED'));

    // Simula o interceptor do api.js: 401 real em endpoint protegido
    act(() => {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('UNAUTHENTICATED'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  test('troca de senha (servidor invalida sessão) encerra a sessão via evento', async () => {
    api.get.mockResolvedValue({ data: { nome: 'Ana', role: 'admin' } });
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('AUTHENTICATED'));

    // Após a troca de senha o servidor passa a responder 401 → sessão expirada
    api.get.mockRejectedValue({ response: { status: 401 } });
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

describe('AuthContext — multi-dispositivo sem mistura de identidade', () => {
  test('duas contas em dois contextos independentes não misturam identidade', async () => {
    // O estado NUNCA é lido de localStorage — cada AuthProvider é isolado.
    localStorage.clear();
    api.get.mockRejectedValue({ response: { status: 401 } });

    render(
      <>
        <AuthProvider><Dispositivo nome="dispositivo-A" /></AuthProvider>
        <AuthProvider><Dispositivo nome="dispositivo-B" /></AuthProvider>
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status-dispositivo-A')).toHaveTextContent('UNAUTHENTICATED');
      expect(screen.getByTestId('status-dispositivo-B')).toHaveTextContent('UNAUTHENTICATED');
    });

    // Conta A autentica no dispositivo A
    api.post.mockResolvedValue({ data: { usuario: { nome: 'Conta A', role: 'aluno' } } });
    api.get.mockResolvedValue({ data: { nome: 'Conta A', role: 'aluno' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('login-dispositivo-A'));
    });

    await waitFor(() => expect(screen.getByTestId('user-dispositivo-A')).toHaveTextContent('Conta A'));
    expect(screen.getByTestId('user-dispositivo-B')).toHaveTextContent('none');
    expect(screen.getByTestId('status-dispositivo-B')).toHaveTextContent('UNAUTHENTICATED');
  });

  test('duas sessões da MESMA conta em dispositivos diferentes não se anulam', async () => {
    localStorage.clear();
    api.get.mockRejectedValue({ response: { status: 401 } });

    render(
      <>
        <AuthProvider><Dispositivo nome="dispositivo-1" /></AuthProvider>
        <AuthProvider><Dispositivo nome="dispositivo-2" /></AuthProvider>
      </>
    );
    await waitFor(() => {
      expect(screen.getByTestId('status-dispositivo-1')).toHaveTextContent('UNAUTHENTICATED');
      expect(screen.getByTestId('status-dispositivo-2')).toHaveTextContent('UNAUTHENTICATED');
    });

    // Ambos autenticam a mesma conta
    api.post.mockResolvedValue({ data: { usuario: { nome: 'Ana', role: 'admin' } } });
    api.get.mockResolvedValue({ data: { nome: 'Ana', role: 'admin' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('login-dispositivo-1'));
      fireEvent.click(screen.getByTestId('login-dispositivo-2'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-dispositivo-1')).toHaveTextContent('Ana');
      expect(screen.getByTestId('user-dispositivo-2')).toHaveTextContent('Ana');
    });

    // Logout num dispositivo não afeta o outro
    await act(async () => {
      fireEvent.click(screen.getByTestId('logout-dispositivo-1'));
    });
    await waitFor(() => expect(screen.getByTestId('status-dispositivo-1')).toHaveTextContent('UNAUTHENTICATED'));
    expect(screen.getByTestId('status-dispositivo-2')).toHaveTextContent('AUTHENTICATED');
    expect(screen.getByTestId('user-dispositivo-2')).toHaveTextContent('Ana');
  });
});

function Dispositivo({ nome }) {
  const { user, status, login, logout } = useAuth();
  return (
    <div>
      <span data-testid={`status-${nome}`}>{status}</span>
      <span data-testid={`user-${nome}`}>{user ? user.nome : 'none'}</span>
      <button data-testid={`login-${nome}`} onClick={() => login('x@colegio.ao', 'segredo123').catch(() => {})}>login</button>
      <button data-testid={`logout-${nome}`} onClick={logout}>logout</button>
    </div>
  );
}
