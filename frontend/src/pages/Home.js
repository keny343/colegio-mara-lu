import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Star, Users, BookOpen, FileCheck, Shield, Award, Clock, ChevronRight } from 'lucide-react';
import './Home.css';

const PASSOS = [
  {
    icon: Users,
    title: 'Faça a inscrição',
    desc: 'Preencha os dados do aluno e do encarregado de educação e selecione a classe ou série pretendida.'
  },
  {
    icon: FileCheck,
    title: 'Envie os documentos',
    desc: 'Anexe digitalmente os documentos necessários para completar a inscrição do aluno.'
  },
  {
    icon: BookOpen,
    title: 'Aguarde a análise',
    desc: 'O colégio verifica os dados e os documentos enviados para validar a inscrição.'
  },
  {
    icon: Shield,
    title: 'Inscrição aprovada',
    desc: 'Após a análise, o colégio aprova a inscrição ou solicita a correção ou complementação de alguma informação.'
  },
  {
    icon: Award,
    title: 'Matrícula confirmada',
    desc: 'Depois da aprovação da inscrição, receba a confirmação da matrícula e as orientações necessárias para o próximo passo.'
  },
  {
    icon: Clock,
    title: 'Acompanhe em tempo real',
    desc: 'Consulte a qualquer momento o estado da inscrição, notificações e atualizações diretamente pelo sistema.'
  },
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
            <span className="lp-section-eyebrow">Processo de inscrição e matrícula</span>
            <h2>Como funciona?</h2>
            <p className="lp-section-sub">
              Um processo simples e transparente para o candidato ou encarregado de educação acompanhar a inscrição do início à confirmação da matrícula.
            </p>
          </Reveal>
        </div>
        <div className="lp-wrap" style={{ padding: 0 }}>
          <div className="lp-pilares-grid lp-pilares-grid-6">
            {PASSOS.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal as="div" className="lp-pilar" key={i}>
                  <span className="lp-pilar-num">
                    <Icon size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />
                    passo {String(i + 1).padStart(2, '0')}
                  </span>
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
              <p>
                As vagas são limitadas. Faça já a sua inscrição e garanta o lugar do seu filho no próximo ano letivo.
              </p>
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
