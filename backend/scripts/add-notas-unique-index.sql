-- Executar APENAS depois de confirmar que a consulta de duplicados em
-- audit-notas-periodos.sql não devolve nenhuma linha.
-- Este índice impede duas notas para a mesma matrícula/disciplina/período.
-- Não executar antes de rever e resolver manualmente eventuais duplicados.
ALTER TABLE notas
  ADD UNIQUE KEY uq_notas_matricula_disciplina_periodo
  (matricula_id, disciplina_id, periodo);
