const Notification = require('../models/Notification');

/**
 * Create a notification for a user.
 * @param {Object} opts
 * @param {string} opts.recipient - User ObjectId who receives the notification
 * @param {string} opts.sender   - User ObjectId who triggered the event
 * @param {string} opts.type     - NOTIFICATION_TYPE constant
 * @param {string} opts.message  - Human-readable message
 * @param {string} [opts.requestId]
 * @param {string} [opts.classId]
 */
const createNotification = async ({ recipient, sender, type, message, requestId, classId }) => {
  try {
    await Notification.create({
      recipient,
      sender,
      type,
      message,
      requestId,
      classId,
    });
  } catch (err) {
    // Notifications are non-critical — log but don't crash the request
    console.error('Notification creation failed:', err.message);
  }
};

module.exports = { createNotification };
