// ============================================================
// Mock Data — Footmarq / My_Login
// ============================================================

const CATEGORIES = ['Social', 'Shopping', 'Finance', 'Developer', 'Entertainment', 'Productivity', 'Healthcare', 'Gaming', 'Travel', 'Education'];

const mockAccounts = [
  // --- Entertainment ---
  { id: '1', name: 'Spotify', category: 'Entertainment', email: 'kumarshivam51238@gmail.com', logo: 'spotify', domain: 'spotify.com', firstSeen: '14 Mar 2021', lastActive: '2 days ago', riskLevel: 'low', riskScore: 12, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '2', name: 'Netflix', category: 'Entertainment', email: 'kumarshivam51238@gmail.com', logo: 'netflix', domain: 'netflix.com', firstSeen: '02 Jan 2020', lastActive: '1 day ago', riskLevel: 'low', riskScore: 8, isBreached: false, twoFaStatus: 'unsupported', activityStatus: 'active' },
  { id: '3', name: 'YouTube Premium', category: 'Entertainment', email: 'kumarshivam51238@gmail.com', logo: 'youtube', domain: 'youtube.com', firstSeen: '11 Aug 2019', lastActive: 'Today', riskLevel: 'low', riskScore: 5, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '4', name: 'Twitch', category: 'Entertainment', email: 'kumarshivam@outlook.com', logo: 'twitch', domain: 'twitch.tv', firstSeen: '22 May 2022', lastActive: '5 days ago', riskLevel: 'moderate', riskScore: 28, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'active' },
  { id: '5', name: 'Disney+', category: 'Entertainment', email: 'kumarshivam51238@gmail.com', logo: 'disney', domain: 'disneyplus.com', firstSeen: '01 Dec 2020', lastActive: '3 weeks ago', riskLevel: 'low', riskScore: 14, isBreached: false, twoFaStatus: 'unsupported', activityStatus: 'active' },
  { id: '6', name: 'SoundCloud', category: 'Entertainment', email: 'kumarshivam@outlook.com', logo: 'soundcloud', domain: 'soundcloud.com', firstSeen: '18 Mar 2018', lastActive: '2 years ago', riskLevel: 'high', riskScore: 62, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'inactive' },

  // --- Social ---
  { id: '7', name: 'Twitter / X', category: 'Social', email: 'kumarshivam51238@gmail.com', logo: 'twitter', domain: 'x.com', firstSeen: '03 Jun 2017', lastActive: 'Yesterday', riskLevel: 'moderate', riskScore: 32, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '8', name: 'Instagram', category: 'Social', email: 'kumarshivam51238@gmail.com', logo: 'instagram', domain: 'instagram.com', firstSeen: '19 Sep 2016', lastActive: 'Today', riskLevel: 'low', riskScore: 10, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '9', name: 'LinkedIn', category: 'Social', email: 'kumarshivam51238@gmail.com', logo: 'linkedin', domain: 'linkedin.com', firstSeen: '08 Jan 2019', lastActive: '4 days ago', riskLevel: 'low', riskScore: 9, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '10', name: 'Reddit', category: 'Social', email: 'kumarshivam@outlook.com', logo: 'reddit', domain: 'reddit.com', firstSeen: '22 Apr 2018', lastActive: '2 hours ago', riskLevel: 'low', riskScore: 15, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '11', name: 'Discord', category: 'Social', email: 'kumarshivam51238@gmail.com', logo: 'discord', domain: 'discord.com', firstSeen: '12 Aug 2020', lastActive: 'Today', riskLevel: 'low', riskScore: 11, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '12', name: 'Quora', category: 'Social', email: 'kumarshivam@outlook.com', logo: 'quora', domain: 'quora.com', firstSeen: '15 Feb 2015', lastActive: '3 years ago', riskLevel: 'critical', riskScore: 78, isBreached: true, twoFaStatus: 'unknown', activityStatus: 'inactive' },
  { id: '13', name: 'Pinterest', category: 'Social', email: 'kumarshivam51238@gmail.com', logo: 'pinterest', domain: 'pinterest.com', firstSeen: '07 Jul 2017', lastActive: '8 months ago', riskLevel: 'high', riskScore: 55, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'inactive' },
  { id: '14', name: 'Tumblr', category: 'Social', email: 'kumarshivam@outlook.com', logo: 'tumblr', domain: 'tumblr.com', firstSeen: '30 Oct 2013', lastActive: '4 years ago', riskLevel: 'critical', riskScore: 91, isBreached: true, twoFaStatus: 'unknown', activityStatus: 'inactive' },

  // --- Shopping ---
  { id: '15', name: 'Amazon', category: 'Shopping', email: 'kumarshivam51238@gmail.com', logo: 'amazon', domain: 'amazon.in', firstSeen: '18 Nov 2018', lastActive: '1 week ago', riskLevel: 'high', riskScore: 48, isBreached: true, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '16', name: 'Flipkart', category: 'Shopping', email: 'kumarshivam51238@gmail.com', logo: 'flipkart', domain: 'flipkart.com', firstSeen: '25 Dec 2017', lastActive: '2 weeks ago', riskLevel: 'low', riskScore: 18, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'active' },
  { id: '17', name: 'Myntra', category: 'Shopping', email: 'kumarshivam51238@gmail.com', logo: 'myntra', domain: 'myntra.com', firstSeen: '14 Jan 2019', lastActive: '1 month ago', riskLevel: 'moderate', riskScore: 25, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'active' },
  { id: '18', name: 'Zara', category: 'Shopping', email: 'kumarshivam@outlook.com', logo: 'zara', domain: 'zara.com', firstSeen: '03 Aug 2020', lastActive: '6 months ago', riskLevel: 'moderate', riskScore: 30, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'inactive' },
  { id: '19', name: 'Nike', category: 'Shopping', email: 'kumarshivam@outlook.com', logo: 'nike', domain: 'nike.com', firstSeen: '19 Sep 2021', lastActive: '3 months ago', riskLevel: 'low', riskScore: 22, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'active' },
  { id: '20', name: 'Etsy', category: 'Shopping', email: 'kumarshivam51238@gmail.com', logo: 'etsy', domain: 'etsy.com', firstSeen: '10 Jun 2016', lastActive: '2 years ago', riskLevel: 'high', riskScore: 58, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'inactive' },
  { id: '21', name: 'Ajio', category: 'Shopping', email: 'kumarshivam51238@gmail.com', logo: 'ajio', domain: 'ajio.com', firstSeen: '22 Mar 2022', lastActive: '2 months ago', riskLevel: 'low', riskScore: 16, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'active' },

  // --- Finance ---
  { id: '22', name: 'PayPal', category: 'Finance', email: 'kumarshivam51238@gmail.com', logo: 'paypal', domain: 'paypal.com', firstSeen: '05 May 2017', lastActive: '3 days ago', riskLevel: 'high', riskScore: 52, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'active' },
  { id: '23', name: 'Razorpay', category: 'Finance', email: 'kumarshivam51238@gmail.com', logo: 'razorpay', domain: 'razorpay.com', firstSeen: '12 Jan 2021', lastActive: '1 week ago', riskLevel: 'moderate', riskScore: 35, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '24', name: 'Wise', category: 'Finance', email: 'kumarshivam@outlook.com', logo: 'wise', domain: 'wise.com', firstSeen: '08 Feb 2022', lastActive: '2 months ago', riskLevel: 'high', riskScore: 45, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'active' },
  { id: '25', name: 'Coinbase', category: 'Finance', email: 'kumarshivam51238@gmail.com', logo: 'coinbase', domain: 'coinbase.com', firstSeen: '19 Nov 2020', lastActive: '5 months ago', riskLevel: 'critical', riskScore: 76, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'inactive' },
  { id: '26', name: 'Groww', category: 'Finance', email: 'kumarshivam51238@gmail.com', logo: 'groww', domain: 'groww.in', firstSeen: '01 Apr 2021', lastActive: '1 week ago', riskLevel: 'moderate', riskScore: 38, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '27', name: 'Zerodha', category: 'Finance', email: 'kumarshivam51238@gmail.com', logo: 'zerodha', domain: 'zerodha.com', firstSeen: '15 Aug 2020', lastActive: '4 days ago', riskLevel: 'low', riskScore: 20, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },

  // --- Developer ---
  { id: '28', name: 'GitHub', category: 'Developer', email: 'kumarshivam51238@gmail.com', logo: 'github', domain: 'github.com', firstSeen: '10 Oct 2016', lastActive: 'Today', riskLevel: 'low', riskScore: 6, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '29', name: 'Vercel', category: 'Developer', email: 'kumarshivam51238@gmail.com', logo: 'vercel', domain: 'vercel.com', firstSeen: '18 Mar 2021', lastActive: 'Yesterday', riskLevel: 'low', riskScore: 9, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '30', name: 'Railway', category: 'Developer', email: 'kumarshivam51238@gmail.com', logo: 'railway', domain: 'railway.app', firstSeen: '22 Jul 2022', lastActive: '1 week ago', riskLevel: 'low', riskScore: 12, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'active' },
  { id: '31', name: 'DigitalOcean', category: 'Developer', email: 'kumarshivam@outlook.com', logo: 'digitalocean', domain: 'digitalocean.com', firstSeen: '04 Sep 2019', lastActive: '3 months ago', riskLevel: 'high', riskScore: 60, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'inactive' },
  { id: '32', name: 'npm', category: 'Developer', email: 'kumarshivam51238@gmail.com', logo: 'npm', domain: 'npmjs.com', firstSeen: '15 Nov 2018', lastActive: '2 years ago', riskLevel: 'high', riskScore: 65, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'inactive' },

  // --- Productivity ---
  { id: '33', name: 'Notion', category: 'Productivity', email: 'kumarshivam51238@gmail.com', logo: 'notion', domain: 'notion.so', firstSeen: '11 Jan 2021', lastActive: 'Today', riskLevel: 'low', riskScore: 8, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '34', name: 'Slack', category: 'Productivity', email: 'kumarshivam51238@gmail.com', logo: 'slack', domain: 'slack.com', firstSeen: '25 Aug 2020', lastActive: 'Today', riskLevel: 'low', riskScore: 7, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '35', name: 'Figma', category: 'Productivity', email: 'kumarshivam51238@gmail.com', logo: 'figma', domain: 'figma.com', firstSeen: '19 Mar 2021', lastActive: '3 days ago', riskLevel: 'low', riskScore: 10, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '36', name: 'Trello', category: 'Productivity', email: 'kumarshivam@outlook.com', logo: 'trello', domain: 'trello.com', firstSeen: '14 Apr 2018', lastActive: '1 year ago', riskLevel: 'moderate', riskScore: 40, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'inactive' },
  { id: '37', name: 'Zoom', category: 'Productivity', email: 'kumarshivam51238@gmail.com', logo: 'zoom', domain: 'zoom.us', firstSeen: '16 Mar 2020', lastActive: '2 weeks ago', riskLevel: 'low', riskScore: 18, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '38', name: 'Loom', category: 'Productivity', email: 'kumarshivam51238@gmail.com', logo: 'loom', domain: 'loom.com', firstSeen: '08 Jul 2021', lastActive: '4 months ago', riskLevel: 'low', riskScore: 14, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'active' },
  { id: '39', name: 'Linear', category: 'Productivity', email: 'kumarshivam51238@gmail.com', logo: 'linear', domain: 'linear.app', firstSeen: '22 Jan 2022', lastActive: '2 days ago', riskLevel: 'low', riskScore: 9, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '40', name: '1Password', category: 'Productivity', email: 'kumarshivam51238@gmail.com', logo: '1password', domain: '1password.com', firstSeen: '03 Sep 2020', lastActive: 'Today', riskLevel: 'low', riskScore: 4, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },

  // --- Gaming ---
  { id: '41', name: 'Steam', category: 'Gaming', email: 'kumarshivam51238@gmail.com', logo: 'steam', domain: 'store.steampowered.com', firstSeen: '05 Dec 2015', lastActive: '1 week ago', riskLevel: 'low', riskScore: 16, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'active' },
  { id: '42', name: 'Epic Games', category: 'Gaming', email: 'kumarshivam51238@gmail.com', logo: 'epicgames', domain: 'epicgames.com', firstSeen: '12 Feb 2019', lastActive: '6 months ago', riskLevel: 'moderate', riskScore: 28, isBreached: false, twoFaStatus: 'enabled', activityStatus: 'inactive' },
  { id: '43', name: 'Xbox', category: 'Gaming', email: 'kumarshivam@outlook.com', logo: 'xbox', domain: 'xbox.com', firstSeen: '25 Nov 2014', lastActive: '3 years ago', riskLevel: 'high', riskScore: 56, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'inactive' },

  // --- Travel ---
  { id: '44', name: 'MakeMyTrip', category: 'Travel', email: 'kumarshivam51238@gmail.com', logo: 'makemytrip', domain: 'makemytrip.com', firstSeen: '18 Jul 2019', lastActive: '3 months ago', riskLevel: 'low', riskScore: 20, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'active' },
  { id: '45', name: 'Airbnb', category: 'Travel', email: 'kumarshivam51238@gmail.com', logo: 'airbnb', domain: 'airbnb.com', firstSeen: '22 Oct 2020', lastActive: '8 months ago', riskLevel: 'moderate', riskScore: 30, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'inactive' },
  { id: '46', name: 'Booking.com', category: 'Travel', email: 'kumarshivam@outlook.com', logo: 'booking', domain: 'booking.com', firstSeen: '15 Mar 2018', lastActive: '1 year ago', riskLevel: 'moderate', riskScore: 35, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'inactive' },

  // --- Education ---
  { id: '47', name: 'Coursera', category: 'Education', email: 'kumarshivam51238@gmail.com', logo: 'coursera', domain: 'coursera.org', firstSeen: '09 Apr 2020', lastActive: '4 months ago', riskLevel: 'low', riskScore: 18, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'active' },
  { id: '48', name: 'Udemy', category: 'Education', email: 'kumarshivam51238@gmail.com', logo: 'udemy', domain: 'udemy.com', firstSeen: '28 Jun 2019', lastActive: '6 months ago', riskLevel: 'low', riskScore: 20, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'active' },
  { id: '49', name: 'Khan Academy', category: 'Education', email: 'kumarshivam51238@gmail.com', logo: 'khanacademy', domain: 'khanacademy.org', firstSeen: '12 Sep 2017', lastActive: '2 years ago', riskLevel: 'moderate', riskScore: 38, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'inactive' },

  // --- Healthcare ---
  { id: '50', name: 'Apollo Health', category: 'Healthcare', email: 'kumarshivam51238@gmail.com', logo: 'apollo', domain: 'apollopharmacy.in', firstSeen: '14 Feb 2021', lastActive: '2 months ago', riskLevel: 'moderate', riskScore: 40, isBreached: false, twoFaStatus: 'unknown', activityStatus: 'active' },

  // --- Breached accounts ---
  { id: '51', name: 'Dropbox', category: 'Productivity', email: 'kumarshivam51238@gmail.com', logo: 'dropbox', domain: 'dropbox.com', firstSeen: '25 Mar 2014', lastActive: '2 years ago', riskLevel: 'critical', riskScore: 88, isBreached: true, twoFaStatus: 'unknown', activityStatus: 'inactive' },
  { id: '52', name: 'LastFM', category: 'Entertainment', email: 'kumarshivam51238@gmail.com', logo: 'lastfm', domain: 'last.fm', firstSeen: '07 Aug 2012', lastActive: '4 years ago', riskLevel: 'critical', riskScore: 95, isBreached: true, twoFaStatus: 'unknown', activityStatus: 'inactive' },
  { id: '53', name: 'Adobe', category: 'Productivity', email: 'kumarshivam@outlook.com', logo: 'adobe', domain: 'adobe.com', firstSeen: '19 Nov 2013', lastActive: '1 month ago', riskLevel: 'critical', riskScore: 82, isBreached: true, twoFaStatus: 'enabled', activityStatus: 'active' },
];

