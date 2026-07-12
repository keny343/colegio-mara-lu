import React, { createContext, useContext, useCallback, useState } from 'react';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notices, setNotices] = useState([]);

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

  return (
    <NotificationContext.Provider value={{ success, error, info, removeNotice }}>
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
