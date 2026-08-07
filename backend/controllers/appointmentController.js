const Appointment = require('../models/Appointment');
const { assertDepartment, assertDate, assertTime } = require('../utils/validate');
const { notifyPatientById } = require('../utils/notify');

function toClient(doc) {
  const obj = typeof doc.toJSON === 'function' ? doc.toJSON() : doc;
  return {
    id: obj.id || obj._id?.toString(),
    patientId: obj.patientId,
    patientName: obj.patientName,
    department: obj.department,
    date: obj.date,
    time: obj.time,
    reason: obj.reason || '',
    status: obj.status,
    doctor: obj.doctor,
    createdAt: obj.createdAt,
  };
}

/**
 * POST /api/appointments — Doctor/Uploader schedules an appointment
 */
async function createAppointment(req, res, next) {
  try {
    const { patientId, patientName, department, date, time, reason = '' } = req.body;

    if (!patientId || !patientName || !department || !date || !time) {
      return res.status(400).json({
        message: 'patientId, patientName, department, date, and time are required.',
      });
    }

    assertDepartment(department.trim());
    assertDate(date, 'date');
    assertTime(time);

    const appointment = await Appointment.create({
      patientId: patientId.trim(),
      patientName: patientName.trim(),
      department: department.trim(),
      date,
      time,
      reason: String(reason || '').trim(),
      doctor: req.user._id,
      status: 'Scheduled',
    });

    await appointment.populate('doctor', 'name email role');

    // Notify linked patient account (in-app + optional email)
    await notifyPatientById(appointment.patientId, {
      type: 'appointment',
      title: 'New appointment scheduled',
      message: `${appointment.department} on ${appointment.date} at ${appointment.time} with ${req.user.name}.`,
      link: 'appointments.html',
      emailSubject: 'MediChain: Appointment scheduled',
      emailBody: [
        `Hello ${appointment.patientName},`,
        '',
        'An appointment has been scheduled for you:',
        `Department: ${appointment.department}`,
        `Date: ${appointment.date}`,
        `Time: ${appointment.time}`,
        `Doctor: ${req.user.name}`,
        appointment.reason ? `Reason: ${appointment.reason}` : '',
        '',
        'Sign in to MediChain → Appointments to view details.',
      ]
        .filter(Boolean)
        .join('\n'),
      smsBody: `MediChain: Appointment ${appointment.date} ${appointment.time} (${appointment.department}) with ${req.user.name}.`,
    });

    return res.status(201).json({
      message: 'Appointment scheduled successfully.',
      appointment: toClient(appointment),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/appointments
 * - Uploader: own appointments
 * - Recipient: only appointments for their linked patientId
 * - Admin: all
 */
async function listAppointments(req, res, next) {
  try {
    const filter = {};

    if (req.user.role === 'Uploader') {
      filter.doctor = req.user._id;
    } else if (req.user.role === 'Recipient') {
      if (!req.user.patientId) {
        return res.status(403).json({
          message: 'Recipient account is missing a linked Patient ID.',
        });
      }
      filter.patientId = req.user.patientId;
    }

    const appointments = await Appointment.find(filter)
      .sort({ date: 1, time: 1 })
      .populate('doctor', 'name email role')
      .lean();

    return res.status(200).json({
      count: appointments.length,
      appointments: appointments.map(toClient),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/appointments/:id/status — doctor or admin updates status
 */
async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const allowed = ['Scheduled', 'Completed', 'Cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `Status must be one of: ${allowed.join(', ')}`,
      });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    if (
      req.user.role === 'Uploader' &&
      appointment.doctor.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'You can only update your own appointments.' });
    }

    appointment.status = status;
    await appointment.save();
    await appointment.populate('doctor', 'name email role');

    await notifyPatientById(appointment.patientId, {
      type: 'appointment',
      title: `Appointment ${status.toLowerCase()}`,
      message: `Your ${appointment.department} appointment on ${appointment.date} at ${appointment.time} is now ${status}.`,
      link: 'appointments.html',
      emailSubject: `MediChain: Appointment ${status}`,
      emailBody: [
        `Hello ${appointment.patientName},`,
        '',
        `Your appointment status was updated to: ${status}`,
        `Department: ${appointment.department}`,
        `Date: ${appointment.date}`,
        `Time: ${appointment.time}`,
      ].join('\n'),
      smsBody: `MediChain: Appointment on ${appointment.date} ${appointment.time} is now ${status}.`,
    });

    return res.status(200).json({
      message: 'Appointment status updated.',
      appointment: toClient(appointment),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createAppointment,
  listAppointments,
  updateStatus,
};
