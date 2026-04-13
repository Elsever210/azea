/**
 * Dashboard component — role-based
 */
const Dashboard = (() => {
  async function render(role) {
    try {
      if (role === 'customer') {
        await renderCustomer();
      } else {
        await renderAdmin();
      }
    } catch (err) {
      console.error('Dashboard error:', err);
    }
  }

  async function renderAdmin() {
    const [finance, orders, tracking] = await Promise.all([
      API.get('/finance?period=ALL'),
      API.get('/orders?limit=10'),
      API.get('/tracking?limit=30'),
    ]);

    const openOrders = (orders.data || []).filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status)).length;
    $('kpiOpenOrders').textContent = openOrders;

    let transit = 0;
    try {
      const shipments = await API.get('/shipments');
      transit = shipments.filter(s => ['IN_TRANSIT', 'CUSTOMS', 'AT_CN_WAREHOUSE'].includes(s.status)).length;
    } catch {}
    $('kpiTransit').textContent = transit;

    let invTotal = 0;
    try {
      const inventory = await API.get('/inventory');
      invTotal = inventory.reduce((a, i) => a + (i.on_hand || 0), 0);
    } catch {}
    $('kpiInventory').textContent = invTotal;

    $('kpiProfit').textContent = money(finance.profit);

    const orderRows = (orders.data || []).slice(0, 10).map(o => `<tr>
      <td class="mono">${escapeHTML(o.order_no)}</td>
      <td>${escapeHTML(o.customer_name)}</td>
      <td>${statusTag(o.status)}</td>
      <td class="mono">${money(o.total || 0)}</td>
    </tr>`).join('');
    $('dashOrders').innerHTML = orderRows || '<tr><td colspan="4" class="muted">Hələ sifariş yoxdur</td></tr>';

    const logLines = (tracking || []).slice(0, 30).map(e =>
      `${formatDateTime(e.occurred_at)} • ${e.shipment_no} • [${e.source}] ${e.event}${e.location ? ' @ ' + e.location : ''}`
    );
    $('dashTrackLog').textContent = logLines.length ? logLines.join('\n') : 'Hələ hadisə yoxdur.';
  }

  async function renderCustomer() {
    const [orders, shipments] = await Promise.all([
      API.get('/orders?limit=200').catch(() => ({ data: [] })),
      API.get('/shipments').catch(() => []),
    ]);

    const myOrders = orders.data || [];
    const delivered = myOrders.filter(o => o.status === 'DELIVERED').length;
    const inProgress = myOrders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status)).length;

    $('kpiMyOrders').textContent = myOrders.length;
    $('kpiMyShipments').textContent = (shipments || []).length;
    $('kpiMyDelivered').textContent = delivered;
    $('kpiMyProgress').textContent = inProgress;

    const rows = myOrders.slice(0, 10).map(o => `<tr>
      <td class="mono">${escapeHTML(o.order_no)}</td>
      <td>${statusTag(o.status)}</td>
      <td class="mono">${money(o.total || 0)}</td>
      <td class="muted">${formatDate(o.created_at)}</td>
    </tr>`).join('');
    $('dashMyOrders').innerHTML = rows || '<tr><td colspan="4" class="muted">Sifariş tapılmadı</td></tr>';
  }

  return { render };
})();
