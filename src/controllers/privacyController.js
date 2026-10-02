const User = require('../models/User');
const EmailAccount = require('../models/EmailAccount');
const EmailScan = require('../models/EmailScan');
const Account = require('../models/Account');
const Breach = require('../models/Breach');
const { getCurrentUser } = require('../utils/helpers');
const { sendDataExportEmail, sendAccountDeletionEmail } = require('../services/emailService');

// ── Helper: Build full export payload ──────────────────────────────────────
async function buildExportPayload(user) {
  const emails = await EmailAccount.find({ userId: user._id }).lean();
  const accounts = await Account.find({ userId: user._id }).lean();
  const breaches = await Breach.find({ userId: user._id }).lean();
  const scans = await EmailScan.find({ userId: user._id }).lean();

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      name: user.name,
      email: user.email,
      plan: user.plan,
      joinedDate: user.joinedDate,
      authProvider: user.authProvider,
      privacySettings: user.privacySettings || {}
    },
    emailAccounts: emails.map(e => ({
      email: e.email,
      provider: e.provider,
      isPrimary: e.isPrimary,
      isVerified: e.isVerified,
      gmailConnected: e.gmailConnected,
      scanStatus: e.scanStatus,
      lastScanAt: e.lastScanAt,
      totalAccountsDiscovered: e.totalAccountsDiscovered,
      autoScanEnabled: e.autoScanEnabled,
      scanFrequency: e.scanFrequency
    })),
    discoveredAccounts: accounts.map(a => ({
      name: a.name,
      category: a.category,
      email: a.email,
      domain: a.domain,
      riskLevel: a.riskLevel,
      isBreached: a.isBreached,
      twoFaStatus: a.twoFaStatus,
      activityStatus: a.activityStatus,
      firstSeen: a.firstSeen,
      lastActive: a.lastActive
    })),
    breachHistory: breaches.map(b => ({
      service: b.service,
      email: b.email,
      breachDate: b.breachDate,
      detectedDate: b.detectedDate,
      dataTypes: b.dataTypes,
      description: b.description,
      severity: b.severity,
      pwnCount: b.pwnCount,
      resolved: b.resolved
    })),
    scanHistory: scans.map(s => ({
      status: s.status,
      trigger: s.trigger,
      emailsProcessed: s.emailsProcessed,
      accountsDiscovered: s.accountsDiscovered,
      startedAt: s.startedAt,
      completedAt: s.completedAt
    })),
    sessions: (user.sessions || []).map(s => ({
      device: s.device,
      location: s.location,
      loginAt: s.loginAt,
      lastSeen: s.lastSeen
    }))
  };
}

// ── POST /settings/privacy/export ─────────────────────────────────────────
exports.exportData = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.redirect('/login');

    const payload = await buildExportPayload(user);
    const exportJson = JSON.stringify(payload, null, 2);

    // Send via email (async — don't block response)
    sendDataExportEmail(user.email, user.name, exportJson).catch(err =>
      console.error('Export email error:', err)
    );

    // Also allow direct JSON download in browser
    if (req.query.download === '1') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="footmarq-export-${Date.now()}.json"`);
      return res.send(exportJson);
    }

    res.redirect('/settings?tab=privacy&msg=export_sent');
  } catch (err) {
    console.error('Export error:', err);
    res.redirect('/settings?tab=privacy&err=export_failed');
  }
};

// ── POST /settings/privacy/disconnect-gmail ───────────────────────────────
exports.disconnectGmail = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.redirect('/login');

    const { emailId } = req.body;

    if (emailId) {
      // Disconnect a specific email account
      const emailAcc = await EmailAccount.findOne({ _id: emailId, userId: user._id });
      if (emailAcc && emailAcc.gmailConnected) {
        emailAcc.gmailConnected = false;
        emailAcc.gmailAccessToken = null;
        emailAcc.gmailRefreshToken = null;
        emailAcc.gmailTokenExpiresAt = null;
        emailAcc.gmailScopes = [];
        emailAcc.scanStatus = 'never_scanned';
        await emailAcc.save();
      }
    } else {
      // Disconnect ALL gmail-connected email accounts
      await EmailAccount.updateMany(
        { userId: user._id, gmailConnected: true },
        {
          $set: {
            gmailConnected: false,
            gmailAccessToken: null,
            gmailRefreshToken: null,
            gmailTokenExpiresAt: null,
            gmailScopes: [],
            scanStatus: 'never_scanned'
          }
        }
      );

      // Also wipe Google tokens from user document
      if (user.googleTokens) {
        user.googleTokens = {
          accessToken: null,
          refreshToken: null,
          expiryDate: null,
          scope: null
        };
        await user.save();
      }
    }

    res.redirect('/settings?tab=privacy&msg=gmail_disconnected');
  } catch (err) {
    console.error('Gmail disconnect error:', err);
    res.redirect('/settings?tab=privacy&err=disconnect_failed');
  }
};

// ── POST /settings/privacy/delete-account ─────────────────────────────────
exports.requestDeleteAccount = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.redirect('/login');

    // Schedule deletion 30 days from now
    const deleteAt = new Date();
    deleteAt.setDate(deleteAt.getDate() + 30);

    user.deleteRequestedAt = new Date();
    await user.save();

    const deadline = deleteAt.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    // Send confirmation email (async)
    sendAccountDeletionEmail(user.email, user.name, deadline).catch(err =>
      console.error('Deletion email error:', err)
    );

    res.redirect('/settings?tab=privacy&msg=deletion_scheduled');
  } catch (err) {
    console.error('Delete account request error:', err);
    res.redirect('/settings?tab=privacy&err=delete_failed');
  }
};

// ── POST /settings/privacy/cancel-deletion ────────────────────────────────
exports.cancelDeleteAccount = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.redirect('/login');

    user.deleteRequestedAt = null;
    await user.save();

    res.redirect('/settings?tab=privacy&msg=deletion_cancelled');
  } catch (err) {
    console.error('Cancel deletion error:', err);
    res.redirect('/settings?tab=privacy&err=cancel_failed');
  }
};

// ── POST /settings/privacy/preferences ───────────────────────────────────
exports.updatePrivacyPreferences = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.redirect('/login');

    if (!user.privacySettings) user.privacySettings = {};

    user.privacySettings.allowAnalytics      = req.body.allowAnalytics === 'on';
    user.privacySettings.allowBreachCheck     = req.body.allowBreachCheck === 'on';
    user.privacySettings.allowDigitalFootprint = req.body.allowDigitalFootprint === 'on';

    user.markModified('privacySettings');
    await user.save();

    res.redirect('/settings?tab=privacy&msg=prefs_saved');
  } catch (err) {
    console.error('Privacy prefs error:', err);
    res.redirect('/settings?tab=privacy&err=prefs_failed');
  }
};
