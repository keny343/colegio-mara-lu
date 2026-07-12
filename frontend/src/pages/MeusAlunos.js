import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, User, X } from 'lucide-react';
import api from '../services/api';
import { useConfirm } from '../contexts/ConfirmContext';
import { useNotification } from '../contexts/NotificationContext';

const formVazio = { nome: '', data_nascimento: '', cpf: '', rg: '', sexo: '', nacionalidade: '', nome_mae: '', nome_pai: '', responsavel: '', telefone_emergencia: '', necessidades_especiais: '' };

export default function MeusAlunos() {
  const [alunos, setAlunos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio);
  const [erro, setErro] = useState('');
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  const { error: notifyError } = useNotification();

  const carregar = () => {
    api.get('/alunos').then(r => setAlunos(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => { setEditando(null); setForm(formVazio); setErro(''); setModal(true); };
  const abrirEditar = (a) => { setEditando(a.id); setForm({ ...a }); setErro(''); setModal(true); };
  const fechar = () => setModal(false);

  const salvar = async e => {
    e.preventDefault();
    if (!form.nome || !form.data_nascimento) return setErro('Nome e data de nascimento são obrigatórios.');
    setSaving(true); setErro('');
    try {
      if (editando) { await api.put(`/alunos/${editando}`, form); }
      else { await api.post('/alunos', form); }
      fechar(); carregar();
    } catch (err) { setErro(err.response?.data?.message || 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const excluir = async (id) => {
    const ok = await confirm({
      title: 'Remover aluno',
      message: 'Tem a certeza que deseja remover este aluno? Os dados associados serão eliminados.',
      confirmLabel: 'Sim, remover',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/alunos/${id}`);
      carregar();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Erro ao remover aluno.');
    }
  };

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const calcIdade = (nasc) => {
    if (!nasc) return '';
    const diff = Date.now() - new Date(nasc).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)) + ' anos';
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Meus Alunos</h2>
          <p style={{ color: 'var(--cinza)' }}>Cadastre e gerencie os alunos vinculados à sua conta</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNovo}><Plus size={18} /> Novo Aluno</button>
      </div>

      {alunos.length === 0 ? (
        <div className="card empty-state">
          <User size={56} />
          <h3>Nenhum aluno cadastrado</h3>
          <p>Clique em "Novo Aluno" para começar.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {alunos.map(a => (
            <div key={a.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--laranja-suave)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--laranja)', fontWeight: 700, fontSize: '1.2rem' }}>
                    {a.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--castanho)' }}>{a.nome}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--cinza)' }}>{calcIdade(a.data_nascimento)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(a)}><Edit2 size={14} /></button>
                  <button className="btn btn-sm btn-danger" onClick={() => excluir(a.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.85rem', color: 'var(--cinza)' }}>
                {a.sexo && <span>Sexo: <strong>{a.sexo === 'M' ? 'Masculino' : a.sexo === 'F' ? 'Feminino' : 'Outro'}</strong></span>}
                {a.nome_mae && <span>Mãe: <strong>{a.nome_mae}</strong></span>}
                {a.cpf && <span>BI: <strong>{a.cpf}</strong></span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={fechar}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editando ? 'Editar Aluno' : 'Novo Aluno'}</h3>
              <button className="modal-close" onClick={fechar}><X size={18} /></button>
            </div>
            <form onSubmit={salvar}>
              {erro && <div className="alert alert-error">{erro}</div>}
              <div className="form-group">
                <label className="form-label">Nome Completo *</label>
                <input name="nome" className="form-control" value={form.nome} onChange={handleChange} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Data de Nascimento *</label>
                  <input name="data_nascimento" type="date" className="form-control" value={form.data_nascimento?.slice(0,10)} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Sexo</label>
                  <select name="sexo" className="form-control form-select" value={form.sexo} onChange={handleChange}>
                    <option value="">Selecionar</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">BI / Cédula</label>
                  <input name="cpf" className="form-control" value={form.cpf} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">RG</label>
                  <input name="rg" className="form-control" value={form.rg} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Nacionalidade</label>
                <input name="nacionalidade" className="form-control" value={form.nacionalidade || ''} onChange={handleChange} placeholder="Ex: Angolana" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nome da Mãe</label>
                  <input name="nome_mae" className="form-control" value={form.nome_mae} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nome do Pai</label>
                  <input name="nome_pai" className="form-control" value={form.nome_pai} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Responsável</label>
                  <input name="responsavel" className="form-control" value={form.responsavel} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tel. Emergência</label>
                  <input name="telefone_emergencia" className="form-control" value={form.telefone_emergencia} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Necessidades Especiais</label>
                <textarea name="necessidades_especiais" className="form-control" rows={2} value={form.necessidades_especiais} onChange={handleChange} placeholder="Descreva se houver..." />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Cadastrar Aluno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
