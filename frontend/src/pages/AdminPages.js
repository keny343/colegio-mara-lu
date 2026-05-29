import React, { useEffect, useState } from 'react';
import { Users, BookOpen, Plus, Edit2, Trash2, X, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// ===== USUÁRIOS =====
export function AdminUsuarios() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(null); // user object
  const [form, setForm] = useState({ nome: '', bi: '', email: '', telefone: '', role: 'professor' });
  const [editForm, setEditForm] = useState({ nome: '', email: '', telefone: '', role: 'professor', ativo: true });
  const [coordModal, setCoordModal] = useState(null);
  const [coordForm, setCoordForm] = useState({ tipo: '1_ciclo', curso_id: '', manter_professor: true });
  const [cursos, setCursos] = useState([]);
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);

  const carregar = () => {
    const url = isAdmin ? '/admin/usuarios' : '/staff/equipa';
    api.get(url).then(r => setUsuarios(r.data || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    carregar();
    api.get('/staff/cursos').then(r => setCursos(r.data)).catch(() => {});
  }, [isAdmin]);

  const abrirNovo = () => {
    setErro('');
    setForm({ nome: '', bi: '', email: '', telefone: '', role: 'professor' });
    setModal(true);
  };

  const abrirEditar = (u) => {
    setErro('');
    setEditModal(u);
    setEditForm({
      nome: u.nome || '',
      email: u.email || '',
      telefone: u.telefone || '',
      role: u.role || 'professor',
      ativo: !!u.ativo,
    });
  };

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    setSaving(true);
    try {
      await api.post('/admin/usuarios', {
        ...form,
        bi: (form.bi || '').trim(),
        email: (form.email || '').trim() || undefined,
        nome: (form.nome || '').trim(),
      });
      setModal(false);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao criar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const salvarEdicao = async (e) => {
    e.preventDefault();
    if (!editModal?.id) return;
    setErro('');
    setSaving(true);
    try {
      await api.put(`/admin/usuarios/${editModal.id}`, {
        nome: (editForm.nome || '').trim(),
        email: (editForm.email || '').trim(),
        telefone: (editForm.telefone || '').trim(),
        role: editForm.role,
        ativo: editForm.ativo,
      });
      setEditModal(null);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao atualizar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const tipoPadraoCoord = () => {
    if (user?.curso_coordenado) return 'curso';
    if (user?.nivel_coordenado?.includes('2')) return '2_ciclo';
    if (user?.nivel_coordenado) return '1_ciclo';
    return '1_ciclo';
  };

  const abrirCoordenador = (u) => {
    setErro('');
    setCoordModal(u);
    const temCoord = u.curso_coordenado || u.nivel_coordenado;
    const tipoInicial = isAdmin
      ? (u.curso_coordenado ? 'curso' : u.nivel_coordenado?.includes('2') ? '2_ciclo' : temCoord ? '1_ciclo' : '1_ciclo')
      : tipoPadraoCoord();
    const cursoMatch = user?.curso_coordenado
      ? cursos.find(c => c.nome === user.curso_coordenado)
      : null;
    setCoordForm({
      tipo: tipoInicial,
      curso_id: cursoMatch?.id ? String(cursoMatch.id) : '',
      manter_professor: u.role === 'professor',
    });
  };

  const salvarCoordenador = async () => {
    if (!coordModal?.id) return;
    setSaving(true);
    setErro('');
    try {
      const body = { tipo: coordForm.tipo, manter_role_professor: coordForm.manter_professor };
      if (coordForm.tipo === 'curso') {
        if (coordForm.curso_id) body.curso_id = coordForm.curso_id;
        else if (!isAdmin && user?.curso_coordenado) body.curso_nome = user.curso_coordenado;
      }
      const coordUrl = isAdmin
        ? `/admin/usuarios/${coordModal.id}/coordenador`
        : `/staff/usuarios/${coordModal.id}/coordenador`;
      await api.patch(coordUrl, body);
      setCoordModal(null);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao designar coordenador.');
    } finally {
      setSaving(false);
    }
  };

  const removerCoordenador = async () => {
    if (!coordModal?.id) return;
    setSaving(true);
    try {
      await api.patch(`/admin/usuarios/${coordModal.id}/coordenador`, { tipo: 'remover' });
      // remoção só pelo administrador
      setCoordModal(null);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao remover coordenação.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (u) => {
    if (!u?.id) return;
    setSaving(true);
    setErro('');
    try {
      await api.put(`/admin/usuarios/${u.id}`, { ativo: !u.ativo });
      carregar();
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao atualizar status.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>{isAdmin ? 'Usuários' : 'Equipa — designar coordenação'}</h2>
          <p style={{ color: 'var(--cinza)' }}>
            {isAdmin
              ? `${usuarios.length} usuário(s) registrado(s)`
              : 'Designe professores como coordenadores do seu ciclo ou curso (para alterar notas já lançadas).'}
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={abrirNovo}><Plus size={18} /> Novo usuário</button>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>BI</th>
                <th>Tipo</th>
                <th>Cadastro</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--cinza)', fontSize: '0.85rem' }}>#{u.id}</td>
                  <td><strong>{u.nome}</strong></td>
                  <td>{u.email}</td>
                  <td>{u.telefone || '—'}</td>
                  <td>{u.cpf || '—'}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-aprovada' : u.role === 'coordenador' ? 'badge-em_analise' : 'badge-pendente'}`}>
                      {u.role === 'admin' ? '🔑 Admin' : u.role === 'coordenador' ? '🧩 Coordenador' : u.role === 'professor' ? '📚 Professor' : '🎓 Aluno'}
                    </span>
                    {(u.curso_coordenado || u.nivel_coordenado) && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--cinza)', display: 'block', marginTop: 4 }}>
                        {u.nivel_coordenado || u.curso_coordenado}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{new Date(u.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <span className={`badge ${u.ativo ? 'badge-aprovada' : 'badge-cancelada'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {isAdmin && (
                        <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(u)} title="Editar">
                          <Edit2 size={14} />
                        </button>
                      )}
                      {isAdmin && ['professor', 'coordenador'].includes(u.role) && (
                        <button className="btn btn-sm btn-primary" type="button" onClick={() => abrirCoordenador(u)} title="Designar coordenador">
                          Coord.
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          className={`btn btn-sm ${u.ativo ? 'btn-outline' : 'btn-primary'}`}
                          onClick={() => toggleAtivo(u)}
                          title={u.ativo ? 'Desativar' : 'Ativar'}
                          disabled={saving}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {u.ativo ? <ToggleLeft size={14} /> : <ToggleRight size={14} />} {u.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Novo usuário</h3>
              <button className="modal-close" onClick={() => setModal(false)}><X size={18} /></button>
            </div>
            {erro && <div className="alert alert-error">{erro}</div>}
            <form onSubmit={salvar}>
              <div className="form-group">
                <label className="form-label">Nome completo *</label>
                <input className="form-control" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">BI *</label>
                  <input className="form-control" value={form.bi} onChange={e => setForm({ ...form, bi: e.target.value })} required />
                  <div style={{ fontSize: '0.8rem', color: 'var(--cinza)', marginTop: 6 }}>
                    Senha inicial será o próprio BI.
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Perfil *</label>
                  <select className="form-control form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    <option value="professor">Professor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div style={{ fontSize: '0.8rem', color: 'var(--cinza)', marginTop: 6 }}>
                    Coordenadores são designados depois, no botão &quot;Coord.&quot;
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">E-mail (opcional)</label>
                  <input className="form-control" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Se vazio, será gerado automaticamente" />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input className="form-control" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="+244 9xx xxx xxx" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Salvando...' : <><Save size={16} /> Criar usuário</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {coordModal && (
        <div className="modal-overlay" onClick={() => setCoordModal(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Designar coordenador — {coordModal.nome}</h3>
              <button className="modal-close" onClick={() => setCoordModal(null)}><X size={18} /></button>
            </div>
            {erro && <div className="alert alert-error">{erro}</div>}
            <p style={{ fontSize: '0.88rem', color: 'var(--cinza)', marginBottom: '1rem', lineHeight: 1.5 }}>
              O coordenador verifica inscrições e altera notas lançadas pelos professores no ciclo ou curso seleccionado.
            </p>
            <div className="form-group">
              <label className="form-label">Âmbito da coordenação *</label>
              {isAdmin ? (
                <select className="form-control form-select" value={coordForm.tipo} onChange={e => setCoordForm({ ...coordForm, tipo: e.target.value })}>
                  <option value="1_ciclo">1º ciclo (Pré-escolar até 6ª classe)</option>
                  <option value="2_ciclo">2º ciclo (7ª até 9ª classe)</option>
                  <option value="curso">Coordenador de curso (10ª classe em diante)</option>
                </select>
              ) : (
                <p className="form-control" style={{ background: 'var(--bege-claro)' }}>
                  {coordForm.tipo === 'curso'
                    ? `Curso: ${user?.curso_coordenado || '—'}`
                    : coordForm.tipo === '2_ciclo'
                      ? '2º ciclo (7ª–9ª classe)'
                      : '1º ciclo (Pré-escolar–6ª classe)'}
                </p>
              )}
            </div>
            {coordForm.tipo === 'curso' && (
              <div className="form-group">
                <label className="form-label">Curso *</label>
                {isAdmin ? (
                <select className="form-control form-select" value={coordForm.curso_id} onChange={e => setCoordForm({ ...coordForm, curso_id: e.target.value })}>
                  <option value="">Selecionar curso...</option>
                  {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                ) : (
                  <p className="form-control" style={{ background: 'var(--bege-claro)' }}>{user?.curso_coordenado || '—'}</p>
                )}
                <p style={{ fontSize: '0.8rem', color: 'var(--cinza)', marginTop: 6 }}>
                  Aplica-se às turmas desse curso (10ª–13ª ou 10ª–12ª, conforme o curso).
                </p>
              </div>
            )}
            {coordModal.role === 'professor' && (
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={coordForm.manter_professor} onChange={e => setCoordForm({ ...coordForm, manter_professor: e.target.checked })} />
                  Manter também como professor (recomendado se lecciona)
                </label>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline" onClick={() => setCoordModal(null)}>Cancelar</button>
              {isAdmin && (coordModal.curso_coordenado || coordModal.nivel_coordenado) && (
                <button type="button" className="btn btn-danger" onClick={removerCoordenador} disabled={saving}>Remover coordenação</button>
              )}
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={salvarCoordenador} disabled={saving || (coordForm.tipo === 'curso' && !coordForm.curso_id)}>
                {saving ? 'A guardar...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Editar usuário</h3>
              <button className="modal-close" onClick={() => setEditModal(null)}><X size={18} /></button>
            </div>
            {erro && <div className="alert alert-error">{erro}</div>}
            <div className="alert alert-info">
              BI (login): <strong>{editModal.cpf || '—'}</strong> • Senha inicial: <strong>BI</strong>
            </div>
            <form onSubmit={salvarEdicao}>
              <div className="form-group">
                <label className="form-label">Nome completo</label>
                <input className="form-control" value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">E-mail</label>
                  <input className="form-control" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input className="form-control" value={editForm.telefone} onChange={e => setEditForm({ ...editForm, telefone: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Perfil</label>
                  <select className="form-control form-select" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} disabled={editModal?.role === 'coordenador'}>
                    <option value="aluno">Aluno</option>
                    <option value="professor">Professor</option>
                    <option value="admin">Admin</option>
                  </select>
                  {editModal?.role === 'coordenador' && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--cinza)', marginTop: 6 }}>Use &quot;Coord.&quot; para alterar a coordenação.</div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control form-select" value={editForm.ativo ? '1' : '0'} onChange={e => setEditForm({ ...editForm, ativo: e.target.value === '1' })}>
                    <option value="1">Ativo</option>
                    <option value="0">Inativo</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Salvando...' : <><Save size={16} /> Salvar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== SÉRIES =====
const formSerieVazio = { nome: '', nivel: '', vagas_total: 30, ano_letivo: new Date().getFullYear() + 1 };

export function AdminSeries() {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formSerieVazio);
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);

  const carregar = () => {
    api.get('/series').then(r => setSeries(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => { setEditando(null); setForm(formSerieVazio); setErro(''); setModal(true); };
  const abrirEditar = (s) => { setEditando(s.id); setForm({ nome: s.nome, nivel: s.nivel, vagas_total: s.vagas_total, ano_letivo: s.ano_letivo }); setErro(''); setModal(true); };

  const salvar = async e => {
    e.preventDefault();
    if (!form.nome || !form.nivel) return setErro('Nome e nível são obrigatórios.');
    setSaving(true); setErro('');
    try {
      if (editando) await api.put(`/admin/series/${editando}`, form);
      else await api.post('/admin/series', form);
      setModal(false); carregar();
    } catch (err) { setErro(err.response?.data?.message || 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const excluir = async (id) => {
    if (!window.confirm('Desativar esta série?')) return;
    await api.delete(`/admin/series/${id}`).catch(() => {});
    carregar();
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const niveis = [...new Set(series.map(s => s.nivel))];

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Séries e Vagas</h2>
          <p style={{ color: 'var(--cinza)' }}>Gerencie as séries disponíveis para inscrição</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNovo}><Plus size={18} /> Nova Série</button>
      </div>

      {niveis.map(nivel => (
        <div key={nivel} style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--castanho-medio)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} /> {nivel}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {series.filter(s => s.nivel === nivel).map(s => {
              const pct = Math.round(((s.vagas_total - s.vagas_disponiveis) / s.vagas_total) * 100);
              return (
                <div key={s.id} className="card" style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h4 style={{ fontSize: '1.05rem', color: 'var(--castanho)' }}>{s.nome}</h4>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(s)}><Edit2 size={12} /></button>
                      <button className="btn btn-sm btn-danger" onClick={() => excluir(s.id)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--cinza)', marginBottom: 12 }}>
                    Ano Letivo: <strong>{s.ano_letivo}</strong>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                      <span style={{ color: 'var(--cinza)' }}>Ocupação</span>
                      <span style={{ fontWeight: 600 }}>{s.vagas_total - s.vagas_disponiveis}/{s.vagas_total}</span>
                    </div>
                    <div style={{ height: 8, background: '#F0E4D7', borderRadius: 4 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? 'var(--vermelho)' : pct > 50 ? 'var(--amarelo)' : 'var(--verde)', borderRadius: 4 }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: pct >= 100 ? 'var(--vermelho)' : 'var(--verde)', fontWeight: 600 }}>
                    {s.vagas_disponiveis > 0 ? `${s.vagas_disponiveis} vagas disponíveis` : 'Sem vagas'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editando ? 'Editar Série' : 'Nova Série'}</h3>
              <button className="modal-close" onClick={() => setModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={salvar}>
              {erro && <div className="alert alert-error">{erro}</div>}
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input name="nome" className="form-control" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: 1º Ano" required />
              </div>
              <div className="form-group">
                <label className="form-label">Nível *</label>
                <select className="form-control form-select" value={form.nivel} onChange={e => setForm({ ...form, nivel: e.target.value })} required>
                  <option value="">Selecionar...</option>
                  <option>Ensino Primário (pré até 6ª)</option>
                  <option>I Ciclo (Ensino Secundário 7ª–9ª)</option>
                  <option>II Ciclo (Ensino Secundário 10ª–13ª)</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Total de Vagas</label>
                  <input type="number" className="form-control" value={form.vagas_total} onChange={e => setForm({ ...form, vagas_total: e.target.value })} min={1} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ano Letivo</label>
                  <input type="number" className="form-control" value={form.ano_letivo} onChange={e => setForm({ ...form, ano_letivo: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Salvando...' : editando ? 'Salvar' : 'Criar Série'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

