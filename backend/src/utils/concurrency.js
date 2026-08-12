// Locking otimista: impede a perda silenciosa de dados quando dois utilizadores
// editam o mesmo registo (Fase 29). O cliente envia o `updated_at` que tem;
// se o servidor já tiver outro valor, o registo foi alterado noutro lado → 409.
function conflitoDeVersao(versaoCliente, versaoAtual) {
  if (versaoCliente == null || versaoCliente === '') return false;
  if (versaoAtual == null) return false;
  const a = new Date(versaoCliente).getTime();
  const b = new Date(versaoAtual).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return a !== b;
}

module.exports = { conflitoDeVersao };
