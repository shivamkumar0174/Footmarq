const Account = require('../models/Account');
const { getCurrentUser } = require('../utils/helpers');

// Security Center View
exports.getSecurity = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const tab = req.query.tab || 'overview';
    const allAccounts = await Account.find(user ? { userId: user._id } : {}).lean();

    const breachedAccounts = allAccounts.filter(a => a.isBreached);
    const highRiskAccounts = allAccounts.filter(a => ['high', 'critical'].includes(a.riskLevel));
    const inactiveAccounts = allAccounts.filter(a => a.activityStatus === 'inactive');
    const unknown2fa    = allAccounts.filter(a => a.twoFaStatus === 'unknown' && ['Finance', 'Developer'].includes(a.category));
    const enabled2fa    = allAccounts.filter(a => a.twoFaStatus === 'enabled');
    const disabled2fa   = allAccounts.filter(a => a.twoFaStatus === 'disabled');

    // ── Compute score & breakdown ──────────────────────────────
    const baseScore = 100;
    const deductions = [];

    if (breachedAccounts.length > 0) {
      const pts = Math.min(breachedAccounts.length * 25, 50);
      deductions.push({ reason: `${breachedAccounts.length} breached account(s)`, points: `-${pts}` });
    }
    if (highRiskAccounts.length > 0) {
      const pts = Math.min(highRiskAccounts.length * 10, 30);
      deductions.push({ reason: `${highRiskAccounts.length} high-risk account(s)`, points: `-${pts}` });
    }
    if (unknown2fa.length > 0) {
      const pts = Math.min(unknown2fa.length * 5, 20);
      deductions.push({ reason: `${unknown2fa.length} account(s) with unknown 2FA`, points: `-${pts}` });
    }

    const totalDeducted = deductions.reduce((sum, d) => sum + Math.abs(parseInt(d.points)), 0);
    const score = allAccounts.length === 0 ? null : Math.max(0, baseScore - totalDeducted);

    let label = 'Critical';
    if (score === null)        label = 'No Data';
    else if (score >= 85)      label = 'Excellent';
    else if (score >= 70)      label = 'Good';
    else if (score >= 50)      label = 'Moderate';
    else if (score >= 30)      label = 'At Risk';

    const lastUpdated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // ── Build priority issues list ─────────────────────────────
    const issues = [];

    if (breachedAccounts.length > 0) {
      issues.push({
        icon: '🚨',
        title: `${breachedAccounts.length} Breached Account${breachedAccounts.length > 1 ? 's' : ''} Detected`,
        description: 'Your credentials have appeared in a known data breach. Change passwords immediately.',
        priority: 'Critical',
        cta: 'View Breaches',
      });
    }
    if (highRiskAccounts.length > 0) {
      issues.push({
        icon: '⚠️',
        title: `${highRiskAccounts.length} High-Risk Account${highRiskAccounts.length > 1 ? 's' : ''}`,
        description: 'These accounts have elevated risk scores due to weak security posture.',
        priority: 'High',
        cta: 'View Risk Scores',
      });
    }
    if (inactiveAccounts.length > 0) {
      issues.push({
        icon: '💤',
        title: `${inactiveAccounts.length} Inactive Account${inactiveAccounts.length > 1 ? 's' : ''}`,
        description: 'Old unused accounts are a security liability. Consider deleting them.',
        priority: 'Medium',
        cta: 'Cleanup Now',
      });
    }
    if (unknown2fa.length > 0) {
      issues.push({
        icon: '🔑',
        title: `${unknown2fa.length} Account${unknown2fa.length > 1 ? 's' : ''} with Unknown 2FA`,
        description: 'Enable two-factor authentication on Finance and Developer accounts.',
        priority: 'Medium',
        cta: 'View Risk Scores',
      });
    }
    if (issues.length === 0) {
      issues.push({
        icon: '✅',
        title: 'No Critical Issues Found',
        description: 'Your accounts look healthy. Keep monitoring regularly.',
        priority: 'Low',
        cta: 'View Risk Scores',
      });
    }

    const security = {
      score:         score === null ? '—' : score,
      label,
      lastUpdated,
      overallScore:  score,
      breachedCount: breachedAccounts.length,
      highRiskCount: highRiskAccounts.length,
      inactiveCount: inactiveAccounts.length,
      unknown2faCount: unknown2fa.length,
      breakdown: {
        base: `+${baseScore}`,
        deductions,
      },
      issues,
    };

    res.render('security', {
      user,
      page: 'security',
      tab,
      security,
      breachedAccounts,
      highRiskAccounts,
      inactiveAccounts,
      unknown2fa,
      enabled2fa,
      disabled2fa,
      notifications: 0,
    });
  } catch (err) {
    console.error('Security controller error:', err);
    res.status(500).send('Server Error');
  }
};
