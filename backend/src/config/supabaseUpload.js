const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const path = require('path');
const { fileFilter } = require('./uploadFilters');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware multer que guarda em memória e depois envia para o Supabase
function supabaseUpload(folder, maxSizeMB = 10) {
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter,
  });

  // Injeta a lógica de upload no req.file após o multer processar
  const middleware = (fieldName) => {
    const multerMiddleware = upload.single(fieldName);
    return async (req, res, next) => {
      multerMiddleware(req, res, async (err) => {
        if (err) return next(err);
        if (!req.file) return next();

        try {
          const ext = path.extname(req.file.originalname) || '';
          const fileName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
          const filePath = `${folder}/${fileName}`;

          const { error } = await supabase.storage
            .from('uploads')
            .upload(filePath, req.file.buffer, {
              contentType: req.file.mimetype,
              upsert: false,
            });

          if (error) throw error;

          const { data } = supabase.storage
            .from('uploads')
            .getPublicUrl(filePath);

          req.file.secure_url = data.publicUrl;
          req.file.path = data.publicUrl;

          next();
        } catch (uploadErr) {
          next(uploadErr);
        }
      });
    };
  };

  // Para múltiplos campos (ex: publicController)
  const middlewareFields = (fields) => {
    const multerMiddleware = upload.fields(fields);
    return async (req, res, next) => {
      multerMiddleware(req, res, async (err) => {
        if (err) return next(err);
        if (!req.files) return next();

        try {
          for (const fieldName of Object.keys(req.files)) {
            for (let i = 0; i < req.files[fieldName].length; i++) {
              const file = req.files[fieldName][i];
              const ext = path.extname(file.originalname) || '';
              const fileName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
              const filePath = `${folder}/${fileName}`;

              const { error } = await supabase.storage
                .from('uploads')
                .upload(filePath, file.buffer, {
                  contentType: file.mimetype,
                  upsert: false,
                });

              if (error) throw error;

              const { data } = supabase.storage
                .from('uploads')
                .getPublicUrl(filePath);

              req.files[fieldName][i].secure_url = data.publicUrl;
              req.files[fieldName][i].path = data.publicUrl;
            }
          }
          next();
        } catch (uploadErr) {
          next(uploadErr);
        }
      });
    };
  };

  return { single: middleware, fields: middlewareFields };
}

module.exports = supabaseUpload;