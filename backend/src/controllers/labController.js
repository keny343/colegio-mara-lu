'use strict';

const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const lab = require('../lab/pipeline');
const { adminMiddleware } = require('../middleware/auth');

const DOWNLOAD_TTL_SECONDS = 60;
const usedTokens = new Map(); // jti -> expiração (ms): cada link só funciona uma vez

function sendErr(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('[lab]', err);
  return res.status(status).json({ message: err.message || 'Erro no laboratório de dados.' });
}

function purgeTokens() {
  const now = Date.now();
  for (const [jti, exp] of usedTokens) if (exp < now) usedTokens.delete(jti);
}

async function status(req, res) {
  try {
    return res.json({
      running: lab.isRunning(),
      current_job: lab.currentJobSummary(),
      max_records: lab.MAX_RECORDS,
      max_batch: lab.MAX_BATCH,
      destinations: Object.keys(lab.DEST_FILES),
      latest: lab.getLatest(),
      runs: lab.listRuns().slice(0, 20),
      disk: lab.diskInfo(),
      note: 'Motor em streaming (Node). Gerar, validar e medir correm em segundo plano; consulte o progresso em /admin/lab/jobs/:id.',
    });
  } catch (err) { return sendErr(res, err); }
}

async function generate(req, res) {
  try {
    const { records, seed, batch_size: batchSize, destinations, out_name: outName } = req.body || {};
    const job = lab.startGenerate({ records, seed, batchSize, destinations, outName });
    return res.status(202).json({ job_id: job.id });
  } catch (err) { return sendErr(res, err); }
}

async function validate(req, res) {
  try {
    const outName = req.body?.out_dir || req.query?.out_dir;
    if (!outName) return res.status(400).json({ message: 'Informe out_dir.' });
    const job = lab.startValidate(outName, req.body?.sample_size || req.query?.sample_size);
    return res.status(202).json({ job_id: job.id });
  } catch (err) { return sendErr(res, err); }
}

async function benchmark(req, res) {
  try {
    const { records, seed, batch_size: batchSize, destinations, out_name: outName, repeats } = req.body || {};
    const job = lab.startBenchmark({ records, seed, batchSize, destinations, outName, repeats });
    return res.status(202).json({ job_id: job.id });
  } catch (err) { return sendErr(res, err); }
}

async function job(req, res) {
  const found = lab.getJob(req.params.id);
  if (!found) return res.status(404).json({ message: 'Tarefa não encontrada (o servidor pode ter reiniciado).' });
  return res.json(found);
}

/** Cria um link de descarga assinado (60 s, uso único). Funciona entre Vercel e Render sem cookies. */
async function downloadLink(req, res) {
  try {
    const { out_dir: outDir, file } = req.body || {};
    const full = lab.resolveArtifact(outDir, file); // valida existência e allowlist
    const name = path.basename(full);
    const token = jwt.sign({ typ: 'lab-dl', out: outDir, file: name, uid: req.user.id }, process.env.JWT_SECRET, {
      expiresIn: DOWNLOAD_TTL_SECONDS, jwtid: crypto.randomBytes(8).toString('hex'),
    });
    return res.json({ url: `/admin/lab/download/${encodeURIComponent(outDir)}/${encodeURIComponent(name)}?t=${encodeURIComponent(token)}`, expires_in: DOWNLOAD_TTL_SECONDS });
  } catch (err) { return sendErr(res, err); }
}

function sendFile(req, res) {
  try {
    const full = lab.resolveArtifact(req.params.out_dir, req.params.file);
    return res.download(full, path.basename(full), (err) => {
      if (err && !res.headersSent) sendErr(res, err);
      else if (err) console.warn('[lab] descarga interrompida:', err.message);
    });
  } catch (err) { return sendErr(res, err); }
}

function download(req, res) {
  const token = req.query.t;
  if (!token) return adminMiddleware(req, res, () => sendFile(req, res)); // compatível com sessão por cookie
  try {
    const payload = jwt.verify(String(token), process.env.JWT_SECRET);
    if (payload.typ !== 'lab-dl' || payload.out !== req.params.out_dir || payload.file !== req.params.file) {
      return res.status(403).json({ message: 'Link de descarga inválido.' });
    }
    purgeTokens();
    if (usedTokens.has(payload.jti)) return res.status(410).json({ message: 'Este link já foi usado. Peça um novo.' });
    usedTokens.set(payload.jti, payload.exp * 1000 + 1000);
    return sendFile(req, res);
  } catch {
    return res.status(401).json({ message: 'Link de descarga expirado ou inválido. Peça um novo.' });
  }
}

module.exports = { status, generate, validate, benchmark, job, downloadLink, download };