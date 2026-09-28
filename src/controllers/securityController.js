const Account = require('../models/Account');
const { securityData, notificationsData } = require('../data/mockData');
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

    res.render('security', {
      user,
      page: 'security',
      tab,
      security: securityData,
      breachedAccounts,
      highRiskAccounts,
      inactiveAccounts,
      unknown2fa,
      notifications: notificationsData.filter(n => !n.read).length,
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
};
