import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import './Home.css';

const PASSOS = [
  {
    title: 'Inscrição',
    desc: 'Dados do aluno, encarregado e classe pretendida — tudo online.',
  },
  {
    title: 'Documentos',
    desc: 'BI e, quando necessário, boletim da classe anterior.',
  },
  {
    title: 'Análise',
    desc: 'A secretaria valida informações e anexos com cuidado.',
  },
  {
    title: 'Matrícula',
    desc: 'Aprovação confirmada e acesso ao portal com o BI.',
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
      { threshold: 0.14 }
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
    <div className="lp">
      <header className="lp-hero">
        <img
          className="lp-hero-plane"
          src={`${process.env.PUBLIC_URL}/images/hero-plane.svg`}
          alt=""
          aria-hidden="true"
        />
        <div className="lp-hero-veil" aria-hidden="true" />
        <div className="lp-wrap lp-hero-copy">
          <p className="lp-kicker lp-hero-kicker">Luanda · desde 2005</p>
          <h1 className="lp-brand">
            <span className="lp-brand-line">Colégio</span>
            <span className="lp-brand-line lp-brand-em">Mara &amp; Lu</span>
          </h1>
          <p className="lp-lede">
            Formação sólida, acompanhamento próximo e matrícula online —
            do primeiro contacto até à confirmação da vaga.
          </p>
          <div className="lp-hero-actions">
            <Link to="/inscricao" className="lp-btn-solid">
              Fazer inscrição
              <ArrowRight size={18} strokeWidth={2.25} />
            </Link>
            <Link to="/login" className="lp-btn-ghost">
              Já tenho conta
            </Link>
          </div>
        </div>
        <div className="lp-hero-scroll" aria-hidden="true">
          <span>Deslize</span>
        </div>
      </header>

      <section className="lp-manifesto" aria-labelledby="lp-manifesto-title">
        <div className="lp-wrap lp-manifesto-inner">
          <Reveal>
            <p className="lp-kicker">A nossa promessa</p>
            <h2 id="lp-manifesto-title" className="lp-manifesto-title">
              Educação que acompanha cada passo — com clareza para as famílias.
            </h2>
          </Reveal>
        </div>
      </section>

      <section className="lp-process" aria-labelledby="lp-process-title">
        <div className="lp-wrap">
          <Reveal className="lp-process-head">
            <p className="lp-kicker">Do pedido à vaga</p>
            <h2 id="lp-process-title">Como corre a inscrição</h2>
          </Reveal>

          <ol className="lp-track">
            {PASSOS.map((passo, i) => (
              <Reveal as="li" className="lp-track-item" key={passo.title}>
                <span className="lp-track-index" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="lp-track-body">
                  <h3>{passo.title}</h3>
                  <p>{passo.desc}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-band" aria-labelledby="lp-band-title">
        <div className="lp-wrap lp-band-inner">
          <Reveal>
            <h2 id="lp-band-title">Garanta a vaga do próximo ano letivo</h2>
            <p>Vagas limitadas por classe. Comece a inscrição agora — leva poucos minutos.</p>
            <Link to="/inscricao" className="lp-btn-solid lp-btn-on-dark">
              Começar inscrição
              <ArrowUpRight size={18} strokeWidth={2.25} />
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-grid">
          <div>
            <p className="lp-footer-brand">Colégio Mara &amp; Lu</p>
            <p className="lp-footer-note">Sistema de matrículas e acompanhamento escolar.</p>
          </div>
          <nav className="lp-footer-nav" aria-label="Rodapé">
            <Link to="/inscricao">Inscrição</Link>
            <Link to="/login">Entrar</Link>
          </nav>
          <p className="lp-footer-copy">© {new Date().getFullYear()} Colégio Mara &amp; Lu</p>
        </div>
      </footer>
    </div>
  );
}
