const nodemailer = require('nodemailer');

/**
 * Create a reusable Nodemailer transporter from env config
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

const FROM_EMAIL = () =>
  process.env.FROM_EMAIL ||
  `"Footmarq Security" <${process.env.SMTP_USER || 'security@footmarq.com'}>`;

/**
 * Send Login OTP Code Email (2FA)
 */
async function sendOtpEmail(toEmail, otpCode) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn(`⚠️  SMTP Credentials missing! Cannot send OTP to ${toEmail}. Set SMTP_USER and SMTP_PASS in .env`);
    return false;
  }

  const html = `
    <div style="background:#0f172a;padding:32px;font-family:sans-serif;color:#f8fafc;max-width:500px;margin:0 auto;border-radius:12px;border:1px solid #1e293b">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
        <span style="font-size:24px">🔐</span>
        <span style="font-size:18px;font-weight:bold;color:#38bdf8">Footmarq Security</span>
      </div>
      <h2 style="font-size:20px;margin-bottom:12px">Your Verification Code</h2>
      <p style="font-size:14px;color:#94a3b8;line-height:1.5;margin-bottom:24px">
        Use the 6-digit code below to complete your sign-in. This code expires in 10 minutes.
      </p>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;text-align:center;margin-bottom:24px">
        <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#38bdf8">${otpCode}</span>
      </div>
      <p style="font-size:12px;color:#64748b;line-height:1.4">
        If you did not request this, please ignore this email or update your password immediately.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM_EMAIL(),
      to: toEmail,
      subject: `🔐 Your Footmarq Login Code: ${otpCode}`,
      html
    });
    console.log(`✉️  OTP (login) sent to: ${toEmail}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send login OTP to ${toEmail}:`, err.message);
    return false;
  }
}

/**
 * Send Email Verification OTP for adding a secondary email address (Phase 2)
 */
async function sendEmailVerificationOtp(toEmail, otpCode) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn(`⚠️  SMTP Credentials missing! Cannot send email verification OTP to ${toEmail}.`);
    return false;
  }

  const html = `
    <div style="background:#0f172a;padding:32px;font-family:sans-serif;color:#f8fafc;max-width:520px;margin:0 auto;border-radius:12px;border:1px solid #1e293b">
      <div style="margin-bottom:24px">
        <span style="font-size:24px">📧</span>
        <span style="font-size:18px;font-weight:bold;color:#38bdf8;margin-left:8px">Footmarq</span>
      </div>
      <h2 style="font-size:20px;margin-bottom:8px">Verify your email address</h2>
      <p style="font-size:14px;color:#94a3b8;line-height:1.5;margin-bottom:24px">
        You requested to add <strong style="color:#f8fafc">${toEmail}</strong> to your Footmarq account.
        Enter this 6-digit verification code in the app to confirm. The code expires in <strong style="color:#f8fafc">15 minutes</strong>.
      </p>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
        <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#38bdf8">${otpCode}</span>
      </div>
      <div style="background:#172554;border:1px solid #1e40af;border-radius:8px;padding:16px;margin-bottom:20px">
        <p style="font-size:13px;color:#93c5fd;margin:0;line-height:1.5">
          🛡️ Once verified, you can connect Gmail to scan email metadata (sender, subject, date) 
          for account discovery. We never read or store email body content.
        </p>
      </div>
      <p style="font-size:12px;color:#64748b;line-height:1.4">
        If you did not request to add this email, please ignore this message. 
        No changes have been made to your account.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM_EMAIL(),
      to: toEmail,
      subject: `📧 Verify your email — Footmarq code: ${otpCode}`,
      html
    });
    console.log(`✉️  Verification OTP sent to secondary email: ${toEmail}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send verification OTP to ${toEmail}:`, err.message);
    return false;
  }
}

/**
 * Send Data Export Email with JSON attachment
 */
