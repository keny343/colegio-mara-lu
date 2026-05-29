/** Regras académicas — sistema angolano (3 trimestres: parcial + trimestral) */

const PERIODOS_VALIDOS = ['1PP', '1PT', '2PP', '2PT', '3PP', '3PT'];

const LABELS_PERIODOS = {
  '1PP': '1ª Parcial',
  '1PT': '1ª Trimestral',
  '2PP': '2ª Parcial',
  '2PT': '2ª Trimestral',
  '3PP': '3ª Parcial',
  '3PT': '3ª Trimestral',
};

/** 3 trimestres: parcial + trimestral em cada */
const TRIMESTRES = [
  { id: 1, titulo: '1º Trimestre', parcial: '1PP', trimestral: '1PT' },
  { id: 2, titulo: '2º Trimestre', parcial: '2PP', trimestral: '2PT' },
  { id: 3, titulo: '3º Trimestre', parcial: '3PP', trimestral: '3PT' },
];

const normalizarPeriodoKey = (periodo) => {
  const p = String(periodo || '').trim();
  if (p === '1º' || p === '1o') return '1PP';
  if (p === '2º' || p === '2o' || p === '3º' || p === '3o' || p === 'final') return '1PT';
  return p;
};



const normalizarTexto = (s) =>

  String(s || '')

    .normalize('NFD')

    .replace(/[\u0300-\u036f]/g, '')

    .toLowerCase()

    .trim();



const normalizarDisciplinaNome = (nome) => normalizarTexto(nome);



/** Utilizador tem ciclo ou curso de coordenação atribuído */

const temEscopoCoordenacao = (user) => {

  if (!user) return false;

  return !!(user.curso_coordenado || user.nivel_coordenado);

};



/** 1º ciclo: pré/jardim + 1ª–6ª | 2º ciclo: 7ª–9ª | Secundário: 10ª+ com curso */

const escopoDoCoordenador = (user) => {

  if (!user || user.role === 'admin') return { tipo: 'todos' };

  if (user.role !== 'coordenador' && user.role !== 'professor') return null;



  const curso = user.curso_coordenado || null;

  const nivel = user.nivel_coordenado || null;

  if (!curso && !nivel) return null;



  const n = normalizarTexto(nivel);

  if (curso) return { tipo: 'curso', cursoNome: curso };

  if (n.includes('1') && n.includes('ciclo')) return { tipo: 'ciclo1' };

  if (n.includes('2') && n.includes('ciclo')) return { tipo: 'ciclo2' };

  return { tipo: 'nivel', nivelRaw: nivel };

};



/** Pode aceder ao módulo de notas (professores: só nas disciplinas atribuídas, validado na API) */

const podeAcederNotas = (user) => {

  if (!user) return false;

  if (user.role === 'admin') return true;

  if (user.role === 'coordenador') return temEscopoCoordenacao(user);

  if (user.role === 'professor') return true;

  return false;

};



/** Coordenador (ou professor-coordenador) pode alterar notas no seu âmbito */

const podeAlterarNotasComoCoordenador = (user) => {

  if (!user) return false;

  if (user.role === 'admin') return true;

  if (user.role === 'coordenador' && temEscopoCoordenacao(user)) return true;

  if (user.role === 'professor' && temEscopoCoordenacao(user)) return true;

  return false;

};



/** @deprecated use podeAlterarNotasComoCoordenador ou podeAcederNotas */

const podeEditarNotas = podeAlterarNotasComoCoordenador;



/** Dashboard, inscrições, horários: só onde coordena (admin vê tudo) */

const podeAcederInformacaoGeral = (user) => {

  if (!user) return false;

  if (user.role === 'admin') return true;

  if (user.role === 'coordenador' && temEscopoCoordenacao(user)) return true;

  if (user.role === 'professor' && temEscopoCoordenacao(user)) return true;

  return false;

};



/** Admin ou coordenador com âmbito podem designar outro coordenador no mesmo ciclo/curso */

const podeDesignarCoordenador = (user) => {

  if (!user) return false;

  if (user.role === 'admin') return true;

  return podeAcederInformacaoGeral(user);

};



/** Tipo de designação permitido para quem não é admin */

const tipoDesignacaoNoAmbito = (user, tipo, cursoNomeDesignado) => {

  if (!user || user.role === 'admin') return true;

  if (tipo === 'remover') return false;

  const escopo = escopoDoCoordenador(user);

  if (!escopo) return false;

  if (tipo === '1_ciclo') return escopo.tipo === 'ciclo1';

  if (tipo === '2_ciclo') return escopo.tipo === 'ciclo2';

  if (tipo === 'curso') {

    if (escopo.tipo !== 'curso') return false;

    const alvo = normalizarTexto(cursoNomeDesignado);

    const meu = normalizarTexto(escopo.cursoNome);

    return alvo && meu && (alvo === meu || alvo.includes(meu) || meu.includes(alvo));

  }

  return false;

};



const coordenadorPodeGerirTurma = (user, turma) => {

  if (!user || !turma) return false;

  if (user.role === 'admin') return true;



  const escopo = escopoDoCoordenador(user);

  if (!escopo) return false;



  const serie = Number(turma.serie_classe);

  if (escopo.tipo === 'todos') return true;

  if (escopo.tipo === 'ciclo1') return serie >= 0 && serie <= 6;

  if (escopo.tipo === 'ciclo2') return serie >= 7 && serie <= 9;

  if (escopo.tipo === 'curso') {

    if (serie < 10) return false;

    const cursoTurma = normalizarTexto(turma.curso_nome);

    const cursoCoord = normalizarTexto(escopo.cursoNome);

    return cursoTurma && cursoCoord && (cursoTurma === cursoCoord || cursoTurma.includes(cursoCoord) || cursoCoord.includes(cursoTurma));

  }

  return false;

};



