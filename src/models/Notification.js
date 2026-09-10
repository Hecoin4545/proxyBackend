const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'REQUEST_RECEIVED',
  'REQUEST_ACCEPTED',
  'REQUEST_REJECTED',
  'REQUEST_COMPLETED',
  'REQUEST_CONFIRMED',
  'CLASS_JOINED',
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for fast per-user queries
notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
