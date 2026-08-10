import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    // Restaurar sessão a partir do cookie httpOnly (se existir)
    api.get('/auth/perfil')
      .then((res) => {
        const merged = savedUser ? { ...JSON.parse(savedUser), ...res.data } : res.data;
        setUser(merged);
        localStorage.setItem('user', JSON.stringify(merged));
      })
      .catch(() => {
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email, senha) => {
    const res = await api.post('/auth/login', { email: (email || '').trim(), senha });
    const { usuario } = res.data;
    localStorage.setItem('user', JSON.stringify(usuario));
    setUser(usuario);
    return usuario;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignorar falha de rede no logout
    }
    localStorage.removeItem('user');
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
