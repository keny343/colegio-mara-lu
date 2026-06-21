const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.title = 'Projecto 1 – Análise Léxica e Sintática';

// Color palette: Midnight Executive
const C = {
  navy:    "1E2761",
  iceBlue: "CADCFC",
  white:   "FFFFFF",
  accent:  "4FC3F7",
  dark:    "0D1B4B",
  gray:    "8899BB",
  light:   "EEF2FF",
  green:   "00C896",
  red:     "F96167",
};

const makeShadow = () => ({ type: "outer", blur: 10, offset: 3, angle: 45, color: "000000", opacity: 0.18 });

// ─── SLIDE 1: CAPA ────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  // Top accent band (full-width, subtle)
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.1, fill: { color: C.dark }, line: { color: C.dark } });

  // Institution top
  s.addText("Tópicos Avançados de Compiladores", {
    x: 0.5, y: 0.2, w: 9, h: 0.7,
    fontSize: 16, color: C.iceBlue, fontFace: "Calibri", align: "center", italic: true
  });

  // Main title card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 1.4, w: 9, h: 2.4,
    fill: { color: C.white, transparency: 5 },
    rectRadius: 0.12,
    shadow: makeShadow()
  });
  s.addText("PROJECTO 1", {
    x: 0.5, y: 1.5, w: 9, h: 0.65,
    fontSize: 22, bold: true, color: C.accent, fontFace: "Calibri", align: "center", charSpacing: 6
  });
  s.addText("Análise Léxica e Sintática", {
    x: 0.5, y: 2.1, w: 9, h: 0.9,
    fontSize: 34, bold: true, color: C.navy, fontFace: "Calibri", align: "center"
  });
  s.addText("Desenvolvimento de um Analisador para a Linguagem SimpleScript", {
    x: 0.7, y: 3.0, w: 8.6, h: 0.55,
    fontSize: 15, color: C.gray, fontFace: "Calibri", align: "center", italic: true
  });

  // Bottom info
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 4.8, w: 10, h: 0.82, fill: { color: C.dark }, line: { color: C.dark } });
  s.addText("Grupo: Estudante 1 · Estudante 2 · Estudante 3       |       Prof. MSc. J.K. Kahumba       |       2025", {
    x: 0.3, y: 4.87, w: 9.4, h: 0.6,
    fontSize: 13, color: C.iceBlue, fontFace: "Calibri", align: "center"
  });
}

// ─── SLIDE 2: AGENDA ──────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.light };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("Agenda", { x: 0.4, y: 0.1, w: 9, h: 0.8, fontSize: 30, bold: true, color: C.white, fontFace: "Calibri" });

  const items = [
    ["01", "Introdução e Contextualização"],
    ["02", "Objectivos do Projecto"],
    ["03", "A Linguagem SimpleScript"],
    ["04", "Arquitectura do Sistema"],
    ["05", "Implementação"],
    ["06", "Testes e Resultados"],
    ["07", "Conclusão"],
  ];

  items.forEach(([num, label], i) => {
    const col = i < 4 ? 0 : 1;
    const row = i < 4 ? i : i - 4;
    const x = col === 0 ? 0.4 : 5.3;
    const y = 1.15 + row * 0.92;

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: 4.5, h: 0.75,
      fill: { color: C.white },
      rectRadius: 0.08,
      shadow: makeShadow()
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: x + 0.06, y: y + 0.08, w: 0.58, h: 0.58,
      fill: { color: C.navy }, rectRadius: 0.04, line: { color: C.navy }
    });
    s.addText(num, { x: x + 0.06, y: y + 0.08, w: 0.58, h: 0.58, fontSize: 14, bold: true, color: C.accent, fontFace: "Calibri", align: "center", valign: "middle", margin: 0 });
    s.addText(label, { x: x + 0.72, y: y + 0.1, w: 3.7, h: 0.55, fontSize: 14, color: C.navy, fontFace: "Calibri", valign: "middle" });
  });
}

