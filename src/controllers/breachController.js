const Account = require('../models/Account');
const Breach = require('../models/Breach');
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
      notifications: 0, // Real notifications coming in future phase
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
};
