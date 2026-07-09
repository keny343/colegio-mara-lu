const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageBreak, PageNumber, Footer, Header
} = require('docx');
const fs = require('fs');

const FONT = "Arial";
const border = { style: BorderStyle.SINGLE, size: 2, color: "BFBFBF" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerFill = "2E5C8A";

function img(path, widthPx, heightPx, maxW = 8400) {
  const ratio = heightPx / widthPx;
  const w = Math.min(maxW, widthPx * 1.0);
  const finalW = Math.min(maxW, 8400);
  const finalH = finalW * ratio;
  return new ImageRun({ data: fs.readFileSync(path), transformation: { width: finalW / 15, height: finalH / 15 }, type: "png" });
}

// Helper paragraph builders
function H1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function H2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function H3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}
function P(text, opts = {}) {
  return new Paragraph({ spacing: { after: 160, line: 276 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text, ...opts })] });
}
function Bullet(text) {
  return new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 100 }, children: [new TextRun(text)] });
}
function Numbered(text, ref = "numbers") {
  return new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 100 }, children: [new TextRun(text)] });
}
function Caption(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 280 }, children: [new TextRun({ text, italics: true, size: 20 })] });
}
function ImgPara(path, w, h, maxW) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 80 }, children: [img(path, w, h, maxW)] });
}

function headerCell(text, width) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA }, shading: { fill: headerFill, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER, margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 21 })] })]
  });
}
function bodyCell(text, width, opts = {}) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 70, bottom: 70, left: 120, right: 120 },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({ alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text, size: 21, bold: !!opts.bold })] })]
  });
}

// ---------- Requisitos Funcionais table ----------
const rfRows = [
  ["RF01", "O sistema deve ler ficheiros de código fonte em formato de texto (.txt ou .sscript)"],
  ["RF02", "O analisador léxico deve identificar as palavras-chave if, else, while, print, int, float e bool"],
  ["RF03", "O sistema deve reconhecer operadores aritméticos (+, -, *, /), relacionais (==, !=, <, >, <=, >=) e de atribuição (=)"],
  ["RF04", "O sistema deve identificar identificadores (nomes de variáveis) e literais numéricos e booleanos"],
  ["RF05", "O analisador sintático deve validar declarações de variáveis, atribuições, estruturas if/else e ciclos while"],
  ["RF06", "O sistema deve apresentar mensagens de erro com número de linha e descrição do problema"],
  ["RF07", "O sistema deve apresentar a lista completa de tokens gerados quando não existem erros"],
];
const rfTable = new Table({
  width: { size: 9360, type: WidthType.DXA }, columnWidths: [1300, 8060],
  rows: [
    new TableRow({ children: [headerCell("Código", 1300), headerCell("Descrição do Requisito", 8060)] }),
    ...rfRows.map((r, i) => new TableRow({ children: [bodyCell(r[0], 1300, { center: true, bold: true, fill: i % 2 ? "F4F7FA" : undefined }), bodyCell(r[1], 8060, { fill: i % 2 ? "F4F7FA" : undefined })] }))
  ]
});

// ---------- Requisitos Não Funcionais table (codificação + área de utilização) ----------
const rnfRows = [
  ["RNF01", "Desempenho", "Processamento / Execução", "O sistema deve processar ficheiros de até 500 linhas em menos de 1 segundo"],
  ["RNF02", "Usabilidade", "Interface com o Utilizador", "As mensagens de erro devem ser claras, objectivas e compreensíveis para o utilizador"],
  ["RNF03", "Portabilidade", "Ambiente de Execução", "O sistema deve funcionar em qualquer sistema operativo com Python 3.8 ou superior instalado"],
  ["RNF04", "Manutenibilidade", "Estrutura do Código", "O código deve ser modular, comentado e apresentar separação clara entre os módulos léxico e sintático"],
  ["RNF05", "Fiabilidade", "Tratamento de Erros", "O sistema não deve terminar de forma abrupta perante uma entrada inválida, devendo reportar o erro de forma controlada"],
];
const rnfTable = new Table({
  width: { size: 9360, type: WidthType.DXA }, columnWidths: [1150, 1850, 2360, 4000],
  rows: [
    new TableRow({ children: [headerCell("Código", 1150), headerCell("Categoria", 1850), headerCell("Área de Utilização", 2360), headerCell("Descrição", 4000)] }),
    ...rnfRows.map((r, i) => new TableRow({
      children: [
        bodyCell(r[0], 1150, { center: true, bold: true, fill: i % 2 ? "F4F7FA" : undefined }),
        bodyCell(r[1], 1850, { fill: i % 2 ? "F4F7FA" : undefined }),
        bodyCell(r[2], 2360, { fill: i % 2 ? "F4F7FA" : undefined }),
        bodyCell(r[3], 4000, { fill: i % 2 ? "F4F7FA" : undefined }),
      ]
    }))
  ]
});

