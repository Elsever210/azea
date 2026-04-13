/**
 * MyShipments — customer's own shipments view
 */
const MyShipments = (() => {
  async function render() {
    try {
      const shipments = await API.get('/shipments');
      const rows = (shipments || []).map(s => `<tr>
        <td class="mono">${escapeHTML(s.shipment_no)}</td>
        <td>${escapeHTML(s.route || '—')}</td>
        <td>${shipmentTag(s.status)}</td>
        <td class="muted">${s.eta || '—'}</td>
        <td class="mono">${escapeHTML(s.awb || '—')}</td>
      </tr>`).join('');
      $('tblMyShipments').innerHTML = rows || '<tr><td colspan="5" class="muted">Göndəriş tapılmadı</td></tr>';
    } catch (err) {
      console.error('MyShipments error:', err);
    }
  }

  return { render };
})();
