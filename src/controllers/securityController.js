const Account = require('../models/Account');
const { getCurrentUser } = require('../utils/helpers');

// Security Center View
exports.getSecurity = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const tab = req.query.tab || 'overview';
    const allAccounts = await Account.find(user ? { userId: user._id } : {}).lean();

    const breachedAccounts = allAccounts.filter(a => a.isBreached);
    const highRiskAccounts = allAccounts.filter(a => ['high', 'critical'].includes(a.riskLevel));
    const inactiveAccounts = allAccounts.filter(a => a.activityStatus === 'inactive');
    const unknown2fa = allAccounts.filter(a => a.twoFaStatus === 'unknown' && ['Finance', 'Developer'].includes(a.category));

    // Security summary computed live from real user accounts
    const security = {
      overallScore: allAccounts.length === 0 ? null : Math.max(0, 100 - (breachedAccounts.length * 25) - (highRiskAccounts.length * 10)),
      breachedCount: breachedAccounts.length,
      highRiskCount: highRiskAccounts.length,
      inactiveCount: inactiveAccounts.length,
      unknown2faCount: unknown2fa.length,
    };

    res.render('security', {
      user,
      page: 'security',
      tab,
      security,
      breachedAccounts,
      highRiskAccounts,
      inactiveAccounts,
      unknown2fa,
      notifications: 0, // Real notifications coming in future phase
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
};
