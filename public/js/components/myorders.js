/**
 * MyOrders — customer's own orders view
 */
const MyOrders = (() => {
  let allOrders = [];

  async function render() {
    try {
      const res = await API.get('/orders?limit=200');
      allOrders = res.data || [];
      draw();
    } catch (err) {
      console.error('MyOrders error:', err);
    }
  }

  function draw() {
    const q = ($('myOrderSearch')?.value || '').toLowerCase();
    const filtered = allOrders.filter(o =>
      !q || o.order_no.toLowerCase().includes(q) || (o.customer_name || '').toLowerCase().includes(q) || o.status.toLowerCase().includes(q)
    );
    const rows = filtered.map(o => `<tr>
      <td class="mono">${escapeHTML(o.order_no)}</td>
      <td>${statusTag(o.status)}</td>
      <td class="mono">${o.item_count || 0}</td>
      <td class="mono">${money(o.total || 0)}</td>
      <td class="muted">${formatDate(o.created_at)}</td>
    </tr>`).join('');
    $('tblMyOrders').innerHTML = rows || '<tr><td colspan="5" class="muted">Sifariş tapılmadı</td></tr>';
  }

  return { render };
})();
