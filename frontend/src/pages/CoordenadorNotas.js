import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Save, RefreshCw, CheckCircle } from 'lucide-react';
import api from '../services/api';
import { podeAcederNotas, podeEditarNotas, isProfessor } from '../utils/roles';
import { TRIMESTRES, mediaTrimestre, mediaAnual } from '../utils/notasPeriodos';
import Toast, { useToast } from '../components/Toast.js';

/* ──────────────────────────────────────────────
   Modal de confirmação de nota lançada
────────────────────────────────────────────── */
function NotaModal({ info, onClose }) {
  if (!info) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 18, padding: '2.5rem 2rem',
        maxWidth: 380, width: '90%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        animation: 'fadeInScale 0.25s ease',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(34,197,94,0.15)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem',
        }}>
          <CheckCircle size={36} color="#16a34a" />
        </div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: 'var(--castanho)' }}>
          Nota lançada!
        </h3>
        <p style={{ color: 'var(--cinza)', margin: '0 0 1.5rem', fontSize: '0.95rem' }}>
          A nota de <strong>{info.aluno}</strong> para o período <strong>{info.periodo}</strong> foi guardada com sucesso.
        </p>
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={onClose}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

export default function CoordenadorNotas({ modoProfessor = false }) {
  const { user } = useAuth();
  const professor = modoProfessor || isProfessor(user);
  const [turmas, setTurmas] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [atribuicoes, setAtribuicoes] = useState([]);
  const [turmaId, setTurmaId] = useState('');
  const [disciplinaId, setDisciplinaId] = useState('');
  const [alunos, setAlunos] = useState([]);
  const [limites, setLimites] = useState({ min: 0, max: 20 });
  const [serieClasse, setSerieClasse] = useState(null);
  const [podeAlterarCoord, setPodeAlterarCoord] = useState(false);
  const [configDisciplina, setConfigDisciplina] = useState({ exame_nacional: false, defesa_final: false });
  const [notaFinalForm, setNotaFinalForm] = useState({});
  const [savingNotaFinal, setSavingNotaFinal] = useState({});
  const [chamada2Form, setChamada2Form] = useState({});
  const [savingChamada2, setSavingChamada2] = useState({});
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingNotas, setLoadingNotas] = useState(false);
  const [saving, setSaving] = useState({});
  const [erro, setErro] = useState('');
  const [notaModal, setNotaModal] = useState(null); // { aluno, periodo }
  const [pauta, setPauta] = useState(null);
  const [loadingPauta, setLoadingPauta] = useState(false);
  const [recursoForm, setRecursoForm] = useState({});
  const [savingRecurso, setSavingRecurso] = useState({});
  const [pautaNotaFinalForm, setPautaNotaFinalForm] = useState({});
  const [savingPautaNotaFinal, setSavingPautaNotaFinal] = useState({});
  const [pautaChamada2Form, setPautaChamada2Form] = useState({});
  const [savingPautaChamada2, setSavingPautaChamada2] = useState({});
  const { toast, showToast, clearToast } = useToast();

  const podeLancarRecurso = user?.role === 'admin' || podeAlterarCoord;
  const baseNotas = professor && !podeEditarNotas(user) ? '/professor' : '/staff';
  const postNotas = `${baseNotas}/notas`;

  const carregarPauta = useCallback(async () => {
    if (!turmaId) { setPauta(null); return; }
    setLoadingPauta(true);
    try {
      const res = await api.get(`${baseNotas}/turmas/${turmaId}/pauta`);
      setPauta(res.data);
    } catch (e) {
      setPauta(null);
    } finally {
      setLoadingPauta(false);
    }
  }, [turmaId, baseNotas]);

  useEffect(() => { carregarPauta(); }, [carregarPauta]);

  const salvarRecurso = async (matricula_id, disciplina_id) => {
    const key = `${matricula_id}-${disciplina_id}`;
    const valor = recursoForm[key];
    if (valor === undefined || valor === null || valor === '') {
      showToast('Introduza a nota de recurso.', 'error');
      return;
    }
    setSavingRecurso(s => ({ ...s, [key]: true }));
    try {
      await api.post('/staff/notas-recurso', { matricula_id, disciplina_id, nota: parseFloat(valor) });
      showToast('Nota de recurso lançada.', 'success');
      await carregarPauta();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erro ao lançar nota de recurso.', 'error');
    } finally {
      setSavingRecurso(s => ({ ...s, [key]: false }));
    }
  };

  const salvarNotaFinalPauta = async (matricula_id, disciplina_id) => {
    const key = `${matricula_id}-${disciplina_id}`;
    const valor = pautaNotaFinalForm[key];
    if (valor === undefined || valor === null || valor === '') {
      showToast('Introduza a nota.', 'error');
      return;
    }
    setSavingPautaNotaFinal(s => ({ ...s, [key]: true }));
    try {
      await api.post('/staff/notas-exame-defesa', { matricula_id, disciplina_id, nota: parseFloat(valor) });
      showToast('Nota lançada com sucesso.', 'success');
      await carregarPauta();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erro ao lançar nota.', 'error');
    } finally {
      setSavingPautaNotaFinal(s => ({ ...s, [key]: false }));
    }
  };

  const salvarChamada2Pauta = async (matricula_id, disciplina_id) => {
    const key = `${matricula_id}-${disciplina_id}`;
    const valor = pautaChamada2Form[key];
    if (valor === undefined || valor === null || valor === '') {
      showToast('Introduza a nota da 2ª chamada.', 'error');
      return;
    }
    setSavingPautaChamada2(s => ({ ...s, [key]: true }));
    try {
      await api.post('/staff/notas-chamada2', { matricula_id, disciplina_id, nota: parseFloat(valor) });
      showToast('Nota da 2ª chamada lançada.', 'success');
      await carregarPauta();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erro ao lançar 2ª chamada.', 'error');
    } finally {
      setSavingPautaChamada2(s => ({ ...s, [key]: false }));
    }
  };

  useEffect(() => {
    if (!podeAcederNotas(user)) return;
    if (professor && !podeEditarNotas(user)) {
      api.get('/professor/minhas-disciplinas')
        .then(r => {
          setAtribuicoes(r.data);
          const porTurma = {};
          for (const a of r.data) {
            if (!porTurma[a.turma_id]) {
              porTurma[a.turma_id] = {
                id: a.turma_id,
                nome: a.turma_nome,
                serie_classe: a.serie_classe,
                ano_letivo: a.ano_letivo,
                curso_nome: a.curso_nome,
              };
            }
          }
          setTurmas(Object.values(porTurma));
        })
        .catch(() => setErro('Erro ao carregar as suas turmas.'))
        .finally(() => setLoading(false));
      return;
    }
    Promise.all([
      api.get('/staff/turmas', { params: { scope: 'notas' } }),
      api.get('/staff/disciplinas'),
    ])
      .then(([t, d]) => {
        setTurmas(t.data);
        setDisciplinas(d.data);
      })
      .catch(() => setErro('Erro ao carregar turmas ou disciplinas.'))
      .finally(() => setLoading(false));
  }, [user, professor]);

  const disciplinasDaTurma = professor && !podeEditarNotas(user)
    ? atribuicoes
        .filter(a => String(a.turma_id) === String(turmaId))
        .map(a => ({ id: a.disciplina_id, nome: a.disciplina_nome }))
    : disciplinas;

  const carregarNotas = useCallback(async () => {
    if (!turmaId || !disciplinaId) return;
    setLoadingNotas(true);
    setErro('');
    try {
      const res = await api.get(`${baseNotas}/turmas/${turmaId}/notas/${disciplinaId}`);
      setAlunos(res.data.alunos || []);
      setLimites(res.data.limites || { min: 0, max: 20 });
      setSerieClasse(res.data.turma?.serie_classe);
      setPodeAlterarCoord(!!res.data.pode_alterar_como_coordenador);
      setConfigDisciplina(res.data.config_avaliacao || { exame_nacional: false, defesa_final: false });
      const inicial = {};
      for (const a of res.data.alunos || []) {
        inicial[a.matricula_id] = { ...a.periodos };
      }
      setForm(inicial);
    } catch (e) {
      setErro(e.response?.data?.message || 'Erro ao carregar notas.');
      setAlunos([]);
    } finally {
      setLoadingNotas(false);
    }
  }, [turmaId, disciplinaId, baseNotas]);

  useEffect(() => { carregarNotas(); }, [carregarNotas]);

  const celulaTemNota = (matricula_id, periodo) => {
    const v = form[matricula_id]?.[periodo];
    return v !== undefined && v !== null && v !== '';
  };

  const podeEditarCelula = (matricula_id, periodo) => {
    if (!podeAcederNotas(user)) return false;
    if (user.role === 'admin') return true;
    if (podeAlterarCoord) return true;
    if (professor && !podeEditarNotas(user)) {
      return !celulaTemNota(matricula_id, periodo);
    }
    return false;
  };

  const salvarNota = async (matricula_id, periodo) => {
    const key = `${matricula_id}-${periodo}`;
    const valor = form[matricula_id]?.[periodo];
    if (valor === undefined || valor === null || valor === '') {
      setErro('Introduza um valor para a nota.');
      return;
    }
    setSaving(s => ({ ...s, [key]: true }));
    setErro('');
    try {
      await api.post(postNotas, {
        matricula_id,
        disciplina_id: Number(disciplinaId),
        periodo,
        nota: parseFloat(valor),
      });

      // Busca nome do aluno para o modal
      const alunoInfo = alunos.find(a => a.matricula_id === matricula_id);
      setNotaModal({ aluno: alunoInfo?.aluno_nome || 'Aluno', periodo });

      await carregarNotas();
    } catch (e) {
      setErro(e.response?.data?.message || 'Erro ao guardar nota.');
      showToast(e.response?.data?.message || 'Erro ao guardar nota.', 'error');
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  };

  const mediaAluno = (matricula_id) => mediaAnual(form[matricula_id] || {});

  const salvarNotaFinal = async (matricula_id) => {
    const valor = notaFinalForm[matricula_id];
    if (valor === undefined || valor === null || valor === '') {
      showToast(configDisciplina.exame_nacional ? 'Introduza a nota do Exame Nacional.' : 'Introduza a nota da Defesa Final.', 'error');
      return;
    }
    setSavingNotaFinal(s => ({ ...s, [matricula_id]: true }));
    try {
      await api.post('/staff/notas-exame-defesa', { matricula_id, disciplina_id: Number(disciplinaId), nota: parseFloat(valor) });
      showToast('Nota lançada com sucesso.', 'success');
      await carregarNotas();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erro ao lançar nota.', 'error');
    } finally {
      setSavingNotaFinal(s => ({ ...s, [matricula_id]: false }));
    }
  };

  const salvarChamada2 = async (matricula_id) => {
    const valor = chamada2Form[matricula_id];
    if (valor === undefined || valor === null || valor === '') {
      showToast('Introduza a nota da 2ª chamada.', 'error');
      return;
    }
    setSavingChamada2(s => ({ ...s, [matricula_id]: true }));
    try {
      await api.post('/staff/notas-chamada2', { matricula_id, disciplina_id: Number(disciplinaId), nota: parseFloat(valor) });
      showToast('Nota da 2ª chamada lançada.', 'success');
      await carregarNotas();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erro ao lançar 2ª chamada.', 'error');
    } finally {
      setSavingChamada2(s => ({ ...s, [matricula_id]: false }));
    }
  };

  if (!podeAcederNotas(user)) {
    return (
      <div className="page-container">
        <div className="alert alert-error">Não tem permissão para lançar notas.</div>
      </div>
    );
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const turmaSel = turmas.find(t => String(t.id) === String(turmaId));
  const titulo = professor && !podeEditarNotas(user) ? 'Lançamento de notas' : 'Notas — coordenação';

  return (
    <div className="page-container">
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Modal nota guardada */}
      <NotaModal info={notaModal} onClose={() => setNotaModal(null)} />

      {/* Toast global */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} key={toast.key} />}

      <div className="page-header">
        <h2><ClipboardList size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />{titulo}</h2>
        <p style={{ color: 'var(--cinza)' }}>
          {professor && !podeEditarNotas(user)
            ? 'Lance as notas das disciplinas que leciona. Depois de guardadas, só o coordenador pode alterá-las.'
            : 'Como coordenador, consulta notas no seu ciclo ou curso e altera apenas notas já lançadas pelos professores.'}
          {' '}3 trimestres: prova parcial + prova trimestral em cada trimestre.
          {serieClasse != null && serieClasse <= 6 ? ' Escala 0–10.' : serieClasse != null ? ' Escala 0–20.' : ''}
        </p>
        {podeEditarNotas(user) && user.role !== 'admin' && (
          <p style={{ fontSize: '0.85rem', color: 'var(--castanho-medio)' }}>
            Âmbito: {user.nivel_coordenado || user.curso_coordenado || '—'}
          </p>
        )}
      </div>

      {erro && (
        <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{erro}</span>
          <button type="button" className="alert-close" aria-label="Fechar mensagem de erro" onClick={() => setErro('')}>×</button>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Turma *</label>
            <select className="form-control form-select" value={turmaId} onChange={e => { setTurmaId(e.target.value); setDisciplinaId(''); }}>
              <option value="">Selecionar turma...</option>
              {turmas.map(t => (
                <option key={t.id} value={t.id}>{t.nome} — {t.serie_classe}ª{t.curso_nome ? ` · ${t.curso_nome}` : ''} ({t.ano_letivo})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Disciplina *</label>
            <select className="form-control form-select" value={disciplinaId} onChange={e => setDisciplinaId(e.target.value)} disabled={!turmaId}>
              <option value="">Selecionar disciplina...</option>
              {disciplinasDaTurma.map(d => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={carregarNotas} disabled={!turmaId || !disciplinaId || loadingNotas}>
              <RefreshCw size={16} /> Actualizar
            </button>
          </div>
        </div>
        {turmaSel && (
          <p style={{ fontSize: '0.85rem', color: 'var(--cinza)', margin: 0 }}>
            Notas de <strong>0 a {limites.max}</strong> para a {turmaSel.serie_classe}ª classe
          </p>
        )}
      </div>

      {turmaId && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: 0, overflow: 'auto' }}>
          <h3 style={{ padding: '1rem 1rem 0.5rem', margin: 0, fontSize: '1.05rem', color: 'var(--castanho)' }}>
            Pauta final — situação do aluno (todas as disciplinas)
          </h3>
          {loadingPauta ? (
            <p style={{ padding: '0 1rem 1rem', color: 'var(--cinza)' }}>A carregar pauta...</p>
          ) : !pauta || pauta.alunos.length === 0 ? (
            <p style={{ padding: '0 1rem 1rem', color: 'var(--cinza)' }}>
              Sem disciplinas/alunos suficientes para calcular a pauta desta turma.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Resultado</th>
                  <th>Disciplinas em negativa</th>
                  {podeLancarRecurso && <th>Pendências / Acção</th>}
                </tr>
              </thead>
              <tbody>
                {pauta.alunos.map((a) => {
                  const badges = {
                    aprovado:               { label: 'Aprovado',            bg: '#dcfce7', color: '#15803d' },
                    aprovado_apos_recurso:  { label: 'Aprovado (recurso)',  bg: '#dcfce7', color: '#15803d' },
                    recurso:                { label: 'Vai a recurso',       bg: '#fef3c7', color: '#92400e' },
                    reprovado:              { label: 'Reprovado',           bg: '#fee2e2', color: '#b91c1c' },
                    reprovado_apos_recurso: { label: 'Reprovado (recurso)', bg: '#fee2e2', color: '#b91c1c' },
                    incompleto:             { label: 'Notas incompletas',   bg: '#f3f4f6', color: '#6b7280' },
                  };
                  const b = badges[a.resultado] || badges.incompleto;
                  const aguardaExameDefesa = (a.disciplinas || []).filter(d => d.avaliacao_status === 'aguarda_nota_final');
                  const aguardaChamada2 = (a.disciplinas || []).filter(d => d.avaliacao_status === 'pendente_2a_chamada');
                  return (
                    <tr key={a.matricula_id}>
                      <td><strong>{a.aluno_nome}</strong></td>
                      <td>
                        <span style={{ background: b.bg, color: b.color, borderRadius: 6, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                          {b.label}
                        </span>
                        {aguardaExameDefesa.length > 0 && (
                          <div style={{ fontSize: '0.72rem', color: '#92400e', marginTop: 2 }}>
                            Aguarda {pauta.config_avaliacao?.exame_nacional ? 'Exame Nacional' : 'Defesa Final'}
                          </div>
                        )}
                        {aguardaChamada2.length > 0 && (
                          <div style={{ fontSize: '0.72rem', color: '#92400e', marginTop: 2 }}>Aguarda 2ª chamada</div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {a.negativas.length === 0 ? '—' : a.negativas.map(n => n.nome).join(', ')}
                      </td>
                      {podeLancarRecurso && (
                        <td>
                          {a.resultado === 'recurso' && a.negativas.map((n) => {
                            const key = `${a.matricula_id}-${n.disciplina_id}`;
                            return (
                              <div key={key} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--cinza)', minWidth: 90 }}>{n.nome} (recurso)</span>
                                <input
                                  type="number"
                                  className="form-control"
                                  style={{ width: 60, fontSize: '0.8rem' }}
                                  min={0}
                                  max={20}
                                  step="0.1"
                                  value={recursoForm[key] ?? ''}
                                  onChange={(e) => setRecursoForm(f => ({ ...f, [key]: e.target.value }))}
                                />
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  disabled={savingRecurso[key]}
                                  onClick={() => salvarRecurso(a.matricula_id, n.disciplina_id)}
                                >
                                  <Save size={12} />
                                </button>
                              </div>
                            );
                          })}
                          {aguardaExameDefesa.map((d) => {
                            const key = `${a.matricula_id}-${d.disciplina_id}`;
                            return (
                              <div key={key} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--cinza)', minWidth: 90 }}>
                                  {d.nome} ({pauta.config_avaliacao?.exame_nacional ? 'Exame' : 'Defesa'})
                                </span>
                                <input
                                  type="number"
                                  className="form-control"
                                  style={{ width: 60, fontSize: '0.8rem' }}
                                  min={0}
                                  max={20}
                                  step="0.1"
                                  value={pautaNotaFinalForm[key] ?? ''}
                                  onChange={(e) => setPautaNotaFinalForm(f => ({ ...f, [key]: e.target.value }))}
                                />
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  disabled={savingPautaNotaFinal[key]}
                                  onClick={() => salvarNotaFinalPauta(a.matricula_id, d.disciplina_id)}
                                >
                                  <Save size={12} />
                                </button>
                              </div>
                            );
                          })}
                          {aguardaChamada2.map((d) => {
                            const key = `${a.matricula_id}-${d.disciplina_id}`;
                            return (
                              <div key={key} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--cinza)', minWidth: 90 }}>{d.nome} (2ª chamada)</span>
                                <input
                                  type="number"
                                  className="form-control"
                                  style={{ width: 60, fontSize: '0.8rem' }}
                                  min={0}
                                  max={20}
                                  step="0.1"
                                  value={pautaChamada2Form[key] ?? ''}
                                  onChange={(e) => setPautaChamada2Form(f => ({ ...f, [key]: e.target.value }))}
                                />
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  disabled={savingPautaChamada2[key]}
                                  onClick={() => salvarChamada2Pauta(a.matricula_id, d.disciplina_id)}
                                >
                                  <Save size={12} />
                                </button>
                              </div>
                            );
                          })}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!turmaId || !disciplinaId ? (
        <div className="card empty-state">
          <ClipboardList size={48} style={{ opacity: 0.3 }} />
          <h3>Seleccione turma e disciplina</h3>
        </div>
      ) : loadingNotas ? (
        <div className="loading"><div className="spinner" /></div>
      ) : alunos.length === 0 ? (
        <div className="card empty-state">
          <h3>Nenhum aluno matriculado nesta turma</h3>
        </div>
      ) : (
        <>
          {TRIMESTRES.map((trim) => (
            <div key={trim.id} className="card" style={{ padding: 0, overflow: 'auto', marginBottom: '1.25rem' }}>
              <h3 style={{ padding: '1rem 1rem 0.5rem', margin: 0, fontSize: '1.05rem', color: 'var(--castanho)' }}>
                {trim.titulo}
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th style={{ textAlign: 'center', fontSize: '0.85rem' }}>1ª Parcial</th>
                    <th style={{ textAlign: 'center', fontSize: '0.85rem' }}>Prova trimestral</th>
                    <th style={{ textAlign: 'center' }}>Média do trimestre</th>
                  </tr>
                </thead>
                <tbody>
                  {alunos.map((a) => {
                    const periodosAluno = form[a.matricula_id] || {};
                    const mediaTri = mediaTrimestre(periodosAluno, trim.parcial, trim.trimestral);
                    const celulas = [
                      { key: trim.parcial, label: 'Parcial' },
                      { key: trim.trimestral, label: 'Trimestral' },
                    ];
                    return (
                      <tr key={a.matricula_id}>
                        <td><strong>{a.aluno_nome}</strong></td>
                        {celulas.map((per) => {
                          const editavel = podeEditarCelula(a.matricula_id, per.key);
                          return (
                            <td key={per.key} style={{ textAlign: 'center', minWidth: 110 }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                                <input
                                  type="number"
                                  className="form-control"
                                  style={{ width: 64, textAlign: 'center', fontSize: '0.85rem' }}
                                  min={limites.min}
                                  max={limites.max}
                                  step="0.1"
                                  placeholder={`${limites.min}-${limites.max}`}
                                  value={periodosAluno[per.key] ?? ''}
                                  readOnly={!editavel}
                                  disabled={!editavel}
                                  onChange={(e) => setForm((f) => ({
                                    ...f,
                                    [a.matricula_id]: { ...(f[a.matricula_id] || {}), [per.key]: e.target.value },
                                  }))}
                                />
                                {editavel && (
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    disabled={saving[`${a.matricula_id}-${per.key}`]}
                                    onClick={() => salvarNota(a.matricula_id, per.key)}
                                    title="Guardar"
                                  >
                                    <Save size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{mediaTri ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Resumo — média anual por aluno</h3>
            {!configDisciplina.exame_nacional && !configDisciplina.defesa_final ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th style={{ textAlign: 'center' }}>Média anual</th>
                    <th style={{ textAlign: 'center' }}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {alunos.map((a) => (
                    <tr key={a.matricula_id}>
                      <td>{a.aluno_nome}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{mediaAluno(a.matricula_id) ?? '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        {a.situacao === 'aprovado' && (
                          <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 6, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                            Aprovado
                          </span>
                        )}
                        {a.situacao === 'reprovado' && (
                          <span style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                            Reprovado
                          </span>
                        )}
                        {!a.situacao && (
                          <span style={{ color: 'var(--cinza)', fontSize: '0.78rem' }}>Notas incompletas</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <>
                <p style={{ fontSize: '0.82rem', color: 'var(--cinza)', marginTop: 0 }}>
                  Esta classe/curso está configurada para <strong>{configDisciplina.exame_nacional ? 'Exame Nacional (7ª prova)' : 'Defesa Final'}</strong>.
                  Média final = Média da Escola × 70% + {configDisciplina.exame_nacional ? 'Exame Nacional' : 'Defesa Final'} × 30%.
                </p>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Aluno</th>
                      <th style={{ textAlign: 'center' }}>Média da Escola</th>
                      <th style={{ textAlign: 'center' }}>{configDisciplina.exame_nacional ? 'Exame Nacional' : 'Defesa Final'}</th>
                      <th style={{ textAlign: 'center' }}>Média Final</th>
                      <th style={{ textAlign: 'center' }}>Situação</th>
                      {podeAlterarCoord && <th style={{ textAlign: 'center' }}>2ª Chamada</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {alunos.map((a) => {
                      const av = a.avaliacao || {};
                      const statusBadges = {
                        aprovado:              { label: 'Aprovado',              bg: '#dcfce7', color: '#15803d' },
                        aprovado_2a_chamada:   { label: 'Aprovado (2ª chamada)',  bg: '#dcfce7', color: '#15803d' },
                        pendente_2a_chamada:   { label: 'Pendente 2ª chamada',    bg: '#fef3c7', color: '#92400e' },
                        reprovado:             { label: 'Reprovado',              bg: '#fee2e2', color: '#b91c1c' },
                        aguarda_nota_final:    { label: `Aguarda ${configDisciplina.exame_nacional ? 'Exame Nacional' : 'Defesa Final'}`, bg: '#f3f4f6', color: '#6b7280' },
                        incompleto:            { label: 'Notas incompletas',      bg: '#f3f4f6', color: '#6b7280' },
                      };
                      const b = statusBadges[av.status] || statusBadges.incompleto;
                      const jaTemNotaFinal = configDisciplina.exame_nacional ? a.periodos?.EXN != null : a.periodos?.DEF != null;
                      return (
                        <tr key={a.matricula_id}>
                          <td><strong>{a.aluno_nome}</strong></td>
                          <td style={{ textAlign: 'center' }}>{av.media_escola ?? '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            {jaTemNotaFinal || !podeAlterarCoord ? (
                              (configDisciplina.exame_nacional ? a.periodos?.EXN : a.periodos?.DEF) ?? '—'
                            ) : (
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                <input
                                  type="number" className="form-control" style={{ width: 60, fontSize: '0.8rem' }}
                                  min={0} max={20} step="0.1"
                                  value={notaFinalForm[a.matricula_id] ?? ''}
                                  onChange={(e) => setNotaFinalForm(f => ({ ...f, [a.matricula_id]: e.target.value }))}
                                />
                                <button type="button" className="btn btn-primary btn-sm" disabled={savingNotaFinal[a.matricula_id]} onClick={() => salvarNotaFinal(a.matricula_id)}>
                                  <Save size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{av.media_final ?? '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ background: b.bg, color: b.color, borderRadius: 6, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                              {b.label}
                            </span>
                          </td>
                          {podeAlterarCoord && (
                            <td style={{ textAlign: 'center' }}>
                              {av.status === 'pendente_2a_chamada' && (
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                  <input
                                    type="number" className="form-control" style={{ width: 60, fontSize: '0.8rem' }}
                                    min={0} max={20} step="0.1"
                                    value={chamada2Form[a.matricula_id] ?? ''}
                                    onChange={(e) => setChamada2Form(f => ({ ...f, [a.matricula_id]: e.target.value }))}
                                  />
                                  <button type="button" className="btn btn-primary btn-sm" disabled={savingChamada2[a.matricula_id]} onClick={() => salvarChamada2(a.matricula_id)}>
                                    <Save size={12} />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}