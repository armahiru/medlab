/**
 * Create in-app notification + optional email + optional SMS (text).
 */
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendEmail } = require('./email');
const { sendSms } = require('./sms');

async function notifyUser({
  userId,
  type = 'system',
  title,
  message,
  link = '',
  emailSubject,
  emailBody,
  smsBody,
}) {
  if (!userId) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  let emailSent = false;
  let smsSent = false;

  if (user.email && emailSubject) {
    const result = await sendEmail({
      to: user.email,
      subject: emailSubject,
      text: emailBody || message,
    });
    emailSent = result.sent;
  }

  // Text/SMS only when an explicit SMS body is provided
  if (smsBody && user.phone) {
    const result = await sendSms({
      to: user.phone,
      body: smsBody,
    });
    smsSent = result.sent;
  }

  const notification = await Notification.create({
    user: user._id,
    type,
    title,
    message,
    link,
    emailSent,
    smsSent,
  });

  return notification;
}

async function notifyAdmins({ type, title, message, link, emailSubject, emailBody, smsBody }) {
  const admins = await User.find({ role: 'Admin' });
  const results = [];

  for (const admin of admins) {
    const n = await notifyUser({
      userId: admin._id,
      type,
      title,
      message,
      link,
      emailSubject,
      emailBody,
      smsBody,
    });
    if (n) results.push(n);
  }

  return results;
}

/**
 * Notify patient Recipient account by hospital Patient ID.
 * Channels: in-app always; email + SMS when configured and contact details exist.
 */
async function notifyPatientById(patientId, payload) {
  if (!patientId) return null;
  const patient = await User.findOne({ role: 'Recipient', patientId });
  if (!patient) {
    console.log(`[MediChain Notify] No patient account for Patient ID ${patientId} — skipped`);
    return null;
  }
  return notifyUser({ userId: patient._id, ...payload });
}

module.exports = {
  notifyUser,
  notifyAdmins,
  notifyPatientById,
};
