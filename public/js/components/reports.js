/**
 * Reports component
 */
const Reports = (() => {
  async function render() {
    const q = ($('rSearch')?.value || '').trim();
    try {
      const reports = await API.get(`/reports${q ? '?q=' + encodeURIComponent(q) : ''}`);
      const rows = reports.map(r => {
        const linked = r.link_type === 'none' ? '—' : `${r.link_type}: ${r.link_id || '—'}`;
        const sizeKB = ((r.size || 0) / 1024).toFixed(1) + ' KB';
        return `<tr>
          <td class="mono">${escapeHTML(r.filename)}</td>
          <td class="mono">${escapeHTML(r.mime_type || '')}</td>
          <td>${escapeHTML(r.tag || '')}</td>
          <td class="mono">${escapeHTML(linked)}</td>
          <td class="mono">${sizeKB}</td>
          <td>
            <button class="btn ghost small" onclick="Reports.download(${r.id})">Yüklə</button>
            <button class="btn ghost small" onclick="Reports.remove(${r.id})">Sil</button>
          </td>
        </tr>`;
      }).join('');
      $('tblReports').innerHTML = rows || '<tr><td colspan="6" class="muted">Hesabat yoxdur</td></tr>';

      rebuildLinkPicker();
    } catch (err) {
      console.error('Reports render:', err);
    }
  }

  function rebuildLinkPicker() {
    const type = $('rLinkType').value;
    let opts = '';
    if (type === 'shipment') {
      const shipments = Shipments.getAll();
      opts = shipments.map(s => `<option value="${s.id}">${escapeHTML(s.shipment_no)}</option>`).join('');
    } else if (type === 'order') {
      const orders = Orders.getAll();
      opts = orders.map(o => `<option value="${o.id}">${escapeHTML(o.order_no)}</option>`).join('');
    } else {
      opts = '<option value="">—</option>';
    }
    $('rLinkId').innerHTML = opts || '<option value="">—</option>';
  }

  async function upload(fileInput) {
    const file = fileInput.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tag', $('rTag').value.trim());
    formData.append('link_type', $('rLinkType').value);
    formData.append('link_id', $('rLinkId').value);
    try {
      await API.upload('/reports', formData);
      fileInput.value = '';
      $('rTag').value = '';
      await render();
    } catch (err) { showError(err.message); }
  }

  function download(id) {
    const token = API.getToken();
    const path = `/reports/${id}/download`;
    const href = window.AppConfig?.toApiUrl ? window.AppConfig.toApiUrl(path) : `/api${path}`;
    window.open(`${href}?token=${encodeURIComponent(token)}`, '_blank');
  }

  async function remove(id) {
    if (!confirm('Bu hesabatı silmək istəyirsiniz?')) return;
    try {
      await API.del(`/reports/${id}`);
      await render();
    } catch (err) { showError(err.message); }
  }

  return { render, upload, download, remove, rebuildLinkPicker };
})();
