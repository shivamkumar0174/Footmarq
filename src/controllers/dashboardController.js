const Account = require('../models/Account');
const { notificationsData, accountTimelines } = require('../data/mockData');
const { getCurrentUser, getDashboardStats } = require('../utils/helpers');

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

    const stats = getDashboardStats(allAccounts);
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
      notifications: notificationsData.filter(n => !n.read).length,
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
    const timeline = accountTimelines[req.params.id] || [
      { type: 'signup', label: 'Account Created', date: account.firstSeen, icon: '🔵' }
    ];
    res.render('partials/account-detail', { account, timeline });
  } catch (err) {
    res.status(404).send('Account not found');
  }
};
