/**
 * MediChain — Patient appointments (scheduling)
 */
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth(['Admin', 'Uploader', 'Recipient'])) return;

  UI.renderHeader('appointments');
  UI.renderSidebar('appointments');

  const isDoctor = Auth.hasRole('Uploader');
  const canUpdateStatus = Auth.hasRole('Uploader') || Auth.hasRole('Admin');
  const scheduleCard = document.getElementById('schedule-card');
  const form = document.getElementById('appointment-form');
  const tableBody = document.getElementById('appointments-table-body');
  const dateInput = document.getElementById('appt-date');

  if (isDoctor) {
    scheduleCard.style.display = 'block';
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
      dateInput.min = dateInput.value;
    }
  }

  loadAppointments();

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      UI.clearNotifications('notification-area');

      const patientId = document.getElementById('patient-id').value.trim();
      const patientName = document.getElementById('patient-name').value.trim();
      const department = document.getElementById('department').value;
      const date = document.getElementById('appt-date').value;
      const time = document.getElementById('appt-time').value;
      const reason = document.getElementById('reason').value.trim();

      if (!patientId || !patientName || !department || !date || !time) {
        UI.showNotification(
          'notification-area',
          'error',
          'Missing fields',
          'Patient ID, name, department, date, and time are required.'
        );
        return;
      }

      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;
      UI.showLoading(true);

      try {
        await Api.createAppointment({
          patientId,
          patientName,
          department,
          date,
          time,
          reason,
        });

        UI.showNotification(
          'notification-area',
          'success',
          'Appointment posted',
          `${patientName} scheduled for ${date} at ${time}.`
        );

        form.reset();
        if (dateInput) {
          dateInput.value = new Date().toISOString().split('T')[0];
        }
        await loadAppointments();
      } catch (err) {
        UI.showNotification('notification-area', 'error', 'Could not schedule', err.message);
      } finally {
        submitBtn.disabled = false;
        UI.showLoading(false);
      }
    });
  }

  async function loadAppointments() {
    UI.showLoading(true);
    try {
      const data = await Api.getAppointments();
      renderTable(data.appointments || []);
    } catch (err) {
      UI.showNotification('notification-area', 'error', 'Failed to load appointments', err.message);
      tableBody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state__title">Unable to load appointments</div></div></td></tr>`;
    } finally {
      UI.showLoading(false);
    }
  }

  function statusTag(status) {
    if (status === 'Completed') return '<span class="tag tag--green">Completed</span>';
    if (status === 'Cancelled') return '<span class="tag tag--red">Cancelled</span>';
    return '<span class="tag tag--yellow">Scheduled</span>';
  }

  function renderTable(appointments) {
    if (!appointments.length) {
      tableBody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state__title">No appointments yet</div><p>${isDoctor ? 'Use the form above to post a patient appointment.' : 'Doctors will post appointment dates and times here.'}</p></div></td></tr>`;
      return;
    }

    tableBody.innerHTML = appointments.map((appt) => {
      const id = appt.id || appt._id;
      const doctorName = appt.doctor?.name || '—';
      const actions = canUpdateStatus && appt.status === 'Scheduled'
        ? `
          <button type="button" class="btn btn--ghost btn--sm js-complete" data-id="${UI.escapeHtml(id)}">Complete</button>
          <button type="button" class="btn btn--ghost btn--sm js-cancel" data-id="${UI.escapeHtml(id)}">Cancel</button>
        `
        : '—';

      return `
        <tr>
          <td>${UI.escapeHtml(appt.date)}</td>
          <td>${UI.escapeHtml(appt.time)}</td>
          <td>${UI.escapeHtml(appt.patientName)} <span style="color:var(--carbon-text-helper)">(${UI.escapeHtml(appt.patientId)})</span></td>
          <td>${UI.escapeHtml(appt.department)}</td>
          <td>${UI.escapeHtml(doctorName)}</td>
          <td>${UI.escapeHtml(appt.reason || '—')}</td>
          <td>${statusTag(appt.status)}</td>
          <td><div style="display:flex;gap:var(--space-02);flex-wrap:wrap;">${actions}</div></td>
        </tr>
      `;
    }).join('');

    tableBody.querySelectorAll('.js-complete').forEach((btn) => {
      btn.addEventListener('click', () => updateStatus(btn.dataset.id, 'Completed'));
    });
    tableBody.querySelectorAll('.js-cancel').forEach((btn) => {
      btn.addEventListener('click', () => updateStatus(btn.dataset.id, 'Cancelled'));
    });
  }

  async function updateStatus(id, status) {
    UI.showLoading(true);
    try {
      await Api.updateAppointmentStatus(id, status);
      UI.showNotification('notification-area', 'success', 'Status updated', `Appointment marked as ${status}.`);
      await loadAppointments();
    } catch (err) {
      UI.showNotification('notification-area', 'error', 'Update failed', err.message);
    } finally {
      UI.showLoading(false);
    }
  }
});
