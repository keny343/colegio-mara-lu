'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../src/config/database', () => ({ query: jest.fn() }));

const db = require('../src/config/database');
const lab = require('../src/lab/pipeline');

const catalogRow = {
  turma_id: 1,
  turma_nome: 'Turma A',
  ano_letivo: 2026,
  serie_classe: 1,
  curso_id: 1,
  curso_nome: 'Informática',
  turno: 'manha',
  disciplina_id: 1,
  disciplina_nome: 'Matemática',
  disciplina_chave: 0,
  professor_id: null,
};

async function waitForJob(id) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const job = lab.getJob(id);
    if (['done', 'cancelled', 'error'].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('A tarefa do laboratório não terminou dentro do prazo do teste.');
}

async function waitForFirstBatch(id) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const job = lab.getJob(id);
    if (job.batch_progress?.jsonl?.batch_count > 0) return job;
    if (['done', 'cancelled', 'error'].includes(job.status)) {
      throw new Error(`A tarefa terminou antes do primeiro lote: ${job.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('A geração não concluiu o primeiro lote dentro do prazo do teste.');
}

describe('laboratory jobs', () => {
  let outputDir;
  let previousOutputDir;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-jobs-'));
    previousOutputDir = process.env.LAB_OUTPUT_DIR;
    process.env.LAB_OUTPUT_DIR = outputDir;
    db.query.mockImplementation(async (sql) => (
      sql.includes('config_avaliacao') ? [[]] : [[catalogRow]]
    ));
  });

  afterEach(() => {
    if (previousOutputDir == null) delete process.env.LAB_OUTPUT_DIR;
    else process.env.LAB_OUTPUT_DIR = previousOutputDir;
    fs.rmSync(outputDir, { recursive: true, force: true });
    db.query.mockReset();
  });

  test('cancels during generation, removes partial output and releases the job lock', async () => {
    const runId = `run_${Date.now()}`;
    const job = lab.startGenerate({
      records: 100000, seed: 42, batchSize: 500, destinations: 'jsonl', outName: runId,
    });

    await waitForFirstBatch(job.id);
    expect(lab.cancelJob(job.id).status).toBe('cancelling');
    const completed = await waitForJob(job.id);

    expect(completed.status).toBe('cancelled');
    expect(lab.isRunning()).toBe(false);
    expect(completed.error).toBeNull();
    expect(fs.existsSync(path.join(outputDir, runId))).toBe(false);
  });

  test('records observed batch counts and sizes in metadata and logs', async () => {
    const runId = `run_${Date.now()}`;
    const job = lab.startGenerate({
      records: 5, seed: 42, batchSize: 2, destinations: 'jsonl', outName: runId,
    });

    const completed = await waitForJob(job.id);
    const metadata = JSON.parse(fs.readFileSync(path.join(outputDir, runId, 'run_meta.json'), 'utf8'));
    const write = metadata.writes.jsonl;
    const log = fs.readFileSync(path.join(outputDir, runId, 'run.log'), 'utf8');

    expect(completed.status).toBe('done');
    expect(write.batch_count).toBe(3);
    expect(write.batch_size_distribution).toEqual({ 1: 1, 2: 2 });
    expect(log).toContain('3 lotes observados');
    expect(log).toContain('{"1":1,"2":2}');
  });
});
