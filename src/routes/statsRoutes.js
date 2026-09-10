const express = require('express');
const router = express.Router();
const { getMyStats, getClassStats } = require('../controllers/statsController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/me', getMyStats);
router.get('/classes/:id', getClassStats);

module.exports = router;
