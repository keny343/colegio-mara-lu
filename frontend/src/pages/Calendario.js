import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const EVENTOS = [
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
  periodo: { bg: 'var(--azul)',     label: 'Período' },
  feriado: { bg: 'var(--verde)',    label: 'Feriado' },
  teste:   { bg: 'var(--vermelho)', label: 'Teste/Exame' },
};

export default function Calendario() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes  = new Date(ano, mes + 1, 0).getDate();

  const prev = () => { if (mes === 0) { setMes(11); setAno(a => a-1); } else setMes(m => m-1); };
  const next = () => { if (mes === 11) { setMes(0);  setAno(a => a+1); } else setMes(m => m+1); };

  const eventosDoMes = EVENTOS.filter(e => {
    const d = new Date(e.data);
    return d.getMonth() === mes && d.getFullYear() === ano;
  });

  const eventoPorDia = (dia) => {
    const str = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    return EVENTOS.filter(e => e.data === str);
  };

  const celulas = Array(primeiroDia).fill(null).concat(Array.from({ length: diasNoMes }, (_, i) => i+1));
  while (celulas.length % 7 !== 0) celulas.push(null);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Calendário Escolar</h2>
        <p>Eventos, testes e feriados do ano lectivo</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>

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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {DIAS_SEMANA.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--cinza)', padding: '6px 0', textTransform: 'uppercase' }}>{d}</div>
            ))}
            {celulas.map((dia, i) => {
              const eventos = dia ? eventoPorDia(dia) : [];
              const isHoje = dia && dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
              return (
                <div key={i} style={{ minHeight: 52, borderRadius: 8, padding: '4px 6px', background: isHoje ? 'var(--laranja)' : eventos.length > 0 ? 'var(--bege-claro)' : 'transparent', border: eventos.length > 0 && !isHoje ? '1px solid var(--bege)' : 'none' }}>
                  {dia && (
                    <>
                      <span style={{ fontSize: '0.85rem', fontWeight: isHoje ? 700 : 400, color: isHoje ? 'white' : 'var(--castanho)' }}>{dia}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                        {eventos.map((e, j) => (
                          <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: tipoStyle[e.tipo]?.bg }} title={e.titulo} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: '1.5rem', flexWrap: 'wrap' }}>
            {Object.entries(tipoStyle).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--cinza)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: v.bg }} />
                {v.label}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} color="var(--laranja)" /> Eventos de {MESES[mes]}
          </h3>
          {eventosDoMes.length === 0 ? (
            <p style={{ color: 'var(--cinza)', fontSize: '0.85rem' }}>Nenhum evento este mês.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eventosDoMes.map((e, i) => {
                const d = new Date(e.data);
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
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
        </div>
      </div>
    </div>
  );
}