// ─── SLIDE 3: INTRODUÇÃO ──────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.white };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("01  |  Introdução", { x: 0.4, y: 0.1, w: 9, h: 0.8, fontSize: 28, bold: true, color: C.white, fontFace: "Calibri" });

  // Left column: context
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.3, y: 1.1, w: 4.4, h: 3.8,
    fill: { color: C.light }, rectRadius: 0.1, shadow: makeShadow()
  });
  s.addText("Contextualização", { x: 0.5, y: 1.2, w: 4.0, h: 0.5, fontSize: 16, bold: true, color: C.navy, fontFace: "Calibri" });
  s.addText(
    "Os compiladores transformam código de alto nível em código executável. " +
    "As suas duas primeiras fases — análise léxica e sintática — " +
    "constituem o \"front-end\" e são fundamentais para qualquer linguagem de programação.",
    { x: 0.5, y: 1.75, w: 4.0, h: 2.8, fontSize: 14, color: "333333", fontFace: "Calibri", valign: "top" }
  );

  // Right column: justification
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 5.3, y: 1.1, w: 4.4, h: 3.8,
    fill: { color: C.light }, rectRadius: 0.1, shadow: makeShadow()
  });
  s.addText("Justificativa", { x: 5.5, y: 1.2, w: 4.0, h: 0.5, fontSize: 16, bold: true, color: C.navy, fontFace: "Calibri" });
  s.addText(
    "Este projecto aplica os conceitos teóricos de TAC num contexto prático, " +
    "consolidando o conhecimento sobre:\n\n" +
    "• Autómatos finitos\n• Expressões regulares\n• Gramáticas livres de contexto\n• Parsers de descida recursiva",
    { x: 5.5, y: 1.75, w: 4.0, h: 2.8, fontSize: 14, color: "333333", fontFace: "Calibri", valign: "top" }
  );

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.3, w: 10, h: 0.3, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("Projecto 1 – TAC | 2025", { x: 0.3, y: 5.32, w: 9.4, h: 0.26, fontSize: 11, color: C.iceBlue, fontFace: "Calibri", align: "right" });
}

// ─── SLIDE 4: OBJECTIVOS ──────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  s.addText("02  |  Objectivos do Projecto", {
    x: 0.4, y: 0.2, w: 9.2, h: 0.75, fontSize: 28, bold: true, color: C.white, fontFace: "Calibri"
  });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 0.92, w: 1.2, h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });

  const goals = [
    { icon: "01", title: "Tokenizar", desc: "Identificar e classificar tokens do código fonte (palavras-chave, operadores, identificadores)" },
    { icon: "02", title: "Gramática", desc: "Criar regras gramaticais formais para a linguagem SimpleScript" },
    { icon: "03", title: "Validar", desc: "Verificar se a estrutura sintática dos programas segue a gramática definida" },
    { icon: "04", title: "Erros", desc: "Detectar e reportar erros léxicos e sintáticos com mensagens claras e número de linha" },
  ];

  goals.forEach((g, i) => {
    const x = (i % 2) * 4.85 + 0.3;
    const y = Math.floor(i / 2) * 2.15 + 1.15;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: 4.4, h: 1.9,
      fill: { color: C.dark }, rectRadius: 0.1, shadow: makeShadow()
    });
    s.addShape(pres.shapes.OVAL, { x: x + 0.15, y: y + 0.2, w: 0.65, h: 0.65, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText(g.icon, { x: x + 0.15, y: y + 0.2, w: 0.65, h: 0.65, fontSize: 14, bold: true, color: C.navy, fontFace: "Calibri", align: "center", valign: "middle", margin: 0 });
    s.addText(g.title, { x: x + 0.9, y: y + 0.22, w: 3.3, h: 0.45, fontSize: 16, bold: true, color: C.accent, fontFace: "Calibri" });
    s.addText(g.desc, { x: x + 0.15, y: y + 0.9, w: 4.1, h: 0.9, fontSize: 13, color: C.iceBlue, fontFace: "Calibri" });
  });
}

