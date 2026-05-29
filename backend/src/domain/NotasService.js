/**
 * Serviço de notas — combina OOP com funções puras (academicoRules).
 * Cadastro de notas, cálculo de médias, separação por disciplinas.
 */
const {
  mediaPeriodos,
  mediaTrimestre,
  limitesNota,
  PERIODOS_VALIDOS,
  LABELS_PERIODOS,
  TRIMESTRES,
  normalizarPeriodoKey,
} = require('../utils/academicoRules');

class NotasService {
  /**
   * Agrupa linhas SQL por disciplina e calcula média por período (funcional).
   * @param {Array<{disciplina: string, periodo: string, nota: number}>} linhas
   * @returns {Array<{disciplina: string, periodos: object, media: string|null}>}
   */
  static agruparPorDisciplina(linhas) {
    const map = {};
    for (const r of linhas) {
      if (!map[r.disciplina]) {
        map[r.disciplina] = { disciplina: r.disciplina, periodos: {} };
      }
      if (r.periodo) {
        const key = normalizarPeriodoKey(r.periodo);
        map[r.disciplina].periodos[key] = r.nota;
      }
    }
    return Object.values(map).map((d) => ({
      ...d,
      medias_trimestre: TRIMESTRES.map((t) => ({
        trimestre: t.id,
        titulo: t.titulo,
        media: mediaTrimestre(d.periodos, t.parcial, t.trimestral),
      })),
      media: mediaPeriodos(d.periodos),
    }));
  }

  /**
   * Média global do aluno (todas as disciplinas com nota).
   */
  static mediaGlobal(notasPorDisciplina) {
    const medias = notasPorDisciplina
      .map((d) => d.media)
      .filter((m) => m !== null && m !== undefined)
      .map(parseFloat)
      .filter((n) => !Number.isNaN(n));
    if (medias.length === 0) return null;
    return (medias.reduce((a, b) => a + b, 0) / medias.length).toFixed(1);
  }

  static respostaPortal(linhas, serieClasse) {
    const notas = NotasService.agruparPorDisciplina(linhas);
    const media_geral = NotasService.mediaGlobal(notas);
    return {
      notas,
      media_geral,
      serie_classe: serieClasse,
      limites: limitesNota(serieClasse),
      periodos: PERIODOS_VALIDOS,
      labels_periodos: LABELS_PERIODOS,
      trimestres: TRIMESTRES,
    };
  }
}

module.exports = NotasService;
