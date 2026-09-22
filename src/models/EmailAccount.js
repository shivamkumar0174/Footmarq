const mongoose = require('mongoose');

const emailAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true },
  provider: { type: String, required: true },
  connected: { type: Boolean, default: true },
  lastScan: { type: String, default: 'Just now' },
  accountsFound: { type: Number, default: 0 },
  status: { type: String, default: 'connected' },
  avatar: { type: String, default: 'SK' }
}, { timestamps: true });

module.exports = mongoose.model('EmailAccount', emailAccountSchema);
