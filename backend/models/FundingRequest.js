const mongoose = require('mongoose');

const fundingRequestSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      ref: 'Project',
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
    },
    contractorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    contractorName: {
      type: String,
      required: true,
      trim: true,
    },
    authorityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorityName: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    note: {
      type: String,
      default: '',
      maxlength: 500,
      trim: true,
    },
    initiatedBy: {
      type: String,
      enum: ['authority', 'contractor'],
      default: 'authority',
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'released', 'rejected'],
      default: 'pending',
    },
    responseNote: {
      type: String,
      default: '',
      maxlength: 500,
      trim: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    releasedAt: {
      type: Date,
      default: null,
    },
    blockchainTxHash: {
      type: String,
      default: null,
    },
    blockNumber: {
      type: Number,
      default: null,
    },
    blockchainStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'failed', 'reconciliation_required'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

fundingRequestSchema.index({ contractorId: 1, status: 1, createdAt: -1 });
fundingRequestSchema.index({ authorityId: 1, createdAt: -1 });

module.exports = mongoose.model('FundingRequest', fundingRequestSchema);
