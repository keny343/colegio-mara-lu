import React from 'react';
import ProfessorSidebar from '../components/ProfessorSidebar';

export default function ProfessorLayout({ children }) {
  return (
    <div className="admin-shell">
      <ProfessorSidebar />
      <main className="admin-main">{children}</main>
    </div>
  );
}
