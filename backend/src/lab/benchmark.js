'use strict';

const fs = require('fs');
const readline = require('readline');
const { performance } = require('perf_hooks');

function csvRow(line) {
  const fields = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      fields.push(value);
      value = '';
    } else value += char;
  }
  fields.push(value);
  return fields;
}

function createSampler(sampleIntervalMs = 20) {
  const start = process.hrtime.bigint();
  const cpuStart = process.cpuUsage();
  let peakRss = process.memoryUsage().rss;
  const sample = () => { peakRss = Math.max(peakRss, process.memoryUsage().rss); };
  const timer = setInterval(sample, sampleIntervalMs);
  if (timer.unref) timer.unref();

  return () => {
    sample();
    clearInterval(timer);
    const elapsedSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const cpu = process.cpuUsage(cpuStart);
    const cpuSeconds = (cpu.user + cpu.system) / 1e6;
    return {
      seconds: elapsedSeconds,
      cpu_seconds: cpuSeconds,
      cpu_percent_one_core: elapsedSeconds ? cpuSeconds / elapsedSeconds * 100 : 0,
      rss_peak_bytes: peakRss,
      rss_peak_mb: peakRss / (1024 * 1024),
    };
  };
}

async function measureFile({ filePath, format, runId }) {
  const finish = createSampler();
  const stats = { bytes: 0, records: 0, grades: 0, grade_sum: 0, groups: {} };
  let headers = null;
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (let line of lines) {
      stats.bytes += Buffer.byteLength(`${line}\n`);
      if (!line) continue;
      if (format === 'jsonl') {
        const row = JSON.parse(line);
        stats.records += 1;
        aggregateRow(stats, row);
      } else if (format === 'csv') {
        line = line.replace(/^\uFEFF/, '');
        if (!headers) {
          headers = csvRow(line);
          continue;
        }
        const values = csvRow(line);
        const row = Object.fromEntries(headers.map((key, index) => [key, values[index]]));
        try { row.notas = JSON.parse(row.notas || '[]'); } catch { row.notas = []; }
        row.turma_id = Number(row.turma_id);
        row.turma_nome = row.turma_nome || '';
        stats.records += 1;
        aggregateRow(stats, row);
      } else {
        // O laboratório escreve Avro/Parquet binários e SQL como script MySQL.
        // Até haver leitores JS standards-compliant, esta métrica é leitura integral
        // de bytes (não descodificação); o relatório explicita essa limitação.
        if (format === 'sql' && /^INSERT INTO alunos\s*\(/i.test(line)) stats.records += 1;
      }
    }
  } finally {
    lines.close();
    stream.destroy();
  }

  const measured = finish();
  return {
    ...measured,
    bytes: stats.bytes,
    records: stats.records,
    grade_records: stats.grades,
    sum_notas: stats.grade_sum.toFixed(2),
    group_by_turma: Object.fromEntries(Object.entries(stats.groups).sort(([a], [b]) => a.localeCompare(b))),
    mode: ['jsonl', 'csv'].includes(format) ? 'decoded_stream' : 'streamed_bytes_only',
    note: ['jsonl', 'csv'].includes(format)
      ? null
      : 'Leitura medida em streaming de bytes; não representa descodificação do formato.',
    run_id: runId,
  };
}

function aggregateRow(stats, row) {
  const key = `${row.turma_id ?? ''}:${row.turma_nome || ''}`;
  if (!stats.groups[key]) stats.groups[key] = { records: 0, grade_records: 0, sum_notas: 0 };
  stats.groups[key].records += 1;
  for (const note of Array.isArray(row.notas) ? row.notas : []) {
    const value = Number(note.nota) || 0;
    stats.grades += 1;
    stats.grade_sum += value;
    stats.groups[key].grade_records += 1;
    stats.groups[key].sum_notas += value;
  }
}

function summary(values) {
  if (!values.length) return { median: 0, min: 0, max: 0 };
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

async function benchmarkFiles({ outDir, runId, destinations, repeats = 5, records }) {
  const report = { records, repeats, run_id: runId, formats: {} };
  for (const format of destinations) {
    const filePath = format === 'sql'
      ? `${outDir}/criar_dados.sql`
      : `${outDir}/${({ jsonl: 'transacoes.jsonl', csv: 'transacoes.csv', avro: 'transacoes.avro', parquet: 'transacoes.parquet' })[format]}`;
    const reads = [];
    for (let i = 0; i < Math.max(1, Number(repeats) || 1); i += 1) {
      reads.push(await measureFile({ filePath, format, runId }));
    }
    const decoded = reads[0].mode === 'decoded_stream';
    report.formats[format] = {
      file_bytes: reads[0].bytes,
      full_read_seconds: summary(reads.map((item) => item.seconds)),
      cpu_seconds: summary(reads.map((item) => item.cpu_seconds)),
      cpu_percent_one_core: summary(reads.map((item) => item.cpu_percent_one_core)),
      peak_rss_mb: summary(reads.map((item) => item.rss_peak_mb)),
      observed_records: reads[0].records,
      observed_grade_records: reads[0].grade_records,
      observed_sum_notas: reads[0].sum_notas,
      group_by_turma: decoded ? reads[0].group_by_turma : null,
      read_mode: reads[0].mode,
      note: reads[0].note,
      repeats: reads.length,
    };
  }
  return report;
}

module.exports = { csvRow, createSampler, measureFile, benchmarkFiles, summary };
