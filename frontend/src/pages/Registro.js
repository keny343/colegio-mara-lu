import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, Eye, EyeOff, CheckCircle, ArrowRight } from 'lucide-react';
import { Button, Card, FormField, Input } from '../components/ui';
import './Registro.css';

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
    <div className="registro-screen">
      <Card className="registro-card registro-card--sucesso">
        <CheckCircle size={56} className="registro-sucesso-icone" />
        <h2 className="registro-sucesso-titulo">Conta criada!</h2>
        <p className="registro-sucesso-texto">Sua conta foi criada com sucesso. Redirecionando para o login...</p>
        <Link to="/login" className="btn btn-primary btn-full">Ir para o Login</Link>
      </Card>
    </div>
  );

  return (
    <div className="registro-screen">
      <div className="registro-wrap">
        <div className="registro-head">
          <div className="registro-logo">
            <GraduationCap size={32} color="white" />
          </div>
          <h2 className="registro-titulo">Criar Conta</h2>
          <p className="registro-subtitulo">Passo {step} de 2</p>
        </div>

        <div className="steps">
          <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
            <div className="step-circle">{step > 1 ? '✓' : '1'}</div>
          </div>
          <div className="step-line" />
          <div className={`step ${step >= 2 ? 'active' : ''}`}>
            <div className="step-circle">2</div>
          </div>
        </div>

        <Card className="registro-card">
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          {step === 1 ? (
            <form onSubmit={nextStep}>
              <h3 className="registro-section-titulo">Dados Pessoais</h3>
              <FormField label="Nome Completo *" htmlFor="reg-nome" required>
                <Input id="reg-nome" name="nome" placeholder="Seu nome completo" value={form.nome} onChange={handleChange} autoComplete="name" required />
              </FormField>
              <FormField label="E-mail *" htmlFor="reg-email" required>
                <Input id="reg-email" name="email" type="email" placeholder="seu@email.com" value={form.email} onChange={handleChange} autoComplete="email" required />
              </FormField>
              <div className="form-row">
                <FormField label="Telefone" htmlFor="reg-telefone">
                  <Input id="reg-telefone" name="telefone" placeholder="+244 9xx xxx xxx" value={form.telefone} onChange={handleChange} autoComplete="tel" />
                </FormField>
                <FormField label="BI / NIF" htmlFor="reg-cpf">
                  <Input id="reg-cpf" name="cpf" placeholder="Número do BI" value={form.cpf} onChange={handleChange} />
                </FormField>
              </div>
              <FormField label="Endereço" htmlFor="reg-endereco">
                <Input id="reg-endereco" name="endereco" placeholder="Rua, bairro, município" value={form.endereco} onChange={handleChange} autoComplete="street-address" />
              </FormField>
              <Button type="submit" variant="primary" block icon={<ArrowRight size={16} />}>Próximo</Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <h3 className="registro-section-titulo">Definir Senha</h3>
              <FormField label="Senha *" htmlFor="reg-senha" required>
                <div className="password-wrap">
                  <Input id="reg-senha" name="senha" type={showPass ? 'text' : 'password'} className="password-input" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={handleChange} autoComplete="new-password" required />
                  <button type="button" className="password-toggle" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}>
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormField>
              <FormField label="Confirmar Senha *" htmlFor="reg-confirmar" required>
                <Input id="reg-confirmar" name="confirmarSenha" type="password" placeholder="Repita a senha" value={form.confirmarSenha} onChange={handleChange} autoComplete="new-password" required />
              </FormField>
              <div className="registro-acoes">
                <Button variant="outline" onClick={() => setStep(1)}>← Voltar</Button>
                <Button type="submit" variant="primary" block loading={loading}>
                  {loading ? 'Criando...' : 'Criar Conta'}
                </Button>
              </div>
            </form>
          )}

          <div className="registro-footer">
            <p>
              Já tem conta? <Link to="/login">Entrar</Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
