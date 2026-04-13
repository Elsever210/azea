/**
 * Shipments component
 */
const Shipments = (() => {
  let editingId = null;
  let allShipments = [];

  async function render() {
    const q = ($('shipSearch')?.value || '').trim();
    try {
      allShipments = await API.get(`/shipments${q ? '?q=' + encodeURIComponent(q) : ''}`);
      const rows = allShipments.map(s => `<tr>
        <td class="mono">${escapeHTML(s.shipment_no)}</td>
        <td>${escapeHTML(s.route || '')}</td>
        <td>${shipmentTag(s.status)}</td>
        <td class="mono">${escapeHTML(s.eta || '')}</td>
        <td class="mono">${escapeHTML(s.awb || '')}</td>
        <td class="mono">${s.order_count || 0}</td>
        <td>
          <button class="btn ghost small" onclick="Shipments.edit(${s.id})">Redaktə</button>
          <button class="btn ghost small" onclick="Shipments.remove(${s.id})">Sil</button>
        </td>
      </tr>`).join('');
      $('tblShipments').innerHTML = rows || '<tr><td colspan="7" class="muted">Göndəriş yoxdur</td></tr>';

      rebuildOrderPicker();
    } catch (err) {
      console.error('Shipments render:', err);
    }
  }

  function rebuildOrderPicker() {
    const orders = Orders.getAll();
    const opts = orders.map(o => `<option value="${o.id}">${escapeHTML(o.order_no)} — ${escapeHTML(o.customer_name)}</option>`).join('');
    $('sOrders').innerHTML = opts || '';
  }

  function clear() {
    editingId = null;
    $('sRoute').value = 'CN→AZ Air Freight';
    $('sStatus').value = 'CREATED';
    $('sETA').value = '';
    $('sAWB').value = '';
    Array.from($('sOrders').options).forEach(o => o.selected = false);
  }

  async function save() {
    const data = {
      route: $('sRoute').value,
      status: $('sStatus').value,
      eta: $('sETA').value,
      awb: $('sAWB').value.trim(),
      order_ids: Array.from($('sOrders').selectedOptions).map(o => parseInt(o.value, 10)),
    };
    try {
      if (editingId) await API.put(`/shipments/${editingId}`, data);
      else await API.post('/shipments', data);
      clear();
      await App.refreshView();
    } catch (err) { showError(err.message); }
  }

  async function edit(id) {
    try {
      const s = await API.get(`/shipments/${id}`);
      editingId = s.id;
      $('sRoute').value = s.route || 'CN→AZ Air Freight';
      $('sStatus').value = s.status;
      $('sETA').value = s.eta || '';
      $('sAWB').value = s.awb || '';
      const orderIds = new Set((s.orders || []).map(o => String(o.id)));
      Array.from($('sOrders').options).forEach(o => o.selected = orderIds.has(o.value));
      App.setView('shipments');
    } catch (err) { showError(err.message); }
  }

  async function remove(id) {
    if (!confirm('Bu göndərişi silmək istəyirsiniz?')) return;
    try {
      await API.del(`/shipments/${id}`);
      await App.refreshView();
    } catch (err) { showError(err.message); }
  }

  function getAll() { return allShipments; }

  return { render, clear, save, edit, remove, getAll };
})();
