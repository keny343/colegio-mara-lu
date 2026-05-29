export const normalizeSeriesName = (n) => {
  if (!n) return '';
  const collapsed = String(n).replace(/\s+\(([^)]+)\)\s+\(\1\)$/,' ($1)');
  return collapsed.trim();
};

export default normalizeSeriesName;
