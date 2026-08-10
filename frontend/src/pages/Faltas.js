import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Calendar, Upload, X, FileText } from 'lucide-react';
import api from '../services/api';
import { Modal, FormField, Textarea, Button, LoadingState, EmptyState } from '../components/ui';
import './Faltas.css';

export default function Faltas() {
  const [faltas, setFaltas] = useState([]);
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
    if (!justForm.motivo.trim()) {
      setJustErro('Por favor descreva o motivo da falta.');
      return;
    }
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

  const porDisciplina = faltas.reduce((acc, f) => {
    if (!acc[f.disciplina]) acc[f.disciplina] = [];
    acc[f.disciplina].push(f);
    return acc;
  }, {});

  const total = faltas.length;
  const justificadas = faltas.filter(f => f.justificativa).length;
  const injustificadas = total - justificadas;

  const stats = [
    { label: 'Total de faltas', value: total, tone: 'castanho' },
    { label: 'Justificadas', value: justificadas, tone: 'verde' },
    { label: 'Injustificadas', value: injustificadas, tone: 'vermelho' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Registo de Faltas</h2>
        <p>Acompanha as tuas faltas por disciplina. Podes justificar faltas injustificadas.</p>
      </div>

      <div className="stats-grid stats-grid--3">
        {stats.map((s) => (
          <div key={s.label} className={`stat-card stat-card--${s.tone}`}>
            <div className="stat-number">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <LoadingState />
        ) : faltas.length === 0 ? (
          <EmptyState
            icon={<CheckCircle size={48} color="var(--verde)" />}
            title="Sem faltas registadas"
            message="Não tens faltas registadas até ao momento."
          />
        ) : (
          Object.entries(porDisciplina).map(([disc, fs]) => (
            <div key={disc} className="falta-group">
              <div className="falta-group-head">
                <AlertTriangle size={16} color="var(--amarelo)" />
                <h3>{disc}</h3>
                <span className="falta-count">{fs.length} falta(s)</span>
              </div>
              <div className="falta-list">
                {fs.map((f, i) => (
                  <div key={i} className={`falta-item${f.justificativa ? ' falta-item--justificada' : ' falta-item--injustificada'}`}>
                    <div className="falta-date">
                      <Calendar size={14} color="var(--cinza)" />
                      <span>{new Date(f.data_falta).toLocaleDateString('pt-PT')}</span>
                      {f.justificativa && <span className="falta-just-text">— {f.justificativa}</span>}
                    </div>
                    <div className="falta-actions">
                      <span className={`falta-status${f.justificativa ? ' falta-status--ok' : ''}`}>
                        {f.justificativa ? 'Justificada' : 'Injustificada'}
                      </span>
                      {!f.justificativa && f.id && (
                        <Button variant="outline" size="sm" className="falta-just-btn" icon={<Upload size={12} />} onClick={() => abrirJustModal(f)}>
                          Justificar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={!!justModal}
        onClose={() => setJustModal(null)}
        title="Justificar Falta"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setJustModal(null)} disabled={justSaving}>
              Cancelar
            </Button>
            <Button variant="primary" block loading={justSaving} icon={<Upload size={15} />} onClick={enviarJustificacao}>
              {justSaving ? 'A enviar...' : 'Enviar Justificação'}
            </Button>
          </>
        }
      >
        {justModal && (
          <>
            <p className="falta-modal-info">
              Falta de <strong>{new Date(justModal.data_falta).toLocaleDateString('pt-PT')}</strong> — {justModal.disciplina}
            </p>

            {justErro && <div className="alert alert-error">{justErro}</div>}
            {justOk && <div className="alert alert-success">{justOk}</div>}

            <FormField label="Motivo da ausência" htmlFor="just-motivo" required>
              <Textarea
                id="just-motivo"
                rows={3}
                placeholder="Ex: Consulta médica, urgência familiar..."
                value={justForm.motivo}
                onChange={(e) => setJustForm((f) => ({ ...f, motivo: e.target.value }))}
              />
            </FormField>

            <FormField label="Documento comprovatório (opcional)" htmlFor="just-doc" hint="Podes anexar um atestado médico, declaração ou outro documento (imagem ou PDF).">
              <div className="falta-file-row">
                <label className="btn btn-outline btn-sm falta-file-label">
                  <FileText size={14} /> {justForm.documento ? justForm.documento.name : 'Escolher ficheiro'}
                  <input
                    id="just-doc"
                    type="file"
                    accept="image/*,.pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => setJustForm((f) => ({ ...f, documento: e.target.files?.[0] || null }))}
                  />
                </label>
                {justForm.documento && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<X size={14} />}
                    onClick={() => setJustForm((f) => ({ ...f, documento: null }))}
                  />
                )}
              </div>
            </FormField>
          </>
        )}
      </Modal>
    </div>
  );
}
