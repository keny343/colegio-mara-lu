// Política de senhas da aplicação
function validarSenha(senha) {
  const s = senha == null ? '' : String(senha);
  if (s.length < 8) {
    return { ok: false, message: 'A senha deve ter pelo menos 8 caracteres.' };
  }
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) {
    return { ok: false, message: 'A senha deve conter letras e números.' };
  }
  return { ok: true };
}

module.exports = { validarSenha };
