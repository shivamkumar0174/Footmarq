const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Account = require('../models/Account');
const Breach = require('../models/Breach');
const EmailAccount = require('../models/EmailAccount');

const {
  mockAccounts,
  mockBreaches,
  emailAccounts,
  currentUser,
} = require('../data/mockData');

const seedData = async () => {
  try {
    await connectDB();

    console.log('🧹 Clearing existing database collections...');
    await User.deleteMany({});
    await Account.deleteMany({});
    await Breach.deleteMany({});
    await EmailAccount.deleteMany({});

    console.log('👤 Creating initial user Shivam Kumar...');
    const user = await User.create({
      name: 'Shivam Kumar',
      email: 'kumarshivam51238@gmail.com',
      password: 'Password123!', // Demo hashed or standard password
      avatar: 'SK',
      plan: currentUser.plan || 'Free',
      joinedDate: currentUser.joinedDate || 'September 2026',
      settings: currentUser.settings || {
        twoFactorEnabled: true,
        darkWebMonitoring: true,
        monthlyReports: true,
        instantBreachAlerts: true,
        marketingEmails: false,
      }
    });

    console.log(`✅ User created with ID: ${user._id}`);

    console.log('📧 Seeding connected email accounts...');
    const createdEmailAccounts = await EmailAccount.insertMany(
      emailAccounts.map(ea => ({
        userId: user._id,
        email: ea.email,
        provider: ea.provider,
        connected: ea.connected,
        lastScan: ea.lastScan,
        accountsFound: ea.accountsFound,
        status: ea.status,
        avatar: ea.avatar
      }))
    );
    console.log(`✅ ${createdEmailAccounts.length} email accounts inserted.`);

    console.log('📦 Seeding online accounts...');
    const accountIdMap = {};
    for (const acc of mockAccounts) {
      const createdAcc = await Account.create({
        userId: user._id,
        name: acc.name,
        category: acc.category,
        email: acc.email,
        logo: acc.logo,
        domain: acc.domain,
        firstSeen: acc.firstSeen,
        lastActive: acc.lastActive,
        riskLevel: acc.riskLevel,
        riskScore: acc.riskScore,
        isBreached: acc.isBreached,
        twoFaStatus: acc.twoFaStatus,
        activityStatus: acc.activityStatus
      });
      accountIdMap[acc.id] = createdAcc._id;
    }
    console.log(`✅ ${mockAccounts.length} online accounts inserted.`);

    console.log('🚨 Seeding data breaches...');
    const createdBreaches = await Breach.insertMany(
      mockBreaches.map(b => ({
        userId: user._id,
        accountId: accountIdMap[b.accountId] || null,
        service: b.service,
        email: b.email,
        breachDate: b.breachDate,
        detectedDate: b.detectedDate,
        dataTypes: b.dataTypes,
        description: b.description,
        severity: b.severity,
        pwnCount: b.pwnCount || 'Multiple',
        resolved: b.resolved || false,
        userActionNeeded: b.userActionNeeded || 'Change password immediately'
      }))
    );
    console.log(`✅ ${createdBreaches.length} data breach alerts inserted.`);

    console.log('\n🎉 MongoDB database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedData();
