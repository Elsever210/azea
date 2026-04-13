/**
 * i18n — internationalization
 */
const I18n = (() => {
  const SUPPORTED = ['az', 'en', 'tr', 'ru', 'cn'];
  let locale = localStorage.getItem('lang') || 'az';
  let data = {};

  async function load(code) {
    if (!SUPPORTED.includes(code)) code = 'az';
    try {
      const langPath = window.AppConfig?.toAssetUrl ? window.AppConfig.toAssetUrl(`lang/${code}.json`) : `lang/${code}.json`;
      const res = await fetch(langPath);
      if (!res.ok) throw new Error('Not found');
      data = await res.json();
      locale = code;
      localStorage.setItem('lang', code);
      document.documentElement.lang = code;
      translatePage();
    } catch (e) {
      console.warn('Locale load failed:', e);
      data = {};
    }
  }

  function t(key, vars = {}) {
    let text = data[key] || key;
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
    return text;
  }

  function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (key) el.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.dataset.i18nTitle;
      if (key) el.title = t(key);
    });
  }

  function getLocale() { return locale; }

  return { load, t, translatePage, getLocale };
})();
