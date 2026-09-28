require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');
const connectDB = require('./src/config/db');

const authRoutes = require('./src/routes/authRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const securityRoutes = require('./src/routes/securityRoutes');
const breachRoutes = require('./src/routes/breachRoutes');
const emailRoutes = require('./src/routes/emailRoutes');
const cleanupRoutes = require('./src/routes/cleanupRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');

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

// HTTPS Security Headers
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

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

// ── Routes ───────────────────────────────────────────────────
app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/', securityRoutes);
app.use('/', breachRoutes);
app.use('/', emailRoutes);
app.use('/', cleanupRoutes);
app.use('/', notificationRoutes);
app.use('/', settingsRoutes);

// ── SSL Configuration & HTTPS Server ──────────────────────────
function getSSLCertificates() {
  const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'key.pem');
  const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'cert.pem');

  // If certs don't exist yet, auto-generate self-signed certs
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    const certsDir = path.dirname(keyPath);
    if (!fs.existsSync(certsDir)) {
      fs.mkdirSync(certsDir, { recursive: true });
    }
    execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -days 365 -subj "/CN=localhost"`, { stdio: 'ignore' });
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
}

const sslOptions = getSSLCertificates();
const httpsServer = https.createServer(sslOptions, app);

httpsServer.listen(PORT, () => {
  console.log(`\n  🔐 Footmarq — Digital Identity Hub (HTTPS Enabled)\n  Running at: https://localhost:${PORT}\n`);
});