const mockBreaches = [
  {
    id: 'b1',
    accountId: '15',
    service: 'Amazon',
    email: 'kumarshivam51238@gmail.com',
    breachDate: '12 Aug 2021',
    detectedDate: '15 Aug 2021',
    dataTypes: ['Email addresses', 'Passwords', 'Phone numbers', 'Addresses'],
    severity: 'high',
    description: 'In August 2021, Amazon suffered a data breach exposing customer data including emails and encrypted passwords.',
    resolved: false,
    pwnCount: '4.2M'
  },
  {
    id: 'b2',
    accountId: '51',
    service: 'Dropbox',
    email: 'kumarshivam51238@gmail.com',
    breachDate: '10 Oct 2012',
    detectedDate: '31 Aug 2016',
    dataTypes: ['Email addresses', 'Passwords'],
    severity: 'critical',
    description: 'In 2012, Dropbox was hacked and 68M user credentials were exposed, discovered publicly in 2016.',
    resolved: false,
    pwnCount: '68.6M'
  },
  {
    id: 'b3',
    accountId: '52',
    service: 'LastFM',
    email: 'kumarshivam51238@gmail.com',
    breachDate: '22 Mar 2012',
    detectedDate: '14 Sep 2016',
    dataTypes: ['Email addresses', 'Passwords', 'Usernames'],
    severity: 'critical',
    description: 'In 2012, LastFM suffered a breach exposing 43M unsalted MD5 password hashes.',
    resolved: false,
    pwnCount: '43.5M'
  },
  {
    id: 'b4',
    accountId: '53',
    service: 'Adobe',
    email: 'kumarshivam@outlook.com',
    breachDate: '04 Oct 2013',
    detectedDate: '04 Oct 2013',
    dataTypes: ['Email addresses', 'Password hints', 'Passwords', 'Usernames', 'Website activity'],
    severity: 'critical',
    description: 'In October 2013, Adobe suffered a massive data breach affecting 153M records including encrypted passwords.',
    resolved: false,
    pwnCount: '152.4M'
  },
  {
    id: 'b5',
    accountId: '12',
    service: 'Quora',
    email: 'kumarshivam@outlook.com',
    breachDate: '03 Dec 2018',
    detectedDate: '03 Dec 2018',
    dataTypes: ['Email addresses', 'Names', 'IP addresses', 'Passwords', 'Questions and answers'],
    severity: 'high',
    description: 'In December 2018, Quora announced that 100M user records had been compromised.',
    resolved: false,
    pwnCount: '99.9M'
  },
  {
    id: 'b6',
    accountId: '14',
    service: 'Tumblr',
    email: 'kumarshivam@outlook.com',
    breachDate: '11 May 2013',
    detectedDate: '30 May 2016',
    dataTypes: ['Email addresses', 'Passwords'],
    severity: 'critical',
    description: 'In 2013, Tumblr suffered a breach that was publicly disclosed in 2016, exposing 65M records.',
    resolved: false,
    pwnCount: '65.5M'
  },
];

