import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Save, CheckCircle, GraduationCap, Shield, Camera, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { normalizeSeriesName } from '../utils/serieName';
import { temEscopoCoordenacao } from '../utils/roles';
import { urlFoto } from '../utils/userPhoto';

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
        <h2>O meu perfil</h2>
        <p>{subtitulo()}</p>
      </div>

      {erro && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{erro}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* Card avatar */}
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={onFotoPerfil}
          />
          <button
            type="button"
            onClick={() => fotoInputRef.current?.click()}
            disabled={uploadingFoto}
            title="Clique para escolher a sua fotografia"
            style={{
              width: 90, height: 90, borderRadius: '50%',
              margin: '0 auto 1.25rem', padding: 0, border: '3px solid var(--laranja)',
              cursor: 'pointer', overflow: 'hidden', position: 'relative', display: 'block',
              background: foto ? 'transparent' : 'linear-gradient(135deg, var(--castanho), var(--castanho-medio))',
            }}
          >
            {foto ? (
              <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '100%', fontSize: '2rem', color: 'white',
                fontFamily: 'Playfair Display, serif', fontWeight: 700,
              }}>
                {(user?.nome || '?').charAt(0).toUpperCase()}
              </span>
            )}
            <span style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            }}>
              <Camera size={22} />
            </span>
          </button>
          {uploadingFoto && (
            <p style={{ fontSize: '0.82rem', color: 'var(--cinza)', marginTop: -8, marginBottom: '1rem' }}>
              A carregar fotografia...
            </p>
          )}
          <h3 style={{ fontSize: '1.3rem', marginBottom: 4 }}>{user?.nome}</h3>
          <p style={{ color: 'var(--cinza)', fontSize: '0.9rem', marginBottom: '1rem' }}>{user?.email}</p>
          <span className="badge" style={{ background: 'var(--laranja-suave)', color: 'var(--laranja)', fontWeight: 700 }}>
            {roleLabel()}
          </span>
          {escopo && (
            <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--castanho-medio)' }}>
              <Shield size={14} style={{ verticalAlign: 'middle' }} /> Âmbito: {escopo}
            </p>
          )}

          {/* NOVO: resumo da situação académica no card do avatar (apenas para alunos) */}
          {isAluno && (inscricao || matricula) && (
            <div style={{ marginTop: '1.5rem', textAlign: 'left', borderTop: '1px solid var(--bege)', paddingTop: '1.25rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--castanho-medio)', marginBottom: 10, letterSpacing: '0.05em' }}>
                Situação Académica
              </p>
              {inscricao && (
                <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
                  <span style={{ color: 'var(--cinza)' }}>Classe: </span>
                  <strong>{normalizeSeriesName(inscricao.serie_nome)}</strong>
                </div>
              )}
              {matricula && (
                <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
                  <span style={{ color: 'var(--cinza)' }}>Turma: </span>
                  <strong>{matricula.turma_nome}</strong>
                </div>
              )}
              {matricula && (
                <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
                  <span style={{ color: 'var(--cinza)' }}>Turno: </span>
                  <strong>{matricula.turno}</strong>
                </div>
              )}
              {inscricao && (
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--cinza)' }}>Ano Letivo: </span>
                  <strong>{inscricao.inscricao_ano || matricula?.ano_letivo}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card dados */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            {isAluno ? <User size={18} color="var(--laranja)" /> : <GraduationCap size={18} color="var(--laranja)" />}
            {isAluno ? 'Dados do aluno' : 'Dados da conta'}
          </h3>

          {isAluno && (
            aluno ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                  <div key={i} className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{f.label}</label>
                    {f.type === 'select' ? (
                      <select className="form-control form-select" name={f.name} value={f.value} onChange={e => setFormAluno(x => ({ ...x, [e.target.name]: e.target.value }))}>
                        <option value="">—</option>
                        {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    ) : (
                      <input className="form-control" type={f.type || 'text'} name={f.name} value={f.value} onChange={e => setFormAluno(x => ({ ...x, [e.target.name]: e.target.value }))} />
                    )}
                  </div>
                ))}
                <button type="button" className="btn btn-primary btn-full" onClick={handleSaveAluno} disabled={saving}>
                  {saved ? <><CheckCircle size={16} /> Guardado!</> : <><Save size={16} /> {saving ? 'A guardar...' : 'Guardar alterações'}</>}
                </button>
              </div>
            ) : (
              <p style={{ color: 'var(--cinza)', fontSize: '0.9rem' }}>Ainda não há registo de aluno associado à sua conta.</p>
            )
          )}

          {/* Quick link para justificar faltas (alunos) */}
          {isAluno && (
            <div style={{ marginTop: 12 }}>
              <Link to="/portal/faltas" className="btn btn-outline">Ir para Justificações / Faltas</Link>
            </div>
          )}

          {isStaff && staff && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome completo</label>
                <input className="form-control" value={formStaff.nome} onChange={e => setFormStaff(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">E-mail (login)</label>
                <input className="form-control" value={staff.email || ''} disabled />
              </div>
              {staff.cpf && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">BI / NIF</label>
                  <input className="form-control" value={staff.cpf} disabled />
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Telefone</label>
                <input className="form-control" value={formStaff.telefone || ''} onChange={e => setFormStaff(f => ({ ...f, telefone: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Endereço</label>
                <input className="form-control" value={formStaff.endereco || ''} onChange={e => setFormStaff(f => ({ ...f, endereco: e.target.value }))} />
              </div>
              <button type="button" className="btn btn-primary btn-full" onClick={handleSaveStaff} disabled={saving}>
                {saved ? <><CheckCircle size={16} /> Guardado!</> : <><Save size={16} /> {saving ? 'A guardar...' : 'Guardar alterações'}</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Credenciais (email / senha) - todos os perfis */}
      <div style={{ marginTop: '1.5rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Credenciais</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">E-mail</label>
              <input className="form-control" value={credEmail} onChange={e => setCredEmail(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Senha atual (necessária para alterar senha)</label>
              <input className="form-control" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nova senha</label>
              <input className="form-control" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            {credMsg && <div className="alert alert-info">{credMsg}</div>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={async () => {
                setCredSaving(true); setCredMsg('');
                try {
                  const payload = { email: credEmail };
                  if (newPassword) payload.nova_senha = newPassword;
                  if (newPassword) payload.current_password = currentPassword;
                  const res = await api.put('/auth/credenciais', payload);
                  if (res.data.usuario) updateUser(res.data.usuario);
                  setCredMsg(res.data.message || 'Credenciais actualizadas.');
                  setCurrentPassword(''); setNewPassword('');
                } catch (err) {
                  setCredMsg(err.response?.data?.message || 'Erro ao actualizar credenciais.');
                } finally { setCredSaving(false); }
              }} disabled={credSaving}>
                {credSaving ? 'A processar...' : 'Guardar credenciais'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Professor: registar falta */}
      {user?.role === 'professor' && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Registar Falta (rápido)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Turma</label>
                  <select className="form-control form-select" value={selectedTurma} onChange={async (e) => {
                    const v = e.target.value; setSelectedTurma(v); setSelectedMatricula(''); setTurmaAlunos([]);
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
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Aluno</label>
                  <select className="form-control form-select" value={selectedMatricula} onChange={e => setSelectedMatricula(e.target.value)} disabled={!selectedTurma}>
                    <option value="">Selecione aluno</option>
                    {turmaAlunos.map(a => (
                      <option key={a.matricula_id} value={a.matricula_id}>{a.aluno_nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Disciplina</label>
                  <select className="form-control form-select" value={selectedDisciplina} onChange={e => setSelectedDisciplina(e.target.value)}>
                    <option value="">Selecione disciplina</option>
                    {profDisciplinas.filter(d => !selectedTurma || String(d.turma_id) === String(selectedTurma)).map(d => (
                      <option key={d.disciplina_id} value={d.disciplina_id}>{d.disciplina_nome} — {d.turma_nome}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Data da falta</label>
                  <input className="form-control" type="date" value={dataFalta} onChange={e => setDataFalta(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Justificativa / Observação (opcional)</label>
                <input className="form-control" value={justificativaFalta} onChange={e => setJustificativaFalta(e.target.value)} />
              </div>
              {faltaMsg && <div className="alert alert-info">{faltaMsg}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary" onClick={async () => {
                  setFaltaSaving(true); setFaltaMsg('');
                  try {
                    if (!selectedMatricula || !selectedDisciplina || !dataFalta) return setFaltaMsg('Preencha turma, aluno, disciplina e data.');
                    await api.post('/professor/faltas', { matricula_id: selectedMatricula, disciplina_id: selectedDisciplina, data_falta: dataFalta, justificativa: justificativaFalta });
                    setFaltaMsg('Falta registada.'); setSelectedMatricula(''); setJustificativaFalta(''); setDataFalta('');
                  } catch (err) {
                    setFaltaMsg(err.response?.data?.message || 'Erro ao registar falta.');
                  } finally { setFaltaSaving(false); }
                }} disabled={faltaSaving}>{faltaSaving ? 'A processar...' : 'Registar falta'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}