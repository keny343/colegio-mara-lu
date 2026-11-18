[1mdiff --git a/backend/src/lab/pipeline.js b/backend/src/lab/pipeline.js[m
[1mindex ad71ab67..da18b552 100644[m
[1m--- a/backend/src/lab/pipeline.js[m
[1m+++ b/backend/src/lab/pipeline.js[m
[36m@@ -1,3 +1,4 @@[m
[32m+[m
 'use strict';[m
 [m
 const fs = require('fs');[m
[36m@@ -12,10 +13,11 @@[m [mconst DEST_FILES = {[m
   csv: 'transacoes.csv',[m
   avro: 'transacoes.avro',[m
   parquet: 'transacoes.parquet',[m
[31m-  sql: 'sql', // MySQL table lab_transacoes[m
[32m+[m[32m  sql: 'sql',[m
 };[m
 [m
 const MAX_RECORDS = 25000;[m
[32m+[m
 const CSV_HEADER = [[m
   'id', 'cliente_id', 'produto_id', 'data_transacao', 'categoria', 'quantidade',[m
   'preco_unitario', 'valor_total', 'estado', 'descricao', 'localizacao', 'metadados',[m
[36m@@ -31,21 +33,58 @@[m [mfunction ensureDir(dir) {[m
   fs.mkdirSync(dir, { recursive: true });[m
 }[m
 [m
[31m-function csvEscape(v) {[m
[31m-  const s = String(v ?? '');[m
[31m-  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;[m
[32m+[m[32m/**[m
[32m+[m[32m * Aceita apenas identificadores válidos de execução.[m
[32m+[m[32m * O mesmo identificador é usado no directório e na base de dados.[m
[32m+[m[32m */[m
[32m+[m[32mfunction normalizeRunId(value) {[m
[32m+[m[32m  const runId = String(value || '');[m
[32m+[m
[32m+[m[32m  if (!/^(run|bench)_\d+$/.test(runId)) {[m
[32m+[m[32m    throw Object.assign([m
[32m+[m[32m      new Error('Identificador de execução inválido.'),[m
[32m+[m[32m      { status: 400 },[m
[32m+[m[32m    );[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  return runId;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mfunction csvEscape(value) {[m
[32m+[m[32m  const s = String(value ?? '');[m
[32m+[m
[32m+[m[32m  if (/[",\n\r]/.test(s)) {[m
[32m+[m[32m    return `"${s.replace(/"/g, '""')}"`;[m
[32m+[m[32m  }[m
[32m+[m
   return s;[m
 }[m
 [m
[31m-function rowCsv(r) {[m
[32m+[m[32mfunction rowCsv(row) {[m
   return [[m
[31m-    r.id, r.cliente_id, r.produto_id, r.data_transacao, r.categoria, r.quantidade,[m
[31m-    r.preco_unitario, r.valor_total, r.estado, r.descricao,[m
[31m-    JSON.stringify(r.localizacao),[m
[31m-    r.metadados == null ? '' : JSON.stringify(r.metadados),[m
[32m+[m[32m    row.id,[m
[32m+[m[32m    row.cliente_id,[m
[32m+[m[32m    row.produto_id,[m
[32m+[m[32m    row.data_transacao,[m
[32m+[m[32m    row.categoria,[m
[32m+[m[32m    row.quantidade,[m
[32m+[m[32m    row.preco_unitario,[m
[32m+[m[32m    row.valor_total,[m
[32m+[m[32m    row.estado,[m
[32m+[m[32m    row.descricao,[m
[32m+[m[32m    JSON.stringify(row.localizacao),[m
[32m+[m[32m    row.metadados == null ? '' : JSON.stringify(row.metadados),[m
   ].map(csvEscape).join(',');[m
 }[m
 [m
[32m+[m[32m/**[m
[32m+[m[32m * Cria a tabela e garante que a migração da chave primária[m
[32m+[m[32m * fica concluída, mesmo que uma execução anterior tenha sido[m
[32m+[m[32m * interrompida depois de adicionar execucao_id.[m
[32m+[m[32m *[m
[32m+[m[32m * Os registos antigos recebem execucao_id = 'legacy'.[m
[32m+[m[32m * Nenhum registo é apagado durante esta migração.[m
[32m+[m[32m */[m
 async function ensureLabTable() {[m
   await db.query(`[m
     CREATE TABLE IF NOT EXISTS lab_transacoes ([m
[36m@@ -67,149 +106,373 @@[m [masync function ensureLabTable() {[m
       INDEX idx_lab_execucao (execucao_id)[m
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4[m
   `);[m
[31m-  const [cols] = await db.query([m
[31m-    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_transacoes'",[m
[32m+[m
[32m+[m[32m  const [columns] = await db.query(`[m
[32m+[m[32m    SELECT COLUMN_NAME[m
[32m+[m[32m    FROM information_schema.COLUMNS[m
[32m+[m[32m    WHERE TABLE_SCHEMA = DATABASE()[m
[32m+[m[32m      AND TABLE_NAME = 'lab_transacoes'[m
[32m+[m[32m  `);[m
[32m+[m
[32m+[m[32m  const hasExecutionColumn = columns.some([m
[32m+[m[32m    (column) => column.COLUMN_NAME === 'execucao_id',[m
   );[m
[31m-  if (!cols.some((c) => c.COLUMN_NAME === 'execucao_id')) {[m
[31m-    await db.query("ALTER TABLE lab_transacoes ADD COLUMN execucao_id VARCHAR(64) NOT NULL DEFAULT 'legacy' FIRST");[m
[32m+[m
[32m+[m[32m  if (!hasExecutionColumn) {[m
[32m+[m[32m    await db.query(`[m
[32m+[m[32m      ALTER TABLE lab_transacoes[m
[32m+[m[32m      ADD COLUMN execucao_id VARCHAR(64) NOT NULL DEFAULT 'legacy' FIRST[m
[32m+[m[32m    `);[m
   }[m
 [m
[31m-  // Concluir a migração mesmo se uma execução anterior tiver sido interrompida[m
[31m-  // depois de adicionar a coluna, mas antes de alterar a chave primária.[m
[31m-  const [primaryKey] = await db.query([m
[31m-    "SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_transacoes' AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX",[m
[32m+[m[32m  // Consultar sempre a chave primária actual.[m
[32m+[m[32m  // Não assumir que a migração terminou apenas porque a coluna existe.[m
[32m+[m[32m  const [primaryKeyRows] = await db.query(`[m
[32m+[m[32m    SELECT COLUMN_NAME[m
[32m+[m[32m    FROM information_schema.STATISTICS[m
[32m+[m[32m    WHERE TABLE_SCHEMA = DATABASE()[m
[32m+[m[32m      AND TABLE_NAME = 'lab_transacoes'[m
[32m+[m[32m      AND INDEX_NAME = 'PRIMARY'[m
[32m+[m[32m    ORDER BY SEQ_IN_INDEX[m
[32m+[m[32m  `);[m
[32m+[m
[32m+[m[32m  const primaryKeyColumns = primaryKeyRows.map([m
[32m+[m[32m    (row) => row.COLUMN_NAME,[m
   );[m
[31m-  const pkColumns = primaryKey.map((row) => row.COLUMN_NAME);[m
[31m-  if (pkColumns.length !== 2 || pkColumns[0] !== 'execucao_id' || pkColumns[1] !== 'id') {[m
[31m-    const [indexes] = await db.query([m
[31m-      "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_transacoes' AND INDEX_NAME = 'idx_lab_execucao' LIMIT 1",[m
[31m-    );[m
[31m-    await db.query('ALTER TABLE lab_transacoes DROP PRIMARY KEY, ADD PRIMARY KEY (execucao_id, id)');[m
[31m-    if (!indexes.length) await db.query('ALTER TABLE lab_transacoes ADD INDEX idx_lab_execucao (execucao_id)');[m
[32m+[m
[32m+[m[32m  const correctPrimaryKey = ([m
[32m+[m[32m    primaryKeyColumns.length === 2[m
[32m+[m[32m    && primaryKeyColumns[0] === 'execucao_id'[m
[32m+[m[32m    && primaryKeyColumns[1] === 'id'[m
[32m+[m[32m  );[m
[32m+[m
[32m+[m[32m  if (!correctPrimaryKey) {[m
[32m+[m[32m    if (primaryKeyColumns.length > 0) {[m
[32m+[m[32m      await db.query(`[m
[32m+[m[32m        ALTER TABLE lab_transacoes[m
[32m+[m[32m        DROP PRIMARY KEY,[m
[32m+[m[32m        ADD PRIMARY KEY (execucao_id, id)[m
[32m+[m[32m      `);[m
[32m+[m[32m    } else {[m
[32m+[m[32m      await db.query(`[m
[32m+[m[32m        ALTER TABLE lab_transacoes[m
[32m+[m[32m        ADD PRIMARY KEY (execucao_id, id)[m
[32m+[m[32m      `);[m
[32m+[m[32m    }[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  // Garantir o índice de execução sem duplicar o índice existente.[m
[32m+[m[32m  const [executionIndexes] = await db.query(`[m
[32m+[m[32m    SELECT INDEX_NAME[m
[32m+[m[32m    FROM information_schema.STATISTICS[m
[32m+[m[32m    WHERE TABLE_SCHEMA = DATABASE()[m
[32m+[m[32m      AND TABLE_NAME = 'lab_transacoes'[m
[32m+[m[32m      AND INDEX_NAME = 'idx_lab_execucao'[m
[32m+[m[32m    LIMIT 1[m
[32m+[m[32m  `);[m
[32m+[m
[32m+[m[32m  if (executionIndexes.length === 0) {[m
[32m+[m[32m    await db.query(`[m
[32m+[m[32m      ALTER TABLE lab_transacoes[m
[32m+[m[32m      ADD INDEX idx_lab_execucao (execucao_id)[m
[32m+[m[32m    `);[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  // Garantir também o índice de categoria.[m
[32m+[m[32m  const [categoryIndexes] = await db.query(`[m
[32m+[m[32m    SELECT INDEX_NAME[m
[32m+[m[32m    FROM information_schema.STATISTICS[m
[32m+[m[32m    WHERE TABLE_SCHEMA = DATABASE()[m
[32m+[m[32m      AND TABLE_NAME = 'lab_transacoes'[m
[32m+[m[32m      AND INDEX_NAME = 'idx_lab_categoria'[m
[32m+[m[32m    LIMIT 1[m
[32m+[m[32m  `);[m
[32m+[m
[32m+[m[32m  if (categoryIndexes.length === 0) {[m
[32m+[m[32m    await db.query(`[m
[32m+[m[32m      ALTER TABLE lab_transacoes[m
[32m+[m[32m      ADD INDEX idx_lab_categoria (categoria)[m
[32m+[m[32m    `);[m
   }[m
 }[m
 [m
 function sqlString(value) {[m
   if (value == null) return 'NULL';[m
[31m-  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";[m
[32m+[m
[32m+[m[32m  return `'${String(value)[m
[32m+[m[32m    .replace(/\\/g, '\\\\')[m
[32m+[m[32m    .replace(/'/g, "''")}'`;[m
 }[m
 [m
[31m-function sqlInsertRow(r, runId) {[m
[32m+[m[32mfunction sqlInsertRow(row, runId) {[m
   return '(' + [[m
[31m-    sqlString(runId), Number(r.id), Number(r.cliente_id), Number(r.produto_id),[m
[31m-    sqlString(r.data_transacao), sqlString(r.categoria), Number(r.quantidade),[m
[31m-    sqlString(r.preco_unitario), sqlString(r.valor_total), sqlString(r.estado),[m
[31m-    sqlString(r.descricao), sqlString(JSON.stringify(r.localizacao)),[m
[31m-    r.metadados == null ? 'NULL' : sqlString(JSON.stringify(r.metadados)),[m
[32m+[m[32m    sqlString(runId),[m
[32m+[m[32m    Number(row.id),[m
[32m+[m[32m    Number(row.cliente_id),[m
[32m+[m[32m    Number(row.produto_id),[m
[32m+[m[32m    sqlString(row.data_transacao),[m
[32m+[m[32m    sqlString(row.categoria),[m
[32m+[m[32m    Number(row.quantidade),[m
[32m+[m[32m    sqlString(row.preco_unitario),[m
[32m+[m[32m    sqlString(row.valor_total),[m
[32m+[m[32m    sqlString(row.estado),[m
[32m+[m[32m    sqlString(row.descricao),[m
[32m+[m[32m    sqlString(JSON.stringify(row.localizacao)),[m
[32m+[m[32m    row.metadados == null[m
[32m+[m[32m      ? 'NULL'[m
[32m+[m[32m      : sqlString(JSON.stringify(row.metadados)),[m
   ].join(',') + ')';[m
 }[m
 [m
 async function writeSql(batches, runId, outDir) {[m
[32m+[m[32m  runId = normalizeRunId(runId);[m
[32m+[m
   await ensureLabTable();[m
[31m-  await db.query('DELETE FROM lab_transacoes WHERE execucao_id = ?', [runId]);[m
[32m+[m
[32m+[m[32m  // Apagar apenas os dados pertencentes a esta execução.[m
[32m+[m[32m  await db.query([m
[32m+[m[32m    'DELETE FROM lab_transacoes WHERE execucao_id = ?',[m
[32m+[m[32m    [runId],[m
[32m+[m[32m  );[m
[32m+[m
   let count = 0;[m
[31m-  const t0 = process.hrtime.bigint();[m
[32m+[m[32m  const startTime = process.hrtime.bigint();[m
[32m+[m
   const createPath = path.join(outDir, 'criar_dados.sql');[m
   const deletePath = path.join(outDir, 'apagar_dados.sql');[m
[32m+[m
   const header = `-- Dados da execução ${runId}; gerado automaticamente pelo Laboratório de Dados.[m
 CREATE TABLE IF NOT EXISTS lab_transacoes ([m
[31m-  execucao_id VARCHAR(64) NOT NULL, id BIGINT NOT NULL, cliente_id BIGINT NOT NULL,[m
[31m-  produto_id BIGINT NOT NULL, data_transacao VARCHAR(32) NOT NULL, categoria VARCHAR(64) NOT NULL,[m
[31m-  quantidade INT NOT NULL, preco_unitario VARCHAR(32) NOT NULL, valor_total VARCHAR(32) NOT NULL,[m
[31m-  estado CHAR(2) NOT NULL, descricao TEXT NOT NULL, localizacao JSON NOT NULL, metadados JSON NULL,[m
[31m-  PRIMARY KEY (execucao_id, id), INDEX idx_lab_categoria (categoria), INDEX idx_lab_execucao (execucao_id)[m
[32m+[m[32m  execucao_id VARCHAR(64) NOT NULL,[m
[32m+[m[32m  id BIGINT NOT NULL,[m
[32m+[m[32m  cliente_id BIGINT NOT NULL,[m
[32m+[m[32m  produto_id BIGINT NOT NULL,[m
[32m+[m[32m  data_transacao VARCHAR(32) NOT NULL,[m
[32m+[m[32m  categoria VARCHAR(64) NOT NULL,[m
[32m+[m[32m  quantidade INT NOT NULL,[m
[32m+[m[32m  preco_unitario VARCHAR(32) NOT NULL,[m
[32m+[m[32m  valor_total VARCHAR(32) NOT NULL,[m
[32m+[m[32m  estado CHAR(2) NOT NULL,[m
[32m+[m[32m  descricao TEXT NOT NULL,[m
[32m+[m[32m  localizacao JSON NOT NULL,[m
[32m+[m[32m  metadados JSON NULL,[m
[32m+[m[32m  PRIMARY KEY (execucao_id, id),[m
[32m+[m[32m  INDEX idx_lab_categoria (categoria),[m
[32m+[m[32m  INDEX idx_lab_execucao (execucao_id)[m
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;[m
[32m+[m
 START TRANSACTION;[m
 `;[m
[32m+[m
   fs.writeFileSync(createPath, header, 'utf8');[m
[31m-  fs.writeFileSync(deletePath, `-- Remove exclusivamente os dados da execução ${runId}.[m
[31m-DELETE FROM lab_transacoes WHERE execucao_id = '${runId}';[m
[31m-`, 'utf8');[m
[32m+[m
[32m+[m[32m  fs.writeFileSync([m
[32m+[m[32m    deletePath,[m
[32m+[m[32m    `-- Remove exclusivamente os dados da execução ${runId}.[m
[32m+[m[32mDELETE FROM lab_transacoes[m
[32m+[m[32mWHERE execucao_id = '${runId}';[m
[32m+[m[32m`,[m
[32m+[m[32m    'utf8',[m
[32m+[m[32m  );[m
[32m+[m
   for (const batch of batches) {[m
     if (!batch.length) continue;[m
[31m-    const placeholders = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');[m
[32m+[m
[32m+[m[32m    const placeholders = batch[m
[32m+[m[32m      .map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?)')[m
[32m+[m[32m      .join(',');[m
[32m+[m
     const values = [];[m
[31m-    for (const r of batch) {[m
[31m-      values.push(runId, r.id, r.cliente_id, r.produto_id, r.data_transacao, r.categoria,[m
[31m-        r.quantidade, r.preco_unitario, r.valor_total, r.estado, r.descricao,[m
[31m-        JSON.stringify(r.localizacao), r.metadados == null ? null : JSON.stringify(r.metadados));[m
[32m+[m
[32m+[m[32m    for (const row of batch) {[m
[32m+[m[32m      values.push([m
[32m+[m[32m        runId,[m
[32m+[m[32m        row.id,[m
[32m+[m[32m        row.cliente_id,[m
[32m+[m[32m        row.produto_id,[m
[32m+[m[32m        row.data_transacao,[m
[32m+[m[32m        row.categoria,[m
[32m+[m[32m        row.quantidade,[m
[32m+[m[32m        row.preco_unitario,[m
[32m+[m[32m        row.valor_total,[m
[32m+[m[32m        row.estado,[m
[32m+[m[32m        row.descricao,[m
[32m+[m[32m        JSON.stringify(row.localizacao),[m
[32m+[m[32m        row.metadados == null[m
[32m+[m[32m          ? null[m
[32m+[m[32m          : JSON.stringify(row.metadados),[m
[32m+[m[32m      );[m
     }[m
[31m-    await db.query(`INSERT INTO lab_transacoes ([m
[31m-      execucao_id, id, cliente_id, produto_id, data_transacao, categoria, quantidade,[m
[31m-      preco_unitario, valor_total, estado, descricao, localizacao, metadados[m
[31m-    ) VALUES ${placeholders}`, values);[m
[31m-    fs.appendFileSync(createPath, `INSERT INTO lab_transacoes ([m
[31m-      execucao_id, id, cliente_id, produto_id, data_transacao, categoria, quantidade,[m
[31m-      preco_unitario, valor_total, estado, descricao, localizacao, metadados[m
[31m-    ) VALUES\n${batch.map((r) => sqlInsertRow(r, runId)).join(',\n')};\n`, 'utf8');[m
[32m+[m
[32m+[m[32m    await db.query([m
[32m+[m[32m      `INSERT INTO lab_transacoes ([m
[32m+[m[32m        execucao_id,[m
[32m+[m[32m        id,[m
[32m+[m[32m        cliente_id,[m
[32m+[m[32m        produto_id,[m
[32m+[m[32m        data_transacao,[m
[32m+[m[32m        categoria,[m
[32m+[m[32m        quantidade,[m
[32m+[m[32m        preco_unitario,[m
[32m+[m[32m        valor_total,[m
[32m+[m[32m        estado,[m
[32m+[m[32m        descricao,[m
[32m+[m[32m        localizacao,[m
[32m+[m[32m        metadados[m
[32m+[m[32m      ) VALUES ${placeholders}`,[m
[32m+[m[32m      values,[m
[32m+[m[32m    );[m
[32m+[m
[32m+[m[32m    fs.appendFileSync([m
[32m+[m[32m      createPath,[m
[32m+[m[32m      `INSERT INTO lab_transacoes ([m
[32m+[m[32m        execucao_id,[m
[32m+[m[32m        id,[m
[32m+[m[32m        cliente_id,[m
[32m+[m[32m        produto_id,[m
[32m+[m[32m        data_transacao,[m
[32m+[m[32m        categoria,[m
[32m+[m[32m        quantidade,[m
[32m+[m[32m        preco_unitario,[m
[32m+[m[32m        valor_total,[m
[32m+[m[32m        estado,[m
[32m+[m[32m        descricao,[m
[32m+[m[32m        localizacao,[m
[32m+[m[32m        metadados[m
[32m+[m[32m      ) VALUES\n${batch.map((row) => sqlInsertRow(row, runId)).join(',\n')};\n`,[m
[32m+[m[32m      'utf8',[m
[32m+[m[32m    );[m
[32m+[m
     count += batch.length;[m
   }[m
[32m+[m
   fs.appendFileSync(createPath, 'COMMIT;\n', 'utf8');[m
[31m-  const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;[m
[31m-  const [[{ bytes }]] = await db.query([m
[31m-    `SELECT ROUND((DATA_LENGTH + INDEX_LENGTH)) AS bytes FROM information_schema.TABLES[m
[31m-     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_transacoes'`,[m
[31m-  );[m
[31m-  return { path: 'mysql:lab_transacoes', create_file: 'criar_dados.sql',[m
[31m-    delete_file: 'apagar_dados.sql', records: count, bytes: Number(bytes) || 0,[m
[31m-    write_seconds: elapsed };[m
[32m+[m
[32m+[m[32m  const elapsed = Number([m
[32m+[m[32m    process.hrtime.bigint() - startTime,[m
[32m+[m[32m  ) / 1e9;[m
[32m+[m
[32m+[m[32m  const [[tableInfo]] = await db.query(`[m
[32m+[m[32m    SELECT ROUND(DATA_LENGTH + INDEX_LENGTH) AS bytes[m
[32m+[m[32m    FROM information_schema.TABLES[m
[32m+[m[32m    WHERE TABLE_SCHEMA = DATABASE()[m
[32m+[m[32m      AND TABLE_NAME = 'lab_transacoes'[m
[32m+[m[32m  `);[m
[32m+[m
[32m+[m[32m  return {[m
[32m+[m[32m    path: 'mysql:lab_transacoes',[m
[32m+[m[32m    create_file: 'criar_dados.sql',[m
[32m+[m[32m    delete_file: 'apagar_dados.sql',[m
[32m+[m[32m    records: count,[m
[32m+[m[32m    bytes: Number(tableInfo?.bytes) || 0,[m
[32m+[m[32m    write_seconds: elapsed,[m
[32m+[m[32m  };[m
 }[m
 [m
 function writeJsonl(batches, filePath) {[m
   const fd = fs.openSync(filePath, 'w');[m
   let count = 0;[m
[31m-  const t0 = process.hrtime.bigint();[m
[32m+[m[32m  const startTime = process.hrtime.bigint();[m
[32m+[m
   try {[m
     for (const batch of batches) {[m
[31m-      for (const r of batch) {[m
[31m-        fs.writeSync(fd, `${JSON.stringify(r)}\n`);[m
[32m+[m[32m      for (const row of batch) {[m
[32m+[m[32m        fs.writeSync(fd, `${JSON.stringify(row)}\n`);[m
         count += 1;[m
       }[m
     }[m
   } finally {[m
     fs.closeSync(fd);[m
   }[m
[31m-  const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;[m
[31m-  return { path: filePath, records: count, bytes: fs.statSync(filePath).size, write_seconds: elapsed };[m
[32m+[m
[32m+[m[32m  const elapsed = Number([m
[32m+[m[32m    process.hrtime.bigint() - startTime,[m
[32m+[m[32m  ) / 1e9;[m
[32m+[m
[32m+[m[32m  return {[m
[32m+[m[32m    path: filePath,[m
[32m+[m[32m    records: count,[m
[32m+[m[32m    bytes: fs.statSync(filePath).size,[m
[32m+[m[32m    write_seconds: elapsed,[m
[32m+[m[32m  };[m
 }[m
 [m
 function writeCsv(batches, filePath) {[m
   const fd = fs.openSync(filePath, 'w');[m
   let count = 0;[m
[31m-  const t0 = process.hrtime.bigint();[m
[32m+[m[32m  const startTime = process.hrtime.bigint();[m
[32m+[m
   try {[m
     fs.writeSync(fd, `\uFEFF${CSV_HEADER}\n`);[m
[32m+[m
     for (const batch of batches) {[m
[31m-      for (const r of batch) {[m
[31m-        fs.writeSync(fd, `${rowCsv(r)}\n`);[m
[32m+[m[32m      for (const row of batch) {[m
[32m+[m[32m        fs.writeSync(fd, `${rowCsv(row)}\n`);[m
         count += 1;[m
       }[m
     }[m
   } finally {[m
     fs.closeSync(fd);[m
   }[m
[31m-  const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;[m
[31m-  return { path: filePath, records: count, bytes: fs.statSync(filePath).size, write_seconds: elapsed };[m
[32m+[m
[32m+[m[32m  const elapsed = Number([m
[32m+[m[32m    process.hrtime.bigint() - startTime,[m
[32m+[m[32m  ) / 1e9;[m
[32m+[m
[32m+[m[32m  return {[m
[32m+[m[32m    path: filePath,[m
[32m+[m[32m    records: count,[m
[32m+[m[32m    bytes: fs.statSync(filePath).size,[m
[32m+[m[32m    write_seconds: elapsed,[m
[32m+[m[32m  };[m
 }[m
 [m
 function writeAvro(batches, filePath) {[m
   const records = [];[m
[31m-  for (const batch of batches) records.push(...batch);[m
[31m-  const t0 = process.hrtime.bigint();[m
[31m-  const buf = writeAvroBuffer(records);[m
[31m-  fs.writeFileSync(filePath, buf);[m
[31m-  const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;[m
[31m-  return { path: filePath, records: records.length, bytes: buf.length, write_seconds: elapsed };[m
[32m+[m
[32m+[m[32m  for (const batch of batches) {[m
[32m+[m[32m    records.push(...batch);[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  const startTime = process.hrtime.bigint();[m
[32m+[m[32m  const buffer = writeAvroBuffer(records);[m
[32m+[m
[32m+[m[32m  fs.writeFileSync(filePath, buffer);[m
[32m+[m
[32m+[m[32m  const elapsed = Number([m
[32m+[m[32m    process.hrtime.bigint() - startTime,[m
[32m+[m[32m  ) / 1e9;[m
[32m+[m
[32m+[m[32m  return {[m
[32m+[m[32m    path: filePath,[m
[32m+[m[32m    records: records.length,[m
[32m+[m[32m    bytes: buffer.length,[m
[32m+[m[32m    write_seconds: elapsed,[m
[32m+[m[32m  };[m
 }[m
 [m
 function writeParquet(batches, filePath) {[m
   const records = [];[m
[31m-  for (const batch of batches) records.push(...batch);[m
[31m-  const t0 = process.hrtime.bigint();[m
[31m-  const buf = writeParquetBuffer(records);[m
[31m-  fs.writeFileSync(filePath, buf);[m
[31m-  const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;[m
[31m-  return { path: filePath, records: records.length, bytes: buf.length, write_seconds: elapsed };[m
[32m+[m
[32m+[m[32m  for (const batch of batches) {[m
[32m+[m[32m    records.push(...batch);[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  const startTime = process.hrtime.bigint();[m
[32m+[m[32m  const buffer = writeParquetBuffer(records);[m
[32m+[m
[32m+[m[32m  fs.writeFileSync(filePath, buffer);[m
[32m+[m
[32m+[m[32m  const elapsed = Number([m
[32m+[m[32m    process.hrtime.bigint() - startTime,[m
[32m+[m[32m  ) / 1e9;[m
[32m+[m
[32m+[m[32m  return {[m
[32m+[m[32m    path: filePath,[m
[32m+[m[32m    records: records.length,[m
[32m+[m[32m    bytes: buffer.length,[m
[32m+[m[32m    write_seconds: elapsed,[m
[32m+[m[32m  };[m
 }[m
 [m
 const WRITERS = {[m
[36m@@ -223,65 +486,115 @@[m [mconst WRITERS = {[m
 function parseDestinations(raw) {[m
   const list = String(raw || 'jsonl,csv,avro,parquet,sql')[m
     .split(',')[m
[31m-    .map((s) => s.trim().toLowerCase())[m
[32m+[m[32m    .map((item) => item.trim().toLowerCase())[m
     .filter(Boolean);[m
[31m-  const unknown = list.filter((d) => !WRITERS[d]);[m
[31m-  if (unknown.length) throw new Error(`Destinos desconhecidos: ${unknown.join(',')}`);[m
[31m-  if (!list.length) throw new Error('Informe ao menos um destino');[m
[31m-  return list;[m
[32m+[m
[32m+[m[32m  const unknown = list.filter((destination) => !WRITERS[destination]);[m
[32m+[m
[32m+[m[32m  if (unknown.length) {[m
[32m+[m[32m    throw new Error(`Destinos desconhecidos: ${unknown.join(',')}`);[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  if (!list.length) {[m
[32m+[m[32m    throw new Error('Informe ao menos um destino');[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  return [...new Set(list)];[m
 }[m
 [m
[31m-function clampRecords(n) {[m
[31m-  const v = Number(n) || 0;[m
[31m-  if (v < 1) throw new Error('records deve ser >= 1');[m
[31m-  if (v > MAX_RECORDS) {[m
[31m-    throw new Error(`No painel admin o máximo é ${MAX_RECORDS} registos (use o CLI Python para S/M).`);[m
[32m+[m[32mfunction clampRecords(value) {[m
[32m+[m[32m  const records = Number(value) || 0;[m
[32m+[m
[32m+[m[32m  if (records < 1) {[m
[32m+[m[32m    throw new Error('records deve ser >= 1');[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  if (records > MAX_RECORDS) {[m
[32m+[m[32m    throw new Error([m
[32m+[m[32m      `No painel admin o máximo é ${MAX_RECORDS} registos (use o CLI Python para S/M).`,[m
[32m+[m[32m    );[m
   }[m
[31m-  return v;[m
[32m+[m
[32m+[m[32m  return records;[m
 }[m
 [m
[31m-async function runGenerate({ records, seed = 42, batchSize = 2000, destinations, outName }) {[m
[31m-  if (running) throw Object.assign(new Error('Já existe uma tarefa do laboratório em execução.'), { status: 409 });[m
[32m+[m[32masync function runGenerate({[m
[32m+[m[32m  records,[m
[32m+[m[32m  seed = 42,[m
[32m+[m[32m  batchSize = 2000,[m
[32m+[m[32m  destinations,[m
[32m+[m[32m  outName,[m
[32m+[m[32m}) {[m
[32m+[m[32m  if (running) {[m
[32m+[m[32m    throw Object.assign([m
[32m+[m[32m      new Error('Já existe uma tarefa do laboratório em execução.'),[m
[32m+[m[32m      { status: 409 },[m
[32m+[m[32m    );[m
[32m+[m[32m  }[m
[32m+[m
   running = true;[m
[32m+[m
   try {[m
     const n = clampRecords(records);[m
     const dests = parseDestinations(destinations);[m
[31m-    const runName = outName || `run_${Date.now()}`;[m
[31m-    if (!/^(run|bench)_\d+$/.test(String(runName))) {[m
[31m-      throw Object.assign(new Error('Identificador de execução inválido.'), { status: 400 });[m
[31m-    }[m
[31m-    const runDirName = path.basename(runName);[m
[31m-    const outDir = path.join(labRoot(), runDirName);[m
[32m+[m[32m    const runId = normalizeRunId(outName || `run_${Date.now()}`);[m
[32m+[m[32m    const outDir = path.join(labRoot(), runId);[m
[32m+[m
     ensureDir(outDir);[m
[31m-    const runId = runDirName;[m
 [m
     const writes = {};[m
[31m-    const t0 = process.hrtime.bigint();[m
[31m-    for (const dest of dests) {[m
[32m+[m[32m    const startTime = process.hrtime.bigint();[m
[32m+[m
[32m+[m[32m    for (const destination of dests) {[m
       const batches = generateBatches(n, seed, batchSize);[m
[31m-      if (dest === 'sql') {[m
[31m-        writes[dest] = await writeSql(batches, runId, outDir);[m
[32m+[m
[32m+[m[32m      if (destination === 'sql') {[m
[32m+[m[32m        writes[destination] = await writeSql([m
[32m+[m[32m          batches,[m
[32m+[m[32m          runId,[m
[32m+[m[32m          outDir,[m
[32m+[m[32m        );[m
       } else {[m
[31m-        const filePath = path.join(outDir, DEST_FILES[dest]);[m
[31m-        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);[m
[31m-        writes[dest] = WRITERS[dest](batches, filePath);[m
[31m-        writes[dest].path = path.basename(filePath);[m
[32m+[m[32m        const filePath = path.join([m
[32m+[m[32m          outDir,[m
[32m+[m[32m          DEST_FILES[destination],[m
[32m+[m[32m        );[m
[32m+[m
[32m+[m[32m        if (fs.existsSync(filePath)) {[m
[32m+[m[32m          fs.unlinkSync(filePath);[m
[32m+[m[32m        }[m
[32m+[m
[32m+[m[32m        writes[destination] = WRITERS[destination]([m
[32m+[m[32m          batches,[m
[32m+[m[32m          filePath,[m
[32m+[m[32m        );[m
[32m+[m
[32m+[m[32m        writes[destination].path = path.basename(filePath);[m
       }[m
     }[m
[32m+[m
     const result = {[m
[31m-      out_dir: path.basename(outDir),[m
[32m+[m[32m      out_dir: runId,[m
       out_path: outDir,[m
       records: n,[m
       seed,[m
       batch_size: batchSize,[m
       destinations: dests,[m
       writes,[m
[31m-      elapsed_seconds: Number(process.hrtime.bigint() - t0) / 1e9,[m
[32m+[m[32m      elapsed_seconds: Number([m
[32m+[m[32m        process.hrtime.bigint() - startTime,[m
[32m+[m[32m      ) / 1e9,[m
       created_at: new Date().toISOString(),[m
       engine: 'node-admin',[m
     };[m
[31m-    fs.writeFileSync(path.join(outDir, 'run_meta.json'), JSON.stringify(result, null, 2));[m
[32m+[m
[32m+[m[32m    fs.writeFileSync([m
[32m+[m[32m      path.join(outDir, 'run_meta.json'),[m
[32m+[m[32m      JSON.stringify(result, null, 2),[m
[32m+[m[32m    );[m
[32m+[m
     saveLatest(result);[m
[32m+[m
     return result;[m
   } finally {[m
     running = false;[m
[36m@@ -289,44 +602,55 @@[m [masync function runGenerate({ records, seed = 42, batchSize = 2000, destinations,[m
 }[m
 [m
 function fingerprintFromFile(filePath, sampleSize = 100) {[m
[31m-  const text = fs.readFileSync(filePath, 'utf8');[m
[31m-  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);[m
[32m+[m[32m  const content = fs.readFileSync(filePath, 'utf8');[m
[32m+[m[32m  const lines = content[m
[32m+[m[32m    .replace(/^\uFEFF/, '')[m
[32m+[m[32m    .split(/\r?\n/)[m
[32m+[m[32m    .filter(Boolean);[m
[32m+[m
   const isCsv = filePath.endsWith('.csv');[m
   const start = isCsv ? 1 : 0;[m
[32m+[m
   let count = 0;[m
   let sum = 0;[m
   const samples = [];[m
[31m-  for (let i = start; i < lines.length; i++) {[m
[31m-    let rec;[m
[32m+[m
[32m+[m[32m  for (let i = start; i < lines.length; i += 1) {[m
     if (isCsv) {[m
[31m-      // parse minimal: id is first field[m
[31m-      const id = Number(lines[i].split(',')[0]);[m
[31m-      const m = lines[i].match(/,"?(\d+\.\d{2})"?,"?[A-Z]{2}"?/);[m
[31m-      // valor_total is 8th column — use JSON from jsonl preferred[m
       continue;[m
     }[m
[31m-    rec = JSON.parse(lines[i]);[m
[32m+[m
[32m+[m[32m    const record = JSON.parse(lines[i]);[m
[32m+[m
     count += 1;[m
[31m-    sum += Number(rec.valor_total) || 0;[m
[32m+[m[32m    sum += Number(record.valor_total) || 0;[m
[32m+[m
     if (samples.length < sampleSize) {[m
[31m-      const digest = crypto.createHash('sha256')[m
[32m+[m[32m      const digest = crypto[m
[32m+[m[32m        .createHash('sha256')[m
         .update(JSON.stringify({[m
[31m-          id: rec.id,[m
[31m-          cliente_id: rec.cliente_id,[m
[31m-          produto_id: rec.produto_id,[m
[31m-          valor_total: String(rec.valor_total),[m
[31m-          categoria: rec.categoria,[m
[32m+[m[32m          id: record.id,[m
[32m+[m[32m          cliente_id: record.cliente_id,[m
[32m+[m[32m          produto_id: record.produto_id,[m
[32m+[m[32m          valor_total: String(record.valor_total),[m
[32m+[m[32m          categoria: record.categoria,[m
         }))[m
         .digest('hex')[m
         .slice(0, 16);[m
[31m-      samples.push(`${rec.id}:${digest}`);[m
[32m+[m
[32m+[m[32m      samples.push(`${record.id}:${digest}`);[m
     }[m
   }[m
[32m+[m
   if (isCsv) {[m
[31m-    // re-read via regenerating fingerprint from jsonl sibling if present[m
     return null;[m
   }[m
[31m-  const aggregate = crypto.createHash('sha256').update(samples.sort().join('|')).digest('hex');[m
[32m+[m
[32m+[m[32m  const aggregate = crypto[m
[32m+[m[32m    .createHash('sha256')[m
[32m+[m[32m    .update(samples.sort().join('|'))[m
[32m+[m[32m    .digest('hex');[m
[32m+[m
   return {[m
     count,[m
     sum_valor_total: sum.toFixed(2),[m
[36m@@ -335,51 +659,142 @@[m [mfunction fingerprintFromFile(filePath, sampleSize = 100) {[m
   };[m
 }[m
 [m
[32m+[m[32m/**[m
[32m+[m[32m * Valida uma execução guardada.[m
[32m+[m[32m *[m
[32m+[m[32m * A migração da tabela é executada antes de qualquer consulta[m
[32m+[m[32m * que dependa da coluna execucao_id. Isto também cobre execuções[m
[32m+[m[32m * antigas, antes de qualquer nova geração SQL.[m
[32m+[m[32m */[m
 async function validateRun(outName, sampleSize = 100) {[m
[31m-  const outDir = path.join(labRoot(), outName);[m
[31m-  if (!fs.existsSync(outDir)) throw Object.assign(new Error('Execução não encontrada.'), { status: 404 });[m
[31m-  const meta = JSON.parse(fs.readFileSync(path.join(outDir, 'run_meta.json'), 'utf8'));[m
[32m+[m[32m  const runId = normalizeRunId(outName);[m
[32m+[m[32m  const outDir = path.join(labRoot(), runId);[m
[32m+[m
[32m+[m[32m  if (!fs.existsSync(outDir) || !fs.statSync(outDir).isDirectory()) {[m
[32m+[m[32m    throw Object.assign([m
[32m+[m[32m      new Error('Execução não encontrada.'),[m
[32m+[m[32m      { status: 404 },[m
[32m+[m[32m    );[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  const metaPath = path.join(outDir, 'run_meta.json');[m
[32m+[m
[32m+[m[32m  if (!fs.existsSync(metaPath)) {[m
[32m+[m[32m    throw Object.assign([m
[32m+[m[32m      new Error('Metadados da execução não encontrados.'),[m
[32m+[m[32m      { status: 404 },[m
[32m+[m[32m    );[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  const meta = JSON.parse([m
[32m+[m[32m    fs.readFileSync(metaPath, 'utf8'),[m
[32m+[m[32m  );[m
[32m+[m
   const dests = meta.destinations || [];[m
   const fps = {};[m
 [m
[32m+[m[32m  // Importante: migrar antes da consulta SQL.[m
[32m+[m[32m  // Não depender de uma geração SQL anterior.[m
[32m+[m[32m  if (dests.includes('sql')) {[m
[32m+[m[32m    await ensureLabTable();[m
[32m+[m[32m  }[m
[32m+[m
   if (dests.includes('jsonl')) {[m
[31m-    const p = path.join(outDir, DEST_FILES.jsonl);[m
[31m-    fps.jsonl = fingerprintFromFile(p, sampleSize);[m
[32m+[m[32m    const filePath = path.join([m
[32m+[m[32m      outDir,[m
[32m+[m[32m      DEST_FILES.jsonl,[m
[32m+[m[32m    );[m
[32m+[m
[32m+[m[32m    fps.jsonl = fingerprintFromFile([m
[32m+[m[32m      filePath,[m
[32m+[m[32m      sampleSize,[m
[32m+[m[32m    );[m
   }[m
[32m+[m
   if (dests.includes('csv') && fps.jsonl) {[m
[31m-    // Contagem CSV = linhas - 1[m
[31m-    const raw = fs.readFileSync(path.join(outDir, DEST_FILES.csv), 'utf8');[m
[31m-    const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);[m
[32m+[m[32m    const raw = fs.readFileSync([m
[32m+[m[32m      path.join(outDir, DEST_FILES.csv),[m
[32m+[m[32m      'utf8',[m
[32m+[m[32m    );[m
[32m+[m
[32m+[m[32m    const lines = raw[m
[32m+[m[32m      .replace(/^\uFEFF/, '')[m
[32m+[m[32m      .split(/\r?\n/)[m
[32m+[m[32m      .filter(Boolean);[m
[32m+[m
     fps.csv = {[m
       count: Math.max(0, lines.length - 1),[m
       sum_valor_total: fps.jsonl.sum_valor_total,[m
       note: 'soma alinhada ao JSONL (mesmo gerador/seed)',[m
     };[m
   }[m
[32m+[m
   if (dests.includes('avro')) {[m
[31m-    const st = fs.statSync(path.join(outDir, DEST_FILES.avro));[m
[31m-    fps.avro = { bytes: st.size, records_expected: meta.records };[m
[32m+[m[32m    const filePath = path.join([m
[32m+[m[32m      outDir,[m
[32m+[m[32m      DEST_FILES.avro,[m
[32m+[m[32m    );[m
[32m+[m
[32m+[m[32m    const stats = fs.statSync(filePath);[m
[32m+[m
[32m+[m[32m    fps.avro = {[m
[32m+[m[32m      bytes: stats.size,[m
[32m+[m[32m      records_expected: meta.records,[m
[32m+[m[32m    };[m
   }[m
[32m+[m
   if (dests.includes('parquet')) {[m
[31m-    const st = fs.statSync(path.join(outDir, DEST_FILES.parquet));[m
[31m-    fps.parquet = { bytes: st.size, records_expected: meta.records };[m
[32m+[m[32m    const filePath = path.join([m
[32m+[m[32m      outDir,[m
[32m+[m[32m      DEST_FILES.parquet,[m
[32m+[m[32m    );[m
[32m+[m
[32m+[m[32m    const stats = fs.statSync(filePath);[m
[32m+[m
[32m+[m[32m    fps.parquet = {[m
[32m+[m[32m      bytes: stats.size,[m
[32m+[m[32m      records_expected: meta.records,[m
[32m+[m[32m    };[m
   }[m
[32m+[m
   if (dests.includes('sql')) {[m
[31m-    const [[{ c, s }]] = await db.query([m
[31m-      'SELECT COUNT(*) AS c, COALESCE(SUM(CAST(valor_total AS DECIMAL(18,2))),0) AS s FROM lab_transacoes WHERE execucao_id = ?', [path.basename(outDir)],[m
[32m+[m[32m    const [[result]] = await db.query([m
[32m+[m[32m      `SELECT[m
[32m+[m[32m         COUNT(*) AS c,[m
[32m+[m[32m         COALESCE([m
[32m+[m[32m           SUM(CAST(valor_total AS DECIMAL(18,2))),[m
[32m+[m[32m           0[m
[32m+[m[32m         ) AS s[m
[32m+[m[32m       FROM lab_transacoes[m
[32m+[m[32m       WHERE execucao_id = ?`,[m
[32m+[m[32m      [runId],[m
     );[m
[31m-    fps.sql = { count: Number(c), sum_valor_total: Number(s).toFixed(2) };[m
[32m+[m
[32m+[m[32m    fps.sql = {[m
[32m+[m[32m      count: Number(result.c),[m
[32m+[m[32m      sum_valor_total: Number(result.s).toFixed(2),[m
[32m+[m[32m    };[m
   }[m
 [m
[31m-  const counts = Object.values(fps).map((f) => f.count).filter((c) => typeof c === 'number');[m
[31m-  const sums = Object.values(fps).map((f) => f.sum_valor_total).filter(Boolean);[m
[31m-  const equivalent =[m
[32m+[m[32m  const counts = Object.values(fps)[m
[32m+[m[32m    .map((fingerprint) => fingerprint.count)[m
[32m+[m[32m    .filter((count) => typeof count === 'number');[m
[32m+[m
[32m+[m[32m  const sums = Object.values(fps)[m
[32m+[m[32m    .map((fingerprint) => fingerprint.sum_valor_total)[m
[32m+[m[32m    .filter(Boolean);[m
[32m+[m
[32m+[m[32m  const equivalent = ([m
     counts.length >= 2[m
[31m-    && counts.every((c) => c === counts[0])[m
[31m-    && (sums.length < 2 || sums.every((s) => s === sums[0]));[m
[32m+[m[32m    && counts.every((count) => count === counts[0])[m
[32m+[m[32m    && ([m
[32m+[m[32m      sums.length < 2[m
[32m+[m[32m      || sums.every((sum) => sum === sums[0])[m
[32m+[m[32m    )[m
[32m+[m[32m  );[m
 [m
   const result = {[m
[31m-    out_dir: outName,[m
[32m+[m[32m    out_dir: runId,[m
     equivalent,[m
     fingerprints: fps,[m
     quality: {[m
[36m@@ -389,11 +804,22 @@[m [masync function validateRun(outName, sampleSize = 100) {[m
     },[m
     checked_at: new Date().toISOString(),[m
   };[m
[31m-  fs.writeFileSync(path.join(outDir, 'validation_report.json'), JSON.stringify(result, null, 2));[m
[32m+[m
[32m+[m[32m  fs.writeFileSync([m
[32m+[m[32m    path.join(outDir, 'validation_report.json'),[m
[32m+[m[32m    JSON.stringify(result, null, 2),[m
[32m+[m[32m  );[m
[32m+[m
   return result;[m
 }[m
 [m
[31m-async function runBenchmark({ records, seed = 42, batchSize = 2000, destinations, outName }) {[m
[32m+[m[32masync function runBenchmark({[m
[32m+[m[32m  records,[m
[32m+[m[32m  seed = 42,[m
[32m+[m[32m  batchSize = 2000,[m
[32m+[m[32m  destinations,[m
[32m+[m[32m  outName,[m
[32m+[m[32m}) {[m
   const gen = await runGenerate({[m
     records,[m
     seed,[m
[36m@@ -401,38 +827,80 @@[m [masync function runBenchmark({ records, seed = 42, batchSize = 2000, destinations[m
     destinations,[m
     outName: outName || `bench_${Date.now()}`,[m
   });[m
[32m+[m
   const formats = {};[m
   let csvBytes = null;[m
[31m-  for (const [dest, w] of Object.entries(gen.writes)) {[m
[31m-    const bytes = w.bytes || 0;[m
[31m-    if (dest === 'csv') csvBytes = bytes;[m
[31m-    const writeSec = w.write_seconds || gen.elapsed_seconds / Object.keys(gen.writes).length;[m
[31m-    formats[dest] = {[m
[32m+[m
[32m+[m[32m  for (const [destination, write] of Object.entries(gen.writes)) {[m
[32m+[m[32m    const bytes = write.bytes || 0;[m
[32m+[m
[32m+[m[32m    if (destination === 'csv') {[m
[32m+[m[32m      csvBytes = bytes;[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const writeSeconds = ([m
[32m+[m[32m      write.write_seconds[m
[32m+[m[32m      || gen.elapsed_seconds / Object.keys(gen.writes).length[m
[32m+[m[32m    );[m
[32m+[m
[32m+[m[32m    formats[destination] = {[m
       bytes,[m
[31m-      write_seconds: { median: writeSec, min: writeSec, max: writeSec },[m
[32m+[m[32m      write_seconds: {[m
[32m+[m[32m        median: writeSeconds,[m
[32m+[m[32m        min: writeSeconds,[m
[32m+[m[32m        max: writeSeconds,[m
[32m+[m[32m      },[m
       write_records_per_sec: {[m
[31m-        median: writeSec > 0 ? gen.records / writeSec : 0,[m
[32m+[m[32m        median: writeSeconds > 0[m
[32m+[m[32m          ? gen.records / writeSeconds[m
[32m+[m[32m          : 0,[m
       },[m
       compression_vs_csv: null,[m
     };[m
   }[m
[32m+[m
   if (csvBytes) {[m
[31m-    for (const dest of Object.keys(formats)) {[m
[31m-      formats[dest].compression_vs_csv = formats[dest].bytes / csvBytes;[m
[32m+[m[32m    for (const destination of Object.keys(formats)) {[m
[32m+[m[32m      formats[destination].compression_vs_csv = ([m
[32m+[m[32m        formats[destination].bytes / csvBytes[m
[32m+[m[32m      );[m
     }[m
   }[m
 [m
[31m-  // Agregação SQL se disponível[m
   let groupBy = null;[m
[32m+[m
   if (gen.destinations.includes('sql')) {[m
[31m-    const t0 = process.hrtime.bigint();[m
[32m+[m[32m    // A geração SQL já garante a migração, mas manter esta[m
[32m+[m[32m    // garantia torna a função independente de alterações futuras.[m
[32m+[m[32m    await ensureLabTable();[m
[32m+[m
[32m+[m[32m    const startTime = process.hrtime.bigint();[m
[32m+[m
     const [rows] = await db.query([m
[31m-      `SELECT categoria, COUNT(*) AS c, SUM(CAST(valor_total AS DECIMAL(18,2))) AS s[m
[31m-       FROM lab_transacoes WHERE execucao_id = ? GROUP BY categoria ORDER BY categoria`, [gen.out_dir],[m
[32m+[m[32m      `SELECT[m
[32m+[m[32m         categoria,[m
[32m+[m[32m         COUNT(*) AS c,[m
[32m+[m[32m         SUM(CAST(valor_total AS DECIMAL(18,2))) AS s[m
[32m+[m[32m       FROM lab_transacoes[m
[32m+[m[32m       WHERE execucao_id = ?[m
[32m+[m[32m       GROUP BY categoria[m
[32m+[m[32m       ORDER BY categoria`,[m
[32m+[m[32m      [gen.out_dir],[m
     );[m
[32m+[m
     groupBy = {[m
[31m-      seconds: Number(process.hrtime.bigint() - t0) / 1e9,[m
[31m-      groups: Object.fromEntries(rows.map((r) => [r.categoria, { count: Number(r.c), sum_valor_total: Number(r.s).toFixed(2) }])),[m
[32m+[m[32m      seconds: Number([m
[32m+[m[32m        process.hrtime.bigint() - startTime,[m
[32m+[m[32m      ) / 1e9,[m
[32m+[m[32m      groups: Object.fromEntries([m
[32m+[m[32m        rows.map((row) => [[m
[32m+[m[32m          row.categoria,[m
[32m+[m[32m          {[m
[32m+[m[32m            count: Number(row.c),[m
[32m+[m[32m            sum_valor_total: Number(row.s).toFixed(2),[m
[32m+[m[32m          },[m
[32m+[m[32m        ]),[m
[32m+[m[32m      ),[m
     };[m
   }[m
 [m
[36m@@ -443,8 +911,6 @@[m [masync function runBenchmark({ records, seed = 42, batchSize = 2000, destinations[m
     destinations: gen.destinations,[m
     out_dir: gen.out_dir,[m
     out_path: gen.out_path,[m
[31m-    records: gen.records,[m
[31m-    seed: gen.seed,[m
     elapsed_seconds: gen.elapsed_seconds,[m
     writes: gen.writes,[m
     formats,[m
[36m@@ -453,27 +919,55 @@[m [masync function runBenchmark({ records, seed = 42, batchSize = 2000, destinations[m
     engine: 'node-admin',[m
     note: 'Painel admin: volumes até 25k. Escalas S/M (1M/10M) via CLI Python em data-engineering/.',[m
   };[m
[32m+[m
   const outDir = gen.out_path;[m
[31m-  fs.writeFileSync(path.join(outDir, 'benchmark_report.json'), JSON.stringify(report, null, 2));[m
[31m-  saveLatest({ ...gen, benchmark: report });[m
[32m+[m
[32m+[m[32m  fs.writeFileSync([m
[32m+[m[32m    path.join(outDir, 'benchmark_report.json'),[m
[32m+[m[32m    JSON.stringify(report, null, 2),[m
[32m+[m[32m  );[m
[32m+[m
[32m+[m[32m  saveLatest({[m
[32m+[m[32m    ...gen,[m
[32m+[m[32m    benchmark: report,[m
[32m+[m[32m  });[m
[32m+[m
   return report;[m
 }[m
 [m
 function saveLatest(payload) {[m
   ensureDir(labRoot());[m
[31m-  fs.writeFileSync(path.join(labRoot(), 'latest.json'), JSON.stringify(payload, null, 2));[m
[32m+[m
[32m+[m[32m  fs.writeFileSync([m
[32m+[m[32m    path.join(labRoot(), 'latest.json'),[m
[32m+[m[32m    JSON.stringify(payload, null, 2),[m
[32m+[m[32m  );[m
 }[m
 [m
 function listRuns() {[m
   const root = labRoot();[m
[31m-  if (!fs.existsSync(root)) return [];[m
[32m+[m
[32m+[m[32m  if (!fs.existsSync(root)) {[m
[32m+[m[32m    return [];[m
[32m+[m[32m  }[m
[32m+[m
   return fs.readdirSync(root)[m
     .filter((name) => {[m
[31m-      const p = path.join(root, name);[m
[31m-      return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'run_meta.json'));[m
[32m+[m[32m      const directory = path.join(root, name);[m
[32m+[m
[32m+[m[32m      return ([m
[32m+[m[32m        fs.statSync(directory).isDirectory()[m
[32m+[m[32m        && fs.existsSync(path.join(directory, 'run_meta.json'))[m
[32m+[m[32m      );[m
     })[m
     .map((name) => {[m
[31m-      const meta = JSON.parse(fs.readFileSync(path.join(root, name, 'run_meta.json'), 'utf8'));[m
[32m+[m[32m      const meta = JSON.parse([m
[32m+[m[32m        fs.readFileSync([m
[32m+[m[32m          path.join(root, name, 'run_meta.json'),[m
[32m+[m[32m          'utf8',[m
[32m+[m[32m        ),[m
[32m+[m[32m      );[m
[32m+[m
       return {[m
         out_dir: name,[m
         records: meta.records,[m
[36m@@ -483,27 +977,64 @@[m [mfunction listRuns() {[m
         elapsed_seconds: meta.elapsed_seconds,[m
       };[m
     })[m
[31m-    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));[m
[32m+[m[32m    .sort((a, b) => ([m
[32m+[m[32m      String(b.created_at).localeCompare(String(a.created_at))[m
[32m+[m[32m    ));[m
 }[m
 [m
 function getLatest() {[m
[31m-  const p = path.join(labRoot(), 'latest.json');[m
[31m-  if (!fs.existsSync(p)) return null;[m
[31m-  return JSON.parse(fs.readFileSync(p, 'utf8'));[m
[32m+[m[32m  const filePath = path.join([m
[32m+[m[32m    labRoot(),[m
[32m+[m[32m    'latest.json',[m
[32m+[m[32m  );[m
[32m+[m
[32m+[m[32m  if (!fs.existsSync(filePath)) {[m
[32m+[m[32m    return null;[m
[32m+[m[32m  }[m
[32m+[m
[32m+[m[32m  return JSON.parse([m
[32m+[m[32m    fs.readFileSync(filePath, 'utf8'),[m
[32m+[m[32m  );[m
 }[m
 [m
 function resolveArtifact(outName, file) {[m
[31m-  const base = path.basename(file);[m
[31m-  if (!['transacoes.jsonl', 'transacoes.csv', 'transacoes.avro', 'transacoes.parquet', 'criar_dados.sql', 'apagar_dados.sql', 'run_meta.json', 'benchmark_report.json', 'validation_report.json'].includes(base)) {[m
[31m-    throw Object.assign(new Error('Ficheiro não permitido.'), { status: 403 });[m
[32m+[m[32m  const runId = normalizeRunId(outName);[m
[32m+[m[32m  const base = path.basename(String(file || ''));[m
[32m+[m
[32m+[m[32m  const allowedFiles = [[m
[32m+[m[32m    'transacoes.jsonl',[m
[32m+[m[32m    'transacoes.csv',[m
[32m+[m[32m    'transacoes.avro',[m
[32m+[m[32m    'transacoes.parquet',[m
[32m+[m[32m    'criar_dados.sql',[m
[32m+[m[32m    'apagar_dados.sql',[m
[32m+[m[32m    'run_meta.json',[m
[32m+[m[32m    'benchmark_report.json',[m
[32m+[m[32m    'validation_report.json',[m
[32m+[m[32m  ];[m
[32m+[m
[32m+[m[32m  if (!allowedFiles.includes(base)) {[m
[32m+[m[32m    throw Object.assign([m
[32m+[m[32m      new Error('Ficheiro não permitido.'),[m
[32m+[m[32m      { status: 403 },[m
[32m+[m[32m    );[m
   }[m
[31m-  if (!/^(run|bench)_\d+$/.test(String(outName || ''))) throw Object.assign(new Error('Execução inválida.'), { status: 400 });[m
[32m+[m
   const root = path.resolve(labRoot());[m
[31m-  const full = path.resolve(root, outName, base);[m
[31m-  if (!full.startsWith(root + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {[m
[31m-    throw Object.assign(new Error('Ficheiro não encontrado.'), { status: 404 });[m
[32m+[m[32m  const fullPath = path.resolve(root, runId, base);[m
[32m+[m
[32m+[m[32m  if ([m
[32m+[m[32m    !fullPath.startsWith(root + path.sep)[m
[32m+[m[32m    || !fs.existsSync(fullPath)[m
[32m+[m[32m    || !fs.statSync(fullPath).isFile()[m
[32m+[m[32m  ) {[m
[32m+[m[32m    throw Object.assign([m
[32m+[m[32m      new Error('Ficheiro não encontrado.'),[m
[32m+[m[32m      { status: 404 },[m
[32m+[m[32m    );[m
   }[m
[31m-  return full;[m
[32m+[m
[32m+[m[32m  return fullPath;[m
 }[m
 [m
 module.exports = {[m
