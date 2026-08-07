const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename(_req, file, cb) {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${safeOriginal}`);
  },
});

const allowedMime = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'text/plain',
]);

const allowedExt = /\.(pdf|doc|docx|jpg|jpeg|png|txt)$/i;

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const extOk = allowedExt.test(file.originalname);
    const mimeOk = allowedMime.has(file.mimetype);

    if (extOk && mimeOk) {
      return cb(null, true);
    }

    return cb(new Error('Unsupported file type. Use PDF, DOC, DOCX, JPG, PNG, or TXT.'));
  },
});

const avatarStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, avatarsDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok =
      /^image\/(jpeg|png|webp)$/.test(file.mimetype) &&
      /\.(jpe?g|png|webp)$/i.test(file.originalname);
    if (ok) return cb(null, true);
    return cb(new Error('Profile photo must be JPG, PNG, or WebP (max 2MB).'));
  },
});

module.exports = { upload, avatarUpload, uploadsDir, avatarsDir };
