import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const NotificationContext = createContext(null);

// Fonte ÚNICA de notificações da aplicação.
// AdminSidebar / ProfessorSidebar / Navbar lêem apenas o contador daqui —
// o polling fica centralizado, sem requests duplicadas.
const POLL_INTERVAL_MS = 30 * 1000;

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notices, setNotices] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const removeNotice = useCallback((id) => {
    setNotices((prev) => prev.filter((notice) => notice.id !== id));
  }, []);

  const notify = useCallback((type, title, message, duration = 5000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotices((prev) => [...prev, { id, type, title, message }]);
    window.setTimeout(() => removeNotice(id), duration);
  }, [removeNotice]);

  const success = useCallback((message, title = 'Sucesso') => {
    notify('success', title, message);
  }, [notify]);

  const error = useCallback((message, title = 'Erro') => {
    notify('error', title, message);
  }, [notify]);

  const info = useCallback((message, title = 'Info') => {
    notify('info', title, message);
  }, [notify]);

  // ---- Contador de não lidas (polling único, pausa com aba oculta) ----
  const refreshNotifs = useCallback(async () => {
    try {
      const res = await api.get('/notificacoes');
      const total = Array.isArray(res.data) ? res.data.filter((n) => !n.lida).length : 0;
      setUnreadCount(total);
      return total;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return undefined;
    }

    let disposed = false;

    const tick = () => {
      if (disposed || document.hidden) return;
      refreshNotifs();
    };

    const onVisible = () => {
      if (!document.hidden) refreshNotifs();
    };

    refreshNotifs();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      disposed = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, refreshNotifs]);

  return (
    <NotificationContext.Provider value={{ success, error, info, removeNotice, unreadCount, refreshNotifs }}>
      {children}
      <div className="toast-portal" aria-live="polite" aria-relevant="additions">
        {notices.map((notice) => (
          <div key={notice.id} className={`toast toast-${notice.type}`} role="status">
            <div className="toast-body">
              <strong>{notice.title}</strong>
              <p>{notice.message}</p>
            </div>
            <button type="button" className="toast-close" aria-label="Fechar notificação" onClick={() => removeNotice(notice.id)}>×</button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};
