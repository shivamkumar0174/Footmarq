const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://localhost:3000/auth/google/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly'
];

function getOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return null;
  }
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

/**
 * Generate Google OAuth Login URL
 */
function getGoogleAuthUrl() {
  const client = getOAuth2Client();
  if (!client) {
    // Sandbox / Local fallback URL when GCP keys are not configured
    return '/auth/google/sandbox';
  }
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
  });
}

/**
 * Handle OAuth Code Callback from Google
 */
async function handleGoogleCallback(code) {
  const client = getOAuth2Client();
  if (!client) {
    throw new Error('Google OAuth credentials not configured in environment.');
  }

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Verify ID Token to extract profile
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

module.exports = {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getOAuth2Client,
  SCOPES
};
