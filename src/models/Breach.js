const mongoose = require('mongoose');

const breachSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  service: { type: String, required: true },
  email: { type: String, required: true },
  breachDate: { type: String, required: true },
  detectedDate: { type: String, required: true },
  dataTypes: [{ type: String }],
  description: { type: String, required: true },
  severity: { type: String, enum: ['critical', 'high', 'moderate', 'low'], default: 'high' },
  pwnCount: { type: String, default: 'Multiple' },
  resolved: { type: Boolean, default: false },
  userActionNeeded: { type: String, default: 'Change password on service immediately' }
}, { timestamps: true });

module.exports = mongoose.model('Breach', breachSchema);
