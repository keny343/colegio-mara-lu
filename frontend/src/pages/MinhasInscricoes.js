import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, FileText, Clock, CheckCircle, XCircle, AlertCircle, Upload } from 'lucide-react';
import api from '../services/api';
import { normalizeSeriesName } from '../utils/serieName';
import { useConfirm } from '../contexts/ConfirmContext';
import { useNotification } from '../contexts/NotificationContext';
import { useFetch } from '../hooks/useFetch';
import { Badge, Button, FormField, Select, Input, Modal, LoadingState, EmptyState, ErrorState } from '../components/ui';
import './MinhasInscricoes.css';

const STATUS_META = {
  pendente: { tone: 'yellow', label: 'Pendente', icon: <Clock size={13} /> },
  em_analise: { tone: 'blue', label: 'Em Análise', icon: <AlertCircle size={13} /> },
  aprovada: { tone: 'green', label: 'Aprovada', icon: <CheckCircle size={13} /> },
  rejeitada: { tone: 'red', label: 'Rejeitada', icon: <XCircle size={13} /> },
  cancelada: { tone: 'gray', label: 'Cancelada', icon: <XCircle size={13} /> },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { tone: 'gray', label: status, icon: null };
  return (
    <Badge tone={meta.tone}>
      <span className="badge-inline">{meta.icon}{meta.label}</span>
    </Badge>
  );
}

