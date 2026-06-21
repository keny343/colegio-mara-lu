import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, GraduationCap, BookOpen, MessageSquare } from 'lucide-react';
import './Home.css';

const GRADES = {
  infantil: [
    ['07h30—08h15', 'Acolhimento e rotina'],
    ['08h15—09h30', 'Atividades sensoriais'],
    ['09h30—10h00', 'Lanche e recreio'],
    ['10h00—11h15', 'Música e movimento'],
    ['11h15—12h30', 'Histórias e expressão oral'],
  ],
  primario: [
    ['07h30—08h20', 'Língua portuguesa'],
    ['08h20—09h10', 'Matemática'],
    ['09h10—09h30', 'Recreio'],
    ['09h30—10h20', 'Ciências naturais'],
    ['10h20—11h10', 'Educação física'],
    ['11h10—12h00', 'Estudo do meio'],
  ],
  secundario: [
    ['07h30—08h20', 'Matemática'],
    ['08h20—09h10', 'Física e química'],
    ['09h10—09h30', 'Recreio'],
    ['09h30—10h20', 'Biologia'],
    ['10h20—11h10', 'História'],
    ['11h10—12h30', 'Educação cívica e tutoria'],
  ],
};

const NIVEL_LABEL = {
  infantil: 'atividade — infantil',
  primario: 'atividade — primário',
  secundario: 'atividade — secundário',
};

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
  const [nivel, setNivel] = useState('infantil');

  return (
    <div>
      {/* Hero */}
      <header className="lp-hero">
        <div className="lp-hero-grid-bg" aria-hidden="true"></div>
        <div className="lp-wrap lp-hero-inner">
          <div>
            <span className="lp-eyebrow">Infantil ao secundário · Luanda</span>
            <h1>
              O dia letivo, <em>organizado</em><br />
              como deve ser.
            </h1>
            <p className="lp-lede">
              Construímos a Mara &amp; Lu sobre uma ideia simples: ensino sério precisa de
              estrutura visível. Cada aula, cada nota, cada plano tem o seu lugar —
              para o aluno, para os pais e para o professor.
            </p>
            <div className="lp-hero-actions">
              <Link to="/inscricao" className="btn btn-primary">
                Fazer inscrição <ChevronRight size={18} />
              </Link>
              <Link to="/login" className="btn btn-secondary">
                Já tenho conta
              </Link>
            </div>
          </div>
          <div className="lp-hero-card">
            <div className="lp-hero-card-row"><span>turno</span><span>manhã · 07h30—12h30</span></div>
            <div className="lp-hero-card-row"><span>nível</span><span>ensino secundário</span></div>
            <div className="lp-hero-card-row"><span>portal</span><span>acesso online</span></div>
          </div>
        </div>
        <div className="lp-wrap">
          <div className="lp-hero-stats">
            <div><b>3</b><span>níveis de ensino, infantil ao secundário</span></div>
            <div><b>1</b><span>portal único para pais, alunos e professores</span></div>
            <div><b>24h</b><span>de aviso para qualquer nota ou material novo</span></div>
          </div>
        </div>
      </header>

      {/* Pilares */}
      <section className="lp-pilares">
        <div className="lp-wrap">
          <Reveal className="lp-section-head">
            <span className="lp-section-eyebrow">Por que a Mara &amp; Lu</span>
            <h2>Três coisas que levamos a sério, todos os dias.</h2>
          </Reveal>
        </div>
        <div className="lp-wrap" style={{ padding: 0 }}>
          <div className="lp-pilares-grid">
            <Reveal as="div" className="lp-pilar">
              <span className="lp-pilar-num"><GraduationCap size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />acompanhamento</span>
              <h3>Os pais sabem hoje, não no fim do trimestre</h3>
              <p>Notas, materiais e planos curriculares chegam ao portal assim que o professor publica — com aviso automático, sem espera pela reunião.</p>
            </Reveal>
            <Reveal as="div" className="lp-pilar">
              <span className="lp-pilar-num"><BookOpen size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />estrutura</span>
              <h3>Currículo claro, por nível e por turma</h3>
              <p>Do infantil ao secundário, cada turma tem o seu plano curricular documentado e visível — o que se ensina e quando, sem surpresas.</p>
            </Reveal>
            <Reveal as="div" className="lp-pilar">
              <span className="lp-pilar-num"><MessageSquare size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />comunicação</span>
              <h3>Uma linha direta entre escola e família</h3>
              <p>Coordenação, professores e direção falam com os pais pelo mesmo canal — mensagens com destinatário certo, sem se perderem no caminho.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Grade horária — elemento de assinatura */}
      <section className="lp-horario">
        <div className="lp-wrap">
          <Reveal className="lp-section-head">
            <span className="lp-section-eyebrow">Um dia na Mara &amp; Lu</span>
            <h2>A grade horária muda com a idade. A atenção, não.</h2>
            <p>Veja como o tempo letivo se organiza em cada nível — escolha um para abrir o horário do dia.</p>
          </Reveal>

          <div className="lp-nivel-tabs" role="tablist" aria-label="Escolher nível de ensino">
            {Object.keys(GRADES).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={nivel === key}
                className={`lp-nivel-tab ${nivel === key ? 'lp-active' : ''}`}
                onClick={() => setNivel(key)}
              >
                {key === 'infantil' ? 'Infantil' : key === 'primario' ? 'Primário' : 'Secundário'}
              </button>
            ))}
          </div>

          <Reveal className="lp-grade-table">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 160 }}>horário</th>
                  <th>{NIVEL_LABEL[nivel]}</th>
                </tr>
              </thead>
              <tbody>
                {GRADES[nivel].map(([hora, atividade]) => (
                  <tr key={hora}>
                    <td className="lp-hora-cell">{hora}</td>
                    <td className="lp-atividade">{atividade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* Portal preview */}
      <section className="lp-portal">
        <div className="lp-wrap lp-portal-inner">
          <Reveal className="lp-portal-text">
            <h2>O mesmo portal, três vistas diferentes.</h2>
            <p>Pais, professores e coordenação entram no mesmo sistema — cada um vê exatamente o que precisa, nada a mais.</p>
            <ul className="lp-portal-list">
              <li><b>01</b><span>Encarregados de educação acompanham notas, materiais e mensagens da turma do filho.</span></li>
              <li><b>02</b><span>Professores publicam notas e planos, e o sistema avisa os pais automaticamente.</span></li>
              <li><b>03</b><span>Coordenação acompanha todas as turmas e modera as comunicações da escola.</span></li>
            </ul>
          </Reveal>
          <Reveal className="lp-portal-mock">
            <div className="lp-portal-mock-bar"><i></i><i></i><i></i></div>
            <div className="lp-portal-mock-body">
              <div className="lp-portal-mock-row lp-active"><span>Matemática — 9ª classe</span><span>nota publicada</span></div>
              <div className="lp-portal-mock-row"><span>Plano curricular — 2º trimestre</span><span>disponível</span></div>
              <div className="lp-portal-mock-row"><span>Mensagem da coordenação</span><span>há 2h</span></div>
              <div className="lp-portal-mock-row"><span>Material: Biologia celular</span><span>novo</span></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta">
        <div className="lp-wrap">
          <Reveal className="lp-cta-box">
            <div>
              <h2>Vamos organizar o ano letivo do seu filho.</h2>
              <p>As vagas são limitadas. Faça já a inscrição e garanta o lugar do seu filho no próximo ano letivo.</p>
            </div>
            <div className="lp-cta-actions">
              <Link to="/inscricao" className="lp-btn-light">
                Começar inscrição <ChevronRight size={18} />
              </Link>
              <Link to="/login" className="lp-btn-outline-light">
                Já tenho conta
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer (mantém classes globais existentes) */}
      <footer className="footer">
        <p>© 2025 <strong>Colégio Mara &amp; Lu</strong> — Todos os direitos reservados.</p>
        <p style={{ marginTop: 4 }}>Sistema de Matrículas Online</p>
      </footer>
    </div>
  );
}