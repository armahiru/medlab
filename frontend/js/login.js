/**
 * MediChain — Login page logic (HCI: field errors + busy feedback)
 */
document.addEventListener('DOMContentLoaded', () => {
  if (Auth.redirectIfAuthenticated()) return;

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  const params = new URLSearchParams(window.location.search);
  if (params.get('registered') === '1') {
    UI.showNotification(
      'notification-area',
      'success',
      'Account created',
      'Your account was created successfully. Please sign in to continue.'
    );
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearNotifications('notification-area');
    HCI.clearFormErrors(form);

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
      (form.querySelector('[aria-invalid="true"]') || emailInput).focus();
      return;
    }

    const submitBtn = form.querySelector('[type="submit"]');
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
});
