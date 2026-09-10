const express = require('express');
const router = express.Router();
const { getMyProfile, updateMyProfile, getUserById } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // All user routes require authentication

router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);
router.get('/:id', getUserById);

module.exports = router;
