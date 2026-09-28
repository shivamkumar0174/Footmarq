const express = require('express');
const router = express.Router();
const cleanupController = require('../controllers/cleanupController');

router.get('/cleanup', cleanupController.getCleanup);

module.exports = router;
