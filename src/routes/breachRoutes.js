const express = require('express');
const router = express.Router();
const breachController = require('../controllers/breachController');

router.get('/breaches', breachController.getBreaches);
router.post('/breaches/scan', breachController.triggerScan);
router.post('/breaches/:id/resolve', breachController.resolveBreach);
router.delete('/breaches/:id', breachController.deleteBreach);

module.exports = router;
