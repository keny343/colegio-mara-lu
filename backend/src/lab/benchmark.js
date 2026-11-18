'use strict';

const fs = require('fs');
const os = require('os');
const { readJsonl, readCsv, readAvro, readParquet, readParquetColumns, readLines } = require('./readers');
const { yieldLoop } = require('./sinks');

const SQL_NOTE = /^\(@lab_matricula_id, (\d+), '([^']*)', ([0-9.]+), (NULL|\d+)\)/;

function createSampler(intervalMs = 20) {
  const start = process.hrtime.bigint();
  const cpuStart = process.cpuUsage();
  let peakRss = process.memoryUsage().rss;
  const sample = () => { peakRss = Math.max(peakRss, process.memoryUsage().rss); };
  const timer = setInterval(sample, intervalMs);
  if (timer.unref) timer.unref();
  return () => {
    sample();
    clearInterval(timer);
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    const cpu = process.cpuUsage(cpuStart);
    const cpuSeconds = (cpu.user + cpu.system) / 1e6;
    return {
      seconds,
      cpu_seconds: cpuSeconds,
      cpu_percent_one_core: seconds ? (cpuSeconds / seconds) * 100 : 0,
      rss_peak_mb: peakRss / (1024 * 1024),
    };
  };
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

function reader(format, file) {
  return { jsonl: readJsonl, csv: readCsv, avro: readAvro, parquet: readParquet }[format](file);
}

/** Leitura completa + descodificação de todos os registos. */
async function opFullRead(format, file) {
  let records = 0; let grades = 0; let cents = 0;
  if (format === 'sql') {
    for await (const line of readLines(file)) {
      if (line.startsWith('INSERT INTO alunos')) records += 1;
      else if (line.startsWith('(@lab_matricula_id,')) {
        const m = SQL_NOTE.exec(line);
        if (m) { grades += 1; cents += Math.round(Number(m[3]) * 100); }
      }
      if (((records + grades) & 0x3fff) === 0) await yieldLoop();
    }
    return { records, grades, sum_notas: (cents / 100).toFixed(2), mode: 'script_scan' };
  }
  for await (const row of reader(format, file)) {
    records += 1;
    for (const n of row.notas || []) { grades += 1; cents += Math.round(Number(n.nota) * 100); }
    if ((records & 0x3ff) === 0) await yieldLoop();
  }
  return { records, grades, sum_notas: (cents / 100).toFixed(2), mode: 'decoded' };
}

/** Leitura de uma só coluna (turma_id). Só o Parquet faz projecção real de colunas. */
async function opColumnRead(format, file) {
  if (format === 'sql') return null;
  let n = 0; let sum = 0;
  if (format === 'parquet') {
    for await (const { columns } of readParquetColumns(file, ['turma_id'])) {
      for (const v of columns.turma_id) { n += 1; sum += v; }
      await yieldLoop();
    }
    return { values: n, checksum: sum, mode: 'column_projection' };
  }
  for await (const row of reader(format, file)) {
    n += 1; sum += Number(row.turma_id);
    if ((n & 0x3ff) === 0) await yieldLoop();
  }
  return { values: n, checksum: sum, mode: 'full_decode_then_project' };
}

/** GROUP BY curso_nome com COUNT(alunos) e SUM(nota). */
async function opAggregate(format, file) {
  if (format === 'sql') return null;
  const groups = new Map();
  const add = (curso, notasJson) => {
    const key = curso || '(sem curso)';
    let g = groups.get(key);
    if (!g) { g = { alunos: 0, notas: 0, cents: 0 }; groups.set(key, g); }
    g.alunos += 1;
    for (const n of notasJson) { g.notas += 1; g.cents += Math.round(Number(n.nota) * 100); }
  };
  if (format === 'parquet') {
    for await (const { rows, columns } of readParquetColumns(file, ['curso_nome', 'notas'])) {
      for (let i = 0; i < rows; i += 1) {
        let notas = [];
        try { notas = JSON.parse(columns.notas[i] || '[]'); } catch { /* sem notas */ }
        add(columns.curso_nome[i], notas);
      }
      await yieldLoop();
    }
  } else {
    let i = 0;
    for await (const row of reader(format, file)) {
      add(row.curso_nome, row.notas || []);
      i += 1;
      if ((i & 0x3ff) === 0) await yieldLoop();
    }
  }
  const out = {};
  for (const [k, g] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    out[k] = { alunos: g.alunos, notas: g.notas, soma_notas: Number((g.cents / 100).toFixed(2)) };
  }
  return { groups: out, mode: format === 'parquet' ? 'column_projection' : 'full_decode' };
}

async function measure(fn) {
  const finish = createSampler();
  const result = await fn();
  return { ...finish(), result };
}

function environment() {
  const cpus = os.cpus();
  return {
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: cpus.length ? `${cpus[0].model.trim()} × ${cpus.length}` : 'desconhecido',
    ram_total_mb: Math.round(os.totalmem() / 1048576),
    node: process.version,
    libs: { zlib: process.versions.zlib, v8: process.versions.v8 },
    sgbd: 'MySQL 8 (script SQL gerado; execução da carga é feita no servidor MySQL do colégio)',
  };
}

/**
 * Benchmark de leitura/consulta. Faz 1 execução "fria" (reportada à parte, sem limpar a cache
 * do SO) e depois `repeats` execuções medidas, de que se reportam mediana, mínimo e máximo.
 */
async function benchmarkReads({ files, destinations, repeats = 5, onProgress = () => {} }) {
  const n = Math.max(1, Number(repeats) || 5);
  const formats = {};
  let step = 0;
  const totalSteps = destinations.length * (n + 1);
  for (const format of destinations) {
    const file = files[format];
    const runs = { full: [], column: [], agg: [] };
    let cold = null;
    for (let i = 0; i <= n; i += 1) {
      const full = await measure(() => opFullRead(format, file));
      const column = await measure(() => opColumnRead(format, file));
      const agg = await measure(() => opAggregate(format, file));
      if (i === 0) {
        cold = { full_read_seconds: full.seconds, column_read_seconds: column.result ? column.seconds : null, aggregation_seconds: agg.result ? agg.seconds : null };
      } else {
        runs.full.push(full); runs.column.push(column); runs.agg.push(agg);
      }
      step += 1;
      onProgress(step / totalSteps, `${format}: leitura ${i === 0 ? '(fria)' : `${i}/${n}`}`);
      await yieldLoop();
    }
    const first = runs.full[0];
    const hasColumn = !!runs.column[0].result;
    const hasAgg = !!runs.agg[0].result;
    formats[format] = {
      file_bytes: fs.statSync(file).size,
      cold_run: cold,
      full_read_seconds: summary(runs.full.map((r) => r.seconds)),
      column_read_seconds: hasColumn ? summary(runs.column.map((r) => r.seconds)) : null,
      column_read_mode: hasColumn ? runs.column[0].result.mode : 'não aplicável (script SQL)',
      aggregation_seconds: hasAgg ? summary(runs.agg.map((r) => r.seconds)) : null,
      aggregation_mode: hasAgg ? runs.agg[0].result.mode : 'requer carga no MySQL',
      group_by_curso: hasAgg ? runs.agg[0].result.groups : null,
      cpu_percent_one_core: summary(runs.full.map((r) => r.cpu_percent_one_core)),
      cpu_seconds: summary(runs.full.map((r) => r.cpu_seconds)),
      peak_rss_mb: summary(runs.full.map((r) => r.rss_peak_mb)),
      observed_records: first.result.records,
      observed_grade_records: first.result.grades,
      observed_sum_notas: first.result.sum_notas,
      read_mode: first.result.mode,
      repeats: n,
    };
  }
  return { repeats: n, formats, environment: environment() };
}

module.exports = { benchmarkReads, summary, createSampler, environment };