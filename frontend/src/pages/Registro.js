import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function Registro() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmarSenha: '', telefone: '', cpf: '', endereco: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState(1);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const nextStep = e => {
    e.preventDefault();
    if (!form.nome || !form.email) return setError('Preencha nome e e-mail.');
    if (step === 1) { setError(''); setStep(2); }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (form.senha !== form.confirmarSenha) return setError('As senhas não coincidem.');
    if (form.senha.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.');
    setError(''); setLoading(true);
    try {
      await register(form);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao criar conta.');
    } finally { setLoading(false); }
  };

  if (success) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--castanho), var(--castanho-medio))', padding: '2rem' }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <CheckCircle size={56} color="var(--verde)" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ color: 'var(--castanho)', marginBottom: '0.5rem' }}>Conta criada!</h2>
        <p style={{ color: 'var(--cinza)', marginBottom: '1.5rem' }}>Sua conta foi criada com sucesso. Redirecionando para o login...</p>
        <Link to="/login" className="btn btn-primary btn-full">Ir para o Login</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--castanho) 0%, var(--castanho-medio) 100%)', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 500 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 64, height: 64, background: 'var(--laranja)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <GraduationCap size={32} color="white" />
          </div>
          <h2 style={{ color: 'white', fontSize: '1.8rem' }}>Criar Conta</h2>
          <p style={{ color: 'var(--bege)', marginTop: 4 }}>Passo {step} de 2</p>
        </div>

        {/* Step indicator */}
        <div className="steps" style={{ marginBottom: '1.5rem' }}>
          <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
            <div className="step-circle">{step > 1 ? '✓' : '1'}</div>
          </div>
          <div className="step-line" />
          <div className={`step ${step >= 2 ? 'active' : ''}`}>
            <div className="step-circle">2</div>
          </div>
        </div>

        <div className="card">
          {error && <div className="alert alert-error">{error}</div>}

          {step === 1 ? (
            <form onSubmit={nextStep}>
              <h3 style={{ marginBottom: '1.5rem', color: 'var(--castanho)' }}>Dados Pessoais</h3>
              <div className="form-group">
                <label className="form-label">Nome Completo *</label>
                <input name="nome" className="form-control" placeholder="Seu nome completo" value={form.nome} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail *</label>
                <input name="email" type="email" className="form-control" placeholder="seu@email.com" value={form.email} onChange={handleChange} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input name="telefone" className="form-control" placeholder="+244 9xx xxx xxx" value={form.telefone} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">BI / NIF</label>
                  <input name="cpf" className="form-control" placeholder="Número do BI" value={form.cpf} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Endereço</label>
                <input name="endereco" className="form-control" placeholder="Rua, bairro, município" value={form.endereco} onChange={handleChange} />
              </div>
              <button type="submit" className="btn btn-primary btn-full">Próximo →</button>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <h3 style={{ marginBottom: '1.5rem', color: 'var(--castanho)' }}>Definir Senha</h3>
              <div className="form-group">
                <label className="form-label">Senha *</label>
                <div style={{ position: 'relative' }}>
                  <input name="senha" type={showPass ? 'text' : 'password'} className="form-control" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={handleChange} required style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza)' }}>
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar Senha *</label>
                <input name="confirmarSenha" type="password" className="form-control" placeholder="Repita a senha" value={form.confirmarSenha} onChange={handleChange} required />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>← Voltar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Criando...' : 'Criar Conta'}
                </button>
              </div>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--bege)' }}>
            <p style={{ color: 'var(--cinza)', fontSize: '0.9rem' }}>
              Já tem conta? <Link to="/login" style={{ color: 'var(--laranja)', fontWeight: 600 }}>Entrar</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
