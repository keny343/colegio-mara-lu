// Geração do relatório "alunos e notas" de uma turma.
// Recebe a resposta de GET /(staff|professor)/turmas/:id/relatorio-notas

const ESCOLA = 'Colégio Mara Lu';

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// 14 → "14", 12.5 → "12,5", null → "—" (vírgula decimal, como em Angola/Portugal)
const fmt = (v, vazio = '—') => {
  if (v === null || v === undefined || v === '') return vazio;
  const n = Number(v);
  if (Number.isNaN(n)) return vazio;
  return String(Math.round(n * 10) / 10).replace('.', ',');
};

const nomeTurma = (t) =>
  `${t.nome} — ${t.serie_classe}ª classe${t.curso_nome ? ` · ${t.curso_nome}` : ''} (${t.ano_letivo})`;

const slug = (s) =>
  String(s || 'turma')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const dataHora = (iso) =>
  new Date(iso || Date.now()).toLocaleString('pt-AO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

// ---------------------------------------------------------------- CSV (Excel)

// Evita "injecção de fórmulas" no Excel: células que começam por = + - @ passam a texto.
const celulaCsv = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export function gerarCsv(dados) {
  const { turma, periodos, disciplinas, alunos } = dados;
  const discPorId = new Map(disciplinas.map((d) => [d.id, d.nome]));
  const cab = ['Nº', 'Aluno', 'Disciplina', ...periodos.map((p) => p.label), 'Média anual', 'Situação'];

  const linhas = [cab];
  alunos.forEach((a, i) => {
    a.disciplinas.forEach((d) => {
      linhas.push([
        i + 1,
        a.aluno_nome,
        discPorId.get(d.disciplina_id) || '',
        ...periodos.map((p) => fmt(d.periodos[p.key], '')),
        fmt(d.media, ''),
        d.positiva == null ? 'Sem notas' : d.positiva ? 'Positiva' : 'Negativa',
      ]);
    });
  });

  const topo = [
    [ESCOLA],
    ['Relatório de notas', nomeTurma(turma)],
    ['Gerado em', dataHora(dados.gerado_em)],
    [],
  ];
  // \uFEFF (BOM) para o Excel abrir os acentos correctamente; ";" é o separador do Excel em pt
  return '\uFEFF' + [...topo, ...linhas].map((l) => l.map(celulaCsv).join(';')).join('\r\n');
}

function descarregar(conteudo, nomeFicheiro, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFicheiro;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function descarregarCsv(dados) {
  const ficheiro = `notas-${slug(dados.turma.nome)}-${dados.turma.ano_letivo}.csv`;
  descarregar(gerarCsv(dados), ficheiro, 'text/csv;charset=utf-8');
}

// ------------------------------------------------------- HTML (imprimir / PDF)

const classeNota = (valor, minimo) => {
  if (valor === null || valor === undefined || valor === '') return '';
  return Number(valor) < minimo ? ' class="neg"' : '';
};

export function gerarHtmlRelatorio(dados, { geradoPor } = {}) {
  const { turma, periodos, disciplinas, alunos, limites } = dados;
  const minimo = dados.nota_minima;

  // 1) Resumo: uma coluna por disciplina com a média anual
  const resumoCab = disciplinas.map((d) => `<th>${esc(d.nome)}</th>`).join('');
  const resumoLinhas = alunos.map((a, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td class="nome">${esc(a.aluno_nome)}</td>
      ${a.disciplinas.map((d) => `<td${classeNota(d.media, minimo)}>${fmt(d.media)}</td>`).join('')}
      <td${classeNota(a.media_geral, minimo)}><strong>${fmt(a.media_geral)}</strong></td>
      <td>${a.negativas}</td>
    </tr>`).join('');

  const comNotas = alunos.filter((a) => a.media_geral != null);
  const mediaTurma = comNotas.length
    ? fmt(comNotas.reduce((s, a) => s + Number(a.media_geral), 0) / comNotas.length)
    : '—';
  const alunosComNegativas = alunos.filter((a) => a.negativas > 0).length;

  // 2) Detalhe: uma tabela por disciplina com os seis períodos
  const detalhe = disciplinas.map((disc, idx) => {
    const linhas = alunos.map((a, i) => {
      const d = a.disciplinas[idx];
      return `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="nome">${esc(a.aluno_nome)}</td>
        ${periodos.map((p) => `<td${classeNota(d.periodos[p.key], minimo)}>${fmt(d.periodos[p.key])}</td>`).join('')}
        <td${classeNota(d.media, minimo)}><strong>${fmt(d.media)}</strong></td>
      </tr>`;
    }).join('');
    return `
    <section class="detalhe">
      <h2>${esc(disc.nome)}</h2>
      <table>
        <thead><tr><th>Nº</th><th class="nome">Aluno</th>${periodos.map((p) => `<th>${esc(p.label)}</th>`).join('')}<th>Média</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </section>`;
  }).join('');

  const vazio = !alunos.length || !disciplinas.length;

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<title>Relatório de notas — ${esc(turma.nome)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #3D1F0A; font-size: 11px; margin: 0; padding: 16px; }
  header { border-bottom: 3px solid #E8641A; padding-bottom: 8px; margin-bottom: 12px; }
  header h1 { margin: 0; font-size: 18px; color: #E8641A; }
  header p { margin: 2px 0 0; font-size: 12px; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 24px; margin: 8px 0 14px; font-size: 11px; }
  .meta strong { color: #6B3A1F; }
  h2 { font-size: 14px; margin: 18px 0 6px; color: #6B3A1F; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d9c3a8; padding: 4px 6px; text-align: center; }
  th { background: #F5E6D3; color: #3D1F0A; }
  td.nome, th.nome { text-align: left; }
  td.num { width: 28px; color: #6B3A1F; }
  tr:nth-child(even) td { background: #fdf8f2; }
  .neg { color: #c0261b; font-weight: bold; }
  .detalhe { break-before: page; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
  footer { margin-top: 14px; font-size: 10px; color: #6B3A1F; }
  .legenda { margin-top: 6px; font-size: 10px; }
  .aviso { padding: 16px; text-align: center; border: 1px dashed #d9c3a8; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <header>
    <h1>${ESCOLA}</h1>
    <p>Relatório de alunos e notas</p>
  </header>
  <div class="meta">
    <span><strong>Turma:</strong> ${esc(nomeTurma(turma))}</span>
    ${turma.turno ? `<span><strong>Turno:</strong> ${esc(turma.turno)}</span>` : ''}
    <span><strong>Alunos:</strong> ${alunos.length}</span>
    <span><strong>Escala:</strong> ${limites.min}–${limites.max} (mínimo ${minimo})</span>
    ${vazio ? '' : `<span><strong>Média da turma:</strong> ${mediaTurma}</span>`}
    ${vazio ? '' : `<span><strong>Alunos com negativas:</strong> ${alunosComNegativas}</span>`}
  </div>
  ${vazio
    ? '<p class="aviso">Não há alunos ou disciplinas com dados para esta turma.</p>'
    : `
  <h2>Resumo — média anual por disciplina</h2>
  <table>
    <thead><tr><th>Nº</th><th class="nome">Aluno</th>${resumoCab}<th>Média geral</th><th>Negativas</th></tr></thead>
    <tbody>${resumoLinhas}</tbody>
  </table>
  <p class="legenda">Notas a vermelho estão abaixo do mínimo (${minimo}). A média anual é a média dos três trimestres (parcial + trimestral); "—" indica nota ainda não lançada.</p>
  ${detalhe}`}
  <footer>Gerado em ${esc(dataHora(dados.gerado_em))}${geradoPor ? ` por ${esc(geradoPor)}` : ''}</footer>
</body>
</html>`;
}

// Abre uma janela já preparada (chamar de forma síncrona no clique, antes do pedido
// à API, para não ser bloqueada) e imprime depois de preenchida.
export function abrirJanelaRelatorio() {
  const w = window.open('', '_blank');
  if (w) {
    w.document.write('<p style="font-family:Arial;padding:24px">A preparar relatório…</p>');
  }
  return w;
}

export function imprimirRelatorio(janela, dados, opcoes) {
  if (!janela || janela.closed) return false;
  janela.document.open();
  janela.document.write(gerarHtmlRelatorio(dados, opcoes));
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 300);
  return true;
}