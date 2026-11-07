const db = require('../config/database');
const {
  podeAcederNotas,
  coordenadorPodeGerirTurma,
  turmaVisivelParaNotas,
  PERIODOS_VALIDOS,
  LABELS_PERIODOS,
  limitesNota,
  normalizarPeriodoKey,
  mediaPeriodos,
} = require('../utils/academicoRules');
const { ensureNotasPeriodosSchema } = require('../utils/ensureNotasSchema');

// Mínimo de aprovação por disciplina: 1ª–6ª classe = 5 (escala 0–10); 7ª–13ª = 10 (escala 0–20)
const notaMinima = (serieClasse) => {
  const s = Number(serieClasse);
  return s >= 1 && s <= 6 ? 5 : 10;
};

const media = (valores) => {
  const nums = valores.filter((v) => v != null).map(Number).filter((n) => !Number.isNaN(n));
  if (!nums.length) return null;
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
};

/**
 * GET /staff|professor/turmas/:turma_id/relatorio-notas
 * Devolve, para cada aluno ativo da turma, as notas de cada disciplina por período,
 * a média anual da disciplina e a média geral do aluno.
 *
 * Acesso (igual ao da pauta):
 *  - admin e coordenadores com âmbito sobre a turma → todas as disciplinas
 *  - professor → só as disciplinas que leciona nessa turma
 */
const relatorioNotasTurma = async (req, res) => {
  try {
    await ensureNotasPeriodosSchema();
    if (!podeAcederNotas(req.user)) {
      return res.status(403).json({ message: 'Sem permissão para consultar notas.' });
    }

    const turmaId = req.params.turma_id;
    const [[turma]] = await db.query(
      `SELECT t.*, c.nome AS curso_nome
         FROM turmas t LEFT JOIN cursos c ON t.curso_id = c.id
        WHERE t.id = ?`,
      [turmaId]
    );
    if (!turma) return res.status(404).json({ message: 'Turma não encontrada.' });

    const [lecionadasRows] = await db.query(
      'SELECT DISTINCT turma_id FROM turma_professores WHERE professor_id = ?',
      [req.user.id]
    );
    const lecionadas = new Set(lecionadasRows.map((r) => Number(r.turma_id)));
    if (!turmaVisivelParaNotas(req.user, turma, lecionadas)) {
      return res.status(403).json({ message: 'Não tem acesso a esta turma.' });
    }

    const veTodasDisciplinas = req.user.role === 'admin' || coordenadorPodeGerirTurma(req.user, turma);
    const paramsDisc = [turmaId];
    let filtroProfessor = '';
    if (!veTodasDisciplinas) {
      filtroProfessor = 'AND tp.professor_id = ?';
      paramsDisc.push(req.user.id);
    }

    const [disciplinas] = await db.query(
      `SELECT DISTINCT d.id, d.nome
         FROM turma_professores tp
         JOIN disciplinas d ON tp.disciplina_id = d.id
        WHERE tp.turma_id = ? ${filtroProfessor}
        ORDER BY d.nome`,
      paramsDisc
    );

    const [alunos] = await db.query(
      `SELECT m.id AS matricula_id, a.id AS aluno_id, a.nome AS aluno_nome
         FROM matriculas m
         JOIN alunos a ON m.aluno_id = a.id
        WHERE m.turma_id = ? AND m.status = 'ativa'
        ORDER BY a.nome`,
      [turmaId]
    );

    const cabecalho = {
      id: turma.id,
      nome: turma.nome,
      serie_classe: turma.serie_classe,
      curso_nome: turma.curso_nome || null,
      ano_letivo: turma.ano_letivo,
      turno: turma.turno || null,
    };
    const limites = limitesNota(turma.serie_classe);
    const minimo = notaMinima(turma.serie_classe);
    const periodos = PERIODOS_VALIDOS.map((key) => ({ key, label: LABELS_PERIODOS[key] || key }));

    if (!disciplinas.length || !alunos.length) {
      return res.json({
        turma: cabecalho, limites, nota_minima: minimo, periodos,
        disciplinas, alunos: [], gerado_em: new Date().toISOString(),
      });
    }

    const [notas] = await db.query(
      `SELECT matricula_id, disciplina_id, periodo, nota
         FROM notas
        WHERE matricula_id IN (?) AND disciplina_id IN (?)`,
      [alunos.map((a) => a.matricula_id), disciplinas.map((d) => d.id)]
    );

    // `${matricula_id}-${disciplina_id}` -> { '1PP': 12, ... }
    const porAlunoDisc = new Map();
    for (const r of notas) {
      const key = normalizarPeriodoKey(r.periodo);
      if (!PERIODOS_VALIDOS.includes(key)) continue; // ignora REC/EXN/DEF/CH2 neste relatório
      const k = `${r.matricula_id}-${r.disciplina_id}`;
      if (!porAlunoDisc.has(k)) porAlunoDisc.set(k, {});
      porAlunoDisc.get(k)[key] = r.nota == null ? null : Number(r.nota);
    }

    const lista = alunos.map((a) => {
      const discAluno = disciplinas.map((d) => {
        const p = porAlunoDisc.get(`${a.matricula_id}-${d.id}`) || {};
        const mediaAnual = mediaPeriodos(p);
        return {
          disciplina_id: d.id,
          periodos: p,
          media: mediaAnual,
          positiva: mediaAnual == null ? null : parseFloat(mediaAnual) >= minimo,
        };
      });
      return {
        matricula_id: a.matricula_id,
        aluno_id: a.aluno_id,
        aluno_nome: a.aluno_nome,
        disciplinas: discAluno,
        media_geral: media(discAluno.map((d) => d.media)),
        negativas: discAluno.filter((d) => d.positiva === false).length,
      };
    });

    return res.json({
      turma: cabecalho,
      limites,
      nota_minima: minimo,
      periodos,
      disciplinas,
      alunos: lista,
      gerado_em: new Date().toISOString(),
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ message: 'Tabelas académicas em falta. Execute: node backend/scripts/migrate-academico.js' });
    }
    console.error('[relatorioNotasTurma]', err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

module.exports = { relatorioNotasTurma };