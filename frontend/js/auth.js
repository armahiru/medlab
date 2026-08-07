/**
 * MediChain — Authentication state & role-based routing
 */
const Auth = {
  getToken() {
    return localStorage.getItem(CONFIG.TOKEN_KEY);
  },

  getUser() {
    const raw = localStorage.getItem(CONFIG.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  isAuthenticated() {
    return !!this.getToken() && !!this.getUser();
  },

  hasRole(role) {
    const user = this.getUser();
    return user && user.role === role;
  },

  hasAnyRole(roles) {
    const user = this.getUser();
    return user && roles.includes(user.role);
  },

  setSession(token, user) {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
  },

  updateUser(user) {
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    window.location.href = 'login.html';
  },

  /**
   * Redirect authenticated user to their role home page
   */
  redirectByRole() {
    const user = this.getUser();
    if (!user) return;

    const routes = {
      Admin: 'dashboard.html',
      Uploader: 'upload.html',
      Recipient: 'reports.html',
    };

    window.location.href = routes[user.role] || 'login.html';
  },

  /**
   * Protect a page — call on DOMContentLoaded
   * @param {string|string[]|null} allowedRoles — null = any authenticated user
   */
  requireAuth(allowedRoles = null) {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
      return false;
    }

    if (allowedRoles) {
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      if (!this.hasAnyRole(roles)) {
        this.redirectByRole();
        return false;
      }
    }

    return true;
  },

  /**
   * Redirect away if already logged in (for login/register pages)
   */
  redirectIfAuthenticated() {
    if (this.isAuthenticated()) {
      this.redirectByRole();
      return true;
    }
    return false;
  },
};
