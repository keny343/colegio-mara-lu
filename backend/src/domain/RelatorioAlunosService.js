const NotasService = require('./NotasService');
const { PERIODOS_VALIDOS, normalizarPeriodoKey } = require('../utils/academicoRules');

function agruparRelatorioAlunos(linhas = []) {
  const alunos = new Map();

  for (const linha of linhas) {
    const matriculaKey = String(linha.matricula_id);
    let aluno = alunos.get(matriculaKey);

    if (!aluno) {
      aluno = {
        matricula_id: linha.matricula_id,
        aluno_id: linha.aluno_id,
        aluno_nome: linha.aluno_nome,
        turma_id: linha.turma_id,
        turma_nome: linha.turma_nome,
        serie_classe: linha.serie_classe,
        curso_nome: linha.curso_nome,
        ano_letivo: linha.ano_letivo,
        matricula_status: linha.matricula_status,
        data_matricula: linha.data_matricula,
        disciplinas: new Map(),
      };
      alunos.set(matriculaKey, aluno);
    }

    if (linha.disciplina_id == null) continue;

    const disciplinaKey = String(linha.disciplina_id);
    let disciplina = aluno.disciplinas.get(disciplinaKey);

    if (!disciplina) {
      disciplina = {
        disciplina_id: linha.disciplina_id,
        disciplina_nome: linha.disciplina_nome,
        periodos: {},
      };
      aluno.disciplinas.set(disciplinaKey, disciplina);
    }

    if (linha.periodo == null || linha.nota == null) continue;

    const periodo = normalizarPeriodoKey(linha.periodo);
    const nota = Number(linha.nota);
    if (PERIODOS_VALIDOS.includes(periodo) && Number.isFinite(nota)) {
      disciplina.periodos[periodo] = nota;
    }
  }

  return Array.from(alunos.values())
    .map((aluno) => {
      const disciplinas = Array.from(aluno.disciplinas.values())
        .map((disciplina) => {
          const linhasNotas = Object.entries(disciplina.periodos).map(([periodo, nota]) => ({
            disciplina: String(disciplina.disciplina_id),
            periodo,
            nota,
          }));
          const [calculo] = NotasService.agruparPorDisciplina(linhasNotas);
          const periodos = Object.fromEntries(
            PERIODOS_VALIDOS.map((periodo) => [periodo, disciplina.periodos[periodo] ?? null])
          );

          return {
            ...disciplina,
            periodos,
            media: calculo?.media ?? null,
            total_notas_lancadas: Object.values(periodos).filter((nota) => nota != null).length,
          };
        })
        .sort((a, b) => a.disciplina_nome.localeCompare(b.disciplina_nome, 'pt', { numeric: true }));

      return {
        matricula_id: aluno.matricula_id,
        aluno_id: aluno.aluno_id,
        aluno_nome: aluno.aluno_nome,
        turma_id: aluno.turma_id,
        turma_nome: aluno.turma_nome,
        serie_classe: aluno.serie_classe,
        curso_nome: aluno.curso_nome,
        ano_letivo: aluno.ano_letivo,
        matricula_status: aluno.matricula_status,
        data_matricula: aluno.data_matricula,
        disciplinas,
        total_disciplinas: disciplinas.length,
        total_disciplinas_com_notas: disciplinas.filter((disciplina) => disciplina.media != null).length,
        total_notas_lancadas: disciplinas.reduce(
          (total, disciplina) => total + disciplina.total_notas_lancadas,
          0
        ),
        media_geral: NotasService.mediaGlobal(disciplinas),
      };
    })
    .sort((a, b) => a.aluno_nome.localeCompare(b.aluno_nome, 'pt', { numeric: true }));
}

module.exports = { agruparRelatorioAlunos };
