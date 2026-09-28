const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/', authController.getLanding);
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);
router.get('/logout', authController.logout);
router.get('/register', authController.getRegister);
router.post('/register', authController.postRegister);
router.get('/verify-email', authController.verifyEmail);
router.get('/forgot-password', authController.forgotPassword);
router.get('/onboarding', authController.getOnboarding);

// ── OTP Verification Routes ──────────────────────────────────
router.get('/verify-otp', authController.getVerifyOtp);
router.post('/verify-otp', authController.postVerifyOtp);
router.get('/resend-otp', authController.resendOtp);

// ── Google OAuth Routes ───────────────────────────────────────
router.get('/auth/google', authController.googleLogin);
router.get('/auth/google/callback', authController.googleCallback);
router.get('/auth/google/sandbox', authController.googleSandbox);

module.exports = router;
