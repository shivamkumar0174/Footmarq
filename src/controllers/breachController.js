const Account = require('../models/Account');
const Breach = require('../models/Breach');
const { notificationsData } = require('../data/mockData');
const { getCurrentUser } = require('../utils/helpers');

// Breach Monitor View
exports.getBreaches = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const breaches = await Breach.find(user ? { userId: user._id } : {}).lean();
    const accounts = await Account.find(user ? { userId: user._id } : {}).lean();

    res.render('breaches', {
      user,
      page: 'breaches',
      breaches,
      accounts,
      notifications: notificationsData.filter(n => !n.read).length,
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
};
