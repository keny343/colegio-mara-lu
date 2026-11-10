import {
  gerarCsv,
  gerarJson,
  gerarAvro,
  gerarParquet,
  gerarOrc,
  linhasRelatorio,
  FORMATOS_EXPORT,
  gerarPorFormato,
  nomeColuna,
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

  test('média sem veredicto definitivo fica "Em curso"; sem média, "Sem notas"', () => {
    const emCurso = { periodos: { '1PP': 4 }, media: '4.0', positiva: null };
    const semNotas = { periodos: {}, media: null, positiva: null };
    const linhas = linhasRelatorio(dadosBase([aluno('Ana', emCurso, semNotas)]));
    expect(linhas[0].situacao).toBe('Em curso');
    expect(linhas[1].situacao).toBe('Sem notas');
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

  test('Avro começa com magic Obj e só tem nomes de campo válidos', () => {
    const buf = gerarAvro(dados);
    expect(String.fromCharCode(buf[0], buf[1], buf[2])).toBe('Obj');
    expect(buf.length).toBeGreaterThan(32);
    const texto = Buffer.from(buf).toString('latin1');
    const schema = JSON.parse(texto.slice(texto.indexOf('{"type":"record"'), texto.indexOf('}]}') + 3));
    schema.fields.forEach((f) => expect(f.name).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/));
    expect(schema.fields.map((f) => f.name)).toContain(nomeColuna('1PP'));
  });

  test('nomeColuna nunca começa por dígito', () => {
    expect(nomeColuna('1PP')).toBe('p_1PP');
  });

  test('Parquet começa e termina com PAR1', () => {
    const buf = gerarParquet(dados);
    const head = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
    const tail = String.fromCharCode(buf[buf.length - 4], buf[buf.length - 3], buf[buf.length - 2], buf[buf.length - 1]);
    expect(head).toBe('PAR1');
    expect(tail).toBe('PAR1');
    // O tamanho do footer (4 bytes antes do PAR1 final) tem de caber no ficheiro.
    const footerLen = new DataView(buf.buffer, buf.byteOffset + buf.length - 8, 4).getUint32(0, true);
    expect(footerLen).toBeGreaterThan(0);
    expect(footerLen).toBeLessThan(buf.length - 12);
    // Sem NaN nem texto "null": nulos vão em definition levels.
    expect(Buffer.from(buf).includes(Buffer.from('NaN'))).toBe(false);
  });

  test('ORC começa com magic ORC', () => {
    const buf = gerarOrc(dados);
    expect(String.fromCharCode(buf[0], buf[1], buf[2])).toBe('ORC');
    // Último byte = tamanho do postscript, que termina com o magic "ORC".
    const psLen = buf[buf.length - 1];
    const ps = buf.slice(buf.length - 1 - psLen, buf.length - 1);
    expect(String.fromCharCode(...ps.slice(-3))).toBe('ORC');
  });

  test('Parquet e ORC aceitam relatório sem alunos', () => {
    const vazio = dadosBase([]);
    expect(gerarParquet(vazio).length).toBeGreaterThan(8);
    expect(gerarOrc(vazio).length).toBeGreaterThan(8);
    expect(gerarAvro(vazio).length).toBeGreaterThan(32);
  });

  test('FORMATOS_EXPORT cobre os 5 tipos pedidos', () => {
    expect(FORMATOS_EXPORT.map((f) => f.id).sort()).toEqual(['avro', 'csv', 'json', 'orc', 'parquet']);
  });

  test('gerarPorFormato rejeita formato desconhecido', () => {
    expect(() => gerarPorFormato('xml', dados)).toThrow(/não suportado/);
  });
});