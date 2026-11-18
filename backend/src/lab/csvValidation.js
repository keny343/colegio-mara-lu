'use strict';

const fs = require('fs');
const crypto = require('crypto');

// Parses quoted CSV fields (including commas and escaped quotes), unlike split(',').
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((value) => value !== '')) rows.push(row);
  }
  return rows;
}

function numberOrOriginal(value) {
  if (value === '' || value == null) return value;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function fingerprintCsv(filePath, sampleSize = 100) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('CSV sem cabeçalho ou sem conteúdo.');
  const [headers, ...data] = rows;
  const index = Object.fromEntries(headers.map((header, i) => [header, i]));
  if (index.id == null || index.notas == null) throw new Error('Cabeçalho CSV inválido: campos id e notas são obrigatórios.');

  let count = 0;
  let gradeRecords = 0;
  let gradeSum = 0;
  const hashes = [];
  for (const values of data) {
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']));
    let notes;
    try {
      notes = JSON.parse(row.notas || '[]');
    } catch (error) {
      throw new Error(`Campo notas inválido no registo CSV ${count + 1}: ${error.message}`);
    }
    if (!Array.isArray(notes)) throw new Error(`Campo notas não é uma lista no registo CSV ${count + 1}.`);
    row.notas = notes;
    row.id = numberOrOriginal(row.id);
    row.turma_id = numberOrOriginal(row.turma_id);
    count += 1;
    for (const note of notes) {
      gradeRecords += 1;
      gradeSum += Number(note.nota) || 0;
    }
    if (hashes.length < Math.max(0, Number(sampleSize) || 0)) {
      hashes.push(`${row.id}:${crypto.createHash('sha256')
        .update(JSON.stringify({ id: row.id, email: row.email, turma_id: row.turma_id, notas: row.notas }))
        .digest('hex')}`);
    }
  }
  return {
    count,
    grade_records: gradeRecords,
    sum_notas: gradeSum.toFixed(2),
    sample_hash: crypto.createHash('sha256').update(hashes.join('|')).digest('hex'),
  };
}

module.exports = { parseCsv, fingerprintCsv };
