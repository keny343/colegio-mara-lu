'use strict';

const path = require('path');
const fs = require('fs');
const lab = require('../lab/pipeline');
const { fingerprintCsv } = require('../lab/csvValidation');

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
      latest: lab.getLatest(),
      runs: lab.listRuns().slice(0, 20),
      note: 'Laboratório executado em JavaScript no backend. O benchmark repete a leitura dos artefactos e mede CPU/RSS do processo.',
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
    const sampleSize = Number(req.body?.sample_size || req.query?.sample_size || 100);
    const result = await lab.validateRun(outName, sampleSize);

    // Recompute CSV metrics with a quoted-field-aware parser. The earlier split(',')
    // logic broke the JSON array in notas at each comma and falsely reported zero grades.
    if (result.fingerprints?.csv) {
      const csvPath = lab.resolveArtifact(outName, 'transacoes.csv');
      const csvFingerprint = fingerprintCsv(csvPath, sampleSize);
      result.fingerprints.csv = csvFingerprint;
      const csvCheck = result.checks?.find((check) => check.format === 'csv');
      if (csvCheck) {
        csvCheck.count = csvFingerprint.count;
        csvCheck.grade_records = csvFingerprint.grade_records;
        csvCheck.count_ok = csvFingerprint.count === csvCheck.expected;
        csvCheck.grades_ok = csvFingerprint.grade_records === csvCheck.expected_grade_records;
        csvCheck.sample_hash = csvFingerprint.sample_hash;
      }
    }

    const checks = result.checks || [];
    const hashes = checks.map((check) => check.sample_hash).filter(Boolean);
    const checksPass = checks.length > 0 && checks.every((check) => check.count_ok && check.grades_ok);
    const hashesAgree = hashes.length >= 2 && new Set(hashes).size === 1;
    const hasUndecodedFormats = Object.values(result.fingerprints || {}).some((item) => item.validation === 'not_decoded');
    result.equivalent = checksPass && hashesAgree && !hasUndecodedFormats;
    result.status = hasUndecodedFormats ? 'partial' : result.equivalent ? 'equivalent' : 'mismatch';
    result.summary = hasUndecodedFormats
      ? 'Validação parcial: os formatos legíveis foram comparados; Avro/Parquet ainda não foram descodificados.'
      : result.equivalent
        ? 'Contagens, quantidade de notas e hashes amostrados coincidem.'
        : 'Foram detectadas diferenças; consulte as contagens, notas e hashes por formato.';

    const reportPath = lab.resolveArtifact(outName, 'validation_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
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
