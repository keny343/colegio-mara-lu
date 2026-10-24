-- Corrige o nível das classes do II Ciclo que ficaram gravadas como 1.º Ciclo.
-- Faça uma cópia de segurança da tabela "series" antes de executar em produção.
START TRANSACTION;

UPDATE series
SET nivel = 'II Ciclo (Ensino Secundário 10ª–13ª)'
WHERE (
  ordem BETWEEN 10 AND 13
  OR nome REGEXP '^(10|11|12|13)[[:space:]]*[ªº]'
)
AND (
  nivel IS NULL
  OR nivel <> 'II Ciclo (Ensino Secundário 10ª–13ª)'
);

-- Confirme os níveis corrigidos antes de terminar a transação.
SELECT id, nome, nivel, ordem
FROM series
WHERE ordem BETWEEN 10 AND 13
   OR nome REGEXP '^(10|11|12|13)[[:space:]]*[ªº]'
ORDER BY ordem, nome;

COMMIT;
