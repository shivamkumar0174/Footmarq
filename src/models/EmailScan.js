const mongoose = require('mongoose');

const emailScanSchema = new mongoose.Schema({
  emailAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmailAccount',
    required: true
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Status
  status: {
    type: String,
    enum: ['queued', 'in_progress', 'completed', 'failed', 'auth_error'],
    default: 'queued'
  },
  trigger: {
    type: String,
    enum: ['manual', 'scheduled', 'initial'],
    default: 'manual'
  },

  // Progress tracking
  emailsProcessed: { type: Number, default: 0 },
  accountsDiscovered: { type: Number, default: 0 },
  accountsUpdated: { type: Number, default: 0 },

  // Checkpoint for crash resilience (saves nextPageToken mid-scan)
  lastPageToken: { type: String, default: null },

  // Error tracking
  errorMessage: { type: String, default: null },

  // Timing
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('EmailScan', emailScanSchema);
