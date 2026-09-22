const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  email: { type: String, required: true },
  logo: { type: String, required: true },
  domain: { type: String, required: true },
  firstSeen: { type: String, default: 'Recently' },
  lastActive: { type: String, default: 'Recently' },
  riskLevel: { type: String, enum: ['low', 'moderate', 'high', 'critical'], default: 'low' },
  riskScore: { type: Number, default: 10 },
  isBreached: { type: Boolean, default: false },
  twoFaStatus: { type: String, enum: ['enabled', 'disabled', 'unknown', 'unsupported'], default: 'unknown' },
  activityStatus: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
