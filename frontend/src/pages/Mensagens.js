import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, Send, Bell, CheckCircle, User, Search } from 'lucide-react';
import api from '../services/api';
import Toast, { useToast } from '../components/Toast';
import { Badge, Button, EmptyState, FormField, Input, Select, Textarea, LoadingState } from '../components/ui';
import './Mensagens.css';

const tipoBadge = (tipo) => {
  const map = {
    nota_lancada: { label: 'Nota', tone: 'blue' },
    novo_material: { label: 'Material', tone: 'blue' },
    plano_curricular: { label: 'Plano', tone: 'green' },
    mensagem: { label: 'Mensagem', tone: 'yellow' },
    atribuicao: { label: 'Atribuição', tone: 'blue' },
  };
  const c = map[tipo] || { label: tipo?.replace('_', ' ') || 'Aviso', tone: 'gray' };
  return <Badge tone={c.tone} className="tipo-badge">{c.label}</Badge>;
};

const roleLabel = (role) => ({
  admin: 'Administração', coordenador: 'Coordenadores',
  professor: 'Professores', aluno: 'Alunos',
}[role] || role);

// Área de conversa 1-a-1 (chat) com um contacto específico
function ChatArea({ destinatarioId, destinatarioNome, currentUserId, onSent, onOpened }) {
  const [msgs, setMsgs] = useState([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [erroCarregar, setErroCarregar] = useState(false);
  const bottomRef = useRef(null);

  const carregar = () => {
    setLoading(true);
    setErroCarregar(false);
    api.get(`/mensagens/conversa/${destinatarioId}`)
      .then(res => {
        setMsgs(res.data);
        onOpened && onOpened(destinatarioId);
      })
      .catch(() => setErroCarregar(true))
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
      setErroEnvio(err.response?.data?.message || 'Não foi possível enviar. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-box">
      <div className="chat-header">Conversa com {destinatarioNome}</div>
      <div className="chat-scroll">
        {loading ? (
          <p className="chat-vazio">A carregar conversa...</p>
        ) : erroCarregar ? (
          <p className="chat-vazio">
            Não foi possível carregar a conversa.{' '}
            <button type="button" className="alert-close" onClick={carregar}>Tentar novamente</button>
          </p>
        ) : msgs.length === 0 ? (
          <p className="chat-vazio">Ainda não há mensagens. Escreva a primeira.</p>
        ) : msgs.map(m => {
          const minha = Number(m.remetente_id) === Number(currentUserId);
          return (
            <div key={m.id} className={minha ? 'chat-bubble-wrap chat-bubble-wrap--minha' : 'chat-bubble-wrap'}>
              <div className={minha ? 'chat-bubble chat-bubble--minha' : 'chat-bubble'}>{m.mensagem}</div>
              <div className={minha ? 'chat-time chat-time--minha' : 'chat-time'}>
                {new Date(m.criado_em).toLocaleString('pt-AO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {erroEnvio && <div className="chat-erro">{erroEnvio}</div>}
      <form onSubmit={enviar} className="chat-form">
        <Input placeholder="Escreva uma mensagem..." value={texto} onChange={e => setTexto(e.target.value)} className="chat-input" />
        <Button type="submit" variant="primary" size="sm" icon={<Send size={14} />} disabled={sending || !texto.trim()} aria-label="Enviar mensagem" />
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
  const [erroNotifs, setErroNotifs] = useState(false);
  const [erroContatos, setErroContatos] = useState(false);
  const [sending, setSending] = useState(false);
  const [respondendoPara, setRespondendoPara] = useState(null); // { id, nome }
  const { toast, showToast, clearToast } = useToast();
  const bottomRef = useRef(null);

  const carregarNotifs = () =>
    api.get('/notificacoes')
      .then(res => { setNotifs(res.data); setErroNotifs(false); })
      .catch(() => setErroNotifs(true))
      .finally(() => setLoading(false));

  useEffect(() => { carregarNotifs(); }, []);

  useEffect(() => {
    if (!user) return;
    api.get('/mensagens/contactos')
      .then(res => { setContatos(res.data); setErroContatos(false); })
      .catch(() => setErroContatos(true));
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

  const handleContactOpened = (contactId) => {
    const idNum = Number(contactId);
    setContatos(prev => prev.map(c => Number(c.id) === idNum ? { ...c, nao_lidas: 0 } : c));
    setNotifs(prev => prev.map(n =>
      Number(n.remetente_id) === idNum && !n.lida ? { ...n, lida: true } : n
    ));
  };

  const marcarLida = (id) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    api.patch(`/notificacoes/${id}/lida`).catch(() => {
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

  if (loading) return <LoadingState />;

  const naoLidas = notifs.filter(n => !n.lida).length;
  const podeEnviar = ['admin', 'coordenador', 'professor', 'aluno'].includes(user?.role);

  const destinatarioOpts = () => {
    if (user?.role === 'admin') return [
      { value: 'todos', label: '🌐 Todos' },
      { value: 'admins', label: '🛡️ Administradores' },
      { value: 'coordenadores', label: '🏫 Coordenadores' },
      { value: 'professores', label: '👩‍🏫 Professores' },
      { value: 'alunos', label: '🎒 Alunos' },
      { value: 'usuario', label: '👤 Pessoa específica' },
    ];
    if (user?.role === 'coordenador') return [
      { value: 'professores', label: '👩‍🏫 Todos os professores que coordeno' },
      { value: 'alunos', label: '🎒 Todos os alunos que coordeno' },
      { value: 'usuario', label: '👤 Pessoa específica' },
    ];
    if (user?.role === 'professor') return [
      { value: 'alunos', label: '🎒 Todos os meus alunos' },
      { value: 'coordenadores', label: '🏫 O(s) meu(s) coordenador(es)' },
      { value: 'usuario', label: '👤 Pessoa específica' },
    ];
    return [
      { value: 'usuario', label: '👤 Coordenador ou professor específico' },
    ];
  };

  const mostrarFiltroTurma =
    (user?.role === 'admin' && ['alunos', 'professores'].includes(form.alvo)) ||
    (user?.role === 'coordenador' && ['alunos', 'professores'].includes(form.alvo)) ||
    (user?.role === 'professor' && form.alvo === 'alunos');

  const contatosFiltrados = contatos
    .filter(c => {
      if (user?.role !== 'professor' || !chatTurmaFiltro) return true;
      if (c.role !== 'aluno') return true;
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
        <div className="msg-header-row">
          <div>
            <h2>Mensagens e Notificações</h2>
            <p>
              {erroNotifs ? (
                <span className="msg-naolidas">Não foi possível carregar as mensagens. <button type="button" className="alert-close" onClick={carregarNotifs}>Tentar novamente</button></span>
              ) : naoLidas > 0
                ? <span className="msg-naolidas">{naoLidas} mensagem(ns) não lida(s)</span>
                : 'Todas as mensagens lidas ✓'}
            </p>
          </div>
          {naoLidas > 0 && (
            <Button variant="outline" size="sm" icon={<CheckCircle size={14} />} onClick={marcarTodasLidas}>
              Marcar todas como lidas
            </Button>
          )}
        </div>
      </div>

      {podeEnviar && (
        <div className="card msg-enviar-card">
          <div className="msg-enviar-head">
            <div className="msg-enviar-icon"><Send size={18} /></div>
            <h3>Enviar mensagem</h3>
            <span className="msg-enviar-hint">
              {user?.role === 'admin' && 'Admin → todos, grupos ou pessoa específica'}
              {user?.role === 'coordenador' && 'Coordenador → a sua equipa (toda ou específica)'}
              {user?.role === 'professor' && 'Professor → alunos, coordenador ou pessoa específica'}
              {user?.role === 'aluno' && 'Aluno → seu coordenador ou professores'}
            </span>
          </div>

          {erro && (
            <div className="alert alert-error alert-dismiss">
              <span>{erro}</span>
              <button type="button" className="alert-close" aria-label="Fechar mensagem de erro" onClick={() => setErro('')}>×</button>
            </div>
          )}

          <FormField label="Destinatário *" htmlFor="msg-alvo">
            <Select
              id="msg-alvo"
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
            </Select>
          </FormField>

          {form.alvo === 'usuario' ? (
            <div>
              {user?.role === 'professor' && turmas.length > 0 && (
                <FormField label="Filtrar alunos por turma (opcional)" htmlFor="msg-filtro-turma">
                  <Select id="msg-filtro-turma" value={chatTurmaFiltro} onChange={e => setChatTurmaFiltro(e.target.value)}>
                    <option value="">Todas as turmas</option>
                    {turmas.map(t => (
                      <option key={t.id || t.turma_id} value={t.id || t.turma_id}>{t.nome || t.turma_nome}</option>
                    ))}
                  </Select>
                </FormField>
              )}

              <div className="form-group msg-contato-grupo">
                <label className="form-label" htmlFor="msg-busca-contato">Pessoa específica *</label>

                {destinatarioSelecionado ? (
                  <div className="msg-contato-chip">
                    <span className="msg-chip-info">
                      {destinatarioSelecionado.nome}
                      {destinatarioSelecionado.email && (
                        <span className="msg-chip-email"> · {destinatarioSelecionado.email}</span>
                      )}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => { setForm({ ...form, destinatario_id: '' }); setBuscaContato(''); }}>
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="msg-busca">
                      <Search size={15} className="msg-busca-icon" />
                      <Input
                        id="msg-busca-contato"
                        className="msg-busca-input"
                        placeholder="Escreva o nome ou email..."
                        value={buscaContato}
                        onChange={e => setBuscaContato(e.target.value)}
                        onFocus={() => setDropdownAberto(true)}
                        onBlur={() => setTimeout(() => setDropdownAberto(false), 150)}
                        role="combobox"
                        aria-expanded={dropdownAberto}
                        aria-haspopup="listbox"
                        aria-controls="msg-contatos-listbox"
                        aria-autocomplete="list"
                        onKeyDown={e => {
                          if (e.key === 'Escape') setDropdownAberto(false);
                          if (e.key === 'ArrowDown' && dropdownAberto) {
                            e.preventDefault();
                            document.querySelector('#msg-contatos-listbox .msg-contato-item')?.focus();
                          }
                        }}
                      />
                    </div>

                    {dropdownAberto && (
                      <div className="msg-dropdown" id="msg-contatos-listbox" role="listbox" aria-label="Contactos">
                        {contatosFiltrados.length === 0 ? (
                          <p className="msg-dropdown-vazio">
                            {erroContatos
                              ? <>Não foi possível carregar os contactos. <button type="button" className="alert-close" onClick={() => { setErroContatos(false); api.get('/mensagens/contactos').then(res => setContatos(res.data)).catch(() => setErroContatos(true)); }}>Tentar novamente</button></>
                              : contatos.length === 0
                                ? 'Ainda não tens contactos disponíveis para mensagem directa.'
                                : 'Nenhum contacto corresponde à busca/filtro.'}
                          </p>
                        ) : (
                          ['admin', 'coordenador', 'professor', 'aluno'].map(r => {
                            const grupo = contatosFiltrados.filter(c => c.role === r);
                            if (!grupo.length) return null;
                            return (
                              <div key={r}>
                                <div className="msg-dropdown-grupo">{roleLabel(r)}</div>
                                {grupo.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    role="option"
                                    aria-selected="false"
                                    className="msg-contato-item"
                                    onMouseDown={() => { setForm({ ...form, destinatario_id: String(c.id) }); setDropdownAberto(false); }}
                                    onClick={() => { setForm({ ...form, destinatario_id: String(c.id) }); setDropdownAberto(false); }}
                                    onKeyDown={e => {
                                      if (e.key === 'ArrowDown') { e.preventDefault(); e.currentTarget.nextElementSibling?.focus?.(); }
                                      if (e.key === 'ArrowUp') { e.preventDefault(); e.currentTarget.previousElementSibling?.focus?.(); }
                                      if (e.key === 'Escape') setDropdownAberto(false);
                                    }}
                                  >
                                    <span className="msg-contato-nome">
                                      <span className="msg-contato-nome-forte">{c.nome}</span>
                                      {c.email && <span className="msg-contato-nome-email"> · {c.email}</span>}
                                    </span>
                                    {c.nao_lidas > 0 && (
                                      <span className="msg-naolidas-pill">{c.nao_lidas}</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {form.destinatario_id && destinatarioSelecionado && (
                <ChatArea
                  destinatarioId={Number(form.destinatario_id)}
                  destinatarioNome={destinatarioSelecionado.nome}
                  currentUserId={user.id}
                  onSent={carregarNotifs}
                  onOpened={handleContactOpened}
                />
              )}
            </div>
          ) : (
            <form onSubmit={enviarMensagem}>
              <FormField label="Título *" htmlFor="msg-titulo">
                <Input id="msg-titulo" value={form.titulo} placeholder="Ex: Aviso importante, Reunião de pais..." onChange={e => setForm({ ...form, titulo: e.target.value })} />
              </FormField>

              {mostrarFiltroTurma && (
                <FormField label="Turma específica (opcional)" htmlFor="msg-turma">
                  <Select id="msg-turma" value={form.turma_id} onChange={e => setForm({ ...form, turma_id: e.target.value })}>
                    <option value="">Todas as turmas sob a sua gestão</option>
                    {turmas.map(t => (
                      <option key={t.id || t.turma_id} value={t.id || t.turma_id}>{t.nome || t.turma_nome}</option>
                    ))}
                  </Select>
                </FormField>
              )}

              <FormField label="Mensagem *" htmlFor="msg-corpo">
                <Textarea id="msg-corpo" rows="4" placeholder="Escreva aqui a sua mensagem..." value={form.mensagem} onChange={e => setForm({ ...form, mensagem: e.target.value })} />
              </FormField>
              <Button type="submit" variant="primary" icon={<Send size={15} />} loading={sending}>
                {sending ? 'A enviar...' : 'Enviar mensagem'}
              </Button>
            </form>
          )}
        </div>
      )}

      {respondendoPara && (
        <div className="card msg-resposta-card">
          <div className="msg-resposta-head">
            <h3>Conversa</h3>
            <button type="button" className="alert-close" aria-label="Fechar conversa" onClick={() => setRespondendoPara(null)}>×</button>
          </div>
          <ChatArea
            destinatarioId={respondendoPara.id}
            destinatarioNome={respondendoPara.nome}
            currentUserId={user.id}
            onSent={carregarNotifs}
            onOpened={handleContactOpened}
          />
        </div>
      )}

      <div className="card msg-inbox-card">
        <div className="msg-inbox-head">
          <Bell size={18} />
          <h3>Caixa de entrada</h3>
          {naoLidas > 0 && <span className="msg-inbox-count">{naoLidas}</span>}
        </div>

        {notifs.length === 0 ? (
          <EmptyState icon={<MessageCircle size={48} />} title="Nenhuma mensagem ainda" message="As notificações da escola aparecerão aqui." />
        ) : (
          <div className="msg-lista">
            {notifs.map(n => (
              <div
                key={n.id}
                className={n.lida ? 'msg-item msg-item--lida' : 'msg-item'}
                onClick={() => !n.lida && marcarLida(n.id)}
              >
                <div className={n.lida ? 'msg-item-avatar msg-item-avatar--lida' : 'msg-item-avatar'}>
                  <MessageCircle size={18} />
                </div>

                <div className="msg-item-corpo">
                  <div className="msg-item-topo">
                    <p className={n.lida ? 'msg-item-texto msg-item-texto--lida' : 'msg-item-texto'}>
                      {n.titulo && <span className="msg-item-titulo">{n.titulo}</span>}
                      {n.mensagem}
                    </p>
                    {!n.lida && <span className="msg-item-dot" />}
                  </div>
                  <div className="msg-item-meta">
                    {n.remetente_nome && (
                      <span className="msg-item-remetente">
                        <User size={11} />
                        {n.remetente_nome}
                        {n.remetente_role && (
                          <span className="msg-item-remetente-role">
                            ({n.remetente_role === 'admin' ? 'Administração' : n.remetente_role === 'coordenador' ? 'Coordenador' : n.remetente_role === 'professor' ? 'Professor' : n.remetente_role})
                          </span>
                        )}
                      </span>
                    )}
                    {n.criado_em && (
                      <span className="msg-item-data">
                        {new Date(n.criado_em).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {n.tipo && tipoBadge(n.tipo)}
                    {!n.lida && <span className="msg-item-lida-hint">Clica para marcar como lida</span>}
                    {n.remetente_id && Number(n.remetente_id) !== Number(user.id) && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<MessageCircle size={12} />}
                        className="msg-item-responder"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRespondendoPara({ id: Number(n.remetente_id), nome: n.remetente_nome || 'Utilizador' });
                        }}
                      >
                        Responder
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}