// ─── SLIDE 5: LINGUAGEM SIMPLESCRIPT ─────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.white };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("03  |  A Linguagem SimpleScript", { x: 0.4, y: 0.1, w: 9, h: 0.8, fontSize: 28, bold: true, color: C.white, fontFace: "Calibri" });

  // Tokens table
  s.addText("Tokens Reconhecidos", { x: 0.3, y: 1.1, w: 4.5, h: 0.4, fontSize: 16, bold: true, color: C.navy, fontFace: "Calibri" });

  const tokens = [
    ["Tipo", "Exemplos"],
    ["KEYWORD", "if, else, while, print, int"],
    ["IDENTIFIER", "x, soma, resultado"],
    ["NUMBER", "0, 42, 3.14"],
    ["OPERATOR", "+, -, *, /, ==, !=, <, >"],
    ["ASSIGN", "="],
    ["DELIMITER", "( ) { } ;"],
  ];

  tokens.forEach((row, i) => {
    row.forEach((cell, j) => {
      const x = j === 0 ? 0.3 : 2.5;
      const w = j === 0 ? 2.1 : 2.1;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 1.52 + i * 0.5, w, h: 0.48,
        fill: { color: i === 0 ? C.navy : (i % 2 === 0 ? C.light : C.white) },
        line: { color: "DDDDDD" }
      });
      s.addText(cell, {
        x, y: 1.52 + i * 0.5, w, h: 0.48,
        fontSize: 12, bold: i === 0, color: i === 0 ? C.white : C.navy,
        fontFace: i > 0 && j === 1 ? "Courier New" : "Calibri", align: "center", valign: "middle", margin: 0
      });
    });
  });

  // Grammar excerpt
  s.addText("Exemplo de Programa", { x: 5.3, y: 1.1, w: 4.4, h: 0.4, fontSize: 16, bold: true, color: C.navy, fontFace: "Calibri" });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 5.3, y: 1.52, w: 4.4, h: 3.4,
    fill: { color: "1E1E2E" }, rectRadius: 0.1, shadow: makeShadow()
  });
  s.addText(
    "int x = 10 ;\nint y = 0 ;\n\nif ( x > 5 ) {\n  y = x + 1 ;\n  print ( y ) ;\n} else {\n  print ( x ) ;\n}",
    {
      x: 5.45, y: 1.6, w: 4.1, h: 3.2,
      fontSize: 13, color: "A8FF78", fontFace: "Courier New", valign: "top"
    }
  );

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.3, w: 10, h: 0.3, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("Projecto 1 – TAC | 2025", { x: 0.3, y: 5.32, w: 9.4, h: 0.26, fontSize: 11, color: C.iceBlue, fontFace: "Calibri", align: "right" });
}

