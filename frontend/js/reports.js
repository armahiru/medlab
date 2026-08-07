/**
 * MediChain — Distributed medical reports catalog
 */
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth(['Admin', 'Uploader', 'Recipient'])) return;

  UI.renderHeader('reports');
  UI.renderSidebar('reports');

  const tableBody = document.getElementById('reports-table-body');
  const mobileList = document.getElementById('reports-mobile-list');
  const logsModal = document.getElementById('access-logs-modal');
  const logsBody = document.getElementById('access-logs-body');
  const logsClose = document.getElementById('access-logs-close-btn');

  logsClose.addEventListener('click', () => UI.toggleModal('access-logs-modal', false));
  logsModal.addEventListener('click', (e) => {
    if (e.target === logsModal) UI.toggleModal('access-logs-modal', false);
  });

  loadReports();

  async function loadReports() {
    UI.showLoading(true);
    try {
      const data = await Api.getReports();
      const reports = data.reports || [];
      renderReports(reports);
    } catch (err) {
      UI.showNotification('notification-area', 'error', 'Failed to load reports', err.message);
      tableBody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state__title">Unable to load reports</div></div></td></tr>`;
      if (mobileList) {
        mobileList.innerHTML = `<div class="empty-state"><div class="empty-state__title">Unable to load reports</div></div>`;
      }
    } finally {
      UI.showLoading(false);
    }
  }

  function reportAvatar(report) {
    const photoUrl = report.patientProfileImage
      ? `${CONFIG.ASSET_BASE_URL}/avatars/${encodeURIComponent(report.patientProfileImage)}`
      : '';
    const initials = UI.initials(report.patientName || report.patientId || '?');
    return photoUrl
      ? `<img class="patient-chip__img" src="${UI.escapeHtml(photoUrl)}" alt="" width="32" height="32">`
      : `<span class="patient-chip__initials" aria-hidden="true">${UI.escapeHtml(initials)}</span>`;
  }

  function actionButtons(report, id, isAdmin) {
    return `
      <div class="table-actions">
        <button type="button" class="btn btn--primary btn--sm js-qr" data-id="${UI.escapeHtml(id)}" data-title="${UI.escapeHtml(report.title || 'Medical report')}">Show QR</button>
        <button type="button" class="btn btn--ghost btn--sm js-download" data-id="${UI.escapeHtml(id)}" data-name="${UI.escapeHtml(report.originalName || 'medical-report')}">Download</button>
        ${isAdmin ? `<button type="button" class="btn btn--ghost btn--sm js-logs" data-id="${UI.escapeHtml(id)}">Logs</button>` : ''}
      </div>
    `;
  }

  function renderReports(reports) {
    if (!reports.length) {
      tableBody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state__title">No sealed reports yet</div><p>Ask a clinical uploader to seal a medical report onto MediChain.</p></div></td></tr>`;
      if (mobileList) {
        mobileList.innerHTML = `<div class="empty-state"><div class="empty-state__title">No sealed reports yet</div><p>Ask a clinical uploader to seal a medical report onto MediChain.</p></div>`;
      }
      return;
    }

    const isAdmin = Auth.hasRole('Admin');

    tableBody.innerHTML = reports.map((report) => {
      const id = report.id || report._id;
      return `
        <tr data-id="${UI.escapeHtml(id)}">
          <td>
            <div class="patient-chip">
              <span class="patient-chip__avatar">${reportAvatar(report)}</span>
              <span class="patient-chip__text">
                <span class="patient-chip__name">${UI.escapeHtml(report.patientName || '—')}</span>
                <span class="patient-chip__id">${UI.escapeHtml(report.patientId || '')}</span>
              </span>
            </div>
          </td>
          <td>${UI.escapeHtml(report.title || '—')}</td>
          <td>${UI.escapeHtml(report.reportType || '—')}</td>
          <td>${UI.escapeHtml(report.department || '—')}</td>
          <td>${UI.formatTimestamp(report.createdAt)}</td>
          <td>#${UI.escapeHtml(report.blockIndex ?? '—')}</td>
          <td>${UI.escapeHtml(report.accessCount ?? 0)}</td>
          <td>${actionButtons(report, id, isAdmin)}</td>
        </tr>
      `;
    }).join('');

    if (mobileList) {
      mobileList.innerHTML = reports.map((report) => {
        const id = report.id || report._id;
        return `
          <article class="report-card" data-id="${UI.escapeHtml(id)}">
            <div class="report-card__top">
              <div class="patient-chip">
                <span class="patient-chip__avatar">${reportAvatar(report)}</span>
                <span class="patient-chip__text">
                  <span class="patient-chip__name">${UI.escapeHtml(report.patientName || '—')}</span>
                  <span class="patient-chip__id">${UI.escapeHtml(report.patientId || '')}</span>
                </span>
              </div>
              <span class="report-card__block">#${UI.escapeHtml(report.blockIndex ?? '—')}</span>
            </div>
            <h3 class="report-card__title">${UI.escapeHtml(report.title || 'Medical report')}</h3>
            <dl class="report-card__meta">
              <div><dt>Type</dt><dd>${UI.escapeHtml(report.reportType || '—')}</dd></div>
              <div><dt>Department</dt><dd>${UI.escapeHtml(report.department || '—')}</dd></div>
              <div><dt>Sealed</dt><dd>${UI.formatTimestamp(report.createdAt)}</dd></div>
              <div><dt>Accesses</dt><dd>${UI.escapeHtml(report.accessCount ?? 0)}</dd></div>
            </dl>
            ${actionButtons(report, id, isAdmin)}
          </article>
        `;
      }).join('');
    }

    bindReportActions(document);
  }

  function bindReportActions(root) {
    root.querySelectorAll('.js-qr').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await QR.openVerifyModal(btn.dataset.id, btn.dataset.title);
        } catch (err) {
          UI.showNotification('notification-area', 'error', 'QR unavailable', err.message);
        }
      });
    });

    root.querySelectorAll('.js-download').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          UI.showLoading(true);
          await Api.downloadReport(btn.dataset.id, btn.dataset.name || 'medical-report');
          UI.showNotification(
            'notification-area',
            'success',
            'Download started',
            'ZIP package includes the attachment plus report-details.txt (title, notes, hashes).'
          );
        } catch (err) {
          UI.showNotification('notification-area', 'error', 'Download failed', err.message);
        } finally {
          UI.showLoading(false);
        }
      });
    });

    root.querySelectorAll('.js-logs').forEach((btn) => {
      btn.addEventListener('click', () => openAccessLogs(btn.dataset.id));
    });
  }

  async function openAccessLogs(reportId) {
    logsBody.innerHTML = '<p style="font-size: var(--font-size-sm);">Loading access logs…</p>';
    UI.toggleModal('access-logs-modal', true);

    try {
      const data = await Api.getAccessLogs(reportId);
      const logs = data.logs || [];

      if (!logs.length) {
        logsBody.innerHTML = `
          <p style="font-size: var(--font-size-sm); margin-bottom: var(--space-03);">
            <strong>${UI.escapeHtml(data.reportTitle || 'Report')}</strong> · ${data.accessCount || 0} recorded accesses
          </p>
          <p style="font-size: var(--font-size-sm); color: var(--carbon-text-secondary);">No access events yet.</p>
        `;
        return;
      }

      logsBody.innerHTML = `
        <p style="font-size: var(--font-size-sm); margin-bottom: var(--space-05); word-break: break-word;">
          <strong>${UI.escapeHtml(data.reportTitle || 'Report')}</strong> · ${data.accessCount || 0} recorded accesses
        </p>
        <div class="access-log-cards">
          ${logs.map((log) => `
            <div class="access-log-card">
              <div class="access-log-card__when">${UI.formatTimestamp(log.createdAt)}</div>
              <div><strong>${UI.escapeHtml(log.action)}</strong> · ${UI.escapeHtml(log.result || '—')}</div>
              <div class="access-log-card__actor">${UI.escapeHtml(log.actor?.name || 'Public / anonymous')}</div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      logsBody.innerHTML = `<p style="font-size: var(--font-size-sm); color: var(--carbon-error);">${UI.escapeHtml(err.message)}</p>`;
    }
  }
});
