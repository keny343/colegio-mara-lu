import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { normalizeSeriesName } from '../utils/serieName';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Save, Pencil, Trash2, User } from 'lucide-react';
import Toast, { useToast } from '../components/Toast';
import { useConfirm } from '../contexts/ConfirmContext';

function TabButton({ active, onClick, children }) {
  return (
    <button
      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}`}
      onClick={onClick}
      type="button"
      style={{ borderRadius: 999 }}
    >
      {children}
    </button>
  );
}

export default function AdminAcademico() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState(isAdmin ? 'cursos' : 'disciplinas');

  // data
  const [cursos, setCursos] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [series, setSeries] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal generic for create
  const [modal, setModal] = useState(null); // {type: 'curso'|'disciplina'|'turma'}
  const [erro, setErro] = useState('');
  const { toast, showToast, clearToast } = useToast();
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const [cursoEditId, setCursoEditId] = useState(null);

  const [cursoForm, setCursoForm] = useState({ nome: '', descricao: '' });
  const [discForm, setDiscForm] = useState({ nome: '', curso_id: '', serie_min: '', serie_max: '', disciplina_chave: false });
  const [turmaForm, setTurmaForm] = useState({ nome: '', ano_letivo: new Date().getFullYear() + 1, serie_classe: '', curso_id: '', turno: 'manhã' });
  const [turmaEditId, setTurmaEditId] = useState(null);
  const [turmaEditForm, setTurmaEditForm] = useState({ nome: '', turno: 'manhã' });
  const [turmaEditModal, setTurmaEditModal] = useState(false);
  const [turmaEditSaving, setTurmaEditSaving] = useState(false);

  const [atrib, setAtrib] = useState({ turma_id: '', disciplina_id: '', professor_id: '' });
  const [horarios, setHorarios] = useState([]);
  const [alunosModal, setAlunosModal] = useState({ turma: null, alunos: [] });
  const [matriculaModal, setMatriculaModal] = useState(null);
  const [alunosParaMatricula, setAlunosParaMatricula] = useState([]);
  const [matriculaAlunoId, setMatriculaAlunoId] = useState('');
  const [configAvaliacao, setConfigAvaliacao] = useState([]);
  const [configForm, setConfigForm] = useState({});
  const [savingConfig, setSavingConfig] = useState({});
  const [horarioForm, setHorarioForm] = useState({ turma_id: '', disciplina_id: '', dia_semana: 'segunda', hora_inicio: '07:30', hora_fim: '08:30', sala: '' });
  const normalizarNome = (nome) =>
    String(nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const professores = useMemo(() => {
    return (usuarios || []).filter(u => ['professor'].includes(u.role));
  }, [usuarios]);

  const cursosUnicos = useMemo(() => {
    const map = new Map();
    for (const c of cursos || []) {
      const key = normalizarNome(c.nome);
      if (!key) continue;
      if (!map.has(key)) map.set(key, c);
    }
    return [...map.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt'));
  }, [cursos]);

  const classeNumero = (nome) => {
    if (!nome) return null;
    const lower = String(nome).toLowerCase();
    if (lower.includes('pré') || lower.includes('maternal') || lower.includes('jardim')) return 0;
    const mClasse = lower.match(/(\d{1,2})\s*[ªº]?\s*classe/);
    if (mClasse) return Number(mClasse[1]);
    const mAno = lower.match(/(\d{1,2})\s*[ªº]?\s*ano/);
    if (mAno) return Number(mAno[1]);
    const mSerie = lower.match(/(\d{1,2})\s*[ªº]?\s*s[ée]rie/);
    if (mSerie) return 9 + Number(mSerie[1]);
    return null;
  };

  const CLASSES_PADRAO = useMemo(() => ([
    { value: 0, label: 'Pré-escolar / Jardim' },
    ...Array.from({ length: 13 }, (_, i) => ({ value: i + 1, label: `${i + 1}ª classe` })),
  ]), []);

const classesOptions = CLASSES_PADRAO;

  const classeSelecionada = Number(turmaForm.serie_classe || 0);
  const cursoObrigatorio = classeSelecionada >= 10;
  const cursosDisponiveis = useMemo(() => {
    if (classeSelecionada === 13) {
      return cursosUnicos.filter(c => normalizarNome(c.nome).includes('inform'));
    }
    if (classeSelecionada >= 10 && classeSelecionada <= 12) return cursosUnicos;
    return [];
  }, [classeSelecionada, cursosUnicos]);

  const abrirEditTurma = (t) => {
    setTurmaEditId(t.id);
    setTurmaEditForm({ nome: t.nome, turno: t.turno, ano_letivo: t.ano_letivo, serie_classe: t.serie_classe, curso_id: t.curso_id || '' });
    setTurmaEditModal(true);
    setErro('');
  };

  const salvarEditTurma = async () => {
    if (!turmaEditForm.nome) { setErro('Nome da turma é obrigatório.'); return; }
    setTurmaEditSaving(true);
    setErro('');
    try {
      await api.put(`/staff/turmas/${turmaEditId}`, turmaEditForm);
      setTurmaEditModal(false);
      setTurmaEditId(null);
      await loadAll();
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao editar turma.');
    } finally {
      setTurmaEditSaving(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      api.get('/staff/cursos'),
      api.get('/staff/disciplinas'),
      api.get('/staff/turmas'),
      api.get('/series'),
      api.get('/staff/usuarios'),
      api.get('/staff/horarios'),
      api.get('/staff/config-avaliacao'),
    ]);
    const labels = ['cursos', 'disciplinas', 'turmas', 'séries', 'utilizadores', 'horários', 'configuração de avaliação'];
    const errors = [];
    const [c, d, t, s, u, h, ca] = results;
    if (c.status === 'fulfilled') setCursos(c.value.data); else errors.push(labels[0]);
    if (d.status === 'fulfilled') setDisciplinas(d.value.data); else errors.push(labels[1]);
    if (t.status === 'fulfilled') setTurmas(t.value.data); else errors.push(labels[2]);
    if (s.status === 'fulfilled') setSeries(s.value.data); else errors.push(labels[3]);
    if (u.status === 'fulfilled') setUsuarios(u.value.data); else errors.push(labels[4]);
    if (h.status === 'fulfilled') setHorarios(h.value.data); else errors.push(labels[5]);
    if (ca.status === 'fulfilled') setConfigAvaliacao(ca.value.data); else errors.push(labels[6]);
    setErro(errors.length > 0
      ? `Erro ao carregar: ${errors.join(', ')}. ${results.find(r => r.status === 'rejected')?.reason?.response?.data?.message || ''}`.trim()
      : '');
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const abrirModal = (type, data = null) => {
    setErro('');
    setModal({ type });
    if (type === 'curso') {
      setCursoEditId(data?.id || null);
      setCursoForm({ nome: data?.nome || '', descricao: data?.descricao || '' });
    }
    if (type === 'disciplina') setDiscForm({ nome: '', curso_id: '', serie_min: '', serie_max: '', disciplina_chave: false });
    if (type === 'turma') setTurmaForm({ nome: '', ano_letivo: new Date().getFullYear() + 1, serie_classe: '', curso_id: '', turno: 'manhã' });
  };

  const fecharModal = () => {
    setModal(null);
    setCursoEditId(null);
  };

  const salvarModal = async (e) => {
    e?.preventDefault?.();
    setErro('');
    setSaving(true);
    try {
      if (modal?.type === 'curso') {
        if (!cursoForm.nome) return setErro('Nome do curso é obrigatório.');
        if (cursoEditId) {
          await api.put(`/staff/cursos/${cursoEditId}`, cursoForm);
        } else {
          await api.post('/staff/cursos', cursoForm);
        }
      }
      if (modal?.type === 'disciplina') {
        if (!discForm.nome) return setErro('Nome da disciplina é obrigatório.');
        await api.post('/staff/disciplinas', {
          ...discForm,
          curso_id: discForm.curso_id || null,
          serie_min: discForm.serie_min ? Number(discForm.serie_min) : null,
          serie_max: discForm.serie_max ? Number(discForm.serie_max) : null,
          disciplina_chave: !!discForm.disciplina_chave,
        });
      }
      if (modal?.type === 'turma') {
        if (!isAdmin) return setErro('Apenas o administrador pode criar turmas.');
        if (!turmaForm.nome) return setErro('Nome da turma é obrigatório.');
        if (!turmaForm.serie_classe) return setErro('Selecione a classe.');
        if (Number(turmaForm.serie_classe) >= 10 && !turmaForm.curso_id) {
          return setErro('Da 10ª à 13ª classe, selecione um curso.');
        }
        await api.post('/staff/turmas', {
          ...turmaForm,
          serie_classe: Number(turmaForm.serie_classe),
          curso_id: Number(turmaForm.serie_classe) >= 10 ? (turmaForm.curso_id || null) : null,
        });
      }
      const tipoLabel = modal?.type === 'curso' ? (cursoEditId ? 'Curso actualizado' : 'Curso criado') : modal?.type === 'disciplina' ? 'Disciplina criada' : 'Turma criada';
      showToast(`${tipoLabel} com sucesso!`, 'success');
      fecharModal();
      await loadAll();
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao salvar.';
      setErro(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const apagarCurso = async (curso) => {
    const ok = await confirm({
      title: 'Apagar curso',
      message: `Deseja apagar o curso "${curso.nome}"? Esta acção é irreversível.`,
      confirmLabel: 'Apagar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    setErro('');
    setSaving(true);
    try {
      await api.delete(`/staff/cursos/${curso.id}`);
      await loadAll();
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao apagar curso.');
    } finally {
      setSaving(false);
    }
  };

  const salvarAtribuicao = async () => {
    setErro('');
    setSaving(true);
    try {
      if (!atrib.turma_id || !atrib.disciplina_id || !atrib.professor_id) {
        setErro('Selecione turma, disciplina e professor.');
        return;
      }
      await api.post('/staff/atribuir-professor', {
        turma_id: Number(atrib.turma_id),
        disciplina_id: Number(atrib.disciplina_id),
        professor_id: Number(atrib.professor_id),
      });
      setAtrib({ turma_id: '', disciplina_id: '', professor_id: '' });
      showToast('Professor atribuído com sucesso! O professor recebeu uma notificação.', 'success');
      await loadAll();
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao atribuir.';
      setErro(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const salvarHorario = async () => {
    setErro('');
    setSaving(true);
    try {
      if (!horarioForm.turma_id || !horarioForm.disciplina_id || !horarioForm.dia_semana || !horarioForm.hora_inicio || !horarioForm.hora_fim) {
        setErro('Selecione turma, disciplina, dia e horas.');
        return;
      }
      await api.post('/staff/horarios', {
        ...horarioForm,
        turma_id: Number(horarioForm.turma_id),
        disciplina_id: Number(horarioForm.disciplina_id),
      });
      setHorarioForm({ turma_id: '', disciplina_id: '', dia_semana: 'segunda', hora_inicio: '07:30', hora_fim: '08:30', sala: '' });
      showToast('Horário criado com sucesso!', 'success');
      await loadAll();
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao salvar horário.';
      setErro(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const apagarHorario = async (horario) => {
    const ok = await confirm({
      title: 'Remover horário',
      message: `Remover horário de ${horario.disciplina_nome} para ${horario.turma_nome}?`,
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    setErro('');
    setSaving(true);
    try {
      await api.delete(`/staff/horarios/${horario.id}`);
      await loadAll();
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao remover horário.');
    } finally {
      setSaving(false);
    }
  };

  const abrirAlunosTurma = async (turma) => {
    setErro('');
    setAlunosModal({ turma: turma, alunos: [] });
    try {
      const res = await api.get(`/staff/turmas/${turma.id}/alunos`);
      setAlunosModal({ turma, alunos: res.data });
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao carregar alunos da turma.');
      setAlunosModal({ turma, alunos: [] });
    }
  };

  const fecharAlunosModal = () => {
    setAlunosModal({ turma: null, alunos: [] });
  };

  const abrirMatriculaModal = async (turma) => {
    setMatriculaModal(turma);
    setMatriculaAlunoId('');
    setErro('');
    try {
      const res = await api.get('/staff/alunos-para-matricula', { params: { ano_letivo: turma.ano_letivo } });
      setAlunosParaMatricula(res.data);
    } catch (err) {
      setAlunosParaMatricula([]);
      setErro(err.response?.data?.message || 'Erro ao carregar alunos para matrícula.');
    }
  };

  const fecharMatriculaModal = () => {
    setMatriculaModal(null);
    setAlunosParaMatricula([]);
    setMatriculaAlunoId('');
  };

  const salvarMatricula = async () => {
    if (!matriculaAlunoId || !matriculaModal) {
      setErro('Selecione um aluno.');
      return;
    }
    setSaving(true);
    setErro('');
    try {
      await api.post('/staff/matriculas', {
        aluno_id: Number(matriculaAlunoId),
        turma_id: matriculaModal.id,
        ano_letivo: matriculaModal.ano_letivo,
      });
      showToast('Aluno matriculado com sucesso!', 'success');
      fecharMatriculaModal();
      await loadAll();
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao matricular aluno.';
      setErro(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} key={toast.key} />}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>Académico</h2>
          <p style={{ color: 'var(--cinza)' }}>Cursos, disciplinas, turmas e atribuição de professores</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isAdmin && <TabButton active={tab === 'cursos'} onClick={() => setTab('cursos')}>Cursos</TabButton>}
          <TabButton active={tab === 'disciplinas'} onClick={() => setTab('disciplinas')}>Disciplinas</TabButton>
          <TabButton active={tab === 'turmas'} onClick={() => setTab('turmas')}>Turmas</TabButton>
          <TabButton active={tab === 'horarios'} onClick={() => setTab('horarios')}>Horários</TabButton>
          <TabButton active={tab === 'atribuir'} onClick={() => setTab('atribuir')}>Atribuir Professor</TabButton>
          {isAdmin && <TabButton active={tab === 'classes'} onClick={() => setTab('classes')}>Classes</TabButton>}
        </div>
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}

      {isAdmin && tab === 'cursos' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.25rem 0' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Cursos</h3>
            <button className="btn btn-primary btn-sm" onClick={() => abrirModal('curso')}>
              <Plus size={16} /> Novo curso
            </button>
          </div>
          <div className="table-container" style={{ marginTop: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descrição</th>
                  <th style={{ width: 190 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {cursos.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.nome}</strong></td>
                    <td style={{ color: 'var(--cinza)' }}>{c.descricao || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => abrirModal('curso', c)}>
                          <Pencil size={14} /> Editar
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => apagarCurso(c)} disabled={saving}>
                          <Trash2 size={14} /> Apagar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'disciplinas' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.25rem 0' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Disciplinas</h3>
            <button className="btn btn-primary btn-sm" onClick={() => abrirModal('disciplina')}>
              <Plus size={16} /> Nova disciplina
            </button>
          </div>
          <div className="table-container" style={{ marginTop: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Disciplina</th>
                  <th>Curso</th>
                  <th>Classe</th>
                  <th style={{ textAlign: 'center' }}>Chave</th>
                </tr>
              </thead>
              <tbody>
                {disciplinas.map(d => (
                  <tr key={d.id}>
                    <td><strong>{d.nome}</strong></td>
                    <td>{d.curso_nome || 'Geral'}</td>
                    <td style={{ color: 'var(--cinza)' }}>
                      {d.serie_min || '—'} até {d.serie_max || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={async () => {
                          try {
                            await api.put(`/staff/disciplinas/${d.id}`, { disciplina_chave: !d.disciplina_chave });
                            showToast(!d.disciplina_chave ? 'Marcada como disciplina chave.' : 'Deixou de ser disciplina chave.', 'success');
                            await loadAll();
                          } catch (err) {
                            showToast(err.response?.data?.message || 'Erro ao actualizar.', 'error');
                          }
                        }}
                        style={{
                          background: d.disciplina_chave ? '#fef3c7' : 'var(--bege-claro)',
                          color: d.disciplina_chave ? '#92400e' : 'var(--cinza)',
                          border: 'none', borderRadius: 20, padding: '3px 12px',
                          fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                        }}
                        title="Clica para alternar"
                      >
                        {d.disciplina_chave ? '★ Chave' : 'Não'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'turmas' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.25rem 0' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Turmas</h3>
            {isAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => abrirModal('turma')}>
                <Plus size={16} /> Nova turma
              </button>
            )}
          </div>
          <div className="table-container" style={{ marginTop: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Turma</th>
                  <th>Ano</th>
                  <th>Classe</th>
                  <th>Curso</th>
                  <th>Turno</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {turmas.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.nome}</strong></td>
                    <td>{t.ano_letivo}</td>
                    <td>{t.serie_classe}ª</td>
                    <td>{t.curso_nome || '—'}</td>
                    <td>{t.turno}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => abrirAlunosTurma(t)}>
                          Ver alunos
                        </button>
                        {isAdmin && (
                          <button type="button" className="btn btn-sm btn-outline" onClick={() => abrirEditTurma(t)} title="Editar turma">
                            <Pencil size={13} />
                          </button>
                        )}
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => abrirMatriculaModal(t)}>
                          Matricular
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'horarios' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.25rem 0' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Horários</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setTab('horarios')}>
              <Plus size={16} /> Novo horário
            </button>
          </div>
          <div className="card" style={{ margin: '1rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>Criar horário</h4>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Turma</label>
                <select className="form-control form-select" value={horarioForm.turma_id} onChange={e => setHorarioForm({ ...horarioForm, turma_id: e.target.value })}>
                  <option value="">Selecionar...</option>
{turmas.map(t => <option key={t.id} value={t.id}>{t.nome} — {t.serie_classe}ª{t.curso_nome ? ` · ${t.curso_nome}` : ''} ({t.ano_letivo})</option>)}                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Disciplina</label>
                <select className="form-control form-select" value={horarioForm.disciplina_id} onChange={e => setHorarioForm({ ...horarioForm, disciplina_id: e.target.value })}>
                  <option value="">Selecionar...</option>
                  {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Dia da semana</label>
                <select className="form-control form-select" value={horarioForm.dia_semana} onChange={e => setHorarioForm({ ...horarioForm, dia_semana: e.target.value })}>
                  <option value="segunda">Segunda</option>
                  <option value="terca">Terça</option>
                  <option value="quarta">Quarta</option>
                  <option value="quinta">Quinta</option>
                  <option value="sexta">Sexta</option>
                  <option value="sabado">Sábado</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Hora início</label>
                <input type="time" className="form-control" value={horarioForm.hora_inicio} onChange={e => setHorarioForm({ ...horarioForm, hora_inicio: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Hora fim</label>
                <input type="time" className="form-control" value={horarioForm.hora_fim} onChange={e => setHorarioForm({ ...horarioForm, hora_fim: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Sala</label>
              <input className="form-control" value={horarioForm.sala} onChange={e => setHorarioForm({ ...horarioForm, sala: e.target.value })} placeholder="Opcional" />
            </div>
            <button className="btn btn-primary" onClick={salvarHorario} disabled={saving}>
              {saving ? 'Salvando...' : <><Save size={16} /> Salvar horário</>}
            </button>
          </div>

          <div className="table-container" style={{ margin: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Horário</th>
                  <th>Turma</th>
                  <th>Disciplina</th>
                  <th>Sala</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {horarios.map(h => (
                  <tr key={h.id}>
                    <td>{h.dia_semana}</td>
                    <td>{h.hora_inicio} — {h.hora_fim}</td>
                    <td>{h.turma_nome} — {h.serie_classe}ª</td>
                    <td>{h.disciplina_nome}</td>
                    <td>{h.sala || '—'}</td>
                    <td>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => apagarHorario(h)} disabled={saving}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'atribuir' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Atribuir professor</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Turma</label>
              <select className="form-control form-select" value={atrib.turma_id} onChange={e => setAtrib({ ...atrib, turma_id: e.target.value })}>
                <option value="">Selecionar...</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome} — {t.serie_classe}ª ({t.ano_letivo})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Disciplina</label>
              <select className="form-control form-select" value={atrib.disciplina_id} onChange={e => setAtrib({ ...atrib, disciplina_id: e.target.value })}>
                <option value="">Selecionar...</option>
                {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}{d.curso_nome ? ` — ${d.curso_nome}` : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Professor</label>
              <select className="form-control form-select" value={atrib.professor_id} onChange={e => setAtrib({ ...atrib, professor_id: e.target.value })}>
                <option value="">Selecionar...</option>
                {professores.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.email})</option>)}
              </select>
              {professores.length === 0 && (
                <div style={{ fontSize: '0.85rem', color: 'var(--cinza)', marginTop: 6 }}>
                  Ainda não existem usuários do tipo <strong>professor</strong>. Vamos adicionar isso no “Usuários”.
                </div>
              )}
            </div>
          </div>
          <button className="btn btn-primary" onClick={salvarAtribuicao} disabled={saving}>
            {saving ? 'Salvando...' : <><Save size={16} /> Atribuir</>}
          </button>
        </div>
      )}

      {tab === 'classes' && (
        <div className="card">
          <h3 style={{ marginBottom: '0.25rem', fontSize: '1.1rem' }}>Exame Nacional / Defesa Final por classe</h3>
          <p style={{ color: 'var(--cinza)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            A configuração aplica-se a todas as turmas da classe (+curso, se aplicável) automaticamente — não é por turma individual.
            Uma classe nunca pode ter as duas opções activas ao mesmo tempo.
          </p>

          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group">
              <label className="form-label">Classe *</label>
              <select
                className="form-control form-select"
                value={configForm.serie_classe || ''}
                onChange={e => setConfigForm({ ...configForm, serie_classe: e.target.value, curso_id: '' })}
              >
                <option value="">Selecionar...</option>
                {Array.from({ length: 13 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}ª classe</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Curso (opcional — vazio = toda a classe)</label>
              <select
                className="form-control form-select"
                value={configForm.curso_id || ''}
                onChange={e => setConfigForm({ ...configForm, curso_id: e.target.value })}
              >
                <option value="">Toda a classe (sem curso específico)</option>
                {cursosUnicos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!configForm.exame_nacional}
                  onChange={e => setConfigForm({ ...configForm, exame_nacional: e.target.checked, defesa_final: e.target.checked ? false : configForm.defesa_final })}
                />
                Realiza Exame Nacional (7ª prova)
              </label>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!configForm.defesa_final}
                  onChange={e => setConfigForm({ ...configForm, defesa_final: e.target.checked, exame_nacional: e.target.checked ? false : configForm.exame_nacional })}
                />
                Realiza Defesa Final
              </label>
            </div>
          </div>
          <button
            className="btn btn-primary"
            disabled={!configForm.serie_classe || saving}
            onClick={async () => {
              setErro('');
              setSaving(true);
              try {
                await api.put('/staff/config-avaliacao', {
                  serie_classe: Number(configForm.serie_classe),
                  curso_id: configForm.curso_id ? Number(configForm.curso_id) : null,
                  exame_nacional: !!configForm.exame_nacional,
                  defesa_final: !!configForm.defesa_final,
                });
                showToast('Configuração guardada. Aplicada a todas as turmas desta classe/curso.', 'success');
                setConfigForm({});
                await loadAll();
              } catch (err) {
                const msg = err.response?.data?.message || 'Erro ao guardar configuração.';
                setErro(msg);
                showToast(msg, 'error');
              } finally {
                setSaving(false);
              }
            }}
          >
            <Save size={16} /> Guardar configuração
          </button>

          <div className="table-container" style={{ marginTop: '1.5rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Classe</th>
                  <th>Curso</th>
                  <th style={{ textAlign: 'center' }}>Exame Nacional</th>
                  <th style={{ textAlign: 'center' }}>Defesa Final</th>
                </tr>
              </thead>
              <tbody>
                {configAvaliacao.length === 0 ? (
                  <tr><td colSpan={4} style={{ color: 'var(--cinza)' }}>Nenhuma classe configurada ainda — por omissão, nenhuma classe usa exame nacional nem defesa final.</td></tr>
                ) : configAvaliacao.map(cfg => (
                  <tr key={cfg.id}>
                    <td><strong>{cfg.serie_classe}ª classe</strong></td>
                    <td>{cfg.curso_nome || 'Toda a classe'}</td>
                    <td style={{ textAlign: 'center' }}>{cfg.exame_nacional ? '✓' : '—'}</td>
                    <td style={{ textAlign: 'center' }}>{cfg.defesa_final ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {matriculaModal && (
        <div className="modal-overlay" onClick={fecharMatriculaModal}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Matricular aluno — {matriculaModal.nome}</h3>
              <button className="modal-close" onClick={fecharMatriculaModal}><X size={18} /></button>
            </div>
            <p style={{ color: 'var(--cinza)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Aluno com inscrição <strong>aprovada</strong> ainda sem turma ({matriculaModal.ano_letivo}).
            </p>
            <div className="form-group">
              <label className="form-label">Aluno *</label>
              <select className="form-control form-select" value={matriculaAlunoId} onChange={e => setMatriculaAlunoId(e.target.value)}>
                <option value="">Selecionar...</option>
                {alunosParaMatricula.map(a => (
                  <option key={a.aluno_id} value={a.aluno_id}>
                    {a.aluno_nome} — {normalizeSeriesName ? normalizeSeriesName(a.serie_nome) : a.serie_nome}
                  </option>
                ))}
              </select>
              {alunosParaMatricula.length === 0 && (
                <p style={{ fontSize: '0.85rem', color: 'var(--cinza)', marginTop: 8 }}>
                  Não há alunos aprovados pendentes de matrícula neste ano letivo.
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn btn-outline" onClick={fecharMatriculaModal}>Cancelar</button>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={salvarMatricula} disabled={saving || !matriculaAlunoId}>
                {saving ? 'A matricular...' : 'Confirmar matrícula'}
              </button>
            </div>
          </div>
        </div>
      )}

      {alunosModal.turma && (
        <div className="modal-overlay" onClick={fecharAlunosModal}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Alunos da turma {alunosModal.turma.nome}</h3>
              <button className="modal-close" onClick={fecharAlunosModal}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {alunosModal.alunos.length === 0 ? (
                <div className="empty-state">
                  <User size={48} />
                  <h3>Nenhum aluno inscrito</h3>
                  <p>Não há alunos ativos para esta turma.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Aluno</th>
                        <th>BI</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alunosModal.alunos.map(a => (
                        <tr key={a.aluno_id}>
                          <td>{a.aluno_nome}</td>
                          <td>{a.cpf || '—'}</td>
                          <td>{a.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Turma */}
      {turmaEditModal && (
        <div className="modal-overlay" onClick={() => setTurmaEditModal(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Editar Turma</h3>
              <button className="modal-close" onClick={() => setTurmaEditModal(false)}><X size={18} /></button>
            </div>
            {erro && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{erro}</div>}
            <div className="form-group">
              <label className="form-label">Nome da turma</label>
              <input className="form-control" value={turmaEditForm.nome} onChange={e => setTurmaEditForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Turno</label>
              <select className="form-control form-select" value={turmaEditForm.turno} onChange={e => setTurmaEditForm(f => ({ ...f, turno: e.target.value }))}>
                <option value="manhã">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn btn-outline" onClick={() => setTurmaEditModal(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={salvarEditTurma} disabled={turmaEditSaving}>
                {turmaEditSaving ? 'Salvando...' : <><Save size={16} /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {modal.type === 'curso'
                  ? (cursoEditId ? 'Editar curso' : 'Novo curso')
                  : modal.type === 'disciplina'
                    ? 'Nova disciplina'
                    : 'Nova turma'}
              </h3>
              <button className="modal-close" onClick={fecharModal}><X size={18} /></button>
            </div>

            {erro && <div className="alert alert-error">{erro}</div>}

            <form onSubmit={salvarModal}>
              {modal.type === 'curso' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Nome *</label>
                    <input className="form-control" value={cursoForm.nome} onChange={e => setCursoForm({ ...cursoForm, nome: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descrição</label>
                    <textarea className="form-control" rows={3} value={cursoForm.descricao} onChange={e => setCursoForm({ ...cursoForm, descricao: e.target.value })} />
                  </div>
                </>
              )}

              {modal.type === 'disciplina' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Nome *</label>
                    <input className="form-control" value={discForm.nome} onChange={e => setDiscForm({ ...discForm, nome: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Curso (opcional)</label>
                    <select className="form-control form-select" value={discForm.curso_id} onChange={e => setDiscForm({ ...discForm, curso_id: e.target.value })}>
                      <option value="">Geral</option>
                      {cursosUnicos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Classe mínima</label>
                      <input className="form-control" type="number" min={1} max={13} value={discForm.serie_min} onChange={e => setDiscForm({ ...discForm, serie_min: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Classe máxima</label>
                      <input className="form-control" type="number" min={1} max={13} value={discForm.serie_max} onChange={e => setDiscForm({ ...discForm, serie_max: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem', color: 'var(--castanho)' }}>
                      <input
                        type="checkbox"
                        checked={!!discForm.disciplina_chave}
                        onChange={e => setDiscForm({ ...discForm, disciplina_chave: e.target.checked })}
                      />
                      Disciplina nuclear/chave (conta nas regras de recurso)
                    </label>
                  </div>
                </>
              )}

              {modal.type === 'turma' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Nome *</label>
                      <input className="form-control" value={turmaForm.nome} onChange={e => setTurmaForm({ ...turmaForm, nome: e.target.value })} required placeholder="Ex: 10ª A" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ano letivo *</label>
                      <input className="form-control" type="number" value={turmaForm.ano_letivo} onChange={e => setTurmaForm({ ...turmaForm, ano_letivo: e.target.value })} required />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Classe *</label>
                      <select
                        className="form-control form-select"
                        value={turmaForm.serie_classe}
                        onChange={e => {
                          const serie_classe = e.target.value;
                          const n = Number(serie_classe || 0);
                          let curso_id = turmaForm.curso_id;
                          if (n < 10) curso_id = '';
                          if (n === 13) {
                            const inform = cursosUnicos.find(c => normalizarNome(c.nome).includes('inform'));
                            if (inform) curso_id = String(inform.id);
                          }
                          setTurmaForm({ ...turmaForm, serie_classe, curso_id });
                        }}
                        required
                      >
                        <option value="">Selecionar...</option>
                        {classesOptions.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Turno</label>
                      <select className="form-control form-select" value={turmaForm.turno} onChange={e => setTurmaForm({ ...turmaForm, turno: e.target.value })}>
                        <option value="manhã">Manhã</option>
                        <option value="tarde">Tarde</option>
                        <option value="noite">Noite</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Curso {cursoObrigatorio ? '*' : '(somente 10ª–13ª)'}</label>
                    <select
                      className="form-control form-select"
                      value={turmaForm.curso_id}
                      onChange={e => setTurmaForm({ ...turmaForm, curso_id: e.target.value })}
                      disabled={!cursoObrigatorio}
                    >
                      <option value="">{cursoObrigatorio ? 'Selecionar...' : 'Não aplicável'}</option>
                      {cursosDisponiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                    {classeSelecionada === 13 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--cinza)', marginTop: 6 }}>
                        Na 13ª classe só é permitido o curso de Informática.
                      </div>
                    )}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn btn-outline" onClick={fecharModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Salvando...' : <><Save size={16} /> {cursoEditId ? 'Atualizar' : 'Salvar'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}