/**
 * MediChain — Login + password reset panel
 */
document.addEventListener('DOMContentLoaded', () => {
  if (Auth.redirectIfAuthenticated()) return;

  const loginPanel = document.getElementById('auth-panel-login');
  const resetPanel = document.getElementById('auth-panel-reset');
  const subtitle = document.getElementById('auth-subtitle');
  const showResetBtn = document.getElementById('show-reset-btn');
  const showLoginBtn = document.getElementById('show-login-btn');

  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  const requestForm = document.getElementById('reset-request-form');
  const confirmForm = document.getElementById('reset-confirm-form');
  const resetEmailInput = document.getElementById('reset-email');
  const resetCodeInput = document.getElementById('reset-code');
  const resetPasswordInput = document.getElementById('reset-password');
  const resetPasswordConfirmInput = document.getElementById('reset-password-confirm');

  let pendingResetEmail = '';

  function showLoginRoom() {
    resetPanel.hidden = true;
    loginPanel.hidden = false;
    subtitle.textContent = 'Sign in to manage and verify blockchain-secured medical reports';
    UI.clearNotifications('notification-area');
    emailInput.focus();
  }

  function showResetRoom() {
    loginPanel.hidden = true;
    resetPanel.hidden = false;
    requestForm.hidden = false;
    confirmForm.hidden = true;
    subtitle.textContent = 'Reset your password with a code sent to your email';
    UI.clearNotifications('notification-area');
    if (emailInput.value.trim()) {
      resetEmailInput.value = emailInput.value.trim();
    }
    resetEmailInput.focus();
  }

  showResetBtn.addEventListener('click', showResetRoom);
  showLoginBtn.addEventListener('click', showLoginRoom);

  const params = new URLSearchParams(window.location.search);
  if (params.get('registered') === '1') {
    UI.showNotification(
      'notification-area',
      'success',
      'Account created',
      'Your account was created successfully. Please sign in to continue.'
    );
  }
  if (params.get('reset') === '1') {
    showResetRoom();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearNotifications('notification-area');
    HCI.clearFormErrors(loginForm);

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    let valid = true;

    if (!email) {
      HCI.setFieldError(emailInput, 'Enter your work email.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      HCI.setFieldError(emailInput, 'That email does not look valid.');
      valid = false;
    }

    if (!password) {
      HCI.setFieldError(passwordInput, 'Enter your password.');
      valid = false;
    }

    if (!valid) {
      UI.showNotification(
        'notification-area',
        'error',
        'Check the form',
        'Fix the highlighted fields, then try again.'
      );
      (loginForm.querySelector('[aria-invalid="true"]') || emailInput).focus();
      return;
    }

    const submitBtn = loginForm.querySelector('[type="submit"]');
    HCI.setBusy(submitBtn, true, 'Signing in…');
    UI.showLoading(true);

    try {
      const data = await Api.login(email, password);
      Auth.setSession(data.token, data.user);
      HCI.announce('Signed in successfully');
      Auth.redirectByRole();
    } catch (err) {
      UI.showNotification(
        'notification-area',
        'error',
        'Sign in failed',
        err.message || 'Check your email and password, then try again.'
      );
      passwordInput.focus();
      passwordInput.select();
      HCI.setBusy(submitBtn, false);
    } finally {
      UI.showLoading(false);
    }
  });

  requestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearNotifications('notification-area');
    HCI.clearFormErrors(requestForm);

    const email = resetEmailInput.value.trim();
    if (!email) {
      HCI.setFieldError(resetEmailInput, 'Enter your account email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      HCI.setFieldError(resetEmailInput, 'That email does not look valid.');
      return;
    }

    const submitBtn = requestForm.querySelector('[type="submit"]');
    HCI.setBusy(submitBtn, true, 'Sending…');
    UI.showLoading(true);

    try {
      const data = await Api.forgotPassword(email);
      pendingResetEmail = email;
      requestForm.hidden = true;
      confirmForm.hidden = false;
      UI.showNotification(
        'notification-area',
        'success',
        'Check your email',
        data.message || 'If that email is registered, a reset code was sent.'
      );
      resetCodeInput.focus();
    } catch (err) {
      UI.showNotification(
        'notification-area',
        'error',
        'Could not send code',
        err.message || 'Try again in a moment.'
      );
    } finally {
      HCI.setBusy(submitBtn, false);
      UI.showLoading(false);
    }
  });

  confirmForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearNotifications('notification-area');
    HCI.clearFormErrors(confirmForm);

    const code = resetCodeInput.value.trim();
    const newPassword = resetPasswordInput.value;
    const confirmPassword = resetPasswordConfirmInput.value;
    let valid = true;

    if (!/^\d{6}$/.test(code)) {
      HCI.setFieldError(resetCodeInput, 'Enter the 6-digit code from your email.');
      valid = false;
    }
    if (!newPassword || newPassword.length < 6) {
      HCI.setFieldError(resetPasswordInput, 'Use at least 6 characters.');
      valid = false;
    }
    if (newPassword !== confirmPassword) {
      HCI.setFieldError(resetPasswordConfirmInput, 'Passwords do not match.');
      valid = false;
    }
    if (!pendingResetEmail) {
      UI.showNotification(
        'notification-area',
        'error',
        'Start again',
        'Request a new reset code first.'
      );
      return;
    }
    if (!valid) return;

    const submitBtn = confirmForm.querySelector('[type="submit"]');
    HCI.setBusy(submitBtn, true, 'Updating…');
    UI.showLoading(true);

    try {
      const data = await Api.resetPassword(pendingResetEmail, code, newPassword);
      UI.showNotification(
        'notification-area',
        'success',
        'Password updated',
        data.message || 'You can sign in with your new password.'
      );
      emailInput.value = pendingResetEmail;
      passwordInput.value = '';
      pendingResetEmail = '';
      confirmForm.reset();
      showLoginRoom();
      passwordInput.focus();
    } catch (err) {
      UI.showNotification(
        'notification-area',
        'error',
        'Reset failed',
        err.message || 'Invalid or expired code.'
      );
      HCI.setBusy(submitBtn, false);
    } finally {
      UI.showLoading(false);
    }
  });
});
