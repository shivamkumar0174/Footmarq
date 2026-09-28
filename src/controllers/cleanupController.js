const Account = require('../models/Account');
const { notificationsData } = require('../data/mockData');
const { getCurrentUser } = require('../utils/helpers');

// Cleanup Center View
exports.getCleanup = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const inactiveAccounts = await Account.find({
      ...(user ? { userId: user._id } : {}),
      activityStatus: 'inactive'
    }).lean();

    res.render('cleanup', {
      user,
      page: 'cleanup',
      accounts: inactiveAccounts,
      notifications: notificationsData.filter(n => !n.read).length,
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
};
