/**
 * Inventory component
 */
const Inventory = (() => {
  async function render() {
    const q = ($('invSearch')?.value || '').trim();
    try {
      const inventory = await API.get(`/inventory${q ? '?q=' + encodeURIComponent(q) : ''}`);
      const rows = inventory.map(i => {
        const frag = i.fragile
          ? '<span class="tag"><span class="dot red"></span>Bəli</span>'
          : '<span class="tag"><span class="dot green"></span>Xeyr</span>';
        return `<tr>
          <td class="mono">${escapeHTML(i.sku)}</td>
          <td>${escapeHTML(i.name)}</td>
          <td class="mono">${i.on_hand}</td>
          <td>${frag}</td>
        </tr>`;
      }).join('');
      $('tblInventory').innerHTML = rows || '<tr><td colspan="4" class="muted">Anbar boşdur</td></tr>';

      // Rebuild SKU picker
      const products = Products.getAll();
      const opts = products.map(p => `<option value="${p.id}">${escapeHTML(p.sku)} — ${escapeHTML(p.name)}</option>`).join('');
      $('invSKU').innerHTML = opts || '<option value="">Məhsul yoxdur</option>';
    } catch (err) {
      console.error('Inventory render:', err);
    }
  }

  async function adjust() {
    const productId = parseInt($('invSKU').value, 10);
    const delta = parseInt($('invDelta').value, 10);
    const reason = ($('invReason')?.value || '').trim();
    if (!productId) return showError('Məhsul seçin');
    if (!delta) return showError('Say daxil edin');
    try {
      await API.post('/inventory/adjust', { product_id: productId, delta, reason });
      $('invDelta').value = '';
      if ($('invReason')) $('invReason').value = '';
      await render();
    } catch (err) { showError(err.message); }
  }

  async function rebuild() {
    if (!confirm('Anbar stokunu yenidən hesablamaq istəyirsiniz?')) return;
    try {
      await API.post('/inventory/rebuild');
      await render();
    } catch (err) { showError(err.message); }
  }

  return { render, adjust, rebuild };
})();
