-- Auditoria de integridade das notas — Colégio Mara e Lu
-- Este ficheiro é APENAS DE LEITURA. Não altera nem elimina dados.
-- Executar no DBeaver com a base de dados correcta seleccionada.
-- A última consulta cruza matrículas activas com disciplinas atribuídas à turma.

-- 1) Distribuição por código de período: identifica dados legados/inesperados.
SELECT periodo, COUNT(*) AS total_notas,
       COUNT(DISTINCT matricula_id) AS matriculas,
       COUNT(DISTINCT disciplina_id) AS disciplinas
FROM notas
GROUP BY periodo
ORDER BY periodo;

-- 2) Códigos antigos/ambíguos. Não converter automaticamente:
-- '1º', '2º', '3º' e 'final' não indicam parcial/trimestral com segurança.
SELECT id, matricula_id, disciplina_id, periodo, nota, data_lancamento
FROM notas
WHERE periodo NOT IN ('1PP','1PT','2PP','2PT','3PP','3PT','EXN','DEF','CH2','REC')
ORDER BY periodo, matricula_id, disciplina_id;

-- 3) Duplicados para a mesma matrícula, disciplina e período.
SELECT matricula_id, disciplina_id, periodo, COUNT(*) AS quantidade,
       GROUP_CONCAT(id ORDER BY id) AS ids_notas
FROM notas
GROUP BY matricula_id, disciplina_id, periodo
HAVING COUNT(*) > 1
ORDER BY quantidade DESC, matricula_id, disciplina_id;

-- 4) Notas de disciplinas que não estão atribuídas à turma da matrícula.
SELECT n.id AS nota_id, n.matricula_id, m.turma_id, n.disciplina_id,
       d.nome AS disciplina, n.periodo, n.nota
FROM notas n
JOIN matriculas m ON m.id = n.matricula_id
JOIN disciplinas d ON d.id = n.disciplina_id
LEFT JOIN turma_professores tp
  ON tp.turma_id = m.turma_id AND tp.disciplina_id = n.disciplina_id
WHERE tp.id IS NULL
ORDER BY m.turma_id, n.matricula_id, n.disciplina_id, n.periodo;

-- 5) Resumo das notas em falta por matrícula/disciplina atribuída.
SELECT m.id AS matricula_id, m.aluno_id, m.turma_id, tp.disciplina_id,
       d.nome AS disciplina,
       MAX(CASE WHEN n.periodo = '1PP' THEN 1 ELSE 0 END) AS tem_1PP,
       MAX(CASE WHEN n.periodo = '1PT' THEN 1 ELSE 0 END) AS tem_1PT,
       MAX(CASE WHEN n.periodo = '2PP' THEN 1 ELSE 0 END) AS tem_2PP,
       MAX(CASE WHEN n.periodo = '2PT' THEN 1 ELSE 0 END) AS tem_2PT,
       MAX(CASE WHEN n.periodo = '3PP' THEN 1 ELSE 0 END) AS tem_3PP,
       MAX(CASE WHEN n.periodo = '3PT' THEN 1 ELSE 0 END) AS tem_3PT,
       COUNT(n.id) AS total_registos
FROM matriculas m
JOIN turma_professores tp ON tp.turma_id = m.turma_id
JOIN disciplinas d ON d.id = tp.disciplina_id
LEFT JOIN notas n
  ON n.matricula_id = m.id
 AND n.disciplina_id = tp.disciplina_id
 AND n.periodo IN ('1PP','1PT','2PP','2PT','3PP','3PT')
WHERE m.status = 'ativa'
GROUP BY m.id, m.aluno_id, m.turma_id, tp.disciplina_id, d.nome
HAVING tem_1PP = 0 OR tem_1PT = 0 OR tem_2PP = 0\n    OR tem_2PT = 0 OR tem_3PP = 0 OR tem_3PT = 0
ORDER BY m.turma_id, m.aluno_id, d.nome;

-- 6) Notas fora da escala da classe (pré/1ª-6ª: 0-10; 7ª-13ª: 0-20).
SELECT n.id AS nota_id, m.id AS matricula_id, t.serie_classe,
       n.disciplina_id, n.periodo, n.nota
FROM notas n
JOIN matriculas m ON m.id = n.matricula_id
JOIN turmas t ON t.id = m.turma_id
WHERE n.periodo IN ('1PP','1PT','2PP','2PT','3PP','3PT','EXN','DEF','CH2','REC')
  AND (
    (t.serie_classe BETWEEN 0 AND 6 AND (n.nota < 0 OR n.nota > 10))
    OR
    (t.serie_classe BETWEEN 7 AND 13 AND (n.nota < 0 OR n.nota > 20))
  )
ORDER BY t.serie_classe, m.id, n.disciplina_id, n.periodo;

-- 7) Contagem de matrículas activas e atribuições por turma.
SELECT t.id AS turma_id, t.nome, t.serie_classe, t.ano_letivo,
       COUNT(DISTINCT m.id) AS matriculas_ativas,
       COUNT(DISTINCT tp.disciplina_id) AS disciplinas_atribuidas
FROM turmas t
LEFT JOIN matriculas m ON m.turma_id = t.id AND m.status = 'ativa'
LEFT JOIN turma_professores tp ON tp.turma_id = t.id
WHERE t.ativo = 1
GROUP BY t.id, t.nome, t.serie_classe, t.ano_letivo
ORDER BY t.ano_letivo DESC, t.serie_classe, t.nome;
