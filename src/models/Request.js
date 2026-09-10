const mongoose = require('mongoose');

const REQUEST_STATUSES = ['PENDING', 'ACCEPTED', 'COMPLETED', 'CONFIRMED', 'REJECTED', 'CANCELLED'];

const requestSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    time: {
      type: String,
      required: [true, 'Time is required'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: 'PENDING',
    },
    completedAt: { type: Date },
    confirmedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Request', requestSchema);
module.exports.REQUEST_STATUSES = REQUEST_STATUSES;
