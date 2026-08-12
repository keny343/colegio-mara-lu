import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { BookOpen, Users, ClipboardList, AlertTriangle, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import api from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { Badge, DataTable, LoadingState, ErrorState } from '../components/ui';
import './ProfessorDashboard.css';

export default function ProfessorDashboard() {
  const { user } = useAuth();
  const { data: painel, loading, error, refetch } = useFetch((signal) => api.get('/professor/painel', { signal }), []);

  if (loading) return <LoadingState />;
  if (error || !painel) return <ErrorState error={error || new Error('Erro ao carregar o painel.')} onRetry={refetch} />;

  const disciplinas = painel?.disciplinas || [];
  const totalBem = disciplinas.reduce((s, d) => s + (d.com_notas || 0), 0);
  const totalMal = disciplinas.reduce((s, d) => s + (d.sem_notas || 0), 0);

  const stats = [
    { label: 'Turmas', value: painel?.total_turmas || 0, icon: <Users size={20} />, tone: 'laranja' },
    { label: 'Disciplinas', value: painel?.total_disciplinas || 0, icon: <BookOpen size={20} />, tone: 'azul' },
    { label: 'Alunos', value: painel?.total_alunos || 0, icon: <Users size={20} />, tone: 'castanho' },
    { label: 'Com notas lançadas', value: totalBem, icon: <CheckCircle size={20} />, tone: 'verde' },
    { label: 'Sem notas / em risco', value: totalMal, icon: <XCircle size={20} />, tone: 'vermelho' },
  ];

  const columns = [
    {
      key: 'disciplina_nome',
      label: 'Turma / Disciplina',
      sortable: true,
      render: d => (
        <div>
          <strong>{d.disciplina_nome}</strong>
          <div className="cell-sub">{d.turma_nome} — {d.serie_classe}ª</div>
        </div>
      ),
    },
    { key: 'total_alunos', label: 'Alunos', sortable: true },
    { key: 'com_notas', label: 'Com notas', sortable: true, cellClassName: 'cell-verde' },
    {
      key: 'sem_notas',
      label: 'Sem notas',
      sortable: true,
      cellClassName: 'cell-sem-notas',
      render: d => <span className={d.sem_notas > 0 ? 'cell-text-vermelho' : ''}>{d.sem_notas}</span>,
    },
    {
      key: 'total_faltas',
      label: 'Faltas',
      sortable: true,
      render: d => <span className="badge-inline"><AlertTriangle size={14} /> {d.total_faltas}</span>,
    },
    {
      key: 'estado',
      label: 'Estado',
      render: d => {
        const pct = d.total_alunos ? Math.round((d.com_notas / d.total_alunos) * 100) : 0;
        const ok = pct >= 70;
        return ok ? (
          <Badge tone="green"><span className="badge-inline"><TrendingUp size={13} /> Bom ({pct}%)</span></Badge>
        ) : (
          <Badge tone="red">Atenção ({pct}%)</Badge>
        );
      },
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Painel do professor</h2>
        <p className="page-header-sub">Visão das suas turmas, alunos, notas e faltas.</p>
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

      <div className="dash-actions dash-actions-sm">
        <Link to="/professor/notas" className="btn btn-primary btn-sm"><ClipboardList size={14} /> Lançar notas</Link>
        <Link to="/professor/materiais" className="btn btn-outline btn-sm"><BookOpen size={14} /> Materiais</Link>
      </div>

      <div className="card prof-card-table">
        <DataTable
          columns={columns}
          rows={disciplinas}
          keyField="disciplina_id"
          emptyMessage="Nenhuma disciplina atribuída. Peça ao coordenador para o atribuir a uma turma."
        />
      </div>
    </div>
  );
}
