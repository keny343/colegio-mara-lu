import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, Send, Bell, CheckCircle, User, Search } from 'lucide-react';
import api from '../services/api';
import Toast, { useToast } from '../components/Toast';

const tipoBadge = (tipo) => {
  const map = {
    nota_lancada:       { label: 'Nota',        color: '#2563eb', bg: '#eff6ff' },
    novo_material:      { label: 'Material',     color: '#7c3aed', bg: '#f5f3ff' },
    plano_curricular:   { label: 'Plano',        color: '#065f46', bg: '#ecfdf5' },
    mensagem:           { label: 'Mensagem',     color: '#b45309', bg: '#fffbeb' },
    atribuicao:         { label: 'Atribuição',   color: '#0369a1', bg: '#f0f9ff' },
  };
  const c = map[tipo] || { label: tipo?.replace('_', ' ') || 'Aviso', color: '#6b7280', bg: '#f9fafb' };
  return (
    <span style={{
      background: c.bg, color: c.color, borderRadius: 6,
      padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 0.5,
    }}>
      {c.label}
    </span>
  );
};

const roleLabel = (role) => ({
  admin: 'Administração', coordenador: 'Coordenadores',
  professor: 'Professores', aluno: 'Alunos',
}[role] || role);

// Área de conversa 1-a-1 (chat) com um contacto específico
function ChatArea({ destinatarioId, destinatarioNome, currentUserId, onSent }) {
  const [msgs, setMsgs] = useState([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const bottomRef = useRef(null);

  const carregar = () => {
    setLoading(true);
    api.get(`/mensagens/conversa/${destinatarioId}`)
      .then(res => setMsgs(res.data))
      .catch(() => setMsgs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [destinatarioId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const enviar = async (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setSending(true);
    setErroEnvio('');
    try {
      await api.post('/notificacoes', { mensagem: texto, alvo: 'usuario', destinatario_id: destinatarioId });
      setTexto('');
      carregar();
      onSent && onSent();
    } catch (err) {
      // erro de envio: texto fica no input para o utilizador tentar de novo
      setErroEnvio(err.response?.data?.message || 'Não foi possível enviar. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ marginTop: '1rem', border: '1px solid var(--bege)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '0.6rem 1rem', background: 'var(--bege-claro)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--castanho)' }}>
        Conversa com {destinatarioNome}
      </div>
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: '0.8rem 1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--cinza)' }}>A carregar conversa...</p>
        ) : msgs.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--cinza)' }}>Ainda não há mensagens. Escreva a primeira.</p>
        ) : msgs.map(m => {
          const minha = Number(m.remetente_id) === Number(currentUserId);
          return (
            <div key={m.id} style={{ alignSelf: minha ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
              <div style={{
                background: minha ? 'var(--laranja)' : 'var(--bege)',
                color: minha ? '#fff' : 'var(--castanho)',
                borderRadius: 12, padding: '0.5rem 0.8rem', fontSize: '0.88rem',
              }}>
                {m.mensagem}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--cinza)', marginTop: 2, textAlign: minha ? 'right' : 'left' }}>
                {new Date(m.criado_em).toLocaleString('pt-AO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {erroEnvio && (
        <div style={{ padding: '0.4rem 1rem', fontSize: '0.78rem', color: '#b91c1c' }}>{erroEnvio}</div>
      )}
      <form onSubmit={enviar} style={{ display: 'flex', gap: 8, padding: '0.6rem', borderTop: '1px solid var(--bege)' }}>
        <input
          className="form-control"
          placeholder="Escreva uma mensagem..."
          value={texto}
          onChange={e => setTexto(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !texto.trim()}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

export default function Mensagens() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [turmas, setTurmas] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [form, setForm] = useState({
    titulo: '',
    mensagem: '',
    alvo: user?.role === 'admin' ? 'todos' : user?.role === 'aluno' ? 'usuario' : 'alunos',
    turma_id: '',
    destinatario_id: '',
  });
  const [buscaContato, setBuscaContato] = useState('');
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [chatTurmaFiltro, setChatTurmaFiltro] = useState('');
  const [erro, setErro] = useState('');
  const [sending, setSending] = useState(false);
  const [respondendoPara, setRespondendoPara] = useState(null); // { id, nome }
  const { toast, showToast, clearToast } = useToast();
  const bottomRef = useRef(null);

  const carregarNotifs = () =>
    api.get('/notificacoes')
      .then(res => setNotifs(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { carregarNotifs(); }, []);

  useEffect(() => {
    if (!user) return;
    api.get('/mensagens/contactos')
      .then(res => setContatos(res.data))
      .catch(() => setContatos([]));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin' || user.role === 'coordenador') {
      api.get('/staff/turmas').then(res => setTurmas(res.data)).catch(() => {});
    } else if (user.role === 'professor') {
      api.get('/professor/minhas-disciplinas')
        .then(res => {
          const mapa = new Map();
          res.data.forEach((d) => {
            if (!mapa.has(d.turma_id)) mapa.set(d.turma_id, { turma_id: d.turma_id, nome: d.turma_nome });
          });
          setTurmas(Array.from(mapa.values()));
        })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notifs]);

  const marcarLida = (id) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    api.patch(`/notificacoes/${id}/lida`).catch(() => {
      // reverte se o servidor recusou (ex.: 403)
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: false } : n));
    });
  };

  const marcarTodasLidas = async () => {
    const pendentes = notifs.filter(n => !n.lida);
    const resultados = await Promise.allSettled(
      pendentes.map(n => api.patch(`/notificacoes/${n.id}/lida`))
    );
    const idsOk = new Set(
      pendentes.filter((_, i) => resultados[i].status === 'fulfilled').map(n => n.id)
    );
    setNotifs(prev => prev.map(n => idsOk.has(n.id) ? { ...n, lida: true } : n));
    const falhas = pendentes.length - idsOk.size;
    if (falhas > 0) {
      showToast(`${idsOk.size} marcada(s) como lida(s). ${falhas} falharam.`, 'error');
    } else {
      showToast('Todas as mensagens marcadas como lidas.', 'info');
    }
  };

  const enviarMensagem = async (e) => {
    e.preventDefault();
    setErro('');
    if (!form.titulo || !form.mensagem) return setErro('Título e mensagem são obrigatórios.');
    setSending(true);
    try {
      await api.post('/notificacoes', form);
      showToast('Mensagem enviada com sucesso! Os destinatários foram notificados.', 'success');
      setForm({ ...form, titulo: '', mensagem: '' });
      await carregarNotifs();
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao enviar mensagem.';
      setErro(msg);
      showToast(msg, 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const naoLidas = notifs.filter(n => !n.lida).length;
  const podeEnviar = ['admin', 'coordenador', 'professor', 'aluno'].includes(user?.role);

  const destinatarioOpts = () => {
    if (user?.role === 'admin') return [
      { value: 'todos',         label: '🌐 Todos' },
      { value: 'admins',        label: '🛡️ Administradores' },
      { value: 'coordenadores', label: '🏫 Coordenadores' },
      { value: 'professores',   label: '👩‍🏫 Professores' },
      { value: 'alunos',        label: '🎒 Alunos' },
      { value: 'usuario',       label: '👤 Pessoa específica' },
    ];
    if (user?.role === 'coordenador') return [
      { value: 'professores', label: '👩‍🏫 Todos os professores que coordeno' },
      { value: 'alunos',      label: '🎒 Todos os alunos que coordeno' },
      { value: 'usuario',     label: '👤 Pessoa específica' },
    ];
    if (user?.role === 'professor') return [
      { value: 'alunos',        label: '🎒 Todos os meus alunos' },
      { value: 'coordenadores', label: '🏫 O(s) meu(s) coordenador(es)' },
      { value: 'usuario',       label: '👤 Pessoa específica' },
    ];
    return [
      { value: 'usuario', label: '👤 Coordenador ou professor específico' },
    ];
  };

  // Mostra o filtro opcional de turma só quando faz sentido para o alvo escolhido (envio em massa)
  const mostrarFiltroTurma =
    (user?.role === 'admin' && ['alunos', 'professores'].includes(form.alvo)) ||
    (user?.role === 'coordenador' && ['alunos', 'professores'].includes(form.alvo)) ||
    (user?.role === 'professor' && form.alvo === 'alunos');

  // Contactos filtrados pela busca (nome/email) e, pro professor, pela turma que leciona
  const contatosFiltrados = contatos
    .filter(c => {
      if (user?.role !== 'professor' || !chatTurmaFiltro) return true;
      if (c.role !== 'aluno') return true; // coordenador continua sempre visível
      return Array.isArray(c.turma_ids) && c.turma_ids.includes(Number(chatTurmaFiltro));
    })
    .filter(c => {
      if (!buscaContato.trim()) return true;
      const q = buscaContato.trim().toLowerCase();
      return c.nome?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
    });

  const destinatarioSelecionado = contatos.find(c => Number(c.id) === Number(form.destinatario_id));

  return (
    <div className="page-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} key={toast.key} />}

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2>Mensagens e Notificações</h2>
            <p>
              {naoLidas > 0
                ? <span style={{ color: 'var(--laranja)', fontWeight: 600 }}>{naoLidas} mensagem(ns) não lida(s)</span>
                : 'Todas as mensagens lidas ✓'}
            </p>
          </div>
          {naoLidas > 0 && (
            <button
              className="btn btn-outline btn-sm"
              onClick={marcarTodasLidas}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <CheckCircle size={14} /> Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      {podeEnviar && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
            <div style={{ background: 'var(--castanho-claro)', borderRadius: 8, padding: 8 }}>
              <Send size={18} color="var(--castanho)" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Enviar mensagem</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--cinza)', textAlign: 'right' }}>
              {user?.role === 'admin' && 'Admin → todos, grupos ou pessoa específica'}
              {user?.role === 'coordenador' && 'Coordenador → a sua equipa (toda ou específica)'}
              {user?.role === 'professor' && 'Professor → alunos, coordenador ou pessoa específica'}
              {user?.role === 'aluno' && 'Aluno → seu coordenador ou professores'}
            </span>
          </div>

          {erro && (
            <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span>{erro}</span>
              <button type="button" className="alert-close" onClick={() => setErro('')}>×</button>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Destinatário *</label>
            <select
              className="form-control form-select"
              value={form.alvo}
              onChange={e => {
                setForm({ ...form, alvo: e.target.value, destinatario_id: '', turma_id: '' });
                setBuscaContato('');
                setChatTurmaFiltro('');
              }}
            >
              {destinatarioOpts().map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {form.alvo === 'usuario' ? (
            <div>
              {user?.role === 'professor' && turmas.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Filtrar alunos por turma (opcional)</label>
                  <select
                    className="form-control form-select"
                    value={chatTurmaFiltro}
                    onChange={e => setChatTurmaFiltro(e.target.value)}
                  >
                    <option value="">Todas as turmas</option>
                    {turmas.map(t => (
                      <option key={t.id || t.turma_id} value={t.id || t.turma_id}>
                        {t.nome || t.turma_nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Pessoa específica *</label>

                {destinatarioSelecionado ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8, padding: '0.55rem 0.8rem', borderRadius: 8,
                    background: 'var(--laranja-suave)', border: '1px solid rgba(232,100,26,0.25)',
                  }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--castanho)' }}>
                      {destinatarioSelecionado.nome}
                      {destinatarioSelecionado.email && (
                        <span style={{ fontWeight: 400, color: 'var(--cinza)' }}> · {destinatarioSelecionado.email}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => { setForm({ ...form, destinatario_id: '' }); setBuscaContato(''); }}
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ position: 'relative' }}>
                      <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--cinza)' }} />
                      <input
                        className="form-control"
                        style={{ paddingLeft: 32 }}
                        placeholder="Escreva o nome ou email..."
                        value={buscaContato}
                        onChange={e => setBuscaContato(e.target.value)}
                        onFocus={() => setDropdownAberto(true)}
                        onBlur={() => setTimeout(() => setDropdownAberto(false), 150)}
                      />
                    </div>

                    {dropdownAberto && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                        marginTop: 4, maxHeight: 260, overflowY: 'auto',
                        background: '#fff', border: '1px solid var(--bege)', borderRadius: 10,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                      }}>
                        {contatosFiltrados.length === 0 ? (
                          <p style={{ padding: '0.7rem 0.9rem', fontSize: '0.85rem', color: 'var(--cinza)', margin: 0 }}>
                            {contatos.length === 0
                              ? 'Ainda não tens contactos disponíveis para mensagem directa.'
                              : 'Nenhum contacto corresponde à busca/filtro.'}
                          </p>
                        ) : (
                          ['admin', 'coordenador', 'professor', 'aluno'].map(r => {
                            const grupo = contatosFiltrados.filter(c => c.role === r);
                            if (!grupo.length) return null;
                            return (
                              <div key={r}>
                                <div style={{
                                  padding: '0.4rem 0.9rem', fontSize: '0.7rem', fontWeight: 700,
                                  textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--cinza)',
                                  background: 'var(--bege-claro)',
                                }}>
                                  {roleLabel(r)}
                                </div>
                                {grupo.map(c => (
                                  <div
                                    key={c.id}
                                    onMouseDown={() => { setForm({ ...form, destinatario_id: String(c.id) }); setDropdownAberto(false); }}
                                    style={{
                                      padding: '0.55rem 0.9rem', cursor: 'pointer', fontSize: '0.88rem',
                                      color: 'var(--castanho)', borderBottom: '1px solid var(--bege-claro)',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bege-claro)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
