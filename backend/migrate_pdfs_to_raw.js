// Migra PDFs de resource_type:image para raw usando rename directo via API
// Corre UMA VEZ: node migrate_pdfs_to_raw.js

require('dotenv').config();
const cloudinary = require('./src/config/cloudinary');
const db = require('./src/config/database');

async function migrate() {
  console.log('☁️  Cloud:', process.env.CLOUDINARY_CLOUD_NAME);
  console.log('🔄 A migrar PDFs de image → raw...\n');

  const result = await cloudinary.api.resources({
    type: 'upload',
    resource_type: 'image',
    prefix: 'colegio_mara_lu/',
    max_results: 100,
  });

  const pdfs = result.resources.filter(r =>
    r.secure_url.endsWith('.pdf') || r.public_id.endsWith('.pdf')
  );
  console.log(`📄 PDFs encontrados como 'image': ${pdfs.length}\n`);

  for (const resource of pdfs) {
    const publicId = resource.public_id;
    const oldUrl   = resource.secure_url; // /image/upload/...

    try {
      // Usar copy (via rename com overwrite) de image → raw
      // O Cloudinary permite mudar o resource_type via uploader.rename
      // mas o mais fiável é fazer upload a partir do authenticated URL usando as credenciais
      const authUrl = cloudinary.url(publicId, {
        resource_type: 'image',
        type: 'upload',
        sign_url: true,
        secure: true,
      });

      const uploadResult = await cloudinary.uploader.upload(authUrl, {
        resource_type: 'raw',
        public_id: publicId,
        overwrite: true,
        access_mode: 'public',
        type: 'upload',
      });

      const newUrl = uploadResult.secure_url;
      console.log(`✅ Migrado: ${publicId}`);
      console.log(`   Nova URL: ${newUrl}`);

      // Actualizar BD
      const [r] = await db.query(
        'UPDATE documentos SET caminho_arquivo = ? WHERE caminho_arquivo = ?',
        [newUrl, oldUrl]
      );
      console.log(`   BD: ${r.affectedRows} linha(s) actualizadas ✓`);

      // Apagar o antigo como image
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      console.log(`   Antigo (image) apagado ✓\n`);

    } catch (err) {
      console.error(`❌ Erro em ${publicId}:`, err.message);
    }
  }

  console.log('✅ Concluído!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});