const securityData = {
  score: 54,
  label: 'MODERATE',
  lastUpdated: '5 minutes ago',
  breakdown: {
    base: 100,
    deductions: [
      { reason: '6 breached accounts (-15 each)', points: -45, capped: true },
      { reason: '4 high/critical risk accounts (-5 each)', points: -20, capped: false },
      { reason: '3 sensitive accounts with unknown 2FA (-5 each)', points: -15, capped: false },
      { reason: '2 inactive sensitive accounts (-3 each)', points: -6, capped: false },
    ]
  },
  issues: [
    { priority: 'P0', severity: 'critical', title: '6 Breached Accounts', description: 'Amazon · Dropbox · LastFM · Adobe · Quora · Tumblr', cta: 'View Breaches', icon: '🔴' },
    { priority: 'P1', severity: 'high', title: '4 High/Critical Risk Accounts', description: 'Coinbase · Dropbox · npm · DigitalOcean', cta: 'Review Accounts', icon: '🟠' },
    { priority: 'P2', severity: 'moderate', title: '5 Finance Accounts with Unknown 2FA', description: 'PayPal · Wise · Coinbase · Groww · Razorpay', cta: 'Enable 2FA', icon: '🟡' },
    { priority: 'P3', severity: 'low', title: '12 Inactive Accounts (>180 days)', description: 'Review and remove accounts you no longer use', cta: 'Cleanup Now', icon: '💤' },
  ]
};

