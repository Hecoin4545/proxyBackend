const Class = require('../models/Class');

/**
 * Generate a unique 8-character alphanumeric class code
 * Format: 4 letters from class name prefix + 4 random digits
 */
const generateClassCode = async (className) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let code;
  let isUnique = false;

  // Prefix: first 4 alphanumeric chars from class name
  const prefix = className
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');

  while (!isUnique) {
    // 4 random chars suffix
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    code = prefix + suffix;

    // Check uniqueness in DB
    const existing = await Class.findOne({ classCode: code });
    if (!existing) isUnique = true;
  }

  return code;
};

module.exports = generateClassCode;
