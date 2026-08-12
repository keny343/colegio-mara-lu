import React, { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Upload, Download, Eye } from 'lucide-react';
import Toast, { useToast } from '../components/Toast';
import { fileUrl } from '../services/fileUrl';
import { useFetch } from '../hooks/useFetch';
import { Card, FormField, Input, Button, DataTable, EmptyState, LoadingState, ErrorState } from '../components/ui';
import './PlanoCurricular.css';

export default function PlanoCurricular() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isCoordenador = user?.role === 'coordenador' || user?.curso_coordenado || user?.nivel_coordenado;
  const isProfessor = user?.role === 'professor';
  const podePublicar = isAdmin || isCoordenador;

  const [titulo, setTitulo] = useState('Plano curricular');
  const [arquivo, setArquivo] = useState(null);
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast, showToast, clearToast } = useToast();

  const { data: planos = [], loading, error, refetch } = useFetch((signal) => api.get('/planos-curriculares', { signal }), []);

  const enviar = async (e) => {
    e.preventDefault();
    if (!arquivo) return setErro('Seleccione o ficheiro do plano (PDF, Word ou imagem).');
    setSaving(true);
    setErro('');
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    fd.append('titulo', titulo);
    try {
      await api.post('/staff/plano-curricular', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast('Plano curricular publicado! Professores e alunos do seu âmbito foram notificados.', 'success');
      setArquivo(null);
      const fileInput = document.getElementById('plano-file-input');
      if (fileInput) fileInput.value = '';
      refetch();
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao publicar plano.';
      setErro(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'titulo', label: 'Título',
      render: (p) => (
        <div className="plano-titulo">
          <FileText size={16} color="var(--laranja)" />
          <strong>{p.titulo}</strong>
        </div>
      ),
    },
    {
      key: 'ambito', label: 'Âmbito',
      render: (p) => (
        <span className="ambito-pill">{p.curso_coordenado || p.nivel_coordenado || 'Geral'}</span>
      ),
    },
    { key: 'coordenador_nome', label: 'Coordenador' },
    {
      key: 'criado_em', label: 'Data',
      render: (p) => <span className="mat-data">{new Date(p.criado_em).toLocaleDateString('pt-AO')}</span>,
    },
    {
      key: 'abrir', label: 'Abrir',
      render: (p) => (
        <a className="btn btn-outline btn-sm" href={fileUrl(p.caminho)} target="_blank" rel="noreferrer">
          <Download size={13} /> Abrir
        </a>
      ),
    },
  ];

  return (
    <div className="page-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} key={toast.key} />}

      <div className="page-header">
        <h2><FileText size={22} /> Plano curricular</h2>
        <p>
          {podePublicar
            ? 'Publique o plano para o ciclo ou curso que coordena. Professores e alunos recebem notificação automática.'
            : isProfessor
              ? 'Consulte aqui os planos curriculares enviados pelos coordenadores para as suas turmas.'
              : 'Consulte o plano curricular da sua área.'}
        </p>
      </div>

      {erro && (
        <div className="alert alert-error plano-erro">
          <span>{erro}</span>
          <button type="button" className="alert-close" aria-label="Fechar mensagem de erro" onClick={() => setErro('')}>×</button>
        </div>
      )}

      {podePublicar && (
        <Card title="Publicar novo plano" className="plano-form-card">
          <form onSubmit={enviar} className="plano-form">
            <FormField label="Título" htmlFor="plano-titulo">
              <Input
                id="plano-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Plano curricular 2024/2025 — 10ª classe"
              />
            </FormField>
            <FormField label="Ficheiro" htmlFor="plano-file-input" required hint="PDF, Word ou imagem. Máximo 25 MB.">
              <Input
                id="plano-file-input"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              />
            </FormField>
            <Button type="submit" variant="primary" loading={saving} icon={<Upload size={16} />}>
              {saving ? 'A publicar...' : 'Publicar plano'}
            </Button>
          </form>
        </Card>
      )}

      {isProfessor && !podePublicar && planos.length > 0 && (
        <div className="plano-alert">
          📋 Tem <strong>{planos.length}</strong> plano(s) curricular(es) disponível(is) do(s) coordenador(es) das suas turmas.
        </div>
      )}

      <div className="card mat-card">
        <div className="mat-head">
          <Eye size={18} color="var(--castanho)" />
          <h3>Planos disponíveis</h3>
          <span className="mat-count">{planos.length}</span>
        </div>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            columns={columns}
            rows={planos}
            keyField="id"
            emptyMessage={
              isProfessor
                ? 'Nenhum plano curricular disponível. O coordenador ainda não publicou o plano para as suas turmas.'
                : 'Nenhum plano publicado ainda.'
            }
          />
        )}
      </div>
    </div>
  );
}
