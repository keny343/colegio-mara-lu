import React, { useState, useEffect } from 'react';
import { AlertTriangle, Upload } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import { Button, EmptyState, ErrorState, FormField, Input, Select, LoadingState } from '../components/ui';
import './ProfessorFaltas.css';

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
  const [erroCarregar, setErroCarregar] = useState(null);
  const { success, error } = useNotification();

  const carregar = () => {
    setLoading(true);
    setErroCarregar(null);
    api.get('/professor/minhas-disciplinas')
      .then(r => setProfDisciplinas(r.data || []))
      .catch(err => setErroCarregar(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const turmasUnicas = profDisciplinas.reduce((acc, item) => {
    if (!acc.some(t => String(t.id) === String(item.turma_id))) {
      acc.push({
        id: item.turma_id,
        nome: item.turma_nome || `Turma ${item.turma_id}`,
      });
    }
    return acc;
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

  if (loading) return <LoadingState />;

  if (erroCarregar) return <ErrorState error={erroCarregar} onRetry={carregar} />;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-header-title">
          <AlertTriangle size={24} className="page-header-icon" />
          Registar Faltas
        </h2>
      </div>

      <div className="card">
        {turmasUnicas.length === 0 ? (
          <EmptyState icon={<AlertTriangle size={48} />} title="Sem turmas atribuídas" />
        ) : (
          <div>
            <div className="turma-grid">
              {turmasUnicas.map(turma => (
                <Button
                  key={turma.id}
                  variant={selectedTurma === turma.id ? 'primary' : 'outline'}
                  onClick={() => abrirTurma(turma.id)}
                >
                  {turma.nome}
                </Button>
              ))}
            </div>

            {selectedTurma && (
              <div className="falta-form">
                <FormField label="Aluno" htmlFor="pf-aluno">
                  <Select id="pf-aluno" value={selectedMatricula} onChange={e => setSelectedMatricula(e.target.value)}>
                    <option value="">Selecione aluno</option>
                    {turmaAlunos.length === 0 ? (
                      <option disabled>Nenhum aluno encontrado</option>
                    ) : (
                      turmaAlunos.map(a => (
                        <option key={a.matricula_id} value={a.matricula_id}>
                          {a.aluno_nome || a.nome || a.aluno?.nome}
                        </option>
                      ))
                    )}
                  </Select>
                </FormField>

                <FormField label="Disciplina" htmlFor="pf-disciplina">
                  <Select id="pf-disciplina" value={selectedDisciplina} onChange={e => setSelectedDisciplina(e.target.value)}>
                    <option value="">Selecione disciplina</option>
                    {profDisciplinas
                      .filter(d => String(d.turma_id) === String(selectedTurma))
                      .map(d => (
                        <option key={d.disciplina_id} value={d.disciplina_id}>
                          {d.disciplina_nome}
                        </option>
                      ))}
                  </Select>
                </FormField>

                <FormField label="Data da Falta" htmlFor="pf-data">
                  <Input id="pf-data" type="date" value={dataFalta} onChange={e => setDataFalta(e.target.value)} />
                </FormField>

                <FormField label="Justificativa" htmlFor="pf-justificativa">
                  <Input id="pf-justificativa" value={justificativaFalta} onChange={e => setJustificativaFalta(e.target.value)} />
                </FormField>

                <Button variant="primary" icon={<Upload size={16} />} loading={faltaSaving} onClick={registarFalta}>
                  {faltaSaving ? 'A guardar...' : 'Registar Falta'}
                </Button>

                {faltaMsg && <div className="alert falta-msg">{faltaMsg}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
