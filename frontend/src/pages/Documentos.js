import React, { useState, useEffect } from 'react';
import { FileText, Download, Upload, CheckCircle, Clock } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../contexts/NotificationContext';

const TIPOS_DOC = [
  { value: 'declaracao_matricula', label: 'Declaração de Matrícula' },
  { value: 'historico',            label: 'Histórico Escolar' },
  { value: 'boletim',              label: 'Boletim de Notas' },
  { value: 'outro',                label: 'Outro documento' },
];

const STATUS_LABELS = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado'
};

export default function Documentos() {
  const [uploading, setUploading] = useState(false);
  const [sucesso, setSucesso]     = useState('');
  const [erro, setErro]           = useState('');
  const [meusDocs, setMeusDocs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const { success, error } = useNotification();
  const [tipo, setTipo]           = useState('declaracao_matricula');
  const [ficheiro, setFicheiro]   = useState(null);

  useEffect(() => {
    carregarDocumentos();
  }, []);

  const carregarDocumentos = async () => {
    try {
      const res = await api.get('/documentos');
      setMeusDocs(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar documentos:', err);
      setMeusDocs([]);
    } finally {
      setCarregando(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!ficheiro) { setErro('Selecciona um ficheiro primeiro.'); return; }
    setUploading(true); setErro(''); setSucesso('');
    try {
      const fd = new FormData();
      fd.append('arquivo', ficheiro);
      fd.append('tipo', tipo);
      await api.post('/documentos', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSucesso('Documento enviado com sucesso!');
      success('Documento enviado com sucesso!');
      setFicheiro(null);
      e.target.reset();
      carregarDocumentos();
    } catch (err) {
      const message = err.response?.data?.message || 'Erro ao enviar documento.';
      setErro(message);
      error(message);
    }
    setUploading(false);
  };

  const downloadDocumento = (doc) => {
    const link = `/uploads/${doc.caminho_arquivo}`;
    window.open(link, '_blank');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Documentos</h2>
        <p>Envia e consulta os teus documentos escolares</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>

        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="var(--laranja)" /> Meus documentos
          </h3>
          {carregando ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--cinza)' }}>Carregando...</div>
          ) : meusDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--cinza)' }}>
              Nenhum documento enviado ainda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {meusDocs.map((doc) => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bege-claro)', borderRadius: 10, padding: '0.9rem 1rem' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: doc.status === 'aprovado' ? 'var(--laranja-suave)' : 'var(--cinza-claro)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={18} color={doc.status === 'aprovado' ? 'var(--laranja)' : 'var(--cinza)'} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{doc.nome_arquivo}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--cinza)', marginTop: 2 }}>
                        Status: <strong>{STATUS_LABELS[doc.status] || doc.status}</strong>
                      </div>
                      {doc.observacao && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--castanho)', marginTop: 2 }}>
                          {doc.observacao}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {doc.status === 'aprovado' && (
                      <button className="btn btn-primary btn-sm" onClick={() => downloadDocumento(doc)} title="Descarregar documento">
                        <Download size={14} />
                      </button>
                    )}
                    {doc.status === 'pendente' && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--cinza)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> A processar
                      </span>
                    )}
                    {doc.status === 'rejeitado' && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--vermelho)', fontWeight: 600 }}>
                        Rejeitado
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={18} color="var(--laranja)" /> Enviar documento
          </h3>
          {sucesso && <div className="alert alert-success"><CheckCircle size={14} style={{ marginRight: 6 }} />{sucesso}</div>}
          {erro    && <div className="alert alert-error">{erro}</div>}
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tipo de documento</label>
              <select className="form-control form-select" value={tipo} onChange={e => setTipo(e.target.value)}>
                {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Ficheiro (PDF, JPG, PNG)</label>
              <input className="form-control" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFicheiro(e.target.files[0])} style={{ padding: '10px 12px' }} />
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={uploading}>
              <Upload size={16} /> {uploading ? 'A enviar...' : 'Enviar documento'}
            </button>
          </form>
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bege-claro)', borderRadius: 10, fontSize: '0.82rem', color: 'var(--cinza)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--castanho-medio)' }}>Nota:</strong> Para documentos oficiais diriges-te à secretaria ou envia um pedido pelas Mensagens.
          </div>
        </div>
      </div>
    </div>
  );
}