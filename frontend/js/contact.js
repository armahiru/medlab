/**
 * MediChain — Contact hospital desk
 */
document.addEventListener('DOMContentLoaded', () => {
  // Allow guests to contact, but prefer auth for sidebar
  const isAuth = Auth.isAuthenticated();
  if (isAuth) {
    UI.renderHeader('contact');
    UI.renderSidebar('contact');
  } else {
    UI.renderHeader('contact');
    const sidebar = document.getElementById('app-sidebar');
    const main = document.querySelector('.app-main');
    if (sidebar) sidebar.style.display = 'none';
    if (main) main.style.marginLeft = '0';
  }

  const form = document.getElementById('contact-form');
  const user = Auth.getUser();

  if (user) {
    document.getElementById('name').value = user.name || '';
    document.getElementById('email').value = user.email || '';
    if (user.patientId) document.getElementById('patient-id').value = user.patientId;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearNotifications('notification-area');

    const payload = {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      patientId: document.getElementById('patient-id').value.trim(),
      subject: document.getElementById('subject').value.trim(),
      message: document.getElementById('message').value.trim(),
    };

    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
      UI.showNotification('notification-area', 'error', 'Missing fields', 'Name, email, subject, and message are required.');
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    UI.showLoading(true);

    try {
      await Api.submitContact(payload);
      UI.showNotification(
        'notification-area',
        'success',
        'Message sent',
        'Hospital staff have been notified. Check your email if SMTP is enabled on the server.'
      );
      form.reset();
      if (user) {
        document.getElementById('name').value = user.name || '';
        document.getElementById('email').value = user.email || '';
        if (user.patientId) document.getElementById('patient-id').value = user.patientId;
      }
      if (Auth.hasRole('Admin')) loadInbox();
    } catch (err) {
      UI.showNotification('notification-area', 'error', 'Send failed', err.message);
    } finally {
      btn.disabled = false;
      UI.showLoading(false);
    }
  });

  if (Auth.hasRole('Admin')) {
    document.getElementById('admin-inbox').style.display = 'block';
    loadInbox();
  }

  async function loadInbox() {
    const body = document.getElementById('contact-inbox-body');
    try {
      const data = await Api.getContactMessages();
      const messages = data.messages || [];

      if (!messages.length) {
        body.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state__title">No messages yet</div></div></td></tr>`;
        return;
      }

      body.innerHTML = messages.map((m) => {
        const id = m._id || m.id;
        const statusTag = m.status === 'Resolved'
          ? '<span class="tag tag--green">Resolved</span>'
          : m.status === 'Read'
            ? '<span class="tag tag--gray">Read</span>'
            : '<span class="tag tag--yellow">New</span>';

        return `
          <tr>
            <td>${UI.formatTimestamp(m.createdAt)}</td>
            <td>${UI.escapeHtml(m.name)}<br><span style="font-size:var(--font-size-xs);color:var(--carbon-text-helper)">${UI.escapeHtml(m.email)}</span></td>
            <td title="${UI.escapeHtml(m.message)}">${UI.escapeHtml(m.subject)}</td>
            <td>${UI.escapeHtml(m.phone || '—')}</td>
            <td>${statusTag}</td>
            <td>
              <button type="button" class="btn btn--ghost btn--sm js-read" data-id="${UI.escapeHtml(id)}">Mark read</button>
              <button type="button" class="btn btn--ghost btn--sm js-resolve" data-id="${UI.escapeHtml(id)}">Resolve</button>
            </td>
          </tr>
        `;
      }).join('');

      body.querySelectorAll('.js-read').forEach((btn) => {
        btn.addEventListener('click', () => updateStatus(btn.dataset.id, 'Read'));
      });
      body.querySelectorAll('.js-resolve').forEach((btn) => {
        btn.addEventListener('click', () => updateStatus(btn.dataset.id, 'Resolved'));
      });
    } catch (err) {
      body.innerHTML = `<tr><td colspan="6">${UI.escapeHtml(err.message)}</td></tr>`;
    }
  }

  async function updateStatus(id, status) {
    try {
      await Api.updateContactStatus(id, status);
      await loadInbox();
    } catch (err) {
      UI.showNotification('notification-area', 'error', 'Update failed', err.message);
    }
  }
});
