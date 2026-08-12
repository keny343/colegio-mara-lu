export const ERROR_CODES = {
  NO_TOKEN: 401,
  NO_PERMISSION: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_DATA: 422,
  TOO_MANY: 429,
  SERVER: 500,
  UNAVAILABLE: 503,
};

export function getErrorStatus(err) {
  return err && err.response ? err.response.status : null;
}

export function isNetworkError(err) {
  return Boolean(err && !err.response && err.request);
}

export function isTimeoutError(err) {
  return Boolean(
    err &&
      (err.code === 'ECONNABORTED' ||
        String(err.message || '').toLowerCase().includes('timeout'))
  );
}

export function getServerMessage(err) {
  if (err && err.response && err.response.data && err.response.data.message) {
    return err.response.data.message;
  }
  return null;
}

export function getErrorMessage(err, fallback = 'Ocorreu um erro inesperado.') {
  const serverMessage = getServerMessage(err);
  if (serverMessage) return serverMessage;

  const status = getErrorStatus(err);
  switch (status) {
    case ERROR_CODES.NO_TOKEN:
      return 'Sessão expirada. Faça login novamente.';
    case ERROR_CODES.NO_PERMISSION:
      return 'Você não tem permissão para realizar esta ação.';
    case ERROR_CODES.NOT_FOUND:
      return 'Recurso não encontrado.';
    case ERROR_CODES.CONFLICT:
      return 'Este registo já existe.';
    case ERROR_CODES.INVALID_DATA:
      return 'Dados inválidos. Verifique os campos preenchidos.';
    case ERROR_CODES.TOO_MANY:
      return 'Demasiadas tentativas. Tente novamente mais tarde.';
    case ERROR_CODES.SERVER:
      return 'Erro interno do servidor. Tente novamente.';
    case 502:
    case ERROR_CODES.UNAVAILABLE:
      return 'O servidor está indisponível. Tente novamente.';
    default:
      break;
  }

  if (isTimeoutError(err)) return 'A requisição demorou demasiado. Tente novamente.';
  if (isNetworkError(err)) return 'Falha de conexão. Verifique a sua internet.';
  if (err && err.message) return err.message;
  return fallback;
}
