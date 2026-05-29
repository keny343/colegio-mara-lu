import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './index.css';

import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Registro from './pages/Registro';
import InscricaoPublica from './pages/InscricaoPublica';
import Portal from './pages/Portal';
import MeusAlunos from './pages/MeusAlunos';
import MinhasInscricoes from './pages/MinhasInscricoes';
import Notificacoes from './pages/Notificacoes';
import PortalMateriais from './pages/PortalMateriais';
import AdminDashboard from './pages/AdminDashboard';
import AdminInscricoes from './pages/AdminInscricoes';
import { AdminUsuarios, AdminSeries } from './pages/AdminPages';
import AdminLayout from './layouts/AdminLayout';
import ProfessorLayout from './layouts/ProfessorLayout';
import ProfessorDashboard from './pages/ProfessorDashboard';
import ProfessorMateriais from './pages/ProfessorMateriais';
import PlanoCurricular from './pages/PlanoCurricular';
import AdminAcademico from './pages/AdminAcademico';
import CoordenadorNotas from './pages/CoordenadorNotas';
import { podeAcederNotas, podeEditarNotas, podeAcederInformacaoGeral } from './utils/roles';

function PerfilPortal() {
  const { user } = useAuth();
  if (!user) return <Perfil />;
  if (user.role === 'professor' && !user.curso_coordenado && !user.nivel_coordenado) {
    return <Navigate to="/professor/perfil" replace />;
  }
  if (['admin', 'coordenador', 'professor'].includes(user.role)) {
    return <Navigate to="/admin/perfil" replace />;
  }
  return <Perfil />;
}

import Perfil from './pages/Perfil';
import Calendario from './pages/Calendario';
import Mensagens from './pages/Mensagens';
import Documentos from './pages/Documentos';
import Faltas from './pages/Faltas';
import ProfessorFaltas from './pages/ProfessorFaltas';
import ProfessorJustificacoes from './pages/ProfessorJustificacoes';

const PrivateRoute = ({ children, adminOnly = false, staffOnly = false, professorOnly = false, notasOnly = false }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (notasOnly && !podeAcederNotas(user)) return <Navigate to="/portal" />;
  if (staffOnly && !podeAcederInformacaoGeral(user)) return <Navigate to="/portal" />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/portal" />;
  if (professorOnly && user.role !== 'professor') return <Navigate to="/portal" />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (user) {
    const destino = user.role === 'admin' || user.role === 'coordenador'
      ? '/admin'
      : user.role === 'professor' && (user.curso_coordenado || user.nivel_coordenado)
        ? '/admin'
        : user.role === 'professor'
          ? '/professor'
          : '/portal';
    return <Navigate to={destino} />;
  }
  return children;
};

function AppRoutes() {
  return (
    <>
      <NavbarConditional />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/inscricao" element={<InscricaoPublica />} />
        <Route path="/registro" element={<Navigate to="/inscricao" />} />

        <Route path="/portal"             element={<PrivateRoute><Portal /></PrivateRoute>} />
        <Route path="/portal/perfil"      element={<PrivateRoute><PerfilPortal /></PrivateRoute>} />
        <Route path="/portal/calendario"  element={<PrivateRoute><Calendario /></PrivateRoute>} />
        <Route path="/portal/mensagens"   element={<PrivateRoute><Mensagens /></PrivateRoute>} />
        <Route path="/portal/documentos"  element={<PrivateRoute><Documentos /></PrivateRoute>} />
        <Route path="/portal/faltas"      element={<PrivateRoute><Faltas /></PrivateRoute>} />
        <Route path="/portal/materiais"  element={<PrivateRoute><PortalMateriais /></PrivateRoute>} />
        <Route path="/portal/plano-curricular" element={<PrivateRoute><PlanoCurricular /></PrivateRoute>} />

        <Route path="/portal/alunos"          element={<PrivateRoute><MeusAlunos /></PrivateRoute>} />
        <Route path="/portal/alunos/novo"     element={<PrivateRoute><MeusAlunos /></PrivateRoute>} />
        <Route path="/portal/inscricoes"      element={<PrivateRoute><MinhasInscricoes /></PrivateRoute>} />
        <Route path="/portal/inscricoes/nova" element={<PrivateRoute><MinhasInscricoes /></PrivateRoute>} />
        <Route path="/portal/notificacoes"    element={<PrivateRoute><Notificacoes /></PrivateRoute>} />

        <Route path="/admin"            element={<PrivateRoute staffOnly><AdminLayout><AdminDashboard /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/inscricoes" element={<PrivateRoute staffOnly><AdminLayout><AdminInscricoes /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/usuarios"   element={<PrivateRoute staffOnly><AdminLayout><AdminUsuarios /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/series"     element={<PrivateRoute adminOnly><AdminLayout><AdminSeries /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/academico"  element={<PrivateRoute staffOnly><AdminLayout><AdminAcademico /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/notas"      element={<PrivateRoute notasOnly><AdminLayout><CoordenadorNotas /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/plano-curricular" element={<PrivateRoute staffOnly><AdminLayout><PlanoCurricular /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/perfil" element={<PrivateRoute staffOnly><AdminLayout><Perfil /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/mensagens" element={<PrivateRoute staffOnly><AdminLayout><Mensagens /></AdminLayout></PrivateRoute>} />

        <Route path="/professor" element={<PrivateRoute professorOnly><ProfessorLayout><ProfessorDashboard /></ProfessorLayout></PrivateRoute>} />
        <Route path="/professor/notas" element={<PrivateRoute professorOnly><ProfessorLayout><CoordenadorNotas modoProfessor /></ProfessorLayout></PrivateRoute>} />
        <Route path="/professor/materiais" element={<PrivateRoute professorOnly><ProfessorLayout><ProfessorMateriais /></ProfessorLayout></PrivateRoute>} />
        <Route path="/professor/perfil" element={<PrivateRoute professorOnly><ProfessorLayout><Perfil /></ProfessorLayout></PrivateRoute>} />
        <Route path="/professor/justificacoes" element={<PrivateRoute professorOnly><ProfessorLayout><ProfessorJustificacoes /></ProfessorLayout></PrivateRoute>} />
        <Route path="/professor/faltas" element={<PrivateRoute professorOnly><ProfessorLayout><ProfessorFaltas /></ProfessorLayout></PrivateRoute>} />
        <Route path="/professor/plano-curricular" element={<PrivateRoute professorOnly><ProfessorLayout><PlanoCurricular /></ProfessorLayout></PrivateRoute>} />
        <Route path="/professor/mensagens" element={<PrivateRoute professorOnly><ProfessorLayout><Mensagens /></ProfessorLayout></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

function NavbarConditional() {
  const location = useLocation();
  const { user, loading } = useAuth();
  if (loading) return null;
  const prefixosSemNavbar = ['/login', '/registro', '/inscricao', '/admin', '/professor'];
  if (prefixosSemNavbar.some((p) => location.pathname.startsWith(p))) return null;
  if (user && ['admin', 'coordenador', 'professor'].includes(user.role)) return null;
  return <Navbar />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}