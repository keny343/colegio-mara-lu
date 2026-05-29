import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Bell, LogOut, GraduationCap, Home, BookOpen, Calendar,
  MessageCircle, FileText, AlertTriangle, User
} from 'lucide-react';
import api from '../services/api';
import { podeEditarNotas, podeAcederInformacaoGeral, podeDesignarCoordenador } from '../utils/roles';

const ALUNOLinks = [
  { to: '/portal',             label: 'Início',      icon: <Home size={16} /> },
  { to: '/portal/faltas',      label: 'Faltas',      icon: <AlertTriangle size={16} /> },
  { to: '/portal/calendario',  label: 'Calendário',  icon: <Calendar size={16} /> },
  { to: '/portal/mensagens',   label: 'Mensagens',   icon: <MessageCircle size={16} /> },
  { to: '/portal/materiais',   label: 'Materiais',   icon: <BookOpen size={16} /> },
  { to: '/portal/plano-curricular', label: 'Plano', icon: <FileText size={16} /> },
  { to: '/portal/documentos',  label: 'Documentos',  icon: <FileText size={16} /> },
  { to: '/portal/perfil',      label: 'Perfil',      icon: <User size={16} /> },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchCount = () => {
      api.get('/notificacoes').then(res => {
        setNotifCount(res.data.filter(n => !n.lida).length);
      }).catch(() => {});
    };
    fetchCount();
    // Poll a cada 30 segundos para actualizar o badge
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => { logout(); navigate('/'); };
  const isActive = (to) => location.pathname === to;

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
        <div className="logo-icon"><GraduationCap size={22} color="white" /></div>
        <span>Colégio Mara & Lu</span>
      </Link>

      <div className="navbar-links">
        {!user ? (
          <>
            <Link to="/">Início</Link>
            <Link to="/login">Entrar</Link>
            <Link to="/inscricao" className="btn-nav-primary">Inscrever-se</Link>
          </>
        ) : podeAcederInformacaoGeral(user) ? (
          <>
            <Link to="/admin">Dashboard</Link>
            <Link to="/admin/inscricoes">Inscrições</Link>
            {podeDesignarCoordenador(user) && <Link to="/admin/usuarios">{user.role === 'admin' ? 'Usuários' : 'Equipa'}</Link>}
            {user.role === 'admin' && <Link to="/admin/series">Séries</Link>}
            <Link to="/admin/academico">Académico</Link>
            {podeEditarNotas(user) && <Link to="/admin/notas">Notas</Link>}
            <Link to="/admin/perfil">Perfil</Link>
            <button onClick={handleLogout}><LogOut size={16} /> Sair</button>
          </>
        ) : user.role === 'aluno' ? (
          <>
            {ALUNOLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  color: isActive(link.to) ? 'var(--laranja-claro)' : 'var(--bege)',
                  textDecoration: 'none', padding: '8px 12px', borderRadius: 8,
                  fontSize: '0.88rem', fontWeight: isActive(link.to) ? 600 : 500,
                  transition: 'all 0.2s',
                  background: isActive(link.to) ? 'rgba(232,100,26,0.2)' : 'transparent',
                  position: 'relative'
                }}
              >
                {link.icon}
                {link.label}
                {link.to === '/portal/mensagens' && notifCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    background: 'var(--vermelho)', color: '#fff',
                    borderRadius: '50%', width: 16, height: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700
                  }}>{notifCount}</span>
                )}
              </Link>
            ))}
            <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <LogOut size={16} /> Sair
            </button>
          </>
        ) : user.role === 'professor' ? (
          <>
            {podeEditarNotas(user) && (
              <>
                <Link to="/admin">Coordenação</Link>
                <Link to="/admin/notas">Notas (coord.)</Link>
              </>
            )}
            <Link
              to="/professor"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                color: isActive('/professor') ? 'var(--laranja-claro)' : 'var(--bege)',
                textDecoration: 'none', padding: '8px 12px', borderRadius: 8,
                fontSize: '0.88rem', fontWeight: isActive('/professor') ? 600 : 500,
                transition: 'all 0.2s',
                background: isActive('/professor') ? 'rgba(232,100,26,0.2)' : 'transparent'
              }}
            >
              <BookOpen size={16} /> Painel do Professor
            </Link>
            <Link to="/professor/perfil">Perfil</Link>
            <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <LogOut size={16} /> Sair
            </button>
          </>
        ) : (
          <>
            <Link to="/portal">Meu Portal</Link>
            <Link to="/portal/alunos">Meus Alunos</Link>
            <Link to="/portal/inscricoes">Inscrições</Link>
            <Link to="/portal/notificacoes" style={{ position: 'relative' }}>
              <Bell size={18} />
              {notifCount > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -4, background: 'var(--vermelho)', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                  {notifCount}
                </span>
              )}
            </Link>
            <button onClick={handleLogout}><LogOut size={16} /> Sair</button>
          </>
        )}
      </div>
    </nav>
  );
}