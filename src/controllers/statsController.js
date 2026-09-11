const Request = require('../models/Request');
const Class = require('../models/Class');
const Activity = require('../models/Activity');
const User = require('../models/User');

const VALID_PROXY_STATUSES = ['ACCEPTED', 'COMPLETED', 'CONFIRMED'];

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
      proxiesMadeCount,
      proxiesReceivedCount,
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
      // Proxies made by user (receiver = userId, status is accepted/completed/confirmed)
      Request.countDocuments({ receiver: userId, status: { $in: VALID_PROXY_STATUSES } }),
      // Proxies made for user by others (sender = userId, status is accepted/completed/confirmed)
      Request.countDocuments({ sender: userId, status: { $in: VALID_PROXY_STATUSES } }),
      User.findById(userId),
      Activity.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('classId', 'name section')
        .populate('requestId', 'status'),
    ]);

    // Top users current user has proxied for (receiver == userId)
    const topMadeForAgg = await Request.aggregate([
      { $match: { receiver: userId, status: { $in: VALID_PROXY_STATUSES } } },
      { $group: { _id: '$sender', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    const topMadeForUsers = await User.find({ _id: { $in: topMadeForAgg.map(i => i._id) } }).select('name email profilePicture college');
    const topProxiesMadeFor = topMadeForAgg.map(item => ({
      user: topMadeForUsers.find(u => u._id.toString() === item._id.toString()) || { _id: item._id, name: 'Unknown Student' },
      count: item.count
    }));

    // Top users who have proxied for current user (sender == userId)
    const topReceivedFromAgg = await Request.aggregate([
      { $match: { sender: userId, status: { $in: VALID_PROXY_STATUSES } } },
      { $group: { _id: '$receiver', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    const topReceivedFromUsers = await User.find({ _id: { $in: topReceivedFromAgg.map(i => i._id) } }).select('name email profilePicture college');
    const topProxiesReceivedFrom = topReceivedFromAgg.map(item => ({
      user: topReceivedFromUsers.find(u => u._id.toString() === item._id.toString()) || { _id: item._id, name: 'Unknown Student' },
      count: item.count
    }));

    // Monthly request and proxy breakdown for chart (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const monthlyRequests = await Request.find({
      $or: [{ sender: userId }, { receiver: userId }],
      createdAt: { $gte: sixMonthsAgo }
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyMap = {};

    // Initialize 6 months map
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mKey = `${d.getFullYear()}-${d.getMonth()}`;
      const label = months[d.getMonth()];
      monthlyMap[mKey] = { month: label, requests: 0, proxiesMade: 0, proxiesReceived: 0 };
    }

    monthlyRequests.forEach(reqItem => {
      const d = new Date(reqItem.createdAt);
      const mKey = `${d.getFullYear()}-${d.getMonth()}`;
      if (monthlyMap[mKey]) {
        monthlyMap[mKey].requests += 1;
        if (VALID_PROXY_STATUSES.includes(reqItem.status)) {
          if (reqItem.receiver.toString() === userId.toString()) {
            monthlyMap[mKey].proxiesMade += 1;
          }
          if (reqItem.sender.toString() === userId.toString()) {
            monthlyMap[mKey].proxiesReceived += 1;
          }
        }
      }
    });

    const chartData = Object.values(monthlyMap);

    const createdClassesCount = user?.createdClasses?.length || 0;
    const joinedClassesCount = user?.joinedClasses?.length || 0;
    const totalClassesCount = new Set([
      ...(user?.createdClasses || []).map(id => id.toString()),
      ...(user?.joinedClasses || []).map(id => id.toString()),
    ]).size;

    res.json({
      success: true,
      data: {
        requestsSent,
        requestsReceived,
        totalRequests: requestsSent + requestsReceived,
        completed: completedSent + completedReceived,
        pending: pendingSent + pendingReceived,
        rejected: rejectedSent + rejectedReceived,
        proxiesMadeCount,
        proxiesReceivedCount,
        topProxiesMadeFor,
        topProxiesReceivedFrom,
        mostProxiesMadeFor: topProxiesMadeFor[0] || null,
        mostProxiesReceivedFrom: topProxiesReceivedFrom[0] || null,
        classesCreated: createdClassesCount,
        classesJoined: joinedClassesCount,
        totalClasses: totalClassesCount,
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