const emailAccounts = [
  { id: 'e1', email: 'kumarshivam51238@gmail.com', provider: 'Gmail', connected: true, lastScan: '2 hours ago', accountsFound: 38, status: 'connected', avatar: 'SK' },
  { id: 'e2', email: 'kumarshivam@outlook.com', provider: 'Outlook', connected: false, lastScan: 'Never', accountsFound: 0, status: 'not_connected', avatar: 'SK' },
];

const currentUser = {
  name: 'Shivam Kumar',
  email: 'kumarshivam51238@gmail.com',
  avatar: 'SK',
  joinedDate: 'September 2026',
  plan: 'Free',
};

const notificationsData = [
  { id: 'n1', type: 'breach', title: 'New Breach Detected', message: 'Your Amazon account was found in a new data breach.', time: '2 hours ago', read: false, severity: 'critical' },
  { id: 'n2', type: 'scan', title: 'Scan Complete', message: 'Gmail scan complete. Found 3 new accounts.', time: '5 hours ago', read: false, severity: 'info' },
  { id: 'n3', type: 'risk', title: 'Risk Score Changed', message: 'Your security score dropped to 54. Review your accounts.', time: 'Yesterday', read: true, severity: 'warning' },
  { id: 'n4', type: 'breach', title: 'Adobe Breach Confirmed', message: 'Your email was found in the Adobe 2013 breach dataset.', time: '3 days ago', read: true, severity: 'critical' },
  { id: 'n5', type: 'tip', title: 'Security Tip', message: 'Enable 2FA on your PayPal account to improve your score.', time: '1 week ago', read: true, severity: 'info' },
];

