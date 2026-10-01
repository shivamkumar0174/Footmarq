const Account = require('../models/Account');
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
      notifications: 0, // Real notifications coming in future phase
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
};
