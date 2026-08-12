import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, BookOpen, School, ClipboardList, FileUp, LogOut, MessageCircle } from 'lucide-react';
import { podeEditarNotas } from '../utils/roles';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import SidebarUserBlock from './SidebarUserBlock';
import MobileDrawer from './MobileDrawer';

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadCount: notifCount } = useNotification();

  const isAdmin = user?.role === 'admin';
  const isCoordenador = user?.role === 'coordenador';
  const isProfessorCoord = user?.role === 'professor' && (user?.curso_coordenado || user?.nivel_coordenado);

  const sair = () => {
    logout();
    navigate('/');
  };

  const notifBadge = notifCount > 0 && (
    <span style={{
      marginLeft: 'auto', background: 'var(--laranja)', color: '#fff',
      borderRadius: 10, padding: '0 6px', fontSize: '0.72rem',
      fontWeight: 700, minWidth: 18, textAlign: 'center', lineHeight: '18px',
    }}>{notifCount}</span>
  );

  const nav = (
    <>
      <NavLink to="/admin" end className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
        <LayoutDashboard size={18} /> Dashboard
      </NavLink>
      <NavLink to="/admin/inscricoes" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
        <FileText size={18} /> Inscrições
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin/series" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <BookOpen size={18} /> Classes / Cursos
        </NavLink>
      )}
      {(isAdmin || isCoordenador || isProfessorCoord) && (
        <NavLink to="/admin/usuarios" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <Users size={18} /> {isAdmin ? 'Usuários' : 'Equipa'}
        </NavLink>
      )}
      {(isAdmin || isCoordenador || isProfessorCoord) && (
        <NavLink to="/admin/academico" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <School size={18} /> Académico
        </NavLink>
      )}
      {(isCoordenador || isProfessorCoord) && (
        <NavLink to="/admin/plano-curricular" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <FileUp size={18} /> Plano curricular
        </NavLink>
      )}
      {podeEditarNotas(user) && (
        <NavLink to="/admin/notas" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <ClipboardList size={18} /> Notas
        </NavLink>
      )}
      <NavLink to="/admin/mensagens" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`} style={{ position: 'relative' }}>
        <MessageCircle size={18} /> Mensagens
        {notifBadge}
      </NavLink>
    </>
  );

  return (
    <>
      <MobileDrawer ariaLabel="Menu de navegação">
        <SidebarUserBlock user={user} perfilPath="/admin/perfil" />
        {nav}
        <button type="button" className="admin-sidebar-logout mobile-drawer-logout" onClick={sair} aria-label="Sair">
          <LogOut size={18} /> Sair
        </button>
      </MobileDrawer>

      <aside className="admin-sidebar">
        <SidebarUserBlock user={user} perfilPath="/admin/perfil" />
        <nav className="admin-sidebar-nav">{nav}</nav>
        <div className="admin-sidebar-footer">
          <button type="button" className="admin-sidebar-logout" onClick={sair} aria-label="Sair">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>
    </>
  );
}
