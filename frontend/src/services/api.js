import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  res => res,
  err => {
    const isAuthRequest =
      err.config?.url?.includes('/auth/login') ||
      err.config?.url?.includes('/auth/register') ||
      err.config?.url?.includes('/auth/perfil');

    if (!isAuthRequest && err.response?.status === 401) {
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
