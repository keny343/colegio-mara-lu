#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const {
  generateRecordsBatches,
  computeHash,
  computeStats,
  DESTINATION_OPTIONS,
  DEFAULT_OUTPUT_DIR
} = require('../src/data-lab/schema');

const {
  ensureOutputDir,
  benchmarkDestination,
  readDestination,
  writeDestination,
  validateRecords
} = require('../src/data-lab/writers');

function parseArgs(argv) {
  const args = {
    count: 100000,
    batch: 10000,
    seed: 42,
    destinations: ['jsonl', 'csv', 'avro', 'parquet', 'sql'],
    outputDir: DEFAULT_OUTPUT_DIR,
    repetitions: 1
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];

    if (current === '--count') args.count = Number(next || args.count);
    if (current === '--batch') args.batch = Number(next || args.batch);
    if (current === '--seed') args.seed = Number(next || args.seed);
    if (current === '--output') args.outputDir = next || args.outputDir;
    if (current === '--destinations') args.destinations = String(next || args.destinations).split(',').map((value) => value.trim()).filter(Boolean);
    if (current === '--repetitions') args.repetitions = Number(next || args.repetitions);
  }

  return args;
}

function sanitizeDestinations(destinations) {
  const normalized = new Set();
  for (const value of destinations) {
    const clean = String(value).trim().toLowerCase();
    if (DESTINATION_OPTIONS.includes(clean)) normalized.add(clean);
  }
  return [...normalized];
}

function buildReportMarkdown(results) {
  const header = ['Destino', 'Arquivo', 'Linhas', 'Write (ms)', 'Read (ms)', 'Tamanho (bytes)', 'Total', 'Validação'];
  const rows = results.map((result) => [
    result.destination,
    path.basename(result.file),
    String(result.rows),
    String(result.writeMs),
    String(result.readMs),
    String(result.fileSize),
    String(result.total),
    result.validationPassed ? 'OK' : 'FAIL'
  ]);

  const markdown = [
    '# Relatório do Laboratório de Dados',
    '',
    `- Seed: ${results[0]?.seed ?? 'N/A'}`,
    `- Registos: ${results[0]?.count ?? 'N/A'}`,
    `- Batch: ${results[0]?.batch ?? 'N/A'}`,
    '',
    '| ' + header.join(' | ') + ' |',
    '| ' + header.map(() => '---').join(' | ') + ' |',
    ...rows.map((row) => '| ' + row.join(' | ') + ' |'),
    ''
  ].join('\n');

  return markdown;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const destinations = sanitizeDestinations(args.destinations);
  const outputDir = path.resolve(args.outputDir);
  await ensureOutputDir(outputDir);

  const runResults = [];

  for (let repetition = 1; repetition <= args.repetitions; repetition += 1) {
    for (const destination of destinations) {
      const result = await benchmarkDestination({
        destination,
        outputDir: path.join(outputDir, `run-${repetition}`),
        recordCount: args.count,
        batchSize: args.batch,
        seed: args.seed
      });

      result.seed = args.seed;
      result.count = args.count;
      result.batch = args.batch;
      result.repetition = repetition;
      runResults.push(result);
    }
  }

  const summaryFile = path.join(outputDir, 'lab-summary.json');
  const reportFile = path.join(outputDir, 'lab-report.md');

  fs.writeFileSync(summaryFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    arguments: args,
    results: runResults
  }, null, 2), 'utf8');

  fs.writeFileSync(reportFile, buildReportMarkdown(runResults), 'utf8');

  console.log(`\n[LAB] Resultados salvos em ${outputDir}`);
  console.log(`[LAB] JSON: ${summaryFile}`);
  console.log(`[LAB] Relatório: ${reportFile}`);

  for (const result of runResults) {
    console.log(`[LAB] ${result.destination}: ${result.rows} registos | write=${result.writeMs}ms | read=${result.readMs}ms | size=${result.fileSize} bytes | total=${result.total.toFixed(2)} | valid=${result.validationPassed ? 'OK' : 'FAIL'}`);
  }
}

run().catch((error) => {
  console.error('[LAB] Falha ao executar o benchmark.', error);
  process.exitCode = 1;
});
