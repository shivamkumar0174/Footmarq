const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const BASE_URL = process.env.BASE_URL || 'https://localhost:3000';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${BASE_URL}/auth/google/callback`;
const GMAIL_CONNECT_REDIRECT_URI =
  process.env.GMAIL_CONNECT_REDIRECT_URI || `${BASE_URL}/emails/gmail/callback`;

// ── Scope Sets ───────────────────────────────────────────────────────────────
/** Used ONLY for sign-in — never includes gmail.readonly */
const LOGIN_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid'
];

/** Used ONLY when user explicitly connects Gmail for scanning */
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly'
];

// ── OAuth2 Client Factories ──────────────────────────────────────────────────
function getLoginOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

function getGmailOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_CONNECT_REDIRECT_URI);
}

// ── URL Builders ─────────────────────────────────────────────────────────────
/**
 * Generate Google OAuth URL for LOGIN ONLY (no Gmail scope).
 */
function getGoogleAuthUrl() {
  const client = getLoginOAuth2Client();
  if (!client) return '/auth/google/sandbox';
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: LOGIN_SCOPES
  });
}

/**
 * Generate Google OAuth URL for GMAIL CONNECT ONLY.
 * @param {string} emailAccountId — the EmailAccount _id to bind after callback
 * @param {string} csrfState — random CSRF token stored in session/cookie
 */
function getGmailConnectUrl(emailAccountId, csrfState) {
  const client = getGmailOAuth2Client();
  if (!client) return null;
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state: JSON.stringify({ emailAccountId, csrf: csrfState }),
    login_hint: '' // allow Google to show account picker
  });
}

// ── Callback Handlers ────────────────────────────────────────────────────────
/**
 * Handle login OAuth callback — returns profile + login tokens.
 */
async function handleGoogleCallback(code) {
  const client = getLoginOAuth2Client();
  if (!client) throw new Error('Google OAuth credentials not configured.');

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    tokens: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      scope: tokens.scope
    }
  };
}

/**
 * Exchange authorization code from Gmail connect callback for access/refresh tokens.
 * @returns {{ accessToken, refreshToken, expiryDate, scopes }}
 */
async function handleGmailConnectCallback(code) {
  const client = getGmailOAuth2Client();
  if (!client) throw new Error('Google OAuth credentials not configured.');

  const { tokens } = await client.getToken(code);
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date,
    scopes: (tokens.scope || '').split(' ')
  };
}

module.exports = {
  getGoogleAuthUrl,
  getGmailConnectUrl,
  handleGoogleCallback,
  handleGmailConnectCallback,
  getLoginOAuth2Client,
  getGmailOAuth2Client,
  LOGIN_SCOPES,
  GMAIL_SCOPES
};
