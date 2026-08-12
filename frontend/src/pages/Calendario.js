import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '../components/ui';
import './Calendario.css';

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

const TIPOS = {
  periodo: { label: 'Período',  classe: 'cal-tipo-periodo' },
  feriado: { label: 'Feriado',  classe: 'cal-tipo-feriado' },
  teste:   { label: 'Teste/Exame', classe: 'cal-tipo-teste' },
  aula:    { label: 'Aula',     classe: 'cal-tipo-aula' },
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
  const [erroHorarios, setErroHorarios] = useState(null);
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  // Buscar horários do aluno
  const carregarHorarios = useCallback(() => {
    if (user?.role !== 'aluno') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErroHorarios(null);
    api.get('/aluno/horarios')
      .then(res => setHorarios(res.data || []))
      .catch(err => setErroHorarios(err))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { carregarHorarios(); }, [carregarHorarios]);

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
  const aulasPorDia = (dia) => {
    const data = new Date(ano, mes, dia);
    const nomedia = DIAS_SEMANA_FULL[data.getDay()];
    return horariosPerDia[normalizeDia(nomedia)] || [];
  };

  // Combinar eventos e aulas de um dia
  const itemsDia = (dia) => {
    const eventos = eventoPorDia(dia);
    const aulas = aulasPorDia(dia);
    return [...eventos, ...aulas.map(a => ({ ...a, tipo: 'aula' }))];
  };

  const celulas = Array(primeiroDia).fill(null).concat(Array.from({ length: diasNoMes }, (_, i) => i+1));
  while (celulas.length % 7 !== 0) celulas.push(null);

  if (loading) return <LoadingState />;

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

      {erroHorarios && (
        <div className="alert alert-error cal-erro" role="alert">
          Não foi possível carregar o teu horário de aulas.{' '}
          <button className="alert-close" onClick={carregarHorarios}>Tentar novamente</button>
        </div>
      )}

      <div className="cal-layout">

        {/* Calendário principal */}
        <div className="card cal-card">
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={prev} aria-label="Mês anterior">
              <ChevronLeft size={18} />
            </button>
            <h3 className="cal-nav-titulo">{MESES[mes]} {ano}</h3>
            <button className="cal-nav-btn" onClick={next} aria-label="Mês seguinte">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Grid dos dias da semana */}
          <div className="cal-grid">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="cal-grid-head">{d}</div>
            ))}
            
            {celulas.map((dia, i) => {
              const items = dia ? itemsDia(dia) : [];
              const isHoje = dia && dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
              const isSelecionado = dia === diaSelecionado;
              const temAulas = items.some(it => it.tipo === 'aula');
              const classeCelula = [
                'cal-celula',
                isHoje ? 'cal-celula--hoje' : '',
                isSelecionado ? 'cal-celula--selecionada' : '',
                items.length > 0 ? 'cal-celula--com-itens' : '',
                dia ? '' : 'cal-celula--vazia',
              ].filter(Boolean).join(' ');
              
              return (
                <div 
                  key={i}
                  className={classeCelula}
                  onClick={() => dia && setDiaSelecionado(dia)}
                >
                  {dia && (
                    <>
                      <span className={isHoje ? 'cal-celula-numero cal-celula-numero--hoje' : 'cal-celula-numero'}>{dia}</span>
                      
                      {/* Indicadores visuais */}
                      <div className="cal-celula-dots">
                        {/* Aulas */}
                        {items.filter(it => it.tipo === 'aula').slice(0, 2).map((a, j) => (
                          <span
                            key={`aula-${j}`}
                            className="cal-dot cal-dot-aula"
                            title={`${a.disciplina} - ${a.hora_inicio?.slice(0,5)}`}
                          />
                        ))}
                        
                        {/* Eventos escolares */}
                        {items.filter(it => it.tipo !== 'aula').map((e, j) => (
                          <span
                            key={`evento-${j}`}
                            className={`cal-dot ${TIPOS[e.tipo]?.classe}`}
                            title={e.titulo}
                          />
                        ))}
                      </div>

                      {/* Badge de aulas */}
                      {temAulas && <span className="cal-celula-aulas">AULAS</span>}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="cal-legenda">
            {Object.entries(TIPOS).map(([k, v]) => (
              <div key={k} className="cal-legenda-item">
                <span className={`cal-legenda-dot ${v.classe}`} />
                {v.label}
              </div>
            ))}
          </div>
        </div>

        {/* Painel lateral */}
        <div className="card cal-sidebar">
          {diaSelecionado ? (
            <>
              <h3 className="cal-sidebar-titulo">
                <Calendar size={16} color="var(--laranja)" />
                {diaSelecionado} de {MESES[mes]}
              </h3>

              {itemsDiaSelecionado.length === 0 ? (
                <p className="cal-sidebar-vazio">Sem eventos ou aulas este dia.</p>
              ) : (
                <div className="cal-sidebar-lista">
                  
                  {/* Aulas */}
                  {itemsDiaSelecionado.filter(it => it.tipo === 'aula').length > 0 && (
                    <>
                      <div className="cal-sidebar-secao">Aulas do dia</div>
                      {itemsDiaSelecionado.filter(it => it.tipo === 'aula').map((a, i) => (
                        <div key={`aula-detail-${i}`} className="cal-item cal-item-aula">
                          <div className="cal-item-hora">
                            <Clock size={14} />
                            {a.hora_inicio?.slice(0,5)}–{a.hora_fim?.slice(0,5)}
                          </div>
                          <div>
                            <div className="cal-item-titulo">{a.disciplina}</div>
                            {a.sala && <div className="cal-item-sub">Sala {a.sala}</div>}
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Eventos escolares */}
                  {itemsDiaSelecionado.filter(it => it.tipo !== 'aula').length > 0 && (
                    <>
                      <div className="cal-sidebar-secao">Eventos</div>
                      {itemsDiaSelecionado.filter(it => it.tipo !== 'aula').map((e, i) => (
                        <div key={`evento-detail-${i}`} className={`cal-item ${TIPOS[e.tipo]?.classe}`}>
                          <div>
                            <div className="cal-item-titulo">{e.titulo}</div>
                            <div className="cal-item-sub">{TIPOS[e.tipo]?.label}</div>
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
              <h3 className="cal-sidebar-titulo">
                <Calendar size={16} color="var(--laranja)" />
                Eventos de {MESES[mes]}
              </h3>
              {eventosDoMes.length === 0 ? (
                <p className="cal-sidebar-vazio">Nenhum evento este mês.</p>
              ) : (
                <div className="cal-sidebar-lista">
                  {eventosDoMes.map((e, i) => {
                    const d = new Date(e.data);
                    return (
                      <div key={i} className="cal-evento">
                        <div className="cal-evento-data">
                          <div className="cal-evento-dia">{d.getDate()}</div>
                          <div className="cal-evento-sema">{DIAS_SEMANA[d.getDay()]}</div>
                        </div>
                        <div className={`cal-evento-corpo ${TIPOS[e.tipo]?.classe}`}>
                          <div className="cal-item-titulo">{e.titulo}</div>
                          <div className="cal-item-sub">{TIPOS[e.tipo]?.label}</div>
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
