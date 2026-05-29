-- Script para corrigir a tabela usuarios
-- Remove curso_id (INT) e adiciona curso_coordenado (VARCHAR)

USE colegio_mara_lu;

-- Remover a coluna curso_id se existir
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = 'colegio_mara_lu' 
                   AND TABLE_NAME = 'usuarios' 
                   AND COLUMN_NAME = 'curso_id');

SET @sql = IF(@col_exists > 0, 
              'ALTER TABLE usuarios DROP COLUMN curso_id',
              'SELECT ''Column curso_id does not exist, skipping''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar a coluna curso_coordenado se não existir
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = 'colegio_mara_lu' 
                   AND TABLE_NAME = 'usuarios' 
                   AND COLUMN_NAME = 'curso_coordenado');

SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE usuarios ADD COLUMN curso_coordenado VARCHAR(150) DEFAULT NULL COMMENT ''para coordenadores: nome do curso que coordena (NULL = todos os cursos)''',
              'SELECT ''Column curso_coordenado already exists, skipping''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
