import React, { useEffect, useRef, useState } from 'react';

const API_ROOT = (process.env.REACT_APP_API_URL || '').replace(/\/+$/, '');
const HEALTH_URL = `${API_ROOT}/health`;

// Validação explícita de configuração no arranque (Fase 6):
// se a API estiver inacessível ou com configuração errada (URL/HTTPS/CORS),
// o sistema falha de maneira visível em vez de quebrar apenas no login.
// A app renderiza imediatamente; o check corre em paralelo e troca o ecrã
// apenas se a API não responder.
export default function BootCheck({ children }) {
  const [state, setState] = useState('checking');
  const [detail, setDetail] = useState('');
  const running = useRef(false);

  const run = () => {
    if (running.current) return;
    running.current = true;
    setState('checking');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    fetch(HEALTH_URL, { signal: controller.signal })
      .then(async (res) => {
        clearTimeout(timer);
        let body = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        if (res.ok) {
          setState('ok');
        } else {
          setState('degraded');
          setDetail(`HTTP ${res.status}${body && body.message ? ` — ${body.message}` : ''}`);
        }
      })
      .catch((err) => {
        clearTimeout(timer);
        const name = err && err.name === 'AbortError' ? 'a API não respondeu a tempo' : 'a API está inacessível';
        setState('error');
        setDetail(`${name}. Verifique REACT_APP_API_URL, o CORS e o HTTPS.`);
      })
      .finally(() => {
        running.current = false;
      });
  };

  useEffect(() => {
    run();
  }, []);

  if (state === 'checking' || state === 'ok') return children;

  const titulo = state === 'degraded'
    ? 'O servidor respondeu, mas com problemas.'
    : 'Não foi possível ligar ao servidor.';

  return (
    <div className="ui-state ui-state-error" role="alert">
      <span className="ui-state-icon" aria-hidden="true">&#9888;</span>
      <h3 className="ui-state-title">{titulo}</h3>
      <p className="ui-state-message">
        {state === 'degraded'
          ? 'O serviço está degradado (possivelmente o banco de dados).'
          : 'Não é possível alcançar a API do sistema.'}
        <br />
        <code className="boot-check-url">{HEALTH_URL}</code>
        {detail && <span className="boot-check-detail"> — {detail}</span>}
      </p>
      <div className="ui-state-action">
        <button type="button" className="btn btn-primary" onClick={run}>
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
