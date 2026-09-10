const nodemailer = require('nodemailer');

// Cache the transporter so we don't create a new Ethereal account every restart
let transporter = null;

/**
 * Get or create the Nodemailer transporter.
 * In development with no credentials, auto-creates an Ethereal test account.
 */
const getTransporter = async () => {
  if (transporter) return transporter;

  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    // Use configured SMTP (Gmail, SendGrid, etc.)
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10),
      secure: parseInt(process.env.EMAIL_PORT, 10) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  } else {
    // Auto-create Ethereal test account for development
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('📧 Using Ethereal test email account:', testAccount.user);
    console.log('📬 View emails at: https://ethereal.email');
  }

  return transporter;
};

/**
 * Generate a 6-digit OTP and expiry (10 minutes)
 */
const generateOTP = () => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return { otp, expiry };
};

/**
 * Send OTP email to a user
 */
const sendOTPEmail = async (email, name, otp) => {
  const transport = await getTransporter();

  const mailOptions = {
    from: `"ProxyTracker" <noreply@proxytracker.app>`,
    to: email,
    subject: 'Your ProxyTracker Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">ProxyTracker</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0 0; font-size: 14px;">College Class Coordination</p>
        </div>
        <h2 style="color: #1e293b;">Hi ${name}! 👋</h2>
        <p style="color: #475569;">Enter this verification code to complete your registration:</p>
        <div style="background: white; border: 2px solid #e2e8f0; border-radius: 8px; padding: 24px; text-align: center; margin: 20px 0;">
          <span style="font-size: 40px; font-weight: 800; color: #6366f1; letter-spacing: 8px;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 14px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">If you did not request this code, you can safely ignore this email.</p>
      </div>
    `,
  };

  const info = await transport.sendMail(mailOptions);

  // Log preview URL in development
  if (process.env.NODE_ENV !== 'production') {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📨 OTP email preview: ${previewUrl}`);
    }
  }

  return info;
};

module.exports = { generateOTP, sendOTPEmail };
