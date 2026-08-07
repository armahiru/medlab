const { REPORT_TYPES, DEPARTMENTS } = require('../models/Report');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function isValidDateString(value) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

function isValidTimeString(value) {
  if (!TIME_RE.test(value)) return false;
  const [hh, mm] = value.split(':').map(Number);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

function assertReportType(reportType) {
  if (!REPORT_TYPES.includes(reportType)) {
    const err = new Error(`reportType must be one of: ${REPORT_TYPES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

function assertDepartment(department) {
  if (!DEPARTMENTS.includes(department)) {
    const err = new Error(`department must be one of: ${DEPARTMENTS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

function assertDate(date, fieldName = 'date') {
  if (!isValidDateString(date)) {
    const err = new Error(`${fieldName} must be a valid date in YYYY-MM-DD format.`);
    err.statusCode = 400;
    throw err;
  }
}

function assertTime(time) {
  if (!isValidTimeString(time)) {
    const err = new Error('time must be a valid time in HH:MM format.');
    err.statusCode = 400;
    throw err;
  }
}

module.exports = {
  REPORT_TYPES,
  DEPARTMENTS,
  isValidDateString,
  isValidTimeString,
  assertReportType,
  assertDepartment,
  assertDate,
  assertTime,
};