// ---------- Grammar table ----------
const gramRows = [
  ["programa", "declaracao*"],
  ["declaracao", "atribuicao | if_stmt | while_stmt | print_stmt"],
  ["atribuicao", "tipo IDENT = expr ;"],
  ["if_stmt", "if ( expr ) { declaracao* } [ else { declaracao* } ]"],
  ["while_stmt", "while ( expr ) { declaracao* }"],
  ["print_stmt", "print ( expr ) ;"],
  ["expr", "termo ( ( + | - ) termo )*"],
  ["termo", "fator ( ( * | / ) fator )*"],
  ["fator", "NUMERO | IDENT | ( expr )"],
];
const gramTable = new Table({
  width: { size: 9360, type: WidthType.DXA }, columnWidths: [2340, 7020],
  rows: [
    new TableRow({ children: [headerCell("Regra", 2340), headerCell("Produção", 7020)] }),
    ...gramRows.map((r, i) => new TableRow({ children: [bodyCell(r[0], 2340, { bold: true, fill: i % 2 ? "F4F7FA" : undefined }), bodyCell(r[1], 7020, { fill: i % 2 ? "F4F7FA" : undefined })] }))
  ]
});

// ---------- Test cases table ----------
const testRows = [
  ["1", "Declaração válida", "int x = 5 ;", "Lista de tokens: INT, IDENT, ASSIGN, NUMBER, SEMI"],
  ["2", "Estrutura if válida", "if (x > 0) { print(x); }", "Análise: OK"],
  ["3", "Erro léxico", "int x = 5@ ;", "Erro: caracter '@' inválido na linha 1"],
  ["4", "Erro sintático", "if x > 0 { }", "Erro: esperado '(' após 'if' na linha 1"],
  ["5", "Ciclo while válido", "while (x < 10) { x = x + 1; }", "Análise: OK"],
];
const testTable = new Table({
  width: { size: 9360, type: WidthType.DXA }, columnWidths: [600, 1900, 2860, 4000],
  rows: [
    new TableRow({ children: [headerCell("Nº", 600), headerCell("Descrição", 1900), headerCell("Entrada", 2860), headerCell("Resultado Esperado", 4000)] }),
    ...testRows.map((r, i) => new TableRow({
      children: [
        bodyCell(r[0], 600, { center: true, bold: true, fill: i % 2 ? "F4F7FA" : undefined }),
        bodyCell(r[1], 1900, { fill: i % 2 ? "F4F7FA" : undefined }),
        bodyCell(r[2], 2860, { fill: i % 2 ? "F4F7FA" : undefined }),
        bodyCell(r[3], 4000, { fill: i % 2 ? "F4F7FA" : undefined }),
      ]
    }))
  ]
});

const refs = [
  "AHO, A. V.; LAM, M. S.; SETHI, R.; ULLMAN, J. D. Compilers: Principles, Techniques, and Tools. 2ª edição. Boston: Pearson, 2006",
  "WIRTH, N. Compiler Construction. Reading: Addison-Wesley, 1996",
  "PYTHON SOFTWARE FOUNDATION. Python 3.10 Documentation \u2013 re module. Disponível em https://docs.python.org/3/library/re.html. Acesso em maio de 2026",
  "GRUNE, D.; JACOBS, C. J. H. Parsing Techniques: A Practical Guide. 2ª edição. Nova Iorque: Springer, 2008",
  "KAHUMBA, J. K. Apontamentos da disciplina de Tópicos Avançados de Compiladores. Luanda: Universidade Metodista de Angola, 2025",
];

