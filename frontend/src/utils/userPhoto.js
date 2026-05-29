/** URL da foto de perfil (ficheiro em uploads/avatars ou URL completa) */
export function urlFoto(user) {
  const raw = user?.foto_url;
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/uploads/')) {
    return raw;
  }
  return `/uploads/avatars/${raw}`;
}
