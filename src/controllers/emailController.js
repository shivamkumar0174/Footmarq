const crypto = require('crypto');
const EmailAccount = require('../models/EmailAccount');
const EmailScan = require('../models/EmailScan');
const { getCurrentUser } = require('../utils/helpers');
const { sendEmailVerificationOtp } = require('../services/emailService');
const { getGmailConnectUrl, handleGmailConnectCallback } = require('../config/googleOAuth');

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Plan-based email limit: Free = 1, Pro/Enterprise = 5 */
function getPlanLimit(user) {
  const plan = (user && user.plan) ? user.plan : 'Free';
  if (plan === 'Pro' || plan === 'Enterprise') return 5;
  return 1; // Free tier
}

/** Detect provider from email domain */
function detectProvider(email) {
  const domain = email.split('@')[1] || '';
  if (domain.includes('gmail')) return 'Gmail';
  if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live')) return 'Outlook';
  if (domain.includes('yahoo')) return 'Yahoo';
  if (domain.includes('icloud') || domain.includes('apple')) return 'iCloud';
  if (domain.includes('proton')) return 'ProtonMail';
  return 'Other';
}

/** Generate a 6-digit numeric OTP */
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Format scan duration for display */
function formatScanStatus(emailAcc) {
  if (!emailAcc.gmailConnected) return null;
  if (emailAcc.scanStatus === 'never_scanned') return 'Never scanned';
  if (emailAcc.scanStatus === 'scanning') return 'Scan in progress…';
  if (emailAcc.scanStatus === 'queued') return 'Scan queued…';
  if (emailAcc.scanStatus === 'error') return 'Scan failed';
  if (emailAcc.lastScanAt) {
    const diffMs = Date.now() - new Date(emailAcc.lastScanAt).getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 1) return 'Last scan < 1 hour ago';
    if (diffHours < 24) return `Last scan ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Last scan ${diffDays}d ago`;
  }
  return 'Completed';
}

// ── PAGE: Email Manager ──────────────────────────────────────────────────────
exports.getEmails = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.redirect('/login');

    const emails = await EmailAccount.find({ userId: user._id }).sort({ isPrimary: -1, createdAt: 1 }).lean();

    // Attach formatted scan status to each email
    const enriched = emails.map(e => ({
      ...e,
      scanStatusLabel: formatScanStatus(e),
      isGmail: e.provider === 'Gmail',
      canConnectGmail: e.isVerified && e.provider === 'Gmail' && !e.gmailConnected
    }));

    const maxEmails = getPlanLimit(user);
    const isFreePlan = !user.plan || user.plan === 'Free';

    res.render('emails', {
      user,
      page: 'emails',
      emails: enriched,
      notifications: 0,
      canAddMore: emails.length < maxEmails,
      maxEmails,
      isFreePlan,
      flashError: req.query.error || null,
      flashSuccess: req.query.success || null
    });
  } catch (err) {
    console.error('getEmails error:', err);
    res.status(500).send('Server Error');
  }
};

