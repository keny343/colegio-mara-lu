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
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingNotas, setLoadingNotas] = useState(false);
  const [saving, setSaving] = useState({});
  const [erro, setErro] = useState('');
  const [notaModal, setNotaModal] = useState(null); // { aluno, periodo }
  const { toast, showToast, clearToast } = useToast();

  const baseNotas = professor && !podeEditarNotas(user) ? '/professor' : '/staff';
  const postNotas = `${baseNotas}/notas`;

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
                <option key={t.id} value={t.id}>{t.nome} — {t.serie_classe}ª ({t.ano_letivo})</option>
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
            <table className="table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th style={{ textAlign: 'center' }}>Média anual</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((a) => (
                  <tr key={a.matricula_id}>
                    <td>{a.aluno_nome}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{mediaAluno(a.matricula_id) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}