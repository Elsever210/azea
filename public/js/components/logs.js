/**
 * Logs component — audit log viewer
 */
const Logs = (() => {
  let page = 0;
  const PAGE_SIZE = 50;

  function actionTag(action) {
    const map = {
      LOGIN: 'tag-cyan', CREATE: 'tag-green', UPDATE: 'tag-yellow',
      DELETE: 'tag-red', ADJUST: 'tag-orange', CHANGE_PASSWORD: 'tag-purple',
    };
    const cls = map[action] || 'tag-muted';
    return `<span class="tag ${cls}">${escapeHTML(action)}</span>`;
  }

  function roleTag(role) {
    const map = { admin: 'tag-red', operator: 'tag-blue', customer: 'tag-green' };
    const cls = map[role] || 'tag-muted';
    return `<span class="tag ${cls}">${escapeHTML(role)}</span>`;
  }

  function truncate(s, len) {
    if (!s) return '<span class="muted">—</span>';
    const str = String(s);
    if (str.length <= len) return escapeHTML(str);
    return `<span title="${escapeHTML(str)}">${escapeHTML(str.slice(0, len))}…</span>`;
  }

  async function render() {
    try {
      const action = $('logFilterAction')?.value || '';
      const entity = $('logFilterEntity')?.value || '';
      const userId = $('logFilterUser')?.value || '';
      const search = $('logSearch')?.value?.trim() || '';

      const params = new URLSearchParams();
      params.set('limit', PAGE_SIZE);
      params.set('offset', page * PAGE_SIZE);
      if (action) params.set('action', action);
      if (entity) params.set('entity', entity);
      if (userId) params.set('user_id', userId);
      if (search) params.set('q', search);

      const res = await API.get(`/logs?${params}`);
      const logs = res.data || [];
      const total = res.total || 0;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

      const rows = logs.map(l => `<tr>
        <td class="mono">${l.id}</td>
        <td class="mono" style="white-space:nowrap">${formatDateTime(l.created_at)}</td>
        <td>${escapeHTML(l.username)}</td>
        <td>${roleTag(l.role)}</td>
        <td>${actionTag(l.action)}</td>
        <td>${escapeHTML(l.entity)}</td>
        <td class="mono">${l.entity_id ?? '—'}</td>
        <td>${truncate(l.details, 60)}</td>
        <td class="mono">${escapeHTML(l.ip || '')}</td>
      </tr>`).join('');

      $('tblLogs').innerHTML = rows || '<tr><td colspan="9" class="muted">Log yoxdur</td></tr>';

      // Pagination
      $('logPageInfo').textContent = `${page + 1} / ${totalPages}`;
      $('logPrev').disabled = page === 0;
      $('logNext').disabled = (page + 1) >= totalPages;

      // Stats
      await renderStats();

      // Populate user filter (once)
      if ($('logFilterUser').options.length <= 1) {
        await loadUserFilter();
      }
    } catch (err) {
      console.error('Logs render:', err);
    }
  }

  async function renderStats() {
    try {
      const stats = await API.get('/logs/stats');
      $('logKpiToday').textContent = stats.today || 0;
      if (stats.byAction?.length) {
        $('logKpiTopAction').textContent = `${stats.byAction[0].action} (${stats.byAction[0].count})`;
      }
      if (stats.byUser?.length) {
        $('logKpiTopUser').textContent = `${stats.byUser[0].username} (${stats.byUser[0].count})`;
      }
    } catch {}
  }

  async function loadUserFilter() {
    try {
      const users = await API.get('/auth/users');
      const select = $('logFilterUser');
      for (const u of users) {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.username} (${u.role})`;
        select.appendChild(opt);
      }
    } catch {}
  }

  function prevPage() { if (page > 0) { page--; render(); } }
  function nextPage() { page++; render(); }
  function resetPage() { page = 0; render(); }

  return { render, prevPage, nextPage, resetPage };
})();
