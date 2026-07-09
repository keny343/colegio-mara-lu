import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import './LoginLamp.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [lampOn, setLampOn] = useState(true);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
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
          onClick={() => setLampOn(v => !v)}
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
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: 56, height: 56, background: 'var(--laranja)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
              <GraduationCap size={28} color="white" />
            </div>
            <h2 style={{ fontSize: '1.5rem' }}>Colégio Mara & Lu</h2>
            <p style={{ color: 'var(--cinza)', marginTop: 4 }}>Entre na sua conta</p>
          </div>

          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">E-mail ou BI</label>
              <input name="email" type="text" className="form-control" placeholder="seu@email.com ou nº do BI" value={form.email} onChange={handleChange} tabIndex={lampOn ? 0 : -1} required />
            </div>

            <div className="form-group">
              <label className="form-label">Senha</label>
              <div style={{ position: 'relative' }}>
                <input name="senha" type={showPass ? 'text' : 'password'} className="form-control" placeholder="••••••••" value={form.senha} onChange={handleChange} tabIndex={lampOn ? 0 : -1} required style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} tabIndex={lampOn ? 0 : -1} aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza)' }}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading} tabIndex={lampOn ? 0 : -1}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--bege)' }}>
            <p style={{ color: 'var(--cinza)', fontSize: '0.9rem' }}>
              Ainda não se inscreveu? <Link to="/inscricao" tabIndex={lampOn ? 0 : -1} style={{ color: 'var(--laranja)', fontWeight: 600 }}>Fazer inscrição</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}