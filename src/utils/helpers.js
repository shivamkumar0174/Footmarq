const User = require('../models/User');

/**
 * Helper to fetch logged in user from cookie
 */
async function getCurrentUser(req) {
  if (!req || !req.cookies || !req.cookies.userEmail) {
    return null;
  }
  const user = await User.findOne({ email: req.cookies.userEmail.toLowerCase().trim() });
  return user || null;
}

/**
 * Helper to calculate statistics for dashboard
 */
function getDashboardStats(accounts) {
  return {
    total: accounts.length,
    breached: accounts.filter(a => a.isBreached).length,
    highRisk: accounts.filter(a => ['high', 'critical'].includes(a.riskLevel)).length,
    inactive: accounts.filter(a => a.activityStatus === 'inactive').length,
  };
}

module.exports = {
  getCurrentUser,
  getDashboardStats,
};
