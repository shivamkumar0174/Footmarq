const nodemailer = require('nodemailer');

/**
 * Send OTP Code Email strictly to recipient inbox via Nodemailer
 */
async function sendOtpEmail(toEmail, otpCode) {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const from = process.env.FROM_EMAIL || `"Footmarq Security" <${user || 'security@footmarq.com'}>`;

  if (!user || !pass) {
    console.warn(`⚠️ SMTP Credentials missing in .env! Cannot send email to ${toEmail}. Please set SMTP_USER and SMTP_PASS in .env.`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: port === 465,
      auth: { user, pass }
    });

    const htmlTemplate = `
      <div style="background-color:#0f172a;padding:32px;font-family:sans-serif;color:#f8fafc;max-width:500px;margin:0 auto;border-radius:12px;border:1px solid #1e293b">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
          <span style="font-size:24px">🔐</span>
          <span style="font-size:18px;font-weight:bold;color:#38bdf8">Footmarq Security</span>
        </div>
        <h2 style="font-size:20px;margin-bottom:12px">Your Verification Code</h2>
        <p style="font-size:14px;color:#94a3b8;line-height:1.5;margin-bottom:24px">
          Use the 6-digit verification code below to complete your sign-in request. This code will expire in 10 minutes.
        </p>
        <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;text-align:center;margin-bottom:24px">
          <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#38bdf8">${otpCode}</span>
        </div>
        <p style="font-size:12px;color:#64748b;line-height:1.4">
          If you did not initiate this login request, please ignore this email or update your password immediately.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: from,
      to: toEmail,
      subject: `🔐 Your Footmarq Verification Code: ${otpCode}`,
      html: htmlTemplate
    });

    console.log(`✉️ OTP Email sent successfully to inbox: ${toEmail}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send OTP email to ${toEmail}:`, err.message);
    return false;
  }
}

module.exports = {
  sendOtpEmail
};
