const express = require('express');
const router = express.Router();
const {
  createRequest,
  getSentRequests,
  getReceivedRequests,
  getRequestById,
  acceptRequest,
  rejectRequest,
  completeRequest,
  confirmRequest,
  cancelRequest,
} = require('../controllers/requestController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', createRequest);
router.get('/sent', getSentRequests);
router.get('/received', getReceivedRequests);
router.get('/:id', getRequestById);
router.patch('/:id/accept', acceptRequest);
router.patch('/:id/reject', rejectRequest);
router.patch('/:id/complete', completeRequest);
router.patch('/:id/confirm', confirmRequest);
router.patch('/:id/cancel', cancelRequest);

module.exports = router;
