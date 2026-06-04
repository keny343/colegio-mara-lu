import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, BookOpen } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DIAS_SEMANA_FULL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

const EVENTOS_ESCOLARES = [
  { data: '2025-02-10', titulo: 'Início do 1º Período',   tipo: 'periodo' },
  { data: '2025-03-25', titulo: 'Feriado Nacional',        tipo: 'feriado' },
  { data: '2025-04-15', titulo: 'Testes do 1º Período',   tipo: 'teste' },
  { data: '2025-04-16', titulo: 'Testes do 1º Período',   tipo: 'teste' },
  { data: '2025-04-30', titulo: 'Fim do 1º Período',      tipo: 'periodo' },
  { data: '2025-05-05', titulo: 'Início do 2º Período',   tipo: 'periodo' },
  { data: '2025-06-01', titulo: 'Dia da Criança',          tipo: 'feriado' },
  { data: '2025-07-10', titulo: 'Testes do 2º Período',   tipo: 'teste' },
  { data: '2025-07-11', titulo: 'Testes do 2º Período',   tipo: 'teste' },
  { data: '2025-07-25', titulo: 'Fim do 2º Período',      tipo: 'periodo' },
  { data: '2025-08-04', titulo: 'Início do 3º Período',   tipo: 'periodo' },
  { data: '2025-09-17', titulo: 'Exames Finais',           tipo: 'teste' },
  { data: '2025-09-18', titulo: 'Exames Finais',           tipo: 'teste' },
  { data: '2025-10-02', titulo: 'Fim do Ano Lectivo',      tipo: 'periodo' },
];

const tipoStyle = {
  periodo: { bg: 'var(--azul)',     label: 'Período', color: '#fff' },
  feriado: { bg: 'var(--verde)',    label: 'Feriado', color: '#fff' },
  teste:   { bg: 'var(--vermelho)', label: 'Teste/Exame', color: '#fff' },
  aula:    { bg: 'var(--laranja)',  label: 'Aula', color: '#fff' },
};

