/**
 * Settings component
 */
const Settings = (() => {
  async function render() {
    try {
      const settings = await API.get('/settings');
      $('setCompany').value = settings.company || '';
      $('setCnWh').value = settings.cn_warehouse || '';
      $('setAzWh').value = settings.az_warehouse || '';
      $('setCurrency').value = settings.currency || 'USD';
      $('setLanguage').value = settings.language || 'az';
    } catch (err) {
      console.error('Settings render:', err);
    }
  }

  async function save() {
    const data = {
      company: $('setCompany').value.trim(),
      cn_warehouse: $('setCnWh').value.trim(),
      az_warehouse: $('setAzWh').value.trim(),
      currency: $('setCurrency').value.trim().toUpperCase() || 'USD',
      language: $('setLanguage').value,
    };
    try {
      await API.put('/settings', data);
      if (data.language !== I18n.getLocale()) {
        await I18n.load(data.language);
      }
      showToast('Ayarlar saxlanıldı', 'success');
    } catch (err) { showError(err.message); }
  }

  async function changePassword() {
    const current = prompt('Cari şifrə:');
    if (!current) return;
    const newPass = prompt('Yeni şifrə (min 6 simvol):');
    if (!newPass || newPass.length < 6) return showError('Şifrə ən azı 6 simvol olmalıdır');
    try {
      await API.post('/auth/change-password', { current_password: current, new_password: newPass });
      showToast('Şifrə dəyişdirildi', 'success');
    } catch (err) { showError(err.message); }
  }

  return { render, save, changePassword };
})();
