const User = require('../models/User');
const EmailAccount = require('../models/EmailAccount');
const { getCurrentUser } = require('../utils/helpers');
const { sendOtpEmail } = require('../services/emailService');
const { generateSessionToken, parseDevice, getClientIp } = require('../utils/sessionUtils');

// Landing Page
exports.getLanding = async (req, res) => {
  const user = await getCurrentUser(req);
  res.render('landing', { user, page: 'landing' });
};

// Auth GET Login
exports.getLogin = (req, res) => {
  const success = req.query.registered === 'true' ? 'Account created successfully! Please sign in.' : null;
  const email = req.query.email || '';
  res.render('auth/login', { page: 'login', error: null, success, email });
};

// Auth POST Login - Generates and sends OTP for 2FA
exports.postLogin = async (req, res) => {
  try {
    const { email } = req.body;
    const userEmail = email ? email.toLowerCase().trim() : '';
    const user = await User.findOne({ email: userEmail });
    if (user) {
      // Generate 6-digit OTP code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.otpCode = otpCode;
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
      await user.save();

      // Send OTP via email service (Nodemailer / Dev Console Log)
      await sendOtpEmail(user.email, otpCode);

      return res.redirect(`/verify-otp?email=${encodeURIComponent(user.email)}`);
    }
    res.render('auth/login', { page: 'login', error: 'User not found in database. Register first or use valid email.', success: null, email: email || '' });
  } catch (err) {
    res.render('auth/login', { page: 'login', error: err.message, success: null, email: '' });
  }
};

// Auth GET Verify OTP Page
exports.getVerifyOtp = (req, res) => {
  const email = req.query.email || '';
  const success = req.query.success || null;
  res.render('auth/verify-otp', { page: 'verify-otp', email, error: null, success });
};

// Auth POST Verify OTP
exports.postVerifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const userEmail = email ? email.toLowerCase().trim() : '';
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.render('auth/verify-otp', { page: 'verify-otp', email: userEmail, error: 'User account not found.', success: null });
    }

    if (!user.otpCode || !user.otpExpiresAt) {
      return res.render('auth/verify-otp', { page: 'verify-otp', email: userEmail, error: 'No active OTP session. Please request a new code.', success: null });
    }

    if (new Date() > user.otpExpiresAt) {
      return res.render('auth/verify-otp', { page: 'verify-otp', email: userEmail, error: 'Security code has expired. Please click Resend Code.', success: null });
    }

    if (user.otpCode !== otp.trim()) {
      return res.render('auth/verify-otp', { page: 'verify-otp', email: userEmail, error: 'Invalid security code. Please try again.', success: null });
    }

    // OTP is valid! Clear OTP fields and establish session
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;

    // Record new session
    const sessionToken = generateSessionToken();
    const ip = getClientIp(req);
    const device = parseDevice(req.headers['user-agent'] || '');
    user.sessions.push({ token: sessionToken, device, ip, location: 'Unknown', loginAt: new Date(), lastSeen: new Date() });
    await user.save();

    res.cookie('userEmail', user.email, { httpOnly: true, secure: true, sameSite: 'lax' });
    res.cookie('sessionToken', sessionToken, { httpOnly: true, secure: true, sameSite: 'lax' });
    res.redirect('/dashboard');
  } catch (err) {
    res.render('auth/verify-otp', { page: 'verify-otp', email: req.body.email || '', error: err.message, success: null });
  }
};

// Resend OTP Code
exports.resendOtp = async (req, res) => {
  try {
    const email = req.query.email ? req.query.email.toLowerCase().trim() : '';
    const user = await User.findOne({ email });

    if (user) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.otpCode = otpCode;
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      await sendOtpEmail(user.email, otpCode);
      return res.redirect(`/verify-otp?email=${encodeURIComponent(user.email)}&success=A+new+verification+code+has+been+sent!`);
    }

    res.redirect('/login');
  } catch (err) {
    res.redirect('/login');
  }
};

// Auth Logout
exports.logout = async (req, res) => {
  try {
    const sessionToken = req.cookies.sessionToken;
    if (sessionToken && req.cookies.userEmail) {
      const user = await User.findOne({ email: req.cookies.userEmail.toLowerCase().trim() });
      if (user) {
        user.sessions = user.sessions.filter(s => s.token !== sessionToken);
        await user.save();
      }
    }
  } catch (_) { /* silent — always log out */ }
  res.clearCookie('userEmail');
  res.clearCookie('sessionToken');
  res.redirect('/');
};

// Auth GET Register
exports.getRegister = (req, res) => {
  res.render('auth/register', { page: 'register', error: null });
};

// Auth POST Register
exports.postRegister = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userEmail = email ? email.toLowerCase().trim() : '';
    const existing = await User.findOne({ email: userEmail });
    if (existing) {
      return res.render('auth/register', { page: 'register', error: 'Email already exists. Please log in.' });
    }
    const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';
    const newUser = await User.create({
      name,
      email: userEmail,
      password: password || 'defaultPass123',
      avatar: initials,
      plan: 'Free'
    });
    
    // Add primary email account (pre-verified — user registered with this address)
    const regDomain = userEmail.split('@')[1] || '';
    const regProvider = regDomain.includes('gmail') ? 'Gmail'
      : regDomain.includes('outlook') || regDomain.includes('hotmail') ? 'Outlook'
      : regDomain.includes('yahoo') ? 'Yahoo' : 'Other';
    await EmailAccount.create({
      userId: newUser._id,
      email: newUser.email,
      provider: regProvider,
      isPrimary: true,
      isVerified: true,
      scanStatus: 'never_scanned',
      avatar: initials
    });

    res.cookie('userEmail', newUser.email, { httpOnly: true, secure: true, sameSite: 'lax' });
    res.redirect(`/login?registered=true&email=${encodeURIComponent(newUser.email)}`);
  } catch (err) {
    res.render('auth/register', { page: 'register', error: err.message });
  }
};