async function sendDataExportEmail(toEmail, userName, exportJson) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn(`⚠️  SMTP missing! Cannot send data export to ${toEmail}.`);
    return false;
  }

  const html = `
    <div style="background:#0f172a;padding:32px;font-family:sans-serif;color:#f8fafc;max-width:520px;margin:0 auto;border-radius:12px;border:1px solid #1e293b">
      <div style="margin-bottom:24px">
        <span style="font-size:24px">📥</span>
        <span style="font-size:18px;font-weight:bold;color:#38bdf8;margin-left:8px">Footmarq</span>
      </div>
      <h2 style="font-size:20px;margin-bottom:8px">Your Data Export is Ready</h2>
      <p style="font-size:14px;color:#94a3b8;line-height:1.5;margin-bottom:20px">
        Hi <strong style="color:#f8fafc">${userName}</strong>, your Footmarq account data export is attached to this email as a JSON file.
        It contains your profile, linked email accounts, breach history, and discovered accounts.
      </p>
      <div style="background:#172554;border:1px solid #1e40af;border-radius:8px;padding:16px;margin-bottom:20px">
        <p style="font-size:13px;color:#93c5fd;margin:0;line-height:1.5">
          🛡️ <strong>Keep this file secure.</strong> It contains your personal data. Do not share it with untrusted parties.
        </p>
      </div>
      <p style="font-size:12px;color:#64748b;line-height:1.4">
        If you did not request this export, please contact support immediately and change your password.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM_EMAIL(),
      to: toEmail,
      subject: `📥 Your Footmarq Data Export`,
      html,
      attachments: [{
        filename: `footmarq-export-${Date.now()}.json`,
        content: exportJson,
        contentType: 'application/json'
      }]
    });
    console.log(`✉️  Data export sent to: ${toEmail}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send data export to ${toEmail}:`, err.message);
    return false;
  }
}

/**
 * Send Account Deletion Confirmation Email
 */
async function sendAccountDeletionEmail(toEmail, userName, cancelDeadline) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn(`⚠️  SMTP missing! Cannot send deletion email to ${toEmail}.`);
    return false;
  }

  const html = `
    <div style="background:#0f172a;padding:32px;font-family:sans-serif;color:#f8fafc;max-width:520px;margin:0 auto;border-radius:12px;border:1px solid #1e293b">
      <div style="margin-bottom:24px">
        <span style="font-size:24px">🗑️</span>
        <span style="font-size:18px;font-weight:bold;color:#f87171;margin-left:8px">Account Deletion Scheduled</span>
      </div>
      <h2 style="font-size:20px;margin-bottom:8px">Your account will be deleted</h2>
      <p style="font-size:14px;color:#94a3b8;line-height:1.5;margin-bottom:20px">
        Hi <strong style="color:#f8fafc">${userName}</strong>, we've received your request to permanently delete your Footmarq account.
        All your data — profile, emails, breach history, and discovered accounts — will be erased on the deletion date.
      </p>
      <div style="background:#450a0a;border:1px solid #7f1d1d;border-radius:8px;padding:16px;margin-bottom:20px">
        <p style="font-size:13px;color:#fca5a5;margin:0 0 6px 0;font-weight:600">⏳ Deletion deadline: ${cancelDeadline}</p>
        <p style="font-size:12px;color:#fca5a5;margin:0;line-height:1.5">
          You have 30 days to cancel this request. Simply log in and visit Settings → Privacy → Cancel Deletion.
        </p>
      </div>
      <p style="font-size:12px;color:#64748b;line-height:1.4">
        If you did not request this, log in immediately, cancel the deletion, and change your password.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM_EMAIL(),
      to: toEmail,
      subject: `🗑️ Footmarq Account Deletion Scheduled`,
      html
    });
    console.log(`✉️  Deletion confirmation sent to: ${toEmail}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send deletion email to ${toEmail}:`, err.message);
    return false;
  }
}

module.exports = {
  sendOtpEmail,
  sendEmailVerificationOtp,
  sendDataExportEmail,
  sendAccountDeletionEmail
};
