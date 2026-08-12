import React from 'react';
import { Download, BookOpen, FileText } from 'lucide-react';
import api from '../services/api';
import { fileUrl } from '../services/fileUrl';
import { useFetch } from '../hooks/useFetch';
import { DataTable, EmptyState, LoadingState, ErrorState } from '../components/ui';
import './PortalMateriais.css';

const tipoIcon = (tipo) => {
  if (tipo === 'pdf') return '📄';
  if (tipo === 'video') return '🎬';
  if (tipo === 'imagem') return '🖼️';
  return '📎';
};

export default function PortalMateriais() {
  const { data: lista = [], loading, error, refetch } = useFetch((signal) => api.get('/materiais/recebidos', { signal }), []);

  const columns = [
    {
      key: 'tipo', label: 'Tipo', headerWidth: '60px',
      render: (m) => <span style={{ fontSize: '1.2rem' }}>{tipoIcon(m.tipo)}</span>,
    },
    { key: 'titulo', label: 'Título', render: (m) => <strong>{m.titulo}</strong> },
    { key: 'professor_nome', label: 'Professor', render: (m) => m.professor_nome || '—' },
    { key: 'disciplina_nome', label: 'Disciplina', render: (m) => m.disciplina_nome || '—' },
    {
      key: 'criado_em', label: 'Data',
      render: (m) => <span className="mat-data">{new Date(m.criado_em).toLocaleDateString('pt-AO')}</span>,
    },
    {
      key: 'abrir', label: 'Abrir',
      render: (m) => (
        <a
          className="btn btn-outline btn-sm"
          href={fileUrl(m.caminho)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir material ${m.titulo}`}
        >
          <Download size={13} /> Abrir
        </a>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2><BookOpen size={22} /> Materiais didácticos</h2>
        <p>Consulte os materiais partilhados pelos seus professores (PDF, vídeo ou imagem).</p>
      </div>

      <div className="card mat-card">
        <div className="mat-head">
          <FileText size={18} color="var(--castanho)" />
          <h3>Materiais disponíveis</h3>
          <span className="mat-count">{lista.length}</span>
        </div>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            columns={columns}
            rows={lista}
            keyField="id"
            emptyMessage="Nenhum material disponível. Os professores publicarão aqui os conteúdos das aulas."
          />
        )}
      </div>
    </div>
  );
}
