const mongoose = require('mongoose');

const emailAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true, lowercase: true, trim: true },

  // Identity flags
  isPrimary: { type: Boolean, default: false },
  provider: { type: String, default: 'Other' }, // Gmail | Outlook | Yahoo | Other

  // Verification
  isVerified: { type: Boolean, default: false },
  verificationOtp: { type: String, default: null },
  verificationOtpExpiresAt: { type: Date, default: null },
  otpAttempts: { type: Number, default: 0 },

  // Gmail OAuth tokens (AES-encrypted at rest via helper)
  gmailConnected: { type: Boolean, default: false },
  gmailAccessToken: { type: String, default: null },
  gmailRefreshToken: { type: String, default: null },
  gmailTokenExpiresAt: { type: Date, default: null },
  gmailScopes: [{ type: String }],

  // Scan state
  scanStatus: {
    type: String,
    enum: ['never_scanned', 'queued', 'scanning', 'completed', 'error', 'auth_error'],
    default: 'never_scanned'
  },
  lastScanAt: { type: Date, default: null },
  totalAccountsDiscovered: { type: Number, default: 0 },

  // Privacy controls
  autoScanEnabled: { type: Boolean, default: true },
  scanFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'manual'], default: 'weekly' },
  includeInBreachCheck: { type: Boolean, default: true },
  includeInDigitalFootprint: { type: Boolean, default: true },
  shareInAnalytics: { type: Boolean, default: false },

  // Legacy / display fields
  avatar: { type: String, default: 'U' }
}, { timestamps: true });

emailAccountSchema.index({ userId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('EmailAccount', emailAccountSchema);