// ── API: Add a new email address ─────────────────────────────────────────────
exports.addEmail = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const email = (req.body.email || '').toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    // Duplicate check: not their primary, not already added
    if (email === user.email.toLowerCase()) {
      return res.status(400).json({ error: 'This is already your primary account email.' });
    }

    const existing = await EmailAccount.findOne({ userId: user._id, email });
    if (existing) {
      return res.status(400).json({ error: 'This email is already added to your account.' });
    }

    // Plan-based limit check
    const maxAllowed = getPlanLimit(user);
    const count = await EmailAccount.countDocuments({ userId: user._id });
    if (count >= maxAllowed) {
      const isPro = user.plan === 'Pro' || user.plan === 'Enterprise';
      if (!isPro) {
        return res.status(403).json({
          error: 'Free plan allows only 1 email address. Upgrade to Pro to manage up to 5 email addresses.',
          upgradeRequired: true
        });
      }
      return res.status(400).json({ error: `You can add a maximum of ${maxAllowed} email addresses.` });
    }

    // Generate and send OTP
    const otp = generateOtp();
    const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';

    const emailAccount = await EmailAccount.create({
      userId: user._id,
      email,
      provider: detectProvider(email),
      isPrimary: false,
      isVerified: false,
      verificationOtp: otp,
      verificationOtpExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      otpAttempts: 0,
      avatar: initials
    });

    await sendEmailVerificationOtp(email, otp);

    return res.json({
      success: true,
      message: `Verification code sent to ${email}. It expires in 15 minutes.`,
      emailId: emailAccount._id.toString()
    });
  } catch (err) {
    console.error('addEmail error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};

// ── API: Verify OTP for secondary email ──────────────────────────────────────
exports.verifyEmailOtp = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { emailId } = req.params;
    const otp = (req.body.otp || '').trim();

    const emailAccount = await EmailAccount.findOne({ _id: emailId, userId: user._id });
    if (!emailAccount) return res.status(404).json({ error: 'Email not found.' });

    if (emailAccount.isVerified) {
      return res.json({ success: true, message: 'Email is already verified.' });
    }

    // Attempt limit (max 5 attempts)
    if (emailAccount.otpAttempts >= 5) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
    }

    if (!emailAccount.verificationOtp || !emailAccount.verificationOtpExpiresAt) {
      return res.status(400).json({ error: 'No active verification code. Please request a new one.' });
    }

    if (new Date() > emailAccount.verificationOtpExpiresAt) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (emailAccount.verificationOtp !== otp) {
      emailAccount.otpAttempts += 1;
      await emailAccount.save();
      const remaining = 5 - emailAccount.otpAttempts;
      return res.status(400).json({ error: `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` });
    }

    // OTP is correct — mark as verified
    emailAccount.isVerified = true;
    emailAccount.verificationOtp = null;
    emailAccount.verificationOtpExpiresAt = null;
    emailAccount.otpAttempts = 0;
    await emailAccount.save();

    return res.json({
      success: true,
      message: 'Email verified successfully!',
      isGmail: emailAccount.provider === 'Gmail'
    });
  } catch (err) {
    console.error('verifyEmailOtp error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};

// ── API: Resend OTP for secondary email ──────────────────────────────────────
exports.resendEmailOtp = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { emailId } = req.params;
    const emailAccount = await EmailAccount.findOne({ _id: emailId, userId: user._id });
    if (!emailAccount) return res.status(404).json({ error: 'Email not found.' });
    if (emailAccount.isVerified) return res.json({ success: true, message: 'Email is already verified.' });

    const otp = generateOtp();
    emailAccount.verificationOtp = otp;
    emailAccount.verificationOtpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    emailAccount.otpAttempts = 0;
    await emailAccount.save();

    await sendEmailVerificationOtp(emailAccount.email, otp);
    return res.json({ success: true, message: 'A new verification code has been sent.' });
  } catch (err) {
    console.error('resendEmailOtp error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
};

// ── API: Delete an email address ─────────────────────────────────────────────
exports.deleteEmail = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { emailId } = req.params;
    const emailAccount = await EmailAccount.findOne({ _id: emailId, userId: user._id });
    if (!emailAccount) return res.status(404).json({ error: 'Email not found.' });

    if (emailAccount.isPrimary) {
      return res.status(400).json({ error: 'Cannot remove your primary email. Change your primary email first.' });
    }

    // If Gmail was connected, we should revoke token at Google
    if (emailAccount.gmailConnected && emailAccount.gmailAccessToken) {
      try {
        const { getGmailOAuth2Client } = require('../config/googleOAuth');
        const client = getGmailOAuth2Client();
        if (client) {
          client.setCredentials({ access_token: emailAccount.gmailAccessToken });
          await client.revokeToken(emailAccount.gmailAccessToken);
        }
      } catch (revokeErr) {
        console.warn('Gmail token revoke during delete failed (continuing):', revokeErr.message);
      }
    }

    // Delete scan history
    await EmailScan.deleteMany({ emailAccountId: emailAccount._id });

    await emailAccount.deleteOne();
    return res.json({ success: true, message: 'Email removed from your account.' });
  } catch (err) {
    console.error('deleteEmail error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
};

// ── API: Update per-email privacy settings ───────────────────────────────────
exports.updateEmailSettings = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { emailId } = req.params;
    const { autoScanEnabled, scanFrequency, includeInBreachCheck, includeInDigitalFootprint } = req.body;

    const emailAccount = await EmailAccount.findOne({ _id: emailId, userId: user._id });
    if (!emailAccount) return res.status(404).json({ error: 'Email not found.' });

    if (autoScanEnabled !== undefined) emailAccount.autoScanEnabled = Boolean(autoScanEnabled);
    if (scanFrequency && ['daily', 'weekly', 'monthly', 'manual'].includes(scanFrequency)) {
      emailAccount.scanFrequency = scanFrequency;
    }
    if (includeInBreachCheck !== undefined) emailAccount.includeInBreachCheck = Boolean(includeInBreachCheck);
    if (includeInDigitalFootprint !== undefined) emailAccount.includeInDigitalFootprint = Boolean(includeInDigitalFootprint);

    await emailAccount.save();
    return res.json({ success: true, message: 'Settings updated.' });
  } catch (err) {
    console.error('updateEmailSettings error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
};

// ── GMAIL CONNECT: Step 1 — Redirect to Google consent ───────────────────────
exports.connectGmail = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.redirect('/login');

    const { emailId } = req.params;
    const emailAccount = await EmailAccount.findOne({ _id: emailId, userId: user._id });

    if (!emailAccount) return res.redirect('/emails?error=Email+not+found');
    if (!emailAccount.isVerified) return res.redirect('/emails?error=Please+verify+your+email+first');
    if (emailAccount.provider !== 'Gmail') return res.redirect('/emails?error=Only+Gmail+addresses+can+be+connected');
    if (emailAccount.gmailConnected) return res.redirect('/emails?error=Gmail+already+connected');

    // Generate CSRF state token and store in a temp cookie
    const csrfToken = crypto.randomBytes(24).toString('hex');
    const statePayload = JSON.stringify({ emailAccountId: emailId, csrf: csrfToken });

    res.cookie('gmail_oauth_state', csrfToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000 // 10 minutes
    });

    const authUrl = getGmailConnectUrl(emailId, csrfToken);
    if (!authUrl) {
      return res.redirect('/emails?error=Google+OAuth+not+configured+on+this+server');
    }

    res.redirect(authUrl);
  } catch (err) {
    console.error('connectGmail error:', err);
    res.redirect('/emails?error=Failed+to+start+Gmail+connect');
  }
};

