function escaparCelula(valor) {
  if (valor == null) return '""';

  let texto = String(valor);
  if (typeof valor === 'string' && /^[\s]*[=+\-@]/u.test(texto)) {
    texto = `'${texto}`;
  }

  return `"${texto.replace(/"/g, '""')}"`;
}

export function criarCsv(cabecalhos, linhas) {
  const registos = [cabecalhos, ...linhas];
  const conteudo = registos
    .map((linha) => linha.map(escaparCelula).join(';'))
    .join('\r\n');

  return `\uFEFF${conteudo}`;
}

export function baixarCsv(nomeFicheiro, cabecalhos, linhas) {
  const ficheiro = new Blob([criarCsv(cabecalhos, linhas)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(ficheiro);
  const link = document.createElement('a');

  link.href = url;
  link.download = nomeFicheiro;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
