const Activity = require('../models/Activity');

/**
 * Log an activity entry for a user.
 * Non-blocking — errors are caught and logged only.
 */
const logActivity = async ({ user, type, description, classId, requestId }) => {
  try {
    await Activity.create({ user, type, description, classId, requestId });
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
};

module.exports = { logActivity };
