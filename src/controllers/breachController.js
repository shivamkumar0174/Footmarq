const Account = require('../models/Account');
const Breach = require('../models/Breach');
const { getCurrentUser } = require('../utils/helpers');
const breachService = require('../services/breachService');

function formatTimeAgo(date) {
  if (!date) return 'Never scanned';
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

// Breach Monitor View
exports.getBreaches = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.redirect('/login');
    }

    const filterStatus = req.query.status || 'unresolved'; // unresolved | resolved | all

    let breachQuery = { userId: user._id };
    if (filterStatus === 'unresolved') {
      breachQuery.resolved = false;
    } else if (filterStatus === 'resolved') {
      breachQuery.resolved = true;
    }

    const breaches = await Breach.find(breachQuery).sort({ createdAt: -1 }).lean();
    const allBreaches = await Breach.find({ userId: user._id }).lean();
    const accounts = await Account.find({ userId: user._id }).lean();

    const activeBreachesCount = allBreaches.filter(b => !b.resolved).length;
    const resolvedBreachesCount = allBreaches.filter(b => b.resolved).length;
    const affectedAccountsCount = accounts.filter(a => a.isBreached).length;

    const lastScanTimeFormatted = formatTimeAgo(user.lastBreachScanAt);

    res.render('breaches', {
      user,
      page: 'breaches',
      breaches,
      allBreachesCount: allBreaches.length,
      activeBreachesCount,
      resolvedBreachesCount,
      affectedAccountsCount,
      accounts,
      filterStatus,
      lastScanTimeFormatted,
      notifications: 0,
    });
  } catch (err) {
    console.error('Error rendering breach monitor:', err);
    res.status(500).send('Server Error');
  }
};

// Trigger Live Breach Scan
exports.triggerScan = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const scanStats = await breachService.executeBreachScan(user._id);

    return res.json({
      success: true,
      message: `Breach scan completed. ${scanStats.newBreachesFound} new alert(s) found.`,
      stats: scanStats
    });
  } catch (err) {
    console.error('Error performing breach scan:', err);
    return res.status(500).json({ success: false, error: err.message || 'Scan failed' });
  }
};

// Toggle or Mark Breach as Resolved
exports.resolveBreach = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const breachId = req.params.id;
    const resolveState = req.body.resolved !== undefined ? req.body.resolved : true;

    const updatedBreach = await breachService.setBreachResolved(user._id, breachId, resolveState);

    return res.json({
      success: true,
      message: updatedBreach.resolved ? 'Breach marked as reviewed & resolved' : 'Breach reopened',
      breach: updatedBreach
    });
  } catch (err) {
    console.error('Error resolving breach:', err);
    return res.status(500).json({ success: false, error: err.message || 'Action failed' });
  }
};

// Delete / Dismiss a Breach Alert
exports.deleteBreach = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const breachId = req.params.id;
    const breach = await Breach.findOneAndDelete({ _id: breachId, userId: user._id });

    if (!breach) {
      return res.status(404).json({ success: false, error: 'Breach alert not found' });
    }

    // Sync account status if attached
    if (breach.accountId) {
      const remainingUnresolved = await Breach.countDocuments({
        userId: user._id,
        accountId: breach.accountId,
        resolved: false
      });
      if (remainingUnresolved === 0) {
        await Account.updateOne({ _id: breach.accountId, userId: user._id }, { isBreached: false });
      }
    }

    return res.json({
      success: true,
      message: 'Breach alert dismissed'
    });
  } catch (err) {
    console.error('Error deleting breach:', err);
    return res.status(500).json({ success: false, error: err.message || 'Delete failed' });
  }
};
