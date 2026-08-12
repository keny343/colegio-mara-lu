import {
  getErrorStatus,
  isNetworkError,
  isTimeoutError,
  getErrorMessage,
  getServerMessage,
} from './errors';

describe('errors', () => {
  test('getErrorStatus retorna o status HTTP', () => {
    expect(getErrorStatus({ response: { status: 500 } })).toBe(500);
    expect(getErrorStatus(null)).toBeNull();
    expect(getErrorStatus({ request: {} })).toBeNull();
  });

  test('isNetworkError detecta falha de rede (sem resposta)', () => {
    expect(isNetworkError({ request: {} })).toBe(true);
    expect(isNetworkError({ response: { status: 500 } })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });

  test('isTimeoutError detecta timeout', () => {
    expect(isTimeoutError({ code: 'ECONNABORTED' })).toBe(true);
    expect(isTimeoutError({ message: 'timeout of 30000ms exceeded' })).toBe(true);
    expect(isTimeoutError({ response: { status: 503 } })).toBe(false);
  });

  test('getServerMessage prefere a mensagem do servidor', () => {
    expect(getServerMessage({ response: { data: { message: 'Erro do servidor.' } } })).toBe('Erro do servidor.');
    expect(getServerMessage({ response: { status: 500 } })).toBeNull();
  });

  test('getErrorMessage mapeia cada status', () => {
    expect(getErrorMessage({ response: { status: 401 } })).toBe('Sessão expirada. Faça login novamente.');
    expect(getErrorMessage({ response: { status: 403 } })).toBe('Você não tem permissão para realizar esta ação.');
    expect(getErrorMessage({ response: { status: 404 } })).toBe('Recurso não encontrado.');
    expect(getErrorMessage({ response: { status: 409 } })).toBe('Este registo já existe.');
    expect(getErrorMessage({ response: { status: 422 } })).toBe('Dados inválidos. Verifique os campos preenchidos.');
    expect(getErrorMessage({ response: { status: 429 } })).toBe('Demasiadas tentativas. Tente novamente mais tarde.');
    expect(getErrorMessage({ response: { status: 500 } })).toBe('Erro interno do servidor. Tente novamente.');
    expect(getErrorMessage({ response: { status: 503 } })).toBe('O servidor está indisponível. Tente novamente.');
  });

  test('getErrorMessage trata rede e timeout', () => {
    expect(getErrorMessage({ request: {} })).toBe('Falha de conexão. Verifique a sua internet.');
    expect(getErrorMessage({ code: 'ECONNABORTED' })).toBe('A requisição demorou demasiado. Tente novamente.');
  });

  test('getErrorMessage usa fallback', () => {
    expect(getErrorMessage(null)).toBe('Ocorreu um erro inesperado.');
    expect(getErrorMessage({ response: { status: 418 } }, 'Fallback customizado.')).toBe('Fallback customizado.');
  });
});
