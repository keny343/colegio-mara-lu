'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generateBatches, SCHEMA_FIELDS } = require('./generator');
const { writeAvroBuffer, writeParquetBuffer } = require('./binaryFormats');
const { benchmarkFiles } = require('./benchmark');
const db = require('../config/database');

const DEST_FILES = {
  jsonl: 'transacoes.jsonl', csv: 'transacoes.csv', avro: 'transacoes.avro',
  parquet: 'transacoes.parquet', sql: 'sql',
};
const MAX_RECORDS = 25000;
const CSV_HEADER = SCHEMA_FIELDS.join(',');
const PASSWORD_PLACEHOLDER_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
let running = false;

function labRoot() { return path.join(__dirname, '..', '..', 'lab-output'); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function normalizeRunId(value) {
  const runId = String(value || '');
  if (!/^(run|bench)_\d+$/.test(runId)) throw Object.assign(new Error('Identificador de execução inválido.'), { status: 400 });
  return runId;
}
function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function rowCsv(row) {
  return SCHEMA_FIELDS.map((field) => csvEscape(field === 'notas' ? JSON.stringify(row[field] || []) : row[field])).join(',');
}

async function loadCatalog() {
  const [rows] = await db.query(`
    SELECT t.id AS turma_id, t.nome AS turma_nome, t.ano_letivo, t.serie_classe,
      t.curso_id, c.nome AS curso_nome, t.turno, d.id AS disciplina_id,
      d.nome AS disciplina_nome, d.disciplina_chave, tp.professor_id
    FROM turmas t
    LEFT JOIN cursos c ON c.id = t.curso_id
    INNER JOIN disciplinas d ON d.ativo = 1
      AND (d.curso_id IS NULL OR d.curso_id = t.curso_id)
      AND (d.serie_min IS NULL OR t.serie_classe >= d.serie_min)
      AND (d.serie_max IS NULL OR t.serie_classe <= d.serie_max)
    LEFT JOIN turma_professores tp ON tp.turma_id = t.id AND tp.disciplina_id = d.id
    WHERE t.ativo = 1 ORDER BY t.id, d.id, tp.professor_id
  `);
  let configs = [];
  try {
    const [configRows] = await db.query('SELECT serie_classe, curso_id, exame_nacional, defesa_final FROM config_avaliacao');
    configs = configRows;
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  const grouped = new Map();
  for (const row of rows) {
    const key = String(row.turma_id);
    if (!grouped.has(key)) {
      const config = configs.find((item) => Number(item.serie_classe) === Number(row.serie_classe)
        && item.curso_id != null && Number(item.curso_id) === Number(row.curso_id))
        || configs.find((item) => Number(item.serie_classe) === Number(row.serie_classe) && item.curso_id == null) || {};
      grouped.set(key, {
        turma_id: Number(row.turma_id), turma_nome: row.turma_nome, ano_letivo: Number(row.ano_letivo),
        serie_classe: Number(row.serie_classe), curso_id: row.curso_id == null ? null : Number(row.curso_id),
        curso_nome: row.curso_nome || '', turno: row.turno || 'manha',
        exame_nacional: !!Number(config.exame_nacional || 0), defesa_final: !!Number(config.defesa_final || 0), disciplinas: [],
      });
    }
    const turma = grouped.get(key);
    let subject = turma.disciplinas.find((item) => item.disciplina_id === Number(row.disciplina_id));
    if (!subject) {
      subject = {
        disciplina_id: Number(row.disciplina_id), disciplina_nome: row.disciplina_nome,
        disciplina_chave: !!Number(row.disciplina_chave || 0),
        professor_id: row.professor_id == null ? null : Number(row.professor_id),
      };
      turma.disciplinas.push(subject);
    } else if (subject.professor_id == null && row.professor_id != null) subject.professor_id = Number(row.professor_id);
  }
  const catalog = [...grouped.values()].filter((item) => item.disciplinas.length);
  if (!catalog.length) throw Object.assign(new Error('Não existem turmas activas com disciplinas compatíveis.'), { status: 409 });
  return catalog;
}

function sqlCleanup(runId) {
  const prefix = `lab.${runId}.`;
  const condition = `LEFT(u.email, CHAR_LENGTH(${sqlString(prefix)})) = ${sqlString(prefix)}`;
  return `-- Remove apenas alunos criados pelo laboratório na execução ${runId}.\nDELETE n FROM notas n INNER JOIN matriculas m ON m.id=n.matricula_id INNER JOIN alunos a ON a.id=m.aluno_id INNER JOIN usuarios u ON u.id=a.usuario_id WHERE ${condition};\nDELETE m FROM matriculas m INNER JOIN alunos a ON a.id=m.aluno_id INNER JOIN usuarios u ON u.id=a.usuario_id WHERE ${condition};\nDELETE a FROM alunos a INNER JOIN usuarios u ON u.id=a.usuario_id WHERE ${condition};\nDELETE FROM usuarios WHERE LEFT(email, CHAR_LENGTH(${sqlString(prefix)})) = ${sqlString(prefix)};\n`;
}
function sqlStudent(row) {
  const notes = (row.notas || []).map((note) => `(@lab_matricula_id, ${Number(note.disciplina_id)}, ${sqlString(note.periodo)}, ${Number(note.nota).toFixed(2)}, ${note.professor_id == null ? 'NULL' : Number(note.professor_id)})`);
  return `\nINSERT INTO usuarios (nome,email,senha,role,ativo) VALUES (${sqlString(row.nome)},${sqlString(row.email)},${sqlString(PASSWORD_PLACEHOLDER_HASH)},'aluno',0);\nSET @lab_usuario_id := LAST_INSERT_ID();\nINSERT INTO alunos (usuario_id,nome,data_nascimento,sexo,nacionalidade,nome_mae,nome_pai,responsavel,telefone_emergencia) VALUES (@lab_usuario_id,${sqlString(row.nome)},${sqlString(row.data_nascimento)},${sqlString(row.sexo)},'Angolana',${sqlString(row.nome_mae)},${sqlString(row.nome_pai)},${sqlString(row.responsavel)},${sqlString(row.telefone_emergencia)});\nSET @lab_aluno_id := LAST_INSERT_ID();\nINSERT INTO matriculas (aluno_id,turma_id,ano_letivo,status) VALUES (@lab_aluno_id,${Number(row.turma_id)},${Number(row.ano_letivo)},'ativa');\nSET @lab_matricula_id := LAST_INSERT_ID();\nINSERT INTO notas (matricula_id,disciplina_id,periodo,nota,professor_id) VALUES\n${notes.join(',\n')};\n`;
}

function writeSql(batches, runId, outDir) {
  const started = process.hrtime.bigint();
  const createPath = path.join(outDir, 'criar_dados.sql');
  const deletePath = path.join(outDir, 'apagar_dados.sql');
  fs.writeFileSync(createPath, `SET NAMES utf8mb4;\nSTART TRANSACTION;\n${sqlCleanup(runId)}\n`, 'utf8');
  fs.writeFileSync(deletePath, `SET NAMES utf8mb4;\nSTART TRANSACTION;\n${sqlCleanup(runId)}COMMIT;\n`, 'utf8');
  let records = 0;
  let grades = 0;
  for (const batch of batches) {
    let chunk = '';
    for (const row of batch) { chunk += sqlStudent(row); records += 1; grades += (row.notas || []).length; }
    fs.appendFileSync(createPath, chunk, 'utf8');
  }
  fs.appendFileSync(createPath, '\nCOMMIT;\n', 'utf8');
  return { path: 'sql', create_file: 'criar_dados.sql', delete_file: 'apagar_dados.sql', records, grade_records: grades, bytes: fs.statSync(createPath).size, write_seconds: Number(process.hrtime.bigint() - started) / 1e9 };
}
function writeJsonl(batches, filePath) {
  const fd = fs.openSync(filePath, 'w'); let records = 0; let grades = 0;
  const started = process.hrtime.bigint();
  try { for (const batch of batches) for (const row of batch) { fs.writeSync(fd, `${JSON.stringify(row)}\n`); records += 1; grades += (row.notas || []).length; } }
  finally { fs.closeSync(fd); }
  return { path: filePath, records, grade_records: grades, bytes: fs.statSync(filePath).size, write_seconds: Number(process.hrtime.bigint() - started) / 1e9 };
}
function writeCsv(batches, filePath) {
  const fd = fs.openSync(filePath, 'w'); let records = 0; let grades = 0;
  const started = process.hrtime.bigint();
  try { fs.writeSync(fd, `\uFEFF${CSV_HEADER}\n`); for (const batch of batches) for (const row of batch) { fs.writeSync(fd, `${rowCsv(row)}\n`); records += 1; grades += (row.notas || []).length; } }
  finally { fs.closeSync(fd); }
  return { path: filePath, records, grade_records: grades, bytes: fs.statSync(filePath).size, write_seconds: Number(process.hrtime.bigint() - started) / 1e9 };
}
function collectRecords(batches) { const records = []; for (const batch of batches) records.push(...batch); return records; }
function writeAvro(batches, filePath) {
  const records = collectRecords(batches); const started = process.hrtime.bigint();
  const buffer = writeAvroBuffer(records); fs.writeFileSync(filePath, buffer);
  return { path: filePath, records: records.length, grade_records: records.reduce((sum, row) => sum + (row.notas || []).length, 0), bytes: buffer.length, write_seconds: Number(process.hrtime.bigint() - started) / 1e9 };
}
function writeParquet(batches, filePath) {
  const records = collectRecords(batches); const started = process.hrtime.bigint();
  const buffer = writeParquetBuffer(records); fs.writeFileSync(filePath, buffer);
  return { path: filePath, records: records.length, grade_records: records.reduce((sum, row) => sum + (row.notas || []).length, 0), bytes: buffer.length, write_seconds: Number(process.hrtime.bigint() - started) / 1e9 };
}
const WRITERS = { jsonl: writeJsonl, csv: writeCsv, avro: writeAvro, parquet: writeParquet, sql: writeSql };
function parseDestinations(raw) {
  const list = String(raw || 'jsonl,csv,avro,parquet,sql').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  const unknown = list.filter((item) => !WRITERS[item]);
  if (unknown.length) throw new Error(`Destinos desconhecidos: ${unknown.join(',')}`);
  if (!list.length) throw new Error('Informe ao menos um destino');
  return [...new Set(list)];
}
function clampRecords(value) {
  const records = Number(value) || 0;
  if (!Number.isInteger(records) || records < 1) throw new Error('records deve ser um inteiro >= 1');
  if (records > MAX_RECORDS) throw new Error(`No painel admin o máximo é ${MAX_RECORDS} alunos por execução.`);
  return records;
}

async function runGenerate({ records, seed = 42, batchSize = 2000, destinations, outName }) {
  if (running) throw Object.assign(new Error('Já existe uma tarefa do laboratório em execução.'), { status: 409 });
  running = true;
  try {
    const n = clampRecords(records);
    const numericSeed = Number.isFinite(Number(seed)) ? Number(seed) : 42;
    const size = Number(batchSize) || 2000;
    if (!Number.isInteger(size) || size < 1 || size > 50000) throw Object.assign(new Error('batch_size deve estar entre 1 e 50 000.'), { status: 400 });
    const dests = parseDestinations(destinations);
    const runId = normalizeRunId(outName || `run_${Date.now()}`);
    const outDir = path.join(labRoot(), runId);
    ensureDir(outDir);
    const catalog = await loadCatalog();
    const writes = {};
    const started = process.hrtime.bigint();
    for (const destination of dests) {
      const filePath = destination === 'sql' ? null : path.join(outDir, DEST_FILES[destination]);
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      writes[destination] = destination === 'sql'
        ? writeSql(generateBatches(n, numericSeed, size, catalog, runId), runId, outDir)
        : WRITERS[destination](generateBatches(n, numericSeed, size, catalog, runId), filePath);
      if (filePath) writes[destination].path = path.basename(filePath);
    }
    const firstWrite = Object.values(writes)[0] || {};
    const result = {
      out_dir: runId, out_path: outDir, records: n, grade_records: Number(firstWrite.grade_records || 0),
      seed: numericSeed, batch_size: size, destinations: dests, writes,
      elapsed_seconds: Number(process.hrtime.bigint() - started) / 1e9,
      created_at: new Date().toISOString(), engine: 'node-admin-school',
    };
    fs.writeFileSync(path.join(outDir, 'run_meta.json'), JSON.stringify(result, null, 2));
    saveLatest(result);
    return result;
  } finally { running = false; }
}

async function validateRun(outName, sampleSize = 100) {
  const runId = normalizeRunId(outName);
  const outDir = path.join(labRoot(), runId);
  const metaPath = path.join(outDir, 'run_meta.json');
  if (!fs.existsSync(metaPath)) throw Object.assign(new Error('Execução ou metadados não encontrados.'), { status: 404 });
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const expectedGrades = Number(meta.grade_records || 0);
  const fingerprints = {};
  if (meta.destinations.includes('jsonl')) fingerprints.jsonl = fingerprintText(path.join(outDir, DEST_FILES.jsonl), 'jsonl', sampleSize);
  if (meta.destinations.includes('csv')) fingerprints.csv = fingerprintText(path.join(outDir, DEST_FILES.csv), 'csv', sampleSize);
  if (meta.destinations.includes('sql')) fingerprints.sql = fingerprintSql(path.join(outDir, 'criar_dados.sql'));
  for (const format of ['avro', 'parquet']) if (meta.destinations.includes(format)) fingerprints[format] = { count: null, grade_records: null, bytes: fs.statSync(path.join(outDir, DEST_FILES[format])).size, validation: 'not_decoded', message: `Não existe leitor JS de ${format} configurado; contagem não é presumida.` };
  const comparable = Object.entries(fingerprints).filter(([, fp]) => Number.isFinite(fp.count));
  const checks = comparable.map(([format, fp]) => ({
    format,
    count: fp.count,
    expected: Number(meta.records),
    count_ok: fp.count === Number(meta.records),
    grade_records: fp.grade_records,
    expected_grade_records: expectedGrades,
    grades_ok: fp.grade_records === expectedGrades,
    sample_hash: fp.sample_hash || null,
  }));
  const fullyValidated = comparable.length === meta.destinations.length;
  const equivalent = fullyValidated && checks.every((check) => check.count_ok && check.grades_ok)
    && new Set(checks.map((check) => check.sample_hash)).size <= 1;
  const result = {
    out_dir: runId,
    status: !fullyValidated ? 'partial' : equivalent ? 'equivalent' : 'mismatch',
    equivalent,
    summary: fullyValidated
      ? (equivalent ? 'Todos os destinos foram lidos e as contagens, notas e hashes amostrados coincidem.' : 'Foram detectadas diferenças nos dados comparáveis.')
      : 'Validação parcial: alguns formatos binários não foram descodificados; não foram assumidos equivalentes.',
    checks,
    fingerprints,
    quality: { schema_fields: SCHEMA_FIELDS.length, student_records_expected: meta.records, grade_records_expected: expectedGrades, deterministic_seed: meta.seed },
    checked_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'validation_report.json'), JSON.stringify(result, null, 2));
  return result;
}
function fingerprintText(filePath, format, sampleSize) {
  const lines = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  let count = 0; let gradeRecords = 0; let gradeSum = 0;
  const hashes = [];
  let headers = null;
  for (const line of lines) {
    let row;
    if (format === 'jsonl') row = JSON.parse(line);
    else {
      if (!headers) { headers = line.split(','); continue; }
      const values = line.split(',');
      row = Object.fromEntries(headers.map((field, index) => [field, values[index]]));
      try { row.notas = JSON.parse(row.notas || '[]'); } catch { row.notas = []; }
    }
    count += 1;
    for (const note of row.notas || []) { gradeRecords += 1; gradeSum += Number(note.nota) || 0; }
    if (hashes.length < sampleSize) hashes.push(`${row.id}:${crypto.createHash('sha256').update(JSON.stringify({ id: row.id, email: row.email, turma_id: row.turma_id, notas: row.notas })).digest('hex')}`);
  }
  return { count, grade_records: gradeRecords, sum_notas: gradeSum.toFixed(2), sample_hash: crypto.createHash('sha256').update(hashes.join('|')).digest('hex') };
}
function fingerprintSql(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  return { count: (sql.match(/INSERT INTO alunos\s*\(/gi) || []).length, grade_records: (sql.match(/\(@lab_matricula_id,/g) || []).length, bytes: Buffer.byteLength(sql) };
}

async function runBenchmark({ records, seed = 42, batchSize = 2000, destinations, outName, repeats = 3 }) {
  const gen = await runGenerate({ records, seed, batchSize, destinations, outName: outName || `bench_${Date.now()}` });
  const measurements = await benchmarkFiles({ outDir: gen.out_path, runId: gen.out_dir, destinations: gen.destinations, repeats, records: gen.records });
  const formats = {};
  const csvBytes = gen.writes.csv?.bytes || null;
  for (const destination of gen.destinations) {
    const write = gen.writes[destination];
    formats[destination] = {
      bytes: write.bytes || 0,
      student_records: write.records,
      grade_records: write.grade_records,
      write_seconds: { median: write.write_seconds, min: write.write_seconds, max: write.write_seconds },
      write_records_per_sec: { median: write.write_seconds > 0 ? gen.records / write.write_seconds : 0 },
      compression_vs_csv: csvBytes ? (write.bytes || 0) / csvBytes : null,
      ...measurements.formats[destination],
    };
  }
  const report = {
    records: gen.records, grade_records: gen.grade_records, seed: gen.seed, batch_size: gen.batch_size,
    destinations: gen.destinations, out_dir: gen.out_dir, out_path: gen.out_path,
    elapsed_seconds: gen.elapsed_seconds, writes: gen.writes, formats,
    repeats: measurements.repeats, environment: measurements.environment,
    cold_cache_note: 'Primeira leitura considerada relativa, sem limpeza da cache do sistema operativo.',
    created_at: new Date().toISOString(), engine: 'node-admin-school',
  };
  fs.writeFileSync(path.join(gen.out_path, 'benchmark_report.json'), JSON.stringify(report, null, 2));
  saveLatest({ ...gen, benchmark: report });
  return report;
}
function saveLatest(payload) {
  ensureDir(labRoot());
  fs.writeFileSync(path.join(labRoot(), 'latest.json'), JSON.stringify(payload, null, 2));
}
function listRuns() {
  const root = labRoot();
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter((name) => fs.statSync(path.join(root, name)).isDirectory() && fs.existsSync(path.join(root, name, 'run_meta.json')))
    .map((name) => { const meta = JSON.parse(fs.readFileSync(path.join(root, name, 'run_meta.json'), 'utf8')); return { out_dir: name, records: meta.records, grade_records: meta.grade_records, seed: meta.seed, destinations: meta.destinations, created_at: meta.created_at, elapsed_seconds: meta.elapsed_seconds }; })
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
function getLatest() { const file = path.join(labRoot(), 'latest.json'); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; }
function resolveArtifact(outName, file) {
  const runId = normalizeRunId(outName);
  const base = path.basename(String(file || ''));
  const allowed = ['transacoes.jsonl', 'transacoes.csv', 'transacoes.avro', 'transacoes.parquet', 'criar_dados.sql', 'apagar_dados.sql', 'run_meta.json', 'benchmark_report.json', 'validation_report.json'];
  if (!allowed.includes(base)) throw Object.assign(new Error('Ficheiro não permitido.'), { status: 403 });
  const root = path.resolve(labRoot()); const fullPath = path.resolve(root, runId, base);
  if (!fullPath.startsWith(root + path.sep) || !fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) throw Object.assign(new Error('Ficheiro não encontrado.'), { status: 404 });
  return fullPath;
}
module.exports = { MAX_RECORDS, DEST_FILES, runGenerate, validateRun, runBenchmark, listRuns, getLatest, resolveArtifact, parseDestinations, isRunning: () => running };
