const mongoose = require('mongoose');

const demoProgressSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global',
    },
    createProject: {
      type: Boolean,
      default: false,
    },
    sendRequest: {
      type: Boolean,
      default: false,
    },
    acceptRequest: {
      type: Boolean,
      default: false,
    },
    submitUpdate: {
      type: Boolean,
      default: false,
    },
    verifyWork: {
      type: Boolean,
      default: false,
    },
    openBlockchainProof: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DemoProgress', demoProgressSchema);
