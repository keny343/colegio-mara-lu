import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, BookOpen, FileUp, LogOut, FileCheck, AlertTriangle, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { podeEditarNotas } from '../utils/roles';
import SidebarUserBlock from './SidebarUserBlock';
import MobileDrawer from './MobileDrawer';
import api from '../services/api';

export default function ProfessorSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isProfessorCoord = user?.role === 'professor' && (user?.curso_coordenado || user?.nivel_coordenado);

  const [notifCount, setNotifCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    const fetch = () => api.get('/notificacoes').then(r => setNotifCount(r.data.filter(n => !n.lida).length)).catch(() => {});
    fetch();
    const t = setInterval(fetch, 30000);
    return () => clearInterval(t);
  }, [user]);

  const sair = () => { logout(); navigate('/'); };

  const notifBadge = notifCount > 0 && (
    <span style={{
      marginLeft: 'auto', background: 'var(--laranja)', color: '#fff',
      borderRadius: 10, padding: '0 6px', fontSize: '0.72rem',
      fontWeight: 700, minWidth: 18, textAlign: 'center', lineHeight: '18px',
    }}>{notifCount}</span>
  );

  const nav = (
    <>
      <NavLink to="/professor" end className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
        <LayoutDashboard size={18} /> Dashboard
      </NavLink>
      <NavLink to="/professor/notas" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
        <ClipboardList size={18} /> Lançar notas
      </NavLink>
      <NavLink to="/professor/materiais" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
        <FileUp size={18} /> Materiais
      </NavLink>
      <NavLink to="/professor/plano-curricular" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
        <BookOpen size={18} /> Plano curricular
      </NavLink>
      <NavLink to="/professor/justificacoes" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
        <FileCheck size={18} /> Justificações
      </NavLink>
      <NavLink to="/professor/faltas" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
        <AlertTriangle size={18} /> Registar Faltas
      </NavLink>
      <NavLink to="/professor/mensagens" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`} style={{ position: 'relative' }}>
        <MessageCircle size={18} /> Mensagens
        {notifBadge}
      </NavLink>
      {isProfessorCoord && podeEditarNotas(user) && (
        <NavLink to="/admin/notas" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <BookOpen size={18} /> Notas (coord.)
        </NavLink>
      )}
      {isProfessorCoord && (
        <NavLink to="/admin" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={18} /> Coordenação
        </NavLink>
      )}
    </>
  );

  return (
    <>
      <MobileDrawer ariaLabel="Menu de navegação">
        <SidebarUserBlock user={user} perfilPath="/professor/perfil" />
        {nav}
        <button type="button" className="admin-sidebar-logout mobile-drawer-logout" onClick={sair} aria-label="Sair">
          <LogOut size={18} /> Sair
        </button>
      </MobileDrawer>

      <aside className="admin-sidebar">
        <SidebarUserBlock user={user} perfilPath="/professor/perfil" />
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