const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      trim: true,
    },
    college: {
      type: String,
      required: [true, 'College is required'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 10,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    classCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Class', classSchema);
