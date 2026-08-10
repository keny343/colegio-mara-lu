const path = require('path');

// Tipos de ficheiro permitidos em uploads (evita executáveis e conteúdos maliciosos)
const ALLOWED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/bmp': ['.bmp'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/zip': ['.zip'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
};

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExts = ALLOWED_TYPES[file.mimetype];
  if (!allowedExts || !allowedExts.includes(ext)) {
    const err = new Error('Formato de ficheiro não permitido (use imagens, PDF ou documentos Office).');
    err.status = 400;
    err.expose = true;
    return cb(err);
  }
  return cb(null, true);
}

module.exports = { fileFilter, ALLOWED_TYPES };
