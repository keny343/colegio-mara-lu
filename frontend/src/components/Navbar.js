import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import {
  Bell, LogOut, GraduationCap, Menu, X, Home, BookOpen, Calendar,
  MessageCircle, FileText, AlertTriangle, User, Users, ClipboardList,
  School, BookMarked, LayoutDashboard
} from 'lucide-react';
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
  const { unreadCount: notifCount } = useNotification();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => { await logout(); navigate('/'); };
  const isActive = (to) => location.pathname === to;

  const buildLinks = () => {
    if (!user) {
      return [
        { to: '/', label: 'Início', icon: <Home size={16} /> },
        { to: '/login', label: 'Entrar', icon: <User size={16} /> },
        { to: '/inscricao', label: 'Inscrever-se', icon: <School size={16} />, primary: true },
      ];
    }
    if (podeAcederInformacaoGeral(user)) {
      const links = [
        { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
        { to: '/admin/inscricoes', label: 'Inscrições', icon: <ClipboardList size={16} /> },
      ];
      if (podeDesignarCoordenador(user)) {
        links.push({ to: '/admin/usuarios', label: user.role === 'admin' ? 'Usuários' : 'Equipa', icon: <Users size={16} /> });
      }
      if (user.role === 'admin') {
        links.push({ to: '/admin/series', label: 'Séries', icon: <School size={16} /> });
      }
      links.push({ to: '/admin/academico', label: 'Académico', icon: <BookOpen size={16} /> });
      if (podeEditarNotas(user)) {
        links.push({ to: '/admin/notas', label: 'Notas', icon: <BookMarked size={16} /> });
      }
      links.push({ to: '/admin/perfil', label: 'Perfil', icon: <User size={16} /> });
      return links;
    }
    if (user.role === 'aluno') {
      return ALUNOLinks.map(l => ({ ...l, badge: l.to === '/portal/mensagens' ? notifCount : 0 }));
    }
    if (user.role === 'professor') {
      const links = [];
      if (podeEditarNotas(user)) {
        links.push({ to: '/admin', label: 'Coordenação', icon: <LayoutDashboard size={16} /> });
        links.push({ to: '/admin/notas', label: 'Notas (coord.)', icon: <BookMarked size={16} /> });
      }
      links.push({ to: '/professor', label: 'Painel do Professor', icon: <LayoutDashboard size={16} /> });
      links.push({ to: '/professor/perfil', label: 'Perfil', icon: <User size={16} /> });
      return links;
    }
    return [
      { to: '/portal', label: 'Meu Portal', icon: <Home size={16} /> },
      { to: '/portal/alunos', label: 'Meus Alunos', icon: <Users size={16} /> },
      { to: '/portal/inscricoes', label: 'Inscrições', icon: <ClipboardList size={16} /> },
      { to: '/portal/notificacoes', label: 'Notificações', icon: <Bell size={16} />, badge: notifCount },
    ];
  };

  const links = buildLinks();

  const NavLinks = ({ mobile = false }) => (
    <>
      {links.map(link => (
        <Link
          key={link.to}
          to={link.to}
          className={`nav-item${isActive(link.to) ? ' nav-item-active' : ''}${link.primary ? ' nav-item-primary' : ''}`}
        >
          {link.icon}
          <span>{link.label}</span>
          {link.badge > 0 && (
            <span className="nav-badge">{link.badge > 99 ? '99+' : link.badge}</span>
          )}
        </Link>
      ))}
      <button onClick={handleLogout} className="nav-item nav-item-logout">
        <LogOut size={16} /> <span>Sair</span>
      </button>
    </>
  );

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
        <div className="logo-icon"><GraduationCap size={22} color="white" /></div>
        <span>Colégio Mara & Lu</span>
      </Link>

      <div className="navbar-links">
        <NavLinks />
      </div>

      <button
        className="navbar-toggle"
        aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(o => !o)}
      >
        {menuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {menuOpen && (
        <>
          <div className="navbar-overlay" onClick={() => setMenuOpen(false)} />
          <div className="navbar-mobile">
            <NavLinks mobile />
          </div>
        </>
      )}
    </nav>
  );
}
