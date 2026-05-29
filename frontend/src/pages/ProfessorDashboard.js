import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  BookOpen, Users, ClipboardList, AlertTriangle, CheckCircle, XCircle, TrendingUp,
} from 'lucide-react';
import api from '../services/api';

export default function ProfessorDashboard() {
  const { user } = useAuth();
  const [painel, setPainel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get('/professor/painel')
      .then(r => setPainel(r.data))
      .catch(() => setErro('Erro ao carregar o painel.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const disciplinas = painel?.disciplinas || [];
  const totalBem = disciplinas.reduce((s, d) => s + (d.com_notas || 0), 0);
  const totalMal = disciplinas.reduce((s, d) => s + (d.sem_notas || 0), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Painel do professor</h2>
        <p style={{ color: 'var(--cinza)' }}>Visão das suas turmas, alunos, notas e faltas.</p>
      </div>
      {erro && <div className="alert alert-error">{erro}</div>}

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { label: 'Turmas', value: painel?.total_turmas || 0, icon: <Users size={20} />, color: 'var(--laranja)' },
          { label: 'Disciplinas', value: painel?.total_disciplinas || 0, icon: <BookOpen size={20} />, color: 'var(--azul)' },
          { label: 'Alunos', value: painel?.total_alunos || 0, icon: <Users size={20} />, color: 'var(--castanho)' },
          { label: 'Com notas lançadas', value: totalBem, icon: <CheckCircle size={20} />, color: 'var(--verde)' },
          { label: 'Sem notas / em risco', value: totalMal, icon: <XCircle size={20} />, color: 'var(--vermelho)' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ borderLeftColor: s.color }}>
            <div className="stat-icon" style={{ color: s.color }}>{s.icon}</div>
            <div className="stat-number">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <Link to="/professor/notas" className="btn btn-primary btn-sm"><ClipboardList size={14} /> Lançar notas</Link>
        <Link to="/professor/materiais" className="btn btn-outline btn-sm"><BookOpen size={14} /> Materiais</Link>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Turma / Disciplina</th>
              <th>Alunos</th>
              <th>Com notas</th>
              <th>Sem notas</th>
              <th>Faltas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {disciplinas.map((d, i) => {
              const pct = d.total_alunos ? Math.round((d.com_notas / d.total_alunos) * 100) : 0;
              const ok = pct >= 70;
              return (
                <tr key={i}>
                  <td>
                    <strong>{d.disciplina_nome}</strong>
                    <div style={{ fontSize: '0.82rem', color: 'var(--cinza)' }}>{d.turma_nome} — {d.serie_classe}ª</div>
                  </td>
                  <td>{d.total_alunos}</td>
                  <td style={{ color: 'var(--verde)' }}>{d.com_notas}</td>
                  <td style={{ color: d.sem_notas > 0 ? 'var(--vermelho)' : 'var(--cinza)' }}>{d.sem_notas}</td>
                  <td><AlertTriangle size={14} style={{ verticalAlign: 'middle' }} /> {d.total_faltas}</td>
                  <td>
                    {ok ? (
                      <span style={{ color: 'var(--verde)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <TrendingUp size={14} /> Bom ({pct}%)
                      </span>
                    ) : (
                      <span style={{ color: 'var(--vermelho)' }}>Atenção ({pct}%)</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {disciplinas.length === 0 && (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--cinza)' }}>
            Nenhuma disciplina atribuída. Peça ao coordenador para o atribuir a uma turma.
          </p>
        )}
      </div>
    </div>
  );
}
