import React from 'react';

export function LoadingState({ label = 'A carregar...' }) {
  return (
    <div className="ui-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="ui-state-label">{label}</span>
    </div>
  );
}
