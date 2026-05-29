import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, FileCheck, Shield, Award, Clock, ChevronRight, Star } from 'lucide-react';

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <Star size={14} fill="currentColor" />
            Excelência em Educação desde 2005
          </div>
          <h1>
            Bem-vindo ao<br />
            <span>Colégio Mara & Lu</span>
          </h1>
          <p>
            Invista no futuro dos seus filhos. Faça a inscrição online de forma rápida,
            segura e transparente. Acompanhe todo o processo em tempo real.
          </p>
          <div className="hero-buttons">
            <Link to="/inscricao" className="btn btn-primary">
              Fazer Inscrição <ChevronRight size={18} />
            </Link>
            <Link to="/login" className="btn btn-secondary">
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section" style={{ background: 'var(--bege-claro)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 className="section-title">Como funciona?</h2>
          <p className="section-subtitle">
            Um processo simples e transparente para garantir a melhor educação para o seu filho
          </p>
          <div className="features-grid">
            {[
              { icon: <Users size={26} />, title: 'Faça a inscrição', desc: 'Preencha os dados do aluno e selecione a classe desejada.' },
              { icon: <BookOpen size={26} />, title: 'Aguarde a aprovação', desc: 'O colégio analisa e aprova a matrícula para ativar o acesso.' },
              { icon: <FileCheck size={26} />, title: 'Faça a inscrição', desc: 'Escolha a série desejada e envie os documentos necessários digitalmente.' },
              { icon: <Shield size={26} />, title: 'Aguarde a análise', desc: 'Nossa equipe analisa a documentação e aprova a matrícula com agilidade.' },
              { icon: <Award size={26} />, title: 'Matrícula confirmada', desc: 'Receba a confirmação por e-mail e notificação no sistema. Bem-vindo!' },
              { icon: <Clock size={26} />, title: 'Acompanhe em tempo real', desc: 'Veja o status da inscrição a qualquer momento, de qualquer lugar.' },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ background: 'linear-gradient(135deg, var(--castanho), var(--castanho-medio))' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ color: 'white', fontSize: '2rem', marginBottom: '1rem' }}>
            Pronto para garantir a vaga?
          </h2>
          <p style={{ color: 'var(--bege)', fontSize: '1.05rem', marginBottom: '2rem', lineHeight: 1.7 }}>
            As vagas são limitadas. Faça já a sua inscrição e garanta o lugar do seu filho no próximo ano letivo.
          </p>
          <Link to="/inscricao" className="btn btn-primary" style={{ fontSize: '1rem', padding: '16px 36px' }}>
            Começar agora <ChevronRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>© 2025 <strong>Colégio Mara & Lu</strong> — Todos os direitos reservados.</p>
        <p style={{ marginTop: 4 }}>Sistema de Matrículas Online</p>
      </footer>
    </div>
  );
}
