const fs = require('fs');
const path = require('path');
// archiver@5 exports a function: archiver('zip', options)
const archiver = require('archiver');
const Report = require('../models/Report');
const AccessLog = require('../models/AccessLog');
const { hashFileBuffer, calculateBlockHash } = require('../utils/hash');
const {
  assertReportType,
  assertDepartment,
  assertDate,
} = require('../utils/validate');
const blockchain = require('../utils/blockchain');
const Block = require('../models/Block');
const User = require('../models/User');
const { notifyPatientById } = require('../utils/notify');

function reportToClient(report) {
  const obj = typeof report.toJSON === 'function' ? report.toJSON() : report;
  return {
    id: obj.id || obj._id?.toString(),
    _id: obj._id?.toString?.() || obj.id,
    patientId: obj.patientId,
    patientName: obj.patientName,
    patientProfileImage: obj.patientProfileImage || '',
    title: obj.title,
    reportType: obj.reportType,
    department: obj.department,
    description: obj.description,
    date: obj.date,
    fileName: obj.fileName,
    originalName: obj.originalName,
    fileHash: obj.fileHash,
    blockIndex: obj.blockIndex,
    blockHash: obj.blockHash,
    accessCount: obj.accessCount,
    createdAt: obj.createdAt,
  };
}

/** Public verify response — authenticity only, no PHI */
function reportToPublicVerify(report) {
  const obj = typeof report.toJSON === 'function' ? report.toJSON() : report;
  return {
    id: obj.id || obj._id?.toString(),
    reportType: obj.reportType,
    department: obj.department,
    date: obj.date,
    blockIndex: obj.blockIndex,
    fileHash: obj.fileHash,
  };
}

function canAccessReport(user, report) {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  if (user.role === 'Uploader') {
    return report.uploader.toString() === user._id.toString();
  }
  if (user.role === 'Recipient') {
    return !!user.patientId && report.patientId === user.patientId;
  }
  return false;
}

async function logAccess({ reportId, action, result, actor, req }) {
  try {
    await AccessLog.create({
      report: reportId,
      action,
      result,
      actor: actor || null,
      ip: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });
  } catch (err) {
    console.error('[MediChain] Access log failed:', err.message);
  }
}

/**
 * POST /api/reports
 * Uploader seals a medical report onto the simulated blockchain.
 */
async function uploadReport(req, res, next) {
  let createdReportId = null;

  try {
    const {
      patientId,
      patientName,
      title,
      reportType,
      department,
      description = '',
      date,
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Medical report file is required.' });
    }

    if (!patientId || !patientName || !title || !reportType || !department || !date) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        message: 'patientId, patientName, title, reportType, department, and date are required.',
      });
    }

    try {
      assertReportType(reportType.trim());
      assertDepartment(department.trim());
      assertDate(date, 'date');
    } catch (validationErr) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: validationErr.message });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const fileHash = hashFileBuffer(fileBuffer);

    const report = await Report.create({
      patientId: patientId.trim(),
      patientName: patientName.trim(),
      title: title.trim(),
      reportType: reportType.trim(),
      department: department.trim(),
      description: String(description || '').trim(),
      date,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      fileHash,
      uploader: req.user._id,
      blockIndex: -1,
      blockHash: 'pending',
    });
    createdReportId = report._id;

    const transaction = {
      reportId: report._id.toString(),
      patientId: report.patientId,
      patientName: report.patientName,
      title: report.title,
      reportType: report.reportType,
      department: report.department,
      description: report.description,
      date: report.date,
      fileName: report.fileName,
      originalName: report.originalName,
      fileHash: report.fileHash,
      uploaderId: req.user._id.toString(),
    };

    const block = await blockchain.addBlock(transaction);

    report.blockIndex = block.index;
    report.blockHash = block.hash;
    await report.save();

    await notifyPatientById(report.patientId, {
      type: 'report',
      title: 'New medical report sealed',
      message: `${report.title} (${report.reportType}) is available. Report ID: ${report._id}`,
      link: 'reports.html',
      emailSubject: 'MediChain: New medical report available',
      emailBody: [
        `Hello ${report.patientName},`,
        '',
        'A medical report was sealed on MediChain for you:',
        `Title: ${report.title}`,
        `Type: ${report.reportType}`,
        `Department: ${report.department}`,
        `Report ID: ${report._id}`,
        '',
        'Sign in to MediChain → Reports to view or download.',
        'You can also verify authenticity on the public Verify page.',
      ].join('\n'),
      smsBody: `MediChain: New ${report.reportType} "${report.title}" sealed for you. Open Reports or Verify with ID ${report._id}.`,
    });

    return res.status(201).json({
      message: 'Medical report sealed on the blockchain.',
      report: reportToClient(report),
      block,
    });
  } catch (err) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    if (createdReportId) {
      await Report.findByIdAndDelete(createdReportId).catch(() => {});
    }
    return next(err);
  }
}

