'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { benchmarkReads } = require('../src/lab/benchmark');
const { ParquetStreamWriter } = require('../src/lab/binaryFormats');

function student(id, course, grades) {
  return {
    id,
    nome: `Aluno ${id}`,
    email: `aluno${id}@example.test`,
    role: 'aluno',
    ativo: 0,
    data_nascimento: '2010-01-01',
    sexo: 'F',
    nacionalidade: 'Angolana',
    nome_mae: 'Mae',
    nome_pai: 'Pai',
    responsavel: 'Mae',
    telefone_emergencia: '+244 900 000 000',
    turma_id: id,
    turma_nome: `Turma ${id}`,
    curso_id: id,
    curso_nome: course,
    serie_classe: 1,
    ano_letivo: 2026,
    turno: 'manha',
    notas: grades.map((nota) => ({ nota })),
  };
}

describe('lab benchmark aggregation', () => {
  let tempDir;

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  });

  test('groups students by course and sums their notes', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-benchmark-'));
    const file = path.join(tempDir, 'students.jsonl');
    const rows = [
      { id: 1, turma_id: 1, curso_nome: 'Informática', notas: [{ nota: 12.34 }, { nota: 15.66 }] },
      { id: 2, turma_id: 1, curso_nome: 'Informática', notas: [{ nota: 9.5 }] },
      { id: 3, turma_id: 2, curso_nome: 'Contabilidade', notas: [{ nota: 18.75 }] },
      { id: 4, turma_id: 3, curso_nome: '', notas: [] },
    ];
    fs.writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);

    const report = await benchmarkReads({
      files: { jsonl: file },
      destinations: ['jsonl'],
      repeats: 1,
    });

    expect(report.formats.jsonl.group_by_curso).toEqual({
      Contabilidade: { alunos: 1, notas: 1, soma_notas: 18.75 },
      Informática: { alunos: 2, notas: 3, soma_notas: 37.5 },
      '(sem curso)': { alunos: 1, notas: 0, soma_notas: 0 },
    });
  });

  test('projects course and note columns when aggregating Parquet', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-benchmark-parquet-'));
    const file = path.join(tempDir, 'students.parquet');
    const records = [
      student(1, 'Informática', [12.34, 15.66]),
      student(2, 'Informática', [9.5]),
    ];
    const writer = new ParquetStreamWriter({ compression: 'none' });
    const bytes = Buffer.concat([
      writer.header(),
      await writer.rowGroup(records),
      writer.footer(),
    ]);
    fs.writeFileSync(file, bytes);

    const report = await benchmarkReads({
      files: { parquet: file },
      destinations: ['parquet'],
      repeats: 1,
    });

    expect(report.formats.parquet.aggregation_mode).toBe('column_projection');
    expect(report.formats.parquet.group_by_curso).toEqual({
      Informática: { alunos: 2, notas: 3, soma_notas: 37.5 },
    });
  });
});
