import React, { useState } from 'react';
import { FileText, Download, Upload, CheckCircle } from 'lucide-react';
import api from '../services/api';
import { fileUrl } from '../services/fileUrl';
import { useNotification } from '../contexts/NotificationContext';
import { useFetch } from '../hooks/useFetch';
import { Card, FormField, Select, Input, Button, Badge, LoadingState, EmptyState, ErrorState } from '../components/ui';
import './Documentos.css';

const TIPOS_DOC = [
  { value: 'declaracao_matricula', label: 'Declaração de Matrícula' },
  { value: 'historico', label: 'Histórico Escolar' },
  { value: 'boletim', label: 'Boletim de Notas' },
  { value: 'outro', label: 'Outro documento' },
];

const STATUS_TONE = {
  pendente: 'yellow',
  aprovado: 'green',
  rejeitado: 'red',
};

const STATUS_LABELS = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
};

export default function Documentos() {
  const [uploading, setUploading] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const [erro, setErro] = useState('');
  const { success, error } = useNotification();
  const [tipo, setTipo] = useState('declaracao_matricula');
  const [ficheiro, setFicheiro] = useState(null);

  const { data, loading: carregando, error: carregarErro, refetch } = useFetch((signal) => api.get('/documentos', { signal }), []);
  const meusDocs = Array.isArray(data) ? data : data?.data || [];

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!ficheiro) {
      setErro('Selecciona um ficheiro primeiro.');
      return;
    }
    setUploading(true);
    setErro('');
    setSucesso('');
    try {
      const fd = new FormData();
      fd.append('arquivo', ficheiro);
      fd.append('tipo', tipo);
      await api.post('/documentos', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSucesso('Documento enviado com sucesso!');
      success('Documento enviado com sucesso!');
      setFicheiro(null);
      e.target.reset();
      refetch();
    } catch (err) {
      const message = err.response?.data?.message || 'Erro ao enviar documento.';
      setErro(message);
      error(message);
    }
    setUploading(false);
  };

  const downloadDocumento = (doc) => {
    window.open(fileUrl(doc.caminho_arquivo), '_blank');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Documentos</h2>
        <p>Envia e consulta os teus documentos escolares</p>
      </div>

      <div className="docs-grid">
        <Card title={<><FileText size={18} color="var(--laranja)" /> Meus documentos</>}>
          {carregando ? (
            <LoadingState />
          ) : carregarErro ? (
            <ErrorState error={carregarErro} onRetry={refetch} />
          ) : meusDocs.length === 0 ? (
            <EmptyState title="Nenhum documento" message="Nenhum documento enviado ainda." />
          ) : (
            <div className="doc-list">
              {meusDocs.map((doc) => (
                <div key={doc.id} className="doc-item">
                  <div className="doc-item-main">
                    <div className={`doc-icon${doc.status === 'aprovado' ? ' doc-icon--aprovado' : ''}`}>
                      <FileText size={18} color={doc.status === 'aprovado' ? 'var(--laranja)' : 'var(--cinza)'} />
                    </div>
                    <div className="doc-info">
                      <div className="doc-nome">{doc.nome_arquivo}</div>
                      <div className="doc-meta">
                        Status: <Badge tone={STATUS_TONE[doc.status] || 'gray'}>{STATUS_LABELS[doc.status] || doc.status}</Badge>
                      </div>
                      {doc.observacao && <div className="doc-obs">{doc.observacao}</div>}
                    </div>
                  </div>
                  <div className="doc-actions">
                    {doc.status === 'aprovado' && (
                      <Button variant="primary" size="sm" icon={<Download size={14} />} onClick={() => downloadDocumento(doc)} title="Descarregar documento" />
                    )}
                    {doc.status === 'pendente' && (
                      <span className="doc-processando">A processar</span>
                    )}
                    {doc.status === 'rejeitado' && (
                      <Badge tone="red">Rejeitado</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={<><Upload size={18} color="var(--laranja)" /> Enviar documento</>}>
          {sucesso && <div className="alert alert-success"><CheckCircle size={14} style={{ marginRight: 6 }} />{sucesso}</div>}
          {erro && <div className="alert alert-error" role="alert">{erro}</div>}

          <form onSubmit={handleUpload} className="doc-upload-form" noValidate>
            <FormField label="Tipo de documento" htmlFor="doc-tipo">
              <Select id="doc-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Ficheiro (PDF, JPG, PNG)" htmlFor="doc-ficheiro">
              <Input id="doc-ficheiro" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFicheiro(e.target.files?.[0])} />
            </FormField>
            <Button type="submit" variant="primary" block loading={uploading} icon={<Upload size={16} />}>
              {uploading ? 'A enviar...' : 'Enviar documento'}
            </Button>
          </form>

          <div className="doc-nota">
            <strong>Nota:</strong> Para documentos oficiais diriges-te à secretaria ou envia um pedido pelas Mensagens.
          </div>
        </Card>
      </div>
    </div>
  );
}
