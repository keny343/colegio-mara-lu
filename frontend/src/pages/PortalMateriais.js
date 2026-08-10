import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { BookOpen, Download, FileText } from 'lucide-react';
import { fileUrl } from '../services/fileUrl';

const tipoIcon = (tipo) => {
  if (tipo === 'pdf') return '📄';
  if (tipo === 'video') return '🎬';
  if (tipo === 'imagem') return '🖼️';
  return '📎';
};

export default function PortalMateriais() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get('/materiais/recebidos')
      .then((r) => {
        setLista(r.data);
      })
      .catch(() => setErro('Não foi possível carregar os materiais.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading" role="status" aria-label="A carregar materiais"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2><BookOpen size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Materiais didácticos</h2>
        <p style={{ color: 'var(--cinza)' }}>
          Consulte os materiais partilhados pelos seus professores (PDF, vídeo ou imagem).
        </p>
      </div>

      {erro && (
        <div className="alert alert-error" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1rem 1rem 0.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} color="var(--castanho)" />
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Materiais disponíveis</h3>
          <span style={{ marginLeft: 'auto', background: 'var(--bege-medio)', borderRadius: 20, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--castanho)' }}>
            {lista.length}
          </span>
        </div>
        {lista.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <BookOpen size={40} style={{ opacity: 0.3 }} />
            <p style={{ color: 'var(--cinza)' }}>
              Nenhum material disponível. Os professores publicarão aqui os conteúdos das aulas.
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Título</th>
                <th>Professor</th>
                <th>Disciplina</th>
                <th>Data</th>
                <th>Abrir</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id}>
                  <td style={{ textAlign: 'center', fontSize: '1.2rem' }}>{tipoIcon(m.tipo)}</td>
                  <td><strong>{m.titulo}</strong></td>
                  <td>{m.professor_nome || '—'}</td>
                  <td>{m.disciplina_nome || '—'}</td>
                  <td>{new Date(m.criado_em).toLocaleDateString('pt-AO')}</td>
                  <td>
                    <a
                      className="btn btn-outline btn-sm"
                      href={fileUrl(m.caminho)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Abrir material ${m.titulo}`}
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
