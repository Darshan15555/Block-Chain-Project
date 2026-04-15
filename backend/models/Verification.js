const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      ref: 'Project',
    },
    updateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Update',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    verifiedBy: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['Work Done', 'Not Done'],
      required: true,
    },
    comment: {
      type: String,
      default: '',
      maxlength: 500,
    },
  },
  { timestamps: true }
);

verificationSchema.index({ userId: 1, updateId: 1 }, { unique: true });

module.exports = mongoose.model('Verification', verificationSchema);
