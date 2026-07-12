import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, FileText, Clock, CheckCircle, XCircle, AlertCircle, Upload, X } from 'lucide-react';
import api from '../services/api';
import { normalizeSeriesName } from '../utils/serieName';
import { useConfirm } from '../contexts/ConfirmContext';
import { useNotification } from '../contexts/NotificationContext';

function StatusBadge({ status }) {
  const map = {
    pendente: { label: 'Pendente', cls: 'badge-pendente', icon: <Clock size={13} /> },
    em_analise: { label: 'Em Análise', cls: 'badge-em_analise', icon: <AlertCircle size={13} /> },
    aprovada: { label: 'Aprovada', cls: 'badge-aprovada', icon: <CheckCircle size={13} /> },
    rejeitada: { label: 'Rejeitada', cls: 'badge-rejeitada', icon: <XCircle size={13} /> },
    cancelada: { label: 'Cancelada', cls: 'badge-cancelada', icon: <XCircle size={13} /> },
  };
  const s = map[status] || { label: status, cls: '', icon: null };
  return <span className={`badge ${s.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{s.icon} {s.label}</span>;
}

export default function MinhasInscricoes() {
  const [inscricoes, setInscricoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docModal, setDocModal] = useState(null);
  const [docSerieNome, setDocSerieNome] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [docTipo, setDocTipo] = useState('');
  const [uploading, setUploading] = useState(false);
  const location = useLocation();
  const isNova = location.pathname.includes('/nova');
  const confirm = useConfirm();
  const { error: notifyError } = useNotification();

  const carregar = () => {
    api.get('/inscricoes/minhas').then(r => setInscricoes(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { carregar(); }, []);

  const cancelar = async (id) => {
    const ok = await confirm({
      title: 'Cancelar inscrição',
      message: 'Tem a certeza que deseja cancelar esta inscrição? Esta acção não pode ser desfeita.',
      confirmLabel: 'Sim, cancelar',
      cancelLabel: 'Manter inscrição',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.patch(`/inscricoes/${id}/cancelar`);
      carregar();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erro ao cancelar inscrição.');
    }
  };

  const enviarDoc = async () => {
    if (!docFile || !docTipo) {
      notifyError('Seleccione o tipo e o ficheiro.');
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append('arquivo', docFile);
    fd.append('inscricao_id', docModal);
    fd.append('tipo', docTipo);
    await api.post('/documentos', fd).catch(() => {});
    setUploading(false); setDocModal(null); setDocSerieNome(''); setDocFile(null); setDocTipo('');
  };

  const classeNumeroDaSerie = (nome) => {
    if (!nome) return null;
    const lower = nome.toLowerCase();
    if (lower.includes('pré') || lower.includes('pre') || lower.includes('maternal') || lower.includes('jardim')) return 0;
    const m = lower.match(/(\d{1,2})\s*[ªº]?\s*(classe|ano)/);
    if (m) return parseInt(m[1], 10);
    // Suporte para nomes antigos do banco: "1ª Série", "2ª Série", "3ª Série"
    // Mapeamento: 1ª Série -> 10ª, 2ª Série -> 11ª, 3ª Série -> 12ª.
    const mSerie = lower.match(/(\d{1,2})\s*[ªº]?\s*s[ée]rie/);
    if (mSerie) return 9 + parseInt(mSerie[1], 10);
    return null;
  };

  const exigeBoletim = () => {
    const n = classeNumeroDaSerie(docSerieNome);
    // Só a partir da 2ª classe precisa de certificado/boletim
    return typeof n === 'number' && n >= 2;
  };

  if (isNova) return <NovaInscricao onSuccess={carregar} />;

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Minhas Inscrições</h2>
          <p style={{ color: 'var(--cinza)' }}>Acompanhe o status das suas inscrições</p>
        </div>
        <Link to="/portal/inscricoes/nova" className="btn btn-primary"><Plus size={18} /> Nova Inscrição</Link>
      </div>

      {inscricoes.length === 0 ? (
        <div className="card empty-state">
          <FileText size={56} />
          <h3>Nenhuma inscrição encontrada</h3>
          <p>Faça a primeira inscrição do seu aluno.</p>
          <Link to="/portal/inscricoes/nova" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>+ Nova Inscrição</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {inscricoes.map(i => (
            <div key={i.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700, color: 'var(--castanho)', fontSize: '1.05rem' }}>{i.aluno_nome}</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--cinza)', marginTop: 4 }}>
                  {normalizeSeriesName(i.serie_nome)} — {i.nivel} • {i.ano_letivo}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--cinza)', marginTop: 2 }}>
                  Inscrito em {new Date(i.data_inscricao).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <StatusBadge status={i.status} />
                {i.motivo_rejeicao && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--vermelho)', maxWidth: 200 }} title={i.motivo_rejeicao}>
                    ⚠ {i.motivo_rejeicao.slice(0, 50)}{i.motivo_rejeicao.length > 50 ? '...' : ''}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['pendente', 'em_analise'].includes(i.status) && (
                  <button className="btn btn-sm btn-outline" onClick={() => { setDocModal(i.id); setDocSerieNome(i.serie_nome); }}>
                    <Upload size={14} /> Documentos
                  </button>
                )}
                {['pendente', 'em_analise'].includes(i.status) && (
                  <button className="btn btn-sm btn-danger" onClick={() => cancelar(i.id)}>Cancelar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Upload Documento */}
      {docModal && (
        <div className="modal-overlay" onClick={() => setDocModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Enviar Documento</h3>
              <button className="modal-close" onClick={() => setDocModal(null)}><X size={18} /></button>
            </div>
            {!!docSerieNome && (
              <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                Série: <strong>{docSerieNome}</strong>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Tipo de Documento</label>
              <select className="form-control form-select" value={docTipo} onChange={e => setDocTipo(e.target.value)}>
                <option value="">Selecionar...</option>
                <option value="certidao_nascimento">Certidão de Nascimento</option>
                <option value="rg">Bilhete de Identidade (BI)</option>
                <option value="cpf">NIF</option>
                <option value="comprovante_residencia">Comprovante de Residência</option>
                {exigeBoletim() && <option value="historico_escolar">Certificado / Boletim de Notas</option>}
                <option value="foto">Foto do Aluno</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Arquivo (PDF, JPG, PNG — máx. 5MB)</label>
              <input type="file" className="form-control" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setDocFile(e.target.files[0])} />
            </div>
            <button className="btn btn-primary btn-full" onClick={enviarDoc} disabled={uploading}>
              {uploading ? 'Enviando...' : <><Upload size={16} /> Enviar Documento</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- NOVA INSCRIÇÃO ----------
function NovaInscricao({ onSuccess }) {
  const [alunos, setAlunos] = useState([]);
  const [series, setSeries] = useState([]);
  const [form, setForm] = useState({ aluno_id: '', serie_id: '', ano_letivo: new Date().getFullYear() + 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get('/alunos'), api.get('/series')])
      .then(([a, s]) => { setAlunos(a.data); setSeries(s.data); })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const classeNumeroDaSerieParaUI = (nome) => {
    if (!nome) return null;
    const lower = nome.toLowerCase();
    if (lower.includes('pré') || lower.includes('pre') || lower.includes('maternal') || lower.includes('jardim')) return 0;
    const m = lower.match(/(\d{1,2})\s*[ªº]?\s*(classe|ano)/);
    if (m) return parseInt(m[1], 10);

    // Suporte para nomes antigos do banco: "1ª Série", "2ª Série", "3ª Série"
    const mSerie = lower.match(/(\d{1,2})\s*[ªº]?\s*s[ée]rie/);
    if (mSerie) return 9 + parseInt(mSerie[1], 10);

    return null;
  };

  const formatSerieLabel = (s) => {
    const n = classeNumeroDaSerieParaUI(s.nome);
    if (n === 0) return 'Pré-escolar';
    if (typeof n !== 'number') return s.nome || 'Classe';
    if (s.curso) return `${n}ª Classe (${s.curso})`;
    return `${n}ª Classe`;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.aluno_id || !form.serie_id) return setErro('Selecione o aluno e a série.');
    setSaving(true); setErro('');
    try {
      await api.post('/inscricoes', form);
      setSucesso(true);
      onSuccess?.();
      setTimeout(() => navigate('/portal/inscricoes'), 2000);
    } catch (err) { setErro(err.response?.data?.message || 'Erro ao realizar inscrição.'); }
    finally { setSaving(false); }
  };

  const niveisSeries = [...new Set(series.map(s => s.nivel))];
  const niveisOrdenados = [...niveisSeries].sort((a, b) => {
    const minOrdemA = Math.min(...series.filter(s => s.nivel === a).map(s => (typeof s.ordem === 'number' ? s.ordem : 999)));
    const minOrdemB = Math.min(...series.filter(s => s.nivel === b).map(s => (typeof s.ordem === 'number' ? s.ordem : 999)));
    return minOrdemA - minOrdemB;
  });

  const orderedSeries = (arr) => {
    return [...arr].sort((x, y) => {
      const ox = typeof x.ordem === 'number' ? x.ordem : 999;
      const oy = typeof y.ordem === 'number' ? y.ordem : 999;
      if (ox !== oy) return ox - oy;
      return String(x.nome || '').localeCompare(String(y.nome || ''), 'pt-BR');
    });
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Nova Inscrição</h2>
        <p style={{ color: 'var(--cinza)' }}>Preencha os dados para realizar a inscrição</p>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        {sucesso && <div className="alert alert-success"><CheckCircle size={16} /> Inscrição realizada com sucesso! Redirecionando...</div>}
        {erro && <div className="alert alert-error">{erro}</div>}

        {alunos.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhum aluno cadastrado</h3>
            <p>Cadastre um aluno primeiro antes de fazer uma inscrição.</p>
            <Link to="/portal/alunos/novo" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>Cadastrar Aluno</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Aluno *</label>
              <select name="aluno_id" className="form-control form-select" value={form.aluno_id} onChange={handleChange} required>
                <option value="">Selecionar aluno...</option>
                {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Série / Ano *</label>
                <select name="serie_id" className="form-control form-select" value={form.serie_id} onChange={handleChange} required>
                  <option value="">Selecionar série...</option>
                  {niveisOrdenados.map(nivel => {
                    const list = orderedSeries(series.filter(s => s.nivel === nivel));

                    // II Ciclo: separar por curso quando existir
                    if (nivel && String(nivel).includes('II Ciclo')) {
                      const cursos = [...new Set(list.map(s => s.curso || 'Geral'))];
                      return cursos.map(curso => {
                        const sub = orderedSeries(list.filter(s => (s.curso || 'Geral') === curso));
                        const label = curso && curso !== 'Geral' ? `${nivel} - ${curso}` : `${nivel}`;
                        return (
                          <optgroup key={`${nivel}|${curso}`} label={label}>
                            {sub.map(s => (
                              <option key={s.id} value={s.id} disabled={s.vagas_disponiveis <= 0}>
                                {formatSerieLabel(s)} {s.vagas_disponiveis <= 0 ? '(Sem vagas)' : `(${s.vagas_disponiveis} vagas)`}
                              </option>
                            ))}
                          </optgroup>
                        );
                      });
                    }

                    return (
                      <optgroup key={nivel} label={nivel}>
                        {list.map(s => (
                          <option key={s.id} value={s.id} disabled={s.vagas_disponiveis <= 0}>
                            {formatSerieLabel(s)} {s.vagas_disponiveis <= 0 ? '(Sem vagas)' : `(${s.vagas_disponiveis} vagas)`}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ano Letivo *</label>
                <select name="ano_letivo" className="form-control form-select" value={form.ano_letivo} onChange={handleChange}>
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                  <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                </select>
              </div>
            </div>

            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
              📋 Após a inscrição, você poderá enviar os documentos necessários (certidão de nascimento, BI, histórico escolar, etc.)
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn btn-outline" onClick={() => navigate('/portal/inscricoes')}>Cancelar</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                {saving ? 'Enviando...' : 'Realizar Inscrição'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
