import { gerarCsv, gerarHtmlRelatorio } from './relatorioNotas';

const PERIODOS = [
  { key: '1PP', label: '1ª Parcial' },
  { key: '1PT', label: '1ª Trimestral' },
  { key: '2PP', label: '2ª Parcial' },
  { key: '2PT', label: '2ª Trimestral' },
  { key: '3PP', label: '3ª Parcial' },
  { key: '3PT', label: '3ª Trimestral' },
];

const dadosBase = (alunos) => ({
  turma: { id: 1, nome: '7ª A', serie_classe: 7, curso_nome: null, ano_letivo: 2026, turno: 'manhã' },
  limites: { min: 0, max: 20 },
  nota_minima: 10,
  periodos: PERIODOS,
  disciplinas: [{ id: 1, nome: 'Matemática' }, { id: 2, nome: 'Língua Portuguesa' }],
  alunos,
  gerado_em: '2026-11-07T10:00:00Z',
});

const aluno = (nome, d1, d2) => ({
  matricula_id: 1,
  aluno_nome: nome,
  media_geral: '12.2',
  negativas: 1,
  disciplinas: [
    { disciplina_id: 1, ...d1 },
    { disciplina_id: 2, ...d2 },
  ],
});

const comNotas = { periodos: { '1PP': 14, '1PT': 16 }, media: '15.0', positiva: true };
const negativa = { periodos: { '1PP': 9, '1PT': 8 }, media: '8.5', positiva: false };
const semNotas = { periodos: {}, media: null, positiva: null };

describe('gerarCsv', () => {
  test('começa com BOM, usa ";" e vírgula decimal', () => {
    const csv = gerarCsv(dadosBase([aluno('Ana', comNotas, negativa)]));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Ana";"Língua Portuguesa";"9";"8";"";"";"";"";"8,5";"Negativa"');
  });

  test('uma linha por aluno e disciplina, com situação', () => {
    const csv = gerarCsv(dadosBase([aluno('Ana', comNotas, semNotas)]));
    expect(csv).toContain('"Positiva"');
    expect(csv).toContain('"Sem notas"');
  });

  test('neutraliza fórmulas do Excel em nomes de alunos', () => {
    const csv = gerarCsv(dadosBase([aluno('=HYPERLINK("http://x")', comNotas, comNotas)]));
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).not.toMatch(/;"=HYPERLINK/);
  });
});

describe('gerarHtmlRelatorio', () => {
  test('escapa HTML em nomes e no autor', () => {
    const html = gerarHtmlRelatorio(
      dadosBase([aluno('<script>alert(1)</script>', comNotas, comNotas)]),
      { geradoPor: 'Admin <b>' }
    );
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Admin &lt;b&gt;');
  });

  test('marca notas abaixo do mínimo com a classe "neg"', () => {
    const html = gerarHtmlRelatorio(dadosBase([aluno('Ana', comNotas, negativa)]));
    expect(html).toContain('<td class="neg">8,5</td>');
    expect(html).not.toContain('<td class="neg">15</td>');
  });

  test('cria uma secção de detalhe por disciplina', () => {
    const html = gerarHtmlRelatorio(dadosBase([aluno('Ana', comNotas, negativa)]));
    expect((html.match(/class="detalhe"/g) || []).length).toBe(2);
  });

  test('turma sem alunos mostra aviso em vez de tabelas', () => {
    const html = gerarHtmlRelatorio(dadosBase([]));
    expect(html).toContain('Não há alunos ou disciplinas');
    expect(html).not.toContain('class="detalhe"');
  });
});