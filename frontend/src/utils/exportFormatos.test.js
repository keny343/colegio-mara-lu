import {
  gerarCsv,
  gerarJson,
  gerarAvro,
  gerarParquet,
  gerarOrc,
  linhasRelatorio,
  FORMATOS_EXPORT,
  gerarPorFormato,
} from './exportFormatos';

const PERIODOS = [
  { key: '1PP', label: '1ª Parcial' },
  { key: '1PT', label: '1ª Trimestral' },
  { key: '2PP', label: '2ª Parcial' },
  { key: '2PT', label: '2ª Trimestral' },
  { key: '3PP', label: '3ª Parcial' },
  { key: '3PT', label: '3ª Trimestral' },
];

const dadosBase = (alunos, extra = {}) => ({
  turma: { id: 1, nome: '7ª A', serie_classe: 7, curso_nome: null, ano_letivo: 2026, turno: 'manhã' },
  limites: { min: 0, max: 20 },
  nota_minima: 10,
  periodos: PERIODOS,
  disciplinas: [{ id: 1, nome: 'Matemática' }, { id: 2, nome: 'Língua Portuguesa' }],
  disciplina_selecionada: extra.disciplina_selecionada || null,
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

describe('linhasRelatorio', () => {
  test('expande uma linha por aluno/disciplina', () => {
    const linhas = linhasRelatorio(dadosBase([aluno('Ana', comNotas, negativa)]));
    expect(linhas).toHaveLength(2);
    expect(linhas[1].disciplina).toBe('Língua Portuguesa');
    expect(linhas[1].situacao).toBe('Negativa');
  });
});

describe('formatos de exportação', () => {
  const dados = dadosBase([aluno('Ana', comNotas, negativa)], {
    disciplina_selecionada: { id: 2, nome: 'Língua Portuguesa' },
  });

  test('CSV com BOM e separador ;', () => {
    const csv = gerarCsv(dados);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Ana";"Língua Portuguesa";"9";"8";"";"";"";"";"8,5";"Negativa"');
  });

  test('JSON contém meta e linhas', () => {
    const json = JSON.parse(gerarJson(dados));
    expect(json.meta.escola).toContain('Mara');
    expect(json.linhas).toHaveLength(2);
  });

  test('Avro começa com magic Obj', () => {
    const buf = gerarAvro(dados);
    expect(String.fromCharCode(buf[0], buf[1], buf[2])).toBe('Obj');
    expect(buf.length).toBeGreaterThan(32);
  });

  test('Parquet começa e termina com PAR1', () => {
    const buf = gerarParquet(dados);
    const head = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
    const tail = String.fromCharCode(buf[buf.length - 4], buf[buf.length - 3], buf[buf.length - 2], buf[buf.length - 1]);
    expect(head).toBe('PAR1');
    expect(tail).toBe('PAR1');
  });

  test('ORC começa com magic ORC', () => {
    const buf = gerarOrc(dados);
    expect(String.fromCharCode(buf[0], buf[1], buf[2])).toBe('ORC');
  });

  test('FORMATOS_EXPORT cobre os 5 tipos pedidos', () => {
    expect(FORMATOS_EXPORT.map((f) => f.id).sort()).toEqual(['avro', 'csv', 'json', 'orc', 'parquet']);
  });

  test('gerarPorFormato rejeita formato desconhecido', () => {
    expect(() => gerarPorFormato('xml', dados)).toThrow(/não suportado/);
  });
});
