import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, CheckCircle, FileText, X } from 'lucide-react';
import api from '../services/api';
import { normalizeSeriesName } from '../utils/serieName';
import Toast, { useToast } from '../components/Toast';

function StatusBadge({ status }) {
  const map = {
    pendente: 'badge-pendente', em_analise: 'badge-em_analise',
    aprovada: 'badge-aprovada', rejeitada: 'badge-rejeitada', cancelada: 'badge-cancelada'
  };
  return <span className={`badge ${map[status] || ''}`}>{status.replace('_', ' ')}</span>;
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

  const totalPages = Math.ceil(total / 15);

  const docUrl = (caminho) => {
    if (!caminho) return null;
    // Cloudinary URLs (https://...)
    if (caminho.startsWith('http')) {
      // PDFs enviados via resource_type:'auto' ficaram como /image/upload/ no Cloudinary
      // mas devem ser servidos como /raw/upload/ para abrir no browser
      if (caminho.includes('/image/upload/') && caminho.endsWith('.pdf')) {
        return caminho.replace('/image/upload/', '/raw/upload/');
      }
      return caminho;
    }
    // Arquivos locais existentes no banco (apenas nome do arquivo)
    // Em produção, usar URL completa do backend via variável de ambiente
    // Em desenvolvimento, usar proxy
    if (process.env.REACT_APP_API_URL) {
      return `${process.env.REACT_APP_API_URL}/uploads/${caminho}`;
    }
    // Fallback para desenvolvimento com proxy
    return `/uploads/${caminho}`;
  };

  return (
    <div className="page-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} key={toast.key} />}
      <div className="page-header">
        <h2>Gestão de Inscrições</h2>
        <p style={{ color: 'var(--cinza)' }}>{total} inscrição(ões) encontrada(s)</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label className="form-label">Status</label>
            <select className="form-control form-select" value={filtros.status}
              onChange={e => setFiltros({ ...filtros, status: e.target.value, page: 1 })}>
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="em_analise">Em Análise</option>
              <option value="aprovada">Aprovada</option>
              <option value="rejeitada">Rejeitada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label className="form-label">Ano Letivo</label>
            <select className="form-control form-select" value={filtros.ano_letivo}
              onChange={e => setFiltros({ ...filtros, ano_letivo: e.target.value, page: 1 })}>
              <option value="">Todos os anos</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
          <button className="btn btn-outline" onClick={() => setFiltros({ status: '', ano_letivo: '', busca: '', page: 1 })}>
            Limpar Filtros
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : inscricoes.length === 0 ? (
        <div className="card empty-state"><FileText size={48} /><h3>Nenhuma inscrição encontrada</h3></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>Aluno</th><th>Encarregado</th><th>classe</th>
                  <th>Ano</th><th>Data</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {inscricoes.map(i => (
                  <tr key={i.id}>
                    <td style={{ color: 'var(--cinza)', fontSize: '0.85rem' }}>#{i.id}</td>
                    <td><strong>{i.aluno_nome}</strong></td>
                    <td>
                      <div>{i.encarregado_nome || i.responsavel_nome || '—'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--cinza)' }}>
                        {i.telefone_emergencia || i.responsavel_telefone || i.responsavel_email || '—'}
                      </div>
                    </td>
                    <td>{normalizeSeriesName(i.serie_nome)}</td>
                    <td>{i.ano_letivo}</td>
                    <td style={{ fontSize: '0.85rem' }}>{new Date(i.data_inscricao).toLocaleDateString('pt-BR')}</td>
                    <td><StatusBadge status={i.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => verDetalhe(i.id)} title="Ver detalhes"><Eye size={14} /></button>
                        <button className="btn btn-sm btn-primary" onClick={() => abrirStatus(i)} title="Alterar status"><CheckCircle size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '1rem' }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`btn btn-sm ${p === filtros.page ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFiltros({ ...filtros, page: p })}>{p}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {detalhe && (
        <div className="modal-overlay" onClick={() => setDetalhe(null)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Inscrição #{detalhe.id}</h3>
              <button className="modal-close" onClick={() => setDetalhe(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <h4 style={{ color: 'var(--castanho-medio)', marginBottom: 12, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dados do Aluno</h4>
                {[
                  ['Nome', detalhe.nome],
                  ['Data Nasc.', detalhe.data_nascimento && new Date(detalhe.data_nascimento).toLocaleDateString('pt-BR')],
                  ['BI', detalhe.aluno_cpf || detalhe.cpf],
                  ['Sexo', detalhe.sexo],
                  ['Mãe', detalhe.nome_mae],
                  ['Pai', detalhe.nome_pai],
                  ['Tel. Emergência', detalhe.telefone_emergencia],
                ].map(([label, val]) => val ? (
                  <div key={label} style={{ marginBottom: 8, fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--cinza)' }}>{label}: </span><strong>{val}</strong>
                  </div>
                ) : null)}
              </div>
              <div>
                <h4 style={{ color: 'var(--castanho-medio)', marginBottom: 12, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Encarregado de Educação</h4>
                {[
                  ['Nome', detalhe.responsavel || detalhe.responsavel_nome],
                  ['E-mail', detalhe.responsavel_email],
                  ['Telefone', detalhe.responsavel_telefone],
                  ['Endereço', detalhe.responsavel_endereco],
                ].map(([label, val]) => val ? (
                  <div key={label} style={{ marginBottom: 8, fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--cinza)' }}>{label}: </span><strong>{val}</strong>
                  </div>
                ) : null)}
                <h4 style={{ color: 'var(--castanho-medio)', margin: '1rem 0 12px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inscrição</h4>
                {[
                  ['Série', normalizeSeriesName(detalhe.serie_nome)],
                  ['Nível', detalhe.nivel],
                  ['Ano', detalhe.ano_letivo],
                  ['Status', detalhe.status],
                ].map(([label, val]) => val ? (
                  <div key={label} style={{ marginBottom: 8, fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--cinza)' }}>{label}: </span><strong>{val}</strong>
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
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ color: 'var(--castanho-medio)', marginBottom: 12, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Documentos Enviados</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detalhe.documentos.map(d => {
                    const url = docUrl(d.caminho_arquivo);
                    return (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bege-claro)', borderRadius: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.tipo.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--cinza)' }}>{d.nome_arquivo}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={`badge badge-${d.status}`}>
                            {d.status === 'pendente' ? 'Aguarda revisão' : d.status}
                          </span>
                          {url && (
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="btn btn-sm btn-outline"
                              style={{ fontSize: '0.75rem', padding: '3px 10px' }}>
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
          </div>
        </div>
      )}

      {statusModal && (
        <div className="modal-overlay" onClick={() => setStatusModal(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Alterar Status — #{statusModal.id}</h3>
              <button className="modal-close" onClick={() => setStatusModal(null)}><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--cinza)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Aluno: <strong>{statusModal.aluno_nome}</strong> — {normalizeSeriesName(statusModal.serie_nome)}
            </p>
            <div className="form-group">
              <label className="form-label">Novo Status</label>
              <select className="form-control form-select" value={novoStatus.status}
                onChange={e => setNovoStatus({ ...novoStatus, status: e.target.value })}>
                <option value="pendente">Pendente</option>
                <option value="em_analise">Em Análise</option>
                <option value="aprovada">Aprovada ✓</option>
                <option value="rejeitada">Rejeitada ✗</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Observação (interna)</label>
              <textarea className="form-control" rows={2} value={novoStatus.observacao_admin}
                onChange={e => setNovoStatus({ ...novoStatus, observacao_admin: e.target.value })}
                placeholder="Nota interna sobre a decisão..." />
            </div>
            {novoStatus.status === 'aprovada' && (
              <div className="form-group">
                <label className="form-label">Turma (matrícula académica)</label>
                <select className="form-control form-select" value={novoStatus.turma_id}
                  onChange={e => setNovoStatus({ ...novoStatus, turma_id: e.target.value })}>
                  <option value="">Aprovar sem turma (matricular depois)</option>
                  {turmas.map(t => (
                    <option key={t.id} value={t.id}>{t.nome} — {t.serie_classe}ª ({t.turno})</option>
                  ))}
                </select>
                <p style={{ fontSize: '0.8rem', color: 'var(--cinza)', marginTop: 6 }}>
                  Ao selecionar uma turma, o aluno passa a ver horários e disciplinas no portal.
                </p>
              </div>
            )}
            {novoStatus.status === 'rejeitada' && (
              <div className="form-group">
                <label className="form-label">Motivo da Rejeição *</label>
                <textarea className="form-control" rows={2} value={novoStatus.motivo_rejeicao}
                  onChange={e => setNovoStatus({ ...novoStatus, motivo_rejeicao: e.target.value })}
                  placeholder="Este motivo será visível para o responsável..." required />
              </div>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-outline" onClick={() => setStatusModal(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarStatus} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
//agr vai dar certo