const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['Road', 'School', 'Water Facility', 'Bridge', 'Hospital', 'Other'],
      required: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    totalFund: {
      type: Number,
      required: true,
      min: 1,
    },
    releasedFund: {
      type: Number,
      default: 0,
      min: 0,
    },
    spentFund: {
      type: Number,
      default: 0,
      min: 0,
    },
    contractor: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
      id: {
        type: String,
        required: true,
      },
    },
    status: {
      type: String,
      enum: ['Created', 'Active', 'Completed', 'Suspended'],
      default: 'Active',
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
      enum: ['confirmed', 'failed', 'reconciliation_required'],
      default: 'confirmed',
    },
    verificationCount: {
      workDone: { type: Number, default: 0 },
      notDone: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