/**
 * GET /api/reports/verify/:reportId  (public)
 * Checks:
 * 1) Recalculated block hash vs stored hash
 * 2) previousHash chain link
 * 3) Report.fileHash vs block.data.fileHash
 * 4) Live SHA-256 of the file on disk vs sealed fileHash
 */
async function verifyReport(req, res, next) {
  try {
    const { reportId } = req.params;

    if (!reportId || !reportId.match(/^[a-fA-F0-9]{24}$/)) {
      return res.status(400).json({ message: 'Invalid medical Report ID format.' });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Medical report not found.' });
    }

    const blockDoc = await Block.findOne({ index: report.blockIndex });
    if (!blockDoc) {
      return res.status(404).json({
        message: 'Blockchain block for this report was not found.',
      });
    }

    const data = JSON.parse(JSON.stringify(blockDoc.data));
    const calculatedHash = calculateBlockHash({
      index: blockDoc.index,
      timestamp: blockDoc.timestamp,
      data,
      previousHash: blockDoc.previousHash,
      nonce: blockDoc.nonce ?? 0,
    });

    const hashMatch = calculatedHash === blockDoc.hash;

    let chainLinkValid = true;
    if (blockDoc.index === 0) {
      chainLinkValid = blockDoc.previousHash === '0';
    } else {
      const previous = await Block.findOne({ index: blockDoc.index - 1 }).lean();
      chainLinkValid = !!previous && blockDoc.previousHash === previous.hash;
    }

    const fileHashMatch = data.fileHash === report.fileHash;

    // Re-hash the actual file on disk (detects file swap / disk tampering)
    let fileOnDiskMatch = false;
    let diskFileHash = null;
    if (report.filePath && fs.existsSync(report.filePath)) {
      diskFileHash = hashFileBuffer(fs.readFileSync(report.filePath));
      fileOnDiskMatch = diskFileHash === report.fileHash && diskFileHash === data.fileHash;
    }

    const authentic = hashMatch && chainLinkValid && fileHashMatch && fileOnDiskMatch;

    report.accessCount += 1;
    await report.save();

    await logAccess({
      reportId: report._id,
      action: 'verify',
      result: authentic ? 'authentic' : 'tampered',
      actor: req.user?._id,
      req,
    });

    const block = blockchain.blockToClient(blockDoc);
    const isAuthenticated = !!req.user;

    // Unauthenticated callers get integrity result only — no patient PHI
    const safeReport = isAuthenticated
      ? reportToClient(report)
      : reportToPublicVerify(report);

    const safeBlock = isAuthenticated
      ? block
      : {
          index: block.index,
          hash: block.hash,
          previousHash: block.previousHash,
          timestamp: block.timestamp,
        };

    return res.status(200).json({
      authentic,
      isValid: authentic,
      status: authentic ? 'valid' : 'tampered',
      hashMatch,
      chainLinkValid,
      fileHashMatch,
      fileOnDiskMatch,
      diskFileHash: isAuthenticated ? diskFileHash : undefined,
      calculatedHash,
      storedHash: blockDoc.hash,
      message: authentic
        ? 'This medical report matches the MediChain record. Block hash, chain link, and file on disk are intact.'
        : 'Integrity check failed. Block data, chain link, or the file on disk may have been tampered with.',
      report: safeReport,
      block: safeBlock,
      phiRedacted: !isAuthenticated,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/reports — list sealed reports (authenticated distribution catalog)
 */
async function listReports(req, res, next) {
  try {
    const filter = {};

    if (req.user.role === 'Uploader') {
      filter.uploader = req.user._id;
    } else if (req.user.role === 'Recipient') {
      if (!req.user.patientId) {
        return res.status(403).json({
          message: 'Recipient account is missing a linked Patient ID.',
        });
      }
      filter.patientId = req.user.patientId;
    }
    // Admin sees all

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .populate('uploader', 'name email role')
      .lean();

    const patientIds = [...new Set(reports.map((r) => r.patientId).filter(Boolean))];
    const patients = patientIds.length
      ? await User.find({ role: 'Recipient', patientId: { $in: patientIds } })
          .select('patientId profileImage')
          .lean()
      : [];
    const photoByPatientId = Object.fromEntries(
      patients.map((p) => [p.patientId, p.profileImage || ''])
    );

    return res.status(200).json({
      count: reports.length,
      reports: reports.map((r) => ({
        ...reportToClient({
          ...r,
          patientProfileImage: photoByPatientId[r.patientId] || '',
        }),
        uploader: r.uploader,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Build a plain-text summary so clinical notes + metadata download with the file.
 */
function buildReportDetailsText(report) {
  return [
    'MediChain — Medical Report Package',
    '=================================',
    '',
    `Report ID: ${report._id}`,
    `Patient ID: ${report.patientId}`,
    `Patient Name: ${report.patientName}`,
    `Title: ${report.title}`,
    `Report Type: ${report.reportType}`,
    `Department: ${report.department}`,
    `Report Date: ${report.date}`,
    `Sealed At: ${report.createdAt ? new Date(report.createdAt).toISOString() : '—'}`,
    `Block Index: ${report.blockIndex}`,
    `Block Hash: ${report.blockHash}`,
    `File Hash (SHA-256): ${report.fileHash}`,
    `Attached File: ${report.originalName || report.fileName}`,
    '',
    'Clinical Notes / Description',
    '----------------------------',
    report.description && String(report.description).trim()
      ? String(report.description).trim()
      : '(No clinical notes were entered for this report.)',
    '',
    'Note: This package includes the sealed attachment plus this text summary.',
    'Verify authenticity in MediChain using the Report ID above.',
    '',
  ].join('\n');
}

/**
 * GET /api/reports/:id/download
 * Downloads a ZIP: original attachment + report-details.txt (title, notes, hashes).
 */
async function downloadReport(req, res, next) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Medical report not found.' });
    }

    if (!canAccessReport(req.user, report)) {
      return res.status(403).json({
        message: 'You are not allowed to download this medical report.',
      });
    }

    if (!report.filePath || !fs.existsSync(report.filePath)) {
      return res.status(404).json({ message: 'Report file is missing on the server.' });
    }

    await logAccess({
      reportId: report._id,
      action: 'download',
      result: 'success',
      actor: req.user._id,
      req,
    });

    report.accessCount += 1;
    await report.save();

    const safeTitle = String(report.title || 'medical-report')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 40);
    const zipName = `${safeTitle}-${report._id.toString().slice(-6)}.zip`;
    const attachmentName = report.originalName || report.fileName || 'attachment';

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => next(err));
    archive.pipe(res);

    archive.append(buildReportDetailsText(report), { name: 'report-details.txt' });
    archive.file(path.resolve(report.filePath), { name: `attachment/${attachmentName}` });

    await archive.finalize();
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/reports/:id/access-logs — Admin distribution tracking
 */
async function getAccessLogs(req, res, next) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Medical report not found.' });
    }

    const logs = await AccessLog.find({ report: report._id })
      .sort({ createdAt: -1 })
      .populate('actor', 'name email role')
      .lean();

    return res.status(200).json({
      reportId: report._id.toString(),
      reportTitle: report.title,
      accessCount: report.accessCount,
      logs,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  uploadReport,
  verifyReport,
  listReports,
  downloadReport,
  getAccessLogs,
};
