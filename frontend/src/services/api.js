import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : '/api',
  withCredentials: true,
  timeout: 30000,
});

const AUTH_URLS = ['/auth/login', '/auth/logout', '/auth/perfil'];

export function isAuthUrl(url) {
  if (!url) return false;
  return AUTH_URLS.some((u) => url.includes(u));
}

function newRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Cada requisição é rastreada no backend (X-Request-ID → logs estruturados)
api.interceptors.request.use((config) => {
  config.headers['X-Request-ID'] = newRequestId();
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response ? err.response.status : null;
    const url = err.config ? err.config.url : '';

    // Apenas um 401 REAL de endpoint protegido significa sessão inválida.
    // Erros de rede, 4xx/5xx e erros de autenticação (credenciais erradas,
    // /auth/perfil sem sessão) NUNCA devem destruir a sessão indevidamente.
    if (status === 401 && !isAuthUrl(url)) {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }

    return Promise.reject(err);
  }
);

export default api;
