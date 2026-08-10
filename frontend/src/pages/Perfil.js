import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Save, CheckCircle, GraduationCap, Shield, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { normalizeSeriesName } from '../utils/serieName';
import { temEscopoCoordenacao } from '../utils/roles';
import { urlFoto } from '../utils/userPhoto';
import { Button, FormField, Input, Select, LoadingState } from '../components/ui';
import './Perfil.css';

const ROLE_LABELS = {
  admin: 'Administrador',
  coordenador: 'Coordenador',
  professor: 'Professor',
  aluno: 'Aluno',
};

export default function Perfil() {
  const { user, updateUser } = useAuth();
  const fotoInputRef = useRef(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [aluno, setAluno] = useState(null);
  const [inscricao, setInscricao] = useState(null); // NOVO: dados da inscrição
  const [matricula, setMatricula] = useState(null); // NOVO: dados da matrícula
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [erro, setErro] = useState('');
  const [formAluno, setFormAluno] = useState({});
  const [formStaff, setFormStaff] = useState({ nome: '', telefone: '', endereco: '' });
  // credenciais
  const [credEmail, setCredEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [credSaving, setCredSaving] = useState(false);
  const [credMsg, setCredMsg] = useState('');

  // professor: registar faltas
  const [profDisciplinas, setProfDisciplinas] = useState([]);
  const [turmaAlunos, setTurmaAlunos] = useState([]);
  const [selectedTurma, setSelectedTurma] = useState('');
  const [selectedMatricula, setSelectedMatricula] = useState('');
  const [selectedDisciplina, setSelectedDisciplina] = useState('');
  const [dataFalta, setDataFalta] = useState('');
  const [justificativaFalta, setJustificativaFalta] = useState('');
  const [faltaSaving, setFaltaSaving] = useState(false);
  const [faltaMsg, setFaltaMsg] = useState('');

  const isAluno = user?.role === 'aluno';
  const isStaff = ['admin', 'coordenador', 'professor'].includes(user?.role);

  useEffect(() => {
    setErro('');
    if (isAluno) {
      api.get('/aluno/matricula')
        .then(res => {
          if (res.data.aluno) setAluno(res.data.aluno);
          if (res.data.matricula) setMatricula(res.data.matricula);
          if (res.data.inscricao) setInscricao(res.data.inscricao);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (isStaff) {
      api.get('/auth/perfil')
        .then(res => {
          setStaff(res.data);
          setFormStaff({
            nome: res.data.nome || '',
            telefone: res.data.telefone || '',
            endereco: res.data.endereco || '',
          });
          setCredEmail(res.data.email || user?.email || '');
        })
        .catch(() => setErro('Erro ao carregar perfil.'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isAluno, isStaff]);

  useEffect(() => {
    if (user?.role === 'professor') {
      api.get('/professor/minhas-disciplinas').then(r => setProfDisciplinas(r.data)).catch(() => setProfDisciplinas([]));
    }
  }, [user]);

  useEffect(() => {
    if (aluno) setFormAluno(aluno);
  }, [aluno]);

  const roleLabel = () => {
    if (user?.role === 'professor' && temEscopoCoordenacao(user)) return 'Professor e coordenador';
    return ROLE_LABELS[user?.role] || user?.role;
  };

  const subtitulo = () => {
    if (isAluno) return 'Consulta e actualiza os dados do aluno matriculado';
    if (user?.role === 'coordenador') return 'Dados da sua conta de coordenador de ciclo ou curso';
    if (user?.role === 'professor') return 'Dados da sua conta de professor';
    if (user?.role === 'admin') return 'Dados da sua conta de administrador';
    return 'Consulta e actualiza os teus dados pessoais';
  };

  const escopo = temEscopoCoordenacao(user) ? (user.nivel_coordenado || user.curso_coordenado) : null;

  const handleSaveAluno = async () => {
    if (!aluno?.id) return;
    setSaving(true);
    setErro('');
    try {
      await api.put(`/alunos/${aluno.id}`, formAluno);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao guardar.');
    }
    setSaving(false);
  };

  const foto = urlFoto(user);

  const onFotoPerfil = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    setErro('');
    const fd = new FormData();
    fd.append('foto', file);
    try {
      const res = await api.post('/auth/perfil/foto', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser({ foto_url: res.data.foto_url });
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao carregar foto.');
    } finally {
      setUploadingFoto(false);
      e.target.value = '';
    }
  };

  const handleSaveStaff = async () => {
    setSaving(true);
    setErro('');
    try {
      const res = await api.put('/auth/perfil', formStaff);
      if (res.data.usuario) updateUser(res.data.usuario);
      setStaff(res.data.usuario);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao guardar.');
    }
    setSaving(false);
  };

  const guardarCredenciais = async () => {
    setCredSaving(true);
    setCredMsg('');
    try {
      const payload = { email: credEmail };
      if (newPassword) payload.nova_senha = newPassword;
      if (newPassword) payload.current_password = currentPassword;
      const res = await api.put('/auth/credenciais', payload);
      if (res.data.usuario) updateUser(res.data.usuario);
      setCredMsg(res.data.message || 'Credenciais actualizadas.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setCredMsg(err.response?.data?.message || 'Erro ao actualizar credenciais.');
    } finally {
      setCredSaving(false);
    }
  };

  const registarFalta = async () => {
    setFaltaSaving(true);
    setFaltaMsg('');
    try {
      if (!selectedMatricula || !selectedDisciplina || !dataFalta) return setFaltaMsg('Preencha turma, aluno, disciplina e data.');
      await api.post('/professor/faltas', { matricula_id: selectedMatricula, disciplina_id: selectedDisciplina, data_falta: dataFalta, justificativa: justificativaFalta });
      setFaltaMsg('Falta registada.');
      setSelectedMatricula('');
      setJustificativaFalta('');
      setDataFalta('');
    } catch (err) {
      setFaltaMsg(err.response?.data?.message || 'Erro ao registar falta.');
    } finally {
      setFaltaSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>O meu perfil</h2>
        <p>{subtitulo()}</p>
      </div>

      {erro && <div className="alert alert-error perfil-erro">{erro}</div>}

      <div className="perfil-grid">
        {/* Card avatar */}
        <div className="card perfil-avatar-card">
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={onFotoPerfil}
          />
          <button
            type="button"
            className="perfil-foto-btn"
            onClick={() => fotoInputRef.current?.click()}
            disabled={uploadingFoto}
            title="Clique para escolher a sua fotografia"
            aria-label="Alterar fotografia"
          >
            {foto ? (
              <img src={foto} alt="" className="perfil-foto-img" />
            ) : (
              <span className="perfil-foto-inicial">{(user?.nome || '?').charAt(0).toUpperCase()}</span>
            )}
            <span className="perfil-foto-overlay"><Camera size={22} /></span>
          </button>
          {uploadingFoto && (
            <p className="perfil-upload-msg">A carregar fotografia...</p>
          )}
          <h3 className="perfil-nome">{user?.nome}</h3>
          <p className="perfil-email">{user?.email}</p>
          <span className="badge perfil-role">{roleLabel()}</span>
          {escopo && (
            <p className="perfil-escopo"><Shield size={14} /> Âmbito: {escopo}</p>
          )}

          {isAluno && (inscricao || matricula) && (
            <div className="perfil-situacao">
              <p className="perfil-situacao-titulo">Situação Académica</p>
              {inscricao && (
                <div className="perfil-situacao-linha"><span>Classe: </span><strong>{normalizeSeriesName(inscricao.serie_nome)}</strong></div>
              )}
              {matricula && (
                <div className="perfil-situacao-linha"><span>Turma: </span><strong>{matricula.turma_nome}</strong></div>
              )}
              {matricula && (
                <div className="perfil-situacao-linha"><span>Turno: </span><strong>{matricula.turno}</strong></div>
              )}
              {inscricao && (
                <div className="perfil-situacao-linha"><span>Ano Letivo: </span><strong>{inscricao.inscricao_ano || matricula?.ano_letivo}</strong></div>
              )}
            </div>
          )}
        </div>

        {/* Card dados */}
        <div className="card perfil-dados-card">
          <h3 className="perfil-dados-titulo">
            {isAluno ? <User size={18} /> : <GraduationCap size={18} />}
            {isAluno ? 'Dados do aluno' : 'Dados da conta'}
          </h3>

          {isAluno && (
            aluno ? (
              <div className="perfil-form-col">
                {[
                  { label: 'Nome completo', name: 'nome', value: formAluno.nome || '' },
                  { label: 'Data de nascimento', name: 'data_nascimento', value: formAluno.data_nascimento?.slice(0, 10) || '', type: 'date' },
                  { label: 'Sexo', name: 'sexo', value: formAluno.sexo || '', type: 'select', options: [{ v: 'M', l: 'Masculino' }, { v: 'F', l: 'Feminino' }, { v: 'Outro', l: 'Outro' }] },
                  { label: 'Nacionalidade', name: 'nacionalidade', value: formAluno.nacionalidade || '' },
                  { label: 'Nome da mãe', name: 'nome_mae', value: formAluno.nome_mae || '' },
                  { label: 'Nome do pai', name: 'nome_pai', value: formAluno.nome_pai || '' },
                  { label: 'Encarregado de educação', name: 'responsavel', value: formAluno.responsavel || '' },
                  { label: 'Telefone de emergência', name: 'telefone_emergencia', value: formAluno.telefone_emergencia || '' },
                ].map((f, i) => (
                  <FormField key={i} label={f.label}>
                    {f.type === 'select' ? (
                      <Select name={f.name} value={f.value} onChange={e => setFormAluno(x => ({ ...x, [e.target.name]: e.target.value }))}>
                        <option value="">—</option>
                        {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </Select>
                    ) : (
                      <Input type={f.type || 'text'} name={f.name} value={f.value} onChange={e => setFormAluno(x => ({ ...x, [e.target.name]: e.target.value }))} />
                    )}
                  </FormField>
                ))}
                <Button variant="primary" block icon={saved ? <CheckCircle size={16} /> : <Save size={16} />} loading={saving} onClick={handleSaveAluno}>
                  {saved ? 'Guardado!' : saving ? 'A guardar...' : 'Guardar alterações'}
                </Button>
              </div>
            ) : (
              <p className="perfil-sem-dados">Ainda não há registo de aluno associado à sua conta.</p>
            )
          )}

          {isAluno && (
            <div className="perfil-quicklink">
              <Link to="/portal/faltas" className="btn btn-outline">Ir para Justificações / Faltas</Link>
            </div>
          )}

          {isStaff && staff && (
            <div className="perfil-form-col">
              <FormField label="Nome completo">
                <Input value={formStaff.nome} onChange={e => setFormStaff(f => ({ ...f, nome: e.target.value }))} />
              </FormField>
              <FormField label="E-mail (login)">
                <Input value={staff.email || ''} disabled />
              </FormField>
              {staff.cpf && (
                <FormField label="BI / NIF">
                  <Input value={staff.cpf} disabled />
                </FormField>
              )}
              <FormField label="Telefone">
                <Input value={formStaff.telefone || ''} onChange={e => setFormStaff(f => ({ ...f, telefone: e.target.value }))} />
              </FormField>
              <FormField label="Endereço">
                <Input value={formStaff.endereco || ''} onChange={e => setFormStaff(f => ({ ...f, endereco: e.target.value }))} />
              </FormField>
              <Button variant="primary" block icon={saved ? <CheckCircle size={16} /> : <Save size={16} />} loading={saving} onClick={handleSaveStaff}>
                {saved ? 'Guardado!' : saving ? 'A guardar...' : 'Guardar alterações'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Credenciais (email / senha) - todos os perfis */}
      <div className="perfil-section">
        <div className="card">
          <h3 className="perfil-dados-titulo">Credenciais</h3>
          <div className="perfil-form-col">
            <FormField label="E-mail" htmlFor="perfil-cred-email">
              <Input id="perfil-cred-email" value={credEmail} onChange={e => setCredEmail(e.target.value)} />
            </FormField>
            <FormField label="Senha atual (necessária para alterar senha)" htmlFor="perfil-cred-atual">
              <Input id="perfil-cred-atual" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            </FormField>
            <FormField label="Nova senha" htmlFor="perfil-cred-nova">
              <Input id="perfil-cred-nova" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </FormField>
            {credMsg && <div className="alert alert-info">{credMsg}</div>}
            <div className="perfil-acoes">
              <Button variant="primary" loading={credSaving} onClick={guardarCredenciais}>
                {credSaving ? 'A processar...' : 'Guardar credenciais'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Professor: registar falta */}
      {user?.role === 'professor' && (
        <div className="perfil-section">
          <div className="card">
            <h3 className="perfil-dados-titulo">Registar Falta (rápido)</h3>
            <div className="perfil-form-col">
              <div className="form-row">
                <FormField label="Turma" htmlFor="perfil-falta-turma">
                  <Select id="perfil-falta-turma" value={selectedTurma} onChange={async (e) => {
                    const v = e.target.value;
                    setSelectedTurma(v);
                    setSelectedMatricula('');
                    setTurmaAlunos([]);
                    if (v) {
                      try {
                        const r = await api.get(`/staff/turmas/${v}/alunos`);
                        setTurmaAlunos(r.data || []);
                      } catch { setTurmaAlunos([]); }
                    }
                  }}>
                    <option value="">Selecione turma</option>
                    {[...new Map(profDisciplinas.map(d => [d.turma_id, { id: d.turma_id, nome: d.turma_nome }])).values()].map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Aluno" htmlFor="perfil-falta-aluno">
                  <Select id="perfil-falta-aluno" value={selectedMatricula} onChange={e => setSelectedMatricula(e.target.value)} disabled={!selectedTurma}>
                    <option value="">Selecione aluno</option>
                    {turmaAlunos.map(a => (
                      <option key={a.matricula_id} value={a.matricula_id}>{a.aluno_nome}</option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <div className="form-row">
                <FormField label="Disciplina" htmlFor="perfil-falta-disc">
                  <Select id="perfil-falta-disc" value={selectedDisciplina} onChange={e => setSelectedDisciplina(e.target.value)}>
                    <option value="">Selecione disciplina</option>
                    {profDisciplinas.filter(d => !selectedTurma || String(d.turma_id) === String(selectedTurma)).map(d => (
                      <option key={d.disciplina_id} value={d.disciplina_id}>{d.disciplina_nome} — {d.turma_nome}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Data da falta" htmlFor="perfil-falta-data">
                  <Input id="perfil-falta-data" type="date" value={dataFalta} onChange={e => setDataFalta(e.target.value)} />
                </FormField>
              </div>
              <FormField label="Justificativa / Observação (opcional)" htmlFor="perfil-falta-just">
                <Input id="perfil-falta-just" value={justificativaFalta} onChange={e => setJustificativaFalta(e.target.value)} />
              </FormField>
              {faltaMsg && <div className="alert alert-info">{faltaMsg}</div>}
              <div className="perfil-acoes">
                <Button variant="primary" loading={faltaSaving} onClick={registarFalta}>
                  {faltaSaving ? 'A processar...' : 'Registar falta'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
