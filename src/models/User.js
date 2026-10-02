const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: false },
  googleId: { type: String, unique: true, sparse: true },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  avatar: { type: String, default: 'SK' },
  avatarUrl: { type: String },
  googleTokens: {
    accessToken: { type: String },
    refreshToken: { type: String },
    expiryDate: { type: Number },
    scope: { type: String }
  },
  otpCode: { type: String },
  otpExpiresAt: { type: Date },
  plan: { type: String, enum: ['Free', 'Pro', 'Enterprise'], default: 'Free' },
  joinedDate: { type: String, default: 'September 2026' },
  deleteRequestedAt: { type: Date, default: null },
  lastBreachScanAt: { type: Date, default: null },
  settings: {
    twoFactorEnabled: { type: Boolean, default: true },
    darkWebMonitoring: { type: Boolean, default: true },
    monthlyReports: { type: Boolean, default: true },
    instantBreachAlerts: { type: Boolean, default: true },
    marketingEmails: { type: Boolean, default: false }
  },
  privacySettings: {
    allowAnalytics: { type: Boolean, default: false },
    allowBreachCheck: { type: Boolean, default: true },
    allowDigitalFootprint: { type: Boolean, default: true }
  },
  sessions: [{
    token:     { type: String, required: true },
    device:    { type: String, default: 'Unknown Device' },
    ip:        { type: String, default: '0.0.0.0' },
    location:  { type: String, default: 'Unknown' },
    loginAt:   { type: Date, default: Date.now },
    lastSeen:  { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
