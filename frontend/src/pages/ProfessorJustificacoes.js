import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, FileText, Clock, X } from 'lucide-react';
import api from '../services/api';

function StatusBadge({ status }) {
  const map = { pendente: '#F59E0B', aprovada: '#22C55E', rejeitada: '#EF4444' };
  const labels = { pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada' };
  return (
    <span style={{
      background: `${map[status] || '#999'}22`,
      color: map[status] || '#999',
      fontWeight: 700, fontSize: '0.75rem', borderRadius: 20,
      padding: '3px 10px', textTransform: 'uppercase'
    }}>{labels[status] || status}</span>
  );
}

export default function ProfessorJustificacoes() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [decisao, setDecisao] = useState({ status: 'aprovada', decisao_motivo: '' });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = () => {
    setLoading(true);
    api.get('/professor/justificacoes')
      .then(r => setPedidos(r.data || []))
      .catch(() => setPedidos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const abrirDecisao = (p) => {
    setModal(p);
    setDecisao({ status: 'aprovada', decisao_motivo: '' });
    setErro('');
  };

  const confirmarDecisao = async () => {
    setSaving(true);
    setErro('');
    try {
      await api.patch(`/professor/justificacoes/${modal.id}`, decisao);
      setModal(null);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao processar decisão.');
    } finally {
      setSaving(false);
    }
  };

  const apiBase = process.env.REACT_APP_API_URL || '';
const docUrl = (p) => `${apiBase}/api/professor/justificacoes/${p.id}/documento`;

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const pendentes = pedidos.filter(p => p.status === 'pendente');
  const processados = pedidos.filter(p => p.status !== 'pendente');

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Justificações de Faltas</h2>
        <p style={{ color: 'var(--cinza)' }}>
          Pedidos de justificação enviados pelos alunos das suas turmas
        </p>
      </div>

      {pedidos.length === 0 ? (
        <div className="card empty-state">
          <CheckCircle size={48} style={{ opacity: 0.3 }} />
          <h3>Sem pedidos de justificação</h3>
          <p>Nenhum aluno enviou pedidos de justificação de falta.</p>
        </div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--castanho-medio)' }}>
                <Clock size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Pendentes ({pendentes.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendentes.map(p => (
                  <div key={p.id} className="card" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.aluno_nome}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--cinza)', marginBottom: 4 }}>
                        {p.disciplina} — Falta de {new Date(p.data_falta).toLocaleDateString('pt-PT')}
                      </div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--castanho)', marginBottom: 6 }}>
                        <strong>Motivo:</strong> {p.motivo}
                      </div>
                      {p.documento_path && (
                        <a
                          href={docUrl(p)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline"
                          style={{ fontSize: '0.78rem' }}
                        >
                          <FileText size={13} /> Ver documento ({p.documento_nome || 'ficheiro'})
                        </a>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => abrirDecisao(p)}>
                        Decidir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {processados.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--castanho-medio)' }}>
                Histórico ({processados.length})
              </h3>
              <div className="card" style={{ padding: 0 }}>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Aluno</th>
                        <th>Disciplina</th>
                        <th>Data Falta</th>
                        <th>Motivo</th>
                        <th>Doc.</th>
                        <th>Decisão</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processados.map(p => (
                        <tr key={p.id}>
                          <td><strong>{p.aluno_nome}</strong></td>
                          <td>{p.disciplina}</td>
                          <td style={{ fontSize: '0.85rem' }}>{new Date(p.data_falta).toLocaleDateString('pt-PT')}</td>
                          <td style={{ fontSize: '0.85rem', maxWidth: 180 }}>{p.motivo}</td>
                          <td>
                            {p.documento_path ? (
                              <a href={docUrl(p)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline" style={{ fontSize: '0.75rem' }}>
                                <FileText size={12} />
                              </a>
                            ) : '—'}
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--cinza)' }}>{p.decisao_motivo || '—'}</td>
                          <td><StatusBadge status={p.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Decisão */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Decidir Justificação</h3>
              <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--cinza)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Aluno: <strong>{modal.aluno_nome}</strong>
            </p>
            <p style={{ color: 'var(--cinza)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Falta: <strong>{modal.disciplina}</strong> — {new Date(modal.data_falta).toLocaleDateString('pt-PT')}
            </p>
            <div className="alert alert-info" style={{ marginBottom: '1.25rem', fontSize: '0.88rem' }}>
              <strong>Motivo do aluno:</strong> {modal.motivo}
              {modal.documento_path && (
                <div style={{ marginTop: 8 }}>
                  <a href={docUrl(modal)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline" style={{ fontSize: '0.78rem' }}>
                    <FileText size={13} /> Ver documento comprovativo
                  </a>
                </div>
              )}
            </div>
            {erro && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{erro}</div>}
            <div className="form-group">
              <label className="form-label">Decisão</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${decisao.status === 'aprovada' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1 }}
                  onClick={() => setDecisao(d => ({ ...d, status: 'aprovada' }))}
                >
                  <CheckCircle size={14} /> Aprovar
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${decisao.status === 'rejeitada' ? '' : 'btn-outline'}`}
                  style={{ flex: 1, ...(decisao.status === 'rejeitada' ? { background: 'var(--vermelho)', color: '#fff', border: 'none' } : {}) }}
                  onClick={() => setDecisao(d => ({ ...d, status: 'rejeitada' }))}
                >
                  <XCircle size={14} /> Rejeitar
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Observação {decisao.status === 'rejeitada' ? '*' : '(opcional)'}</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder={decisao.status === 'aprovada' ? 'Ex: Atestado médico aceite...' : 'Motivo da rejeição...'}
                value={decisao.decisao_motivo}
                onChange={e => setDecisao(d => ({ ...d, decisao_motivo: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={confirmarDecisao} disabled={saving}>
                {saving ? 'A processar...' : 'Confirmar Decisão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
