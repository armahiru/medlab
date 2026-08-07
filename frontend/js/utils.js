/**
 * MediChain — Shared UI utilities
 */
const UI = {
  escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  showLoading(show = true) {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.setAttribute('aria-label', 'Loading');
      overlay.innerHTML = '<div class="spinner spinner--lg" aria-hidden="true"></div><span class="sr-only">Loading</span>';
      document.body.appendChild(overlay);
    }
    overlay.classList.toggle('is-visible', show);
    if (typeof HCI !== 'undefined') {
      HCI.announce(show ? 'Loading' : 'Ready');
    }
  },

  showNotification(containerId, type, title, message, dismissible = true) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const el = document.createElement('div');
    el.className = `notification notification--${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    el.innerHTML = `
      <div>
        <div class="notification__title">${this.escapeHtml(title)}</div>
        <div class="notification__message">${this.escapeHtml(message)}</div>
      </div>
      ${dismissible ? '<button type="button" class="notification__close" aria-label="Dismiss notification">&times;</button>' : ''}
    `;

    if (dismissible) {
      el.querySelector('.notification__close').addEventListener('click', () => el.remove());
    }

    container.innerHTML = '';
    container.appendChild(el);

    if (typeof HCI !== 'undefined') {
      HCI.announce(`${title}. ${message}`);
    }

    // Auto-dismiss success (status feedback without blocking)
    if (type === 'success' && dismissible) {
      window.setTimeout(() => {
        if (el.isConnected) el.remove();
      }, 5000);
    }

    return el;
  },

  clearNotifications(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
  },

  truncateHash(hash, length = 12) {
    if (!hash) return '—';
    if (hash.length <= length) return hash;
    return hash.substring(0, length) + '…';
  },

  formatTimestamp(ts) {
    if (!ts) return '—';
    const date = new Date(ts);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  statusTag(status) {
    if (status === 'tampered') return '<span class="tag tag--red">Tampered</span>';
    if (status === 'valid') return '<span class="tag tag--green">Valid</span>';
    return '<span class="tag tag--yellow">Pending</span>';
  },

  toggleModal(modalId, open) {
    const overlay = document.getElementById(modalId);
    if (!overlay) return;

    if (open) {
      overlay.dataset.prevFocus = document.activeElement && document.activeElement.id
        ? `#${document.activeElement.id}`
        : '';
      overlay._hciPrevEl = document.activeElement;
      overlay.classList.add('is-open');
      if (typeof HCI !== 'undefined') {
        overlay._hciUntrap = HCI.trapFocus(overlay);
      }
    } else {
      overlay.classList.remove('is-open');
      if (typeof overlay._hciUntrap === 'function') {
        overlay._hciUntrap();
        overlay._hciUntrap = null;
      }
      if (overlay._hciPrevEl && typeof overlay._hciPrevEl.focus === 'function') {
        overlay._hciPrevEl.focus();
      }
    }
  },

  /**
   * Confirm before signing out — polished Carbon danger modal.
   */
  confirmLogout() {
    const user = Auth.getUser();
    let overlay = document.getElementById('logout-modal');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'logout-modal';
      overlay.className = 'modal-overlay';
      overlay.setAttribute('role', 'presentation');
      document.body.appendChild(overlay);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.toggleModal('logout-modal', false);
      });
    }

    overlay.innerHTML = `
      <div class="modal modal--danger" role="dialog" aria-modal="true" aria-labelledby="logout-modal-title">
        <div class="modal__header">
          <h2 class="modal__title" id="logout-modal-title">Sign out</h2>
          <button type="button" class="modal__close" id="logout-x-btn" aria-label="Close">&times;</button>
        </div>
        <div class="modal__body">
          <p class="modal__lead">Sign out${user?.name ? ` as ${this.escapeHtml(user.name)}` : ''}?</p>
        </div>
        <div class="modal__footer">
          <button type="button" class="btn btn--secondary" id="logout-cancel-btn">Cancel</button>
          <button type="button" class="btn btn--danger" id="logout-confirm-btn">Sign out</button>
        </div>
      </div>
    `;

    overlay.querySelector('#logout-cancel-btn').addEventListener('click', () => {
      this.toggleModal('logout-modal', false);
    });
    overlay.querySelector('#logout-x-btn').addEventListener('click', () => {
      this.toggleModal('logout-modal', false);
    });
    overlay.querySelector('#logout-confirm-btn').addEventListener('click', () => {
      this.toggleModal('logout-modal', false);
      Auth.logout();
    });

    this.toggleModal('logout-modal', true);
    overlay.querySelector('#logout-cancel-btn')?.focus();
  },

  roleLabel(role) {
    const labels = {
      Admin: 'Hospital Admin',
      Uploader: 'Clinical Uploader',
      Recipient: 'Recipient',
    };
    return labels[role] || role;
  },

  closeMobileNav() {
    document.body.classList.remove('mobile-nav-open');
    const backdrop = document.getElementById('mobile-nav-backdrop');
    const menuBtn = document.getElementById('mobile-menu-btn');
    if (backdrop) backdrop.classList.remove('is-open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  },

  toggleMobileNav() {
    const open = !document.body.classList.contains('mobile-nav-open');
    document.body.classList.toggle('mobile-nav-open', open);
    const backdrop = document.getElementById('mobile-nav-backdrop');
    const menuBtn = document.getElementById('mobile-menu-btn');
    if (backdrop) backdrop.classList.toggle('is-open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  },

  ensureMobileNavChrome() {
    if (!document.getElementById('mobile-nav-backdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'mobile-nav-backdrop';
      backdrop.className = 'mobile-nav-backdrop';
      backdrop.addEventListener('click', () => this.closeMobileNav());
      document.body.appendChild(backdrop);
    }
  },

  renderHeader(activePage) {
    const header = document.getElementById('app-header');
    if (!header) return;

    this.ensureMobileNavChrome();

    const user = Auth.getUser();
    const isAuth = Auth.isAuthenticated();
    const navLinks = [];

    if (isAuth) {
      if (Auth.hasRole('Admin')) {
        navLinks.push({ href: 'dashboard.html', label: 'Dashboard', id: 'dashboard' });
      }
      if (Auth.hasRole('Uploader')) {
        navLinks.push({ href: 'upload.html', label: 'Upload', id: 'upload' });
      }
      navLinks.push({ href: 'reports.html', label: 'Reports', id: 'reports' });
      navLinks.push({ href: 'appointments.html', label: 'Appointments', id: 'appointments' });
      navLinks.push({ href: 'notifications.html', label: 'Alerts', id: 'notifications' });
      navLinks.push({ href: 'contact.html', label: 'Contact', id: 'contact' });
      navLinks.push({ href: 'verify.html', label: 'Verify', id: 'verify' });
    }

    const homeHref = isAuth
      ? (Auth.hasRole('Admin') ? 'dashboard.html' : Auth.hasRole('Uploader') ? 'upload.html' : 'reports.html')
      : 'login.html';

    const showMenu = isAuth && !!document.getElementById('app-sidebar');

    header.innerHTML = `
      ${showMenu ? `
        <button type="button" class="app-header__menu-btn" id="mobile-menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="app-sidebar">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 4h16v2H2V4zm0 5h16v2H2V9zm0 5h16v2H2v-2z"/></svg>
        </button>
      ` : ''}
      <a href="${homeHref}" class="app-header__brand">
        <svg class="app-header__brand-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M16 2L4 8v8c0 7.2 5.1 13.9 12 15 6.9-1.1 12-7.8 12-15V8L16 2zm0 2.2l10 5v6.8c0 5.8-4.1 11.2-10 12.3-5.9-1.1-10-6.5-10-12.3V9.2l10-5z"/>
          <path d="M15 10h2v4h4v2h-4v4h-2v-4h-4v-2h4v-4z"/>
        </svg>
        MediChain
      </a>
      <nav class="app-header__nav">
        ${navLinks.map(link => `
          <a href="${link.href}" class="app-header__link ${activePage === link.id ? 'app-header__link--active' : ''}" ${link.id === 'notifications' ? 'data-alert-link' : ''}>
            ${link.label}${link.id === 'notifications' ? '<span class="nav-alert-badge" data-alert-badge hidden></span>' : ''}
          </a>
        `).join('')}
        ${isAuth ? `
          <div class="app-header__user">
            <span class="app-header__user-name">${this.escapeHtml(user.name)}</span>
            <span class="app-header__role-tag">${this.escapeHtml(this.roleLabel(user.role))}</span>
            <button class="btn btn--ghost btn--sm" id="logout-btn" type="button">Sign out</button>
          </div>
        ` : `
          <a href="index.html#verify" class="app-header__link ${activePage === 'verify' ? 'app-header__link--active' : ''}">Verify</a>
          <a href="login.html" class="app-header__link ${activePage === 'login' ? 'app-header__link--active' : ''}">Sign in</a>
        `}
      </nav>
    `;

    const menuBtn = document.getElementById('mobile-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => this.toggleMobileNav());
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => this.confirmLogout());

    // Close drawer on resize to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) this.closeMobileNav();
    });
  },

  renderSidebar(activePage) {
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar) return;

    const user = Auth.getUser();
    const links = [];

    if (Auth.hasRole('Admin')) {
      links.push({
        section: 'Admin',
        items: [
          { href: 'dashboard.html', label: 'Dashboard', id: 'dashboard', icon: 'grid' },
          { href: 'reports.html', label: 'All Reports', id: 'reports', icon: 'list' },
        ],
      });
      links.push({
        section: 'Hospital',
        items: [
          { href: 'appointments.html', label: 'Appointments', id: 'appointments', icon: 'calendar' },
          { href: 'verify.html', label: 'Verify Report', id: 'verify', icon: 'check' },
        ],
      });
    } else {
      if (Auth.hasRole('Uploader')) {
        links.push({
          section: 'Clinical',
          items: [
            { href: 'upload.html', label: 'Upload Report', id: 'upload', icon: 'upload' },
          ],
        });
      }

      links.push({
        section: 'Records',
        items: [
          { href: 'reports.html', label: 'Medical Reports', id: 'reports', icon: 'list' },
          { href: 'appointments.html', label: 'Appointments', id: 'appointments', icon: 'calendar' },
          { href: 'verify.html', label: 'Verify Report', id: 'verify', icon: 'check' },
        ],
      });
    }

    links.push({
      section: 'Support',
      items: [
        { href: 'notifications.html', label: 'Notifications', id: 'notifications', icon: 'bell' },
        { href: 'contact.html', label: 'Contact Desk', id: 'contact', icon: 'mail' },
      ],
    });

    const icons = {
      grid: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z"/></svg>',
      upload: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 2l4 4H9v6H7V6H4l4-4zm-6 10h12v2H2v-2z"/></svg>',
      check: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 12.5L2 8l1.4-1.4 3.1 3.1 7.1-7.1L15 4l-8.5 8.5z"/></svg>',
      list: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h12v2H2v-2z"/></svg>',
      calendar: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13 2h-1V1h-1v1H5V1H4v1H3c-.6 0-1 .4-1 1v10c0 .6.4 1 1 1h10c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1zm0 11H3V6h10v7zm0-8H3V3h1v1h1V3h6v1h1V3h1v2z"/></svg>',
      bell: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a4 4 0 00-4 4v2.3L2.4 10H13.6L12 7.3V5a4 4 0 00-4-4zm0 14a2 2 0 01-2-2h4a2 2 0 01-2 2z"/></svg>',
      mail: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 3h14v10H1V3zm1.4 1l5.6 4.2L13.6 4H2.4zM2 12h12V5.3L8 9.7 2 5.3V12z"/></svg>',
    };

    sidebar.innerHTML = `
      ${user ? `
        <div class="app-sidebar__section app-sidebar__profile">
          <div class="profile-card">
            <div class="profile-card__header">
              <button type="button" class="profile-avatar" id="profile-avatar-btn" aria-label="Change profile photo" title="Change profile photo">
                ${this.avatarMarkup(user)}
                <span class="profile-avatar__camera" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM2 5h2.2l1-1.5h5.6l1 1.5H14v8H2V5zm6 7a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/></svg>
                </span>
              </button>
              <input type="file" id="profile-photo-input" class="sr-only" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp">
              <div class="profile-card__meta">
                <div class="profile-card__name">${this.escapeHtml(user.name)}</div>
                <div class="profile-card__role">${this.escapeHtml(this.roleLabel(user.role))}${user.patientId ? ` · ${this.escapeHtml(user.patientId)}` : ''}</div>
              </div>
            </div>
            <div class="profile-card__actions">
              <button type="button" class="profile-card__action" id="profile-photo-btn">Change photo</button>
              ${user.profileImage ? '<button type="button" class="profile-card__action" id="profile-photo-remove">Remove</button>' : ''}
              <button type="button" class="profile-card__action profile-card__action--muted" id="sidebar-logout-btn">Sign out</button>
            </div>
          </div>
        </div>
      ` : ''}
      ${links.map(section => `
        <div class="app-sidebar__section">
          <div class="app-sidebar__heading">${section.section}</div>
          ${section.items.map(item => `
            <a href="${item.href}" class="app-sidebar__link ${activePage === item.id ? 'app-sidebar__link--active' : ''}" ${item.id === 'notifications' ? 'data-alert-link' : ''}>
              ${icons[item.icon] || ''}
              <span class="app-sidebar__link-label">${item.label}</span>
              ${item.id === 'notifications' ? '<span class="nav-alert-badge" data-alert-badge hidden></span>' : ''}
            </a>
          `).join('')}
        </div>
      `).join('')}
    `;

    const sideLogout = document.getElementById('sidebar-logout-btn');
    if (sideLogout) sideLogout.addEventListener('click', () => this.confirmLogout());

    this.bindProfilePhotoControls(activePage);

    sidebar.querySelectorAll('a.app-sidebar__link').forEach((link) => {
      link.addEventListener('click', () => this.closeMobileNav());
    });

    this.renderBottomNav(activePage);
    this.refreshAlertBadges();
  },

  /**
   * Show unread alert count on Notifications / Alerts nav links.
   */
  async refreshAlertBadges() {
    if (!Auth.isAuthenticated() || typeof Api === 'undefined') return;

    try {
      const data = await Api.getUnreadNotificationCount();
      const count = Number(data.unreadCount) || 0;
      const label = count > 99 ? '99+' : String(count);

      document.querySelectorAll('[data-alert-badge]').forEach((badge) => {
        if (count > 0) {
          badge.textContent = label;
          badge.hidden = false;
          badge.setAttribute('aria-label', `${count} unread alerts`);
        } else {
          badge.textContent = '';
          badge.hidden = true;
          badge.removeAttribute('aria-label');
        }
      });

      document.querySelectorAll('[data-alert-link]').forEach((link) => {
        if (count > 0) {
          link.setAttribute('aria-label', `Alerts, ${count} unread`);
        } else {
          link.removeAttribute('aria-label');
        }
      });
    } catch {
      // Silent — badge is optional UX; inbox page still loads full list
    }
  },

  avatarUrl(user) {
    if (!user || !user.profileImage) return '';
    return `${CONFIG.ASSET_BASE_URL}/avatars/${encodeURIComponent(user.profileImage)}`;
  },

  initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  avatarMarkup(user) {
    const url = this.avatarUrl(user);
    if (url) {
      return `<img class="profile-avatar__img" src="${this.escapeHtml(url)}" alt="" width="56" height="56">`;
    }
    return `<span class="profile-avatar__initials" aria-hidden="true">${this.escapeHtml(this.initials(user.name))}</span>`;
  },

  bindProfilePhotoControls(activePage) {
    const input = document.getElementById('profile-photo-input');
    const openPicker = () => input && input.click();
    const avatarBtn = document.getElementById('profile-avatar-btn');
    const changeBtn = document.getElementById('profile-photo-btn');
    const removeBtn = document.getElementById('profile-photo-remove');

    if (avatarBtn) avatarBtn.addEventListener('click', openPicker);
    if (changeBtn) changeBtn.addEventListener('click', openPicker);

    if (input) {
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        input.value = '';
        if (!file) return;

        try {
          UI.showLoading(true);
          const data = await Api.uploadProfileImage(file);
          Auth.updateUser(data.user);
          if (typeof HCI !== 'undefined') HCI.announce('Profile photo updated');
          this.renderSidebar(activePage);
        } catch (err) {
          UI.showNotification('notification-area', 'error', 'Photo upload failed', err.message);
        } finally {
          UI.showLoading(false);
        }
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        try {
          UI.showLoading(true);
          const data = await Api.removeProfileImage();
          Auth.updateUser(data.user);
          this.renderSidebar(activePage);
        } catch (err) {
          UI.showNotification('notification-area', 'error', 'Could not remove photo', err.message);
        } finally {
          UI.showLoading(false);
        }
      });
    }
  },

  /**
   * Mobile bottom tabs — primary destinations within thumb reach.
   * Verify / Contact / role extras also reachable via More → drawer.
   */
  renderBottomNav(activePage) {
    if (!Auth.isAuthenticated()) return;

    let bar = document.getElementById('bottom-nav');
    if (!bar) {
      bar = document.createElement('nav');
      bar.id = 'bottom-nav';
      bar.className = 'bottom-nav';
      bar.setAttribute('aria-label', 'Primary');
      document.body.appendChild(bar);
    }

    let primary;
    if (Auth.hasRole('Admin')) {
      primary = [
        { href: 'dashboard.html', label: 'Home', id: 'dashboard', icon: 'home' },
        { href: 'reports.html', label: 'Reports', id: 'reports', icon: 'list' },
        { href: 'appointments.html', label: 'Appts', id: 'appointments', icon: 'calendar' },
        { href: 'notifications.html', label: 'Alerts', id: 'notifications', icon: 'bell' },
        { id: 'more', icon: 'more', label: 'More' },
      ];
    } else if (Auth.hasRole('Uploader')) {
      primary = [
        { href: 'upload.html', label: 'Upload', id: 'upload', icon: 'upload' },
        { href: 'reports.html', label: 'Reports', id: 'reports', icon: 'list' },
        { href: 'appointments.html', label: 'Appts', id: 'appointments', icon: 'calendar' },
        { href: 'notifications.html', label: 'Alerts', id: 'notifications', icon: 'bell' },
        { id: 'more', icon: 'more', label: 'More' },
      ];
    } else {
      // Recipient / patient
      primary = [
        { href: 'reports.html', label: 'Reports', id: 'reports', icon: 'list' },
        { href: 'appointments.html', label: 'Appts', id: 'appointments', icon: 'calendar' },
        { href: 'notifications.html', label: 'Alerts', id: 'notifications', icon: 'bell' },
        { href: 'contact.html', label: 'Contact', id: 'contact', icon: 'mail' },
        { id: 'more', icon: 'more', label: 'More' },
      ];
    }

    const icons = {
      home: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2.5 2 9h2v8h5v-5h2v5h5V9h2L10 2.5z"/></svg>',
      upload: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 3l4 4h-3v6H9V7H6l4-4zM4 15h12v2H4v-2z"/></svg>',
      list: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3 5h14v2H3V5zm0 4h14v2H3V9zm0 4h14v2H3v-2z"/></svg>',
      calendar: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M15 3h-1V2h-1v1H7V2H6v1H5a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1zm0 13H5V8h10v8z"/></svg>',
      bell: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2a5 5 0 00-5 5v2.6L3.5 13h13L15 9.6V7a5 5 0 00-5-5zm0 16a2.5 2.5 0 01-2.5-2.5h5A2.5 2.5 0 0110 18z"/></svg>',
      mail: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M2 4h16v12H2V4zm1.5 1.2 6.5 4.9 6.5-4.9h-13zM3 15h14V6.8l-7 5.2-7-5.2V15z"/></svg>',
      more: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm4 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm4 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z"/></svg>',
    };

    const primaryIds = primary.filter((t) => t.id !== 'more').map((t) => t.id);

    bar.innerHTML = primary.map((tab) => {
      const isMore = tab.id === 'more';
      const isActive = isMore
        ? !primaryIds.includes(activePage)
        : activePage === tab.id;

      if (isMore) {
        return `
          <button type="button" class="bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}" id="bottom-nav-more" aria-label="More menu" aria-haspopup="true">
            <span class="bottom-nav__icon">${icons.more}</span>
            <span>More</span>
          </button>
        `;
      }

      const alertAttrs = tab.id === 'notifications' ? ' data-alert-link' : '';
      const alertBadge = tab.id === 'notifications'
        ? '<span class="nav-alert-badge nav-alert-badge--dot" data-alert-badge hidden></span>'
        : '';

      return `
        <a href="${tab.href}" class="bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}" ${isActive ? 'aria-current="page"' : ''}${alertAttrs}>
          <span class="bottom-nav__icon">${icons[tab.icon] || ''}${alertBadge}</span>
          <span>${tab.label}</span>
        </a>
      `;
    }).join('');

    document.body.classList.add('has-bottom-nav');

    const moreBtn = document.getElementById('bottom-nav-more');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => this.toggleMobileNav());
    }
  },
};
