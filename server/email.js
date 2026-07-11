// Optional email notifications (viewed / accepted). Soft-fails silently when
// SMTP is not configured — the app never depends on email to function.
const nodemailer = require('nodemailer');

/**
 * @returns {Promise<boolean>} true if a send was attempted, false if SMTP unconfigured.
 */
async function sendNotification(settings, subject, text) {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, notify_email } = settings;
  if (!smtp_host || !notify_email) return false;
  const transport = nodemailer.createTransport({
    host: smtp_host,
    port: Number(smtp_port) || 587,
    secure: Number(smtp_port) === 465,
    auth: smtp_user ? { user: smtp_user, pass: smtp_pass } : undefined
  });
  await transport.sendMail({
    from: smtp_from || smtp_user,
    to: notify_email,
    subject,
    text
  });
  return true;
}

module.exports = { sendNotification };
