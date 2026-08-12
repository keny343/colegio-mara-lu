import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ui-state ui-state-error" role="alert">
          <span className="ui-state-icon" aria-hidden="true">&#9888;</span>
          <h3 className="ui-state-title">Ocorreu um erro inesperado.</h3>
          <p className="ui-state-message">Tente recarregar a página. Se o problema persistir, contacte o administrador.</p>
          <div className="ui-state-action">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
