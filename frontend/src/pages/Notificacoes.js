import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react';
import api from '../services/api';

export default function Notificacoes() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notificacoes').then(r => setNotifs(r.data)).finally(() => setLoading(false));
  }, []);

  const getIcon = (titulo) => {
    if (titulo.includes('Aprovada') || titulo.includes('aprovada')) return <CheckCircle size={22} color="var(--verde)" />;
    if (titulo.includes('Rejeitada') || titulo.includes('rejeitada')) return <XCircle size={22} color="var(--vermelho)" />;
    if (titulo.includes('Análise') || titulo.includes('análise')) return <AlertCircle size={22} color="var(--azul)" />;
    return <Clock size={22} color="var(--laranja)" />;
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Notificações</h2>
        <p style={{ color: 'var(--cinza)' }}>Atualizações sobre as suas inscrições</p>
      </div>

      {notifs.length === 0 ? (
        <div className="card empty-state">
          <Bell size={56} />
          <h3>Nenhuma notificação</h3>
          <p>As atualizações sobre suas inscrições aparecerão aqui.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {notifs.map(n => (
            <div key={n.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', borderLeft: `4px solid ${n.titulo.includes('Aprovada') ? 'var(--verde)' : n.titulo.includes('Rejeitada') ? 'var(--vermelho)' : 'var(--laranja)'}` }}>
              <div style={{ flexShrink: 0, marginTop: 2 }}>{getIcon(n.titulo)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--castanho)', marginBottom: 4 }}>{n.titulo}</div>
                <div style={{ color: 'var(--cinza)', lineHeight: 1.6 }}>{n.mensagem}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--cinza)', marginTop: 8 }}>
                  {new Date(n.criado_em).toLocaleString('pt-BR')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
