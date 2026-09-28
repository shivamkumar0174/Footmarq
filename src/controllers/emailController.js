const EmailAccount = require('../models/EmailAccount');
const { notificationsData } = require('../data/mockData');
const { getCurrentUser } = require('../utils/helpers');

// Email Manager View
exports.getEmails = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const emails = await EmailAccount.find(user ? { userId: user._id } : {}).lean();

    res.render('emails', {
      user,
      page: 'emails',
      emails,
      notifications: notificationsData.filter(n => !n.read).length,
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
};
