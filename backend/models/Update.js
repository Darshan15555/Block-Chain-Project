const mongoose = require('mongoose');

const updateSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      ref: 'Project',
    },
    contractorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    workDescription: {
      type: String,
      required: true,
      trim: true,
    },
    materialsUsed: {
      type: String,
      default: '',
    },
    workersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    amountSpent: {
      type: Number,
      required: true,
      min: 1,
    },
    submittedBy: {
      type: String,
      required: true,
    },
    blockchainTxHash: {
      type: String,
      default: null,
    },
    blockNumber: {
      type: Number,
      default: null,
    },
    dataHash: {
      type: String,
      default: null,
    },
    blockchainStatus: {
      type: String,
      enum: ['confirmed', 'failed', 'reconciliation_required'],
      default: 'confirmed',
    },
    photoPath: {
      type: String,
      default: null,
    },
    photoHash: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Update', updateSchema);
