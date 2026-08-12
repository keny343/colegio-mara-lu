import React, { useEffect, useState } from 'react';
import { BookOpen, Plus, Edit2, Trash2, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useNotification } from '../contexts/NotificationContext';
import { Badge, Button, ErrorState, FormField, Input, LoadingState, Modal, Select } from '../components/ui';
import './AdminPages.css';

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
  const [erroCarregar, setErroCarregar] = useState(null);
  const [saving, setSaving] = useState(false);
  const { error: notifyError } = useNotification();

  const carregar = () => {
    const url = isAdmin ? '/admin/usuarios' : '/staff/equipa';
    setLoading(true);
    setErroCarregar(null);
    api.get(url)
      .then(r => setUsuarios(r.data || []))
      .catch(err => setErroCarregar(err))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    carregar();
    api.get('/staff/cursos').then(r => setCursos(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (loading) return <LoadingState />;
  if (erroCarregar) return <ErrorState error={erroCarregar} onRetry={carregar} />;

  const roleBadge = (r) => (
    r === 'admin' ? <Badge tone="red">🔑 Admin</Badge> :
    r === 'coordenador' ? <Badge tone="yellow">🧩 Coordenador</Badge> :
    r === 'professor' ? <Badge tone="blue">📚 Professor</Badge> :
    <Badge tone="gray">🎓 Aluno</Badge>
  );

  return (
    <div className="page-container">
      <div className="page-header ap-header">
        <div>
          <h2>{isAdmin ? 'Usuários' : 'Equipa — designar coordenação'}</h2>
          <p className="ap-subtitle">
            {isAdmin
              ? `${usuarios.length} usuário(s) registrado(s)`
              : 'Designe professores como coordenadores do seu ciclo ou curso (para alterar notas já lançadas).'}
          </p>
        </div>
        {isAdmin && (
          <Button variant="primary" icon={<Plus size={18} />} onClick={abrirNovo}>Novo usuário</Button>
        )}
      </div>

      <div className="card ap-tabela-card">
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
                  <td className="ap-id" data-label="#">#{u.id}</td>
                  <td data-label="Nome"><strong>{u.nome}</strong></td>
                  <td data-label="E-mail">{u.email}</td>
                  <td data-label="Telefone">{u.telefone || '—'}</td>
                  <td data-label="BI">{u.cpf || '—'}</td>
                  <td data-label="Tipo">
                    {roleBadge(u.role)}
                    {(u.curso_coordenado || u.nivel_coordenado) && (
                      <div className="ap-coord-info">{u.nivel_coordenado || u.curso_coordenado}</div>
                    )}
                  </td>
                  <td className="ap-data" data-label="Cadastro">{new Date(u.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td data-label="Status">
                    <Badge tone={u.ativo ? 'green' : 'red'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </td>
                  <td className="td-actions" data-label="Ações">
                    <div className="ap-acoes">
                      {isAdmin && (
                        <Button variant="outline" size="sm" icon={<Edit2 size={14} />} onClick={() => abrirEditar(u)} aria-label="Editar" />
                      )}
                      {isAdmin && ['professor', 'coordenador'].includes(u.role) && (
                        <Button variant="primary" size="sm" type="button" onClick={() => abrirCoordenador(u)} title="Designar coordenador">
                          Coord.
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          variant={u.ativo ? 'outline' : 'primary'}
                          size="sm"
                          icon={u.ativo ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                          onClick={() => toggleAtivo(u)}
                          disabled={saving}
                          className="ap-toggle"
                        >
                          {u.ativo ? 'Desativar' : 'Ativar'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Novo usuário" size="md">
        {erro && <div className="alert alert-error">{erro}</div>}
        <form onSubmit={salvar}>
          <FormField label="Nome completo *" htmlFor="us-nome" required>
            <Input id="us-nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
          </FormField>
          <div className="form-row">
            <FormField label="BI *" htmlFor="us-bi" hint="Senha inicial será o próprio BI." required>
              <Input id="us-bi" value={form.bi} onChange={e => setForm({ ...form, bi: e.target.value })} required />
            </FormField>
            <FormField label="Perfil *" htmlFor="us-role" hint="Coordenadores são designados depois, no botão &quot;Coord.&quot;" required>
              <Select id="us-role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="professor">Professor</option>
                <option value="admin">Admin</option>
              </Select>
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="E-mail (opcional)" htmlFor="us-email">
              <Input id="us-email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Se vazio, será gerado automaticamente" />
            </FormField>
            <FormField label="Telefone" htmlFor="us-telefone">
              <Input id="us-telefone" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="+244 9xx xxx xxx" />
            </FormField>
          </div>
          <div className="ap-modal-acoes">
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" block icon={<Save size={16} />} loading={saving}>
              {saving ? 'Salvando...' : 'Criar usuário'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!coordModal} onClose={() => setCoordModal(null)} title={coordModal ? `Designar coordenador — ${coordModal.nome}` : ''} size="md">
        {erro && <div className="alert alert-error">{erro}</div>}
        <p className="ap-coord-desc">
          O coordenador verifica inscrições e altera notas lançadas pelos professores no ciclo ou curso seleccionado.
        </p>
        <FormField label="Âmbito da coordenação *" htmlFor="coord-tipo">
          {isAdmin ? (
            <Select id="coord-tipo" value={coordForm.tipo} onChange={e => setCoordForm({ ...coordForm, tipo: e.target.value })}>
              <option value="1_ciclo">1º ciclo (Pré-escolar até 6ª classe)</option>
              <option value="2_ciclo">2º ciclo (7ª até 9ª classe)</option>
              <option value="curso">Coordenador de curso (10ª classe em diante)</option>
            </Select>
          ) : (
            <p className="ap-coord-fixo">
              {coordForm.tipo === 'curso'
                ? `Curso: ${user?.curso_coordenado || '—'}`
                : coordForm.tipo === '2_ciclo'
                  ? '2º ciclo (7ª–9ª classe)'
                  : '1º ciclo (Pré-escolar–6ª classe)'}
            </p>
          )}
        </FormField>
        {coordForm.tipo === 'curso' && (
          <FormField label="Curso *" htmlFor="coord-curso" hint="Aplica-se às turmas desse curso (10ª–13ª ou 10ª–12ª, conforme o curso).">
            {isAdmin ? (
              <Select id="coord-curso" value={coordForm.curso_id} onChange={e => setCoordForm({ ...coordForm, curso_id: e.target.value })}>
                <option value="">Selecionar curso...</option>
                {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            ) : (
              <p className="ap-coord-fixo">{user?.curso_coordenado || '—'}</p>
            )}
          </FormField>
        )}
        {coordModal?.role === 'professor' && (
          <div className="form-group">
            <label className="ap-checkbox-label">
              <input type="checkbox" checked={coordForm.manter_professor} onChange={e => setCoordForm({ ...coordForm, manter_professor: e.target.checked })} />
              Manter também como professor (recomendado se lecciona)
            </label>
          </div>
        )}
        <div className="ap-modal-acoes ap-modal-acoes--wrap">
          <Button variant="outline" onClick={() => setCoordModal(null)}>Cancelar</Button>
          {isAdmin && (coordModal?.curso_coordenado || coordModal?.nivel_coordenado) && (
            <Button variant="danger" onClick={removerCoordenador} disabled={saving}>Remover coordenação</Button>
          )}
          <Button variant="primary" block onClick={salvarCoordenador} disabled={saving || (coordForm.tipo === 'curso' && !coordForm.curso_id)} loading={saving}>
            {saving ? 'A guardar...' : 'Confirmar'}
          </Button>
        </div>
      </Modal>

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar usuário" size="md">
        {erro && <div className="alert alert-error">{erro}</div>}
        <div className="alert alert-info">
          BI (login): <strong>{editModal?.cpf || '—'}</strong> • Senha inicial: <strong>BI</strong>
        </div>
        <form onSubmit={salvarEdicao}>
          <FormField label="Nome completo" htmlFor="ed-nome">
            <Input id="ed-nome" value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} />
          </FormField>
          <div className="form-row">
            <FormField label="E-mail" htmlFor="ed-email">
              <Input id="ed-email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            </FormField>
            <FormField label="Telefone" htmlFor="ed-telefone">
              <Input id="ed-telefone" value={editForm.telefone} onChange={e => setEditForm({ ...editForm, telefone: e.target.value })} />
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="Perfil" htmlFor="ed-role" hint={editModal?.role === 'coordenador' ? 'Use "Coord." para alterar a coordenação.' : undefined}>
              <Select id="ed-role" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} disabled={editModal?.role === 'coordenador'}>
                <option value="aluno">Aluno</option>
                <option value="professor">Professor</option>
                <option value="admin">Admin</option>
              </Select>
            </FormField>
            <FormField label="Status" htmlFor="ed-ativo">
              <Select id="ed-ativo" value={editForm.ativo ? '1' : '0'} onChange={e => setEditForm({ ...editForm, ativo: e.target.value === '1' })}>
                <option value="1">Ativo</option>
                <option value="0">Inativo</option>
              </Select>
            </FormField>
          </div>
          <div className="ap-modal-acoes">
            <Button variant="outline" onClick={() => setEditModal(null)}>Cancelar</Button>
            <Button type="submit" variant="primary" block icon={<Save size={16} />} loading={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>
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
  const [erroCarregar, setErroCarregar] = useState(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  const { error: notifyError } = useNotification();

  const carregar = () => {
    setLoading(true);
    setErroCarregar(null);
    api.get('/series')
      .then(r => setSeries(r.data))
      .catch(err => setErroCarregar(err))
      .finally(() => setLoading(false));
  };
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => { setEditando(null); setForm(formSerieVazio); setErro(''); setModal(true); };
  const abrirEditar = (s) => { setEditando(s.id); setForm({ nome: s.nome, nivel: s.nivel, vagas_total: s.vagas_total, ano_letivo: s.ano_letivo, updated_at: s.updated_at }); setErro(''); setModal(true); };

  const salvar = async e => {
    e.preventDefault();
    if (!form.nome || !form.nivel) return setErro('Nome e nível são obrigatórios.');
    setSaving(true); setErro('');
    try {
      if (editando) await api.put(`/admin/series/${editando}`, form);
      else await api.post('/admin/series', form);
      setModal(false); carregar();
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao salvar.');
      if (err.response?.status === 409) { setModal(false); carregar(); }
    }
    finally { setSaving(false); }
  };

  const excluir = async (id) => {
    const ok = await confirm({
      title: 'Desactivar série',
      message: 'Tem a certeza que deseja desactivar esta série? Novas inscrições deixarão de aceitar esta classe.',
      confirmLabel: 'Desactivar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/series/${id}`);
      carregar();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erro ao desactivar série.');
    }
  };

  if (loading) return <LoadingState />;
  if (erroCarregar) return <ErrorState error={erroCarregar} onRetry={carregar} />;

  const niveis = [...new Set(series.map(s => s.nivel))];

  return (
    <div className="page-container">
      <div className="page-header ap-header">
        <div>
          <h2>Classes e Vagas</h2>
          <p className="ap-subtitle">Gerencie as classes disponíveis para inscrição</p>
        </div>
        <Button variant="primary" icon={<Plus size={18} />} onClick={abrirNovo}>Nova Classe</Button>
      </div>

      {niveis.map(nivel => (
        <div key={nivel} className="ap-nivel">
          <h3 className="ap-nivel-titulo">
            <BookOpen size={16} /> {nivel}
          </h3>
          <div className="ap-serie-grid">
            {series.filter(s => s.nivel === nivel).map(s => {
              const pct = Math.round(((s.vagas_total - s.vagas_disponiveis) / s.vagas_total) * 100);
              return (
                <div key={s.id} className="card ap-serie-card">
                  <div className="ap-serie-topo">
                    <h4 className="ap-serie-nome">{s.nome}</h4>
                    <div className="ap-serie-acoes">
                      <Button variant="outline" size="sm" icon={<Edit2 size={12} />} onClick={() => abrirEditar(s)} aria-label="Editar" />
                      <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => excluir(s.id)} aria-label="Desactivar" />
                    </div>
                  </div>
                  <div className="ap-serie-ano">Ano Letivo: <strong>{s.ano_letivo}</strong></div>
                  <div className="ap-ocupacao">
                    <div className="ap-ocupacao-topo">
                      <span className="ap-ocupacao-label">Ocupação</span>
                      <span className="ap-ocupacao-valor">{s.vagas_total - s.vagas_disponiveis}/{s.vagas_total}</span>
                    </div>
                    <div className="ap-ocupacao-barra">
                      <div
                        className="ap-ocupacao-preenchida"
                        style={{
                          width: `${pct}%`,
                          background: pct > 80 ? 'var(--vermelho)' : pct > 50 ? 'var(--amarelo)' : 'var(--verde)',
                        }}
                      />
                    </div>
                  </div>
                  <div className="ap-ocupacao-status" style={{ color: pct >= 100 ? 'var(--vermelho)' : 'var(--verde)' }}>
                    {s.vagas_disponiveis > 0 ? `${s.vagas_disponiveis} vagas disponíveis` : 'Sem vagas'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Classe' : 'Nova Classe'} size="sm">
        <form onSubmit={salvar}>
          {erro && <div className="alert alert-error">{erro}</div>}
          <FormField label="Nome *" htmlFor="ser-nome" required>
            <Input id="ser-nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: 1º Ano" required />
          </FormField>
          <FormField label="Nível *" htmlFor="ser-nivel" required>
            <Select id="ser-nivel" value={form.nivel} onChange={e => setForm({ ...form, nivel: e.target.value })} required>
              <option value="">Selecionar...</option>
              <option>Ensino Primário (pré até 6ª)</option>
              <option>I Ciclo (Ensino Secundário 7ª–9ª)</option>
              <option>II Ciclo (Ensino Secundário 10ª–13ª)</option>
            </Select>
          </FormField>
          <div className="form-row">
            <FormField label="Total de Vagas" htmlFor="ser-vagas">
              <Input id="ser-vagas" type="number" value={form.vagas_total} onChange={e => setForm({ ...form, vagas_total: e.target.value })} min={1} />
            </FormField>
            <FormField label="Ano Letivo" htmlFor="ser-ano">
              <Input id="ser-ano" type="number" value={form.ano_letivo} onChange={e => setForm({ ...form, ano_letivo: e.target.value })} />
            </FormField>
          </div>
          <div className="ap-modal-acoes">
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" block loading={saving}>
              {saving ? 'Salvando...' : editando ? 'Salvar' : 'Criar Classe'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
