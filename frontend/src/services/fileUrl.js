// Devolve URL de download de um ficheiro armazenado.
// - URLs completos (Supabase/Cloudinary) são devolvidos diretamente.
// - Caminhos locais legados passam pelo endpoint autenticado /api/arquivos/*.
const apiBase = process.env.REACT_APP_API_URL || '';

export function fileUrl(caminho) {
  if (!caminho) return null;
  const c = String(caminho);
  if (c.startsWith('http')) {
    if (c.includes('/image/upload/') && c.endsWith('.pdf')) {
      return c.replace('/image/upload/', '/raw/upload/');
    }
    return c;
  }
  return `${apiBase}/api/arquivos/${c}`;
}