/** Turma visível para consulta de notas: coordena OU leciona (qualquer disciplina na turma) */

const turmaVisivelParaNotas = (user, turma, turmaIdsLecionadas) => {

  if (!user || !turma) return false;

  if (user.role === 'admin') return true;

  if (coordenadorPodeGerirTurma(user, turma)) return true;

  if (turmaIdsLecionadas && turmaIdsLecionadas.has(Number(turma.id))) return true;

  return false;

};



/** Classes 1–6 (e pré=0): 0–10 | 7–13: 0–20 */

const limitesNota = (serieClasse) => {

  const s = Number(serieClasse);

  if (s >= 1 && s <= 6) return { min: 0, max: 10 };

  if (s === 0) return { min: 0, max: 10 };

  return { min: 0, max: 20 };

};



const validarPeriodo = (periodo) => PERIODOS_VALIDOS.includes(periodo);



const validarNota = (nota, serieClasse) => {

  const v = parseFloat(nota);

  if (Number.isNaN(v)) return { ok: false, message: 'Nota inválida.' };

  const { min, max } = limitesNota(serieClasse);

  if (v < min || v > max) {

    return { ok: false, message: `Nota deve estar entre ${min} e ${max} (${serieClasse <= 6 ? '1ª–6ª classe' : '7ª–13ª classe'}).` };

  }

  return { ok: true, value: v };

};



const mediaTrimestre = (periodos, parcial, trimestral) => {
  const vals = [periodos[parcial], periodos[trimestral]]
    .filter((v) => v !== undefined && v !== null && v !== '')
    .map((v) => parseFloat(v))
    .filter((n) => !Number.isNaN(n));
  if (vals.length === 0) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
};

const mediaPeriodos = (periodos) => {
  const t1 = mediaTrimestre(periodos, '1PP', '1PT');
  const t2 = mediaTrimestre(periodos, '2PP', '2PT');
  const t3 = mediaTrimestre(periodos, '3PP', '3PT');
  const trimestres = [t1, t2, t3].map((v) => (v != null ? parseFloat(v) : null)).filter((n) => n !== null);
  if (trimestres.length === 0) return null;
  return (trimestres.reduce((a, b) => a + b, 0) / trimestres.length).toFixed(1);
};

/** Disciplina (faixa de classes) dentro do âmbito do coordenador */
const disciplinaNoAmbitoCoordenador = (user, disciplina, cursoNomeDisciplina) => {
  if (!user || user.role === 'admin') return true;
  if (!temEscopoCoordenacao(user)) return false;
  const smin = disciplina.serie_min != null ? Number(disciplina.serie_min) : 0;
  const smax = disciplina.serie_max != null ? Number(disciplina.serie_max) : 13;
  const cursoNome = cursoNomeDisciplina || null;
  for (let s = smin; s <= smax; s++) {
    if (coordenadorPodeGerirTurma(user, { serie_classe: s, curso_nome: cursoNome })) return true;
  }
  return false;
};



/** Valores padronizados para designação de coordenador */

const TIPOS_COORDENACAO = {

  CICLO_1: '1º ciclo',

  CICLO_2: '2º ciclo',

};

const filtroSqlSeriesCoordenador = (user) => {
  if (!user || user.role === 'admin') return { clause: '1=1', params: [] };
  if (user.role !== 'coordenador' && !(user.role === 'professor' && temEscopoCoordenacao(user))) {
    return { clause: '1=0', params: [] };
  }
  const curso = user.curso_coordenado || null;
  const nivel = user.nivel_coordenado || null;
  if (curso) return { clause: 's.curso = ?', params: [curso] };
  if (nivel) {
    const n = normalizarTexto(nivel);
    if (n.includes('1') && n.includes('ciclo')) {
      return { clause: "(s.nivel LIKE '%Primário%' OR s.ordem BETWEEN 0 AND 6)", params: [] };
    }
    if (n.includes('2') && n.includes('ciclo')) {
      return { clause: "(s.nivel LIKE '%I Ciclo%' OR (s.ordem BETWEEN 7 AND 9))", params: [] };
    }
  }
  return { clause: '1=0', params: [] };
};

const inscricaoNoAmbitoCoordenador = (user, insc) => {
  if (!user || user.role === 'admin') return true;
  if (user.curso_coordenado) return insc.curso === user.curso_coordenado;
  const n = normalizarTexto(user.nivel_coordenado || '');
  if (n.includes('1') && n.includes('ciclo')) {
    return (insc.nivel && String(insc.nivel).includes('Primário')) || (Number(insc.ordem) >= 0 && Number(insc.ordem) <= 6);
  }
  if (n.includes('2') && n.includes('ciclo')) {
    return (insc.nivel && String(insc.nivel).includes('I Ciclo')) || (Number(insc.ordem) >= 7 && Number(insc.ordem) <= 9);
  }
  return false;
};

module.exports = {

  PERIODOS_VALIDOS,
  LABELS_PERIODOS,
  TRIMESTRES,
  normalizarPeriodoKey,
  disciplinaNoAmbitoCoordenador,
  mediaTrimestre,

  normalizarDisciplinaNome,

  temEscopoCoordenacao,

  escopoDoCoordenador,

  podeAcederNotas,

  podeAlterarNotasComoCoordenador,

  podeEditarNotas,

  coordenadorPodeGerirTurma,

  turmaVisivelParaNotas,

  limitesNota,

  validarPeriodo,

  validarNota,

  mediaPeriodos,

  TIPOS_COORDENACAO,

  filtroSqlSeriesCoordenador,

  inscricaoNoAmbitoCoordenador,
  podeAcederInformacaoGeral,
  podeDesignarCoordenador,
  tipoDesignacaoNoAmbito,

};

