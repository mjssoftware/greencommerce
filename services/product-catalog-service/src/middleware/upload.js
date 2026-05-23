const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const { ApiError } = require('../utils/api-error');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || ['image/jpeg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file type'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880
  }
});

const processImage = async (file, options = {}) => {
  const {
    width = 800,
    height = 800,
    quality = 80,
    format = 'webp'
  } = options;
  
  let image = sharp(file.buffer);
  
  // Resize
  image = image.resize(width, height, {
    fit: 'cover',
    position: 'center'
  });
  
  // Convert format
  if (format === 'webp') {
    image = image.webp({ quality });
  } else if (format === 'jpeg') {
    image = image.jpeg({ quality });
  } else if (format === 'png') {
    image = image.png({ quality });
  }
  
  return await image.toBuffer();
};

const processMultipleSizes = async (file) => {
  const sizes = {
    thumbnail: { width: 150, height: 150 },
    medium: { width: 400, height: 400 },
    large: { width: 1200, height: 1200 }
  };
  
  const processed = {};
  
  for (const [size, dimensions] of Object.entries(sizes)) {
    processed[size] = await processImage(file, dimensions);
  }
  
  return processed;
};

module.exports = { upload, processImage, processMultipleSizes };