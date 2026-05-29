import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Users, FileText, CheckCircle, Clock, XCircle, AlertCircle, BookOpen, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../services/api';

const CORES = ['#E8641A', '#3D1F0A', '#22C55E', '#EF4444', '#F59E0B', '#3B82F6'];

export default function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isCoordenador = user?.role === 'coordenador';
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingVaga, setSavingVaga] = useState(null);

  const carregar = () => api.get('/admin/dashboard').then(r => setDados(r.data));

  useEffect(() => {
    carregar().finally(() => setLoading(false));
  }, []);

  const guardarVagas = async (serie) => {
    setSavingVaga(serie.id);
    try {
      await api.put(`/admin/series/${serie.id}`, {
        vagas_total: Number(serie.vagas_total),
        vagas_disponiveis: Number(serie.vagas_disponiveis),
      });
      await carregar();
    } catch (e) {
      alert(e.response?.data?.message || 'Erro ao guardar vagas.');
    } finally {
      setSavingVaga(null);
    }
  };

  const sincronizarVagas = async () => {
    try {
      await api.post('/admin/series/sincronizar-vagas');
      await carregar();
    } catch (e) {
      alert(e.response?.data?.message || 'Erro ao sincronizar.');
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!dados) return <div className="alert alert-error">Erro ao carregar dados.</div>;

  const { inscricoes, por_serie, total_usuarios, total_alunos } = dados;

  // CORRIGIDO: conversão numérica explícita para garantir que valores do MySQL funcionam
  const pizzaData = [
    { name: 'Pendentes',  value: Number(inscricoes.pendentes)  || 0 },
    { name: 'Em Análise', value: Number(inscricoes.em_analise) || 0 },
    { name: 'Aprovadas',  value: Number(inscricoes.aprovadas)  || 0 },
    { name: 'Rejeitadas', value: Number(inscricoes.rejeitadas) || 0 },
  ];

  const hasPizzaData = pizzaData.some(d => d.value > 0);

  // CORRIGIDO: mostra todas as séries no gráfico (com ou sem inscrições),
  // usando Number() para garantir conversão correcta dos valores MySQL
  const normalizeSeriesName = (n) => {
    if (!n) return '';
    // Se o nome tiver o mesmo parêntesis repetido, colapsa: "X (Y) (Y)" -> "X (Y)"
    const collapsed = n.replace(/\s+\(([^)]+)\)\s+\(\1\)$/,' ($1)');
    return String(collapsed).trim();
  };

  const barData = (por_serie || []).map(s => ({
    name: normalizeSeriesName(s.nome),
    inscrições: Number(s.total_inscricoes) || 0,
    vagas: Number(s.vagas_total) || 0,
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>{isCoordenador ? 'Dashboard do Coordenador' : 'Dashboard Administrativo'}</h2>
        <p style={{ color: 'var(--cinza)' }}>
          {isCoordenador ? 'Visão geral para coordenação académica e gestão de inscrições' : 'Visão geral do sistema de matrículas'}
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {[
          { label: 'Total Inscrições', value: Number(inscricoes.total) || 0, icon: <FileText size={22} />, color: 'var(--laranja)' },
          { label: 'Pendentes', value: Number(inscricoes.pendentes) || 0, icon: <Clock size={22} />, color: 'var(--amarelo)' },
          { label: 'Em Análise', value: Number(inscricoes.em_analise) || 0, icon: <AlertCircle size={22} />, color: 'var(--azul)' },
          { label: 'Aprovadas', value: Number(inscricoes.aprovadas) || 0, icon: <CheckCircle size={22} />, color: 'var(--verde)' },
          { label: 'Rejeitadas', value: Number(inscricoes.rejeitadas) || 0, icon: <XCircle size={22} />, color: 'var(--vermelho)' },
          { label: 'Responsáveis', value: total_usuarios, icon: <Users size={22} />, color: 'var(--castanho-medio)' },
          { label: 'Alunos', value: total_alunos, icon: <BookOpen size={22} />, color: 'var(--castanho)' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ borderLeftColor: s.color }}>
            <div className="stat-icon" style={{ color: s.color, background: `${s.color}18` }}>{s.icon}</div>
            <div className="stat-number">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Ação rápida */}
      <div style={{ display: 'flex', gap: 12, marginBottom: '2rem', flexWrap: 'wrap' }}>
        <Link to="/admin/inscricoes?status=pendente" className="btn btn-primary">
          <Clock size={16} /> Ver Pendentes ({Number(inscricoes.pendentes) || 0})
        </Link>
        <Link to="/admin/inscricoes" className="btn btn-outline">
          <FileText size={16} /> Todas as Inscrições
        </Link>
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Gráfico 1 — Status das Inscrições */}
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Status das Inscrições</h3>
          {hasPizzaData ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pizzaData.filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                  fontSize={11}
                >
                  {pizzaData.filter(d => d.value > 0).map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cinza)', flexDirection: 'column', gap: 8 }}>
              <FileText size={36} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: '0.9rem' }}>Sem inscrições registadas</span>
            </div>
          )}
        </div>

        {/* Gráfico 2 — Inscrições por Série */}
        {/* CORRIGIDO: usa por_serie.length para mostrar o gráfico mesmo quando total_inscricoes = 0 */}
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Inscrições por Série</h3>
          {por_serie.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E4D7" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="inscrições" fill="var(--laranja)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cinza)', flexDirection: 'column', gap: 8 }}>
              <FileText size={36} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: '0.9rem' }}>Sem séries configuradas</span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Vagas por classe / curso</h3>
          {isAdmin && (
            <button type="button" className="btn btn-outline btn-sm" onClick={sincronizarVagas}>
              <TrendingUp size={14} /> Recalcular vagas (matrículas)
            </button>
          )}
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Classe</th>
                <th>Nível</th>
                <th>Vagas total</th>
                <th>Disponíveis</th>
                <th>Matriculados</th>
                <th>Inscrições</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {por_serie.map(s => {
                const mat = s.matriculados ?? 0;
                const disp = s.vagas_disponiveis ?? 0;
                const total = s.vagas_total || 1;
                const pct = Math.min(100, Math.round((mat / total) * 100));
                return (
                  <tr key={s.id || s.nome}>
                    <td><strong>{normalizeSeriesName(s.nome)}</strong></td>
                    <td>{s.nivel}</td>
                    <td>
                      {isAdmin ? (
                        <input type="number" className="form-control" style={{ width: 72 }}
                          value={s.vagas_total} min={0}
                          onChange={e => {
                            const v = e.target.value;
                            setDados(d => ({
                              ...d,
                              por_serie: d.por_serie.map(x => x.id === s.id ? { ...x, vagas_total: v } : x),
                            }));
                          }} />
                      ) : s.vagas_total}
                    </td>
                    <td>
                      {isAdmin ? (
                        <input type="number" className="form-control" style={{ width: 72 }}
                          value={s.vagas_disponiveis} min={0}
                          onChange={e => {
                            const v = e.target.value;
                            setDados(d => ({
                              ...d,
                              por_serie: d.por_serie.map(x => x.id === s.id ? { ...x, vagas_disponiveis: v } : x),
                            }));
                          }} />
                      ) : disp}
                    </td>
                    <td>{mat}</td>
                    <td>{Number(s.total_inscricoes) || 0}</td>
                    {isAdmin && (
                      <td>
                        <button type="button" className="btn btn-sm btn-primary" disabled={savingVaga === s.id}
                          onClick={() => guardarVagas(s)}>
                          {savingVaga === s.id ? '...' : 'Guardar'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--cinza)', marginTop: 12 }}>
          Ao matricular alunos numa turma, as vagas disponíveis são reduzidas automaticamente. Use &quot;Recalcular&quot; para alinhar com o número real de matrículas activas.
        </p>
      </div>
    </div>
  );
}