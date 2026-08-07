const mongoose = require('mongoose');

const STATUSES = ['Scheduled', 'Completed', 'Cancelled'];

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: [true, 'Patient ID is required'],
      trim: true,
    },
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    date: {
      type: String,
      required: [true, 'Appointment date is required'],
    },
    time: {
      type: String,
      required: [true, 'Appointment time is required'],
    },
    reason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'Scheduled',
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

appointmentSchema.index({ date: 1, time: 1 });
appointmentSchema.index({ doctor: 1, date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
module.exports.STATUSES = STATUSES;
