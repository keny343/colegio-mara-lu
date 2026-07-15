import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Upload, Download, Eye } from 'lucide-react';
import Toast, { useToast } from '../components/Toast';

export default function PlanoCurricular() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isCoordenador = user?.role === 'coordenador' || user?.curso_coordenado || user?.nivel_coordenado;
  const isProfessor = user?.role === 'professor';
  const podePublicar = isAdmin || isCoordenador;

  const [planos, setPlanos] = useState([]);
  const [titulo, setTitulo] = useState('Plano curricular');
  const [arquivo, setArquivo] = useState(null);
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast, showToast, clearToast } = useToast();

  const carregar = () =>
    api.get('/planos-curriculares').then(r => setPlanos(r.data)).catch(() => {});

  useEffect(() => { carregar(); }, []);

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
      carregar();
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao publicar plano.';
      setErro(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} key={toast.key} />}

      <div className="page-header">
        <h2><FileText size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Plano curricular</h2>
        <p style={{ color: 'var(--cinza)' }}>
          {podePublicar
            ? 'Publique o plano para o ciclo ou curso que coordena. Professores e alunos recebem notificação automática.'
            : isProfessor
              ? 'Consulte aqui os planos curriculares enviados pelos coordenadores para as suas turmas.'
              : 'Consulte o plano curricular da sua área.'}
        </p>
      </div>

      {erro && (
        <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{erro}</span>
          <button type="button" className="alert-close" aria-label="Fechar mensagem de erro" onClick={() => setErro('')}>×</button>
        </div>
      )}

      {podePublicar && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1rem', color: 'var(--castanho)' }}>
            Publicar novo plano
          </h3>
          <form onSubmit={enviar}>
            <div className="form-group">
              <label className="form-label">Título</label>
              <input
                className="form-control"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Plano curricular 2024/2025 — 10ª classe"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ficheiro *</label>
              <input
                id="plano-file-input"
                type="file"
                className="form-control"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={e => setArquivo(e.target.files?.[0] || null)}
              />
              <small style={{ color: 'var(--cinza)', fontSize: '0.8rem' }}>PDF, Word ou imagem. Máximo 25 MB.</small>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Upload size={16} /> {saving ? 'A publicar...' : 'Publicar plano'}
            </button>
          </form>
        </div>
      )}

      {/* Vista do professor — destaque para planos recebidos */}
      {isProfessor && !podePublicar && planos.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div className="alert" style={{ background: 'var(--laranja-suave)', border: '1px solid rgba(232,100,26,0.25)', color: 'var(--castanho)', borderRadius: 10 }}>
            📋 Tem <strong>{planos.length}</strong> plano(s) curricular(es) disponível(is) do(s) coordenador(es) das suas turmas.
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1rem 1rem 0.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye size={18} color="var(--castanho)" />
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Planos disponíveis</h3>
          <span style={{ marginLeft: 'auto', background: 'var(--bege-medio)', borderRadius: 20, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--castanho)' }}>
            {planos.length}
          </span>
        </div>
        {planos.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <FileText size={40} style={{ opacity: 0.3 }} />
            <p style={{ color: 'var(--cinza)' }}>
              {isProfessor
                ? 'Nenhum plano curricular disponível. O coordenador ainda não publicou o plano para as suas turmas.'
                : 'Nenhum plano publicado ainda.'}
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Âmbito</th>
                <th>Coordenador</th>
                <th>Data</th>
                <th>Abrir</th>
              </tr>
            </thead>
            <tbody>
              {planos.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={16} color="var(--laranja)" />
                      <strong>{p.titulo}</strong>
                    </div>
                  </td>
                  <td>
                    <span style={{ background: 'var(--bege-medio)', borderRadius: 6, padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600 }}>
                      {p.curso_coordenado || p.nivel_coordenado || 'Geral'}
                    </span>
                  </td>
                  <td>{p.coordenador_nome}</td>
                  <td>{new Date(p.criado_em).toLocaleDateString('pt-AO')}</td>
                  <td>
                    <a
                      className="btn btn-outline btn-sm"
                      href={`/uploads/planos/${p.caminho}`}
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