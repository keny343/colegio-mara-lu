import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : '/api',
});

api.interceptors.response.use(
  res => res,
  err => {
    const isAuthRequest =
      err.config?.url?.includes('/auth/login') || err.config?.url?.includes('/auth/register');

    if (!isAuthRequest && err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;