const normalizeDia = (dia) => {
  const d = (dia || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('-feira', '').trim();
  const map = { 
    segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', 
    sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo'
  };
  return map[d] || dia;
};

export default function Calendario() {
  const { user } = useAuth();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  // Buscar horários do aluno
  useEffect(() => {
    if (user?.role === 'aluno') {
      api.get('/aluno/horarios')
        .then(res => setHorarios(res.data || []))
        .catch(err => console.error('Erro ao buscar horários:', err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes  = new Date(ano, mes + 1, 0).getDate();

  const prev = () => { if (mes === 0) { setMes(11); setAno(a => a-1); } else setMes(m => m-1); };
  const next = () => { if (mes === 11) { setMes(0);  setAno(a => a+1); } else setMes(m => m+1); };

  // Eventos do mês
  const eventosDoMes = EVENTOS_ESCOLARES.filter(e => {
    const d = new Date(e.data);
    return d.getMonth() === mes && d.getFullYear() === ano;
  });

  // Eventos por dia
  const eventoPorDia = (dia) => {
    const str = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    return EVENTOS_ESCOLARES.filter(e => e.data === str);
  };

  // Mapa de horários por dia da semana
  const horariosPerDia = horarios.reduce((acc, h) => {
    const dia = normalizeDia(h.dia_semana);
    if (!acc[dia]) acc[dia] = [];
    acc[dia].push(h);
    return acc;
  }, {});

  // Obter aulas de um dia específico
  const aulasPorDia = (dia, numSemana) => {
    const data = new Date(ano, mes, dia);
    const diaSemana = data.getDay();
    const nomedia = DIAS_SEMANA_FULL[diaSemana];
    const diaNormalizado = normalizeDia(nomedia);
    
    return horariosPerDia[diaNormalizado] || [];
  };

  // Combinar eventos e aulas de um dia
  const itemsDia = (dia) => {
    const eventos = eventoPorDia(dia);
    const aulas = aulasPorDia(dia);
    return [...eventos, ...aulas.map(a => ({ ...a, tipo: 'aula' }))];
  };

  const celulas = Array(primeiroDia).fill(null).concat(Array.from({ length: diasNoMes }, (_, i) => i+1));
  while (celulas.length % 7 !== 0) celulas.push(null);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const diaAtualStr = diaSelecionado 
    ? `${ano}-${String(mes+1).padStart(2,'0')}-${String(diaSelecionado).padStart(2,'0')}`
    : null;
  const itemsDiaSelecionado = diaSelecionado ? itemsDia(diaSelecionado) : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Calendário Escolar</h2>
        <p>Eventos, testes e horários do ano lectivo</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>

        {/* Calendário principal */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <button onClick={prev} style={{ background: 'var(--bege)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={18} />
            </button>
            <h3 style={{ fontSize: '1.2rem' }}>{MESES[mes]} {ano}</h3>
            <button onClick={next} style={{ background: 'var(--bege)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Grid dos dias da semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {DIAS_SEMANA.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--cinza)', padding: '6px 0', textTransform: 'uppercase' }}>{d}</div>
            ))}
            
            {celulas.map((dia, i) => {
              const items = dia ? itemsDia(dia) : [];
              const isHoje = dia && dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
              const isSelecionado = dia === diaSelecionado;
              const temAulas = items.some(it => it.tipo === 'aula');
              
              return (
                <div 
                  key={i}
                  onClick={() => dia && setDiaSelecionado(dia)}
                  style={{
                    minHeight: 70,
                    borderRadius: 8,
                    padding: '6px',
                    background: isHoje ? 'var(--laranja)' : isSelecionado ? 'var(--bege-medio)' : items.length > 0 ? 'var(--bege-claro)' : 'transparent',
                    border: isSelecionado ? '2px solid var(--castanho)' : '1px solid transparent',
                    cursor: dia ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  {dia && (
                    <>
                      <span style={{ fontSize: '0.85rem', fontWeight: isHoje ? 700 : 400, color: isHoje ? 'white' : 'var(--castanho)', zIndex: 1 }}>{dia}</span>
                      
                      {/* Indicadores visuais */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, marginTop: 2, flex: 1, alignContent: 'flex-start' }}>
                        {/* Aulas */}
                        {items.filter(it => it.tipo === 'aula').slice(0, 2).map((a, j) => (
                          <div 
                            key={`aula-${j}`}
                            title={`${a.disciplina} - ${a.hora_inicio?.slice(0,5)}`}
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: tipoStyle.aula.bg,
                              opacity: 0.8
                            }}
                          />
                        ))}
                        
                        {/* Eventos escolares */}
                        {items.filter(it => it.tipo !== 'aula').map((e, j) => (
                          <div 
                            key={`evento-${j}`}
                            title={e.titulo}
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: tipoStyle[e.tipo]?.bg,
                              opacity: 0.8
                            }}
                          />
                        ))}
                      </div>

                      {/* Badge de aulas */}
                      {temAulas && (
                        <div style={{
                          fontSize: '0.6rem',
                          background: tipoStyle.aula.bg,
                          color: 'white',
                          padding: '1px 4px',
                          borderRadius: 3,
                          marginTop: 'auto',
                          textAlign: 'center',
                          fontWeight: 700
                        }}>
                          AULAS
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legenda */}
          <div style={{ display: 'flex', gap: 12, marginTop: '1.5rem', flexWrap: 'wrap' }}>
            {Object.entries(tipoStyle).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--cinza)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: v.bg }} />
                {v.label}
              </div>
            ))}
          </div>
        </div>

        {/* Painel lateral */}
        <div className="card">
          {diaSelecionado ? (
            <>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} color="var(--laranja)" />
                {diaSelecionado} de {MESES[mes]}
              </h3>

              {itemsDiaSelecionado.length === 0 ? (
                <p style={{ color: 'var(--cinza)', fontSize: '0.85rem' }}>Sem eventos ou aulas este dia.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  
                  {/* Aulas */}
                  {itemsDiaSelecionado.filter(it => it.tipo === 'aula').length > 0 && (
                    <>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--castanho)', textTransform: 'uppercase' }}>Aulas do dia</div>
                      {itemsDiaSelecionado.filter(it => it.tipo === 'aula').map((a, i) => (
                        <div key={`aula-detail-${i}`} style={{ display: 'flex', gap: 10, background: 'var(--bege-claro)', borderRadius: 8, padding: '8px 10px', borderLeft: `3px solid ${tipoStyle.aula.bg}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--castanho)', fontWeight: 700, fontSize: '0.8rem', minWidth: 60 }}>
                            <Clock size={14} />
                            {a.hora_inicio?.slice(0,5)}–{a.hora_fim?.slice(0,5)}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{a.disciplina}</div>
                            {a.sala && <div style={{ fontSize: '0.75rem', color: 'var(--cinza)' }}>Sala {a.sala}</div>}
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Eventos escolares */}
                  {itemsDiaSelecionado.filter(it => it.tipo !== 'aula').length > 0 && (
                    <>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--castanho)', textTransform: 'uppercase', marginTop: '0.5rem' }}>Eventos</div>
                      {itemsDiaSelecionado.filter(it => it.tipo !== 'aula').map((e, i) => (
                        <div key={`evento-detail-${i}`} style={{ display: 'flex', gap: 10, background: 'var(--bege-claro)', borderRadius: 8, padding: '8px 10px', borderLeft: `3px solid ${tipoStyle[e.tipo]?.bg}` }}>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{e.titulo}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--cinza)' }}>{tipoStyle[e.tipo]?.label}</div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} color="var(--laranja)" />
                Eventos de {MESES[mes]}
              </h3>
              {eventosDoMes.length === 0 ? (
                <p style={{ color: 'var(--cinza)', fontSize: '0.85rem' }}>Nenhum evento este mês.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {eventosDoMes.map((e, i) => {
                    const d = new Date(e.data);
                    return (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ textAlign: 'center', minWidth: 36 }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--castanho)', lineHeight: 1 }}>{d.getDate()}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--cinza)', textTransform: 'uppercase' }}>{DIAS_SEMANA[d.getDay()]}</div>
                        </div>
                        <div style={{ flex: 1, background: 'var(--bege-claro)', borderRadius: 8, padding: '6px 10px', borderLeft: `3px solid ${tipoStyle[e.tipo]?.bg}` }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{e.titulo}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--cinza)', marginTop: 2 }}>{tipoStyle[e.tipo]?.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}