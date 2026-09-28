const express = require('express');
const router = express.Router();
const securityController = require('../controllers/securityController');

router.get('/security', securityController.getSecurity);

module.exports = router;
