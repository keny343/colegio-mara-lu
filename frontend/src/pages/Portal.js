import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  BookOpen, Clock, BarChart2, Bell, ChevronDown, ChevronUp,
  GraduationCap, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import api from '../services/api';
import { TRIMESTRES, normalizarPeriodos, mediaTrimestre, mediaAnual } from '../utils/notasPeriodos';
import { Badge, LoadingState, EmptyState } from '../components/ui';
import './Portal.css';

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

  if (loading) return <LoadingState />;

  const primeiroNome = (user?.nome || aluno?.nome || '').split(' ')[0];
  const notaMax = notasMeta.limites?.max ?? (notasMeta.serie_classe != null && notasMeta.serie_classe <= 6 ? 10 : 20);

  const renderNota = (valor) => (
    valor !== undefined && valor !== null && valor !== ''
      ? <span className="portal-nota" style={{ color: mediaColor(valor, notaMax) }}>{parseFloat(valor).toFixed(1)}</span>
      : <span className="portal-nota portal-nota--vazio">—</span>
  );

  const renderMediaBadge = (media) => (
    media != null
      ? <span className="portal-media-badge" style={{ background: mediaColor(media, notaMax) + '20', color: mediaColor(media, notaMax) }}>{media}</span>
      : <span className="portal-nota portal-nota--vazio">—</span>
  );

  return (
    <div className="page-container">

      {/* Boas-vindas */}
      <div className="portal-hero">
        <div className="portal-hero-inner">
          <div className="portal-avatar">
            <GraduationCap size={26} color="white" />
          </div>
          <div>
            <h2 className="portal-hero-titulo">Olá, {primeiroNome}! 👋</h2>
            <p className="portal-hero-sub">Bem-vindo ao teu portal académico</p>
          </div>
        </div>

        {!matricula && !loading && (
          <div className="alert alert-info portal-hero-alert">
            Ainda não tem matrícula numa turma. Após aprovação da inscrição, o colégio irá associá-lo a uma turma — então verá aqui horários, disciplinas e notas.
          </div>
        )}

        {matricula && (
          <div className="portal-chips">
            {[
              { label: 'Turma', value: matricula.turma_nome },
              { label: 'Classe', value: matricula.serie_classe + 'ª classe' },
              { label: 'Turno', value: matricula.turno ? matricula.turno.charAt(0).toUpperCase() + matricula.turno.slice(1) : '' },
              matricula.curso_nome ? { label: 'Curso', value: matricula.curso_nome } : null,
              { label: 'Ano Letivo', value: matricula.ano_letivo },
            ].filter(Boolean).map((item, i) => (
              <div key={i} className="portal-chip">
                <span className="portal-chip-label">{item.label}: </span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notificações não lidas */}
      {notifs.length > 0 && (
        <div className="card portal-notifs">
          <div className="portal-section-head">
            <Bell size={18} className="portal-icone-laranja" />
            <h3 className="portal-section-titulo">Notificações recentes</h3>
          </div>
          {notifs.map(n => (
            <div key={n.id} className="portal-notif-item">
              <span className="portal-notif-icone">
                {n.tipo === 'aprovada' ? <CheckCircle size={14} color="var(--verde)" /> :
                  n.tipo === 'rejeitada' ? <XCircle size={14} color="var(--vermelho)" /> :
                    <AlertCircle size={14} color="var(--amarelo)" />}
              </span>
              <span>{n.mensagem}</span>
            </div>
          ))}
        </div>
      )}

      <div className="portal-grid">

        {/* Disciplinas */}
        <div className="card portal-col">
          <div className="portal-section-head">
            <div className="portal-icone">
              <BookOpen size={20} color="var(--castanho)" />
            </div>
            <h3 className="portal-section-titulo">As minhas disciplinas</h3>
            <span className="portal-contador">{disciplinas.length}</span>
          </div>
          {disciplinas.length === 0 ? (
            <EmptyState icon={<BookOpen size={36} />} title="Nenhuma disciplina ainda" message="Nenhuma disciplina registada até ao momento." />
          ) : (
            <div className="portal-lista">
              {disciplinas.map((d, i) => (
                <div key={i} className="portal-lista-item">
                  <span className="portal-lista-nome">{d.disciplina}</span>
                  {d.professor && (
                    <span className="portal-lista-professor">
                      {d.professor.split(' ').slice(0, 2).join(' ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Horários */}
        <div className="card portal-col">
          <div
            onClick={() => toggle('horarios')}
            className="portal-section-head portal-section-head--click"
          >
            <div className="portal-icone">
              <Clock size={20} color="var(--castanho)" />
            </div>
            <h3 className="portal-section-titulo">Horários</h3>
            <span className="portal-chevron">
              {openSection.horarios ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </div>
          {openSection.horarios && (
            horarios.length === 0 ? (
              <EmptyState icon={<Clock size={36} />} title="Horário não publicado" message="Horário ainda não publicado." />
            ) : (
              <div className="portal-horarios">
                {Object.entries(
                  horarios.reduce((acc, h) => {
                    const dia = normalizeDia(h.dia_semana);
                    if (!acc[dia]) acc[dia] = [];
                    acc[dia].push(h);
                    return acc;
                  }, {})
                ).map(([dia, aulas]) => (
                  <div key={dia}>
                    <div className="portal-dia">{dia}</div>
                    {aulas.map((a, i) => (
                      <div key={i} className="portal-aula">
                        <span className="portal-aula-nome">{a.disciplina}</span>
                        <span className="portal-aula-hora">
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
      <div className="card portal-notas">
        <div
          onClick={() => toggle('notas')}
          className="portal-section-head portal-section-head--click"
        >
          <div className="portal-icone">
            <BarChart2 size={20} color="var(--castanho)" />
          </div>
          <h3 className="portal-section-titulo">Notas e Médias</h3>
          <span className="portal-chevron">
            {openSection.notas ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </div>
        {openSection.notas && (
          notas.length === 0 ? (
            <EmptyState icon={<BarChart2 size={36} />} title="Sem notas ainda" message="Ainda não foram lançadas notas." />
          ) : (
            <>
            {notasMeta.media_geral != null && (
              <p className="portal-media-geral">
                Média geral: <strong style={{ color: mediaColor(notasMeta.media_geral, notaMax) }}>{notasMeta.media_geral}</strong>
                <span className="portal-media-geral-hint"> (média das médias por disciplina)</span>
              </p>
            )}
            {TRIMESTRES.map((trim) => (
              <div key={trim.id} className="portal-trimestre">
                <h4 className="portal-trimestre-titulo">{trim.titulo}</h4>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Disciplina</th>
                        <th className="portal-th-centro">1ª Parcial</th>
                        <th className="portal-th-centro">Prova trimestral</th>
                        <th className="portal-th-centro">Média do trimestre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notas.map((d, i) => {
                        const p = normalizarPeriodos(d.periodos);
                        const mediaTri = mediaTrimestre(p, trim.parcial, trim.trimestral);
                        return (
                          <tr key={i}>
                            <td className="portal-td-nome">{d.disciplina}</td>
                            <td className="portal-th-centro">{renderNota(p[trim.parcial])}</td>
                            <td className="portal-th-centro">{renderNota(p[trim.trimestral])}</td>
                            <td className="portal-th-centro">{renderMediaBadge(mediaTri)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <div className="table-container">
              <h4 className="portal-trimestre-titulo">Média anual por disciplina</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Disciplina</th>
                    <th className="portal-th-centro">Média anual</th>
                  </tr>
                </thead>
                <tbody>
                  {notas.map((d, i) => {
                    const p = normalizarPeriodos(d.periodos);
                    const media = d.media ?? mediaAnual(p);
                    return (
                      <tr key={i}>
                        <td className="portal-td-nome">{d.disciplina}</td>
                        <td className="portal-th-centro">{renderMediaBadge(media)}</td>
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
