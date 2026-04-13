/**
 * Tracking component
 */
const Tracking = (() => {
  async function render() {
    try {
      // Rebuild shipment picker
      const shipments = Shipments.getAll();
      const opts = shipments.map(s => {
        const label = `${s.shipment_no}${s.awb ? ' • ' + s.awb : ''}`;
        return `<option value="${s.id}">${escapeHTML(label)}</option>`;
      }).join('');
      $('tShipment').innerHTML = opts || '<option value="">Göndəriş yoxdur</option>';

      await renderTimeline();
      await renderLiveFeed();
    } catch (err) {
      console.error('Tracking render:', err);
    }
  }

  async function renderTimeline() {
    const shipmentId = $('tShipment').value;
    if (!shipmentId) {
      $('tTimeline').textContent = 'Göndəriş seçin...';
      return;
    }
    try {
      const data = await API.get(`/tracking/${shipmentId}`);
      const lines = (data.events || []).map(e =>
        `${formatDateTime(e.occurred_at)} • [${e.source}] ${e.event}${e.location ? ' @ ' + e.location : ''}`
      );
      $('tTimeline').textContent = lines.length ? lines.join('\n') : 'Hələ hadisə yoxdur.';
    } catch (err) {
      $('tTimeline').textContent = 'Xəta: ' + err.message;
    }
  }

  async function renderLiveFeed() {
    try {
      const events = await API.get('/tracking?limit=50');
      const lines = events.map(e =>
        `${formatDateTime(e.occurred_at)} • ${e.shipment_no} • [${e.source}] ${e.event}${e.location ? ' @ ' + e.location : ''}`
      );
      $('tLiveLog').textContent = lines.length ? lines.join('\n') : 'Hələ hadisə yoxdur.';
    } catch {}
  }

  async function trackNow() {
    const shipmentId = $('tShipment').value;
    if (!shipmentId) return showError('Göndəriş seçin');
    const provider = $('tProvider').value;
    try {
      await API.post(`/tracking/${shipmentId}/track`, { provider });
      await render();
    } catch (err) { showError(err.message); }
  }

  async function addEvent() {
    const shipmentId = $('tShipment').value;
    if (!shipmentId) return showError('Göndəriş seçin');
    const event = $('tEvent').value.trim();
    if (!event) return showError('Hadisə daxil edin');
    const location = $('tLoc').value.trim();
    try {
      await API.post(`/tracking/${shipmentId}/event`, { event, location });
      $('tEvent').value = '';
      $('tLoc').value = '';
      await render();
    } catch (err) { showError(err.message); }
  }

  return { render, trackNow, addEvent, renderTimeline };
})();
