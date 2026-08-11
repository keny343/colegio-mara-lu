import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, FileText, Clock } from 'lucide-react';
import api from '../services/api';
import { Badge, Button, DataTable, EmptyState, FormField, Modal, Textarea, LoadingState } from '../components/ui';
import './ProfessorJustificacoes.css';

function StatusBadge({ status }) {
  const map = { pendente: 'yellow', aprovada: 'green', rejeitada: 'red' };
  const labels = { pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada' };
  return <Badge tone={map[status] || 'gray'}>{labels[status] || status}</Badge>;
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

  if (loading) return <LoadingState />;

  const pendentes = pedidos.filter(p => p.status === 'pendente');
  const processados = pedidos.filter(p => p.status !== 'pendente');

  const historicoColumns = [
    { key: 'aluno_nome', label: 'Aluno', sortable: true, render: p => <strong>{p.aluno_nome}</strong> },
    { key: 'disciplina', label: 'Disciplina', sortable: true },
    { key: 'data_falta', label: 'Data Falta', sortable: true, render: p => <span className="cell-data">{new Date(p.data_falta).toLocaleDateString('pt-PT')}</span> },
    { key: 'motivo', label: 'Motivo', render: p => <span className="cell-motivo">{p.motivo}</span> },
    {
      key: 'documento_path',
      label: 'Doc.',
      render: p => p.documento_path ? (
        <a href={docUrl(p)} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><FileText size={12} /></a>
      ) : '—',
    },
    { key: 'decisao_motivo', label: 'Decisão', render: p => <span className="cell-decisao">{p.decisao_motivo || '—'}</span> },
    { key: 'status', label: 'Status', sortable: true, render: p => <StatusBadge status={p.status} /> },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Justificações de Faltas</h2>
        <p className="page-header-sub">Pedidos de justificação enviados pelos alunos das suas turmas</p>
      </div>

      {pedidos.length === 0 ? (
        <div className="card">
          <EmptyState icon={<CheckCircle size={48} />} title="Sem pedidos de justificação" message="Nenhum aluno enviou pedidos de justificação de falta." />
        </div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div className="just-section">
              <h3 className="just-section-title">
                <Clock size={16} />
                Pendentes ({pendentes.length})
              </h3>
              <div className="just-list">
                {pendentes.map(p => (
                  <div key={p.id} className="card just-item">
                    <div className="just-info">
                      <div className="just-aluno">{p.aluno_nome}</div>
                      <div className="just-sub">{p.disciplina} — Falta de {new Date(p.data_falta).toLocaleDateString('pt-PT')}</div>
                      <div className="just-motivo"><strong>Motivo:</strong> {p.motivo}</div>
                      {p.documento_path && (
                        <a href={docUrl(p)} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                          <FileText size={13} /> Ver documento ({p.documento_nome || 'ficheiro'})
                        </a>
                      )}
                    </div>
                    <div className="just-actions">
                      <Button variant="primary" size="sm" onClick={() => abrirDecisao(p)}>Decidir</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {processados.length > 0 && (
            <div className="just-section">
              <h3 className="just-section-title">Histórico ({processados.length})</h3>
              <div className="card">
                <DataTable columns={historicoColumns} rows={processados} keyField="id" emptyMessage="Sem justificações processadas." />
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title="Decidir Justificação"
        size="sm"
        footer={
          <div className="modal-actions">
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button variant="primary" block loading={saving} onClick={confirmarDecisao}>
              {saving ? 'A processar...' : 'Confirmar Decisão'}
            </Button>
          </div>
        }
      >
        {modal && (
          <>
            <p className="modal-info">Aluno: <strong>{modal.aluno_nome}</strong></p>
            <p className="modal-info">Falta: <strong>{modal.disciplina}</strong> — {new Date(modal.data_falta).toLocaleDateString('pt-PT')}</p>
            <div className="alert alert-info modal-motivo">
              <strong>Motivo do aluno:</strong> {modal.motivo}
              {modal.documento_path && (
                <div className="modal-doc">
                  <a href={docUrl(modal)} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    <FileText size={13} /> Ver documento comprovativo
                  </a>
                </div>
              )}
            </div>
          </>
        )}
        {erro && <div className="alert alert-error modal-erro">{erro}</div>}
        <FormField label="Decisão">
          <div className="decisao-row">
            <Button
              variant={decisao.status === 'aprovada' ? 'primary' : 'outline'}
              size="sm"
              className="decisao-btn"
              icon={<CheckCircle size={14} />}
              onClick={() => setDecisao(d => ({ ...d, status: 'aprovada' }))}
            >
              Aprovar
            </Button>
            <Button
              variant={decisao.status === 'rejeitada' ? 'danger' : 'outline'}
              size="sm"
              className="decisao-btn"
              icon={<XCircle size={14} />}
              onClick={() => setDecisao(d => ({ ...d, status: 'rejeitada' }))}
            >
              Rejeitar
            </Button>
          </div>
        </FormField>
        <FormField label={`Observação ${decisao.status === 'rejeitada' ? '*' : '(opcional)'}`} htmlFor="just-observacao">
          <Textarea
            id="just-observacao"
            rows={2}
            placeholder={decisao.status === 'aprovada' ? 'Ex: Atestado médico aceite...' : 'Motivo da rejeição...'}
            value={decisao.decisao_motivo}
            onChange={e => setDecisao(d => ({ ...d, decisao_motivo: e.target.value }))}
          />
        </FormField>
      </Modal>
    </div>
  );
}
