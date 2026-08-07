const blockchain = require('../utils/blockchain');

/**
 * GET /api/chain
 */
async function getChain(req, res, next) {
  try {
    const blocks = await blockchain.getChain();
    return res.status(200).json({
      count: blocks.length,
      blocks,
      chain: blocks,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/chain/validate
 */
async function validateChain(req, res, next) {
  try {
    const result = await blockchain.validateChain();
    return res.status(200).json({
      isValid: result.isValid,
      message: result.isValid
        ? 'All medical report blocks are valid. No integrity issues found.'
        : 'Integrity failure: one or more sealed blocks no longer match their hashes.',
      blocks: result.blocks,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/chain/repair — restore lab-corrupted blocks to sealed data
 */
async function repairChain(req, res, next) {
  try {
    const result = await blockchain.repairTamperedBlocks();
    return res.status(200).json({
      repaired: result.repaired,
      isValid: result.isValid,
      message: result.isValid
        ? result.repaired
          ? `Restored ${result.repaired} block(s). Chain integrity is healthy.`
          : 'Chain integrity is healthy. No repairs needed.'
        : `Restored ${result.repaired} block(s), but integrity issues remain. Contact support if this persists.`,
      blocks: result.blocks,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/chain/tamper/:blockIndex — security lab only (Admin)
 */
async function tamperBlock(req, res, next) {
  try {
    const block = await blockchain.tamperBlock(req.params.blockIndex);

    return res.status(200).json({
      message: `Block #${block.index} was altered without updating its seal. Run Integrity Check, then Repair Integrity to restore.`,
      block,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getChain,
  validateChain,
  repairChain,
  tamperBlock,
};
