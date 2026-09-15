import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Users, FileText, CheckCircle, Clock, XCircle, AlertCircle, BookOpen, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import { useFetch } from '../hooks/useFetch';
import { normalizeSeriesName } from '../utils/serieName';
import { Button, Card, DataTable, LoadingState, ErrorState } from '../components/ui';
import './AdminDashboard.css';

/** Cores alinhadas aos tokens de status (Recharts precisa de valor resolvido) */
const STATUS_CHART_COLORS = {
  Pendentes: 'var(--amarelo)',
  'Em Análise': 'var(--azul)',
  Aprovadas: 'var(--verde)',
  Rejeitadas: 'var(--vermelho)',
};

const saudacao = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 19) return 'Boa tarde';
  return 'Boa noite';
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isCoordenador = user?.role === 'coordenador';
  const [savingVaga, setSavingVaga] = useState(null);
  const { error: notifyError, success: notifySuccess } = useNotification();

  const { data, loading, error, refetch, setData } = useFetch((signal) => api.get('/admin/dashboard', { signal }), []);
  const dados = data;

  const guardarVagas = async (serie) => {
    setSavingVaga(serie.id);
    try {
      await api.put(`/admin/series/${serie.id}`, {
        vagas_total: Number(serie.vagas_total),
        vagas_disponiveis: Number(serie.vagas_disponiveis),
        updated_at: serie.updated_at,
      });
      await refetch();
      notifySuccess('Vagas actualizadas.');
    } catch (e) {
      notifyError(e.response?.data?.message || 'Erro ao guardar vagas.');
      if (e.response?.status === 409) await refetch();
    } finally {
      setSavingVaga(null);
    }
  };

  const sincronizarVagas = async () => {
    try {
      await api.post('/admin/series/sincronizar-vagas');
      await refetch();
      notifySuccess('Vagas sincronizadas com sucesso.');
    } catch (e) {
      notifyError(e.response?.data?.message || 'Erro ao sincronizar.');
    }
  };

  if (loading) return <LoadingState />;
  if (error || !dados) return <ErrorState error={error || new Error('Não foi possível carregar os dados.')} onRetry={refetch} />;

  const { inscricoes, por_serie = [], total_usuarios, total_alunos } = dados;
  const primeiroNome = (user?.nome || '').split(' ')[0];
  const hoje = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });

  const pizzaData = [
    { name: 'Pendentes', value: Number(inscricoes.pendentes) || 0 },
    { name: 'Em Análise', value: Number(inscricoes.em_analise) || 0 },
    { name: 'Aprovadas', value: Number(inscricoes.aprovadas) || 0 },
    { name: 'Rejeitadas', value: Number(inscricoes.rejeitadas) || 0 },
  ];

  const hasPizzaData = pizzaData.some(d => d.value > 0);
  const pizzaVisible = pizzaData.filter(d => d.value > 0);

  const barData = (por_serie || []).map(s => ({
    name: normalizeSeriesName(s.nome),
    inscrições: Number(s.total_inscricoes) || 0,
    vagas: Number(s.vagas_total) || 0,
  }));

  /* Hierarquia: fluxo de inscrição em destaque; stock e resultados em segundo plano */
  const kpisPrimarios = [
    { label: 'Pendentes', value: Number(inscricoes.pendentes) || 0, icon: <Clock size={18} />, tone: 'amarelo' },
    { label: 'Em Análise', value: Number(inscricoes.em_analise) || 0, icon: <AlertCircle size={18} />, tone: 'azul' },
    { label: 'Total Inscrições', value: Number(inscricoes.total) || 0, icon: <FileText size={18} />, tone: 'laranja' },
  ];

  const kpisSecundarios = [
    { label: 'Alunos', value: total_alunos, icon: <BookOpen size={16} />, tone: 'castanho' },
    { label: 'Responsáveis', value: total_usuarios, icon: <Users size={16} />, tone: 'castanho-medio' },
    { label: 'Aprovadas', value: Number(inscricoes.aprovadas) || 0, icon: <CheckCircle size={16} />, tone: 'verde' },
    { label: 'Rejeitadas', value: Number(inscricoes.rejeitadas) || 0, icon: <XCircle size={16} />, tone: 'vermelho' },
  ];

  const vagaColumns = [
    { key: 'nome', label: 'Classe', sortable: true, render: s => <strong>{normalizeSeriesName(s.nome)}</strong> },
    { key: 'nivel', label: 'Nível', sortable: true, cellClassName: 'col-hide-md' },
    {
      key: 'vagas_total',
      label: 'Vagas total',
      sortable: true,
      render: s => isAdmin ? (
        <input
          type="number"
          className="form-control vaga-input"
          value={s.vagas_total}
          min={0}
          aria-label={`Vagas total — ${normalizeSeriesName(s.nome)}`}
          onChange={e => {
            const v = e.target.value;
            setData({ ...dados, por_serie: dados.por_serie.map(x => x.id === s.id ? { ...x, vagas_total: v } : x) });
          }}
        />
      ) : s.vagas_total,
    },
    {
      key: 'vagas_disponiveis',
      label: 'Disponíveis',
      sortable: true,
      render: s => isAdmin ? (
        <input
          type="number"
          className="form-control vaga-input"
          value={s.vagas_disponiveis}
          min={0}
          aria-label={`Vagas disponíveis — ${normalizeSeriesName(s.nome)}`}
          onChange={e => {
            const v = e.target.value;
            setData({ ...dados, por_serie: dados.por_serie.map(x => x.id === s.id ? { ...x, vagas_disponiveis: v } : x) });
          }}
        />
      ) : (s.vagas_disponiveis ?? 0),
    },
    { key: 'matriculados', label: 'Matriculados', sortable: true, render: s => s.matriculados ?? 0, cellClassName: 'col-hide-lg' },
    { key: 'total_inscricoes', label: 'Inscrições', sortable: true, render: s => Number(s.total_inscricoes) || 0 },
    ...(isAdmin ? [{
      key: '_actions',
      label: '',
      render: s => (
        <Button variant="primary" size="sm" loading={savingVaga === s.id} onClick={() => guardarVagas(s)}>
          Guardar
        </Button>
      ),
    }] : []),
  ];

  return (
    <div className="page-container dash-page">
      <div className="page-header dash-header">
        <div>
          <p className="dash-greeting">{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}</p>
          <h2>{isCoordenador ? 'Dashboard do Coordenador' : 'Dashboard Administrativo'}</h2>
          <p className="page-header-sub">
            {isCoordenador
              ? 'Visão geral para coordenação académica e gestão de inscrições'
              : 'Visão geral do sistema de matrículas'}
          </p>
        </div>
        <div className="dash-date">{hoje}</div>
      </div>

      <div className="dash-kpis">
        <div className="stats-grid stats-grid--primary" role="group" aria-label="Indicadores prioritários">
          {kpisPrimarios.map((s) => (
            <div key={s.label} className={`stat-card stat-card--emphasis stat-card--${s.tone}`}>
              <div className="stat-icon" aria-hidden="true">{s.icon}</div>
              <div className="stat-number">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="stats-grid stats-grid--secondary" role="group" aria-label="Indicadores de contexto">
          {kpisSecundarios.map((s) => (
            <div key={s.label} className={`stat-card stat-card--quiet stat-card--${s.tone}`}>
              <div className="stat-icon" aria-hidden="true">{s.icon}</div>
              <div className="stat-number">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-actions">
        <Link to="/admin/inscricoes?status=pendente" className="btn btn-primary">
          <Clock size={16} aria-hidden="true" /> Ver pendentes ({Number(inscricoes.pendentes) || 0})
        </Link>
        <Link to="/admin/inscricoes" className="btn btn-outline">
          <FileText size={16} aria-hidden="true" /> Todas as inscrições
        </Link>
      </div>

      <div className="dash-charts">
        <Card title="Status das inscrições">
          {hasPizzaData ? (
            <div className="dash-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pizzaVisible}
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {pizzaVisible.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_CHART_COLORS[entry.name] || 'var(--laranja)'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty"><FileText size={36} /><span>Sem inscrições registadas</span></div>
          )}
        </Card>

        <Card title="Inscrições por série">
          {por_serie.length > 0 ? (
            <div className="dash-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 0, right: 4, bottom: 28, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda-suave)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={48} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="inscrições" fill="var(--laranja)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty"><FileText size={36} /><span>Sem séries configuradas</span></div>
          )}
        </Card>
      </div>

      <Card
        title="Vagas por classe / curso"
        actions={isAdmin && (
          <Button variant="outline" size="sm" icon={<TrendingUp size={14} />} onClick={sincronizarVagas}>
            Recalcular vagas
          </Button>
        )}
      >
        <DataTable columns={vagaColumns} rows={por_serie} keyField="id" emptyMessage="Sem séries configuradas" />
        <p className="dash-note">
          Ao matricular alunos numa turma, as vagas disponíveis são reduzidas automaticamente. Use &quot;Recalcular&quot; para alinhar com o número real de matrículas activas.
        </p>
      </Card>
    </div>
  );
}
