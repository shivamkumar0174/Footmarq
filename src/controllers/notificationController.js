const { getCurrentUser } = require('../utils/helpers');

// Notifications View — Real notifications will be fetched from DB in future phase
exports.getNotifications = async (req, res) => {
  const user = await getCurrentUser(req);
  res.render('notifications', {
    user,
    page: 'notifications',
    notifications: [], // Empty for now — real-time notifications coming in future phase
  });
};
