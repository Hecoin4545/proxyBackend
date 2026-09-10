const Request = require('../models/Request');
const Class = require('../models/Class');
const Activity = require('../models/Activity');
const User = require('../models/User');

// ─── GET /api/stats/me ────────────────────────────────────────────────────────
const getMyStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [
      requestsSent,
      requestsReceived,
      completedSent,
      completedReceived,
      pendingSent,
      pendingReceived,
      rejectedSent,
      rejectedReceived,
      user,
      recentActivity,
    ] = await Promise.all([
      Request.countDocuments({ sender: userId }),
      Request.countDocuments({ receiver: userId }),
      Request.countDocuments({ sender: userId, status: 'CONFIRMED' }),
      Request.countDocuments({ receiver: userId, status: 'CONFIRMED' }),
      Request.countDocuments({ sender: userId, status: 'PENDING' }),
      Request.countDocuments({ receiver: userId, status: 'PENDING' }),
      Request.countDocuments({ sender: userId, status: 'REJECTED' }),
      Request.countDocuments({ receiver: userId, status: 'REJECTED' }),
      User.findById(userId),
      Activity.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('classId', 'name section')
        .populate('requestId', 'status'),
    ]);

    // Monthly request data for chart (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const monthlyData = await Request.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartData = monthlyData.map(d => ({
      month: months[d._id.month - 1],
      requests: d.count,
    }));

    res.json({
      success: true,
      data: {
        requestsSent,
        requestsReceived,
        totalRequests: requestsSent + requestsReceived,
        completed: completedSent + completedReceived,
        pending: pendingSent + pendingReceived,
        rejected: rejectedSent + rejectedReceived,
        classesCreated: user.createdClasses.length,
        classesJoined: user.joinedClasses.length,
        totalClasses: new Set([
          ...user.createdClasses.map(id => id.toString()),
          ...user.joinedClasses.map(id => id.toString()),
        ]).size,
        recentActivity,
        chartData,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/stats/classes/:id ───────────────────────────────────────────────
const getClassStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cls = await Class.findById(id);

    if (!cls) return res.status(404).json({ success: false, message: 'Class not found.' });

    // Must be a member to see class stats
    const isMember = cls.members.some(m => m.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Not a member of this class.' });
    }

    const [totalRequests, completed, pending, rejected, accepted] = await Promise.all([
      Request.countDocuments({ classId: id }),
      Request.countDocuments({ classId: id, status: 'CONFIRMED' }),
      Request.countDocuments({ classId: id, status: 'PENDING' }),
      Request.countDocuments({ classId: id, status: 'REJECTED' }),
      Request.countDocuments({ classId: id, status: 'ACCEPTED' }),
    ]);

    // Monthly activity for this class
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

    const monthlyData = await Request.aggregate([
      { $match: { classId: cls._id, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartData = monthlyData.map(d => ({
      month: months[d._id.month - 1],
      requests: d.count,
    }));

    res.json({
      success: true,
      data: {
        totalMembers: cls.members.length,
        totalRequests,
        completed,
        pending,
        rejected,
        accepted,
        chartData,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMyStats, getClassStats };
