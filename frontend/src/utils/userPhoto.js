/** URL da foto de perfil (Supabase/Cloudinary ou avatares legados em uploads/avatars) */
const apiBase = process.env.REACT_APP_API_URL || '';

export function urlFoto(user) {
  const raw = user?.foto_url;
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  if (raw.startsWith('/uploads/')) {
    return `${apiBase}${raw}`;
  }
  return `${apiBase}/uploads/avatars/${raw}`;
}
