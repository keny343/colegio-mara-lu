import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { Button, Input, FormField } from '../components/ui';
import './LoginLamp.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [lampOn, setLampOn] = useState(true);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!lampOn) return;
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
    <div className={`lamp-screen ${lampOn ? 'is-on' : ''}`}>
      <div className="lamp-rig">
        <div className="lamp-wire" aria-hidden="true"></div>
        <button
          type="button"
          className="lamp-fixture"
          onClick={() => setLampOn((v) => !v)}
          aria-pressed={lampOn}
          aria-label={lampOn ? 'Apagar candeeiro e ocultar o formulário' : 'Acender candeeiro e mostrar o formulário'}
        >
          <svg viewBox="0 0 160 140" className="lamp-svg">
            <polygon points="50,10 110,10 140,70 20,70" className="lamp-shade" />
            <line x1="80" y1="70" x2="80" y2="66" className="lamp-neck" />
            <ellipse cx="80" cy="86" rx="22" ry="22" className="lamp-bulb" />
          </svg>
          <span className="pull-cord"><span className="pull-knob"></span></span>
        </button>
        <div className="light-cone" aria-hidden="true"></div>
        <p className="lamp-hint">{lampOn ? 'Toca no candeeiro para apagar' : 'Toca no candeeiro para acender'}</p>
      </div>

      <div className="login-card-wrap" aria-hidden={!lampOn}>
        <div className="card login-card">
          <div className="login-header">
            <div className="login-icon">
              <GraduationCap size={28} color="white" />
            </div>
            <h2 className="login-title">Colégio Mara &amp; Lu</h2>
            <p className="login-subtitle">Entre na sua conta</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {error && <div className="alert alert-error" role="alert">{error}</div>}

            <FormField label="E-mail ou BI" htmlFor="login-email" required>
              <Input
                id="login-email"
                name="email"
                type="text"
                placeholder="seu@email.com ou nº do BI"
                value={form.email}
                onChange={handleChange}
                tabIndex={lampOn ? 0 : -1}
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
                  tabIndex={lampOn ? 0 : -1}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={lampOn ? 0 : -1}
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPass}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </FormField>

            <Button type="submit" variant="primary" block loading={loading} tabIndex={lampOn ? 0 : -1}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="login-footer">
            <p>
              Ainda não se inscreveu? <Link to="/inscricao" tabIndex={lampOn ? 0 : -1}>Fazer inscrição</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