// ── GMAIL CONNECT: Step 2 — Handle OAuth callback ────────────────────────────
exports.gmailConnectCallback = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.redirect('/login');

    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      console.warn('Gmail connect denied by user:', oauthError);
      return res.redirect('/emails?error=Gmail+connection+was+cancelled');
    }

    if (!code || !state) {
      return res.redirect('/emails?error=Invalid+OAuth+response');
    }

    // Parse and validate CSRF state
    let parsedState;
    try {
      parsedState = JSON.parse(state);
    } catch {
      return res.redirect('/emails?error=Invalid+OAuth+state');
    }

    const storedCsrf = req.cookies && req.cookies.gmail_oauth_state;
    if (!storedCsrf || storedCsrf !== parsedState.csrf) {
      return res.redirect('/emails?error=Security+check+failed.+Please+try+again.');
    }

    const { emailAccountId } = parsedState;
    const emailAccount = await EmailAccount.findOne({ _id: emailAccountId, userId: user._id });
    if (!emailAccount) return res.redirect('/emails?error=Email+account+not+found');

    // Exchange code for tokens
    const tokens = await handleGmailConnectCallback(code);

    // Store tokens on the email account
    emailAccount.gmailConnected = true;
    emailAccount.gmailAccessToken = tokens.accessToken;
    emailAccount.gmailRefreshToken = tokens.refreshToken || emailAccount.gmailRefreshToken;
    emailAccount.gmailTokenExpiresAt = tokens.expiryDate ? new Date(tokens.expiryDate) : null;
    emailAccount.gmailScopes = tokens.scopes;
    emailAccount.scanStatus = 'queued';
    await emailAccount.save();

    // Clear CSRF cookie
    res.clearCookie('gmail_oauth_state');

    // NOTE: Actual Gmail scan job would be enqueued here with BullMQ in Phase 4.
    // For now, mark status as queued to be picked up later.
    console.log(`✅ Gmail connected for ${emailAccount.email} — scan queued.`);

    res.redirect('/emails?success=Gmail+connected+successfully!+Your+inbox+scan+has+been+queued.');
  } catch (err) {
    console.error('gmailConnectCallback error:', err);
    res.redirect('/emails?error=Gmail+connection+failed.+Please+try+again.');
  }
};

