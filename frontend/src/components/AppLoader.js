import React from 'react';

// Ecrã de carregamento do arranque da aplicação.
// Usado durante CHECKING_SESSION e nos Suspense de páginas lazy:
// mantém o layout estável, sem salto de conteúdo e sem flash do login.
export default function AppLoader({ label = 'A carregar...' }) {
  return (
    <div className="app-loader" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="app-loader-label">{label}</span>
    </div>
  );
}
