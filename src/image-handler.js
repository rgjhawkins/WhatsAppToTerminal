const fs = require('fs');
const path = require('path');
const config = require('./config');

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

// Save images inside the Claude working dir so it has access
const IMAGES_DIR = path.join(config.claudeWorkingDir, '.wa-images');

function saveImage(media) {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
  const ext = MIME_TO_EXT[media.mimetype] || '.jpg';
  const fileName = `img-${Date.now()}${ext}`;
  const filePath = path.join(IMAGES_DIR, fileName);
  fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'));
  return filePath;
}

function cleanupImage(filePath) {
  try { fs.unlinkSync(filePath); } catch {}
}

module.exports = { saveImage, cleanupImage };
