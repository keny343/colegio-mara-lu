import { criarCsv } from './relatoriosCsv';

test('creates a UTF-8 semicolon CSV and quotes values safely', () => {
  const csv = criarCsv(['Aluno', 'Turma'], [['Ana; "Mara"', '10.ª classe']]);

  expect(csv).toBe('\uFEFF"Aluno";"Turma"\r\n"Ana; ""Mara""";"10.ª classe"');
});

test('neutralizes spreadsheet formulas in text cells', () => {
  const csv = criarCsv(['Aluno'], [['=HYPERLINK("https://example.com")']]);

  expect(csv).toContain("\"'=HYPERLINK(\"\"https://example.com\"\")\"");
});
