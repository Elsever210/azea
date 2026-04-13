/**
 * Contacts — admin contact & address management
 */
const Contacts = (() => {
  const FIELDS = [
    'ctHqAddress', 'ctHqPhone', 'ctHqEmail',
    'ctCnAddress', 'ctCnPhone', 'ctCnContact',
    'ctAzAddress', 'ctAzPhone', 'ctAzContact',
    'ctWebsite', 'ctWhatsapp', 'ctTelegram', 'ctInstagram'
  ];

  async function render() {
    try {
      const settings = await API.get('/settings');
      for (const f of FIELDS) {
        const el = $(f);
        if (el) el.value = settings[f] || '';
      }
    } catch (err) {
      console.error('Contacts render:', err);
    }
  }

  async function save() {
    const data = {};
    for (const f of FIELDS) {
      const el = $(f);
      if (el) data[f] = el.value.trim();
    }
    try {
      await API.put('/settings', data);
      showToast('Əlaqə məlumatları saxlanıldı', 'success');
    } catch (err) { showError(err.message); }
  }

  return { render, save };
})();
