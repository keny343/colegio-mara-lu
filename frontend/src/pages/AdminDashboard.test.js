import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import AdminDashboard from './AdminDashboard';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin', nome: 'Ana Maria' } }),
}));

jest.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({ error: jest.fn(), success: jest.fn() }),
}));

jest.mock('../hooks/useFetch', () => ({ useFetch: jest.fn() }));

jest.mock('recharts', () => {
  const React = require('react');
  const Container = ({ children }) => React.createElement('div', null, children);
  const Empty = () => null;

  return {
    Bar: Empty,
    BarChart: Container,
    CartesianGrid: Empty,
    Cell: Empty,
    Legend: Empty,
    Pie: Empty,
    PieChart: Container,
    ResponsiveContainer: Container,
    Tooltip: Empty,
    XAxis: Empty,
    YAxis: Empty,
  };
});

const dashboardData = {
  inscricoes: {
    pendentes: 0,
    em_analise: 0,
    aprovadas: 0,
    rejeitadas: 0,
    total: 0,
  },
  por_serie: [],
  total_usuarios: 0,
  total_alunos: 0,
};

describe('AdminDashboard', () => {
  beforeEach(() => {
    useFetch.mockReturnValue({
      data: dashboardData,
      loading: false,
      error: null,
      refetch: jest.fn(),
      setData: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('exposes the student reports action in the admin dashboard', () => {
    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    const reportsLink = screen.getByRole('link', { name: /relatórios de alunos e notas/i });

    expect(reportsLink).toHaveAttribute('href', '/admin/relatorios');
  });
});
