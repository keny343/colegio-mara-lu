// Corrige URLs na base de dados: /raw/upload/ → /image/upload/
// Corre UMA VEZ: node fix_pdf_urls.js

require('dotenv').config();
const db = require('./src/config/database');

async function fixUrls() {
  console.log('🔍 A procurar documentos com URL incorreta (/raw/upload/)...\n');

  const [docs] = await db.query(
    `SELECT id, caminho_arquivo FROM documentos WHERE caminho_arquivo LIKE '%/raw/upload/%'`
  );

  if (docs.length === 0) {
    console.log('✅ Nenhum documento com URL /raw/upload/ encontrado. Nada a corrigir.');
    process.exit(0);
  }

  console.log(`📄 Encontrados ${docs.length} documento(s) para corrigir:\n`);

  let fixed = 0;
  for (const doc of docs) {
    const novaUrl = doc.caminho_arquivo.replace('/raw/upload/', '/image/upload/');
    console.log(`  ID ${doc.id}:`);
    console.log(`    Antes:  ${doc.caminho_arquivo}`);
    console.log(`    Depois: ${novaUrl}`);

    await db.query('UPDATE documentos SET caminho_arquivo = ? WHERE id = ?', [novaUrl, doc.id]);
    fixed++;
  }

  console.log(`\n📊 Total corrigido: ${fixed}`);
  console.log('\n✅ Concluído!');
  process.exit(0);
}

fixUrls().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});