const accountTimelines = {
  '1': [
    { type: 'signup', label: 'Account Created', date: '14 Mar 2021', icon: '🔵' },
    { type: 'transaction', label: 'Subscription renewed', date: 'Jan 2022', icon: '💳' },
    { type: 'transaction', label: 'Subscription renewed', date: 'Jan 2023', icon: '💳' },
    { type: 'transaction', label: 'Subscription renewed', date: 'Jan 2024', icon: '💳' },
    { type: 'transaction', label: 'Subscription renewed', date: 'Jan 2025', icon: '💳' },
    { type: 'transaction', label: 'Subscription renewed', date: 'Jan 2026', icon: '💳' },
  ],
  '15': [
    { type: 'signup', label: 'Account Created', date: '18 Nov 2018', icon: '🔵' },
    { type: 'breach', label: 'Breach detected (Aug 2021)', date: 'Aug 2021', icon: '🚨' },
    { type: 'transaction', label: 'Order placed', date: 'Dec 2023', icon: '📦' },
    { type: 'transaction', label: 'Prime renewed', date: 'Jan 2024', icon: '💳' },
  ],
};

module.exports = {
  mockAccounts,
  mockBreaches,
  securityData,
  emailAccounts,
  currentUser,
  notificationsData,
  accountTimelines,
};
