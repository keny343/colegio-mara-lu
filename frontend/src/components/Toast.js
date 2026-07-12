import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

/**
 * Toast global de feedback.
 * Uso: <Toast message="Nota lançada!" type="success" onClose={() => setToast(null)} />
 * type: 'success' | 'error' | 'info'
 */
export default function Toast({ message, type = 'success', onClose, duration = 3500 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!message) return null;

  const colors = {
    success: { bg: '#1a7a4a', border: '#22c55e', icon: <CheckCircle size={20} color="#fff" /> },
    error:   { bg: '#b91c1c', border: '#ef4444', icon: <XCircle size={20} color="#fff" /> },
    info:    { bg: '#1d4ed8', border: '#60a5fa', icon: <Info size={20} color="#fff" /> },
  };
  const c = colors[type] || colors.info;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 12,
      background: c.bg, border: `1.5px solid ${c.border}`,
      borderRadius: 14, padding: '14px 20px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
      minWidth: 260, maxWidth: 420,
      transform: visible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.95)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.28s cubic-bezier(.4,0,.2,1)',
      pointerEvents: 'auto',
    }}>
      {c.icon}
      <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>{message}</span>
      <button
        type="button"
        aria-label="Fechar notificação"
        onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center' }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

/** Hook helper para usar Toast facilmente */
export function useToast() {
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => setToast({ message, type, key: Date.now() });
  const clearToast = () => setToast(null);
  return { toast, showToast, clearToast };
}