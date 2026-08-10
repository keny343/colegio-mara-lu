import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { FileUp, Upload, FileText, Download } from 'lucide-react';
import Toast, { useToast } from '../components/Toast.js';
import { fileUrl } from '../services/fileUrl';
import { Button, Card, DataTable, EmptyState, FormField, Input, Select } from '../components/ui';
import './ProfessorMateriais.css';

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

  const columns = [
    { key: 'tipo', label: 'Tipo', render: m => <span className="mat-tipo">{tipoIcon(m.tipo)}</span> },
    { key: 'titulo', label: 'Título', sortable: true, render: m => <strong>{m.titulo}</strong> },
    { key: 'turma_nome', label: 'Turma', sortable: true, render: m => m.turma_nome || '—' },
    { key: 'disciplina_nome', label: 'Disciplina', sortable: true, render: m => m.disciplina_nome || '—' },
    {
      key: 'caminho',
      label: 'Abrir',
      render: m => (
        <a className="btn btn-outline btn-sm" href={fileUrl(m.caminho)} target="_blank" rel="noreferrer">
          <Download size={13} /> Abrir
        </a>
      ),
    },
  ];

  return (
    <div className="page-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} key={toast.key} />}

      <div className="page-header">
        <h2 className="page-header-title"><FileUp size={22} />Materiais didácticos</h2>
        <p className="page-header-sub">Partilhe PDF, vídeo ou imagens com as suas turmas. Os alunos recebem notificação automática.</p>
      </div>

      {erro && (
        <div className="alert alert-error mat-erro">
          <span>{erro}</span>
          <button type="button" className="alert-close" aria-label="Fechar mensagem de erro" onClick={() => setErro('')}>×</button>
        </div>
      )}

      <Card title="Publicar novo material" className="mat-card">
        <form onSubmit={enviar}>
          <FormField label="Título *" htmlFor="mat-titulo" required>
            <Input id="mat-titulo" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Ficha de exercícios — Capítulo 3" required />
          </FormField>
          <div className="form-row">
            <FormField label="Turma" htmlFor="mat-turma">
              <Select id="mat-turma" value={form.turma_id} onChange={e => setForm({ ...form, turma_id: e.target.value, disciplina_id: '' })}>
                <option value="">Todas / geral</option>
                {turmasUnicas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </Select>
            </FormField>
            <FormField label="Disciplina" htmlFor="mat-disciplina">
              <Select id="mat-disciplina" value={form.disciplina_id} onChange={e => setForm({ ...form, disciplina_id: e.target.value })} disabled={!form.turma_id}>
                <option value="">—</option>
                {disciplinas
                  .filter(d => !form.turma_id || String(d.turma_id) === String(form.turma_id))
                  .map(d => (
                    <option key={d.disciplina_id} value={d.disciplina_id}>{d.disciplina_nome}</option>
                  ))}
              </Select>
            </FormField>
          </div>
          <FormField label="Ficheiro *" htmlFor="material-file-input" required hint="PDF, Word, imagem ou vídeo. Máximo 50 MB.">
            <Input id="material-file-input" type="file" accept=".pdf,.mp4,.webm,.mov,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={e => setForm({ ...form, arquivo: e.target.files?.[0] || null })} />
          </FormField>
          <Button type="submit" variant="primary" icon={<Upload size={16} />} loading={saving}>
            {saving ? 'A enviar...' : 'Publicar material'}
          </Button>
        </form>
      </Card>

      <Card
        title={<span className="mat-list-title"><FileText size={18} /> Materiais publicados</span>}
        actions={<span className="mat-count">{lista.length}</span>}
      >
        {lista.length === 0 ? (
          <EmptyState icon={<FileUp size={40} />} title="Nenhum material publicado ainda." />
        ) : (
          <DataTable columns={columns} rows={lista} keyField="id" emptyMessage="Nenhum material publicado ainda." />
        )}
      </Card>
    </div>
  );
}
