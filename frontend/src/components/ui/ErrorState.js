import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

function getErrorMessage(error) {
  if (!error) return 'Ocorreu um erro inesperado.';
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) return error.message;
  return 'Ocorreu um erro inesperado.';
}

export function ErrorState({ error, onRetry, title = 'Algo correu mal' }) {
  return (
    <div className="ui-state ui-state-error" role="alert">
      <div className="ui-state-icon" aria-hidden="true">
        <AlertTriangle size={28} strokeWidth={1.5} />
      </div>
      <h3 className="ui-state-title">{title}</h3>
      <p className="ui-state-message">{getErrorMessage(error)}</p>
      {onRetry && (
        <div className="ui-state-action">
          <Button variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );
}
