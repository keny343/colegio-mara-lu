import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, BookOpen, School, ClipboardList, FileUp, LogOut, MessageCircle } from 'lucide-react';
import { podeEditarNotas } from '../utils/roles';
import { useAuth } from '../contexts/AuthContext';
import SidebarUserBlock from './SidebarUserBlock';
import api from '../services/api';

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const isCoordenador = user?.role === 'coordenador';
  const isProfessorCoord = user?.role === 'professor' && (user?.curso_coordenado || user?.nivel_coordenado);

  const [notifCount, setNotifCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    const fetch = () => api.get('/notificacoes').then(r => setNotifCount(r.data.filter(n => !n.lida).length)).catch(() => {});
    fetch();
    const t = setInterval(fetch, 30000);
    return () => clearInterval(t);
  }, [user]);

  const sair = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className="admin-sidebar">
      <SidebarUserBlock user={user} perfilPath="/admin/perfil" />

      <nav className="admin-sidebar-nav">
        <NavLink to="/admin" end className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={16} /> Dashboard
        </NavLink>
        <NavLink to="/admin/inscricoes" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
          <FileText size={16} /> Inscrições
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin/series" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
            <BookOpen size={16} /> Classes / Cursos
          </NavLink>
        )}
        {(isAdmin || isCoordenador || isProfessorCoord) && (
          <NavLink to="/admin/usuarios" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
            <Users size={16} /> {isAdmin ? 'Usuários' : 'Equipa'}
          </NavLink>
        )}
        {(isAdmin || isCoordenador || isProfessorCoord) && (
          <NavLink to="/admin/academico" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
            <School size={16} /> Académico
          </NavLink>
        )}
        {(isCoordenador || isProfessorCoord) && (
          <NavLink to="/admin/plano-curricular" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
            <FileUp size={16} /> Plano curricular
          </NavLink>
        )}
        {podeEditarNotas(user) && (
          <NavLink to="/admin/notas" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`}>
            <ClipboardList size={16} /> Notas
          </NavLink>
        )}
        <NavLink to="/admin/mensagens" className={({ isActive }) => `admin-navlink ${isActive ? 'active' : ''}`} style={{ position: 'relative' }}>
          <MessageCircle size={16} /> Mensagens
          {notifCount > 0 && (
            <span style={{
              marginLeft: 'auto', background: 'var(--laranja)', color: '#fff',
              borderRadius: 10, padding: '0 6px', fontSize: '0.72rem',
              fontWeight: 700, minWidth: 18, textAlign: 'center', lineHeight: '18px',
            }}>{notifCount}</span>
          )}
        </NavLink>
      </nav>

      <div className="admin-sidebar-footer">
        <button type="button" className="admin-sidebar-logout" onClick={sair}>
          <LogOut size={16} /> Sair
        </button>
      </div>
    </aside>
  );
}