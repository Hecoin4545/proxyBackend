const express = require('express');
const router = express.Router();
const {
  createClass,
  getMyClasses,
  getClassById,
  getClassByCode,
  joinClass,
  getClassMembers,
  removeMember,
} = require('../controllers/classController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', createClass);
router.get('/', getMyClasses);
router.post('/join', joinClass);
router.get('/code/:code', getClassByCode);
router.get('/:id', getClassById);
router.get('/:id/members', getClassMembers);
router.delete('/:id/members/:userId', removeMember);

module.exports = router;