// ─── SLIDE 6: ARQUITECTURA ────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.light };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("04  |  Arquitectura do Sistema", { x: 0.4, y: 0.1, w: 9, h: 0.8, fontSize: 28, bold: true, color: C.white, fontFace: "Calibri" });

  // Pipeline boxes
  const pipeline = [
    { label: "Código\nFonte", sub: ".sscript", color: C.gray, x: 0.3 },
    { label: "LEXER", sub: "lexer.py", color: C.navy, x: 2.5 },
    { label: "PARSER", sub: "parser.py", color: C.navy, x: 5.1 },
    { label: "Resultado\n/ Erros", sub: "output", color: C.green, x: 7.7 },
  ];

  pipeline.forEach((b, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: b.x, y: 1.8, w: 2.0, h: 1.5,
      fill: { color: b.color }, rectRadius: 0.1, shadow: makeShadow()
    });
    s.addText(b.label, { x: b.x, y: 1.85, w: 2.0, h: 0.95, fontSize: 15, bold: true, color: C.white, fontFace: "Calibri", align: "center", valign: "middle", margin: 0 });
    s.addText(b.sub, { x: b.x, y: 2.8, w: 2.0, h: 0.4, fontSize: 11, color: C.iceBlue, fontFace: "Courier New", align: "center", margin: 0 });

    // Arrow between boxes
    if (i < 3) {
      s.addShape(pres.shapes.LINE, {
        x: b.x + 2.05, y: 2.55, w: 0.4, h: 0,
        line: { color: C.accent, width: 2.5 }
      });
      s.addText("▶", { x: b.x + 2.3, y: 2.38, w: 0.3, h: 0.3, fontSize: 14, color: C.accent, fontFace: "Calibri", align: "center" });
    }
  });

  // Data labels below arrows
  ["Lista de\nTokens", "Árvore / Erros"].forEach((label, i) => {
    s.addText(label, {
      x: [3.25, 5.85][i], y: 3.45, w: 1.5, h: 0.6,
      fontSize: 11, color: C.navy, fontFace: "Calibri", italic: true, align: "center"
    });
  });

  // Module descriptions
  const mods = [
    { title: "Módulo Lexer", desc: "Usa expressões regulares (módulo re) para tokenizar o código. Ignora espaços e comentários. Reporta caracteres inválidos.", x: 0.3 },
    { title: "Módulo Parser", desc: "Descida recursiva. Cada regra da gramática = uma função Python. Valida estrutura e reporta erros sintáticos.", x: 5.1 },
  ];
  mods.forEach(m => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: m.x, y: 4.15, w: 4.35, h: 1.2,
      fill: { color: C.white }, rectRadius: 0.08, shadow: makeShadow()
    });
    s.addText(m.title, { x: m.x + 0.15, y: 4.2, w: 4.0, h: 0.38, fontSize: 14, bold: true, color: C.navy, fontFace: "Calibri" });
    s.addText(m.desc, { x: m.x + 0.15, y: 4.58, w: 4.0, h: 0.68, fontSize: 12, color: "444444", fontFace: "Calibri" });
  });
}

// ─── SLIDE 7: IMPLEMENTAÇÃO ───────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.white };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("05  |  Implementação", { x: 0.4, y: 0.1, w: 9, h: 0.8, fontSize: 28, bold: true, color: C.white, fontFace: "Calibri" });

  // Lexer code
  s.addText("Analisador Léxico – lexer.py", { x: 0.3, y: 1.1, w: 4.5, h: 0.38, fontSize: 14, bold: true, color: C.navy, fontFace: "Calibri" });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.3, y: 1.5, w: 4.5, h: 3.6, fill: { color: "1E1E2E" }, rectRadius: 0.1, shadow: makeShadow()
  });
  s.addText(
    "import re\n\nTOKENS = [\n  ('KEYWORD',  r'\\b(if|else|while|print|int)\\b'),\n  ('NUMBER',   r'\\d+(\\.\\d+)?'),\n  ('IDENT',    r'[a-zA-Z_]\\w*'),\n  ('OP',       r'==|!=|<=|>=|[+\\-*/=<>]'),\n  ('DELIM',    r'[(){}; ]'),\n]\n\ndef tokenize(code):\n  tokens = []\n  line = 1\n  pos = 0\n  while pos < len(code):\n    for kind, pat in TOKENS:\n      m = re.match(pat, code[pos:])\n      if m:\n        tokens.append((kind, m.group(), line))\n        pos += len(m.group())\n        break\n    else:\n      raise LexError(f\"Char inválido: {code[pos]} linha {line}\")\n  return tokens",
    { x: 0.45, y: 1.58, w: 4.2, h: 3.42, fontSize: 10.5, color: "A8FF78", fontFace: "Courier New", valign: "top" }
  );

  // Parser description
  s.addText("Analisador Sintático – parser.py", { x: 5.2, y: 1.1, w: 4.5, h: 0.38, fontSize: 14, bold: true, color: C.navy, fontFace: "Calibri" });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 5.2, y: 1.5, w: 4.5, h: 3.6, fill: { color: "1E1E2E" }, rectRadius: 0.1, shadow: makeShadow()
  });
  s.addText(
    "class Parser:\n  def __init__(self, tokens):\n    self.tokens = tokens\n    self.pos = 0\n\n  def current(self):\n    return self.tokens[self.pos]\n\n  def eat(self, kind):\n    if self.current()[0] == kind:\n      self.pos += 1\n    else:\n      raise SyntaxError(\n        f\"Esperado {kind}, \"\n        f\"encontrado {self.current()[1]} \"\n        f\"na linha {self.current()[2]}\"\n      )\n\n  def parse_if(self):\n    self.eat('KEYWORD')  # if\n    self.eat('DELIM')    # (\n    self.parse_expr()\n    self.eat('DELIM')    # )\n    self.parse_block()",
    { x: 5.35, y: 1.58, w: 4.2, h: 3.42, fontSize: 10.5, color: "7EC8E3", fontFace: "Courier New", valign: "top" }
  );

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.3, w: 10, h: 0.3, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("Projecto 1 – TAC | 2025", { x: 0.3, y: 5.32, w: 9.4, h: 0.26, fontSize: 11, color: C.iceBlue, fontFace: "Calibri", align: "right" });
}

