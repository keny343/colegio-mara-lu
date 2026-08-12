const db = require('../config/database');

// Índices compostos para as queries mais usadas (login, listagens, notas, dashboard).
// InnoDB já indexa automaticamente colunas com FOREIGN KEY; aqui só os casos em falta.
const INDEXES = [
  // Listagem admin de inscrições: WHERE status = ? / ano_letivo = ?
  'CREATE INDEX idx_inscricoes_status_ano ON inscricoes (status, ano_letivo)',
  // Verificação de duplicados ao criar inscrição
  'CREATE INDEX idx_inscricoes_aluno_serie_ano ON inscricoes (aluno_id, serie_id, ano_letivo)',
  // Busca de matrícula ativa (aluno + ano letivo)
  'CREATE INDEX idx_matriculas_aluno_ano_status ON matriculas (aluno_id, ano_letivo, status)',
  // Contagem de matriculados por classe/ano no dashboard
  'CREATE INDEX idx_matriculas_ano_status ON matriculas (ano_letivo, status)',
  // Upsert de notas: WHERE matricula_id = ? AND disciplina_id = ? AND periodo = ?
  'CREATE INDEX idx_notas_matricula_disciplina_periodo ON notas (matricula_id, disciplina_id, periodo)',
  // Contagem de notificações não lidas: WHERE usuario_id = ? AND lida = 0
  'CREATE INDEX idx_notificacoes_usuario_lida ON notificacoes (usuario_id, lida)',
];

async function ensureIndexes() {
  for (const sql of INDEXES) {
    try {
      await db.query(sql);
    } catch (err) {
      // ER_DUP_KEYNAME = índice já existe (idempotente); ER_NO_SUCH_TABLE = tabela ausente nesse ambiente
      if (err.code !== 'ER_DUP_KEYNAME' && err.code !== 'ER_NO_SUCH_TABLE') {
        console.warn('[ensureIndexes]', err.message);
      }
    }
  }
}

module.exports = { ensureIndexes };
