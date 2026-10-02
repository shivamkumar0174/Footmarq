const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const privacyController = require('../controllers/privacyController');

// ── Settings View ────────────────────────────────────────────────────────────
router.get('/settings', settingsController.getSettings);

// ── Profile ──────────────────────────────────────────────────────────────────
router.post('/settings/profile', settingsController.updateProfile);

// ── Security ─────────────────────────────────────────────────────────────────
router.post('/settings/security/password', settingsController.updatePassword);
router.post('/settings/security/2fa/toggle', settingsController.toggle2FA);

// ── Sessions ─────────────────────────────────────────────────────────────────
router.post('/settings/sessions/terminate-all', settingsController.terminateAllSessions);
router.post('/settings/sessions/:id/terminate', settingsController.terminateSession);

// ── Privacy ───────────────────────────────────────────────────────────────────
// Data export (sends JSON to email + optional direct download)
router.post('/settings/privacy/export', privacyController.exportData);
// Direct download link (GET)
router.get('/settings/privacy/export/download', privacyController.exportData);

// Gmail disconnect (all or per-email via body.emailId)
router.post('/settings/privacy/disconnect-gmail', privacyController.disconnectGmail);

// Account deletion scheduling
router.post('/settings/privacy/delete-account', privacyController.requestDeleteAccount);

// Cancel scheduled deletion
router.post('/settings/privacy/cancel-deletion', privacyController.cancelDeleteAccount);

// Privacy preferences (toggles)
router.post('/settings/privacy/preferences', privacyController.updatePrivacyPreferences);

module.exports = router;
