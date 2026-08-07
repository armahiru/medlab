/**
 * MediChain — In-app notifications inbox
 */
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;

  UI.renderHeader('notifications');
  UI.renderSidebar('notifications');

  let allItems = [];
  let activeFilter = 'all';

  document.getElementById('mark-all-btn').addEventListener('click', markAllRead);
  document.getElementById('refresh-btn').addEventListener('click', loadNotifications);

  document.querySelectorAll('.inbox-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      activeFilter = tab.dataset.filter || 'all';
      document.querySelectorAll('.inbox-tab').forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      renderList();
    });
  });

  loadNotifications();

  function filterItems(items) {
    if (activeFilter === 'all') return items;
    if (activeFilter === 'unread') return items.filter((n) => !n.read);
    return items.filter((n) => (n.type || 'system') === activeFilter);
  }

  function updateTabCounts(items) {
    const counts = {
      all: items.length,
      unread: items.filter((n) => !n.read).length,
      appointment: items.filter((n) => n.type === 'appointment').length,
      report: items.filter((n) => n.type === 'report').length,
      contact: items.filter((n) => n.type === 'contact').length,
    };

    Object.entries(counts).forEach(([key, value]) => {
      const el = document.querySelector(`[data-count="${key}"]`);
      if (el) el.textContent = String(value);
    });
  }

  function renderList() {
    const list = document.getElementById('notifications-list');
    const items = filterItems(allItems);

      if (!allItems.length) {
      list.innerHTML = HCI.emptyState({
        title: 'No notifications yet',
        message: 'You will be notified when reports are sealed, appointments are booked, or contact messages arrive.',
        actionHref: 'appointments.html',
        actionLabel: 'View appointments',
      });
      return;
    }

    if (!items.length) {
      const labels = {
        unread: 'unread alerts',
        appointment: 'appointment alerts',
        report: 'report alerts',
        contact: 'contact alerts',
      };
      list.innerHTML = HCI.emptyState({
        title: 'Nothing here',
        message: `No ${labels[activeFilter] || 'alerts'} in this tab.`,
      });
      return;
    }

    list.innerHTML = items.map((n) => {
      const id = n._id || n.id;
      const typeTag = {
        appointment: 'tag--yellow',
        report: 'tag--green',
        contact: 'tag--red',
        system: 'tag--gray',
      }[n.type] || 'tag--gray';

      return `
        <div class="notification ${n.read ? 'notification--info' : 'notification--warning'}" style="margin-bottom: var(--space-04);">
          <div style="flex: 1;">
            <div style="display:flex; gap: var(--space-03); align-items:center; margin-bottom: var(--space-02); flex-wrap:wrap;">
              <span class="tag ${typeTag}">${UI.escapeHtml(n.type || 'system')}</span>
              ${n.emailSent ? '<span class="tag tag--green">Email sent</span>' : '<span class="tag tag--gray">No email</span>'}
              ${n.smsSent ? '<span class="tag tag--green">SMS sent</span>' : '<span class="tag tag--gray">No SMS</span>'}
              ${n.read ? '' : '<span class="tag tag--yellow">Unread</span>'}
            </div>
            <div class="notification__title">${UI.escapeHtml(n.title)}</div>
            <div class="notification__message">${UI.escapeHtml(n.message)}</div>
            <div style="margin-top: var(--space-03); font-size: var(--font-size-xs); color: var(--carbon-text-helper);">
              ${UI.formatTimestamp(n.createdAt)}
              ${n.link ? ` · <a href="${UI.escapeHtml(n.link)}">Open related page</a>` : ''}
            </div>
          </div>
          ${!n.read ? `<button type="button" class="btn btn--ghost btn--sm js-read" data-id="${UI.escapeHtml(id)}">Mark read</button>` : ''}
        </div>
      `;
    }).join('');

    list.querySelectorAll('.js-read').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await Api.markNotificationRead(btn.dataset.id);
          await loadNotifications();
        } catch (err) {
          UI.showNotification('notification-area', 'error', 'Failed', err.message);
        }
      });
    });
  }

  async function loadNotifications() {
    const list = document.getElementById('notifications-list');
    const badge = document.getElementById('unread-badge');
    UI.showLoading(true);

    try {
      const data = await Api.getNotifications();
      allItems = data.notifications || [];
      badge.textContent = `${data.unreadCount || 0} unread`;
      badge.className = `tag ${(data.unreadCount || 0) > 0 ? 'tag--yellow' : 'tag--green'}`;
      updateTabCounts(allItems);
      renderList();
      UI.refreshAlertBadges();
    } catch (err) {
      allItems = [];
      list.innerHTML = `<div class="empty-state"><div class="empty-state__title">Unable to load</div><p>${UI.escapeHtml(err.message)}</p></div>`;
    } finally {
      UI.showLoading(false);
    }
  }

  async function markAllRead() {
    try {
      await Api.markAllNotificationsRead();
      UI.showNotification('notification-area', 'success', 'Done', 'All notifications marked as read.');
      await loadNotifications();
    } catch (err) {
      UI.showNotification('notification-area', 'error', 'Failed', err.message);
    }
  }
});
