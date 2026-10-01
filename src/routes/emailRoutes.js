const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');

// ── Page ──────────────────────────────────────────────────────────────────────
router.get('/emails', emailController.getEmails);

// ── Email CRUD ────────────────────────────────────────────────────────────────
router.post('/api/emails', emailController.addEmail);
router.delete('/api/emails/:emailId', emailController.deleteEmail);
router.put('/api/emails/:emailId/settings', emailController.updateEmailSettings);

// ── OTP Verification ──────────────────────────────────────────────────────────
router.post('/api/emails/:emailId/verify', emailController.verifyEmailOtp);
router.post('/api/emails/:emailId/resend-otp', emailController.resendEmailOtp);

// ── Gmail Connect / Disconnect ────────────────────────────────────────────────
router.get('/emails/:emailId/gmail/connect', emailController.connectGmail);
router.get('/emails/gmail/callback', emailController.gmailConnectCallback);
router.post('/api/emails/:emailId/gmail/disconnect', emailController.disconnectGmail);

// ── Scan Management ───────────────────────────────────────────────────────────
router.post('/api/emails/:emailId/scan', emailController.triggerScan);
router.get('/api/emails/:emailId/scan/status', emailController.getScanStatus);
router.get('/api/emails/:emailId/scans', emailController.getScanHistory);

module.exports = router;
