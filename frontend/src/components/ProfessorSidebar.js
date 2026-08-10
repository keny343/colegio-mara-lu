import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, BookOpen, FileUp, LogOut, FileCheck, AlertTriangle, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { podeEditarNotas } from '../utils/roles';
import SidebarUserBlock from './SidebarUserBlock';
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

  return (
    <aside className="admin-sidebar">
      <SidebarUserBlock user={user} perfilPath="/professor/perfil" />

      <nav className="admin-sidebar-nav">
        <NavLink to="/professor" end className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={16} /> Dashboard
        </NavLink>
        <NavLink to="/professor/notas" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <ClipboardList size={16} /> Lançar notas
        </NavLink>
        <NavLink to="/professor/materiais" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <FileUp size={16} /> Materiais
        </NavLink>
        <NavLink to="/professor/plano-curricular" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <BookOpen size={16} /> Plano curricular
        </NavLink>
        <NavLink to="/professor/justificacoes" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <FileCheck size={16} /> Justificações
        </NavLink>
        <NavLink to="/professor/faltas" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <AlertTriangle size={16} /> Registar Faltas
        </NavLink>
        <NavLink to="/professor/mensagens" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`} style={{ position: 'relative' }}>
          <MessageCircle size={16} /> Mensagens
          {notifCount > 0 && (
            <span style={{
              marginLeft: 'auto', background: 'var(--laranja)', color: '#fff',
              borderRadius: 10, padding: '0 6px', fontSize: '0.72rem',
              fontWeight: 700, minWidth: 18, textAlign: 'center', lineHeight: '18px',
            }}>{notifCount}</span>
          )}
        </NavLink>
        {isProfessorCoord && podeEditarNotas(user) && (
          <NavLink to="/admin/notas" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
            <BookOpen size={16} /> Notas (coord.)
          </NavLink>
        )}
        {isProfessorCoord && (
          <NavLink to="/admin" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={16} /> Coordenação
          </NavLink>
        )}
      </nav>

      <div className="admin-sidebar-footer">
        <button type="button" className="admin-sidebar-logout" onClick={sair} aria-label="Sair">
          <LogOut size={16} /> Sair
        </button>
      </div>
    </aside>
  );
}