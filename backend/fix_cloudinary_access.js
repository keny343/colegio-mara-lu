// Script para tornar públicos todos os ficheiros em colegio_mara_lu/inscricoes
// Corre UMA VEZ: node fix_cloudinary_access.js

require('dotenv').config();
const cloudinary = require('./src/config/cloudinary');

async function fixAccess() {
  console.log('🔍 A procurar ficheiros em colegio_mara_lu/inscricoes...\n');

  let nextCursor = null;
  let total = 0;
  let fixed = 0;

  // --- IMAGENS ---
  do {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'colegio_mara_lu/inscricoes',
      resource_type: 'image',
      max_results: 100,
      next_cursor: nextCursor,
    });

    for (const resource of result.resources) {
      total++;
      if (resource.access_mode !== 'public') {
        try {
          await cloudinary.api.update(resource.public_id, {
            resource_type: 'image',
            access_mode: 'public',
          });
          console.log(`✅ Corrigido (image): ${resource.public_id}`);
          fixed++;
        } catch (err) {
          console.error(`❌ Erro em ${resource.public_id}:`, err.message);
        }
      } else {
        console.log(`⏭️  Já público (image): ${resource.public_id}`);
      }
    }

    nextCursor = result.next_cursor;
  } while (nextCursor);

  // --- PDFs (resource_type 'raw') ---
  let rawCursor = null;
  do {
    const rawResult = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'colegio_mara_lu/inscricoes',
      resource_type: 'raw',
      max_results: 100,
      next_cursor: rawCursor,
    });

    for (const resource of rawResult.resources) {
      total++;
      try {
        await cloudinary.uploader.explicit(resource.public_id, {
          resource_type: 'raw',
          type: 'upload',
          access_mode: 'public',
        });
        console.log(`✅ Corrigido (raw/pdf): ${resource.public_id}`);
        fixed++;
      } catch (err) {
        console.error(`❌ Erro em ${resource.public_id}:`, err.message);
      }
    }

    rawCursor = rawResult.next_cursor;
  } while (rawCursor);

  console.log(`\n📊 Total encontrado: ${total}`);
  console.log(`🔧 Total corrigido: ${fixed}`);
  console.log('\n✅ Concluído!');
}

fixAccess().catch(console.error);