/**
 * MediChain — Simulated Blockchain Medical Report System
 * Same-origin when UI is served from the API (port 5000 / tunnel).
 * Otherwise API is host:5000 (e.g. frontend on :3000).
 */
const CONFIG = {
  API_BASE_URL:
    window.location.port === '5000' || window.location.port === ''
      ? `${window.location.origin}/api`
      : `${window.location.protocol}//${window.location.hostname}:5000/api`,
  /** Origin for static assets like profile photos (/avatars/…) */
  ASSET_BASE_URL:
    window.location.port === '5000' || window.location.port === ''
      ? window.location.origin
      : `${window.location.protocol}//${window.location.hostname}:5000`,
  TOKEN_KEY: 'medichain_token',
  USER_KEY: 'medichain_user',
  APP_NAME: 'MediChain',
};
