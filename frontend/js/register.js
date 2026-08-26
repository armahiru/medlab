/**
 * MediChain — Register page logic (HCI field-level errors)
 */
document.addEventListener('DOMContentLoaded', () => {
  if (Auth.redirectIfAuthenticated()) return;

  const form = document.getElementById('register-form');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm-password');
  const roleInput = document.getElementById('role');
  const patientIdInput = document.getElementById('patient-id');
  const patientIdGroup = document.getElementById('patient-id-group');
  const phoneInput = document.getElementById('phone');
  const phoneGroup = document.getElementById('phone-group');

  function syncPatientFields() {
    const isRecipient = roleInput.value === 'Recipient';
    patientIdGroup.style.display = isRecipient ? 'block' : 'none';
    phoneGroup.style.display = isRecipient ? 'block' : 'none';
    patientIdInput.required = isRecipient;
    if (!isRecipient) {
      patientIdInput.value = '';
      phoneInput.value = '';
      HCI.clearFieldError(patientIdInput);
    }
  }

  roleInput.addEventListener('change', syncPatientFields);
  syncPatientFields();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearNotifications('notification-area');
    HCI.clearFormErrors(form);

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;
    const role = roleInput.value;
    const patientId = patientIdInput.value.trim();
    const phone = phoneInput.value.trim();
    let valid = true;

    if (!name) {
      HCI.setFieldError(nameInput, 'Enter your full name.');
      valid = false;
    }
    if (!email) {
      HCI.setFieldError(emailInput, 'Enter your work email.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      HCI.setFieldError(emailInput, 'That email does not look valid.');
      valid = false;
    }
    if (!password) {
      HCI.setFieldError(passwordInput, 'Choose a password.');
      valid = false;
    } else if (password.length < 6) {
      HCI.setFieldError(passwordInput, 'Use at least 6 characters.');
      valid = false;
    }
    if (password !== confirm) {
      HCI.setFieldError(confirmInput, 'Passwords do not match.');
      valid = false;
    }
    if (role === 'Recipient' && !patientId) {
      HCI.setFieldError(patientIdInput, 'Patient ID is required for patient accounts.');
      valid = false;
    }

    if (!valid) {
      UI.showNotification(
        'notification-area',
        'error',
        'Check the form',
        'Fix the highlighted fields, then try again.'
      );
      (form.querySelector('[aria-invalid="true"]') || nameInput).focus();
      return;
    }

    const submitBtn = form.querySelector('[type="submit"]');
    HCI.setBusy(submitBtn, true, 'Creating account…');
    UI.showLoading(true);

    try {
      let firebaseUid = '';
      if (FirebaseAuth.isConfigured()) {
        try {
          const fbUser = await FirebaseAuth.register(email, password);
          firebaseUid = fbUser.uid;
        } catch (err) {
          if (err && err.code !== 'auth/email-already-in-use') {
            throw new Error(FirebaseAuth.firebaseError(err));
          }
        }
      }

      await Api.register(name, email, password, role, patientId || undefined, phone || undefined, firebaseUid);
      window.location.href = 'login.html?registered=1';
    } catch (err) {
      UI.showNotification('notification-area', 'error', 'Registration failed', err.message);
      HCI.setBusy(submitBtn, false);
    } finally {
      UI.showLoading(false);
    }
  });
});
