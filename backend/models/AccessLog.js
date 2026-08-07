const mongoose = require('mongoose');

/**
 * Lightweight distribution / verification access log.
 */
const accessLogSchema = new mongoose.Schema(
  {
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      required: true,
    },
    action: {
      type: String,
      enum: ['verify', 'view', 'download'],
      required: true,
    },
    result: {
      type: String,
      enum: ['authentic', 'tampered', 'not_found', 'success'],
      default: 'success',
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    ip: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AccessLog', accessLogSchema);
