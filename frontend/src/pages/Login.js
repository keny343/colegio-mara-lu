import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Button, Input, FormField } from '../components/ui';
import { getErrorMessage } from '../services/errors';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(form.email, form.senha);
      navigate(['admin', 'coordenador'].includes(u.role) ? '/admin' : u.role === 'professor' ? '/professor' : '/portal');
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível iniciar sessão. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-aside" aria-label="Bem-vindo">
        <Link to="/" className="auth-back">
          <ArrowLeft size={16} strokeWidth={2} />
          Início
        </Link>
        <div className="auth-aside-body">
          <p className="auth-kicker">Área reservada</p>
          <h1 className="auth-brand">
            <span>Colégio</span>
            <span className="auth-brand-em">Mara &amp; Lu</span>
          </h1>
          <p className="auth-lede">
            Aceda ao portal de alunos, encarregados e equipa académica.
          </p>
        </div>
        <p className="auth-aside-foot">Desde 2005 · Luanda</p>
      </aside>

      <main className="auth-main">
        <div className="auth-panel">
          <header className="auth-panel-head">
            <div className="auth-mark" aria-hidden="true">ML</div>
            <h2>Entrar</h2>
            <p>Use o e-mail institucional ou o BI do aluno.</p>
          </header>

          <form onSubmit={handleSubmit} noValidate className="auth-form">
            {error && <div className="alert alert-error" role="alert">{error}</div>}

            <FormField label="E-mail ou BI" htmlFor="login-email" required>
              <Input
                id="login-email"
                name="email"
                type="text"
                placeholder="seu@email.com ou nº do BI"
                value={form.email}
                onChange={handleChange}
                autoComplete="username"
                required
              />
            </FormField>

            <FormField label="Senha" htmlFor="login-senha" required>
              <div className="password-wrap">
                <Input
                  id="login-senha"
                  name="senha"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.senha}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPass}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </FormField>

            <Button type="submit" variant="primary" block loading={loading}>
              {loading ? 'A entrar...' : 'Entrar'}
            </Button>
          </form>

          <p className="auth-footer">
            Ainda não se inscreveu? <Link to="/inscricao">Fazer inscrição</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
