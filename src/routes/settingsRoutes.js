const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

router.get('/settings', settingsController.getSettings);
router.post('/settings/profile', settingsController.updateProfile);

module.exports = router;
