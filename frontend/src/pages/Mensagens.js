import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, Send, Bell, CheckCircle, Users, User } from 'lucide-react';
import api from '../services/api';
import Toast, { useToast } from '../components/Toast';

/* ── Badge de tipo de notificação ── */
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

export default function Mensagens() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [turmas, setTurmas] = useState([]);
  const [form, setForm] = useState({
    titulo: '',
    mensagem: '',
    alvo: user?.role === 'admin' ? 'todos' : 'alunos',
    turma_id: '',
  });
  const [erro, setErro] = useState('');
  const [sending, setSending] = useState(false);
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
    api.patch(`/notificacoes/${id}/lida`).catch(() => {});
  };

  const marcarTodasLidas = () => {
    notifs.filter(n => !n.lida).forEach(n => {
      api.patch(`/notificacoes/${n.id}/lida`).catch(() => {});
    });
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })));
    showToast('Todas as mensagens marcadas como lidas.', 'info');
  };

  const enviarMensagem = async (e) => {
    e.preventDefault();
    setErro('');
    if (!form.titulo || !form.mensagem) return setErro('Título e mensagem são obrigatórios.');
    if (user && ['professor', 'coordenador'].includes(user.role) && !form.turma_id) {
      return setErro('Seleccione a turma para enviar a mensagem.');
    }
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
  const podeEnviar = ['admin', 'coordenador', 'professor'].includes(user?.role);

  /* Opções de destinatário por role */
  const destinatarioOpts = () => {
    if (user?.role === 'admin') return [
      { value: 'todos',        label: '🌐 Todos' },
      { value: 'alunos',       label: '🎒 Alunos' },
      { value: 'professores',  label: '👩‍🏫 Professores' },
      { value: 'coordenadores',label: '🏫 Coordenadores' },
    ];
    if (user?.role === 'coordenador') return [
      { value: 'alunos',      label: '🎒 Alunos da turma' },
      { value: 'professores', label: '👩‍🏫 Professores da turma' },
    ];
    return [
      { value: 'alunos', label: '🎒 Alunos da turma' },
    ];
  };

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

      {/* Formulário de envio — só staff */}
      {podeEnviar && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
            <div style={{ background: 'var(--castanho-claro)', borderRadius: 8, padding: 8 }}>
              <Send size={18} color="var(--castanho)" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Enviar mensagem</h3>
            {/* Resumo de quem pode enviar para quem */}
            <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--cinza)', textAlign: 'right' }}>
              {user?.role === 'admin' && 'Admin → todos, alunos, professores ou coordenadores'}
              {user?.role === 'coordenador' && 'Coordenador → alunos ou professores das suas turmas'}
              {user?.role === 'professor' && 'Professor → alunos das suas turmas'}
            </span>
          </div>

          {erro && (
            <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span>{erro}</span>
              <button type="button" className="alert-close" onClick={() => setErro('')}>×</button>
            </div>
          )}

          <form onSubmit={enviarMensagem}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Título *</label>
                <input
                  className="form-control"
                  value={form.titulo}
                  placeholder="Ex: Aviso importante, Reunião de pais..."
                  onChange={e => setForm({ ...form, titulo: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Destinatário *</label>
                <select
                  className="form-control form-select"
                  value={form.alvo}
                  onChange={e => setForm({ ...form, alvo: e.target.value })}
                >
                  {destinatarioOpts().map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Seleção de turma — obrigatória para coordenador e professor */}
            {(user?.role === 'coordenador' || user?.role === 'professor') && (
              <div className="form-group">
                <label className="form-label">Turma *</label>
                <select
                  className="form-control form-select"
                  value={form.turma_id}
                  onChange={e => setForm({ ...form, turma_id: e.target.value })}
                >
                  <option value="">Seleccione a turma...</option>
                  {turmas.map(t => (
                    <option key={t.id || t.turma_id} value={t.id || t.turma_id}>
                      {t.nome || t.turma_nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Admin pode opcionalmente filtrar por turma */}
            {user?.role === 'admin' && ['alunos', 'professores'].includes(form.alvo) && (
              <div className="form-group">
                <label className="form-label">Turma específica (opcional)</label>
                <select
                  className="form-control form-select"
                  value={form.turma_id}
                  onChange={e => setForm({ ...form, turma_id: e.target.value })}
                >
                  <option value="">Todas as turmas</option>
                  {turmas.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Mensagem *</label>
              <textarea
                className="form-control"
                rows="4"
                placeholder="Escreva aqui a sua mensagem..."
                value={form.mensagem}
                onChange={e => setForm({ ...form, mensagem: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              <Send size={15} /> {sending ? 'A enviar...' : 'Enviar mensagem'}
            </button>
          </form>
        </div>
      )}

      {/* Lista de notificações recebidas */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <Bell size={18} color="var(--castanho)" />
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Caixa de entrada</h3>
          {naoLidas > 0 && (
            <span style={{
              background: 'var(--laranja)', color: '#fff',
              borderRadius: 20, padding: '1px 8px',
              fontSize: '0.78rem', fontWeight: 700,
            }}>
              {naoLidas}
            </span>
          )}
        </div>

        {notifs.length === 0 ? (
          <div className="empty-state">
            <MessageCircle size={48} />
            <h3>Nenhuma mensagem ainda</h3>
            <p>As notificações da escola aparecerão aqui.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notifs.map(n => (
              <div
                key={n.id}
                onClick={() => !n.lida && marcarLida(n.id)}
                style={{
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  padding: '1rem 1.2rem', borderRadius: 12,
                  background: n.lida ? 'var(--bege-claro)' : 'var(--laranja-suave)',
                  border: n.lida ? '1px solid var(--bege)' : '1px solid rgba(232,100,26,0.25)',
                  cursor: n.lida ? 'default' : 'pointer', transition: 'all 0.2s',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  background: n.lida ? 'var(--bege)' : 'var(--laranja)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MessageCircle size={18} color={n.lida ? 'var(--cinza)' : 'white'} />
                </div>

                {/* Conteúdo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '0.92rem', fontWeight: n.lida ? 400 : 600, color: 'var(--castanho)', margin: 0 }}>
                      {n.titulo && <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--castanho-medio)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{n.titulo}</span>}
                      {n.mensagem}
                    </p>
                    {!n.lida && (
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--laranja)', flexShrink: 0, marginTop: 4 }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Remetente */}
                    {n.remetente_nome && (
                      <span style={{
                        fontSize: '0.78rem', fontWeight: 600, color: 'var(--castanho)',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <User size={11} />
                        {n.remetente_nome}
                        {n.remetente_role && (
                          <span style={{ fontWeight: 400, color: 'var(--cinza)', textTransform: 'capitalize' }}>
                            ({n.remetente_role === 'admin' ? 'Administração' : n.remetente_role === 'coordenador' ? 'Coordenador' : n.remetente_role === 'professor' ? 'Professor' : n.remetente_role})
                          </span>
                        )}
                      </span>
                    )}
                    {n.criado_em && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--cinza)' }}>
                        {new Date(n.criado_em).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {n.tipo && tipoBadge(n.tipo)}
                    {!n.lida && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--laranja)', fontWeight: 600 }}>
                        Clica para marcar como lida
                      </span>
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