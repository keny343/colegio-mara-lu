import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, CheckCircle } from 'lucide-react';
import api from '../services/api';
import { normalizeSeriesName } from '../utils/serieName';
import { fileUrl } from '../services/fileUrl';
import Toast, { useToast } from '../components/Toast';
import {
  Badge, Button, FormField, Select, Textarea, Modal,
  DataTable, Pagination, LoadingState,
} from '../components/ui';
import './AdminInscricoes.css';

const STATUS_TONE = {
  pendente: 'yellow',
  em_analise: 'blue',
  aprovada: 'green',
  rejeitada: 'red',
  cancelada: 'gray',
};

const STATUS_OPTIONS = [
  ['pendente', 'Pendente'],
  ['em_analise', 'Em Análise'],
  ['aprovada', 'Aprovada ✓'],
  ['rejeitada', 'Rejeitada ✗'],
  ['cancelada', 'Cancelada'],
];

const DOC_STATUS_TONE = {
  pendente: 'yellow',
  aprovado: 'green',
  rejeitado: 'red',
};

// Classe a mostrar na tabela: se o aluno já tem matrícula activa, mostra a turma REAL onde está
// (reflecte transferências de curso/turma feitas depois da aprovação), não a série pedida na inscrição.
// 10ª–13ª: "12ª (Ciências Físicas)". Abaixo da 10ª: só o nome da turma matriculada.
function classeExibida(i) {
  if (i.matricula_turma_nome) {
    if (Number(i.matricula_serie_classe) >= 10) {
      return `${i.matricula_serie_classe}ª (${i.matricula_curso_nome || '—'})`;
    }
    return i.matricula_turma_nome;
  }
  return normalizeSeriesName(i.serie_nome);
}

