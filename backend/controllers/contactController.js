const ContactMessage = require('../models/ContactMessage');
const { notifyAdmins } = require('../utils/notify');
const { sendEmail } = require('../utils/email');

/**
 * POST /api/contact — patient/staff contact hospital
 */
async function submitContact(req, res, next) {
  try {
    const { name, email, phone = '', subject, message, patientId = '' } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        message: 'Name, email, subject, and message are required.',
      });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const contact = await ContactMessage.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: String(phone || '').trim(),
      subject: subject.trim(),
      message: message.trim(),
      patientId: String(patientId || req.user?.patientId || '').trim(),
      sender: req.user?._id || null,
    });

    // In-app + optional email to admins
    await notifyAdmins({
      type: 'contact',
      title: 'New contact message',
      message: `${contact.name}: ${contact.subject}`,
      link: 'notifications.html',
      emailSubject: `[MediChain] Contact: ${contact.subject}`,
      emailBody: [
        'New hospital contact message:',
        `From: ${contact.name} <${contact.email}>`,
        `Phone: ${contact.phone || '—'}`,
        `Patient ID: ${contact.patientId || '—'}`,
        `Subject: ${contact.subject}`,
        '',
        contact.message,
      ].join('\n'),
    });

    // Confirmation email to sender (optional SMTP)
    await sendEmail({
      to: contact.email,
      subject: `MediChain received your message: ${contact.subject}`,
      text: [
        `Hello ${contact.name},`,
        '',
        'We received your message. Our hospital team will follow up if needed.',
        '',
        `Subject: ${contact.subject}`,
        '',
        '— MediChain Hospital Desk',
      ].join('\n'),
    });

    return res.status(201).json({
      message: 'Message sent. Hospital staff have been notified.',
      contact: {
        id: contact._id.toString(),
        subject: contact.subject,
        createdAt: contact.createdAt,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/contact — Admin inbox
 */
async function listContacts(req, res, next) {
  try {
    const messages = await ContactMessage.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('sender', 'name email role')
      .lean();

    return res.status(200).json({
      count: messages.length,
      messages,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/contact/:id/status — Admin
 */
async function updateContactStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['New', 'Read', 'Resolved'].includes(status)) {
      return res.status(400).json({ message: 'Status must be New, Read, or Resolved.' });
    }

    const contact = await ContactMessage.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Contact message not found.' });
    }

    contact.status = status;
    await contact.save();

    return res.status(200).json({ message: 'Status updated.', contact });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  submitContact,
  listContacts,
  updateContactStatus,
};
