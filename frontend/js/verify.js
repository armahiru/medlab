/**
 * MediChain — Public medical report verification (scan / show / enter ID)
 *
 * On-the-spot flow:
 *  - Holder: Show QR (or open Medical Reports → QR)
 *  - Verifier: Scan QR, or Enter ID → result + QR appear together
 */
document.addEventListener('DOMContentLoaded', () => {
  if (Auth.isAuthenticated()) {
    UI.renderHeader('verify');
    if (document.getElementById('app-sidebar')) {
      UI.renderSidebar('verify');
    }
  } else {
    UI.renderHeader('verify');
  }

  const form = document.getElementById('verify-form');
  const reportIdInput = document.getElementById('report-id');
  const showQrIdInput = document.getElementById('show-qr-id');
  const showQrBtn = document.getElementById('show-qr-btn');
  const qrDisplay = document.getElementById('verify-qr-display');
  const qrCaption = document.getElementById('verify-qr-caption');
  const qrLink = document.getElementById('verify-qr-link');
  const resultArea = document.getElementById('verify-result');
  const modeType = document.getElementById('verify-mode-type');
  const modeScan = document.getElementById('verify-mode-scan');
  const modeShow = document.getElementById('verify-mode-show');
  const startScanBtn = document.getElementById('start-scan-btn');
  const stopScanBtn = document.getElementById('stop-scan-btn');

  let scanner = null;
  let scanBusy = false;
  let verifying = false;
  let displayedQrId = '';

  const params = new URLSearchParams(window.location.search);
  const prefilledId = params.get('id');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const reportId = reportIdInput.value.trim();
    if (!reportId) {
      UI.showNotification('notification-area', 'error', 'Report ID required', 'Scan the QR code or paste the Report ID.');
      return;
    }
    await stopScanner();
    await runVerification(reportId, { showQrTab: true });
  });

  if (showQrBtn) {
    showQrBtn.addEventListener('click', async () => {
      const id = showQrIdInput.value.trim();
      if (!id) {
        UI.showNotification('notification-area', 'error', 'Report ID required', 'Enter the Report ID to generate its QR code.');
        return;
      }
      reportIdInput.value = id;
      await runVerification(id, { showQrTab: true });
    });
  }

  if (showQrIdInput) {
    showQrIdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        showQrBtn.click();
      }
    });
  }

  document.querySelectorAll('.verify-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  if (startScanBtn) startScanBtn.addEventListener('click', startScanner);
  if (stopScanBtn) stopScanBtn.addEventListener('click', stopScanner);

  window.addEventListener('beforeunload', () => {
    if (scanner) scanner.stop();
  });

  if (prefilledId) {
    reportIdInput.value = prefilledId;
    if (showQrIdInput) showQrIdInput.value = prefilledId;
    switchMode('show');
    displayReportQr(prefilledId);
    runVerification(prefilledId, { showQrTab: true });
  } else {
    switchMode('scan');
    window.setTimeout(() => startScanner(), 400);
  }

  async function displayReportQr(reportId) {
    if (!reportId || !qrDisplay) return;
    displayedQrId = reportId;
    if (qrCaption) qrCaption.textContent = '';
    if (qrLink) qrLink.textContent = '';
    try {
      const url = await QR.renderInto(qrDisplay, reportId, { width: 220 });
      if (qrLink && url) {
        qrLink.innerHTML = `<a href="${UI.escapeHtml(url)}">${UI.escapeHtml(url)}</a>`;
      }
    } catch (err) {
      UI.showNotification('notification-area', 'error', 'QR unavailable', err.message);
    }
  }

  async function switchMode(mode) {
    const isScan = mode === 'scan';
    const isShow = mode === 'show';
    document.querySelectorAll('.verify-tab').forEach((tab) => {
      const on = tab.dataset.mode === mode;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    modeType.hidden = mode !== 'type';
    modeScan.hidden = !isScan;
    modeShow.hidden = !isShow;

    if (isScan && !verifying) {
      window.setTimeout(() => startScanner(), 300);
    } else {
      await stopScanner();
    }

    if (isShow && displayedQrId && qrDisplay && !qrDisplay.querySelector('canvas, img')) {
      displayReportQr(displayedQrId);
    }
  }

  async function startScanner() {
    if (scanBusy || verifying) return;
    scanBusy = true;
    if (startScanBtn) startScanBtn.disabled = true;
    try {
      if (!scanner) {
        scanner = await QR.createScanner(
          'qr-reader',
          async (reportId) => {
            if (verifying) return;
            verifying = true;
            if (typeof HCI !== 'undefined') HCI.announce('QR code scanned. Verifying…');
            reportIdInput.value = reportId;
            if (showQrIdInput) showQrIdInput.value = reportId;
            await stopScanner();
            await runVerification(reportId, { showQrTab: true });
            verifying = false;
            if (scanner) scanner.resetScanLock();
          },
          () => {}
        );
      }
      await scanner.start();
      if (startScanBtn) startScanBtn.hidden = true;
      if (stopScanBtn) stopScanBtn.hidden = false;
    } catch (err) {
      if (startScanBtn) {
        startScanBtn.hidden = false;
        startScanBtn.textContent = 'Try camera again';
      }
      UI.showNotification(
        'notification-area',
        'warning',
        'Camera unavailable',
        err.message || 'Allow camera access, or use Show QR / Enter ID.'
      );
    } finally {
      if (startScanBtn) startScanBtn.disabled = false;
      scanBusy = false;
    }
  }

  async function stopScanner() {
    if (!scanner) return;
    await scanner.stop();
    if (startScanBtn) {
      startScanBtn.hidden = false;
      startScanBtn.textContent = 'Start camera';
    }
    if (stopScanBtn) stopScanBtn.hidden = true;
  }

  async function runVerification(reportId, options = {}) {
    UI.clearNotifications('notification-area');
    resultArea.innerHTML = '';
    UI.showLoading(true);

    const verifyBtn = form.querySelector('[type="submit"]');
    if (verifyBtn) verifyBtn.disabled = true;

    try {
      const result = await Api.verifyReport(reportId);
      const ok = result.authentic || result.isValid || result.status === 'valid';

      // Stop spinner as soon as the API answers — QR drawing must never block the UI
      UI.showLoading(false);
      if (verifyBtn) verifyBtn.disabled = false;

      if (ok) {
        UI.showNotification(
          'notification-area',
          'success',
          'Report is authentic',
          'This medical report matches the MediChain record. No tampering detected.',
          false
        );
      } else {
        UI.showNotification(
          'notification-area',
          'error',
          'Report tampered or invalid',
          result.message || 'The medical report hash does not match the sealed blockchain record.',
          false
        );
      }

      if (showQrIdInput) showQrIdInput.value = reportId;
      reportIdInput.value = reportId;

      if (options.showQrTab) {
        await switchMode('show');
      }

      resultArea.innerHTML = buildResultDetails(result, ok, reportId);

      // Draw QRs after UI is responsive
      try {
        await displayReportQr(reportId);
        await renderResultQr(reportId);
      } catch (qrErr) {
        console.warn('QR render failed:', qrErr);
        if (qrCaption) {
          qrCaption.textContent = 'QR image unavailable — use the Report ID or verify link.';
        }
      }
    } catch (err) {
      UI.showNotification(
        'notification-area',
        'error',
        'Verification failed',
        err.message.toLowerCase().includes('not found') || err.message.includes('404')
          ? 'Medical Report ID not found on MediChain.'
          : err.message
      );
      if (!prefilledId && scanner) {
        window.setTimeout(() => startScanner(), 800);
      }
    } finally {
      if (verifyBtn) verifyBtn.disabled = false;
      UI.showLoading(false);
    }
  }

  function buildResultDetails(result, isAuthentic, reportId) {
    const report = result.report || result.data || {};
    const block = result.block || {};
    const id = report.id || report._id || report.reportId || reportId;

    const row = (label, value) => `
      <div class="verify-result__detail-row">
        <span class="verify-result__detail-label">${label}</span>
        <span class="verify-result__detail-value">${value}</span>
      </div>
    `;

    return `
      <div class="verify-result">
        <div class="card">
          <h3 class="card__title">Verification Details</h3>
          <div class="verify-qr-panel verify-qr-panel--result">
            <div id="result-qr-display" class="verify-qr-panel__code qr-code"></div>
            <p class="verify-qr-panel__caption">Report QR — scan again from another phone</p>
          </div>
          <div class="verify-result__details">
            ${row('Status', isAuthentic
              ? '<span class="tag tag--green">Authentic</span>'
              : '<span class="tag tag--red">Tampered / Invalid</span>')}
            ${row('Report ID', UI.escapeHtml(id || '—'))}
            ${result.phiRedacted
              ? row('Patient details', 'Hidden (sign in to view full details)')
              : `${row('Patient ID', UI.escapeHtml(report.patientId || block.data?.patientId || '—'))}
                 ${row('Patient Name', UI.escapeHtml(report.patientName || block.data?.patientName || '—'))}
                 ${row('Report Title', UI.escapeHtml(report.title || block.data?.title || '—'))}`}
            ${row('Report Type', UI.escapeHtml(report.reportType || block.data?.reportType || '—'))}
            ${row('Department', UI.escapeHtml(report.department || block.data?.department || '—'))}
            ${row('Block Index', UI.escapeHtml(block.index ?? '—'))}
            ${row('Block Hash', UI.escapeHtml(block.hash || result.storedHash || '—'))}
            ${row('Calculated Hash', UI.escapeHtml(result.calculatedHash || '—'))}
            ${row('File Hash', UI.escapeHtml(report.fileHash || block.data?.fileHash || '—'))}
            ${row('Hash Match', result.hashMatch !== undefined ? (result.hashMatch ? 'Yes' : 'No') : '—')}
            ${row('Chain Link Valid', result.chainLinkValid !== undefined ? (result.chainLinkValid ? 'Yes' : 'No') : '—')}
            ${row('File Hash Match', result.fileHashMatch !== undefined ? (result.fileHashMatch ? 'Yes' : 'No') : '—')}
            ${row('File On Disk Match', result.fileOnDiskMatch !== undefined ? (result.fileOnDiskMatch ? 'Yes' : 'No') : '—')}
          </div>
        </div>
      </div>
    `;
  }

  async function renderResultQr(reportId) {
    const box = document.getElementById('result-qr-display');
    if (box && reportId) {
      await QR.renderInto(box, reportId, { width: 180 });
    }
  }
});
