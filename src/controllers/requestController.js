const Request = require('../models/Request');
const Class = require('../models/Class');
const { createNotification } = require('../services/notificationService');
const { logActivity } = require('../services/statsService');

// ─── POST /api/requests ───────────────────────────────────────────────────────
const createRequest = async (req, res, next) => {
  try {
    const { receiverId, classId, date, time, subject, description } = req.body;

    if (!receiverId || !classId || !date || !time || !subject) {
      return res.status(400).json({ success: false, message: 'receiverId, classId, date, time, and subject are required.' });
    }
    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot send a request to yourself.' });
    }

    // Validate both users are in the class
    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found.' });

    const memberIds = cls.members.map(m => m.toString());
    if (!memberIds.includes(req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'You are not a member of this class.' });
    }
    if (!memberIds.includes(receiverId)) {
      return res.status(400).json({ success: false, message: 'The receiver is not a member of this class.' });
    }

    // Prevent duplicate pending request
    const existing = await Request.findOne({
      sender: req.user._id,
      receiver: receiverId,
      classId,
      status: 'PENDING',
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You already have a pending request to this person for this class.' });
    }

    const request = await Request.create({
      sender: req.user._id,
      receiver: receiverId,
      classId,
      date: new Date(date),
      time,
      subject,
      description: description || '',
      status: 'PENDING',
    });

    // Notify receiver
    await createNotification({
      recipient: receiverId,
      sender: req.user._id,
      type: 'REQUEST_RECEIVED',
      message: `${req.user.name} sent you a request for ${cls.name}`,
      requestId: request._id,
      classId: cls._id,
    });

    await logActivity({
      user: req.user._id,
      type: 'REQUEST_SENT',
      description: `Sent a request in ${cls.name}`,
      classId: cls._id,
      requestId: request._id,
    });

    const populated = await request.populate([
      { path: 'sender', select: 'name email profilePicture' },
      { path: 'receiver', select: 'name email profilePicture' },
      { path: 'classId', select: 'name section' },
    ]);

    res.status(201).json({ success: true, message: 'Request sent successfully.', data: populated });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/requests/sent ───────────────────────────────────────────────────
const getSentRequests = async (req, res, next) => {
  try {
    const requests = await Request.find({ sender: req.user._id })
      .populate('receiver', 'name email profilePicture')
      .populate('classId', 'name section')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/requests/received ──────────────────────────────────────────────
const getReceivedRequests = async (req, res, next) => {
  try {
    const requests = await Request.find({ receiver: req.user._id })
      .populate('sender', 'name email profilePicture')
      .populate('classId', 'name section')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/requests/:id ────────────────────────────────────────────────────
const getRequestById = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('sender', 'name email profilePicture')
      .populate('receiver', 'name email profilePicture')
      .populate('classId', 'name section');

    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

    const userId = req.user._id.toString();
    if (request.sender._id.toString() !== userId && request.receiver._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this request.' });
    }

    res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
};

// ─── Helper: update request status ───────────────────────────────────────────
const updateStatus = async (req, res, next, newStatus, authorizedRole) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('sender', 'name email')
      .populate('receiver', 'name email')
      .populate('classId', 'name');

    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

    const userId = req.user._id.toString();
    const senderId = request.sender._id.toString();
    const receiverId = request.receiver._id.toString();

    if (authorizedRole === 'receiver' && receiverId !== userId) {
      return res.status(403).json({ success: false, message: 'Only the request receiver can perform this action.' });
    }
    if (authorizedRole === 'sender' && senderId !== userId) {
      return res.status(403).json({ success: false, message: 'Only the request sender can perform this action.' });
    }
    if (authorizedRole === 'either' && senderId !== userId && receiverId !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    // Status transition validation
    const validTransitions = {
      ACCEPTED: ['PENDING'],
      REJECTED: ['PENDING'],
      COMPLETED: ['ACCEPTED'],
      CONFIRMED: ['COMPLETED'],
      CANCELLED: ['PENDING', 'ACCEPTED'],
    };

    if (!validTransitions[newStatus]?.includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from ${request.status} to ${newStatus}.`,
      });
    }

    request.status = newStatus;
    if (newStatus === 'COMPLETED') request.completedAt = new Date();
    if (newStatus === 'CONFIRMED') request.confirmedAt = new Date();
    await request.save();

    // Notification and activity
    const notifMap = {
      ACCEPTED: { type: 'REQUEST_ACCEPTED', recipient: senderId, msg: `${req.user.name} accepted your request` },
      REJECTED: { type: 'REQUEST_REJECTED', recipient: senderId, msg: `${req.user.name} rejected your request` },
      COMPLETED: { type: 'REQUEST_COMPLETED', recipient: senderId, msg: `${req.user.name} marked the request as completed` },
      CONFIRMED: { type: 'REQUEST_CONFIRMED', recipient: receiverId, msg: `${req.user.name} confirmed the request` },
    };

    if (notifMap[newStatus]) {
      const n = notifMap[newStatus];
      await createNotification({
        recipient: n.recipient,
        sender: req.user._id,
        type: n.type,
        message: n.msg,
        requestId: request._id,
        classId: request.classId._id,
      });
    }

    await logActivity({
      user: req.user._id,
      type: `REQUEST_${newStatus}`,
      description: `Request ${newStatus.toLowerCase()} in ${request.classId.name}`,
      classId: request.classId._id,
      requestId: request._id,
    });

    res.json({ success: true, message: `Request ${newStatus.toLowerCase()} successfully.`, data: request });
  } catch (err) {
    next(err);
  }
};

const acceptRequest = (req, res, next) => updateStatus(req, res, next, 'ACCEPTED', 'receiver');
const rejectRequest = (req, res, next) => updateStatus(req, res, next, 'REJECTED', 'receiver');
const completeRequest = (req, res, next) => updateStatus(req, res, next, 'COMPLETED', 'receiver');
const confirmRequest = (req, res, next) => updateStatus(req, res, next, 'CONFIRMED', 'sender');
const cancelRequest = (req, res, next) => updateStatus(req, res, next, 'CANCELLED', 'either');

module.exports = {
  createRequest,
  getSentRequests,
  getReceivedRequests,
  getRequestById,
  acceptRequest,
  rejectRequest,
  completeRequest,
  confirmRequest,
  cancelRequest,
};
