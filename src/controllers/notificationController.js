const { notificationsData } = require('../data/mockData');
const { getCurrentUser } = require('../utils/helpers');

// Notifications View
exports.getNotifications = async (req, res) => {
  const user = await getCurrentUser(req);
  res.render('notifications', {
    user,
    page: 'notifications',
    notifications: notificationsData,
  });
};
