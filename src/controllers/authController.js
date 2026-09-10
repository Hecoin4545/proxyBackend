const User = require('../models/User');
const { generateOTP, sendOTPEmail } = require('../services/otpService');
const { generateAccessToken, generateRefreshToken, setRefreshCookie } = require('../utils/generateToken');

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
/**
 * Initiate signup: validate input, temporarily store user data, send OTP.
 * The user is NOT created in DB until OTP is verified.
 */
const signup = async (req, res, next) => {
  try {
    const { name, phone, college, email, password, confirmPassword } = req.body;

    // Basic validation
    if (!name || !phone || !college || !email || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }

    // Check if email already fully registered
    const existingUser = await User.findOne({ email: email.toLowerCase(), isVerified: true });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Generate OTP
    const { otp, expiry } = generateOTP();

    // Upsert a pending (unverified) user record to store OTP
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = new User({ name, phone, college, email: email.toLowerCase(), password, isVerified: false });
    } else {
      // Update existing unverified record with new data
      user.name = name;
      user.phone = phone;
      user.college = college;
      user.password = password;
    }
    user.otpCode = otp;
    user.otpExpiry = expiry;
    await user.save();

    // Send OTP via email
    await sendOTPEmail(email, name, otp);

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email. Please verify to complete signup.',
      email: email.toLowerCase(),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/verify-otp ───────────────────────────────────────────────
const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    // Load user with OTP fields (normally excluded by select: false)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+otpCode +otpExpiry +password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'No pending registration found for this email.' });
    }
    if (!user.otpCode) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please restart signup.' });
    }
    if (user.otpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }
    if (user.otpCode !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    // Mark verified and clear OTP
    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Issue tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      message: 'Account verified successfully! Welcome to ProxyTracker.',
      accessToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        college: user.college,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/login ────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Load user with password (excluded by default)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Account not verified. Please complete email verification.',
        email: user.email,
      });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    setRefreshCookie(res, refreshToken);

    res.json({
      success: true,
      message: 'Login successful.',
      accessToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        college: user.college,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
const logout = (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully.' });
};

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('createdClasses', 'name section classCode')
      .populate('joinedClasses', 'name section classCode');

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/resend-otp ───────────────────────────────────────────────
const resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+otpCode +otpExpiry');
    if (!user) return res.status(404).json({ success: false, message: 'No pending registration for this email.' });
    if (user.isVerified) return res.status(400).json({ success: false, message: 'Account already verified.' });

    const { otp, expiry } = generateOTP();
    user.otpCode = otp;
    user.otpExpiry = expiry;
    await user.save();

    await sendOTPEmail(email, user.name, otp);

    res.json({ success: true, message: 'New OTP sent to your email.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { signup, verifyOTP, login, logout, getMe, resendOTP };
