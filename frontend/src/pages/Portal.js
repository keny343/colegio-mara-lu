import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  BookOpen, Clock, BarChart2, Bell, ChevronDown, ChevronUp,
  GraduationCap, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import api from '../services/api';
import { TRIMESTRES, normalizarPeriodos, mediaTrimestre, mediaAnual } from '../utils/notasPeriodos';

const normalizeDia = (dia) => {
  const d = (dia || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('-feira', '').trim();
  const map = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado' };
  return map[d] || dia;
};

const mediaColor = (m, notaMax = 20) => {
  if (m === null) return 'var(--cinza)';
  const v = parseFloat(m);
  const aprovacao = notaMax <= 10 ? 5 : 10;
  const atencao = notaMax <= 10 ? 4 : 7;
  if (v >= aprovacao) return 'var(--verde)';
  if (v >= atencao) return 'var(--amarelo)';
  return 'var(--vermelho)';
};

export default function Portal() {
  const { user } = useAuth();
  const [matricula, setMatricula] = useState(null);
  const [aluno, setAluno] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [notas, setNotas] = useState([]);
  const [notasMeta, setNotasMeta] = useState({ limites: { min: 0, max: 20 }, serie_classe: null });
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState({ notas: true, horarios: false });

  useEffect(() => {
    Promise.all([
      api.get('/aluno/matricula').catch(() => ({ data: {} })),
      api.get('/aluno/disciplinas').catch(() => ({ data: [] })),
      api.get('/aluno/horarios').catch(() => ({ data: [] })),
      api.get('/aluno/notas').catch(() => ({ data: [] })),
      api.get('/notificacoes').catch(() => ({ data: [] })),
    ]).then(([matRes, discRes, horRes, notasRes, notifRes]) => {
      setMatricula(matRes.data.matricula || null);
      setAluno(matRes.data.aluno || null);
      setDisciplinas(discRes.data);
      setHorarios(horRes.data);
      const nd = notasRes.data;
      if (Array.isArray(nd)) {
        setNotas(nd);
      } else {
        setNotas(nd.notas || []);
        setNotasMeta({
          limites: nd.limites || { min: 0, max: 20 },
          serie_classe: nd.serie_classe,
          media_geral: nd.media_geral,
        });
      }
      setNotifs(notifRes.data.filter(n => !n.lida).slice(0, 3));
    }).finally(() => setLoading(false));
  }, []);

  const toggle = (key) => setOpenSection(s => ({ ...s, [key]: !s[key] }));

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const primeiroNome = (user?.nome || aluno?.nome || '').split(' ')[0];
  const notaMax = notasMeta.limites?.max ?? (notasMeta.serie_classe != null && notasMeta.serie_classe <= 6 ? 10 : 20);

  const renderNota = (valor) => (
    valor !== undefined && valor !== null && valor !== ''
      ? <span style={{ fontWeight: 600, color: mediaColor(valor, notaMax) }}>{parseFloat(valor).toFixed(1)}</span>
      : <span style={{ color: 'var(--cinza)', fontSize: '0.85rem' }}>—</span>
  );

  return (
    <div className="page-container">

      {/* Boas-vindas */}
      <div style={{
        background: 'linear-gradient(135deg, var(--castanho), var(--castanho-medio))',
        borderRadius: 'var(--radius-lg)', padding: '2rem', marginBottom: '2rem', color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={26} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Olá, {primeiroNome}! 👋</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: '0.9rem' }}>Bem-vindo ao teu portal académico</p>
          </div>
        </div>

        {!matricula && !loading && (
          <div className="alert alert-info" style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white' }}>
            Ainda não tem matrícula numa turma. Após aprovação da inscrição, o colégio irá associá-lo a uma turma — então verá aqui horários, disciplinas e notas.
          </div>
        )}

        {matricula && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: '1rem' }}>
            {[
              { label: 'Turma', value: matricula.turma_nome },
              { label: 'Classe', value: matricula.serie_classe + 'ª classe' },
              { label: 'Turno', value: matricula.turno ? matricula.turno.charAt(0).toUpperCase() + matricula.turno.slice(1) : '' },
              matricula.curso_nome ? { label: 'Curso', value: matricula.curso_nome } : null,
              { label: 'Ano Letivo', value: matricula.ano_letivo },
            ].filter(Boolean).map((item, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>
                <span style={{ opacity: 0.75 }}>{item.label}: </span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notificações não lidas */}
      {notifs.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--laranja)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
            <Bell size={18} color="var(--laranja)" />
            <h3 style={{ fontSize: '1rem', margin: 0 }}>Notificações recentes</h3>
          </div>
          {notifs.map(n => (
            <div key={n.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--bege-medio)', fontSize: '0.9rem', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ marginTop: 2 }}>
                {n.tipo === 'aprovada' ? <CheckCircle size={14} color="var(--verde)" /> :
                  n.tipo === 'rejeitada' ? <XCircle size={14} color="var(--vermelho)" /> :
                    <AlertCircle size={14} color="var(--amarelo)" />}
              </span>
              <span>{n.mensagem}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>

        {/* Disciplinas */}
        <div className="card" style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
            <div style={{ background: 'var(--castanho-claro)', borderRadius: 8, padding: 8 }}>
              <BookOpen size={20} color="var(--castanho)" />
            </div>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>As minhas disciplinas</h3>
            <span style={{ marginLeft: 'auto', background: 'var(--bege-medio)', borderRadius: 20, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--castanho)' }}>
              {disciplinas.length}
            </span>
          </div>
          {disciplinas.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem 0' }}>
              <BookOpen size={36} style={{ opacity: 0.3 }} />
              <p style={{ marginTop: 8, fontSize: '0.9rem', color: 'var(--cinza)' }}>Nenhuma disciplina registada ainda.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {disciplinas.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bege-claro)', borderRadius: 8, padding: '0.6rem 0.9rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.disciplina}</span>
                  {d.professor && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--cinza)', maxWidth: 130, textAlign: 'right' }}>
                      {d.professor.split(' ').slice(0, 2).join(' ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Horários */}
        <div className="card" style={{ minWidth: 0 }}>
          <div
            onClick={() => toggle('horarios')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: openSection.horarios ? '1.25rem' : 0, cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{ background: 'var(--castanho-claro)', borderRadius: 8, padding: 8 }}>
              <Clock size={20} color="var(--castanho)" />
            </div>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Horários</h3>
            <span style={{ marginLeft: 'auto', color: 'var(--cinza)' }}>
              {openSection.horarios ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </div>
          {openSection.horarios && (
            horarios.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem 0' }}>
                <Clock size={36} style={{ opacity: 0.3 }} />
                <p style={{ marginTop: 8, fontSize: '0.9rem', color: 'var(--cinza)' }}>Horário ainda não publicado.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(
                  horarios.reduce((acc, h) => {
                    const dia = normalizeDia(h.dia_semana);
                    if (!acc[dia]) acc[dia] = [];
                    acc[dia].push(h);
                    return acc;
                  }, {})
                ).map(([dia, aulas]) => (
                  <div key={dia}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--castanho)', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 0 2px' }}>
                      {dia}
                    </div>
                    {aulas.map((a, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bege-claro)', borderRadius: 7, padding: '0.45rem 0.8rem', marginBottom: 4, fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600 }}>{a.disciplina}</span>
                        <span style={{ color: 'var(--cinza)', fontSize: '0.78rem' }}>
                          {a.hora_inicio ? a.hora_inicio.slice(0, 5) : ''}–{a.hora_fim ? a.hora_fim.slice(0, 5) : ''}
                          {a.sala ? ' · Sala ' + a.sala : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Notas e Médias */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div
          onClick={() => toggle('notas')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: openSection.notas ? '1.25rem' : 0, cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ background: 'var(--castanho-claro)', borderRadius: 8, padding: 8 }}>
            <BarChart2 size={20} color="var(--castanho)" />
          </div>
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Notas e Médias</h3>
          <span style={{ marginLeft: 'auto', color: 'var(--cinza)' }}>
            {openSection.notas ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </div>
        {openSection.notas && (
          notas.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem 0' }}>
              <BarChart2 size={36} style={{ opacity: 0.3 }} />
              <p style={{ marginTop: 8, fontSize: '0.9rem', color: 'var(--cinza)' }}>Ainda não foram lançadas notas.</p>
            </div>
          ) : (
            <>
            {notasMeta.media_geral != null && (
              <p style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
                Média geral: <strong style={{ color: mediaColor(notasMeta.media_geral, notaMax) }}>{notasMeta.media_geral}</strong>
                <span style={{ color: 'var(--cinza)', fontSize: '0.85rem' }}> (média das médias por disciplina)</span>
              </p>
            )}
            {TRIMESTRES.map((trim) => (
              <div key={trim.id} style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: 'var(--castanho)' }}>{trim.titulo}</h4>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Disciplina</th>
                        <th style={{ textAlign: 'center' }}>1ª Parcial</th>
                        <th style={{ textAlign: 'center' }}>Prova trimestral</th>
                        <th style={{ textAlign: 'center' }}>Média do trimestre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notas.map((d, i) => {
                        const p = normalizarPeriodos(d.periodos);
                        const mediaTri = mediaTrimestre(p, trim.parcial, trim.trimestral);
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{d.disciplina}</td>
                            <td style={{ textAlign: 'center' }}>{renderNota(p[trim.parcial])}</td>
                            <td style={{ textAlign: 'center' }}>{renderNota(p[trim.trimestral])}</td>
                            <td style={{ textAlign: 'center' }}>
                              {mediaTri != null ? (
                                <span className="badge" style={{ background: mediaColor(mediaTri, notaMax) + '20', color: mediaColor(mediaTri, notaMax), fontWeight: 700, padding: '3px 10px', borderRadius: 20, fontSize: '0.85rem' }}>
                                  {mediaTri}
                                </span>
                              ) : <span style={{ color: 'var(--cinza)' }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <div className="table-container">
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: 'var(--castanho)' }}>Média anual por disciplina</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Disciplina</th>
                    <th style={{ textAlign: 'center' }}>Média anual</th>
                  </tr>
                </thead>
                <tbody>
                  {notas.map((d, i) => {
                    const p = normalizarPeriodos(d.periodos);
                    const media = d.media ?? mediaAnual(p);
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{d.disciplina}</td>
                        <td style={{ textAlign: 'center' }}>
                          {media != null ? (
                            <span className="badge" style={{ background: mediaColor(media, notaMax) + '20', color: mediaColor(media, notaMax), fontWeight: 700, padding: '3px 10px', borderRadius: 20, fontSize: '0.85rem' }}>
                              {media}
                            </span>
                          ) : <span style={{ color: 'var(--cinza)' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )
        )}
      </div>
    </div>
  );
}