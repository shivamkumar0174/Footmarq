const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/dashboard', dashboardController.getDashboard);
router.get('/dashboard/account/:id', dashboardController.getAccountDetail);

module.exports = router;
