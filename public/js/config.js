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
  const qs = new URLSearchParams(window.location.search);
  const fromQuery = qs.get('apiBase') || '';
  const fromStorage = localStorage.getItem('apiBaseUrl') || '';
  const fromWindow = typeof window.__API_BASE__ === 'string' ? window.__API_BASE__ : '';

  const defaultApiBase = isFileProtocol ? 'http://10.0.2.2:3000/api' : '/api';
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
