/**
 * MediChain — Human–Computer Interaction helpers
 * Nielsen/Norman-inspired: status visibility, error prevention,
 * recognition over recall, accessibility, and recovery.
 */
const HCI = {
  init() {
    this.ensureSkipLink();
    this.ensureLiveRegion();
    this.bindGlobalKeys();
    this.enhanceForms(document);
  },

  ensureSkipLink() {
    if (document.getElementById('skip-to-content')) return;
    const main = document.querySelector('.app-main, .auth-card, .public-main, .landing__body, main');
    if (!main) return;
    if (!main.id) main.id = 'main-content';

    const skip = document.createElement('a');
    skip.id = 'skip-to-content';
    skip.className = 'skip-link';
    skip.href = `#${main.id}`;
    skip.textContent = 'Skip to main content';
    document.body.prepend(skip);
  },

  ensureLiveRegion() {
    if (document.getElementById('hci-live')) return;
    const live = document.createElement('div');
    live.id = 'hci-live';
    live.className = 'sr-only';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    document.body.appendChild(live);
  },

  announce(message) {
    const live = document.getElementById('hci-live');
    if (!live) return;
    live.textContent = '';
    window.setTimeout(() => {
      live.textContent = message;
    }, 30);
  },

  bindGlobalKeys() {
    if (this._keysBound) return;
    this._keysBound = true;

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const openModal = document.querySelector('.modal-overlay.is-open');
      if (openModal) {
        openModal.classList.remove('is-open');
        this.announce('Dialog closed');
        return;
      }
      if (document.body.classList.contains('mobile-nav-open') && typeof UI !== 'undefined') {
        UI.closeMobileNav();
      }
    });
  },

  /**
   * Visibility of system status — busy buttons during async work.
   */
  setBusy(button, busy, busyLabel = 'Working…') {
    if (!button) return;
    if (busy) {
      button.dataset.hciLabel = button.textContent.trim();
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.classList.add('is-busy');
      const label = button.querySelector('.btn__label') || button;
      if (button.querySelector('.btn__label')) {
        button.querySelector('.btn__label').textContent = busyLabel;
      } else {
        button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span class="btn__label">${HCI.escape(busyLabel)}</span>`;
      }
    } else {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.classList.remove('is-busy');
      const original = button.dataset.hciLabel;
      if (original) {
        button.textContent = original;
        delete button.dataset.hciLabel;
      }
    }
  },

  escape(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /**
   * Error prevention — field-level validation messages (near the control).
   */
  setFieldError(input, message) {
    if (!input) return;
    const group = input.closest('.form-group') || input.parentElement;
    input.classList.add('form-input--error');
    input.setAttribute('aria-invalid', 'true');

    let err = group.querySelector('.form-error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'form-error';
      err.id = `${input.id || 'field'}-error`;
      group.appendChild(err);
    }
    err.textContent = message;
    input.setAttribute('aria-describedby', err.id);
  },

  clearFieldError(input) {
    if (!input) return;
    const group = input.closest('.form-group') || input.parentElement;
    input.classList.remove('form-input--error');
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    const err = group.querySelector('.form-error');
    if (err) err.remove();
  },

  clearFormErrors(form) {
    if (!form) return;
    form.querySelectorAll('.form-input, .form-select, .form-textarea').forEach((el) => {
      this.clearFieldError(el);
    });
  },

  /**
   * Clear field errors as the user corrects them (immediate feedback).
   */
  enhanceForms(root = document) {
    root.querySelectorAll('form').forEach((form) => {
      if (form.dataset.hciEnhanced) return;
      form.dataset.hciEnhanced = '1';

      form.querySelectorAll('.form-input, .form-select, .form-textarea').forEach((input) => {
        input.addEventListener('input', () => this.clearFieldError(input));
        input.addEventListener('change', () => this.clearFieldError(input));
      });
    });
  },

  /**
   * Focus management for dialogs (user control & accessibility).
   */
  trapFocus(overlay) {
    const dialog = overlay.querySelector('[role="dialog"]') || overlay;
    const focusable = dialog.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return () => {};

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();

    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    overlay.addEventListener('keydown', onKey);
    return () => overlay.removeEventListener('keydown', onKey);
  },

  emptyState({ title, message, actionHref, actionLabel }) {
    const action = actionHref && actionLabel
      ? `<p style="margin-top: var(--space-05);"><a class="btn btn--secondary btn--sm" href="${this.escape(actionHref)}">${this.escape(actionLabel)}</a></p>`
      : '';
    return `
      <div class="empty-state" role="status">
        <div class="empty-state__title">${this.escape(title)}</div>
        <p>${this.escape(message)}</p>
        ${action}
      </div>
    `;
  },
};

document.addEventListener('DOMContentLoaded', () => HCI.init());
