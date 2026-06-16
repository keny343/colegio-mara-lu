const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

function cloudinaryUpload(folder, maxSizeMB = 10) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
      folder: `colegio_mara_lu/${folder}`,
      resource_type: 'auto',
      public_id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    }),
  });
  return multer({ storage, limits: { fileSize: maxSizeMB * 1024 * 1024 } });
}

module.exports = cloudinaryUpload;