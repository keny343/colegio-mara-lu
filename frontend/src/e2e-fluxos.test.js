import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Login from './pages/Login';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminInscricoes from './pages/AdminInscricoes';
import api from './services/api';

jest.mock('./services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

// App minimal que replica o fluxo real: /login público → /admin protegido
function App() {
  return (
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route
              path="/login"
              element={
                <PublicGuard>
                  <Login />
                </PublicGuard>
              }
            />
            <Route
              path="/admin"
              element={
                <PrivateGuard>
                  <AdminLayout>
                    <AdminDashboard />
                  </AdminLayout>
                </PrivateGuard>
              }
            />
            <Route
              path="/admin/inscricoes"
              element={
                <PrivateGuard>
                  <AdminLayout>
                    <AdminInscricoes />
                  </AdminLayout>
                </PrivateGuard>
              }
            />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

function PublicGuard({ children }) {
  const { user, status } = useAuth();
  if (status === 'ERROR') return <div data-testid="session-error">Erro de sessão</div>;
  if (user) return <Navigate to="/admin" replace />;
  return children;
}

function PrivateGuard({ children }) {
  const { user, status } = useAuth();
  if (status === 'ERROR') return <div data-testid="session-error">Erro de sessão</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Sem sessão inicial
  api.get.mockImplementation((url) => {
    if (url === '/auth/perfil') return Promise.reject({ response: { status: 401 } });
    return Promise.resolve({ data: [] });
  });
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

const adminSidebar = () => document.querySelector('.admin-sidebar');

describe('Fluxos críticos — Desktop (E2E de integração)', () => {
  test('login válido → dashboard admin → navegação na sidebar → logout', async () => {
    // Sessão inexistente no início
    api.get.mockImplementation((url) => {
      if (url === '/auth/perfil') return Promise.reject({ response: { status: 401 } });
      return Promise.resolve({ data: [] });
    });
    render(<App />);

    // Login
    await waitFor(() => expect(screen.getByLabelText(/E-mail ou BI/)).toBeInTheDocument());

    // Login confirmado pelo servidor
    api.post.mockImplementation((url) => {
      if (url === '/auth/login') return Promise.resolve({ data: { usuario: { nome: 'Ana', role: 'admin' } } });
      if (url === '/auth/logout') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });
    api.get.mockImplementation((url) => {
      if (url === '/auth/perfil') return Promise.resolve({ data: { nome: 'Ana', role: 'admin' } });
      if (url === '/admin/dashboard') return Promise.resolve({ data: { stats: {}, series: [] } });
      if (url === '/notificacoes') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    fireEvent.change(screen.getByLabelText(/E-mail ou BI/), { target: { value: 'ana@colegio.ao' } });
    fireEvent.change(screen.getByLabelText(/Senha/), { target: { value: 'segredo123' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar/ }));

    // Redireciona para /admin e mostra a sidebar desktop
    await waitFor(() => expect(adminSidebar()).not.toBeNull());
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument();

    // Navegação pela sidebar
    fireEvent.click(screen.getByRole('link', { name: /Inscrições/ }));
    await waitFor(() => expect(screen.getByRole('link', { name: /Inscrições/ })).toHaveClass('active'));

    // Botão sair na sidebar desktop
    const sair = adminSidebar().querySelector('button[aria-label="Sair"]');
    fireEvent.click(sair);
    await waitFor(() => expect(screen.getByLabelText(/E-mail ou BI/)).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/auth/logout');
  });

  test('senha errada mostra erro e mantém o utilizador deslogado', async () => {
    api.post.mockRejectedValue({ response: { status: 401 }, message: 'Request failed with status code 401' });
    render(<App />);

    await waitFor(() => expect(screen.getByLabelText(/E-mail ou BI/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/E-mail ou BI/), { target: { value: 'ana@colegio.ao' } });
    fireEvent.change(screen.getByLabelText(/Senha/), { target: { value: 'errada' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar/ }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText('Dashboard', { selector: '.admin-navlink' })).not.toBeInTheDocument();
  });
});

describe('Fluxos críticos — auth guard sem vazamento de identidade', () => {
  test('401 em endpoint protegido encerra a sessão (via auth:session-expired)', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/auth/perfil') return Promise.resolve({ data: { nome: 'Ana', role: 'admin' } });
      return Promise.resolve({ data: [] });
    });
    api.post.mockResolvedValue({ data: {} });
    render(<App />);

    // Usuário autenticado (checkSession inicial)
    await waitFor(() => expect(adminSidebar()).not.toBeNull());

    act(() => {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    });

    await waitFor(() => expect(screen.getByLabelText(/E-mail ou BI/)).toBeInTheDocument());
  });

  test('erro de rede NÃO destrói a sessão', async () => {
    api.get.mockRejectedValue({ request: {}, message: 'Network Error' });
    render(<App />);

    // Estado ERROR não é logout: o app não mostra o login como se não houvesse sessão.
    // O App real mostra SessionErrorScreen; aqui garantimos que não há flash de login.
    await waitFor(() => expect(screen.queryByLabelText(/E-mail ou BI/)).not.toBeInTheDocument());
  });
});
