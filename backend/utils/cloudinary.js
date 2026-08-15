/**
 * Optional Cloudinary storage for hosted deploys.
 * If CLOUDINARY_* env vars are missing, uploads stay on local disk.
 */
const { v2: cloudinary } = require('cloudinary');

function isCloudinaryConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function configureCloudinary() {
  if (!isCloudinaryConfigured()) return false;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return true;
}

function isRemoteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

/** Best-effort public_id from a Cloudinary delivery URL. */
function publicIdFromUrl(url) {
  if (!url || !isRemoteUrl(url)) return null;
  try {
    const pathname = new URL(url).pathname;
    const marker = '/upload/';
    const idx = pathname.indexOf(marker);
    if (idx === -1) return null;
    let rest = pathname.slice(idx + marker.length);
    // Drop version segment (v123456) and transform folders if present
    rest = rest.replace(/^v\d+\//, '');
    // If transforms exist (e.g. w_200/), keep last path after transforms — for raw uploads we avoid transforms
    const lastSlash = rest.lastIndexOf('/');
    const maybeTransforms = rest.includes(',') || /^(c_|w_|h_|f_|q_)/.test(rest);
    if (maybeTransforms && lastSlash !== -1) {
      // leave as-is for simple folder/public_id paths without transforms
    }
    return rest.replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
}

/**
 * Upload a multer file (disk path or memory buffer) to Cloudinary.
 * @returns {Promise<{ url: string, publicId: string, bytes: number }>}
 */
async function uploadToCloudinary(file, { folder, resourceType = 'auto' } = {}) {
  if (!configureCloudinary()) {
    throw new Error('Cloudinary is not configured');
  }

  const options = {
    folder: folder || process.env.CLOUDINARY_FOLDER || 'medichain',
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  };

  let result;
  if (file.buffer) {
    result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
      stream.end(file.buffer);
    });
  } else if (file.path) {
    result = await cloudinary.uploader.upload(file.path, options);
  } else {
    throw new Error('No file data to upload to Cloudinary');
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes || 0,
  };
}

async function destroyCloudinary(publicIdOrUrl, resourceType = 'image') {
  if (!configureCloudinary()) return { deleted: false, reason: 'not configured' };
  const publicId = isRemoteUrl(publicIdOrUrl)
    ? publicIdFromUrl(publicIdOrUrl)
    : publicIdOrUrl;
  if (!publicId) return { deleted: false, reason: 'no public id' };

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return { deleted: true };
  } catch (err) {
    console.error('[MediChain Cloudinary] Destroy failed:', err.message);
    return { deleted: false, reason: err.message };
  }
}

/**
 * Load file bytes from a local path or remote URL (for hash / zip download).
 */
async function readFileBytes(filePathOrUrl) {
  if (!filePathOrUrl) return null;
  if (isRemoteUrl(filePathOrUrl)) {
    const response = await fetch(filePathOrUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch remote file (${response.status})`);
    }
    const ab = await response.arrayBuffer();
    return Buffer.from(ab);
  }
  const fs = require('fs');
  if (!fs.existsSync(filePathOrUrl)) return null;
  return fs.readFileSync(filePathOrUrl);
}

module.exports = {
  isCloudinaryConfigured,
  isRemoteUrl,
  publicIdFromUrl,
  uploadToCloudinary,
  destroyCloudinary,
  readFileBytes,
};
