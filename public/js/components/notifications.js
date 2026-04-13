/**
 * Notifications component
 */
const Notifications = (() => {
  async function render() {
    try {
      const notifications = await API.get('/notifications');
      const rows = notifications.map(n => {
        const statusClass = n.status === 'sent' ? 'green' : n.status === 'failed' ? 'red' : 'yellow';
        return `<tr>
          <td>${escapeHTML(n.type)}</td>
          <td class="mono">${escapeHTML(n.recipient)}</td>
          <td>${escapeHTML(n.subject || '')}</td>
          <td><span class="tag"><span class="dot ${statusClass}"></span>${escapeHTML(n.status)}</span></td>
          <td class="mono">${formatDateTime(n.created_at)}</td>
        </tr>`;
      }).join('');
      $('tblNotifications').innerHTML = rows || '<tr><td colspan="5" class="muted">Bildiriş yoxdur</td></tr>';
    } catch (err) {
      console.error('Notifications render:', err);
    }
  }

  async function send() {
    const data = {
      type: $('nType').value,
      recipient: $('nRecipient').value.trim(),
      subject: $('nSubject').value.trim(),
      body: $('nBody').value.trim(),
    };
    if (!data.recipient) return showError('Alıcı tələb olunur');
    if (!data.body) return showError('Mətn tələb olunur');
    try {
      await API.post('/notifications/send', data);
      $('nRecipient').value = '';
      $('nSubject').value = '';
      $('nBody').value = '';
      await render();
    } catch (err) { showError(err.message); }
  }

  return { render, send };
})();
