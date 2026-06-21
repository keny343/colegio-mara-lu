import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Star, Users, BookOpen, FileCheck, Shield, Award, Clock, ChevronRight } from 'lucide-react';
import './Home.css';

const PASSOS = [
  { icon: Users, title: 'Faça a inscrição', desc: 'Preencha os dados do aluno e selecione a classe desejada.' },
  { icon: BookOpen, title: 'Aguarde a aprovação', desc: 'O colégio analisa e aprova a matrícula para ativar o acesso.' },
  { icon: FileCheck, title: 'Faça a inscrição', desc: 'Escolha a série desejada e envie os documentos necessários digitalmente.' },
  { icon: Shield, title: 'Aguarde a análise', desc: 'Nossa equipe analisa a documentação e aprova a matrícula com agilidade.' },
  { icon: Award, title: 'Matrícula confirmada', desc: 'Receba a confirmação por e-mail e notificação no sistema. Bem-vindo!' },
  { icon: Clock, title: 'Acompanhe em tempo real', desc: 'Veja o status da inscrição a qualquer momento, de qualquer lugar.' },
];

function useRevealOnScroll() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('lp-in');
          io.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Reveal({ as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useRevealOnScroll();
  return (
    <Tag ref={ref} className={`lp-reveal ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <header className="lp-hero">
        <div className="lp-hero-grid-bg" aria-hidden="true"></div>
        <div className="lp-wrap lp-hero-inner-single">
          <span className="lp-eyebrow">
            <Star size={13} fill="currentColor" style={{ marginRight: 4 }} />
            Excelência em Educação desde 2005
          </span>
          <h1>
            Bem-vindo ao<br />
            <em>Colégio Mara &amp; Lu</em>
          </h1>
          <p className="lp-lede">
            Invista no futuro dos seus filhos. Faça a inscrição online de forma rápida,
            segura e transparente. Acompanhe todo o processo em tempo real.
          </p>
          <div className="lp-hero-actions">
            <Link to="/inscricao" className="btn btn-primary">
              Fazer Inscrição <ChevronRight size={18} />
            </Link>
            <Link to="/login" className="btn btn-secondary">
              Já tenho conta
            </Link>
          </div>
        </div>
      </header>

      {/* Como funciona */}
      <section className="lp-pilares">
        <div className="lp-wrap">
          <Reveal className="lp-section-head lp-section-head-center">
            <span className="lp-section-eyebrow">Processo de matrícula</span>
            <h2>Como funciona?</h2>
            <p className="lp-section-sub">Um processo simples e transparente para garantir a melhor educação para o seu filho.</p>
          </Reveal>
        </div>
        <div className="lp-wrap" style={{ padding: 0 }}>
          <div className="lp-pilares-grid lp-pilares-grid-6">
            {PASSOS.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal as="div" className="lp-pilar" key={i}>
                  <span className="lp-pilar-num"><Icon size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />passo {String(i + 1).padStart(2, '0')}</span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta">
        <div className="lp-wrap">
          <Reveal className="lp-cta-box">
            <div>
              <h2>Pronto para garantir a vaga?</h2>
              <p>As vagas são limitadas. Faça já a sua inscrição e garanta o lugar do seu filho no próximo ano letivo.</p>
            </div>
            <div className="lp-cta-actions">
              <Link to="/inscricao" className="lp-btn-light">
                Começar agora <ChevronRight size={20} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer (classes globais existentes) */}
      <footer className="footer">
        <p>© 2026 <strong>Colégio Mara &amp; Lu</strong> — Todos os direitos reservados.</p>
        <p style={{ marginTop: 4 }}>Sistema de Matrículas Online</p>
      </footer>
    </div>
  );
}