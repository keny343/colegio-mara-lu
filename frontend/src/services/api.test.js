import api, { isAuthUrl } from './api';

jest.mock('axios', () => {
  const handlers = {};
  const instance = {
    defaults: {},
    interceptors: {
      request: { use: (fn) => { handlers.request = fn; } },
      response: { use: (ok, err) => { handlers.responseOk = ok; handlers.responseErr = err; } },
    },
    get: jest.fn(),
    post: jest.fn(),
  };
  // Expõe os handlers reais registados por api.js (imunes ao resetMocks do react-scripts).
  instance.__handlers = handlers;
  return { __esModule: true, default: { create: () => instance } };
});

function responseErrorHandler() {
  return api.__handlers.responseErr;
}

function dispararErro(error) {
  const result = responseErrorHandler()(error);
  if (result && typeof result.catch === 'function') result.catch(() => {});
  return result;
}

function eventosSessionExpired() {
  return dispatchSpy.mock.calls
    .filter(([e]) => e && e.type === 'auth:session-expired')
    .map(([e]) => e.type);
}

let dispatchSpy;

beforeEach(() => {
  dispatchSpy = jest.spyOn(window, 'dispatchEvent');
});

afterEach(() => {
  dispatchSpy.mockRestore();
});

describe('isAuthUrl', () => {
  test('identifica apenas rotas de autenticação', () => {
    expect(isAuthUrl('/auth/login')).toBe(true);
    expect(isAuthUrl('/auth/logout')).toBe(true);
    expect(isAuthUrl('/auth/perfil')).toBe(true);
    expect(isAuthUrl('/auth/perfil/foto')).toBe(true);
    expect(isAuthUrl('/alunos')).toBe(false);
    expect(isAuthUrl('/admin/dashboard')).toBe(false);
    expect(isAuthUrl('/admin/inscricoes/1/status')).toBe(false);
    expect(isAuthUrl(null)).toBe(false);
  });
});

describe('Interceptor de resposta — nunca confundir erro com logout', () => {
  test('401 em endpoint protegido → sessão expirada', () => {
    dispararErro({ response: { status: 401 }, config: { url: '/alunos' } });
    expect(eventosSessionExpired()).toHaveLength(1);
  });

  test('401 em /auth/perfil (sem sessão) → NÃO dispara logout', () => {
    dispararErro({ response: { status: 401 }, config: { url: '/auth/perfil' } });
    expect(eventosSessionExpired()).toHaveLength(0);
  });

  test('401 no login (credenciais erradas) → NÃO dispara logout', () => {
    dispararErro({ response: { status: 401 }, config: { url: '/auth/login' } });
    expect(eventosSessionExpired()).toHaveLength(0);
  });

  test('erro de rede → NÃO dispara logout', () => {
    dispararErro({ request: {}, config: { url: '/alunos' } });
    expect(eventosSessionExpired()).toHaveLength(0);
  });

  test('500 e 403 → NÃO dispara logout', () => {
    dispararErro({ response: { status: 500 }, config: { url: '/alunos' } });
    dispararErro({ response: { status: 403 }, config: { url: '/alunos' } });
    expect(eventosSessionExpired()).toHaveLength(0);
  });

  test('erro sem response e sem config (edge) → NÃO dispara logout', () => {
    dispararErro({ message: 'algo' });
    expect(eventosSessionExpired()).toHaveLength(0);
  });
});