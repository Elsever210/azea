/**
 * Products component
 */
const Products = (() => {
  let editingId = null;
  let allProducts = [];

  async function render() {
    const q = ($('prodSearch')?.value || '').trim();
    try {
      allProducts = await API.get(`/products${q ? '?q=' + encodeURIComponent(q) : ''}`);
      const rows = allProducts.map(p => {
        const frag = p.fragile
          ? '<span class="tag"><span class="dot red"></span>Bəli</span>'
          : '<span class="tag"><span class="dot green"></span>Xeyr</span>';
        return `<tr>
          <td class="mono">${escapeHTML(p.sku)}</td>
          <td>${escapeHTML(p.name)}</td>
          <td class="mono">${escapeHTML(p.hs_code || '')}</td>
          <td class="mono">${money(p.unit_cost)}</td>
          <td class="mono">${money(p.unit_sell)}</td>
          <td>${frag}</td>
          <td>
            <button class="btn ghost small" onclick="Products.edit(${p.id})">Redaktə</button>
            <button class="btn ghost small" onclick="Products.remove(${p.id})">Sil</button>
          </td>
        </tr>`;
      }).join('');
      $('tblProducts').innerHTML = rows || '<tr><td colspan="7" class="muted">Məhsul yoxdur</td></tr>';
    } catch (err) {
      console.error('Products render:', err);
    }
  }

  function clear() {
    editingId = null;
    ['pSKU', 'pName', 'pHS', 'pCost', 'pSell', 'pNotes'].forEach(id => $(id).value = '');
    $('pFragile').value = '0';
  }

  async function save() {
    const data = {
      sku: $('pSKU').value.trim().toUpperCase(),
      name: $('pName').value.trim(),
      hs_code: $('pHS').value.trim(),
      fragile: parseInt($('pFragile').value, 10),
      unit_cost: parseFloat($('pCost').value) || 0,
      unit_sell: parseFloat($('pSell').value) || 0,
      notes: $('pNotes').value.trim(),
    };
    if (!data.sku || !data.name) return showError('SKU və ad tələb olunur');
    try {
      if (editingId) await API.put(`/products/${editingId}`, data);
      else await API.post('/products', data);
      clear();
      await App.refreshView();
    } catch (err) { showError(err.message); }
  }

  function edit(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    editingId = p.id;
    $('pSKU').value = p.sku;
    $('pName').value = p.name;
    $('pHS').value = p.hs_code || '';
    $('pFragile').value = p.fragile ? '1' : '0';
    $('pCost').value = p.unit_cost;
    $('pSell').value = p.unit_sell;
    $('pNotes').value = p.notes || '';
  }

  async function remove(id) {
    if (!confirm('Bu məhsulu silmək istəyirsiniz?')) return;
    try {
      await API.del(`/products/${id}`);
      await App.refreshView();
    } catch (err) { showError(err.message); }
  }

  function getAll() { return allProducts; }

  return { render, clear, save, edit, remove, getAll };
})();
