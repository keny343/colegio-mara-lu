import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Verificar se o token ainda é válido
      api.get('/auth/perfil')
        .then((res) => {
          if (res.data) {
            const saved = JSON.parse(savedUser);
            const merged = { ...saved, ...res.data, foto_url: res.data.foto_url || saved.foto_url };
            setUser(merged);
            localStorage.setItem('user', JSON.stringify(merged));
          }
        })
        .catch(() => {
          // Token inválido ou expirado
          logout();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, senha) => {
    const res = await api.post('/auth/login', { email: (email || '').trim(), senha });
    const { token, usuario } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(usuario));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(usuario);
    return usuario;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  };

  const updateUser = (dados) => {
    setUser((prev) => {
      const next = { ...prev, ...dados };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