// ─── SLIDE 8: TESTES E RESULTADOS ────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.light };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("06  |  Testes e Resultados", { x: 0.4, y: 0.1, w: 9, h: 0.8, fontSize: 28, bold: true, color: C.white, fontFace: "Calibri" });

  // Stats
  const stats = [
    { num: "5", label: "Casos de Teste", color: C.accent },
    { num: "100%", label: "Taxa de Sucesso", color: C.green },
    { num: "2", label: "Tipos de Erro Detectados", color: "F9A825" },
  ];
  stats.forEach((st, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.3 + i * 3.2, y: 1.05, w: 2.9, h: 1.2,
      fill: { color: C.navy }, rectRadius: 0.1, shadow: makeShadow()
    });
    s.addText(st.num, { x: 0.3 + i * 3.2, y: 1.08, w: 2.9, h: 0.7, fontSize: 34, bold: true, color: st.color, fontFace: "Calibri", align: "center", valign: "middle" });
    s.addText(st.label, { x: 0.3 + i * 3.2, y: 1.78, w: 2.9, h: 0.38, fontSize: 12, color: C.iceBlue, fontFace: "Calibri", align: "center" });
  });

  // Test cases table
  const rows = [
    ["Declaração válida", "int x = 5 ;", "✓ OK", true],
    ["Estrutura if válida", "if (x > 0) { print(x); }", "✓ OK", false],
    ["Erro léxico", "int x = 5@ ;", "✗ Erro na linha 1", true],
    ["Erro sintático", "if x > 0 { }", "✗ Erro na linha 1", false],
    ["Ciclo while válido", "while (x < 10) { x = x+1; }", "✓ OK", true],
  ];

  const hdr = ["Teste", "Entrada", "Resultado"];
  const wds = [2.4, 4.3, 2.8];
  hdr.forEach((h, j) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.3 + wds.slice(0, j).reduce((a, b) => a + b, 0), y: 2.42, w: wds[j], h: 0.4,
      fill: { color: C.navy }, line: { color: C.navy }
    });
    s.addText(h, {
      x: 0.3 + wds.slice(0, j).reduce((a, b) => a + b, 0), y: 2.42, w: wds[j], h: 0.4,
      fontSize: 12, bold: true, color: C.white, fontFace: "Calibri", align: "center", valign: "middle", margin: 0
    });
  });

  rows.forEach((row, ri) => {
    row.slice(0, 3).forEach((cell, j) => {
      const isOk = cell.startsWith("✓");
      const isErr = cell.startsWith("✗");
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.3 + wds.slice(0, j).reduce((a, b) => a + b, 0), y: 2.83 + ri * 0.46, w: wds[j], h: 0.44,
        fill: { color: row[3] ? "F5F8FF" : C.white }, line: { color: "DDDDDD" }
      });
      s.addText(cell, {
        x: 0.3 + wds.slice(0, j).reduce((a, b) => a + b, 0), y: 2.83 + ri * 0.46, w: wds[j], h: 0.44,
        fontSize: 11.5, fontFace: j === 1 ? "Courier New" : "Calibri",
        color: isOk ? "006600" : isErr ? "AA0000" : C.navy,
        align: "center", valign: "middle", margin: 0
      });
    });
  });

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.3, w: 10, h: 0.3, fill: { color: C.navy }, line: { color: C.navy } });
  s.addText("Projecto 1 – TAC | 2025", { x: 0.3, y: 5.32, w: 9.4, h: 0.26, fontSize: 11, color: C.iceBlue, fontFace: "Calibri", align: "right" });
}

