/**
 * Runtime app config for web and mobile wrappers.
 *
 * Override API base with either:
 * - localStorage key: apiBaseUrl
 * - query string: ?apiBase=https://your-domain/api
 * - window.__API_BASE__ set before scripts load
 */
window.AppConfig = (() => {
  const isFileProtocol = window.location.protocol === 'file:';
  const isCapacitor = window.location.protocol === 'capacitor:' || window.Capacitor;
  const qs = new URLSearchParams(window.location.search);
  const fromQuery = qs.get('apiBase') || '';
  const fromStorage = localStorage.getItem('apiBaseUrl') || '';
  const fromWindow = typeof window.__API_BASE__ === 'string' ? window.__API_BASE__ : '';

  let defaultApiBase = '/api';
  if (isFileProtocol) {
    defaultApiBase = 'http://10.0.2.2:3000/api'; // Android emulator
  } else if (isCapacitor) {
    defaultApiBase = 'http://localhost:3000/api'; // iOS simulator / device
  }
  const apiBase = (fromQuery || fromStorage || fromWindow || defaultApiBase).replace(/\/+$/, '');

  function toApiUrl(path) {
    const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
    return `${apiBase}${normalizedPath}`;
  }

  function toAssetUrl(path) {
    return String(path || '').replace(/^\/+/, '');
  }

  function setApiBase(nextBase) {
    const val = String(nextBase || '').trim().replace(/\/+$/, '');
    if (!val) return;
    localStorage.setItem('apiBaseUrl', val);
  }

  return {
    apiBase,
    isFileProtocol,
    toApiUrl,
    toAssetUrl,
    setApiBase,
  };
})();
