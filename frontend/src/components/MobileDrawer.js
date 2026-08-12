import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function MobileDrawer({ children, brandText = 'Colégio Mara & Lu', ariaLabel = 'Menu' }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const burgerRef = useRef(null);
  const drawerRef = useRef(null);

  const fechar = useCallback(() => setOpen(false), []);
  const abrir = useCallback(() => setOpen(true), []);

  // fecha ao navegar
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // bloqueia o scroll do body com o drawer aberto
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // fecha com a tecla Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, fechar]);

  // foco correcto: move para o drawer ao abrir; restaura o botão do menu ao fechar
  useEffect(() => {
    if (open) {
      drawerRef.current?.focus();
    } else {
      burgerRef.current?.focus();
    }
  }, [open]);

  // focus trap dentro do drawer (suporte completo a teclado)
  const onDrawerKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    const node = drawerRef.current;
    if (!node) return;
    const focusable = [...node.querySelectorAll(FOCUSABLE)].filter(
      (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <header className="mobile-header">
        <button
          ref={burgerRef}
          type="button"
          className="mobile-header-burger"
          onClick={() => (open ? fechar() : abrir())}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          aria-controls="mobile-drawer"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="mobile-header-brand">{brandText}</div>
      </header>

      <div
        className={`mobile-drawer-overlay ${open ? 'open' : ''}`}
        onClick={fechar}
        aria-hidden="true"
      />
      <div
        id="mobile-drawer"
        ref={drawerRef}
        tabIndex={-1}
        className={`mobile-drawer ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-hidden={!open}
        onKeyDown={onDrawerKeyDown}
      >
        <div className="mobile-drawer-header">
          <span>{brandText}</span>
          <button type="button" onClick={fechar} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>
        <nav className="mobile-drawer-nav">{children}</nav>
      </div>
    </>
  );
}
