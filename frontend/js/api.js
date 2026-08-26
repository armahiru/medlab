/**
 * MediChain — HTTP client for backend API
 */
const Api = {
  /**
   * @param {string} endpoint
   * @param {RequestInit} [options]
   * @returns {Promise<any>}
   */
  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    const token = Auth.getToken();

    const headers = { ...(options.headers || {}) };

    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const timeoutMs = options.timeoutMs || 30000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new Error('Request timed out. Check that the server is running and try again.');
      }
      throw new Error(
        err.message === 'Failed to fetch'
          ? 'Cannot reach the server. Start the backend or check your connection.'
          : err.message || 'Network error'
      );
    } finally {
      clearTimeout(timer);
    }

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const message = typeof data === 'object' && data.message
        ? data.message
        : `Request failed (${response.status})`;
      throw new Error(message);
    }

    return data;
  },

  // Auth
  login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register(name, email, password, role, patientId, phone, firebaseUid) {
    const payload = { name, email, password, role };
    if (patientId) payload.patientId = patientId;
    if (phone) payload.phone = phone;
    if (firebaseUid) payload.firebaseUid = firebaseUid;
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  firebaseLogin(idToken) {
    return this.request('/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  },

  forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      timeoutMs: 20000,
    });
  },

  getMe() {
    return this.request('/auth/me');
  },

  getPatients() {
    return this.request('/auth/patients');
  },

  uploadProfileImage(file) {
    const formData = new FormData();
    formData.append('photo', file);
    return this.request('/auth/profile-image', {
      method: 'POST',
      body: formData,
    });
  },

  removeProfileImage() {
    return this.request('/auth/profile-image', { method: 'DELETE' });
  },

  // Reports
  uploadReport(formData) {
    return this.request('/reports', {
      method: 'POST',
      body: formData,
    });
  },

  verifyReport(reportId) {
    return this.request(`/reports/verify/${encodeURIComponent(reportId)}`);
  },

  getReports() {
    return this.request('/reports');
  },

  getAccessLogs(reportId) {
    return this.request(`/reports/${encodeURIComponent(reportId)}/access-logs`);
  },

  /**
   * Authenticated download URL (browser navigation with token is awkward;
   * use downloadReport() which fetches as blob).
   */
  async downloadReport(reportId, filename = 'medical-report') {
    const url = `${CONFIG.API_BASE_URL}/reports/${encodeURIComponent(reportId)}/download`;
    const token = Auth.getToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      let message = `Download failed (${response.status})`;
      try {
        const data = await response.json();
        if (data.message) message = data.message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    // Prefer server filename (ZIP package with file + text details)
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const downloadName = match?.[1] || (filename.endsWith('.zip') ? filename : `${filename}.zip`);

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  },

  // Appointments
  getAppointments() {
    return this.request('/appointments');
  },

  createAppointment(payload) {
    return this.request('/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateAppointmentStatus(id, status) {
    return this.request(`/appointments/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Notifications & contact
  getNotifications() {
    return this.request('/notifications');
  },

  getUnreadNotificationCount() {
    return this.request('/notifications/unread-count');
  },

  markNotificationRead(id) {
    return this.request(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
    });
  },

  markAllNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'PATCH' });
  },

  submitContact(payload) {
    return this.request('/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getContactMessages() {
    return this.request('/contact');
  },

  updateContactStatus(id, status) {
    return this.request(`/contact/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Chain
  getChain() {
    return this.request('/chain');
  },

  validateChain() {
    return this.request('/chain/validate');
  },

  repairChain() {
    return this.request('/chain/repair', { method: 'POST' });
  },

  tamperBlock(blockIndex) {
    return this.request(`/chain/tamper/${blockIndex}`, {
      method: 'PATCH',
    });
  },
};
