import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Users, FileText, CheckCircle, Clock, XCircle, AlertCircle, BookOpen, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import { useFetch } from '../hooks/useFetch';
import { Button, Card, DataTable, LoadingState, ErrorState } from '../components/ui';
import './AdminDashboard.css';

const CORES = ['#E8641A', '#3D1F0A', '#22C55E', '#EF4444', '#F59E0B', '#3B82F6'];

const normalizeSeriesName = (n) => {
  if (!n) return '';
  const collapsed = n.replace(/\s+\(([^)]+)\)\s+\(\1\)$/, ' ($1)');
  return String(collapsed).trim();
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isCoordenador = user?.role === 'coordenador';
  const [savingVaga, setSavingVaga] = useState(null);
  const { error: notifyError, success: notifySuccess } = useNotification();

  const { data, loading, error, refetch, setData } = useFetch(() => api.get('/admin/dashboard'), []);
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

  const pizzaData = [
    { name: 'Pendentes', value: Number(inscricoes.pendentes) || 0 },
    { name: 'Em Análise', value: Number(inscricoes.em_analise) || 0 },
    { name: 'Aprovadas', value: Number(inscricoes.aprovadas) || 0 },
    { name: 'Rejeitadas', value: Number(inscricoes.rejeitadas) || 0 },
  ];

  const hasPizzaData = pizzaData.some(d => d.value > 0);

  const barData = (por_serie || []).map(s => ({
    name: normalizeSeriesName(s.nome),
    inscrições: Number(s.total_inscricoes) || 0,
    vagas: Number(s.vagas_total) || 0,
  }));

  const stats = [
    { label: 'Pendentes', value: Number(inscricoes.pendentes) || 0, icon: <Clock size={22} />, tone: 'amarelo' },
    { label: 'Em Análise', value: Number(inscricoes.em_analise) || 0, icon: <AlertCircle size={22} />, tone: 'azul' },
    { label: 'Aprovadas', value: Number(inscricoes.aprovadas) || 0, icon: <CheckCircle size={22} />, tone: 'verde' },
    { label: 'Rejeitadas', value: Number(inscricoes.rejeitadas) || 0, icon: <XCircle size={22} />, tone: 'vermelho' },
    { label: 'Total Inscrições', value: Number(inscricoes.total) || 0, icon: <FileText size={22} />, tone: 'laranja' },
    { label: 'Responsáveis', value: total_usuarios, icon: <Users size={22} />, tone: 'castanho-medio' },
    { label: 'Alunos', value: total_alunos, icon: <BookOpen size={22} />, tone: 'castanho' },
  ];

  const vagaColumns = [
    { key: 'nome', label: 'Classe', sortable: true, render: s => <strong>{normalizeSeriesName(s.nome)}</strong> },
    { key: 'nivel', label: 'Nível', sortable: true },
    {
      key: 'vagas_total',
      label: 'Vagas total',
      sortable: true,
      render: s => isAdmin ? (
        <input type="number" className="form-control vaga-input" value={s.vagas_total} min={0}
          onChange={e => {
            const v = e.target.value;
            setData({ ...dados, por_serie: dados.por_serie.map(x => x.id === s.id ? { ...x, vagas_total: v } : x) });
          }} />
      ) : s.vagas_total,
    },
    {
      key: 'vagas_disponiveis',
      label: 'Disponíveis',
      sortable: true,
      render: s => isAdmin ? (
        <input type="number" className="form-control vaga-input" value={s.vagas_disponiveis} min={0}
          onChange={e => {
            const v = e.target.value;
            setData({ ...dados, por_serie: dados.por_serie.map(x => x.id === s.id ? { ...x, vagas_disponiveis: v } : x) });
          }} />
      ) : (s.vagas_disponiveis ?? 0),
    },
    { key: 'matriculados', label: 'Matriculados', sortable: true, render: s => s.matriculados ?? 0 },
    { key: 'total_inscricoes', label: 'Inscrições', sortable: true, render: s => Number(s.total_inscricoes) || 0 },
    ...(isAdmin ? [{
      key: '_actions',
      label: '',
      render: s => (
        <Button variant="primary" size="sm" loading={savingVaga === s.id} onClick={() => guardarVagas(s)}>
          {savingVaga === s.id ? 'Guardando...' : 'Guardar'}
        </Button>
      ),
    }] : []),
  ];

  return (
    <div className="page-container dash-page">
      <div className="page-header">
        <h2>{isCoordenador ? 'Dashboard do Coordenador' : 'Dashboard Administrativo'}</h2>
        <p className="page-header-sub">
          {isCoordenador ? 'Visão geral para coordenação académica e gestão de inscrições' : 'Visão geral do sistema de matrículas'}
        </p>
      </div>

      <div className="stats-grid">
        {stats.map((s, i) => (
          <div key={i} className={`stat-card stat-card--${s.tone}`}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-number">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-actions">
        <Link to="/admin/inscricoes?status=pendente" className="btn btn-primary"><Clock size={16} /> Ver Pendentes ({Number(inscricoes.pendentes) || 0})</Link>
        <Link to="/admin/inscricoes" className="btn btn-outline"><FileText size={16} /> Todas as Inscrições</Link>
      </div>

      <div className="dash-charts">
        <Card title="Status das Inscrições">
          {hasPizzaData ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pizzaData.filter(d => d.value > 0)}
                  cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={11}
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
            <div className="chart-empty"><FileText size={36} /><span>Sem inscrições registadas</span></div>
          )}
        </Card>

        <Card title="Inscrições por Série">
          {por_serie.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E4D7" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="inscrições" fill="var(--laranja)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty"><FileText size={36} /><span>Sem séries configuradas</span></div>
          )}
        </Card>
      </div>

      <Card
        title="Vagas por classe / curso"
        actions={isAdmin && (
          <Button variant="outline" size="sm" icon={<TrendingUp size={14} />} onClick={sincronizarVagas}>
            Recalcular vagas (matrículas)
          </Button>
        )}
      >
        <DataTable columns={vagaColumns} rows={por_serie} keyField="id" emptyMessage="Sem séries configuradas" />
        <p className="dash-note">
          Ao matricular alunos numa turma, as vagas disponíveis são reduzidas automaticamente. Use "Recalcular" para alinhar com o número real de matrículas activas.
        </p>
      </Card>
    </div>
  );
}
