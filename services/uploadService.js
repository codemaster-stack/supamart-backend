const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage for store logos
const logoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'supamart/logos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill' }]
  }
});

// Storage for product images
const productStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'supamart/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }]
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB max
});

const uploadProductImages = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

module.exports = { uploadLogo, uploadProductImages };