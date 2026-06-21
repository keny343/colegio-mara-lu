import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(form.email, form.senha);
      navigate(['admin', 'coordenador'].includes(u.role) ? '/admin' : u.role === 'professor' ? '/professor' : '/portal');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        (err.request ? 'Não foi possível conectar ao servidor. Verifique se o backend está ligado.' : err.message) ||
        'Credenciais inválidas.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-login-screen">
      <div className="lp-login-grid-bg" aria-hidden="true"></div>
      <div className="lp-login-box">
        <div className="lp-login-head">
          <div className="lp-login-mark">
            <GraduationCap size={28} color="white" />
          </div>
          <span className="lp-login-eyebrow">Acesso ao portal</span>
          <h2>Colégio Mara &amp; Lu</h2>
          <p>Entre na sua conta</p>
        </div>

        <div className="lp-login-card">
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">E-mail ou BI</label>
              <input name="email" type="text" className="form-control" placeholder="seu@email.com ou nº do BI" value={form.email} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Senha</label>
              <div style={{ position: 'relative' }}>
                <input name="senha" type={showPass ? 'text' : 'password'} className="form-control" placeholder="••••••••" value={form.senha} onChange={handleChange} required style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="lp-pass-toggle">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="lp-login-footer">
            <p>
              Ainda não se inscreveu? <Link to="/inscricao">Fazer inscrição</Link>
            </p>
          </div>
        </div>

        <Link to="/" className="lp-login-back">← voltar ao início</Link>
      </div>
    </div>
  );
}