const Class = require('../models/Class');
const User = require('../models/User');
const generateClassCode = require('../utils/generateClassCode');
const { createNotification } = require('../services/notificationService');
const { logActivity } = require('../services/statsService');

// ─── POST /api/classes ────────────────────────────────────────────────────────
const createClass = async (req, res, next) => {
  try {
    const { name, section, college, department, semester, year, description } = req.body;

    if (!name || !section || !college || !department || !semester || !year) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
    }

    const classCode = await generateClassCode(name);

    const newClass = await Class.create({
      name,
      section,
      college,
      department,
      semester: Number(semester),
      year: Number(year),
      description: description || '',
      classCode,
      owner: req.user._id,
      members: [req.user._id], // Creator is auto-added as member
    });

    // Update user's createdClasses and joinedClasses
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: {
        createdClasses: newClass._id,
        joinedClasses: newClass._id,
      },
    });

    await logActivity({
      user: req.user._id,
      type: 'CLASS_CREATED',
      description: `Created class ${name} - Section ${section}`,
      classId: newClass._id,
    });

    res.status(201).json({
      success: true,
      message: 'Class created successfully.',
      data: newClass,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/classes ─────────────────────────────────────────────────────────
const getMyClasses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const allClassIds = [...new Set([
      ...user.createdClasses.map(id => id.toString()),
      ...user.joinedClasses.map(id => id.toString()),
    ])];

    const classes = await Class.find({ _id: { $in: allClassIds } })
      .populate('owner', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: classes });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/classes/:id ─────────────────────────────────────────────────────
const getClassById = async (req, res, next) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate('owner', 'name email profilePicture')
      .populate('members', 'name email college profilePicture');

    if (!cls) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    // Only members can view class details
    const isMember = cls.members.some(m => m._id.toString() === req.user._id.toString());
    if (!isMember) {
      // Return basic info for join page
      return res.status(200).json({
        success: true,
        data: {
          _id: cls._id,
          name: cls.name,
          section: cls.section,
          college: cls.college,
          department: cls.department,
          semester: cls.semester,
          year: cls.year,
          classCode: cls.classCode,
          memberCount: cls.members.length,
          isMember: false,
        },
      });
    }

    res.json({ success: true, data: { ...cls.toObject(), isMember: true } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/classes/code/:code ──────────────────────────────────────────────
const getClassByCode = async (req, res, next) => {
  try {
    const cls = await Class.findOne({ classCode: req.params.code.toUpperCase() })
      .populate('owner', 'name email')
      .select('-members');

    if (!cls) {
      return res.status(404).json({ success: false, message: 'Class not found. Check the code and try again.' });
    }

    const memberCount = await Class.findById(cls._id).select('members');

    res.json({
      success: true,
      data: {
        _id: cls._id,
        name: cls.name,
        section: cls.section,
        college: cls.college,
        department: cls.department,
        semester: cls.semester,
        year: cls.year,
        classCode: cls.classCode,
        owner: cls.owner,
        memberCount: memberCount.members.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/classes/join ───────────────────────────────────────────────────
const joinClass = async (req, res, next) => {
  try {
    const { classCode } = req.body;

    if (!classCode) {
      return res.status(400).json({ success: false, message: 'Class code is required.' });
    }

    const cls = await Class.findOne({ classCode: classCode.toUpperCase().trim() });
    if (!cls) {
      return res.status(404).json({ success: false, message: 'Invalid class code. Class not found.' });
    }

    // Prevent duplicate membership
    const alreadyMember = cls.members.some(m => m.toString() === req.user._id.toString());
    if (alreadyMember) {
      return res.status(409).json({ success: false, message: 'You are already a member of this class.' });
    }

    // Add to members
    cls.members.push(req.user._id);
    await cls.save();

    // Update user's joinedClasses
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { joinedClasses: cls._id },
    });

    // Notify class owner
    if (cls.owner.toString() !== req.user._id.toString()) {
      await createNotification({
        recipient: cls.owner,
        sender: req.user._id,
        type: 'CLASS_JOINED',
        message: `${req.user.name} joined your class ${cls.name}`,
        classId: cls._id,
      });
    }

    await logActivity({
      user: req.user._id,
      type: 'CLASS_JOINED',
      description: `Joined ${cls.name} - Section ${cls.section}`,
      classId: cls._id,
    });

    res.json({ success: true, message: `Successfully joined ${cls.name}!`, data: cls });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/classes/:id/members ────────────────────────────────────────────
const getClassMembers = async (req, res, next) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate('members', 'name email college profilePicture');

    if (!cls) return res.status(404).json({ success: false, message: 'Class not found.' });

    const isMember = cls.members.some(m => m._id.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'You are not a member of this class.' });
    }

    res.json({ success: true, data: cls.members });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/classes/:id/members/:userId ─────────────────────────────────
const removeMember = async (req, res, next) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found.' });

    // Only owner can remove members (unless user is leaving themselves)
    const isOwner = cls.owner.toString() === req.user._id.toString();
    const isSelf = req.params.userId === req.user._id.toString();

    if (!isOwner && !isSelf) {
      return res.status(403).json({ success: false, message: 'Not authorized to remove this member.' });
    }
    if (isOwner && req.params.userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Class owner cannot leave the class.' });
    }

    cls.members = cls.members.filter(m => m.toString() !== req.params.userId);
    await cls.save();

    await User.findByIdAndUpdate(req.params.userId, {
      $pull: { joinedClasses: cls._id },
    });

    res.json({ success: true, message: 'Member removed successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createClass, getMyClasses, getClassById, getClassByCode, joinClass, getClassMembers, removeMember };
