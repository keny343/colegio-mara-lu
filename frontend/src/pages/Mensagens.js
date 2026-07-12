import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Send, Search, Users, Megaphone } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { podeAcederInformacaoGeral } from '../utils/roles';

const ROLE_LABEL = {
  admin: 'Admin',
  coordenador: 'Coordenador',
  professor: 'Professor',
  aluno: 'Aluno',
};

export default function Mensagens() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [contatos, setContatos] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [selecionado, setSelecionado] = useState(null);
  const [conversa, setConversa] = useState([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingConversa, setLoadingConversa] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [modo, setModo] = useState('chat');
  const [broadcast, setBroadcast] = useState({ titulo: '', mensagem: '', alvo: 'alunos', turma_id: '' });
  const [turmas, setTurmas] = useState([]);

  const podeBroadcast = podeAcederInformacaoGeral(user) || user?.role === 'professor';

  const carregarContatos = useCallback(() => {
    setLoading(true);
    api.get('/mensagens/contactos')
      .then((r) => setContatos(r.data))
      .catch(() => setErro('Não foi possível carregar os contactos.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregarContatos();
    if (podeBroadcast) {
      const turmasEndpoint = user?.role === 'professor' && !podeAcederInformacaoGeral(user)
        ? '/professor/minhas-disciplinas'
        : '/staff/turmas';
      api.get(turmasEndpoint)
        .then((r) => {
          const data = turmasEndpoint.includes('disciplinas')
            ? [...new Map(r.data.map((d) => [d.turma_id, { id: d.turma_id, nome: d.turma_nome }])).values()]
            : r.data;
          setTurmas(data);
        })
        .catch(() => {});
    }
  }, [carregarContatos, podeBroadcast, user?.role]);

  const abrirConversa = async (contato) => {
    setSelecionado(contato);
    setModo('chat');
    setLoadingConversa(true);
    setErro('');
    try {
      const r = await api.get(`/mensagens/conversa/${contato.id}`);
      setConversa(r.data);
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao carregar conversa.');
      setConversa([]);
    } finally {
      setLoadingConversa(false);
    }
  };

  const enviarMensagem = async (e) => {
    e.preventDefault();
    if (!selecionado || !texto.trim()) return;
    setEnviando(true);
    setErro('');
    try {
      await api.post('/notificacoes', {
        alvo: 'usuario',
        destinatario_id: selecionado.id,
        titulo: 'Mensagem',
        mensagem: texto.trim(),
      });
      setTexto('');
      success('Mensagem enviada.');
      const r = await api.get(`/mensagens/conversa/${selecionado.id}`);
      setConversa(r.data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao enviar mensagem.';
      setErro(msg);
      notifyError(msg);
    } finally {
      setEnviando(false);
    }
  };

  const enviarBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcast.mensagem.trim()) return setErro('Escreva a mensagem.');
    if ((user?.role === 'professor' || user?.role === 'coordenador') && !broadcast.turma_id) {
      return setErro('Seleccione a turma.');
    }
    setEnviando(true);
    setErro('');
    try {
      const payload = {
        titulo: broadcast.titulo.trim() || 'Comunicado',
        mensagem: broadcast.mensagem.trim(),
        alvo: broadcast.alvo,
      };
      if (broadcast.turma_id) payload.turma_id = Number(broadcast.turma_id);
      const r = await api.post('/notificacoes', payload);
      success(r.data.message || 'Mensagem enviada.');
      setBroadcast({ titulo: '', mensagem: '', alvo: broadcast.alvo, turma_id: broadcast.turma_id });
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao enviar comunicado.';
      setErro(msg);
      notifyError(msg);
    } finally {
      setEnviando(false);
    }
  };

  const contatosFiltrados = contatos.filter((c) => {
    const q = filtro.toLowerCase();
    return !q || c.nome?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  const alvosAdmin = [
    { value: 'todos', label: 'Todos os utilizadores' },
    { value: 'alunos', label: 'Todos os alunos' },
    { value: 'professores', label: 'Todos os professores' },
    { value: 'coordenadores', label: 'Todos os coordenadores' },
  ];

  const alvosStaff = user?.role === 'professor' && !podeAcederInformacaoGeral(user)
    ? [{ value: 'alunos', label: 'Alunos da turma' }]
    : [
        { value: 'alunos', label: 'Alunos da turma' },
        { value: 'professores', label: 'Professores da turma' },
      ];

  if (loading) return <div className="loading" role="status" aria-label="A carregar mensagens"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2><MessageCircle size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Mensagens</h2>
        <p style={{ color: 'var(--cinza)' }}>
          Converse com professores, coordenadores ou alunos conforme as suas permissões.
        </p>
      </div>

      {erro && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{erro}</span>
          <button type="button" className="alert-close" onClick={() => setErro('')} aria-label="Fechar alerta">×</button>
        </div>
      )}

      {podeBroadcast && (
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${modo === 'chat' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setModo('chat')}
            aria-pressed={modo === 'chat'}
          >
            <MessageCircle size={14} /> Conversas
          </button>
          <button
            type="button"
            className={`btn btn-sm ${modo === 'broadcast' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setModo('broadcast'); setSelecionado(null); }}
            aria-pressed={modo === 'broadcast'}
          >
            <Megaphone size={14} /> Comunicado
          </button>
        </div>
      )}

      {modo === 'broadcast' ? (
        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} /> Enviar comunicado
          </h3>
          <form onSubmit={enviarBroadcast}>
            {user?.role !== 'admin' && (
              <div className="form-group">
                <label className="form-label" htmlFor="broadcast-turma">Turma *</label>
                <select
                  id="broadcast-turma"
                  className="form-control form-select"
                  value={broadcast.turma_id}
                  onChange={(e) => setBroadcast({ ...broadcast, turma_id: e.target.value })}
                  required
                >
                  <option value="">— Seleccione —</option>
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="broadcast-alvo">Destinatários</label>
              <select
                id="broadcast-alvo"
                className="form-control form-select"
                value={broadcast.alvo}
                onChange={(e) => setBroadcast({ ...broadcast, alvo: e.target.value })}
              >
                {(user?.role === 'admin' ? alvosAdmin : alvosStaff).map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="broadcast-titulo">Título</label>
              <input
                id="broadcast-titulo"
                className="form-control"
                value={broadcast.titulo}
                onChange={(e) => setBroadcast({ ...broadcast, titulo: e.target.value })}
                placeholder="Ex: Reunião de pais"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="broadcast-msg">Mensagem *</label>
              <textarea
                id="broadcast-msg"
                className="form-control"
                rows={4}
                value={broadcast.mensagem}
                onChange={(e) => setBroadcast({ ...broadcast, mensagem: e.target.value })}
                placeholder="Escreva o comunicado..."
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={enviando}>
              <Send size={16} /> {enviando ? 'A enviar...' : 'Enviar comunicado'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: '1rem', minHeight: 480 }}>
          <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--bege-medio)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--cinza)' }} />
                <input
                  className="form-control"
                  style={{ paddingLeft: 34 }}
                  placeholder="Pesquisar contacto..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  aria-label="Pesquisar contacto"
                />
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {contatosFiltrados.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <MessageCircle size={32} style={{ opacity: 0.3 }} />
                  <p style={{ color: 'var(--cinza)', fontSize: '0.9rem' }}>Nenhum contacto disponível.</p>
                </div>
              ) : (
                contatosFiltrados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => abrirConversa(c)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '12px 1rem', border: 'none',
                      borderBottom: '1px solid var(--bege-claro)', cursor: 'pointer',
                      background: selecionado?.id === c.id ? 'var(--laranja-suave)' : 'transparent',
                    }}
                    aria-current={selecionado?.id === c.id ? 'true' : undefined}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--castanho)' }}>{c.nome}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--cinza)' }}>
                      {ROLE_LABEL[c.role] || c.role}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
            {!selecionado ? (
              <div className="empty-state" style={{ flex: 1, padding: '3rem' }}>
                <MessageCircle size={48} style={{ opacity: 0.25 }} />
                <h3>Seleccione um contacto</h3>
                <p style={{ color: 'var(--cinza)' }}>Escolha alguém da lista para ver a conversa.</p>
              </div>
            ) : (
              <>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--bege-medio)', fontWeight: 700, color: 'var(--castanho)' }}>
                  {selecionado.nome}
                  <span style={{ fontWeight: 400, color: 'var(--cinza)', marginLeft: 8, fontSize: '0.85rem' }}>
                    {ROLE_LABEL[selecionado.role]}
                  </span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 300 }}>
                  {loadingConversa ? (
                    <div className="loading" role="status"><div className="spinner" /></div>
                  ) : conversa.length === 0 ? (
                    <p style={{ color: 'var(--cinza)', textAlign: 'center', margin: 'auto 0' }}>Nenhuma mensagem ainda. Envie a primeira!</p>
                  ) : (
                    conversa.map((m) => {
                      const enviada = Number(m.remetente_id) === Number(user.id);
                      return (
                        <div
                          key={m.id}
                          style={{
                            alignSelf: enviada ? 'flex-end' : 'flex-start',
                            maxWidth: '75%',
                            background: enviada ? 'var(--laranja)' : 'var(--bege-medio)',
                            color: enviada ? '#fff' : 'var(--castanho)',
                            borderRadius: 12,
                            padding: '10px 14px',
                          }}
                        >
                          <div style={{ lineHeight: 1.5 }}>{m.mensagem}</div>
                          <div style={{ fontSize: '0.72rem', opacity: 0.75, marginTop: 4, textAlign: 'right' }}>
                            {new Date(m.criado_em).toLocaleString('pt-AO')}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <form onSubmit={enviarMensagem} style={{ padding: '1rem', borderTop: '1px solid var(--bege-medio)', display: 'flex', gap: 8 }}>
                  <input
                    className="form-control"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Escreva a sua mensagem..."
                    aria-label="Mensagem"
                    disabled={enviando}
                  />
                  <button type="submit" className="btn btn-primary" disabled={enviando || !texto.trim()} aria-label="Enviar mensagem">
                    <Send size={16} />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
