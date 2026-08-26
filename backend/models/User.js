const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['Admin', 'Uploader', 'Recipient'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ROLES,
        message: 'Role must be Admin, Uploader, or Recipient',
      },
      required: [true, 'Role is required'],
    },
    /**
     * Required for Recipient accounts — scopes reports/appointments to this patient only.
     */
    patientId: {
      type: String,
      trim: true,
      default: null,
    },
    /** Mobile number for SMS alerts (optional but recommended for patients) */
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    /** Firebase Auth uid (password reset / sign-in emails) */
    firebaseUid: {
      type: String,
      trim: true,
      default: '',
    },
    /** Profile photo filename under uploads/avatars (optional) */
    profileImage: {
      type: String,
      trim: true,
      default: '',
    },
    /** Password reset (hashed 6-digit code) */
    resetPasswordToken: {
      type: String,
      select: false,
      default: '',
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  }
);

userSchema.index(
  { patientId: 1 },
  {
    unique: true,
    partialFilterExpression: { patientId: { $type: 'string', $gt: '' } },
  }
);

userSchema.pre('validate', function requirePatientIdForRecipient(next) {
  if (this.role === 'Recipient' && !this.patientId) {
    this.invalidate('patientId', 'Patient ID is required for Recipient accounts.');
  }
  if (this.role !== 'Recipient') {
    this.patientId = this.patientId || null;
  }
  next();
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
