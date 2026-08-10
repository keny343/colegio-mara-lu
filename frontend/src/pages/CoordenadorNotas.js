import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Save, RefreshCw, CheckCircle } from 'lucide-react';
import api from '../services/api';
import { podeAcederNotas, podeEditarNotas, isProfessor } from '../utils/roles';
import { TRIMESTRES, mediaTrimestre, mediaAnual } from '../utils/notasPeriodos';
import Toast, { useToast } from '../components/Toast.js';
import { Button, EmptyState, FormField, Modal, Select, LoadingState } from '../components/ui';
import './CoordenadorNotas.css';

function StatusPill({ status, fallback }) {
  const tones = {
    aprovado: 'verde',
    aprovado_apos_recurso: 'verde',
    aprovado_2a_chamada: 'verde',
    recurso: 'amarelo',
    pendente_2a_chamada: 'amarelo',
    reprovado: 'vermelho',
    reprovado_apos_recurso: 'vermelho',
    incompleto: 'cinza',
    aguarda_nota_final: 'cinza',
  };
  const cls = tones[status] ? ` status-pill--${tones[status]}` : ' status-pill--cinza';
  return <span className={`status-pill${cls}`}>{fallback || status}</span>;
}

function NotaModal({ info, onClose }) {
  return (
    <Modal open={!!info} onClose={onClose} title="Nota lançada!" size="sm" aria-label="Nota lançada">
      <div className="nota-modal-body">
        <div className="nota-modal-icon"><CheckCircle size={36} /></div>
        <p className="nota-modal-text">
          A nota de <strong>{info?.aluno}</strong> para o período <strong>{info?.periodo}</strong> foi guardada com sucesso.
        </p>
        <Button variant="primary" block onClick={onClose}>Fechar</Button>
      </div>
    </Modal>
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

  if (loading) return <LoadingState />;

  const turmaSel = turmas.find(t => String(t.id) === String(turmaId));
  const titulo = professor && !podeEditarNotas(user) ? 'Lançamento de notas' : 'Notas — coordenação';

  return (
    <div className="page-container">
      <NotaModal info={notaModal} onClose={() => setNotaModal(null)} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} key={toast.key} />}

      <div className="page-header">
        <h2 className="page-header-title"><ClipboardList size={22} />{titulo}</h2>
        <p className="page-header-sub">
          {professor && !podeEditarNotas(user)
            ? 'Lance as notas das disciplinas que leciona. Depois de guardadas, só o coordenador pode alterá-las.'
            : 'Como coordenador, consulta notas no seu ciclo ou curso e altera apenas notas já lançadas pelos professores.'}
          {' '}3 trimestres: prova parcial + prova trimestral em cada trimestre.
          {serieClasse != null && serieClasse <= 6 ? ' Escala 0–10.' : serieClasse != null ? ' Escala 0–20.' : ''}
        </p>
        {podeEditarNotas(user) && user.role !== 'admin' && (
          <p className="page-header-ambito">Âmbito: {user.nivel_coordenado || user.curso_coordenado || '—'}</p>
        )}
      </div>

      {erro && (
        <div className="alert alert-error alert-dismiss">
          <span>{erro}</span>
          <button type="button" className="alert-close" aria-label="Fechar mensagem de erro" onClick={() => setErro('')}>×</button>
        </div>
      )}

      <div className="card filtro-card">
        <div className="form-row">
          <FormField label="Turma *" htmlFor="cn-turma">
            <Select id="cn-turma" value={turmaId} onChange={e => { setTurmaId(e.target.value); setDisciplinaId(''); }}>
              <option value="">Selecionar turma...</option>
              {turmas.map(t => (
                <option key={t.id} value={t.id}>{t.nome} — {t.serie_classe}ª{t.curso_nome ? ` · ${t.curso_nome}` : ''} ({t.ano_letivo})</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Disciplina *" htmlFor="cn-disciplina">
            <Select id="cn-disciplina" value={disciplinaId} onChange={e => setDisciplinaId(e.target.value)} disabled={!turmaId}>
              <option value="">Selecionar disciplina...</option>
              {disciplinasDaTurma.map(d => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </Select>
          </FormField>
          <div className="filtro-acoes">
            <Button variant="outline" icon={<RefreshCw size={16} />} onClick={carregarNotas} disabled={!turmaId || !disciplinaId || loadingNotas}>
              Actualizar
            </Button>
          </div>
        </div>
        {turmaSel && (
          <p className="filtro-info">Notas de <strong>0 a {limites.max}</strong> para a {turmaSel.serie_classe}ª classe</p>
        )}
      </div>

      {turmaId && (
        <div className="card pauta-card">
          <h3 className="nota-section-title">Pauta final — situação do aluno (todas as disciplinas)</h3>
          {loadingPauta ? (
            <p className="pauta-loading">A carregar pauta...</p>
          ) : !pauta || pauta.alunos.length === 0 ? (
            <p className="pauta-loading">Sem disciplinas/alunos suficientes para calcular a pauta desta turma.</p>
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
                    aprovado: 'Aprovado',
                    aprovado_apos_recurso: 'Aprovado (recurso)',
                    recurso: 'Vai a recurso',
                    reprovado: 'Reprovado',
                    reprovado_apos_recurso: 'Reprovado (recurso)',
                    incompleto: 'Notas incompletas',
                  };
                  const aguardaExameDefesa = (a.disciplinas || []).filter(d => d.avaliacao_status === 'aguarda_nota_final');
                  const aguardaChamada2 = (a.disciplinas || []).filter(d => d.avaliacao_status === 'pendente_2a_chamada');
                  return (
                    <tr key={a.matricula_id}>
                      <td><strong>{a.aluno_nome}</strong></td>
                      <td>
                        <StatusPill status={a.resultado} fallback={badges[a.resultado] || 'Notas incompletas'} />
                        {aguardaExameDefesa.length > 0 && (
                          <div className="pauta-aviso">Aguarda {pauta.config_avaliacao?.exame_nacional ? 'Exame Nacional' : 'Defesa Final'}</div>
                        )}
                        {aguardaChamada2.length > 0 && (
                          <div className="pauta-aviso">Aguarda 2ª chamada</div>
                        )}
                      </td>
                      <td className="cell-motivo">
                        {a.negativas.length === 0 ? '—' : a.negativas.map(n => n.nome).join(', ')}
                      </td>
                      {podeLancarRecurso && (
                        <td>
                          {a.resultado === 'recurso' && a.negativas.map((n) => {
                            const key = `${a.matricula_id}-${n.disciplina_id}`;
                            return (
                              <div key={key} className="nota-row">
                                <span className="nota-label">{n.nome} (recurso)</span>
                                <input
                                  type="number"
                                  className="form-control nota-input"
                                  min={0} max={20} step="0.1"
                                  value={recursoForm[key] ?? ''}
                                  onChange={(e) => setRecursoForm(f => ({ ...f, [key]: e.target.value }))}
                                />
                                <Button variant="primary" size="sm" icon={<Save size={12} />} disabled={savingRecurso[key]} onClick={() => salvarRecurso(a.matricula_id, n.disciplina_id)} aria-label="Guardar recurso" />
                              </div>
                            );
                          })}
                          {aguardaExameDefesa.map((d) => {
                            const key = `${a.matricula_id}-${d.disciplina_id}`;
                            return (
                              <div key={key} className="nota-row">
                                <span className="nota-label">{d.nome} ({pauta.config_avaliacao?.exame_nacional ? 'Exame' : 'Defesa'})</span>
                                <input
                                  type="number"
                                  className="form-control nota-input"
                                  min={0} max={20} step="0.1"
                                  value={pautaNotaFinalForm[key] ?? ''}
                                  onChange={(e) => setPautaNotaFinalForm(f => ({ ...f, [key]: e.target.value }))}
                                />
                                <Button variant="primary" size="sm" icon={<Save size={12} />} disabled={savingPautaNotaFinal[key]} onClick={() => salvarNotaFinalPauta(a.matricula_id, d.disciplina_id)} aria-label="Guardar nota final" />
                              </div>
                            );
                          })}
                          {aguardaChamada2.map((d) => {
                            const key = `${a.matricula_id}-${d.disciplina_id}`;
                            return (
                              <div key={key} className="nota-row">
                                <span className="nota-label">{d.nome} (2ª chamada)</span>
                                <input
                                  type="number"
                                  className="form-control nota-input"
                                  min={0} max={20} step="0.1"
                                  value={pautaChamada2Form[key] ?? ''}
                                  onChange={(e) => setPautaChamada2Form(f => ({ ...f, [key]: e.target.value }))}
                                />
                                <Button variant="primary" size="sm" icon={<Save size={12} />} disabled={savingPautaChamada2[key]} onClick={() => salvarChamada2Pauta(a.matricula_id, d.disciplina_id)} aria-label="Guardar 2ª chamada" />
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
        <div className="card">
          <EmptyState icon={<ClipboardList size={48} />} title="Seleccione turma e disciplina" />
        </div>
      ) : loadingNotas ? (
        <LoadingState />
      ) : alunos.length === 0 ? (
        <div className="card">
          <EmptyState title="Nenhum aluno matriculado nesta turma" />
        </div>
      ) : (
        <>
          {TRIMESTRES.map((trim) => (
            <div key={trim.id} className="card trim-card">
              <h3 className="nota-section-title">{trim.titulo}</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th className="th-center th-small">1ª Parcial</th>
                    <th className="th-center th-small">Prova trimestral</th>
                    <th className="th-center">Média do trimestre</th>
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
                            <td key={per.key} className="td-center td-cell-nota">
                              <div className="nota-celula">
                                <input
                                  type="number"
                                  className="form-control nota-cell-input"
                                  min={limites.min} max={limites.max} step="0.1"
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
                                  <Button
                                    variant="primary" size="sm" icon={<Save size={12} />}
                                    disabled={saving[`${a.matricula_id}-${per.key}`]}
                                    onClick={() => salvarNota(a.matricula_id, per.key)}
                                    title="Guardar"
                                    aria-label={`Guardar nota de ${a.aluno_nome} (${per.label})`}
                                  />
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="td-center td-media">{mediaTri ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          <div className="card resumo-card">
            <h3 className="nota-section-title resumo-title">Resumo — média anual por aluno</h3>
            {!configDisciplina.exame_nacional && !configDisciplina.defesa_final ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th className="th-center">Média anual</th>
                    <th className="th-center">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {alunos.map((a) => (
                    <tr key={a.matricula_id}>
                      <td>{a.aluno_nome}</td>
                      <td className="td-center td-media">{mediaAluno(a.matricula_id) ?? '—'}</td>
                      <td className="td-center">
                        {a.situacao === 'aprovado' && <StatusPill status="aprovado" fallback="Aprovado" />}
                        {a.situacao === 'reprovado' && <StatusPill status="reprovado" fallback="Reprovado" />}
                        {!a.situacao && <span className="text-cinza">Notas incompletas</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <>
                <p className="resumo-nota">
                  Esta classe/curso está configurada para <strong>{configDisciplina.exame_nacional ? 'Exame Nacional (7ª prova)' : 'Defesa Final'}</strong>.
                  Média final = Média da Escola × 70% + {configDisciplina.exame_nacional ? 'Exame Nacional' : 'Defesa Final'} × 30%.
                </p>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Aluno</th>
                      <th className="th-center">Média da Escola</th>
                      <th className="th-center">{configDisciplina.exame_nacional ? 'Exame Nacional' : 'Defesa Final'}</th>
                      <th className="th-center">Média Final</th>
                      <th className="th-center">Situação</th>
                      {podeAlterarCoord && <th className="th-center">2ª Chamada</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {alunos.map((a) => {
                      const av = a.avaliacao || {};
                      const statusBadges = {
                        aprovado: 'Aprovado',
                        aprovado_2a_chamada: 'Aprovado (2ª chamada)',
                        pendente_2a_chamada: 'Pendente 2ª chamada',
                        reprovado: 'Reprovado',
                        aguarda_nota_final: `Aguarda ${configDisciplina.exame_nacional ? 'Exame Nacional' : 'Defesa Final'}`,
                        incompleto: 'Notas incompletas',
                      };
                      const jaTemNotaFinal = configDisciplina.exame_nacional ? a.periodos?.EXN != null : a.periodos?.DEF != null;
                      return (
                        <tr key={a.matricula_id}>
                          <td><strong>{a.aluno_nome}</strong></td>
                          <td className="td-center">{av.media_escola ?? '—'}</td>
                          <td className="td-center">
                            {jaTemNotaFinal || !podeAlterarCoord ? (
                              (configDisciplina.exame_nacional ? a.periodos?.EXN : a.periodos?.DEF) ?? '—'
                            ) : (
                              <div className="nota-celula">
                                <input
                                  type="number" className="form-control nota-input" min={0} max={20} step="0.1"
                                  value={notaFinalForm[a.matricula_id] ?? ''}
                                  onChange={(e) => setNotaFinalForm(f => ({ ...f, [a.matricula_id]: e.target.value }))}
                                />
                                <Button variant="primary" size="sm" icon={<Save size={12} />} disabled={savingNotaFinal[a.matricula_id]} onClick={() => salvarNotaFinal(a.matricula_id)} aria-label="Guardar nota final" />
                              </div>
                            )}
                          </td>
                          <td className="td-center td-media">{av.media_final ?? '—'}</td>
                          <td className="td-center">
                            <StatusPill status={av.status} fallback={statusBadges[av.status] || 'Notas incompletas'} />
                          </td>
                          {podeAlterarCoord && (
                            <td className="td-center">
                              {av.status === 'pendente_2a_chamada' && (
                                <div className="nota-celula">
                                  <input
                                    type="number" className="form-control nota-input" min={0} max={20} step="0.1"
                                    value={chamada2Form[a.matricula_id] ?? ''}
                                    onChange={(e) => setChamada2Form(f => ({ ...f, [a.matricula_id]: e.target.value }))}
                                  />
                                  <Button variant="primary" size="sm" icon={<Save size={12} />} disabled={savingChamada2[a.matricula_id]} onClick={() => salvarChamada2(a.matricula_id)} aria-label="Guardar 2ª chamada" />
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
