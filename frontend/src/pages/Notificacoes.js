import React from 'react';
import { Bell, CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react';
import api from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { LoadingState, EmptyState, ErrorState } from '../components/ui';
import './Notificacoes.css';

const getIcono = (titulo) => {
  if (titulo.includes('Aprovada') || titulo.includes('aprovada')) return <CheckCircle size={22} color="var(--verde)" />;
  if (titulo.includes('Rejeitada') || titulo.includes('rejeitada')) return <XCircle size={22} color="var(--vermelho)" />;
  if (titulo.includes('Análise') || titulo.includes('análise')) return <AlertCircle size={22} color="var(--azul)" />;
  return <Clock size={22} color="var(--laranja)" />;
};

const classeTipo = (titulo) => {
  if (titulo.includes('Aprovada') || titulo.includes('aprovada')) return 'notif-item--verde';
  if (titulo.includes('Rejeitada') || titulo.includes('rejeitada')) return 'notif-item--vermelho';
  return 'notif-item--laranja';
};

export default function Notificacoes() {
  const { data: notifs = [], loading, error, refetch } = useFetch((signal) => api.get('/notificacoes', { signal }), []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Notificações</h2>
        <p>Atualizações sobre as suas inscrições</p>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : notifs.length === 0 ? (
        <EmptyState
          icon={<Bell size={56} />}
          title="Nenhuma notificação"
          message="As atualizações sobre suas inscrições aparecerão aqui."
        />
      ) : (
        <div className="notif-list">
          {notifs.map((n) => (
            <div key={n.id} className={`card notif-item ${classeTipo(n.titulo)}`}>
              <div className="notif-icon">{getIcono(n.titulo)}</div>
              <div className="notif-body">
                <div className="notif-titulo">{n.titulo}</div>
                <div className="notif-mensagem">{n.mensagem}</div>
                <div className="notif-data">
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