import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--castanho) 0%, var(--castanho-medio) 100%)', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 64, height: 64, background: 'var(--laranja)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <GraduationCap size={32} color="white" />
          </div>
          <h2 style={{ color: 'white', fontSize: '1.8rem' }}>Colégio Mara & Lu</h2>
          <p style={{ color: 'var(--bege)', marginTop: 4 }}>Entre na sua conta</p>
        </div>

        <div className="card">
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
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza)' }}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--bege)' }}>
            <p style={{ color: 'var(--cinza)', fontSize: '0.9rem' }}>
              Ainda não se inscreveu? <Link to="/inscricao" style={{ color: 'var(--laranja)', fontWeight: 600 }}>Fazer inscrição</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
