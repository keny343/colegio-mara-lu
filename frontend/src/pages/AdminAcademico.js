import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { normalizeSeriesName } from '../utils/serieName';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Save, Pencil, Trash2, User } from 'lucide-react';
import Toast, { useToast } from '../components/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { Button, EmptyState, FormField, Input, Modal, Select, Textarea, LoadingState } from '../components/ui';
import './AdminAcademico.css';

function TabButton({ active, onClick, children }) {
  return (
    <Button variant={active ? 'primary' : 'outline'} size="sm" className="tab-pill" onClick={onClick} type="button">
      {children}
    </Button>
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
    if (s.status === 'rejected') errors.push(labels[3]);
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

  if (loading) return <LoadingState />;

  return (
    <div className="page-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} key={toast.key} />}
      <div className="page-header acad-header">
        <div>
          <h2>Académico</h2>
          <p>Cursos, disciplinas, turmas e atribuição de professores</p>
        </div>
        <div className="acad-tabs">
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
        <div className="card card-table">
          <div className="card-table-head">
            <h3 className="card-table-title">Cursos</h3>
            <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => abrirModal('curso')}>Novo curso</Button>
          </div>
          <div className="table-container">
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
                    <td data-label="Nome"><strong>{c.nome}</strong></td>
                    <td className="text-cinza" data-label="Descrição">{c.descricao || '—'}</td>
                    <td className="td-actions" data-label="Ações">
                      <div className="acoes-row">
                        <Button variant="outline" size="sm" icon={<Pencil size={14} />} onClick={() => abrirModal('curso', c)}>Editar</Button>
                        <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => apagarCurso(c)} disabled={saving}>Apagar</Button>
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
        <div className="card card-table">
          <div className="card-table-head">
            <h3 className="card-table-title">Disciplinas</h3>
            <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => abrirModal('disciplina')}>Nova disciplina</Button>
          </div>
          <div className="table-container">
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
                    <td data-label="Disciplina"><strong>{d.nome}</strong></td>
                    <td data-label="Curso">{d.curso_nome || 'Geral'}</td>
                    <td className="text-cinza" data-label="Classe">{d.serie_min || '—'} até {d.serie_max || '—'}</td>
                    <td style={{ textAlign: 'center' }} data-label="Chave">
                      <button
                        type="button"
                        className={`chave-pill${d.disciplina_chave ? ' chave-pill--on' : ''}`}
                        onClick={async () => {
                          try {
                            await api.put(`/staff/disciplinas/${d.id}`, { disciplina_chave: !d.disciplina_chave });
                            showToast(!d.disciplina_chave ? 'Marcada como disciplina chave.' : 'Deixou de ser disciplina chave.', 'success');
                            await loadAll();
                          } catch (err) {
                            showToast(err.response?.data?.message || 'Erro ao actualizar.', 'error');
                          }
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
        <div className="card card-table">
          <div className="card-table-head">
            <h3 className="card-table-title">Turmas</h3>
            {isAdmin && (
              <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => abrirModal('turma')}>Nova turma</Button>
            )}
          </div>
          <div className="table-container">
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
                    <td data-label="Turma"><strong>{t.nome}</strong></td>
                    <td data-label="Ano">{t.ano_letivo}</td>
                    <td data-label="Classe">{t.serie_classe}ª</td>
                    <td data-label="Curso">{t.curso_nome || '—'}</td>
                    <td data-label="Turno">{t.turno}</td>
                    <td className="td-actions" data-label="Ações">
                      <div className="acoes-row acoes-wrap">
                        <Button variant="outline" size="sm" onClick={() => abrirAlunosTurma(t)}>Ver alunos</Button>
                        {isAdmin && (
                          <Button variant="outline" size="sm" icon={<Pencil size={13} />} onClick={() => abrirEditTurma(t)} title="Editar turma" aria-label={`Editar turma ${t.nome}`} />
                        )}
                        <Button variant="primary" size="sm" onClick={() => abrirMatriculaModal(t)}>Matricular</Button>
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
        <div className="card card-table">
          <div className="card-table-head">
            <h3 className="card-table-title">Horários</h3>
            <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => setTab('horarios')}>Novo horário</Button>
          </div>
          <div className="card horario-card">
            <h4 className="horario-title">Criar horário</h4>
            <div className="form-row">
              <FormField label="Turma" htmlFor="aa-hor-turma">
                <Select id="aa-hor-turma" value={horarioForm.turma_id} onChange={e => setHorarioForm({ ...horarioForm, turma_id: e.target.value })}>
                  <option value="">Selecionar...</option>
                  {turmas.map(t => <option key={t.id} value={t.id}>{t.nome} — {t.serie_classe}ª{t.curso_nome ? ` · ${t.curso_nome}` : ''} ({t.ano_letivo})</option>)}
                </Select>
              </FormField>
              <FormField label="Disciplina" htmlFor="aa-hor-disc">
                <Select id="aa-hor-disc" value={horarioForm.disciplina_id} onChange={e => setHorarioForm({ ...horarioForm, disciplina_id: e.target.value })}>
                  <option value="">Selecionar...</option>
                  {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </Select>
              </FormField>
            </div>
            <div className="form-row">
              <FormField label="Dia da semana" htmlFor="aa-hor-dia">
                <Select id="aa-hor-dia" value={horarioForm.dia_semana} onChange={e => setHorarioForm({ ...horarioForm, dia_semana: e.target.value })}>
                  <option value="segunda">Segunda</option>
                  <option value="terca">Terça</option>
                  <option value="quarta">Quarta</option>
                  <option value="quinta">Quinta</option>
                  <option value="sexta">Sexta</option>
                  <option value="sabado">Sábado</option>
                </Select>
              </FormField>
              <FormField label="Hora início" htmlFor="aa-hor-ini">
                <Input id="aa-hor-ini" type="time" value={horarioForm.hora_inicio} onChange={e => setHorarioForm({ ...horarioForm, hora_inicio: e.target.value })} />
              </FormField>
              <FormField label="Hora fim" htmlFor="aa-hor-fim">
                <Input id="aa-hor-fim" type="time" value={horarioForm.hora_fim} onChange={e => setHorarioForm({ ...horarioForm, hora_fim: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Sala" htmlFor="aa-hor-sala">
              <Input id="aa-hor-sala" value={horarioForm.sala} onChange={e => setHorarioForm({ ...horarioForm, sala: e.target.value })} placeholder="Opcional" />
            </FormField>
            <Button variant="primary" icon={<Save size={16} />} loading={saving} onClick={salvarHorario}>
              {saving ? 'Salvando...' : 'Salvar horário'}
            </Button>
          </div>

          <div className="table-container horario-list">
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
                    <td data-label="Dia">{h.dia_semana}</td>
                    <td data-label="Horário">{h.hora_inicio} — {h.hora_fim}</td>
                    <td data-label="Turma">{h.turma_nome} — {h.serie_classe}ª</td>
                    <td data-label="Disciplina">{h.disciplina_nome}</td>
                    <td data-label="Sala">{h.sala || '—'}</td>
                    <td className="td-actions" data-label="Ações">
                      <Button variant="danger" size="sm" onClick={() => apagarHorario(h)} disabled={saving}>Remover</Button>
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
          <h3 className="card-table-title atribuir-title">Atribuir professor</h3>
          <div className="form-row">
            <FormField label="Turma" htmlFor="aa-atrib-turma">
              <Select id="aa-atrib-turma" value={atrib.turma_id} onChange={e => setAtrib({ ...atrib, turma_id: e.target.value })}>
                <option value="">Selecionar...</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome} — {t.serie_classe}ª ({t.ano_letivo})</option>)}
              </Select>
            </FormField>
            <FormField label="Disciplina" htmlFor="aa-atrib-disc">
              <Select id="aa-atrib-disc" value={atrib.disciplina_id} onChange={e => setAtrib({ ...atrib, disciplina_id: e.target.value })}>
                <option value="">Selecionar...</option>
                {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}{d.curso_nome ? ` — ${d.curso_nome}` : ''}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="Professor" htmlFor="aa-atrib-prof">
              <Select id="aa-atrib-prof" value={atrib.professor_id} onChange={e => setAtrib({ ...atrib, professor_id: e.target.value })}>
                <option value="">Selecionar...</option>
                {professores.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.email})</option>)}
              </Select>
              {professores.length === 0 && (
                <div className="atrib-aviso">
                  Ainda não existem usuários do tipo <strong>professor</strong>. Vamos adicionar isso no “Usuários”.
                </div>
              )}
            </FormField>
          </div>
          <Button variant="primary" icon={<Save size={16} />} loading={saving} onClick={salvarAtribuicao}>
            {saving ? 'Salvando...' : 'Atribuir'}
          </Button>
        </div>
      )}

      {tab === 'classes' && (
        <div className="card">
          <h3 className="card-table-title atribuir-title">Exame Nacional / Defesa Final por classe</h3>
          <p className="classes-aviso">
            A configuração aplica-se a todas as turmas da classe (+curso, se aplicável) automaticamente — não é por turma individual.
            Uma classe nunca pode ter as duas opções activas ao mesmo tempo.
          </p>

          <div className="form-row classes-row">
            <FormField label="Classe *" htmlFor="aa-class-classe">
              <Select id="aa-class-classe" value={configForm.serie_classe || ''} onChange={e => setConfigForm({ ...configForm, serie_classe: e.target.value, curso_id: '' })}>
                <option value="">Selecionar...</option>
                {Array.from({ length: 13 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}ª classe</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Curso (opcional — vazio = toda a classe)" htmlFor="aa-class-curso">
              <Select id="aa-class-curso" value={configForm.curso_id || ''} onChange={e => setConfigForm({ ...configForm, curso_id: e.target.value })}>
                <option value="">Toda a classe (sem curso específico)</option>
                {cursosUnicos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!!configForm.exame_nacional}
                  onChange={e => setConfigForm({ ...configForm, exame_nacional: e.target.checked, defesa_final: e.target.checked ? false : configForm.defesa_final })}
                />
                Realiza Exame Nacional (7ª prova)
              </label>
            </div>
            <div className="form-group">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!!configForm.defesa_final}
                  onChange={e => setConfigForm({ ...configForm, defesa_final: e.target.checked, exame_nacional: e.target.checked ? false : configForm.exame_nacional })}
                />
                Realiza Defesa Final
              </label>
            </div>
          </div>
          <Button
            variant="primary"
            icon={<Save size={16} />}
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
            Guardar configuração
          </Button>

          <div className="table-container classes-table">
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
                  <tr><td colSpan={4} className="text-cinza">Nenhuma classe configurada ainda — por omissão, nenhuma classe usa exame nacional nem defesa final.</td></tr>
                ) : configAvaliacao.map(cfg => (
                  <tr key={cfg.id}>
                    <td data-label="Classe"><strong>{cfg.serie_classe}ª classe</strong></td>
                    <td data-label="Curso">{cfg.curso_nome || 'Toda a classe'}</td>
                    <td style={{ textAlign: 'center' }} data-label="Exame Nacional">{cfg.exame_nacional ? '✓' : '—'}</td>
                    <td style={{ textAlign: 'center' }} data-label="Defesa Final">{cfg.defesa_final ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!matriculaModal}
        onClose={fecharMatriculaModal}
        title={`Matricular aluno — ${matriculaModal?.nome}`}
        size="md"
        footer={
          <div className="modal-actions">
            <Button variant="outline" onClick={fecharMatriculaModal}>Cancelar</Button>
            <Button variant="primary" block loading={saving} disabled={!matriculaAlunoId} onClick={salvarMatricula}>
              {saving ? 'A matricular...' : 'Confirmar matrícula'}
            </Button>
          </div>
        }
      >
        <p className="modal-info">
          Aluno com inscrição <strong>aprovada</strong> ainda sem turma ({matriculaModal?.ano_letivo}).
        </p>
        <FormField label="Aluno *" htmlFor="aa-mat-aluno">
          <Select id="aa-mat-aluno" value={matriculaAlunoId} onChange={e => setMatriculaAlunoId(e.target.value)}>
            <option value="">Selecionar...</option>
            {alunosParaMatricula.map(a => (
              <option key={a.aluno_id} value={a.aluno_id}>
                {a.aluno_nome} — {normalizeSeriesName(a.serie_nome)}
              </option>
            ))}
          </Select>
        </FormField>
        {alunosParaMatricula.length === 0 && (
          <p className="modal-info">
            Não há alunos aprovados pendentes de matrícula neste ano letivo.
          </p>
        )}
      </Modal>

      <Modal
        open={!!alunosModal.turma}
        onClose={fecharAlunosModal}
        title={`Alunos da turma ${alunosModal.turma?.nome}`}
        size="lg"
      >
        {alunosModal.alunos.length === 0 ? (
          <EmptyState icon={<User size={48} />} title="Nenhum aluno inscrito" message="Não há alunos ativos para esta turma." />
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
                    <td data-label="Aluno">{a.aluno_nome}</td>
                    <td data-label="BI">{a.cpf || '—'}</td>
                    <td data-label="Status">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        open={turmaEditModal}
        onClose={() => setTurmaEditModal(false)}
        title="Editar Turma"
        size="sm"
        footer={
          <div className="modal-actions">
            <Button variant="outline" onClick={() => setTurmaEditModal(false)}>Cancelar</Button>
            <Button variant="primary" block loading={turmaEditSaving} onClick={salvarEditTurma}>
              {turmaEditSaving ? 'Salvando...' : 'Guardar'}
            </Button>
          </div>
        }
      >
        {erro && <div className="alert alert-error modal-erro">{erro}</div>}
        <FormField label="Nome da turma" htmlFor="aa-edit-turma-nome">
          <Input id="aa-edit-turma-nome" value={turmaEditForm.nome} onChange={e => setTurmaEditForm(f => ({ ...f, nome: e.target.value }))} />
        </FormField>
        <FormField label="Turno" htmlFor="aa-edit-turma-turno">
          <Select id="aa-edit-turma-turno" value={turmaEditForm.turno} onChange={e => setTurmaEditForm(f => ({ ...f, turno: e.target.value }))}>
            <option value="manhã">Manhã</option>
            <option value="tarde">Tarde</option>
            <option value="noite">Noite</option>
          </Select>
        </FormField>
      </Modal>

      <Modal
        open={!!modal}
        onClose={fecharModal}
        title={
          modal?.type === 'curso'
            ? (cursoEditId ? 'Editar curso' : 'Novo curso')
            : modal?.type === 'disciplina'
              ? 'Nova disciplina'
              : 'Nova turma'
        }
        size="md"
        footer={
          <div className="modal-actions">
            <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
            <Button type="submit" form="acad-form" variant="primary" block loading={saving}>
              {saving ? 'Salvando...' : cursoEditId ? 'Atualizar' : 'Salvar'}
            </Button>
          </div>
        }
      >
        {erro && <div className="alert alert-error modal-erro">{erro}</div>}

        <form id="acad-form" onSubmit={salvarModal}>
          {modal?.type === 'curso' && (
            <>
              <FormField label="Nome *" htmlFor="aa-curso-nome" required>
                <Input id="aa-curso-nome" value={cursoForm.nome} onChange={e => setCursoForm({ ...cursoForm, nome: e.target.value })} required />
              </FormField>
              <FormField label="Descrição" htmlFor="aa-curso-desc">
                <Textarea id="aa-curso-desc" rows={3} value={cursoForm.descricao} onChange={e => setCursoForm({ ...cursoForm, descricao: e.target.value })} />
              </FormField>
            </>
          )}

          {modal?.type === 'disciplina' && (
            <>
              <FormField label="Nome *" htmlFor="aa-disc-nome" required>
                <Input id="aa-disc-nome" value={discForm.nome} onChange={e => setDiscForm({ ...discForm, nome: e.target.value })} required />
              </FormField>
              <FormField label="Curso (opcional)" htmlFor="aa-disc-curso">
                <Select id="aa-disc-curso" value={discForm.curso_id} onChange={e => setDiscForm({ ...discForm, curso_id: e.target.value })}>
                  <option value="">Geral</option>
                  {cursosUnicos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
              </FormField>
              <div className="form-row">
                <FormField label="Classe mínima" htmlFor="aa-disc-min">
                  <Input id="aa-disc-min" type="number" min={1} max={13} value={discForm.serie_min} onChange={e => setDiscForm({ ...discForm, serie_min: e.target.value })} />
                </FormField>
                <FormField label="Classe máxima" htmlFor="aa-disc-max">
                  <Input id="aa-disc-max" type="number" min={1} max={13} value={discForm.serie_max} onChange={e => setDiscForm({ ...discForm, serie_max: e.target.value })} />
                </FormField>
              </div>
              <div className="form-group">
                <label className="check-label">
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

          {modal?.type === 'turma' && (
            <>
              <div className="form-row">
                <FormField label="Nome *" htmlFor="aa-turma-nome" required>
                  <Input id="aa-turma-nome" value={turmaForm.nome} onChange={e => setTurmaForm({ ...turmaForm, nome: e.target.value })} required placeholder="Ex: 10ª A" />
                </FormField>
                <FormField label="Ano letivo *" htmlFor="aa-turma-ano" required>
                  <Input id="aa-turma-ano" type="number" value={turmaForm.ano_letivo} onChange={e => setTurmaForm({ ...turmaForm, ano_letivo: e.target.value })} required />
                </FormField>
              </div>
              <div className="form-row">
                <FormField label="Classe *" htmlFor="aa-turma-classe" required>
                  <Select
                    id="aa-turma-classe"
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
                  </Select>
                </FormField>
                <FormField label="Turno" htmlFor="aa-turma-turno">
                  <Select id="aa-turma-turno" value={turmaForm.turno} onChange={e => setTurmaForm({ ...turmaForm, turno: e.target.value })}>
                    <option value="manhã">Manhã</option>
                    <option value="tarde">Tarde</option>
                    <option value="noite">Noite</option>
                  </Select>
                </FormField>
              </div>
              <FormField label={`Curso ${cursoObrigatorio ? '*' : '(somente 10ª–13ª)'}`} htmlFor="aa-turma-curso">
                <Select
                  id="aa-turma-curso"
                  value={turmaForm.curso_id}
                  onChange={e => setTurmaForm({ ...turmaForm, curso_id: e.target.value })}
                  disabled={!cursoObrigatorio}
                >
                  <option value="">{cursoObrigatorio ? 'Selecionar...' : 'Não aplicável'}</option>
                  {cursosDisponiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
                {classeSelecionada === 13 && (
                  <div className="form-hint">Na 13ª classe só é permitido o curso de Informática.</div>
                )}
              </FormField>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