// ─── SLIDE 9: CONCLUSÃO ───────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  s.addText("07  |  Conclusão", {
    x: 0.4, y: 0.2, w: 9, h: 0.72, fontSize: 28, bold: true, color: C.white, fontFace: "Calibri"
  });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 0.88, w: 1.2, h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });

  const blocks = [
    { title: "O que alcançámos", items: ["Lexer funcional com 7 categorias de tokens", "Parser de descida recursiva completo", "Detecção de erros léxicos e sintáticos", "100% dos testes passaram com sucesso"], color: C.dark },
    { title: "Dificuldades", items: ["Definição inicial da gramática sem ambiguidades", "Precedência de operadores (resolvida com expr/termo/fator)", "Mensagens de erro precisas e informativas"], color: "0D2240" },
    { title: "Melhorias Futuras", items: ["Geração de AST (Projecto 2)", "Recuperação de erros após o 1º erro", "Suporte a funções e strings", "Análise semântica (tabela de símbolos)"], color: C.dark },
  ];

  blocks.forEach((b, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.2 + i * 3.27, y: 1.1, w: 3.0, h: 4.15,
      fill: { color: b.color }, rectRadius: 0.1, shadow: makeShadow()
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.2 + i * 3.27, y: 1.1, w: 3.0, h: 0.55,
      fill: { color: C.accent }, line: { color: C.accent }
    });
    s.addText(b.title, {
      x: 0.25 + i * 3.27, y: 1.12, w: 2.9, h: 0.5,
      fontSize: 13, bold: true, color: C.navy, fontFace: "Calibri", align: "center", valign: "middle"
    });
    b.items.forEach((item, j) => {
      s.addText("• " + item, {
        x: 0.3 + i * 3.27, y: 1.85 + j * 0.72, w: 2.8, h: 0.65,
        fontSize: 12.5, color: C.iceBlue, fontFace: "Calibri"
      });
    });
  });
}

// ─── SLIDE 10: OBRIGADO ───────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 1.5, y: 1.3, w: 7, h: 3.0,
    fill: { color: C.navy }, rectRadius: 0.18, shadow: makeShadow()
  });
  s.addText("Obrigado!", {
    x: 1.5, y: 1.5, w: 7, h: 1.1, fontSize: 48, bold: true, color: C.white, fontFace: "Calibri", align: "center"
  });
  s.addText("Projecto 1 – Análise Léxica e Sintática", {
    x: 1.5, y: 2.55, w: 7, h: 0.55, fontSize: 16, color: C.accent, fontFace: "Calibri", align: "center", italic: true
  });
  s.addText("Disponíveis para perguntas", {
    x: 1.5, y: 3.1, w: 7, h: 0.45, fontSize: 14, color: C.iceBlue, fontFace: "Calibri", align: "center"
  });

  s.addText("Prof. MSc. J.K. Kahumba  |  TAC 2025", {
    x: 0.3, y: 5.1, w: 9.4, h: 0.4, fontSize: 12, color: C.gray, fontFace: "Calibri", align: "center"
  });
}

pres.writeFile({ 
  fileName: "./Slides_Projecto1_TAC.pptx" 
})
.then(() => console.log("Slides criados com sucesso."));