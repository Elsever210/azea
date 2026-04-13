/**
 * API Client — handles all HTTP calls to the backend
 */
const API = (() => {
  const BASE = window.AppConfig?.apiBase || '/api';
  let token = localStorage.getItem('token') || '';

  function setToken(t) {
    token = t;
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');
  }

  function getToken() { return token; }

  async function request(method, path, body, isFormData) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    const endpoint = window.AppConfig?.toApiUrl ? window.AppConfig.toApiUrl(path) : `${BASE}${path}`;
    const res = await fetch(endpoint, opts);
    if (res.status === 401) {
      setToken('');
      App?.showLogin?.();
      throw new Error('Session expired');
    }
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }

  return {
    setToken,
    getToken,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
    upload: (path, formData) => request('POST', path, formData, true),
  };
})();
