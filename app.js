const express = require('express');
const path = require('path');
const connectDB = require('./src/config/db');

const User = require('./src/models/User');
const Account = require('./src/models/Account');
const Breach = require('./src/models/Breach');
const EmailAccount = require('./src/models/EmailAccount');

const {
  securityData,
  notificationsData,
  accountTimelines,
} = require('./src/data/mockData');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Connect MongoDB Database ─────────────────────────────────
connectDB();

// ── View Engine ─────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Native cookie parser
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      if (parts.length >= 2) {
        req.cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
      }
    });
  }
  next();
});

// Helper to fetch logged in user from cookie
async function getCurrentUser(req) {
  if (!req || !req.cookies || !req.cookies.userEmail) {
    return null;
  }
  const user = await User.findOne({ email: req.cookies.userEmail.toLowerCase().trim() });
  return user || null;
}

function getDashboardStats(accounts) {
  return {
    total: accounts.length,
    breached: accounts.filter(a => a.isBreached).length,
    highRisk: accounts.filter(a => ['high', 'critical'].includes(a.riskLevel)).length,
    inactive: accounts.filter(a => a.activityStatus === 'inactive').length,
  };
}

// ── Routes ───────────────────────────────────────────────────

// Landing
app.get('/', async (req, res) => {
  const user = await getCurrentUser(req);
  res.render('landing', { user, page: 'landing' });
});

// Auth GET
app.get('/login', (req, res) => {
  const success = req.query.registered === 'true' ? 'Account created successfully! Please sign in.' : null;
  const email = req.query.email || '';
  res.render('auth/login', { page: 'login', error: null, success, email });
});

app.post('/login', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email ? email.toLowerCase().trim() : '' });
    if (user) {
      res.cookie('userEmail', user.email);
      return res.redirect('/dashboard');
    }
    res.render('auth/login', { page: 'login', error: 'User not found in database. Register first or use valid email.', success: null, email: email || '' });
  } catch (err) {
    res.render('auth/login', { page: 'login', error: err.message, success: null, email: '' });
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('userEmail');
  res.redirect('/');
});

app.get('/register', (req, res) => {
  res.render('auth/register', { page: 'register', error: null });
});

app.post('/register', async (req, res) => {
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
    // Add default email account
    await EmailAccount.create({
      userId: newUser._id,
      email: newUser.email,
      provider: 'Gmail',
      connected: true,
      lastScan: 'Just now',
      accountsFound: 0,
      status: 'connected',
      avatar: initials
    });
    res.cookie('userEmail', newUser.email);
    res.redirect(`/login?registered=true&email=${encodeURIComponent(newUser.email)}`);
  } catch (err) {
    res.render('auth/register', { page: 'register', error: err.message });
  }
});

app.get('/verify-email', (req, res) => {
  res.redirect('/login');
});

app.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { page: 'forgot-password' });
});

// Onboarding
app.get('/onboarding', async (req, res) => {
  const user = await getCurrentUser(req);
  res.render('onboarding', { user, page: 'onboarding' });
});

// Dashboard
app.get('/dashboard', async (req, res) => {
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
});

// Account Detail (for side panel / modal)
app.get('/dashboard/account/:id', async (req, res) => {
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
});

// Security Center
app.get('/security', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const tab = req.query.tab || 'overview';
    const allAccounts = await Account.find(user ? { userId: user._id } : {}).lean();
    
    const breachedAccounts = allAccounts.filter(a => a.isBreached);
    const highRiskAccounts = allAccounts.filter(a => ['high', 'critical'].includes(a.riskLevel));
    const inactiveAccounts = allAccounts.filter(a => a.activityStatus === 'inactive');
    const unknown2fa = allAccounts.filter(a => a.twoFaStatus === 'unknown' && ['Finance', 'Developer'].includes(a.category));

    res.render('security', {
      user,
      page: 'security',
      tab,
      security: securityData,
      breachedAccounts,
      highRiskAccounts,
      inactiveAccounts,
      unknown2fa,
      notifications: notificationsData.filter(n => !n.read).length,
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Breach Monitor
app.get('/breaches', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const breaches = await Breach.find(user ? { userId: user._id } : {}).lean();
    const accounts = await Account.find(user ? { userId: user._id } : {}).lean();

    res.render('breaches', {
      user,
      page: 'breaches',
      breaches,
      accounts,
      notifications: notificationsData.filter(n => !n.read).length,
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Email Manager
app.get('/emails', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const emails = await EmailAccount.find(user ? { userId: user._id } : {}).lean();

    res.render('emails', {
      user,
      page: 'emails',
      emails,
      notifications: notificationsData.filter(n => !n.read).length,
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Cleanup Center
app.get('/cleanup', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const inactiveAccounts = await Account.find({
      ...(user ? { userId: user._id } : {}),
      activityStatus: 'inactive'
    }).lean();

    res.render('cleanup', {
      user,
      page: 'cleanup',
      accounts: inactiveAccounts,
      notifications: notificationsData.filter(n => !n.read).length,
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Notifications
app.get('/notifications', async (req, res) => {
  const user = await getCurrentUser(req);
  res.render('notifications', {
    user,
    page: 'notifications',
    notifications: notificationsData,
  });
});

// Settings
app.get('/settings', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const tab = req.query.tab || 'profile';
    const emails = await EmailAccount.find(user ? { userId: user._id } : {}).lean();

    res.render('settings', {
      user,
      page: 'settings',
      tab,
      emails,
      notifications: notificationsData.filter(n => !n.read).length,
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Settings Profile Update POST
app.post('/settings/profile', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (user) {
      if (req.body.name) user.name = req.body.name;
      if (req.body.email) user.email = req.body.email;
      await user.save();
    }
    res.redirect('/settings?tab=profile');
  } catch (err) {
    res.redirect('/settings?tab=profile');
  }
});

// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🔐 Footmarq — My_Login\n  Running at: http://localhost:${PORT}\n`);
});
