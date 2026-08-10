import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, User } from 'lucide-react';
import api from '../services/api';
import { useConfirm } from '../contexts/ConfirmContext';
import { useNotification } from '../contexts/NotificationContext';
import { Button, EmptyState, FormField, Input, Modal, Select, Textarea, LoadingState } from '../components/ui';
import './MeusAlunos.css';

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

  if (loading) return <LoadingState />;

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div>
          <h2>Meus Alunos</h2>
          <p>Cadastre e gerencie os alunos vinculados à sua conta</p>
        </div>
        <Button variant="primary" icon={<Plus size={18} />} onClick={abrirNovo}>Novo Aluno</Button>
      </div>

      {alunos.length === 0 ? (
        <div className="card">
          <EmptyState icon={<User size={56} />} title="Nenhum aluno cadastrado" message='Clique em "Novo Aluno" para começar.' />
        </div>
      ) : (
        <div className="aluno-grid">
          {alunos.map(a => (
            <div key={a.id} className="card aluno-card">
              <div className="aluno-head">
                <div className="aluno-ident">
                  <div className="aluno-avatar">{a.nome.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="aluno-nome">{a.nome}</div>
                    <div className="aluno-sub">{calcIdade(a.data_nascimento)}</div>
                  </div>
                </div>
                <div className="aluno-acoes">
                  <Button variant="outline" size="sm" icon={<Edit2 size={14} />} onClick={() => abrirEditar(a)} aria-label="Editar aluno" />
                  <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => excluir(a.id)} aria-label="Remover aluno" />
                </div>
              </div>
              <div className="aluno-dados">
                {a.sexo && <span>Sexo: <strong>{a.sexo === 'M' ? 'Masculino' : a.sexo === 'F' ? 'Feminino' : 'Outro'}</strong></span>}
                {a.nome_mae && <span>Mãe: <strong>{a.nome_mae}</strong></span>}
                {a.cpf && <span>BI: <strong>{a.cpf}</strong></span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal}
        onClose={fechar}
        title={editando ? 'Editar Aluno' : 'Novo Aluno'}
        footer={
          <div className="modal-actions">
            <Button variant="outline" onClick={fechar}>Cancelar</Button>
            <Button type="submit" form="aluno-form" variant="primary" block loading={saving}>
              {saving ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Cadastrar Aluno'}
            </Button>
          </div>
        }
      >
        <form id="aluno-form" onSubmit={salvar}>
          {erro && <div className="alert alert-error modal-erro">{erro}</div>}
          <FormField label="Nome Completo *" htmlFor="aluno-nome" required>
            <Input id="aluno-nome" name="nome" value={form.nome} onChange={handleChange} required />
          </FormField>
          <div className="form-row">
            <FormField label="Data de Nascimento *" htmlFor="aluno-nasc" required>
              <Input id="aluno-nasc" name="data_nascimento" type="date" value={form.data_nascimento?.slice(0, 10)} onChange={handleChange} required />
            </FormField>
            <FormField label="Sexo" htmlFor="aluno-sexo">
              <Select id="aluno-sexo" name="sexo" value={form.sexo} onChange={handleChange}>
                <option value="">Selecionar</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="Outro">Outro</option>
              </Select>
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="BI / Cédula" htmlFor="aluno-cpf">
              <Input id="aluno-cpf" name="cpf" value={form.cpf} onChange={handleChange} />
            </FormField>
            <FormField label="RG" htmlFor="aluno-rg">
              <Input id="aluno-rg" name="rg" value={form.rg} onChange={handleChange} />
            </FormField>
          </div>
          <FormField label="Nacionalidade" htmlFor="aluno-nacionalidade">
            <Input id="aluno-nacionalidade" name="nacionalidade" value={form.nacionalidade || ''} onChange={handleChange} placeholder="Ex: Angolana" />
          </FormField>
          <div className="form-row">
            <FormField label="Nome da Mãe" htmlFor="aluno-mae">
              <Input id="aluno-mae" name="nome_mae" value={form.nome_mae} onChange={handleChange} />
            </FormField>
            <FormField label="Nome do Pai" htmlFor="aluno-pai">
              <Input id="aluno-pai" name="nome_pai" value={form.nome_pai} onChange={handleChange} />
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="Responsável" htmlFor="aluno-responsavel">
              <Input id="aluno-responsavel" name="responsavel" value={form.responsavel} onChange={handleChange} />
            </FormField>
            <FormField label="Tel. Emergência" htmlFor="aluno-tel">
              <Input id="aluno-tel" name="telefone_emergencia" value={form.telefone_emergencia} onChange={handleChange} />
            </FormField>
          </div>
          <FormField label="Necessidades Especiais" htmlFor="aluno-nec">
            <Textarea id="aluno-nec" name="necessidades_especiais" rows={2} value={form.necessidades_especiais} onChange={handleChange} placeholder="Descreva se houver..." />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
