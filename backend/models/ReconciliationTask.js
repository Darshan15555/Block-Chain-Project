const mongoose = require('mongoose');

const reconciliationTaskSchema = new mongoose.Schema(
  {
    operation: {
      type: String,
      enum: ['create_project', 'log_expense', 'release_funds', 'status_update'],
      required: true,
    },
    projectId: {
      type: String,
      default: null,
    },
    txHash: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    syncStatus: {
      type: String,
      enum: ['pending', 'synced', 'failed'],
      default: 'pending',
    },
    syncRetryCount: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
      default: null,
    },
    syncedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

reconciliationTaskSchema.index({ syncStatus: 1, createdAt: -1 });
reconciliationTaskSchema.index({ projectId: 1, operation: 1 });

module.exports = mongoose.model('ReconciliationTask', reconciliationTaskSchema);
