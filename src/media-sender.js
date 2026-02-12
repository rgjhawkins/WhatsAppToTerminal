const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const config = require('./config');

const MEDIA_DIR = path.join(config.claudeWorkingDir, '.wa-media-out');

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
};

async function sendMediaFiles(chat) {
  if (!fs.existsSync(MEDIA_DIR)) return;

  const files = fs.readdirSync(MEDIA_DIR);
  if (files.length === 0) return;

  for (const file of files) {
    const filePath = path.join(MEDIA_DIR, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    const ext = path.extname(file).toLowerCase();
    const mimetype = MIME_TYPES[ext];
    if (!mimetype) {
      console.log(`[media] Skipping unknown file type: ${file}`);
      continue;
    }

    try {
      console.log(`[media] Sending ${file} (${(stat.size / 1024).toFixed(1)}KB)`);
      const data = fs.readFileSync(filePath).toString('base64');
      const media = new MessageMedia(mimetype, data, file);
      await chat.sendMessage(media);
    } catch (err) {
      console.error(`[media] Failed to send ${file}:`, err.message);
    }

    // Clean up after sending
    try { fs.unlinkSync(filePath); } catch {}
  }
}

module.exports = { sendMediaFiles };
