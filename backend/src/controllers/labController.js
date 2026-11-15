'use strict';

const path = require('path');
const lab = require('../lab/pipeline');

function sendErr(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('[lab]', err);
  return res.status(status).json({ message: err.message || 'Erro no laboratório de dados.' });
}

async function status(req, res) {
  try {
    return res.json({
      running: lab.isRunning(),
      max_records: lab.MAX_RECORDS,
      destinations: Object.keys(lab.DEST_FILES),
      sql_files: { criar: lab.DEST_FILES.sql, eliminar: lab.SQL_DROP_FILE },
      domain: 'notas-alunos-angola',
      latest: lab.getLatest(),
      runs: lab.listRuns().slice(0, 20),
      note: 'Volumes académicos S/M (1M/10M) correm no CLI Python (data-engineering/).',
    });
  } catch (err) {
    return sendErr(res, err);
  }
}

async function generate(req, res) {
  try {
    const { records, seed, batch_size, destinations, out_name } = req.body || {};
    const result = await lab.runGenerate({
      records,
      seed: seed == null ? 42 : Number(seed),
      batchSize: batch_size == null ? 2000 : Number(batch_size),
      destinations,
      outName: out_name,
    });
    return res.json(result);
  } catch (err) {
    return sendErr(res, err);
  }
}

async function validate(req, res) {
  try {
    const outName = req.body?.out_dir || req.query?.out_dir;
    if (!outName) return res.status(400).json({ message: 'Informe out_dir.' });
    const result = await lab.validateRun(outName);
    return res.json(result);
  } catch (err) {
    return sendErr(res, err);
  }
}

async function benchmark(req, res) {
  try {
    const { records, seed, batch_size, destinations, out_name, repeats } = req.body || {};
    const result = await lab.runBenchmark({
      records,
      seed: seed == null ? 42 : Number(seed),
      batchSize: batch_size == null ? 2000 : Number(batch_size),
      destinations,
      outName: out_name,
      repeats: repeats == null ? 5 : Number(repeats),
    });
    return res.json(result);
  } catch (err) {
    return sendErr(res, err);
  }
}

async function download(req, res) {
  try {
    const full = lab.resolveArtifact(req.params.out_dir, req.params.file);
    return res.download(full, path.basename(full));
  } catch (err) {
    return sendErr(res, err);
  }
}

module.exports = { status, generate, validate, benchmark, download };