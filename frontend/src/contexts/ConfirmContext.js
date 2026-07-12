import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((options = {}) => new Promise((resolve) => {
    resolveRef.current = resolve;
    setDialog({
      title: options.title || 'Confirmar acção',
      message: options.message || 'Tem a certeza que deseja continuar?',
      confirmLabel: options.confirmLabel || 'Confirmar',
      cancelLabel: options.cancelLabel || 'Cancelar',
      variant: options.variant || 'danger',
    });
  }), []);

  const finish = (result) => {
    setDialog(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-desc"
          onClick={() => finish(false)}
        >
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: '1rem' }}>
              <div style={{
                background: dialog.variant === 'danger' ? 'rgba(239,68,68,0.12)' : 'rgba(232,100,26,0.12)',
                borderRadius: 10, padding: 10, display: 'flex', flexShrink: 0,
              }}>
                <AlertTriangle size={22} color={dialog.variant === 'danger' ? 'var(--vermelho)' : 'var(--laranja)'} />
              </div>
              <div>
                <h3 id="confirm-dialog-title" style={{ margin: '0 0 6px', color: 'var(--castanho)' }}>{dialog.title}</h3>
                <p id="confirm-dialog-desc" style={{ margin: 0, color: 'var(--cinza)', lineHeight: 1.6 }}>{dialog.message}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => finish(false)}>
                {dialog.cancelLabel}
              </button>
              <button
                type="button"
                className={`btn ${dialog.variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => finish(true)}
                autoFocus
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within ConfirmProvider');
  return context.confirm;
};
