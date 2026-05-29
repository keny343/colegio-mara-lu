import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Calendar, Upload, X, FileText } from 'lucide-react';
import api from '../services/api';

export default function Faltas() {
  const [faltas, setFaltas]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [justModal, setJustModal] = useState(null); // falta selecionada
  const [justForm, setJustForm] = useState({ motivo: '', documento: null });
  const [justSaving, setJustSaving] = useState(false);
  const [justErro, setJustErro] = useState('');
  const [justOk, setJustOk] = useState('');

  const carregar = () => {
    setLoading(true);
    api.get('/aluno/faltas').catch(() => ({ data: [] })).then(res => {
      setFaltas(res.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const abrirJustModal = (falta) => {
    setJustModal(falta);
    setJustForm({ motivo: '', documento: null });
    setJustErro('');
    setJustOk('');
  };

  const enviarJustificacao = async () => {
    if (!justForm.motivo.trim()) { setJustErro('Por favor descreva o motivo da falta.'); return; }
    setJustSaving(true);
    setJustErro('');
    try {
      const fd = new FormData();
      fd.append('falta_id', justModal.id);
      fd.append('motivo', justForm.motivo);
      if (justForm.documento) fd.append('documento', justForm.documento);
      await api.post('/aluno/faltas/justificar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setJustOk('Pedido de justificação enviado com sucesso! O professor irá analisá-lo.');
      setTimeout(() => { setJustModal(null); carregar(); }, 2000);
    } catch (err) {
      setJustErro(err.response?.data?.message || 'Erro ao enviar justificação.');
    } finally {
      setJustSaving(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const porDisciplina = faltas.reduce((acc, f) => {
    if (!acc[f.disciplina]) acc[f.disciplina] = [];
    acc[f.disciplina].push(f);
    return acc;
  }, {});

  const total         = faltas.length;
  const justificadas  = faltas.filter(f => f.justificativa).length;
  const injustificadas = total - justificadas;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Registo de Faltas</h2>
        <p>Acompanha as tuas faltas por disciplina. Podes justificar faltas injustificadas.</p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total de faltas',  value: total,          color: 'var(--castanho-medio)' },
          { label: 'Justificadas',     value: justificadas,   color: 'var(--verde)' },
          { label: 'Injustificadas',   value: injustificadas, color: 'var(--vermelho)' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ borderLeftColor: s.color }}>
            <div className="stat-number" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        {faltas.length === 0 ? (
          <div className="empty-state">
            <CheckCircle size={48} color="var(--verde)" style={{ opacity: 0.6 }} />
            <h3>Sem faltas registadas</h3>
            <p>Não tens faltas registadas até ao momento.</p>
          </div>
        ) : (
          Object.entries(porDisciplina).map(([disc, fs]) => (
            <div key={disc} style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
                <AlertTriangle size={16} color="var(--amarelo)" />
                <h3 style={{ fontSize: '1rem' }}>{disc}</h3>
                <span style={{ marginLeft: 'auto', background: 'var(--bege)', borderRadius: 20, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--castanho)' }}>
                  {fs.length} falta(s)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fs.map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: f.justificativa ? '#F0FDF4' : '#FFF1F2',
                    border: `1px solid ${f.justificativa ? '#BBF7D0' : '#FFE4E6'}`,
                    borderRadius: 8, padding: '0.6rem 1rem', fontSize: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={14} color="var(--cinza)" />
                      <span>{new Date(f.data_falta).toLocaleDateString('pt-PT')}</span>
                      {f.justificativa && <span style={{ color: 'var(--cinza)', fontSize: '0.78rem' }}>— {f.justificativa}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: f.justificativa ? 'var(--verde)' : 'var(--vermelho)' }}>
                        {f.justificativa ? 'Justificada' : 'Injustificada'}
                      </span>
                      {!f.justificativa && f.id && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                          onClick={() => abrirJustModal(f)}
                        >
                          <Upload size={12} /> Justificar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Justificação */}
      {justModal && (
        <div className="modal-overlay" onClick={() => setJustModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Justificar Falta</h3>
              <button className="modal-close" onClick={() => setJustModal(null)}><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--cinza)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              Falta de <strong>{new Date(justModal.data_falta).toLocaleDateString('pt-PT')}</strong> — {justModal.disciplina}
            </p>

            {justErro && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{justErro}</div>}
            {justOk && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{justOk}</div>}

            <div className="form-group">
              <label className="form-label">Motivo da ausência *</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Ex: Consulta médica, urgência familiar..."
                value={justForm.motivo}
                onChange={e => setJustForm(f => ({ ...f, motivo: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Documento comprovatório (opcional)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', marginBottom: 0 }}>
                  <FileText size={14} /> {justForm.documento ? justForm.documento.name : 'Escolher ficheiro'}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    style={{ display: 'none' }}
                    onChange={e => setJustForm(f => ({ ...f, documento: e.target.files?.[0] || null }))}
                  />
                </label>
                {justForm.documento && (
                  <button type="button" className="btn btn-sm" style={{ color: 'var(--vermelho)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => setJustForm(f => ({ ...f, documento: null }))}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--cinza)', marginTop: 6 }}>
                Podes anexar um atestado médico, declaração ou outro documento (imagem ou PDF).
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn btn-outline" onClick={() => setJustModal(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={enviarJustificacao} disabled={justSaving}>
                {justSaving ? 'A enviar...' : <><Upload size={15} /> Enviar Justificação</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
