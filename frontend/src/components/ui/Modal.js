import React, { useEffect, useRef } from 'react';

const SIZES = {
  sm: { maxWidth: '460px' },
  md: undefined,
  lg: { maxWidth: '860px' },
};

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  closeOnOverlay = true,
}) {
  const innerRef = useRef(null);

  // Manter sempre a versão mais recente de onClose
  // sem fazer o efeito de foco reexecutar a cada render.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Controle do ciclo de vida do modal.
  //
  // IMPORTANTE:
  // Este efeito depende SOMENTE de `open`.
  //
  // Assim, mudanças nos campos internos do formulário
  // não fazem o modal roubar o foco do input.
  useEffect(() => {
    if (!open) return undefined;

    const previousActive = document.activeElement;

    // O foco vai para o diálogo somente na abertura.
    innerRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const node = innerRef.current;
      if (!node) return;

      const focusable = [...node.querySelectorAll(FOCUSABLE)].filter(
        (el) =>
          !el.disabled &&
          el.offsetParent !== null
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (
        e.shiftKey &&
        document.activeElement === first
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        document.activeElement === last
      ) {
        e.preventDefault();
        first.focus();
      }
    };

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    document.addEventListener(
      'keydown',
      onKeyDown
    );

    return () => {
      document.removeEventListener(
        'keydown',
        onKeyDown
      );

      document.body.style.overflow =
        previousOverflow;

      // Restaurar foco somente quando o modal
      // realmente for fechado/desmontado.
      previousActive?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={
        closeOnOverlay
          ? () => onCloseRef.current?.()
          : undefined
      }
    >
      <div
        ref={innerRef}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={
          title || 'Janela de diálogo'
        }
        style={SIZES[size]}
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        {title && (
          <div className="modal-header">
            <h3 className="modal-title">
              {title}
            </h3>

            <button
              type="button"
              className="modal-close"
              aria-label="Fechar"
              onClick={() =>
                onCloseRef.current?.()
              }
            >
              &times;
            </button>
          </div>
        )}

        <div className="modal-body">
          {children}
        </div>

        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}