const children = [];

// COVER PAGE
children.push(
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: "UNIVERSIDADE METODISTA DE ANGOLA", bold: true, size: 26 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: "FACULDADE DE ENGENHARIA E ARQUITECTURA", bold: true, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1600 }, children: [new TextRun({ text: "CURSO DE ENGENHARIA INFORMÁTICA", bold: true, size: 24 })] }),
  new Paragraph({ spacing: { before: 1600, after: 1600 }, children: [new PageBreak()] }),
);

children.push(
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "UNIVERSIDADE METODISTA DE ANGOLA", bold: true, size: 26 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "FACULDADE DE ENGENHARIA E ARQUITECTURA", bold: true, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 900 }, children: [new TextRun({ text: "CURSO DE ENGENHARIA INFORMÁTICA", bold: true, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 900, after: 600 }, children: [new TextRun({ text: "ANÁLISE LÉXICA E SINTÁTICA", bold: true, size: 30 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Desenvolvimento de um Analisador para a Linguagem SimpleScript", italics: true, size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 100 }, children: [new TextRun({ text: "Nome: Adnircio do Rosário Quiteculo Inocêncio", size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "Nº: 52063", size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { before: 600, after: 600 }, indent: { left: 2400 }, children: [new TextRun({ text: "Trabalho apresentado à Universidade Metodista de Angola como requisito parcial para a obtenção da nota na disciplina de Linguagens de Programação.", italics: true, size: 21 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 100 }, children: [new TextRun({ text: "Orientador: Msc. Kahumba", size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1600 }, children: [new TextRun({ text: "Luanda, Maio de 2026", size: 22 })] }),
  new Paragraph({ children: [new PageBreak()] }),
);

// RESUMO
children.push(
  H1("Resumo"),
  P("Este trabalho apresenta o desenvolvimento de um sistema de análise léxica e sintática para uma linguagem de programação simples, definida pelo grupo e denominada SimpleScript. O sistema foi implementado em Python e é capaz de identificar os tokens do código fonte, validar a estrutura sintáctica e detectar erros léxicos e sintácticos, apresentando mensagens claras e informativas."),
  P("As tecnologias utilizadas incluem o Python 3.10 e o módulo de expressões regulares (re) para a fase léxica, complementados por um parser de descida recursiva implementado manualmente para a fase sintáctica. O resultado obtido consiste num analisador funcional, capaz de processar programas escritos em SimpleScript e de reportar erros de forma precisa e localizada."),
  new Paragraph({ children: [new PageBreak()] }),
);

// 1. INTRODUÇÃO
children.push(H1("1. Introdução"));
children.push(H2("1.1 Contextualização"));
children.push(P("Os compiladores constituem ferramentas fundamentais na computação, sendo responsáveis pela transformação de código fonte escrito em linguagens de alto nível em código executável. As duas primeiras fases de qualquer compilador são a análise léxica e a análise sintáctica, que, em conjunto, constituem o front-end do processo de compilação."));
children.push(P("A análise léxica, também designada por tokenização, decompõe o código fonte numa sequência de tokens — unidades mínimas dotadas de significado sintáctico, tais como palavras-chave, identificadores, operadores e literais. A análise sintáctica, por sua vez, verifica se essa sequência de tokens obedece à gramática da linguagem, construindo, de forma implícita ou explícita, uma estrutura hierárquica que representa o programa."));

children.push(H2("1.2 Justificativa"));
children.push(P("A implementação manual de um analisador léxico e sintáctico constitui uma etapa fundamental para a compreensão do funcionamento interno dos compiladores, na medida em que obriga à aplicação prática de conceitos que, de outra forma, permaneceriam apenas no plano teórico. Embora existam ferramentas de geração automática de analisadores, como o Lex/Flex e o Yacc/Bison, a construção manual destes componentes revela-se mais formativa, pois exige a compreensão integral de cada etapa do processo de análise, desde o reconhecimento de padrões léxicos até à validação da estrutura sintáctica."));
children.push(P("Este projecto justifica-se, assim, pela necessidade de consolidar, num contexto prático, os conceitos teóricos abordados na unidade curricular de Tópicos Avançados de Compiladores, nomeadamente os autómatos finitos, as expressões regulares como mecanismo de especificação de tokens e as gramáticas livres de contexto enquanto base formal para a análise sintáctica."));
children.push(P("Adicionalmente, o domínio destas técnicas reveste-se de relevância para a formação em Engenharia Informática, uma vez que os princípios subjacentes à análise léxica e sintáctica são transversais a diversas áreas da computação, nomeadamente o desenvolvimento de interpretadores, a validação de linguagens de configuração e a construção de ferramentas de análise estática de código."));

children.push(H2("1.3 Objectivos"));
children.push(H3("Objectivo Geral"));
children.push(P("Desenvolver um sistema funcional de análise léxica e sintáctica para uma linguagem simples, denominada SimpleScript."));
children.push(H3("Objectivos Específicos"));
[
  "Identificar e classificar todos os tokens do código fonte",
  "Definir as regras de gramática da linguagem SimpleScript",
  "Validar a estrutura sintáctica de programas escritos em SimpleScript",
  "Detectar e reportar erros léxicos e sintácticos com mensagens claras",
  "Implementar o sistema em Python com código bem estruturado e comentado",
].forEach(t => children.push(Bullet(t)));

// 2. LEVANTAMENTO DE REQUISITOS
children.push(H1("2. Levantamento de Requisitos"));
children.push(H2("2.1 Requisitos Funcionais"));
children.push(P("A tabela seguinte apresenta os requisitos funcionais identificados para o sistema, devidamente codificados para efeitos de rastreabilidade."));
children.push(rfTable);

children.push(H2("2.2 Requisitos Não Funcionais"));
children.push(P("Os requisitos não funcionais foram codificados e classificados de acordo com a respectiva área de utilização dentro do sistema, conforme apresentado na tabela seguinte."));
children.push(rnfTable);

// 3. ANÁLISE DO SISTEMA
children.push(H1("3. Análise do Sistema"));
children.push(H2("3.1 Descrição do Funcionamento"));
children.push(P("O sistema opera em duas fases sequenciais. Na primeira fase, o Analisador Léxico (Lexer) recebe o código fonte como texto e percorre o ficheiro caracter a caracter, agrupando sequências que correspondem a padrões definidos por expressões regulares. Cada padrão reconhecido dá origem a um token, identificado pelo respectivo tipo e valor."));
children.push(P("Na segunda fase, o Analisador Sintáctico (Parser) recebe a lista de tokens produzida pelo Lexer e verifica se a sequência está de acordo com a gramática definida para a linguagem SimpleScript. O parser utiliza a técnica de descida recursiva, segundo a qual cada regra da gramática é implementada como uma função."));

children.push(H2("3.2 Gramática da Linguagem SimpleScript"));
children.push(P("A gramática simplificada da linguagem encontra-se definida na tabela seguinte."));
children.push(gramTable);

children.push(H2("3.3 Identificação dos Utilizadores"));
children.push(Bullet("Estudantes (programadores) de informática que pretendem testar programas escritos em SimpleScript"));
children.push(Bullet("Professores que avaliam a correcta implementação das fases de compilação"));

children.push(H2("3.4 Diagrama de Casos de Uso"));
children.push(P("O diagrama seguinte representa as funcionalidades do sistema e a forma como os diferentes actores interagem com elas. Não existem relações de extensão (extend) entre os casos de uso, uma vez que todas as funcionalidades representadas constituem fluxos principais e independentes, accionados directamente pelos actores."));
children.push(ImgPara("diagrams/usecase.png", 2024, 1364));
children.push(Caption("Figura 1 \u2013 Diagrama de Casos de Uso do sistema"));

children.push(H2("3.5 Diagrama de Actividades"));
children.push(P("O diagrama de actividades seguinte ilustra o fluxo de processamento do sistema, desde a leitura do ficheiro de código fonte até à apresentação do resultado final ao utilizador."));
children.push(ImgPara("diagrams/activity.png", 2024, 1408));
children.push(Caption("Figura 2 \u2013 Diagrama de Actividades do processo de análise"));

// 4. PROJECTO (DESIGN) DO SISTEMA
children.push(H1("4. Projecto (Design) do Sistema"));
children.push(H2("4.1 Arquitectura do Sistema"));
children.push(P("O sistema segue uma arquitectura modular em pipeline, composta por três módulos principais:"));
children.push(Bullet("Módulo 1 \u2013 Lexer (lexer.py): responsável pela tokenização do código fonte"));
children.push(Bullet("Módulo 2 \u2013 Parser (parser.py): responsável pela análise sintáctica"));
children.push(Bullet("Módulo 3 \u2013 Main (main.py): ponto de entrada que orquestra os dois módulos"));
children.push(P("O fluxo de dados segue a sequência: Código Fonte \u2192 Lexer \u2192 Lista de Tokens \u2192 Parser \u2192 Resultado (válido ou com erros)."));

children.push(H2("4.2 Diagrama de Classes"));
children.push(P("O diagrama de classes seguinte representa a estrutura estática do sistema, evidenciando as principais classes, os respectivos atributos e métodos, bem como as relações de dependência entre elas."));
children.push(ImgPara("diagrams/class.png", 2090, 1100));
children.push(Caption("Figura 3 \u2013 Diagrama de Classes do sistema"));

children.push(H2("4.3 Diagrama de Sequência"));
children.push(P("O diagrama de sequência seguinte ilustra a interacção entre os módulos do sistema ao longo do processamento de um programa SimpleScript, desde a invocação inicial pelo utilizador até à apresentação do resultado final."));
children.push(ImgPara("diagrams/sequence.png", 1716, 1100));
children.push(Caption("Figura 4 \u2013 Diagrama de Sequência do processo de análise"));

children.push(H2("4.4 Estrutura de Tokens"));
children.push(P("Cada token é representado como um tuplo (tipo, valor, linha), em que tipo identifica a categoria do token (KEYWORD, IDENTIFIER, NUMBER, OPERATOR, entre outras), valor contém o texto original reconhecido e linha indica a posição correspondente no código fonte."));

// 5. TECNOLOGIAS
children.push(H1("5. Tecnologias Utilizadas"));
children.push(Bullet("Linguagem de programação: Python 3.10"));
children.push(Bullet("Módulo re (expressões regulares): reconhecimento de padrões léxicos"));
children.push(Bullet("Módulo sys: leitura de argumentos de linha de comando"));
children.push(Bullet("Editor de código: Visual Studio Code, com extensão para Python"));
children.push(Bullet("Sistema operativo de desenvolvimento: Windows 11"));

// 6. IMPLEMENTAÇÃO
children.push(H1("6. Implementação"));
children.push(H2("6.1 Analisador Léxico"));
children.push(P("O analisador léxico foi implementado no ficheiro lexer.py, recorrendo a uma lista ordenada de padrões de expressões regulares. Para cada posição no texto, o lexer procura um padrão correspondente, sendo o tipo do token determinado pelo primeiro padrão que corresponder."));
children.push(P("Os tokens reconhecidos incluem palavras-chave (if, else, while, print, int, float, bool), identificadores, números inteiros e decimais, operadores aritméticos e relacionais, parênteses e chavetas, ponto-e-vírgula, bem como espaços em branco, que são ignorados."));

children.push(H2("6.2 Analisador Sintáctico"));
children.push(P("O parser foi implementado segundo a técnica de descida recursiva, em que cada regra da gramática corresponde a uma função Python. O parser mantém um índice do token actual, que avança à medida que os tokens são consumidos. Sempre que um token esperado não é encontrado, é lançada uma excepção SyntaxError, contendo a mensagem e o número de linha correspondentes."));

children.push(H2("6.3 Tratamento de Erros"));
children.push(P("Os erros léxicos ocorrem quando um caracter não é reconhecido por nenhum dos padrões definidos. Os erros sintácticos, por sua vez, ocorrem quando a sequência de tokens não respeita a gramática estabelecida. Ambos os tipos de erro incluem a indicação da linha em que ocorrem, bem como uma descrição objectiva do problema encontrado."));

// 7. TESTES
children.push(H1("7. Testes"));
children.push(H2("7.1 Tipos de Testes"));
children.push(Bullet("Testes unitários: cada função do lexer e do parser foi testada individualmente"));
children.push(Bullet("Testes de integração: programas SimpleScript completos foram analisados de forma integral"));
children.push(Bullet("Testes de erro: programas com erros conhecidos foram utilizados para verificar as mensagens produzidas"));

children.push(H2("7.2 Casos de Teste"));
children.push(testTable);

children.push(H2("7.3 Resultados dos Testes"));
children.push(P("Os cinco casos de teste produziram os resultados esperados. Os erros léxicos e sintácticos foram correctamente detectados e reportados, com as mensagens e os números de linha correspondentes."));

// 8. RESULTADOS
children.push(H1("8. Resultados"));
children.push(P("O sistema desenvolvido atingiu a totalidade dos objectivos propostos. O analisador léxico é capaz de tokenizar correctamente programas escritos em SimpleScript, identificando oito categorias de tokens. O analisador sintáctico, por seu lado, valida a estrutura de programas com declarações de variáveis, estruturas condicionais e ciclos de repetição."));
children.push(P("O sistema detecta e reporta erros léxicos e sintácticos com informação precisa sobre a respectiva localização (número de linha) e descrição do problema, facilitando a correcção por parte do programador."));
children.push(P("Em comparação com os objectivos inicialmente definidos, o projecto cumpriu integralmente os requisitos funcionais e não funcionais estabelecidos na fase de levantamento de requisitos."));

// 9. MELHORIAS FUTURAS (moved before conclusão)
children.push(H1("9. Melhorias Futuras"));
children.push(P("Não obstante os resultados alcançados, foram identificadas oportunidades de evolução do sistema, a explorar em trabalhos futuros:"));
[
  "Adicionar suporte a funções definidas pelo utilizador",
  "Implementar recuperação de erros, de forma a permitir a continuação da análise após a detecção do primeiro erro",
  "Gerar uma Árvore Sintáctica Abstracta (AST), como preparação para uma futura fase de análise semântica",
  "Adicionar suporte a strings e a arrays",
].forEach(t => children.push(Bullet(t)));

// 10. CONCLUSÃO (subtitles merged into flowing prose)
children.push(H1("10. Conclusão"));
children.push(P("O desenvolvimento deste projecto permitiu ao grupo aplicar, na prática, os conceitos teóricos de análise léxica e sintáctica abordados na disciplina de Tópicos Avançados de Compiladores. A implementação de um lexer baseado em expressões regulares e de um parser de descida recursiva consolidou o entendimento sobre as primeiras fases do processo de compilação, demonstrando que é possível construir analisadores funcionais com uma quantidade relativamente reduzida de código Python, desde que a gramática da linguagem seja cuidadosamente definida."));
children.push(P("Ao longo do desenvolvimento, foram encontradas algumas dificuldades que contribuíram igualmente para a aprendizagem do grupo. A definição inicial da gramática exigiu uma revisão das regras, de modo a eliminar ambiguidades; o tratamento da precedência de operadores foi resolvido através da separação em regras expr, termo e fator; e a gestão de erros, nomeadamente a implementação de mensagens claras e a continuação da análise após a ocorrência de um erro, revelou-se um dos aspectos mais desafiantes do projecto."));
children.push(P("Em síntese, o projecto cumpriu os objectivos a que se propôs, tendo resultado num sistema funcional, tecnicamente sólido e alinhado com os fundamentos teóricos da disciplina, constituindo simultaneamente uma base sólida para os desenvolvimentos futuros identificados anteriormente."));

// 11. REFERÊNCIAS
children.push(H1("11. Referências"));
refs.forEach(t => children.push(Numbered(t, "refs")));

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: FONT, color: "1B2733" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: FONT, color: "2E5C8A" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, italics: true, font: FONT, color: "2E5C8A" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "refs", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888" })]
        })]
      })
    },
    children
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("Relatorio_Projecto1_TAC_revisto.docx", buffer);
  console.log("done");
});