// Verify Email
exports.verifyEmail = (req, res) => {
  res.redirect('/login');
};

// Forgot Password
exports.forgotPassword = (req, res) => {
  res.render('auth/forgot-password', { page: 'forgot-password' });
};

// Onboarding
exports.getOnboarding = async (req, res) => {
  const user = await getCurrentUser(req);
  res.render('onboarding', { user, page: 'onboarding' });
};

// ── Google OAuth Handlers ─────────────────────────────────────
const { getGoogleAuthUrl, handleGoogleCallback } = require('../config/googleOAuth');
const { scanUserGmail } = require('../services/gmailScanner');

// NOTE: Login OAuth uses LOGIN_SCOPES only (openid + profile + email).
// Gmail read permission is requested SEPARATELY via /emails/:id/gmail/connect.

// Redirect to Google Consent Screen
exports.googleLogin = (req, res) => {
  const authUrl = getGoogleAuthUrl();
  res.redirect(authUrl);
};

// Handle OAuth Callback from Google
exports.googleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect('/login?error=No+authorization+code+provided');
    }

    const googleProfile = await handleGoogleCallback(code);

    // Upsert User in MongoDB
    let user = await User.findOne({
      $or: [{ googleId: googleProfile.googleId }, { email: googleProfile.email.toLowerCase().trim() }]
    });

    const initials = googleProfile.name
      ? googleProfile.name.split(' ').map(n => n[0]).join('').toUpperCase()
      : 'G';

    if (!user) {
      user = await User.create({
        name: googleProfile.name,
        email: googleProfile.email.toLowerCase().trim(),
        googleId: googleProfile.googleId,
        authProvider: 'google',
        avatar: initials,
        avatarUrl: googleProfile.picture,
        googleTokens: googleProfile.tokens,
        plan: 'Free'
      });
    } else {
      user.googleId = googleProfile.googleId;
      user.authProvider = 'google';
      user.avatarUrl = googleProfile.picture;
      user.googleTokens = googleProfile.tokens;
      await user.save();
    }

    // Ensure primary EmailAccount entry exists (Google login = Gmail, pre-verified)
    await EmailAccount.findOneAndUpdate(
      { userId: user._id, email: user.email },
      {
        $setOnInsert: {
          userId: user._id,
          email: user.email,
          provider: 'Gmail',
          isPrimary: true,
          isVerified: true,
          scanStatus: 'never_scanned',
          avatar: initials
        }
      },
      { upsert: true, new: true }
    );

    // Automatically trigger Gmail account discovery scan
    await scanUserGmail(user);

    // Record new session
    const sessionToken = generateSessionToken();
    const ip = getClientIp(req);
    const device = parseDevice(req.headers['user-agent'] || '');
    user.sessions.push({ token: sessionToken, device, ip, location: 'Unknown', loginAt: new Date(), lastSeen: new Date() });
    await user.save();

    // Set auth cookies
    res.cookie('userEmail', user.email, { httpOnly: true, secure: true, sameSite: 'lax' });
    res.cookie('sessionToken', sessionToken, { httpOnly: true, secure: true, sameSite: 'lax' });
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Google OAuth Callback Error:', err);
    res.render('auth/login', {
      page: 'login',
      error: `Google Login Failed: ${err.message}`,
      success: null,
      email: ''
    });
  }
};

// Sandbox Mode Google Login (for testing without live GCP Credentials)
exports.googleSandbox = async (req, res) => {
  try {
    const mockEmail = 'kumarshivam51238@gmail.com';
    const mockName = 'Shivam Kumar';

    let user = await User.findOne({ email: mockEmail });
    if (!user) {
      user = await User.create({
        name: mockName,
        email: mockEmail,
        googleId: 'sandbox_google_123456789',
        authProvider: 'google',
        avatar: 'SK',
        avatarUrl: 'https://lh3.googleusercontent.com/a/default-user',
        plan: 'Pro'
      });
    } else {
      user.authProvider = 'google';
      user.googleId = 'sandbox_google_123456789';
      await user.save();
    }

    await EmailAccount.findOneAndUpdate(
      { userId: user._id, email: user.email },
      {
        $setOnInsert: {
          userId: user._id,
          email: user.email,
          provider: 'Gmail',
          isPrimary: true,
          isVerified: true,
          scanStatus: 'never_scanned',
          avatar: 'SK'
        }
      },
      { upsert: true, new: true }
    );

    // Run sample account discovery scan
    await scanUserGmail(user);

    // Record new session
    const sessionToken = generateSessionToken();
    const ip = getClientIp(req);
    const device = parseDevice(req.headers['user-agent'] || '');
    user.sessions.push({ token: sessionToken, device, ip, location: 'Unknown', loginAt: new Date(), lastSeen: new Date() });
    await user.save();

    res.cookie('userEmail', user.email, { httpOnly: true, secure: true, sameSite: 'lax' });
    res.cookie('sessionToken', sessionToken, { httpOnly: true, secure: true, sameSite: 'lax' });
    res.redirect('/dashboard');
  } catch (err) {
    res.redirect('/login');
  }
};
