const express = require('express');
const router = express.Router();
const breachController = require('../controllers/breachController');

router.get('/breaches', breachController.getBreaches);

module.exports = router;
