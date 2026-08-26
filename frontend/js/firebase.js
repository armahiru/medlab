/**
 * Firebase Auth helper (compat SDK loaded on login/register pages).
 */
const FirebaseAuth = {
  _app: null,

  isConfigured() {
    const cfg = CONFIG.FIREBASE || {};
    return !!(cfg.apiKey && cfg.projectId && cfg.appId && window.firebase);
  },

  init() {
    if (!this.isConfigured()) return null;
    try {
      const apps = (window.firebase && firebase.apps) || [];
      if (!this._app) {
        this._app = apps.length ? firebase.app() : firebase.initializeApp(CONFIG.FIREBASE);
      }
      return firebase.auth();
    } catch (err) {
      console.error('[MediChain] Firebase client init failed:', err);
      throw new Error('Could not start Firebase on this page. Refresh and try again.');
    }
  },

  firebaseError(err) {
    if (!err) return 'Request failed.';
    const code = err.code;
    const map = {
      'auth/invalid-email': 'That email does not look valid.',
      'auth/user-disabled': 'This account is disabled.',
      'auth/user-not-found': 'No Firebase account for this email.',
      'auth/wrong-password': 'Wrong email or password.',
      'auth/invalid-credential': 'Wrong email or password.',
      'auth/email-already-in-use': 'That email is already registered.',
      'auth/weak-password': 'Use at least 6 characters.',
      'auth/too-many-requests': 'Too many attempts. Try again later.',
      'auth/network-request-failed': 'Network error. Check your connection.',
      'auth/unauthorized-continue-uri': 'Add this site to Firebase Authorized domains.',
      'auth/invalid-continue-uri': 'Add this site to Firebase Authorized domains.',
    };
    return map[code] || err.message || 'Firebase request failed.';
  },

  async register(email, password) {
    const auth = this.init();
    if (!auth) {
      throw new Error('Firebase is not set up on this page.');
    }
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    return cred.user;
  },

  async signIn(email, password) {
    const auth = this.init();
    if (!auth) {
      throw new Error('Firebase is not set up on this page.');
    }
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user.getIdToken();
  },

  async sendResetEmail(email) {
    const auth = this.init();
    if (!auth) {
      throw new Error('Firebase is not set up on this page.');
    }
    await auth.sendPasswordResetEmail(email, {
      url: `${window.location.origin}/login.html`,
      handleCodeInApp: false,
    });
  },
};
