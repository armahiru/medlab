const mongoose = require('mongoose');

const REPORT_TYPES = [
  'Lab Result',
  'Radiology',
  'Discharge Summary',
  'Prescription',
  'Pathology',
  'Operation Notes',
  'Other',
];

const DEPARTMENTS = [
  'Laboratory',
  'Radiology',
  'Cardiology',
  'Oncology',
  'General Medicine',
  'Emergency',
  'Surgery',
  'Pediatrics',
];

const reportSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      trim: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    reportType: {
      type: String,
      required: true,
      trim: true,
      enum: {
        values: REPORT_TYPES,
        message: 'Invalid report type',
      },
    },
    department: {
      type: String,
      required: true,
      trim: true,
      enum: {
        values: DEPARTMENTS,
        message: 'Invalid department',
      },
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    date: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      default: '',
    },
    fileHash: {
      type: String,
      required: true,
    },
    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    blockIndex: {
      type: Number,
      required: true,
    },
    blockHash: {
      type: String,
      required: true,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

reportSchema.index({ blockIndex: 1 });
reportSchema.index({ patientId: 1 });

module.exports = mongoose.model('Report', reportSchema);
module.exports.REPORT_TYPES = REPORT_TYPES;
module.exports.DEPARTMENTS = DEPARTMENTS;
