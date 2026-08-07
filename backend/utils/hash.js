/**
 * Deterministic hashing helpers for MediChain blockchain blocks & files.
 */
const crypto = require('crypto');

/**
 * Stable JSON stringify so object key order never changes a block hash.
 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  // Strip Mongo-ish internals if present
  const keys = Object.keys(value)
    .filter((key) => key !== '_id' && key !== '__v')
    .sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

/**
 * SHA-256 hex digest of a string or Buffer.
 */
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Hash a block's immutable fields into its identity.
 */
function calculateBlockHash({ index, timestamp, data, previousHash, nonce = 0 }) {
  const payload = [
    String(index),
    String(timestamp),
    stableStringify(data || {}),
    String(previousHash || ''),
    String(nonce),
  ].join('|');

  return sha256(payload);
}

/**
 * Hash file contents (Buffer) for medical report integrity.
 */
function hashFileBuffer(buffer) {
  return sha256(buffer);
}

module.exports = {
  stableStringify,
  sha256,
  calculateBlockHash,
  hashFileBuffer,
};