export default function AdminInscricoes() {
  const [searchParams] = useSearchParams();
  const [inscricoes, setInscricoes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ status: searchParams.get('status') || '', ano_letivo: '', busca: '', page: 1 });
  const [detalhe, setDetalhe] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [novoStatus, setNovoStatus] = useState({ status: '', observacao_admin: '', motivo_rejeicao: '', turma_id: '' });
  const [turmas, setTurmas] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const { toast, showToast, clearToast } = useToast();

  const carregar = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtros.status) params.set('status', filtros.status);
    if (filtros.ano_letivo) params.set('ano_letivo', filtros.ano_letivo);
    params.set('page', filtros.page);
    params.set('limit', 15);
    api.get(`/admin/inscricoes?${params}`).then(r => {
      setInscricoes(r.data.data);
      setTotal(r.data.total);
    }).finally(() => setLoading(false));
  }, [filtros]);

  useEffect(() => { carregar(); }, [carregar]);

  const verDetalhe = async (id) => {
    const r = await api.get(`/admin/inscricoes/${id}`);
    setDetalhe(r.data);
  };

  const abrirStatus = async (i) => {
    setStatusModal(i);
    setNovoStatus({ status: i.status, observacao_admin: i.observacao_admin || '', motivo_rejeicao: i.motivo_rejeicao || '', turma_id: '' });
    try {
      const res = await api.get('/staff/turmas');
      const lista = (res.data || []).filter(t => String(t.ano_letivo) === String(i.ano_letivo));
      setTurmas(lista);
    } catch {
      setTurmas([]);
    }
  };

  const salvarStatus = async () => {
    setSalvando(true);
    try {
      await api.patch(`/admin/inscricoes/${statusModal.id}/status`, novoStatus);
      const statusLabel = novoStatus.status === 'aprovada' ? 'aprovada' : novoStatus.status === 'rejeitada' ? 'rejeitada' : 'actualizada';
      showToast(`Inscrição ${statusLabel} com sucesso!`, novoStatus.status === 'aprovada' ? 'success' : novoStatus.status === 'rejeitada' ? 'error' : 'info');
      setStatusModal(null);
      carregar();
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao atualizar.';
      showToast(msg, 'error');
    } finally { setSalvando(false); }
  };

  const columns = [
    {
      key: 'id', label: '#', headerWidth: '64px',
      render: (i) => <span className="col-muted">#{i.id}</span>,
    },
    {
      key: 'aluno_nome', label: 'Aluno',
      render: (i) => <strong>{i.aluno_nome}</strong>,
    },
    {
      key: 'encarregado', label: 'Encarregado',
      render: (i) => (
        <div>
          <div>{i.encarregado_nome || i.responsavel_nome || '—'}</div>
          <div className="col-sub">{i.telefone_emergencia || i.responsavel_telefone || i.responsavel_email || '—'}</div>
        </div>
      ),
    },
    { key: 'classe', label: 'Classe', render: (i) => classeExibida(i) },
    { key: 'ano_letivo', label: 'Ano', headerWidth: '70px' },
    {
      key: 'data_inscricao', label: 'Data',
      render: (i) => <span className="col-muted">{new Date(i.data_inscricao).toLocaleDateString('pt-BR')}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (i) => <Badge tone={STATUS_TONE[i.status] || 'gray'}>{i.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'acoes', label: 'Ações',
      render: (i) => (
        <div className="row-actions">
          <Button variant="outline" size="sm" icon={<Eye size={14} />} onClick={() => verDetalhe(i.id)} title="Ver detalhes" />
          <Button variant="primary" size="sm" icon={<CheckCircle size={14} />} onClick={() => abrirStatus(i)} title="Alterar status" />
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} key={toast.key} />}
      <div className="page-header">
        <h2>Gestão de Inscrições</h2>
        <p>{total} inscrição(ões) encontrada(s)</p>
      </div>

      <div className="card filters-card">
        <div className="filters-row">
          <FormField label="Status" htmlFor="filtro-status" className="filter-field">
            <Select id="filtro-status" value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value, page: 1 })}>
              <option value="">Todos os status</option>
              {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label.replace(/[✓✗]/g, '').trim()}</option>)}
            </Select>
          </FormField>
          <FormField label="Ano Letivo" htmlFor="filtro-ano" className="filter-field">
            <Select id="filtro-ano" value={filtros.ano_letivo} onChange={(e) => setFiltros({ ...filtros, ano_letivo: e.target.value, page: 1 })}>
              <option value="">Todos os anos</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </Select>
          </FormField>
          <Button variant="outline" onClick={() => setFiltros({ status: '', ano_letivo: '', busca: '', page: 1 })}>
            Limpar Filtros
          </Button>
        </div>
      </div>

      <div className="card list-card">
        {loading ? (
          <LoadingState />
        ) : (
          <DataTable
            columns={columns}
            rows={inscricoes}
            keyField="id"
            sortable={false}
            emptyMessage="Nenhuma inscrição encontrada"
          />
        )}
        <Pagination
          page={filtros.page}
          pageSize={15}
          total={total}
          onPageChange={(p) => setFiltros({ ...filtros, page: p })}
          showTotal={false}
        />
      </div>

      <Modal
        open={!!detalhe}
        onClose={() => setDetalhe(null)}
        title={detalhe ? `Inscrição #${detalhe.id}` : ''}
      >
        {detalhe && (
          <>
            <div className="detail-grid">
              <div>
                <h4 className="detail-title">Dados do Aluno</h4>
                {[
                  ['Nome', detalhe.nome],
                  ['Data Nasc.', detalhe.data_nascimento && new Date(detalhe.data_nascimento).toLocaleDateString('pt-BR')],
                  ['BI', detalhe.aluno_cpf || detalhe.cpf],
                  ['Sexo', detalhe.sexo],
                  ['Mãe', detalhe.nome_mae],
                  ['Pai', detalhe.nome_pai],
                  ['Tel. Emergência', detalhe.telefone_emergencia],
                ].map(([label, val]) => val ? (
                  <div key={label} className="detail-row">
                    <span>{label}: </span><strong>{val}</strong>
                  </div>
                ) : null)}
              </div>
              <div>
                <h4 className="detail-title">Encarregado de Educação</h4>
                {[
                  ['Nome', detalhe.responsavel || detalhe.responsavel_nome],
                  ['E-mail', detalhe.responsavel_email],
                  ['Telefone', detalhe.responsavel_telefone],
                  ['Endereço', detalhe.responsavel_endereco],
                ].map(([label, val]) => val ? (
                  <div key={label} className="detail-row">
                    <span>{label}: </span><strong>{val}</strong>
                  </div>
                ) : null)}
                <h4 className="detail-title" style={{ margin: '1rem 0 12px' }}>Inscrição</h4>
                {[
                  ['Série', normalizeSeriesName(detalhe.serie_nome)],
                  ['Nível', detalhe.nivel],
                  ['Ano', detalhe.ano_letivo],
                  ['Status', detalhe.status],
                ].map(([label, val]) => val ? (
                  <div key={label} className="detail-row">
                    <span>{label}: </span><strong>{val}</strong>
                  </div>
                ) : null)}
              </div>
            </div>

            {detalhe.necessidades_especiais && (
              <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                <strong>⚠ Necessidades Especiais:</strong> {detalhe.necessidades_especiais}
              </div>
            )}

            {detalhe.documentos?.length > 0 && (
              <div className="detail-docs">
                <h4 className="detail-title">Documentos Enviados</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detalhe.documentos.map(d => {
                    const url = fileUrl(d.caminho_arquivo);
                    return (
                      <div key={d.id} className="doc-row">
                        <div className="doc-row-main">
                          <div className="doc-row-name">{d.tipo.replace(/_/g, ' ')}</div>
                          <div className="doc-row-file">{d.nome_arquivo}</div>
                        </div>
                        <div className="doc-row-actions">
                          <Badge tone={DOC_STATUS_TONE[d.status] || 'gray'}>
                            {d.status === 'pendente' ? 'Aguarda revisão' : d.status}
                          </Badge>
                          {url && (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">
                              Ver
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {detalhe.observacao_admin && (
              <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                <strong>Observação:</strong> {detalhe.observacao_admin}
              </div>
            )}
            {detalhe.motivo_rejeicao && (
              <div className="alert alert-error" style={{ marginTop: '0.5rem' }}>
                <strong>Motivo rejeição:</strong> {detalhe.motivo_rejeicao}
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal
        open={!!statusModal}
        onClose={() => setStatusModal(null)}
        title={statusModal ? `Alterar Status — #${statusModal.id}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusModal(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={salvarStatus} loading={salvando} block>
              {salvando ? 'Salvando...' : 'Confirmar'}
            </Button>
          </>
        }
      >
        {statusModal && (
          <>
            <p className="status-hint" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Aluno: <strong>{statusModal.aluno_nome}</strong> — {normalizeSeriesName(statusModal.serie_nome)}
            </p>
            <FormField label="Novo Status" htmlFor="ns-status">
              <Select id="ns-status" value={novoStatus.status} onChange={(e) => setNovoStatus({ ...novoStatus, status: e.target.value })}>
                {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </FormField>
            <FormField label="Observação (interna)" htmlFor="ns-obs">
              <Textarea id="ns-obs" rows={2} value={novoStatus.observacao_admin} onChange={(e) => setNovoStatus({ ...novoStatus, observacao_admin: e.target.value })} placeholder="Nota interna sobre a decisão..." />
            </FormField>
            {novoStatus.status === 'aprovada' && (
              <FormField label="Turma (matrícula académica)" htmlFor="ns-turma" hint="Ao selecionar uma turma, o aluno passa a ver horários e disciplinas no portal.">
                <Select id="ns-turma" value={novoStatus.turma_id} onChange={(e) => setNovoStatus({ ...novoStatus, turma_id: e.target.value })}>
                  <option value="">Aprovar sem turma (matricular depois)</option>
                  {turmas.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nome} — {t.serie_classe}ª{t.curso_nome ? ` · ${t.curso_nome}` : ''} ({t.turno})
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            {novoStatus.status === 'rejeitada' && (
              <FormField label="Motivo da Rejeição" htmlFor="ns-motivo" required>
                <Textarea id="ns-motivo" rows={2} value={novoStatus.motivo_rejeicao} onChange={(e) => setNovoStatus({ ...novoStatus, motivo_rejeicao: e.target.value })} placeholder="Este motivo será visível para o responsável..." required />
              </FormField>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
