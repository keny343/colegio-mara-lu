export const PERIODOS = [
  { key: '1PP', label: '1ª Parcial' },
  { key: '1PT', label: '1ª Trimestral' },
  { key: '2PP', label: '2ª Parcial' },
  { key: '2PT', label: '2ª Trimestral' },
  { key: '3PP', label: '3ª Parcial' },
  { key: '3PT', label: '3ª Trimestral' },
];

export const TRIMESTRES = [
  { id: 1, titulo: '1º Trimestre', parcial: '1PP', trimestral: '1PT' },
  { id: 2, titulo: '2º Trimestre', parcial: '2PP', trimestral: '2PT' },
  { id: 3, titulo: '3º Trimestre', parcial: '3PP', trimestral: '3PT' },
];

export function normalizarPeriodos(periodos = {}) {
  const out = { ...periodos };
  if (out['1º'] != null && out['1PP'] == null) out['1PP'] = out['1º'];
  if (out['2º'] != null && out['1PT'] == null) out['1PT'] = out['2º'];
  delete out['1º'];
  delete out['2º'];
  return out;
}

export function mediaTrimestre(periodos, parcial, trimestral) {
  const p = normalizarPeriodos(periodos);
  const vals = [p[parcial], p[trimestral]]
    .filter((v) => v !== undefined && v !== null && v !== '')
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

export function mediaAnual(periodos) {
  const medias = TRIMESTRES.map((t) => mediaTrimestre(periodos, t.parcial, t.trimestral))
    .filter((m) => m != null)
    .map(parseFloat);
  if (!medias.length) return null;
  return (medias.reduce((a, b) => a + b, 0) / medias.length).toFixed(1);
}