// ── API: Disconnect Gmail ─────────────────────────────────────────────────────
exports.disconnectGmail = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { emailId } = req.params;
    const emailAccount = await EmailAccount.findOne({ _id: emailId, userId: user._id });
    if (!emailAccount) return res.status(404).json({ error: 'Email not found.' });
    if (!emailAccount.gmailConnected) return res.json({ success: true, message: 'Gmail not connected.' });

    // Revoke token at Google (best-effort)
    if (emailAccount.gmailAccessToken) {
      try {
        const { getGmailOAuth2Client } = require('../config/googleOAuth');
        const client = getGmailOAuth2Client();
        if (client) {
          client.setCredentials({ access_token: emailAccount.gmailAccessToken });
          await client.revokeToken(emailAccount.gmailAccessToken);
          console.log(`🔓 Gmail token revoked for ${emailAccount.email}`);
        }
      } catch (revokeErr) {
        // Per plan: always honour disconnect even if revocation API fails
        console.warn('Gmail revoke API failed (proceeding with local disconnect):', revokeErr.message);
      }
    }

    // Clear tokens locally — user intent ALWAYS honoured
    emailAccount.gmailConnected = false;
    emailAccount.gmailAccessToken = null;
    emailAccount.gmailRefreshToken = null;
    emailAccount.gmailTokenExpiresAt = null;
    emailAccount.gmailScopes = [];
    emailAccount.scanStatus = 'never_scanned';
    await emailAccount.save();

    return res.json({ success: true, message: 'Gmail disconnected. Your discovered accounts are preserved.' });
  } catch (err) {
    console.error('disconnectGmail error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
};

// ── API: Trigger a manual Gmail scan ─────────────────────────────────────────
exports.triggerScan = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { emailId } = req.params;
    const emailAccount = await EmailAccount.findOne({ _id: emailId, userId: user._id });
    if (!emailAccount) return res.status(404).json({ error: 'Email not found.' });
    if (!emailAccount.gmailConnected) return res.status(400).json({ error: 'Gmail not connected for this email.' });
    if (emailAccount.scanStatus === 'scanning' || emailAccount.scanStatus === 'queued') {
      return res.status(400).json({ error: 'A scan is already in progress.' });
    }

    // Create a scan record
    const scan = await EmailScan.create({
      emailAccountId: emailAccount._id,
      userId: user._id,
      status: 'queued',
      trigger: 'manual',
      startedAt: new Date()
    });

    emailAccount.scanStatus = 'queued';
    await emailAccount.save();

    // NOTE: In Phase 4, this is where we enqueue a BullMQ job:
    // await gmailQueue.add('scan', { scanId: scan._id, emailAccountId: emailAccount._id, userId: user._id });

    return res.json({
      success: true,
      jobId: scan._id.toString(),
      status: 'queued',
      message: 'Gmail scan has been queued.'
    });
  } catch (err) {
    console.error('triggerScan error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
};

// ── API: Get scan status ──────────────────────────────────────────────────────
exports.getScanStatus = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { emailId } = req.params;
    const emailAccount = await EmailAccount.findOne({ _id: emailId, userId: user._id }).lean();
    if (!emailAccount) return res.status(404).json({ error: 'Email not found.' });

    // Get latest scan
    const latestScan = await EmailScan.findOne({ emailAccountId: emailAccount._id })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      scanStatus: emailAccount.scanStatus,
      lastScanAt: emailAccount.lastScanAt,
      totalAccountsDiscovered: emailAccount.totalAccountsDiscovered,
      latestScan: latestScan
        ? {
            id: latestScan._id,
            status: latestScan.status,
            emailsProcessed: latestScan.emailsProcessed,
            accountsDiscovered: latestScan.accountsDiscovered,
            startedAt: latestScan.startedAt,
            completedAt: latestScan.completedAt
          }
        : null
    });
  } catch (err) {
    console.error('getScanStatus error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
};

// ── API: Get scan history ─────────────────────────────────────────────────────
exports.getScanHistory = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { emailId } = req.params;
    const emailAccount = await EmailAccount.findOne({ _id: emailId, userId: user._id });
    if (!emailAccount) return res.status(404).json({ error: 'Email not found.' });

    const scans = await EmailScan.find({ emailAccountId: emailAccount._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.json({ scans });
  } catch (err) {
    console.error('getScanHistory error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
};
