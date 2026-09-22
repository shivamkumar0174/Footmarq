const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  avatar: { type: String, default: 'SK' },
  plan: { type: String, enum: ['Free', 'Pro', 'Enterprise'], default: 'Free' },
  joinedDate: { type: String, default: 'September 2026' },
  settings: {
    twoFactorEnabled: { type: Boolean, default: true },
    darkWebMonitoring: { type: Boolean, default: true },
    monthlyReports: { type: Boolean, default: true },
    instantBreachAlerts: { type: Boolean, default: true },
    marketingEmails: { type: Boolean, default: false }
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
