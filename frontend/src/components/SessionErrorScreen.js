import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../services/errors';

export default function SessionErrorScreen() {
  const { sessionError, checkSession, loading } = useAuth();

  return (
    <div className="ui-state ui-state-error" role="alert">
      <span className="ui-state-icon" aria-hidden="true">&#9888;</span>
      <h3 className="ui-state-title">Não foi possível verificar a sessão.</h3>
      <p className="ui-state-message">
        {getErrorMessage(sessionError, 'Verifique a sua ligação à internet e tente novamente.')}
      </p>
      <div className="ui-state-action">
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading}
          onClick={() => checkSession()}
        >
          {loading ? 'A verificar...' : 'Tentar novamente'}
        </button>
      </div>
    </div>
  );
}
