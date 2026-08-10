import React from 'react';

export function EmptyState({ icon, title = 'Sem dados', message, action }) {
  return (
    <div className="ui-state ui-state-empty">
      {icon ? (
        <div className="ui-state-icon">{icon}</div>
      ) : (
        <span className="ui-state-icon" aria-hidden="true">&#128196;</span>
      )}
      <h3 className="ui-state-title">{title}</h3>
      {message && <p className="ui-state-message">{message}</p>}
      {action && <div className="ui-state-action">{action}</div>}
    </div>
  );
}
