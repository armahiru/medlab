const mongoose = require('mongoose');

/**
 * One document per blockchain block.
 * data holds the medical report transaction (or genesis payload).
 */
const blockSchema = new mongoose.Schema(
  {
    index: {
      type: Number,
      required: true,
      unique: true,
      min: 0,
    },
    timestamp: {
      type: String,
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    previousHash: {
      type: String,
      required: true,
    },
    hash: {
      type: String,
      required: true,
    },
    nonce: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('Block', blockSchema);
