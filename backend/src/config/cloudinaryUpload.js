const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

function cloudinaryUpload(folder, maxSizeMB = 10) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const isPDF = file.mimetype === 'application/pdf';
      return {
        folder: `colegio_mara_lu/${folder}`,
        resource_type: isPDF ? 'raw' : 'auto',
        access_mode: 'public',
        public_id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      };
    },
  });
  return multer({ storage, limits: { fileSize: maxSizeMB * 1024 * 1024 } });
}

module.exports = cloudinaryUpload;