export default function MinhasInscricoes() {
  const [inscricoes, setInscricoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erroCarregar, setErroCarregar] = useState(null);
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
    setErroCarregar(null);
    api.get('/inscricoes/minhas')
      .then(r => setInscricoes(r.data))
      .catch(err => setErroCarregar(err))
      .finally(() => setLoading(false));
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
    try {
      await api.post('/documentos', fd);
      setDocModal(null); setDocSerieNome(''); setDocFile(null); setDocTipo('');
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erro ao enviar documento.');
    } finally {
      setUploading(false);
    }
  };

  const classeNumeroDaSerie = (nome) => {
    if (!nome) return null;
    const lower = nome.toLowerCase();
    if (lower.includes('pré') || lower.includes('pre') || lower.includes('maternal') || lower.includes('jardim')) return 0;
    const m = lower.match(/(\d{1,2})\s*[ªº]?\s*(classe|ano)/);
    if (m) return parseInt(m[1], 10);
    const mSerie = lower.match(/(\d{1,2})\s*[ªº]?\s*s[ée]rie/);
    if (mSerie) return 9 + parseInt(mSerie[1], 10);
    return null;
  };

  const exigeBoletim = () => {
    const n = classeNumeroDaSerie(docSerieNome);
    return typeof n === 'number' && n >= 2;
  };

  if (isNova) return <NovaInscricao onSuccess={carregar} />;

  if (loading) return <LoadingState />;

  if (erroCarregar) return <ErrorState error={erroCarregar} onRetry={carregar} />;

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div>
          <h2>Minhas Inscrições</h2>
          <p>Acompanhe o status das suas inscrições</p>
        </div>
        <Link to="/portal/inscricoes/nova" className="btn btn-primary"><Plus size={18} /> Nova Inscrição</Link>
      </div>

      {inscricoes.length === 0 ? (
        <EmptyState
          icon={<FileText size={56} />}
          title="Nenhuma inscrição encontrada"
          message="Faça a primeira inscrição do seu aluno."
          action={<Link to="/portal/inscricoes/nova" className="btn btn-primary btn-sm">+ Nova Inscrição</Link>}
        />
      ) : (
        <div className="insc-list">
          {inscricoes.map(i => (
            <div key={i.id} className="card insc-item">
              <div className="insc-main">
                <div className="insc-nome">{i.aluno_nome}</div>
                <div className="insc-meta">{normalizeSeriesName(i.serie_nome)} — {i.nivel} • {i.ano_letivo}</div>
                <div className="insc-meta">Inscrito em {new Date(i.data_inscricao).toLocaleDateString('pt-BR')}</div>
              </div>
              <div className="insc-status">
                <StatusBadge status={i.status} />
                {i.motivo_rejeicao && (
                  <span className="insc-motivo" title={i.motivo_rejeicao}>
                    ⚠ {i.motivo_rejeicao.slice(0, 50)}{i.motivo_rejeicao.length > 50 ? '...' : ''}
                  </span>
                )}
              </div>
              <div className="insc-actions">
                {['pendente', 'em_analise'].includes(i.status) && (
                  <Button variant="outline" size="sm" icon={<Upload size={14} />} onClick={() => { setDocModal(i.id); setDocSerieNome(i.serie_nome); }}>
                    Documentos
                  </Button>
                )}
                {['pendente', 'em_analise'].includes(i.status) && (
                  <Button variant="danger" size="sm" onClick={() => cancelar(i.id)}>Cancelar</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!docModal}
        onClose={() => setDocModal(null)}
        title="Enviar Documento"
        size="sm"
        footer={
          <Button variant="primary" block loading={uploading} icon={<Upload size={16} />} onClick={enviarDoc}>
            {uploading ? 'Enviando...' : 'Enviar Documento'}
          </Button>
        }
      >
        {!!docSerieNome && (
          <div className="alert alert-info">
            Série: <strong>{docSerieNome}</strong>
          </div>
        )}
        <FormField label="Tipo de Documento" htmlFor="doc-tipo-doc">
          <Select id="doc-tipo-doc" value={docTipo} onChange={(e) => setDocTipo(e.target.value)}>
            <option value="">Selecionar...</option>
            <option value="certidao_nascimento">Certidão de Nascimento</option>
            <option value="rg">Bilhete de Identidade (BI)</option>
            <option value="cpf">NIF</option>
            <option value="comprovante_residencia">Comprovante de Residência</option>
            {exigeBoletim() && <option value="historico_escolar">Certificado / Boletim de Notas</option>}
            <option value="foto">Foto do Aluno</option>
            <option value="outro">Outro</option>
          </Select>
        </FormField>
        <FormField label="Arquivo (PDF, JPG, PNG — máx. 5MB)" htmlFor="doc-file-doc">
          <Input id="doc-file-doc" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocFile(e.target.files?.[0])} />
        </FormField>
      </Modal>
    </div>
  );
}

// ---------- NOVA INSCRIÇÃO ----------
function NovaInscricao({ onSuccess }) {
  const [form, setForm] = useState({ aluno_id: '', serie_id: '', ano_letivo: new Date().getFullYear() + 1 });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const navigate = useNavigate();

  const { data, loading, error, refetch } = useFetch(async () => {
    const [a, s] = await Promise.all([api.get('/alunos'), api.get('/series')]);
    return { alunos: a.data, series: s.data };
  }, []);
  const alunos = data?.alunos || [];
  const series = data?.series || [];

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const classeNumeroDaSerieParaUI = (nome) => {
    if (!nome) return null;
    const lower = nome.toLowerCase();
    if (lower.includes('pré') || lower.includes('pre') || lower.includes('maternal') || lower.includes('jardim')) return 0;
    const m = lower.match(/(\d{1,2})\s*[ªº]?\s*(classe|ano)/);
    if (m) return parseInt(m[1], 10);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.aluno_id || !form.serie_id) return setErro('Selecione o aluno e a série.');
    setSaving(true);
    setErro('');
    try {
      await api.post('/inscricoes', form);
      setSucesso(true);
      onSuccess?.();
      setTimeout(() => navigate('/portal/inscricoes'), 2000);
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao realizar inscrição.');
    } finally {
      setSaving(false);
    }
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

  if (loading) return <LoadingState />;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Nova Inscrição</h2>
        <p>Preencha os dados para realizar a inscrição</p>
      </div>

      <div className="card nova-card">
        {sucesso && <div className="alert alert-success"><CheckCircle size={16} /> Inscrição realizada com sucesso! Redirecionando...</div>}
        {erro && <div className="alert alert-error" role="alert">{erro}</div>}
        {error && <div className="alert alert-error" role="alert">Não foi possível carregar os dados. <button className="alert-close" onClick={refetch}>Tentar novamente</button></div>}

        {alunos.length === 0 ? (
          <EmptyState
            title="Nenhum aluno cadastrado"
            message="Cadastre um aluno primeiro antes de fazer uma inscrição."
            action={<Link to="/portal/alunos/novo" className="btn btn-primary btn-sm">Cadastrar Aluno</Link>}
          />
        ) : (
          <form onSubmit={handleSubmit}>
            <FormField label="Aluno" htmlFor="nova-aluno" required>
              <Select id="nova-aluno" name="aluno_id" value={form.aluno_id} onChange={handleChange} required>
                <option value="">Selecionar aluno...</option>
                {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </Select>
            </FormField>

            <div className="form-row">
              <FormField label="Série / Ano" htmlFor="nova-serie" required>
                <Select id="nova-serie" name="serie_id" value={form.serie_id} onChange={handleChange} required>
                  <option value="">Selecionar série...</option>
                  {niveisOrdenados.map(nivel => {
                    const list = orderedSeries(series.filter(s => s.nivel === nivel));
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
                </Select>
              </FormField>
              <FormField label="Ano Letivo" htmlFor="nova-ano" required>
                <Select id="nova-ano" name="ano_letivo" value={form.ano_letivo} onChange={handleChange}>
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                  <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                </Select>
              </FormField>
            </div>

            <div className="alert alert-info">
              📋 Após a inscrição, você poderá enviar os documentos necessários (certidão de nascimento, BI, histórico escolar, etc.)
            </div>

            <div className="nova-actions">
              <Button variant="outline" onClick={() => navigate('/portal/inscricoes')}>Cancelar</Button>
              <Button type="submit" variant="primary" block loading={saving}>
                {saving ? 'Enviando...' : 'Realizar Inscrição'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
