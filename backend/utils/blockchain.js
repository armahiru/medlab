/**
 * MediChain simulated blockchain service.
 *
 * Each medical report becomes block.data. Blocks are hash-linked:
 * block[n].previousHash === block[n-1].hash
 *
 * If anyone edits stored data without recalculating the hash,
 * validateChain() detects the break — the core integrity demo.
 */
const Block = require('../models/Block');
const { calculateBlockHash } = require('./hash');

const GENESIS_DATA = {
  type: 'genesis',
  title: 'Genesis Block',
  message: 'MediChain medical report ledger initialized',
};

function toPlainData(data) {
  if (!data) return {};
  if (typeof data.toObject === 'function') {
    return data.toObject();
  }
  // Deep-clone through JSON to strip ObjectId/Date quirks for hashing
  return JSON.parse(JSON.stringify(data));
}

function blockToClient(doc) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    index: obj.index,
    timestamp: obj.timestamp,
    data: obj.data,
    previousHash: obj.previousHash,
    hash: obj.hash,
    nonce: obj.nonce ?? 0,
  };
}

async function getChain() {
  const blocks = await Block.find().sort({ index: 1 }).lean();
  return blocks.map(blockToClient);
}

async function getLatestBlock() {
  return Block.findOne().sort({ index: -1 });
}

async function ensureGenesisBlock() {
  const count = await Block.countDocuments();
  if (count > 0) return getLatestBlock();

  const timestamp = new Date().toISOString();
  const previousHash = '0';
  const nonce = 0;
  const index = 0;
  const data = { ...GENESIS_DATA };

  const hash = calculateBlockHash({
    index,
    timestamp,
    data,
    previousHash,
    nonce,
  });

  const genesis = await Block.create({
    index,
    timestamp,
    data,
    previousHash,
    hash,
    nonce,
  });

  return genesis;
}

/**
 * Append a new block containing medical report transaction data.
 */
async function addBlock(transactionData) {
  await ensureGenesisBlock();

  const latest = await getLatestBlock();
  const index = latest.index + 1;
  const timestamp = new Date().toISOString();
  const previousHash = latest.hash;
  const nonce = 0;
  const data = toPlainData(transactionData);

  const hash = calculateBlockHash({
    index,
    timestamp,
    data,
    previousHash,
    nonce,
  });

  const block = await Block.create({
    index,
    timestamp,
    data,
    previousHash,
    hash,
    nonce,
  });

  return blockToClient(block);
}

/**
 * Walk the full chain, recalculate hashes, and flag breaks.
 *
 * A block is "tampered" if:
 * 1) recalculated hash !== stored hash, OR
 * 2) previousHash does not equal the previous block's stored hash
 *
 * Changing one field in block.data without updating hash breaks (1).
 * Forging a new hash without updating the next block's previousHash breaks (2) on the next block.
 */
async function validateChain() {
  const chain = await Block.find().sort({ index: 1 });

  if (!chain.length) {
    return { isValid: true, blocks: [] };
  }

  const results = [];
  let isValid = true;

  for (let i = 0; i < chain.length; i += 1) {
    const current = chain[i];
    const data = toPlainData(current.data);

    const recalculated = calculateBlockHash({
      index: current.index,
      timestamp: current.timestamp,
      data,
      previousHash: current.previousHash,
      nonce: current.nonce ?? 0,
    });

    const hashMatch = recalculated === current.hash;

    let linkValid = true;
    if (i === 0) {
      linkValid = current.previousHash === '0';
    } else {
      linkValid = current.previousHash === chain[i - 1].hash;
    }

    const status = hashMatch && linkValid ? 'valid' : 'tampered';
    if (status === 'tampered') isValid = false;

    results.push({
      index: current.index,
      status,
      hashMatch,
      linkValid,
      storedHash: current.hash,
      calculatedHash: recalculated,
    });
  }

  return { isValid, blocks: results };
}

/**
 * Lab-only: corrupt block data WITHOUT recalculating hash.
 * Stores original title so Integrity Repair can restore operations.
 */
async function tamperBlock(blockIndex) {
  const index = Number(blockIndex);

  if (Number.isNaN(index) || index <= 0) {
    const error = new Error('Cannot tamper with the genesis block or an invalid index');
    error.statusCode = 400;
    throw error;
  }

  const block = await Block.findOne({ index });
  if (!block) {
    const error = new Error(`Block #${index} not found`);
    error.statusCode = 404;
    throw error;
  }

  const data = toPlainData(block.data);
  const originalTitle = data._originalTitle || data.title || 'Medical report';

  data._originalTitle = originalTitle.replace(/\s*\[TAMPERED\]\s*$/i, '');
  data.title = `${data._originalTitle} [TAMPERED]`;
  data._tamperFlag = true;
  data._tamperedAt = new Date().toISOString();

  block.data = data;
  block.markModified('data');
  await block.save();

  return blockToClient(block);
}

/**
 * Restore blocks corrupted by lab tamper (or title marked [TAMPERED]),
 * then re-validate. Does not rewrite hashes — restores data to match seals.
 */
async function repairTamperedBlocks() {
  const blocks = await Block.find({ index: { $gt: 0 } });
  let repaired = 0;

  for (const block of blocks) {
    const data = toPlainData(block.data);
    const marked =
      data._tamperFlag === true ||
      (typeof data.title === 'string' && /\[TAMPERED\]/i.test(data.title));

    if (!marked) continue;

    if (data._originalTitle) {
      data.title = data._originalTitle;
    } else if (typeof data.title === 'string') {
      data.title = data.title.replace(/\s*\[TAMPERED\]\s*$/i, '').trim();
    }

    delete data._tamperFlag;
    delete data._tamperedAt;
    delete data._originalTitle;

    block.data = data;
    block.markModified('data');
    await block.save();
    repaired += 1;
  }

  const validation = await validateChain();
  return { repaired, ...validation };
}

async function getBlockByIndex(index) {
  const block = await Block.findOne({ index }).lean();
  return block ? blockToClient(block) : null;
}

module.exports = {
  ensureGenesisBlock,
  addBlock,
  getChain,
  validateChain,
  tamperBlock,
  repairTamperedBlocks,
  getBlockByIndex,
  calculateBlockHash,
  blockToClient,
};
