import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import './Home.css';

const BENEFICIOS = [
  {
    title: 'Acompanhamento próximo',
    desc: 'Professores e direção acompanham o percurso de cada aluno, com atenção ao ritmo de aprendizagem.',
  },
  {
    title: 'Portal para a família',
    desc: 'Notas, faltas, materiais e recados ficam acessíveis online depois da matrícula confirmada.',
  },
  {
    title: 'Inscrição sem filas',
    desc: 'O pedido de vaga começa no telemóvel — documentos e dados enviados de forma digital.',
  },
];

const CURSOS = [
  {
    nivel: 'Ensino primário',
    title: '1.ª à 6.ª classe',
    desc: 'Bases sólidas de leitura, escrita e cálculo, com apoio ao estudo no horário escolar.',
  },
  {
    nivel: '1.º ciclo do secundário',
    title: '7.ª à 9.ª classe',
    desc: 'Preparação para o ensino médio, com acompanhamento contínuo do aproveitamento.',
  },
  {
    nivel: 'Ensino médio',
    title: '10.ª à 13.ª classe',
    desc: 'Formação orientada para o prosseguimento de estudos e para a vida profissional.',
  },
];

const PASSOS = [
  {
    title: 'Preencher a inscrição',
    desc: 'Dados do aluno, do encarregado e a classe pretendida — tudo online.',
  },
  {
    title: 'Entregar documentos',
    desc: 'Bilhete de identidade e, se aplicável, o boletim da classe anterior.',
  },
  {
    title: 'Análise da secretaria',
    desc: 'O colégio valida os dados e os anexos antes de confirmar a vaga.',
  },
  {
    title: 'Matrícula confirmada',
    desc: 'Após aprovação, o aluno acede ao portal com o BI (senha inicial = BI).',
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
          <p className="lp-kicker lp-hero-kicker">Inscrições abertas · Luanda · desde 2005</p>
          <h1 className="lp-hero-title">
            Uma escola que acompanha cada aluno — e mantém a família informada.
          </h1>
          <p className="lp-lede">
            Do ensino primário ao médio. Turmas acompanhadas de perto e um portal
            onde a família acompanha o percurso escolar depois da matrícula.
          </p>
          <div className="lp-hero-actions">
            <Link to="/inscricao" className="lp-btn-solid">
              Fazer inscrição
              <ArrowRight size={18} strokeWidth={2.25} />
            </Link>
            <a href="#cursos" className="lp-btn-ghost">
              Ver cursos
            </a>
          </div>
        </div>
      </header>

      <section id="escola" className="lp-escola" aria-labelledby="lp-escola-title">
        <div className="lp-wrap lp-escola-grid">
          <Reveal className="lp-escola-intro">
            <p className="lp-kicker">A nossa escola</p>
            <h2 id="lp-escola-title">Ensino exigente, trato humano</h2>
            <p className="lp-escola-lede">
              Abrimos em 2005 e mantemos a mesma regra: nenhum aluno passa
              despercebido. As famílias acompanham o dia a dia escolar pelo portal
              após a matrícula confirmada.
            </p>
          </Reveal>
          <ul className="lp-beneficios">
            {BENEFICIOS.map((b) => (
              <Reveal as="li" className="lp-beneficio" key={b.title}>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section id="cursos" className="lp-cursos" aria-labelledby="lp-cursos-title">
        <div className="lp-wrap">
          <Reveal className="lp-section-head">
            <p className="lp-kicker">Oferta formativa</p>
            <h2 id="lp-cursos-title">Cursos e classes</h2>
            <p className="lp-section-sub">
              Do primário ao ensino médio. A disponibilidade de vagas por classe
              confirma-se no momento da inscrição.
            </p>
          </Reveal>

          <div className="lp-cursos-list">
            {CURSOS.map((c) => (
              <Reveal className="lp-curso" key={c.title}>
                <p className="lp-curso-nivel">{c.nivel}</p>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
              </Reveal>
            ))}
          </div>

          <Reveal className="lp-cursos-cta">
            <Link to="/inscricao" className="lp-btn-solid lp-btn-ink">
              Ver inscrição
              <ArrowRight size={18} strokeWidth={2.25} />
            </Link>
          </Reveal>
        </div>
      </section>

      <section id="inscricao" className="lp-process" aria-labelledby="lp-process-title">
        <div className="lp-wrap">
          <Reveal className="lp-process-head">
            <p className="lp-kicker">Do pedido à vaga</p>
            <h2 id="lp-process-title">Como corre a inscrição</h2>
            <p className="lp-section-sub">
              Todo o processo começa online. Não é preciso deslocar-se à secretaria
              antes da análise da candidatura.
            </p>
            <Link to="/inscricao" className="lp-link-inline">
              Começar agora
              <ArrowUpRight size={16} strokeWidth={2.25} />
            </Link>
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

      <section id="contactos" className="lp-contactos" aria-labelledby="lp-contactos-title">
        <div className="lp-wrap lp-contactos-inner">
          <Reveal>
            <p className="lp-kicker">Morada</p>
            <h2 id="lp-contactos-title">Visite-nos</h2>
            <p className="lp-section-sub">
              Rua 15, Cassenda, Luanda, ao lado da Administração, defronte o Colégio Mara e Lu.
            </p>
          </Reveal>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-grid">
          <div>
            <p className="lp-footer-brand">Colégio Mara &amp; Lu</p>
            <p className="lp-footer-note">Educação e matrículas online · Luanda</p>
          </div>
          <p className="lp-footer-copy">© {new Date().getFullYear()} Colégio Mara &amp; Lu</p>
        </div>
      </footer>
    </div>
  );
}
