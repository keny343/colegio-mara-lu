import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const SESSION_STATUS = {
  CHECKING: 'CHECKING_SESSION',
  AUTHENTICATED: 'AUTHENTICATED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  ERROR: 'ERROR',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(SESSION_STATUS.CHECKING);
  const [sessionError, setSessionError] = useState(null);

  const checkSession = useCallback(async () => {
    setStatus(SESSION_STATUS.CHECKING);
    setSessionError(null);
    try {
      const res = await api.get('/auth/perfil');
      setUser(res.data);
      setStatus(SESSION_STATUS.AUTHENTICATED);
      return res.data;
    } catch (err) {
      const isInvalidSession = err.response && err.response.status === 401;
      setUser(null);
      if (isInvalidSession) {
        setStatus(SESSION_STATUS.UNAUTHENTICATED);
      } else {
        setSessionError(err);
        setStatus(SESSION_STATUS.ERROR);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Um 401 real em endpoint protegido → sessão inválida → limpar identidade
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setStatus(SESSION_STATUS.UNAUTHENTICATED);
    };
    window.addEventListener('auth:session-expired', handleExpired);
    return () => window.removeEventListener('auth:session-expired', handleExpired);
  }, []);

  const login = async (email, senha) => {
    const res = await api.post('/auth/login', { email: (email || '').trim(), senha });
    const { usuario } = res.data;

    // Só considera o login concluído depois de confirmar a sessão com o servidor
    const confirmado = await api.get('/auth/perfil');
    setUser(confirmado.data);
    setStatus(SESSION_STATUS.AUTHENTICATED);
    return confirmado.data || usuario;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Sem rede: mesmo assim limpa o estado local
    }
    setUser(null);
    setStatus(SESSION_STATUS.UNAUTHENTICATED);
  };

  const updateUser = (dados) => {
    setUser((prev) => ({ ...prev, ...dados }));
  };

  const loading = status === SESSION_STATUS.CHECKING;

  return (
    <AuthContext.Provider
      value={{ user, status, loading, sessionError, checkSession, login, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
