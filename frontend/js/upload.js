/**
 * MediChain — Medical report upload logic
 */
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth('Uploader')) return;

  UI.renderHeader('upload');
  UI.renderSidebar('upload');

  const form = document.getElementById('upload-form');
  const fileInput = document.getElementById('file');
  const dropZone = document.getElementById('file-drop-zone');
  const filenameDisplay = document.getElementById('file-name');
  const dateInput = document.getElementById('report-date');
  const resetBtn = document.getElementById('reset-btn');
  const patientSelect = document.getElementById('patient-select');
  const patientIdInput = document.getElementById('patient-id');
  const patientNameInput = document.getElementById('patient-name');
  const patientIdList = document.getElementById('patient-id-list');

  let patients = [];

  async function loadPatients() {
    if (!patientSelect) return;
    try {
      const data = await Api.getPatients();
      patients = data.patients || [];
      patientSelect.innerHTML =
        '<option value="">Select patient…</option>' +
        patients
          .map(
            (p) =>
              `<option value="${UI.escapeHtml(p.patientId)}">${UI.escapeHtml(p.name)} · ${UI.escapeHtml(p.patientId)}</option>`
          )
          .join('');
      if (patientIdList) {
        patientIdList.innerHTML = patients
          .map((p) => `<option value="${UI.escapeHtml(p.patientId)}"></option>`)
          .join('');
      }
    } catch (err) {
      UI.showNotification('notification-area', 'warning', 'Patient list unavailable', err.message);
    }
  }

  if (patientSelect) {
    patientSelect.addEventListener('change', () => {
      const id = patientSelect.value;
      const match = patients.find((p) => p.patientId === id);
      if (!match) return;
      patientIdInput.value = match.patientId;
      patientNameInput.value = match.name;
    });
  }

  loadPatients();

  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('file-uploader--dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('file-uploader--dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('file-uploader--dragover');
    if (!e.dataTransfer.files.length) return;

    // DataTransfer is the reliable way to assign files across browsers
    const dt = new DataTransfer();
    dt.items.add(e.dataTransfer.files[0]);
    fileInput.files = dt.files;
    updateFilename();
  });

  fileInput.addEventListener('change', updateFilename);

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      setTimeout(() => {
        filenameDisplay.style.display = 'none';
        filenameDisplay.textContent = '';
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        document.getElementById('block-result').innerHTML = '';
        UI.clearNotifications('notification-area');
      }, 0);
    });
  }

  function updateFilename() {
    if (fileInput.files.length) {
      filenameDisplay.textContent = fileInput.files[0].name;
      filenameDisplay.style.display = 'block';
    } else {
      filenameDisplay.textContent = '';
      filenameDisplay.style.display = 'none';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearNotifications('notification-area');

    const patientId = document.getElementById('patient-id').value.trim();
    const patientName = document.getElementById('patient-name').value.trim();
    const title = document.getElementById('title').value.trim();
    const reportType = document.getElementById('report-type').value;
    const department = document.getElementById('department').value;
    const description = document.getElementById('description').value.trim();
    const reportDate = document.getElementById('report-date').value;

    if (!patientId || !patientName || !title || !reportType || !department || !reportDate) {
      UI.showNotification(
        'notification-area',
        'error',
        'Missing required fields',
        'Please complete patient details, report type, department, title, and date.'
      );
      return;
    }

    if (!fileInput.files.length) {
      UI.showNotification('notification-area', 'error', 'File required', 'Attach the medical report document before sealing.');
      return;
    }

    const formData = new FormData();
    formData.append('patientId', patientId);
    formData.append('patientName', patientName);
    formData.append('title', title);
    formData.append('reportType', reportType);
    formData.append('department', department);
    formData.append('description', description);
    formData.append('date', reportDate);
    formData.append('file', fileInput.files[0]);

    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    UI.showLoading(true);

    try {
      const result = await Api.uploadReport(formData);
      const reportId = result.report?.id || result.report?._id || '—';
      const block = result.block || {};

      UI.showNotification(
        'notification-area',
        'success',
        'Medical report sealed',
        `Block #${block.index} created. Patient was notified. Report ID: ${reportId}`,
        false
      );

      document.getElementById('block-result').innerHTML = `
        <div class="card" style="margin-top: var(--space-05)">
          <h3 class="card__title">Blockchain Seal Receipt</h3>
          <p class="card__subtitle">Share this Report ID or QR code so others can verify authenticity without signing in.</p>
          <div class="seal-receipt">
            <div class="seal-receipt__qr">
              <div id="seal-qr-code" class="qr-code"></div>
              <p class="form-helper" style="text-align:center; margin-top: var(--space-03);">Scan to verify</p>
            </div>
            <div class="verify-result__details seal-receipt__details">
              <div class="verify-result__detail-row">
                <span class="verify-result__detail-label">Report ID</span>
                <span class="verify-result__detail-value">${UI.escapeHtml(reportId)}</span>
              </div>
              <div class="verify-result__detail-row">
                <span class="verify-result__detail-label">Verify link</span>
                <span class="verify-result__detail-value" id="seal-verify-link">—</span>
              </div>
              <div class="verify-result__detail-row">
                <span class="verify-result__detail-label">Patient</span>
                <span class="verify-result__detail-value">${UI.escapeHtml(patientName)} (${UI.escapeHtml(patientId)})</span>
              </div>
              <div class="verify-result__detail-row">
                <span class="verify-result__detail-label">Report Type</span>
                <span class="verify-result__detail-value">${UI.escapeHtml(reportType)}</span>
              </div>
              <div class="verify-result__detail-row">
                <span class="verify-result__detail-label">Department</span>
                <span class="verify-result__detail-value">${UI.escapeHtml(department)}</span>
              </div>
              <div class="verify-result__detail-row">
                <span class="verify-result__detail-label">Block Index</span>
                <span class="verify-result__detail-value">${UI.escapeHtml(block.index)}</span>
              </div>
              <div class="verify-result__detail-row">
                <span class="verify-result__detail-label">Block Hash</span>
                <span class="verify-result__detail-value">${UI.escapeHtml(block.hash || '—')}</span>
              </div>
              <div class="verify-result__detail-row">
                <span class="verify-result__detail-label">Previous Hash</span>
                <span class="verify-result__detail-value">${UI.escapeHtml(block.previousHash || '—')}</span>
              </div>
              <div class="verify-result__detail-row">
                <span class="verify-result__detail-label">File Hash (SHA-256)</span>
                <span class="verify-result__detail-value">${UI.escapeHtml(result.report?.fileHash || '—')}</span>
              </div>
            </div>
          </div>
        </div>
      `;

      if (typeof QR !== 'undefined' && reportId && reportId !== '—') {
        const qrBox = document.getElementById('seal-qr-code');
        QR.renderInto(qrBox, reportId, { width: 168 }).then((url) => {
          const linkEl = document.getElementById('seal-verify-link');
          if (linkEl && url) {
            linkEl.innerHTML = `<a href="${UI.escapeHtml(url)}" target="_blank" rel="noopener">${UI.escapeHtml(url)}</a>`;
          }
        }).catch(() => {
          /* QR CDN optional offline */
        });
      }

      form.reset();
      filenameDisplay.style.display = 'none';
      if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      loadPatients();
    } catch (err) {
      UI.showNotification('notification-area', 'error', 'Upload failed', err.message);
    } finally {
      submitBtn.disabled = false;
      UI.showLoading(false);
    }
  });
});
