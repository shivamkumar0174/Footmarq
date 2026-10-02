const EmailAccount = require('../models/EmailAccount');
const User = require('../models/User');
const { getCurrentUser } = require('../utils/helpers');
const { formatRelativeTime, maskIp } = require('../utils/sessionUtils');

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

    // Build real sessions list
    const currentToken = req.cookies.sessionToken || null;
    const rawSessions = user.sessions
      ? [...user.sessions].sort((a, b) => new Date(b.loginAt) - new Date(a.loginAt))
      : [];

    const sessions = rawSessions.map(s => ({
      id: s._id.toString(),
      device: s.device || 'Unknown Device',
      ip: maskIp(s.ip),
      location: s.location || 'Unknown',
      time: formatRelativeTime(s.loginAt),
      current: s.token === currentToken
    }));

    // Privacy data
    const connectedGmails = emails.filter(e => e.gmailConnected);
    const privacySettings = user.privacySettings || {
      allowAnalytics: false,
      allowBreachCheck: true,
      allowDigitalFootprint: true
    };

    // Deletion deadline (30 days from request)
    let deletionDeadline = null;
    if (user.deleteRequestedAt) {
      const d = new Date(user.deleteRequestedAt);
      d.setDate(d.getDate() + 30);
      deletionDeadline = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    // Flash messages from redirects
    const flashMsg = req.query.msg || null;
    const flashErr = req.query.err || null;

    res.render('settings', {
      user,
      page: 'settings',
      tab,
      emails,
      sessions,
      notifications: 0,
      connectedGmails,
      privacySettings,
      deletionDeadline,
      deleteRequestedAt: user.deleteRequestedAt || null,
      flashMsg,
      flashErr
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
    if (!user) {
      return res.redirect('/login');
    }

    const { name, email } = req.body;
    let emailChanged = false;

    if (name && name.trim()) {
      user.name = name.trim();
      const initials = user.name
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .toUpperCase();
      if (initials) {
        user.avatar = initials;
      }
    }

    if (email && email.trim() && email.toLowerCase().trim() !== user.email) {
      const newEmail = email.toLowerCase().trim();
      const existingUser = await User.findOne({ email: newEmail, _id: { $ne: user._id } });
      if (existingUser) {
        return res.redirect('/settings?tab=profile&err=email_in_use');
      }

      // Update primary EmailAccount record if exists
      await EmailAccount.findOneAndUpdate(
        { userId: user._id, email: user.email },
        { email: newEmail }
      );

      user.email = newEmail;
      emailChanged = true;
    }

    await user.save();

    if (emailChanged) {
      res.cookie('userEmail', user.email, { httpOnly: true, secure: true, sameSite: 'lax' });
    }

    return res.redirect('/settings?tab=profile&msg=profile_updated');
  } catch (err) {
    console.error('Update profile error:', err);
    return res.redirect('/settings?tab=profile&err=profile_failed');
  }
};

// Change Password POST
exports.updatePassword = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.redirect('/login');
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.redirect('/settings?tab=security&err=password_short');
    }

    if (newPassword !== confirmPassword) {
      return res.redirect('/settings?tab=security&err=password_mismatch');
    }

    // If user already has a password set, verify currentPassword
    if (user.password) {
      if (!currentPassword || currentPassword !== currentPassword) {
        // verify against user.password
      }
      if (!currentPassword || currentPassword !== user.password) {
        return res.redirect('/settings?tab=security&err=invalid_current_password');
      }
    }

    user.password = newPassword;
    await user.save();

    return res.redirect('/settings?tab=security&msg=password_updated');
  } catch (err) {
    console.error('Update password error:', err);
    return res.redirect('/settings?tab=security&err=password_failed');
  }
};

// Toggle 2FA POST
exports.toggle2FA = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.redirect('/login');
    }

    if (!user.settings) {
      user.settings = {};
    }

    const is2faEnabled = user.settings.twoFactorEnabled ?? true;
    user.settings.twoFactorEnabled = !is2faEnabled;
    await user.save();

    const msg = user.settings.twoFactorEnabled ? '2fa_enabled' : '2fa_disabled';
    return res.redirect(`/settings?tab=security&msg=${msg}`);
  } catch (err) {
    console.error('Toggle 2FA error:', err);
    return res.redirect('/settings?tab=security&err=2fa_failed');
  }
};

// Terminate a single session by its MongoDB _id
exports.terminateSession = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const currentToken = req.cookies.sessionToken || null;

    if (user) {
      const session = user.sessions.id(req.params.id);
      // Prevent terminating the current session via this endpoint
      if (session && session.token !== currentToken) {
        user.sessions.pull({ _id: req.params.id });
        await user.save();
      }
    }
  } catch (err) {
    console.error('Terminate session error:', err);
  }
  res.redirect('/settings?tab=sessions');
};

// Terminate ALL sessions except the current one
exports.terminateAllSessions = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const currentToken = req.cookies.sessionToken || null;

    if (user) {
      user.sessions = user.sessions.filter(s => s.token === currentToken);
      await user.save();
    }
  } catch (err) {
    console.error('Terminate all sessions error:', err);
  }
  res.redirect('/settings?tab=sessions');
};

