export function temEscopoCoordenacao(user) {
  if (!user) return false;
  return !!(user.curso_coordenado || user.nivel_coordenado);
}

/** Acesso ao módulo de notas (professor lança nas suas disciplinas; coordenador no seu âmbito) */
export function podeAcederNotas(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'coordenador') return temEscopoCoordenacao(user);
  if (user.role === 'professor') return true;
  return false;
}

/** Coordenador pode alterar notas no ciclo/curso que coordena */
export function podeEditarNotas(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'coordenador') return temEscopoCoordenacao(user);
  if (user.role === 'professor') return temEscopoCoordenacao(user);
  return false;
}

export function isProfessor(user) {
  return user?.role === 'professor';
}

export function isCoordenador(user) {
  return user?.role === 'coordenador' || (user?.role === 'professor' && temEscopoCoordenacao(user));
}

/** Dashboard, inscrições: só onde coordena */
export function podeAcederInformacaoGeral(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return isCoordenador(user);
}

export function podeDesignarCoordenador(user) {
  return user?.role === 'admin' || isCoordenador(user);
}
