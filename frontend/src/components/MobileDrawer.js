import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function MobileDrawer({ children, brandText = 'Colégio Mara & Lu', ariaLabel = 'Menu' }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

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
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-header-burger"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="mobile-header-brand">{brandText}</div>
      </header>

      <div
        className={`mobile-drawer-overlay ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        className={`mobile-drawer ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div className="mobile-drawer-header">
          <span>{brandText}</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>
        <nav className="mobile-drawer-nav">{children}</nav>
      </div>
    </>
  );
}
