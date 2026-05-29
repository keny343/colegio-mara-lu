import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { FileUp, Upload, FileText, Download, Trash2 } from 'lucide-react';
import Toast, { useToast } from '../components/Toast.js';

export default function ProfessorMateriais() {
  const [lista, setLista] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [form, setForm] = useState({ titulo: '', turma_id: '', disciplina_id: '', arquivo: null });
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast, showToast, clearToast } = useToast();

  const carregar = () => {
    api.get('/professor/materiais').then(r => setLista(r.data)).catch(() => setErro('Erro ao carregar materiais.'));
  };

  useEffect(() => {
    carregar();
    api.get('/professor/minhas-disciplinas').then(r => setDisciplinas(r.data)).catch(() => {});
  }, []);

  const turmasUnicas = [...new Map(disciplinas.map(d => [d.turma_id, { id: d.turma_id, nome: d.turma_nome }])).values()];

  const enviar = async (e) => {
    e.preventDefault();
    if (!form.arquivo) return setErro('Seleccione um ficheiro (PDF, vídeo ou imagem).');
    setSaving(true);
    setErro('');
    const fd = new FormData();
    fd.append('arquivo', form.arquivo);
    fd.append('titulo', form.titulo);
    if (form.turma_id) fd.append('turma_id', form.turma_id);
    if (form.disciplina_id) fd.append('disciplina_id', form.disciplina_id);
    try {
      await api.post('/professor/materiais', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast('Material publicado! Os alunos da turma receberam uma notificação.', 'success');
      setForm({ titulo: '', turma_id: '', disciplina_id: '', arquivo: null });
      // reset file input
      const fileInput = document.getElementById('material-file-input');
      if (fileInput) fileInput.value = '';
      carregar();
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao publicar.';
      setErro(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const tipoIcon = (tipo) => {
    if (tipo === 'pdf') return '📄';
    if (tipo === 'video') return '🎬';
    if (tipo === 'imagem') return '🖼️';
    return '📎';
  };

  return (
    <div className="page-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} key={toast.key} />}

      <div className="page-header">
        <h2><FileUp size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Materiais didácticos</h2>
        <p style={{ color: 'var(--cinza)' }}>Partilhe PDF, vídeo ou imagens com as suas turmas. Os alunos recebem notificação automática.</p>
      </div>

      {erro && (
        <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{erro}</span>
          <button type="button" className="alert-close" onClick={() => setErro('')}>×</button>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1rem', color: 'var(--castanho)' }}>
          Publicar novo material
        </h3>
        <form onSubmit={enviar}>
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input
              className="form-control"
              value={form.titulo}
              onChange={e => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex: Ficha de exercícios — Capítulo 3"
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Turma</label>
              <select
                className="form-control form-select"
                value={form.turma_id}
                onChange={e => setForm({ ...form, turma_id: e.target.value, disciplina_id: '' })}
              >
                <option value="">Todas / geral</option>
                {turmasUnicas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Disciplina</label>
              <select
                className="form-control form-select"
                value={form.disciplina_id}
                onChange={e => setForm({ ...form, disciplina_id: e.target.value })}
                disabled={!form.turma_id}
              >
                <option value="">—</option>
                {disciplinas
                  .filter(d => !form.turma_id || String(d.turma_id) === String(form.turma_id))
                  .map(d => (
                    <option key={d.disciplina_id} value={d.disciplina_id}>{d.disciplina_nome}</option>
                  ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Ficheiro *</label>
            <input
              id="material-file-input"
              type="file"
              className="form-control"
              accept=".pdf,.mp4,.webm,.mov,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={e => setForm({ ...form, arquivo: e.target.files?.[0] || null })}
            />
            <small style={{ color: 'var(--cinza)', fontSize: '0.8rem' }}>
              PDF, Word, imagem ou vídeo. Máximo 50 MB.
            </small>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Upload size={16} /> {saving ? 'A enviar...' : 'Publicar material'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1rem 1rem 0.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} color="var(--castanho)" />
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Materiais publicados</h3>
          <span style={{ marginLeft: 'auto', background: 'var(--bege-medio)', borderRadius: 20, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--castanho)' }}>
            {lista.length}
          </span>
        </div>
        {lista.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <FileUp size={40} style={{ opacity: 0.3 }} />
            <p style={{ color: 'var(--cinza)' }}>Nenhum material publicado ainda.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Título</th>
                <th>Turma</th>
                <th>Disciplina</th>
                <th>Abrir</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(m => (
                <tr key={m.id}>
                  <td style={{ textAlign: 'center', fontSize: '1.2rem' }}>{tipoIcon(m.tipo)}</td>
                  <td><strong>{m.titulo}</strong></td>
                  <td>{m.turma_nome || '—'}</td>
                  <td>{m.disciplina_nome || '—'}</td>
                  <td>
                    <a
                      className="btn btn-outline btn-sm"
                      href={`/uploads/materiais/${m.caminho}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download size={13} /> Abrir
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}