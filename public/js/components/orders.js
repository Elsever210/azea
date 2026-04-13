/**
 * Orders component
 */
const Orders = (() => {
  let editingId = null;
  let draftItems = [];
  let allOrders = [];

  async function render() {
    const q = ($('orderSearch')?.value || '').trim();
    try {
      const result = await API.get(`/orders${q ? '?q=' + encodeURIComponent(q) : ''}`);
      allOrders = result.data || [];
      const rows = allOrders.map(o => `<tr>
        <td class="mono">${escapeHTML(o.order_no)}</td>
        <td>${escapeHTML(o.customer_name)}</td>
        <td>${statusTag(o.status)}</td>
        <td class="mono">${o.item_count || 0}</td>
        <td class="mono">${money(o.total || 0)}</td>
        <td>
          <button class="btn ghost small" onclick="Orders.edit(${o.id})">Redaktə</button>
          <button class="btn ghost small" onclick="Orders.remove(${o.id})">Sil</button>
        </td>
      </tr>`).join('');
      $('tblOrders').innerHTML = rows || '<tr><td colspan="6" class="muted">Sifariş yoxdur</td></tr>';

      // Rebuild product picker
      rebuildProductPicker();
    } catch (err) {
      console.error('Orders render:', err);
    }
  }

  function rebuildProductPicker() {
    const products = Products.getAll();
    const opts = products.map(p => `<option value="${p.id}">${escapeHTML(p.sku)} — ${escapeHTML(p.name)}</option>`).join('');
    $('oProduct').innerHTML = opts || '<option value="">Məhsul yoxdur</option>';
  }

  function renderDraftItems() {
    const products = Products.getAll();
    let total = 0;
    const rows = draftItems.map((it, idx) => {
      const p = products.find(x => x.id === it.product_id);
      const name = p?.name || '';
      const sell = p?.unit_sell || 0;
      const line = sell * it.qty;
      total += line;
      return `<tr>
        <td class="mono">${escapeHTML(p?.sku || '')}</td>
        <td>${escapeHTML(name)}</td>
        <td class="mono">${it.qty}</td>
        <td class="mono">${money(sell)}</td>
        <td class="mono">${money(line)}</td>
        <td><button class="btn ghost small" onclick="Orders.removeItem(${idx})">Sil</button></td>
      </tr>`;
    }).join('');
    $('oItems').innerHTML = rows || '<tr><td colspan="6" class="muted">Məhsul əlavə edin</td></tr>';
    $('oTotal').textContent = money(total);
  }

  function addItem() {
    const productId = parseInt($('oProduct').value, 10);
    const qty = parseInt($('oQty').value, 10);
    if (!productId) return showError('Məhsul seçin');
    if (!qty || qty < 1) return showError('Say daxil edin');
    const existing = draftItems.find(x => x.product_id === productId);
    if (existing) existing.qty += qty;
    else draftItems.push({ product_id: productId, qty });
    $('oQty').value = '';
    renderDraftItems();
  }

  function removeItem(idx) {
    draftItems.splice(idx, 1);
    renderDraftItems();
  }

  function clear() {
    editingId = null;
    draftItems = [];
    ['oCustomer', 'oPhone', 'oAddress', 'oLogistics', 'oCustoms', 'oNotes'].forEach(id => $(id).value = '');
    $('oStatus').value = 'NEW';
    renderDraftItems();
  }

  async function save() {
    const data = {
      customer_name: $('oCustomer').value.trim(),
      phone: $('oPhone').value.trim(),
      address: $('oAddress').value.trim(),
      status: $('oStatus').value,
      logistics: parseFloat($('oLogistics').value) || 0,
      customs: parseFloat($('oCustoms').value) || 0,
      notes: $('oNotes').value.trim(),
      items: draftItems.map(x => ({ product_id: x.product_id, qty: x.qty })),
    };
    if (!data.customer_name) return showError('Müştəri adı tələb olunur');
    if (!data.items.length) return showError('Ən azı 1 məhsul əlavə edin');

    try {
      if (editingId) await API.put(`/orders/${editingId}`, data);
      else await API.post('/orders', data);
      clear();
      await App.refreshView();
    } catch (err) { showError(err.message); }
  }

  async function edit(id) {
    try {
      const o = await API.get(`/orders/${id}`);
      editingId = o.id;
      $('oCustomer').value = o.customer_name || '';
      $('oPhone').value = o.phone || '';
      $('oAddress').value = o.address || '';
      $('oStatus').value = o.status;
      $('oLogistics').value = o.logistics || 0;
      $('oCustoms').value = o.customs || 0;
      $('oNotes').value = o.notes || '';
      draftItems = (o.items || []).map(i => ({ product_id: i.product_id, qty: i.qty }));
      renderDraftItems();
      App.setView('orders');
    } catch (err) { showError(err.message); }
  }

  async function remove(id) {
    if (!confirm('Bu sifarişi silmək istəyirsiniz?')) return;
    try {
      await API.del(`/orders/${id}`);
      await App.refreshView();
    } catch (err) { showError(err.message); }
  }

  function getAll() { return allOrders; }

  return { render, clear, save, edit, remove, addItem, removeItem, getAll, rebuildProductPicker };
})();
