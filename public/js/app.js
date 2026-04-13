/**
 * App — main orchestrator (role-based panels)
 */
const App = (() => {
  let currentUser = null;
  let currentView = 'dashboard';
  let _refreshId = 0;

  async function init() {
    const token = API.getToken();
    if (token) {
      try {
        const res = await API.get('/auth/me');
        currentUser = res.user;
        showApp();
      } catch {
        API.setToken('');
        showLogin();
      }
    } else {
      showLogin();
    }
    bindEvents();
    await I18n.load(I18n.getLocale());
  }

  function bindEvents() {
    $('btnLogin').addEventListener('click', login);
    $('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    $('btnLogout').addEventListener('click', logout);

    // Mobile hamburger menu toggle (opens overlay sheet)
    $('btnMenuToggle')?.addEventListener('click', () => {
      const nav = $('nav');
      const overlay = $('navOverlay');
      nav.classList.toggle('nav-open');
      overlay?.classList.toggle('active', nav.classList.contains('nav-open'));
    });

    // Nav overlay backdrop — close on tap
    $('navOverlay')?.addEventListener('click', () => {
      $('nav').classList.remove('nav-open');
      $('navOverlay')?.classList.remove('active');
    });

    $('nav').addEventListener('click', e => {
      const btn = e.target.closest('.navbtn');
      if (!btn) return;
      $('nav').classList.remove('nav-open');
      $('navOverlay')?.classList.remove('active');
      setView(btn.dataset.view);
    });

    // Bottom tab bar
    $('bottomTabs')?.addEventListener('click', e => {
      const tab = e.target.closest('.tab-item');
      if (!tab) return;
      if (tab.id === 'tabMore') {
        $('nav').classList.add('nav-open');
        $('navOverlay')?.classList.add('active');
        return;
      }
      const view = tab.dataset.view;
      if (view) {
        const role = currentUser?.role;
        if (role === 'customer' && tab.dataset.alt) {
          setView(tab.dataset.alt);
        } else {
          setView(view);
        }
      }
    });

    $('langSelect').addEventListener('change', e => I18n.load(e.target.value));

    // Products
    $('btnAddProduct')?.addEventListener('click', () => Products.clear());
    $('btnSaveProduct')?.addEventListener('click', () => Products.save());
    $('btnClearProduct')?.addEventListener('click', () => Products.clear());
    $('prodSearch')?.addEventListener('input', debounce(() => Products.render()));

    // Orders
    $('btnAddOrder')?.addEventListener('click', () => Orders.clear());
    $('btnSaveOrder')?.addEventListener('click', () => Orders.save());
    $('btnClearOrder')?.addEventListener('click', () => Orders.clear());
    $('btnAddItem')?.addEventListener('click', () => Orders.addItem());
    $('orderSearch')?.addEventListener('input', debounce(() => Orders.render()));

    // Customer my-orders
    $('myOrderSearch')?.addEventListener('input', debounce(() => MyOrders.render()));

    // Shipments
    $('btnAddShipment')?.addEventListener('click', () => Shipments.clear());
    $('btnSaveShipment')?.addEventListener('click', () => Shipments.save());
    $('btnClearShipment')?.addEventListener('click', () => Shipments.clear());
    $('shipSearch')?.addEventListener('input', debounce(() => Shipments.render()));

    // Tracking
    $('btnTrackNow')?.addEventListener('click', () => Tracking.trackNow());
    $('btnAddEvent')?.addEventListener('click', () => Tracking.addEvent());
    $('tShipment')?.addEventListener('change', () => Tracking.renderTimeline());

    // Reports
    $('rFile')?.addEventListener('change', e => Reports.upload(e.target));
    $('rSearch')?.addEventListener('input', debounce(() => Reports.render()));
    $('rLinkType')?.addEventListener('change', () => Reports.rebuildLinkPicker());

    // Inventory
    $('btnAdjustInv')?.addEventListener('click', () => Inventory.adjust());
    $('btnRebuildInventory')?.addEventListener('click', () => Inventory.rebuild());
    $('invSearch')?.addEventListener('input', debounce(() => Inventory.render()));

    // Finance
    $('btnRecalcFinance')?.addEventListener('click', () => Finance.render());

    // Notifications
    $('btnNewNotif')?.addEventListener('click', () => { $('notifForm')?.classList.toggle('hidden'); });
    $('btnSendNotif')?.addEventListener('click', () => Notifications.send());

    // Users
    $('btnAddUser')?.addEventListener('click', () => { $('userForm')?.classList.toggle('hidden'); });
    $('btnSaveUser')?.addEventListener('click', () => Users.save());

    // Contacts
    $('btnSaveContacts')?.addEventListener('click', () => Contacts.save());

    // Calculator
    $('btnCalcCompute')?.addEventListener('click', () => Calculator.compute());
    $('btnCalcReset')?.addEventListener('click', () => Calculator.reset());

    // Calc Params (admin)
    $('btnSaveCalcParams')?.addEventListener('click', () => Calculator.saveParams());

    // Logs
    $('logSearch')?.addEventListener('input', debounce(() => Logs.resetPage()));
    $('logFilterAction')?.addEventListener('change', () => Logs.resetPage());
    $('logFilterEntity')?.addEventListener('change', () => Logs.resetPage());
    $('logFilterUser')?.addEventListener('change', () => Logs.resetPage());
    $('logPrev')?.addEventListener('click', () => Logs.prevPage());
    $('logNext')?.addEventListener('click', () => Logs.nextPage());

    // Settings
    $('btnSaveSettings')?.addEventListener('click', () => Settings.save());
    $('btnChangePass')?.addEventListener('click', () => Settings.changePassword());
    $('btnExportDB')?.addEventListener('click', () => {
      const token = API.getToken();
      const href = window.AppConfig?.toApiUrl
        ? window.AppConfig.toApiUrl('/settings/export')
        : '/api/settings/export';
      window.open(href + '?token=' + encodeURIComponent(token), '_blank');
    });

    // PWA
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault(); deferredPrompt = e; $('btnInstall').style.display = '';
    });
    $('btnInstall')?.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt(); await deferredPrompt.userChoice;
      deferredPrompt = null; $('btnInstall').style.display = 'none';
    });

    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
      window.addEventListener('load', () => {
        const swPath = window.AppConfig?.toAssetUrl ? window.AppConfig.toAssetUrl('sw.js') : 'sw.js';
        navigator.serviceWorker.register(swPath).catch(() => {});
      });
    }
  }

  async function login() {
    const username = $('loginUser').value.trim();
    const password = $('loginPass').value;
    if (!username || !password) return;
    try {
      $('loginError').classList.add('hidden');
      const res = await API.post('/auth/login', { username, password });
      API.setToken(res.token);
      currentUser = res.user;
      showApp();
    } catch (err) {
      $('loginError').textContent = err.message;
      $('loginError').classList.remove('hidden');
    }
  }

  function logout() { API.setToken(''); currentUser = null; showLogin(); }

  function showLogin() {
    $('loginView').classList.remove('hidden');
    $('appView').classList.add('hidden');
    $('loginUser').value = ''; $('loginPass').value = '';
    $('loginError').classList.add('hidden');
  }

  async function showApp() {
    $('loginView').classList.add('hidden');
    $('appView').classList.remove('hidden');

    $('userBadge').textContent = currentUser.full_name || currentUser.username;
    const rb = $('roleBadge');
    rb.textContent = { admin: 'Admin', operator: 'Operator', customer: 'Müştəri' }[currentUser.role] || currentUser.role;
    rb.className = 'pill role-pill role-' + currentUser.role;

    const role = currentUser.role;
    document.querySelectorAll('.admin-only').forEach(el => { el.style.display = role === 'admin' ? '' : 'none'; });
    document.querySelectorAll('.ops-only').forEach(el => { el.style.display = (role === 'admin' || role === 'operator') ? '' : 'none'; });
    document.querySelectorAll('.customer-view').forEach(el => { el.style.display = role === 'customer' ? '' : 'none'; });

    // Configure bottom tabs for role
    const btOrders = document.querySelector('.tab-item.tab-orders');
    if (btOrders) {
      if (role === 'customer') {
        btOrders.dataset.view = 'myorders';
        const u = btOrders.querySelector('svg use');
        if (u) u.setAttribute('href', '#i-clipboard');
      } else {
        btOrders.dataset.view = 'orders';
        const u = btOrders.querySelector('svg use');
        if (u) u.setAttribute('href', '#i-cart');
      }
    }

    if (role === 'customer') {
      $('dashAdmin')?.classList.add('hidden');
      $('dashCustomer')?.classList.remove('hidden');
    } else {
      $('dashAdmin')?.classList.remove('hidden');
      $('dashCustomer')?.classList.add('hidden');
    }
    await refreshView();
  }

  function setView(view) {
    currentView = view;
    document.querySelectorAll('section[id^="view-"]').forEach(s => s.classList.add('hidden'));
    $('view-' + view)?.classList.remove('hidden');
    document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.view === view));

    // Sync bottom tabs
    document.querySelectorAll('#bottomTabs .tab-item').forEach(t => {
      if (t.id === 'tabMore') return;
      const v = t.dataset.view;
      const alt = t.dataset.alt;
      t.classList.toggle('active', v === view || alt === view);
    });

    // Close nav overlay if open
    $('nav')?.classList.remove('nav-open');
    $('navOverlay')?.classList.remove('active');

    refreshView();
  }

  async function refreshView() {
    const rid = ++_refreshId;
    try {
      const role = currentUser?.role;
      if (role !== 'customer') await Products.render();

      if (rid !== _refreshId) return; // stale view switch — abort
      switch (currentView) {
        case 'dashboard': await Dashboard.render(role); break;
        case 'myorders': await MyOrders.render(); break;
        case 'myshipments': await MyShipments.render(); break;
        case 'calculator': await Calculator.render(); break;
        case 'products': if (role !== 'customer') await Products.render(); break;
        case 'orders': await Orders.render(); break;
        case 'shipments': await Shipments.render(); break;
        case 'tracking': await Tracking.render(); break;
        case 'reports': await Reports.render(); break;
        case 'inventory': await Inventory.render(); break;
        case 'finance': await Finance.render(); break;
        case 'notifications': await Notifications.render(); break;
        case 'users': if (role === 'admin') await Users.render(); break;
        case 'contacts': if (role === 'admin') await Contacts.render(); break;
        case 'calcparams': if (role === 'admin') await Calculator.renderParams(); break;
        case 'logs': if (role === 'admin') await Logs.render(); break;
        case 'settings': await Settings.render(); break;
      }
    } catch (err) { console.error('Refresh error:', err); }
  }

  function getUser() { return currentUser; }
  return { init, setView, refreshView, showLogin, getUser };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
