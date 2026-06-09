import React, { useState, useEffect } from 'react';
import { AlertTriangle, Upload } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../contexts/NotificationContext';

export default function ProfessorFaltas() {
  const [profDisciplinas, setProfDisciplinas] = useState([]);
  const [turmaAlunos, setTurmaAlunos] = useState([]);
  const [selectedTurma, setSelectedTurma] = useState('');
  const [selectedMatricula, setSelectedMatricula] = useState('');
  const [selectedDisciplina, setSelectedDisciplina] = useState('');
  const [dataFalta, setDataFalta] = useState('');
  const [justificativaFalta, setJustificativaFalta] = useState('');
  const [faltaSaving, setFaltaSaving] = useState(false);
  const [faltaMsg, setFaltaMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const { success, error } = useNotification();

 useEffect(() => {
  api.get('/professor/minhas-disciplinas')
    .then(r => {
      setProfDisciplinas(r.data || []);
    })
    .catch(err => {
      console.error("ERRO MINHAS DISCIPLINAS:", err);
      setProfDisciplinas([]);
    })
    .finally(() => setLoading(false));
}, []);

  const abrirTurma = async (turmaId) => {
    setSelectedTurma(turmaId);
    setSelectedMatricula('');
    setTurmaAlunos([]);

    try {
      const r = await api.get(`/professor/alunos/${turmaId}`);
      setTurmaAlunos(r.data || []);
    } catch (err) {
      setTurmaAlunos([]);
    }
  };

  const registarFalta = async () => {
    setFaltaMsg('');

    if (!selectedMatricula || !selectedDisciplina || !dataFalta) {
      setFaltaMsg('Preencha aluno, disciplina e data.');
      return;
    }

    setFaltaSaving(true);

    try {
      await api.post('/professor/faltas', {
        matricula_id: selectedMatricula,
        disciplina_id: selectedDisciplina,
        data_falta: dataFalta,
        justificativa: justificativaFalta,
      });

      success('Falta registada com sucesso!');

      setSelectedMatricula('');
      setSelectedDisciplina('');
      setJustificativaFalta('');
      setDataFalta('');

      setTimeout(() => setFaltaMsg(''), 3000);

    } catch (err) {
      const message = err.response?.data?.message || 'Erro ao registar falta.';
      setFaltaMsg(message);
      error(message);
    } finally {
      setFaltaSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-container">

      <div className="page-header">
        <h2>
          <AlertTriangle size={24} style={{ marginRight: 8 }} />
          Registar Faltas
        </h2>
      </div>

      <div className="card">

        {turmasUnicas.length === 0 ? (
          <div className="empty-state">
            <AlertTriangle size={48} style={{ opacity: 0.3 }} />
            <h3>Sem turmas atribuídas</h3>
          </div>
        ) : (
          <div>

            {/* TURMAS */}
            <div style={{ display: 'grid', gap: '10px' }}>
              {turmasUnicas.map(turma => (
                <button
                  key={turma.id}
                  className={`btn ${selectedTurma === turma.id ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => abrirTurma(turma.id)}
                >
                  {turma.nome}
                </button>
              ))}
            </div>

            {/* FORMULÁRIO */}
            {selectedTurma && (
              <div style={{ marginTop: 20 }}>

                {/* ALUNO */}
                <div className="form-group">
                  <label>Aluno</label>
                  <select
                    className="form-control form-select force-select-visible"
                    value={selectedMatricula}
                    onChange={e => setSelectedMatricula(e.target.value)}
                  >
                    <option value="">Selecione aluno</option>

                    {turmaAlunos.length === 0 ? (
                      <option disabled>Nenhum aluno encontrado</option>
                    ) : (
                      turmaAlunos.map(a => (
                        <option
                          key={a.matricula_id}
                          value={a.matricula_id}
                        >
                          {a.aluno_nome || a.nome || a.aluno?.nome}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* DISCIPLINA */}
                <div className="form-group">
                  <label>Disciplina</label>
                  <select
                    className="form-control form-select"
                    value={selectedDisciplina}
                    onChange={e => setSelectedDisciplina(e.target.value)}
                  >
                    <option value="">Selecione disciplina</option>

                    {profDisciplinas
                      .filter(d => String(d.turma_id) === String(selectedTurma))
                      .map(d => (
                        <option key={d.disciplina_id} value={d.disciplina_id}>
                          {d.disciplina_nome}
                        </option>
                      ))}
                  </select>
                </div>

                {/* DATA */}
                <div className="form-group">
                  <label>Data da Falta</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dataFalta}
                    onChange={e => setDataFalta(e.target.value)}
                  />
                </div>

                {/* JUSTIFICATIVA */}
                <div className="form-group">
                  <label>Justificativa</label>
                  <input
                    className="form-control"
                    value={justificativaFalta}
                    onChange={e => setJustificativaFalta(e.target.value)}
                  />
                </div>

                {/* BOTÃO */}
                <button
                  className="btn btn-primary"
                  onClick={registarFalta}
                  disabled={faltaSaving}
                >
                  <Upload size={16} />
                  {faltaSaving ? 'A guardar...' : 'Registar Falta'}
                </button>

                {faltaMsg && (
                  <div className="alert" style={{ marginTop: 10 }}>
                    {faltaMsg}
                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}