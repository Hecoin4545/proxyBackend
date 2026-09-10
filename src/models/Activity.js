const mongoose = require('mongoose');

const ACTIVITY_TYPES = [
  'CLASS_CREATED',
  'CLASS_JOINED',
  'REQUEST_SENT',
  'REQUEST_ACCEPTED',
  'REQUEST_REJECTED',
  'REQUEST_COMPLETED',
  'REQUEST_CONFIRMED',
  'REQUEST_CANCELLED',
];

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ACTIVITY_TYPES,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
    },
  },
  { timestamps: true }
);

// Index for fast per-user queries sorted by date
activitySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
