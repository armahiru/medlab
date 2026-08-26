/**
 * MediChain — Login + Firebase password reset
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
  const resetEmailInput = document.getElementById('reset-email');

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
    subtitle.textContent = 'Reset your password with a Firebase email link';
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

  async function signIn(email, password) {
    if (FirebaseAuth.isConfigured()) {
      try {
        const idToken = await FirebaseAuth.signIn(email, password);
        return Api.firebaseLogin(idToken);
      } catch (err) {
        const code = err && err.code;
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
          const data = await Api.login(email, password);
          try {
            await FirebaseAuth.register(email, password);
          } catch {
            /* already exists or client not ready — Mongo login still succeeded */
          }
          return data;
        }
        throw new Error(FirebaseAuth.firebaseError(err));
      }
    }
    return Api.login(email, password);
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
      const data = await signIn(email, password);
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

    if (!FirebaseAuth.isConfigured()) {
      UI.showNotification(
        'notification-area',
        'error',
        'Firebase not set up',
        'Add your Firebase web config in frontend/js/config.js first.'
      );
      return;
    }

    const submitBtn = requestForm.querySelector('[type="submit"]');
    HCI.setBusy(submitBtn, true, 'Sending…');
    UI.showLoading(true);

    try {
      await Api.forgotPassword(email);
      try {
        await FirebaseAuth.sendResetEmail(email);
      } catch (err) {
        if (err && err.code !== 'auth/user-not-found') {
          throw err;
        }
      }
      UI.showNotification(
        'notification-area',
        'success',
        'Check your email',
        'If that address is registered, Firebase sent a reset link. Open it, then sign in.'
      );
    } catch (err) {
      UI.showNotification(
        'notification-area',
        'error',
        'Could not send link',
        FirebaseAuth.firebaseError(err)
      );
    } finally {
      HCI.setBusy(submitBtn, false);
      UI.showLoading(false);
    }
  });
});
