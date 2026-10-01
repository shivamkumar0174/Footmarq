const Account = require('../models/Account');
const { getCurrentUser } = require('../utils/helpers');

// Notification Model doesn't exist yet — notifications will be real-time in future.
// For now, notification count is always 0 for real users.

// Dashboard View
exports.getDashboard = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const category = req.query.category || 'all';
    const search = req.query.search || '';
    const sort = req.query.sort || 'lastActive';
    const view = req.query.view || 'grid';
    const riskFilter = req.query.risk || '';

    const allAccounts = await Account.find(user ? { userId: user._id } : {}).lean();
    let filtered = [...allAccounts];

    if (category !== 'all') {
      filtered = filtered.filter(a => a.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      filtered = filtered.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.domain.toLowerCase().includes(search.toLowerCase()));
    }
    if (riskFilter) {
      filtered = filtered.filter(a => a.riskLevel === riskFilter);
    }

    const stats = {
      total: allAccounts.length,
      breached: allAccounts.filter(a => a.isBreached).length,
      highRisk: allAccounts.filter(a => ['high', 'critical'].includes(a.riskLevel)).length,
      inactive: allAccounts.filter(a => a.activityStatus === 'inactive').length,
    };

    const categories = [...new Set(allAccounts.map(a => a.category))];

    res.render('dashboard', {
      user,
      page: 'dashboard',
      accounts: filtered,
      stats,
      categories,
      activeCategory: category,
      search,
      sort,
      view,
      riskFilter,
      notifications: 0, // Real notifications coming in future phase
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database Error');
  }
};

// Account Detail Modal/Partial
exports.getAccountDetail = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id).lean();
    if (!account) return res.status(404).send('Account not found');
    const timeline = [
      { type: 'signup', label: 'Account Created', date: account.firstSeen, icon: '🔵' }
    ];
    res.render('partials/account-detail', { account, timeline });
  } catch (err) {
    res.status(404).send('Account not found');
  }
};
