const crypto = require('crypto');

/**
 * Generate a cryptographically random session token.
 * @returns {string} 64-char hex token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Parse a human-readable device label from User-Agent string.
 * @param {string} ua - User-Agent header value
 * @returns {string}
 */
function parseDevice(ua = '') {
  // OS detection
  let os = 'Unknown OS';
  if (/Windows NT 10/i.test(ua))        os = 'Windows 10';
  else if (/Windows NT 11/i.test(ua))   os = 'Windows 11';
  else if (/Windows/i.test(ua))         os = 'Windows';
  else if (/Mac OS X/i.test(ua))        os = 'macOS';
  else if (/Android/i.test(ua))         os = 'Android';
  else if (/iPhone|iPad/i.test(ua))     os = 'iOS';
  else if (/Linux/i.test(ua))           os = 'Linux';

  // Browser detection (order matters — Edge must be before Chrome)
  let browser = 'Unknown Browser';
  if (/Edg\//i.test(ua))               browser = 'Edge';
  else if (/OPR\//i.test(ua))          browser = 'Opera';
  else if (/Chrome/i.test(ua))         browser = 'Chrome';
  else if (/Firefox/i.test(ua))        browser = 'Firefox';
  else if (/Safari/i.test(ua))         browser = 'Safari';

  return `${browser} on ${os}`;
}

/**
 * Format login time as a relative string like "Just now", "3 hours ago", etc.
 * @param {Date} date
 * @returns {string}
 */
function formatRelativeTime(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins  = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);

  if (mins < 2)       return 'Just now';
  if (mins < 60)      return `${mins} minutes ago`;
  if (hours < 24)     return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days < 30)      return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Mask an IP address for privacy: "182.64.123.45" → "182.64.xx.xx"
 * @param {string} ip
 * @returns {string}
 */
function maskIp(ip = '') {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.xx.xx`;
  }
  // IPv6 — show first two segments
  const v6parts = ip.split(':');
  if (v6parts.length > 2) {
    return `${v6parts[0]}:${v6parts[1]}:xx:xx`;
  }
  return 'xx.xx.xx.xx';
}

/**
 * Extract the real client IP from a request (handles proxies/HTTPS).
 * @param {import('express').Request} req
 * @returns {string}
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '0.0.0.0';
}

module.exports = {
  generateSessionToken,
  parseDevice,
  formatRelativeTime,
  maskIp,
  getClientIp,
};
