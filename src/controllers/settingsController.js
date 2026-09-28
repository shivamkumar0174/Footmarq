const EmailAccount = require('../models/EmailAccount');
const { notificationsData } = require('../data/mockData');
const { getCurrentUser } = require('../utils/helpers');

// Settings View
exports.getSettings = async (req, res) => {
  try {
    const user = (await getCurrentUser(req)) || {
      name: 'Guest User',
      email: 'guest@example.com',
      avatar: 'G',
      joinedDate: 'Recently',
      plan: 'Free'
    };
    const tab = req.query.tab || 'profile';
    const emails = await EmailAccount.find(user._id ? { userId: user._id } : {}).lean();

    res.render('settings', {
      user,
      page: 'settings',
      tab,
      emails,
      notifications: notificationsData.filter(n => !n.read).length,
    });
  } catch (err) {
    console.error('Settings Error:', err);
    res.status(500).send('Server Error');
  }
};

// Profile Update POST
exports.updateProfile = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (user) {
      if (req.body.name) user.name = req.body.name;
      if (req.body.email) user.email = req.body.email;
      await user.save();
    }
    res.redirect('/settings?tab=profile');
  } catch (err) {
    res.redirect('/settings?tab=profile');
  }
};
