import React from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({ icon, title = 'Sem dados', message, action }) {
  return (
    <div className="ui-state ui-state-empty">
      <div className="ui-state-icon" aria-hidden="true">
        {icon || <Inbox size={28} strokeWidth={1.5} />}
      </div>
      <h3 className="ui-state-title">{title}</h3>
      {message && <p className="ui-state-message">{message}</p>}
      {action && <div className="ui-state-action">{action}</div>}
    </div>
  );
}
