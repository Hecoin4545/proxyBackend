const User = require('../models/User');

// ─── GET /api/users/me ────────────────────────────────────────────────────────
const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('createdClasses', 'name section classCode college department semester')
      .populate('joinedClasses', 'name section classCode college department semester');
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/users/me ────────────────────────────────────────────────────────
const updateMyProfile = async (req, res, next) => {
  try {
    const { name, phone, college, profilePicture } = req.body;

    // Only allow safe fields to be updated
    const updates = {};
    if (name) updates.name = name.trim();
    if (phone) updates.phone = phone.trim();
    if (college) updates.college = college.trim();
    if (profilePicture !== undefined) updates.profilePicture = profilePicture;

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, message: 'Profile updated successfully.', data: user });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('name email college profilePicture');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMyProfile, updateMyProfile, getUserById };
