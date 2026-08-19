import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import MobileDrawer from './MobileDrawer';

// Layout que mantém o MobileDrawer montado entre rotas (como no app real)
function DrawerLayout({ children }) {
  return (
    <>
      <MobileDrawer ariaLabel="Menu de navegação" brandText="Colégio Teste">
        <Link to="/item1">Item 1</Link>
        <Link to="/item2">Item 2</Link>
        <Link to="/item3">Item 3</Link>
      </MobileDrawer>
      {children}
    </>
  );
}

const renderDrawer = (initialEntry = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/"
          element={
            <DrawerLayout>
              <div>Home</div>
            </DrawerLayout>
          }
        />
        <Route
          path="/item1"
          element={
            <DrawerLayout>
              <div>Item 1 page</div>
            </DrawerLayout>
          }
        />
      </Routes>
    </MemoryRouter>
  );
};

const drawerEl = () => document.querySelector('.mobile-drawer');
const abrirDrawer = () => fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));

// jsdom não computa layout: o focus trap do drawer filtra por
// offsetWidth/offsetHeight/getClientRects. Sem estas métricas a lista de
// elementos focáveis fica vazia e o trap não faz nada.
beforeAll(() => {
  Element.prototype.getClientRects = function getClientRects() {
    return [{}];
  };
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('MobileDrawer — acessibilidade e comportamento mobile', () => {
  test('renderiza o botão do menu com aria-expanded correto', () => {
    renderDrawer();
    const burger = screen.getByRole('button', { name: 'Abrir menu' });
    expect(burger).toHaveAttribute('aria-expanded', 'false');
    expect(burger).toHaveAttribute('aria-controls', 'mobile-drawer');
  });

  test('abre o drawer com aria-modal e bloqueia o scroll do body', () => {
    renderDrawer();
    abrirDrawer();

    const drawer = drawerEl();
    expect(drawer).not.toBeNull();
    expect(drawer).toHaveAttribute('role', 'dialog');
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(drawer).toHaveAttribute('aria-label', 'Menu de navegação');
    expect(drawer).toHaveAttribute('aria-hidden', 'false');
    expect(drawer).toHaveClass('open');
    expect(document.body.style.overflow).toBe('hidden');

    const closeButtons = drawer.querySelectorAll('button[aria-label="Fechar menu"]');
    expect(closeButtons.length).toBeGreaterThan(0);
  });

  test('fecha com a tecla Escape e restaura o scroll', async () => {
    renderDrawer();
    abrirDrawer();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(drawerEl()).toHaveAttribute('aria-hidden', 'true');
    });
    await waitFor(() => {
      expect(document.body.style.overflow).toBe('');
    });
  });

  test('focus trap: Shift+Tab cicla para o último item e Tab volta ao primeiro', () => {
    renderDrawer();
    abrirDrawer();

    const drawer = drawerEl();
    expect(document.activeElement).toBe(drawer);

    const focaveis = [...drawer.querySelectorAll('button, a')].filter(
      (el) => !el.disabled
    );
    const primeiro = focaveis[0]; // botão de fechar do header
    const ultimo = focaveis[focaveis.length - 1]; // último link da navegação

    // jsdom não implementa navegação por Tab nativa — foca manualmente.
    // Shift+Tab no primeiro → volta para o último (fecha o ciclo)
    primeiro.focus();
    fireEvent.keyDown(drawer, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(ultimo);

    // Tab no último → volta para o primeiro (fecha o ciclo)
    fireEvent.keyDown(drawer, { key: 'Tab' });
    expect(document.activeElement).toBe(primeiro);
  });

  test('fecha automaticamente ao navegar e liberta o scroll', async () => {
    renderDrawer('/');
    abrirDrawer();
    expect(drawerEl()).toHaveAttribute('aria-hidden', 'false');

    fireEvent.click(screen.getByRole('link', { name: 'Item 1' }));

    await waitFor(() => {
      expect(drawerEl()).toHaveAttribute('aria-hidden', 'true');
    });
    await waitFor(() => {
      expect(document.body.style.overflow).toBe('');
    });
    expect(screen.getByText('Item 1 page')).toBeInTheDocument();
  });
});
