/**
 * Utility functions
 */
const $ = (id) => document.getElementById(id);

function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function money(n, currency) {
  const cur = (currency || 'USD').toUpperCase();
  const val = Number(n || 0);
  return (cur === 'USD' ? '$' : cur + ' ') + val.toFixed(2);
}

function statusTag(status) {
  const map = {
    NEW: ['tag-blue', 'NEW'], PAID: ['tag-green', 'PAID'], PICK_PACK: ['tag-orange', 'PICK/PACK'],
    SHIPPED: ['tag-yellow', 'SHIPPED'], DELIVERED: ['tag-cyan', 'DELIVERED'], CANCELLED: ['tag-red', 'CANCELLED'],
  };
  const [cls, label] = map[status] || ['tag-muted', status];
  return `<span class="tag ${cls}">${escapeHTML(label)}</span>`;
}

function shipmentTag(status) {
  const map = {
    CREATED: ['tag-muted', 'CREATED'], AT_CN_WAREHOUSE: ['tag-purple', 'CN WH'],
    IN_TRANSIT: ['tag-yellow', 'TRANSIT'], CUSTOMS: ['tag-orange', 'CUSTOMS'],
    AT_AZ_WAREHOUSE: ['tag-blue', 'AZ WH'], DELIVERED: ['tag-cyan', 'DELIVERED'],
  };
  const [cls, label] = map[status] || ['tag-muted', status];
  return `<span class="tag ${cls}">${escapeHTML(label)}</span>`;
}

function formatDate(iso) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function formatDateTime(iso) {
  if (!iso) return '';
  return iso.slice(0, 19).replace('T', ' ');
}

function showError(msg) {
  showToast(msg, 'error');
}

function showToast(msg, type = 'success') {
  const existing = document.querySelectorAll('.toast');
  existing.forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; }, 2800);
  setTimeout(() => el.remove(), 3200);
}
