// Script de diagnóstico - lista TUDO que existe no Cloudinary
// node check_cloudinary.js

require('dotenv').config();
const cloudinary = require('./src/config/cloudinary');

async function check() {
  console.log('☁️  Cloud:', process.env.CLOUDINARY_CLOUD_NAME);
  console.log('🔍 A listar todos os recursos...\n');

  for (const rtype of ['image', 'raw', 'video']) {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        resource_type: rtype,
        max_results: 20,
      });
      if (result.resources.length > 0) {
        console.log(`\n--- ${rtype.toUpperCase()} (${result.resources.length}) ---`);
        result.resources.forEach(r => {
          console.log(`  public_id : ${r.public_id}`);
          console.log(`  access    : ${r.access_mode || 'N/A'}`);
          console.log(`  url       : ${r.secure_url}`);
          console.log('');
        });
      } else {
        console.log(`[${rtype}] Nenhum ficheiro encontrado.`);
      }
    } catch (err) {
      console.log(`[${rtype}] Erro: ${err.message}`);
    }
  }
}

check().catch(console.error);
