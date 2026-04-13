/**
 * Calculator — cargo cost calculator + admin params management
 */
const Calculator = (() => {
  const DEFAULT_PARAMS = {
    cpAirRate: '8.50', cpSeaRate: '2.50', cpExpressRate: '12.00',
    cpRailRate: '4.00', cpLastmileRate: '1.50',
    cpVolDivisor: '6000',
    cpCustomsRate: '18', cpInsuranceRate: '2.5',
    cpFuelSurcharge: '5', cpHandlingFee: '3.00',
    cpFragileCoeff: '1.30', cpDangerousCoeff: '1.60', cpOversizedCoeff: '1.40',
    cpAirDays: '5-7', cpSeaDays: '25-35', cpExpressDays: '3-5',
    cpRailDays: '15-20', cpLastmileDays: '1-3',
    cpMinCharge: '5.00'
  };

  const PARAM_FIELDS = Object.keys(DEFAULT_PARAMS);

  let params = { ...DEFAULT_PARAMS };

  async function loadParams() {
    try {
      const settings = await API.get('/settings');
      for (const k of PARAM_FIELDS) {
        if (settings[k] !== undefined && settings[k] !== '') params[k] = settings[k];
      }
    } catch {}
  }

  async function render() {
    await loadParams();
  }

  // Admin params render
  async function renderParams() {
    await loadParams();
    for (const k of PARAM_FIELDS) {
      const el = $(k);
      if (el) el.value = params[k] || DEFAULT_PARAMS[k];
    }
  }

  async function saveParams() {
    const data = {};
    for (const k of PARAM_FIELDS) {
      const el = $(k);
      if (el) data[k] = el.value.trim() || DEFAULT_PARAMS[k];
    }
    try {
      await API.put('/settings', data);
      params = { ...params, ...data };
      showToast('Kalkulyator parametrləri saxlanıldı', 'success');
    } catch (err) { showError(err.message); }
  }

  function compute() {
    const weight = parseFloat($('calcWeight')?.value) || 0;
    const length = parseFloat($('calcLength')?.value) || 0;
    const width = parseFloat($('calcWidth')?.value) || 0;
    const height = parseFloat($('calcHeight')?.value) || 0;
    const route = $('calcRoute')?.value || 'air';
    const pkgType = $('calcPackageType')?.value || 'standard';
    const declaredVal = parseFloat($('calcDeclaredValue')?.value) || 0;
    const wantInsurance = $('calcInsurance')?.value === '1';
    const qty = parseInt($('calcQty')?.value) || 1;

    if (weight <= 0) {
      showError('Çəki daxil edilməlidir');
      return;
    }

    // Volumetric weight
    const volDivisor = parseFloat(params.cpVolDivisor) || 6000;
    const volWeight = (length * width * height) / volDivisor;
    const chargeableWeight = Math.max(weight, volWeight);

    // Rate per kg by route
    const rateMap = {
      air: parseFloat(params.cpAirRate) || 8.50,
      sea: parseFloat(params.cpSeaRate) || 2.50,
      express: parseFloat(params.cpExpressRate) || 12.00,
      rail: parseFloat(params.cpRailRate) || 4.00,
      lastmile: parseFloat(params.cpLastmileRate) || 1.50,
    };
    const ratePerKg = rateMap[route] || rateMap.air;

    // Base freight cost
    let freightCost = chargeableWeight * ratePerKg;

    // Package type multiplier
    const coeffMap = {
      standard: 1.0,
      fragile: parseFloat(params.cpFragileCoeff) || 1.30,
      dangerous: parseFloat(params.cpDangerousCoeff) || 1.60,
      oversized: parseFloat(params.cpOversizedCoeff) || 1.40,
    };
    const coeff = coeffMap[pkgType] || 1.0;
    freightCost *= coeff;

    // Fuel surcharge
    const fuelPct = parseFloat(params.cpFuelSurcharge) || 0;
    const fuelCost = freightCost * (fuelPct / 100);

    // Handling fee
    const handlingFee = parseFloat(params.cpHandlingFee) || 0;

    // Customs duty
    const customsPct = parseFloat(params.cpCustomsRate) || 0;
    const customsCost = declaredVal > 0 ? declaredVal * (customsPct / 100) : 0;

    // Insurance
    const insPct = parseFloat(params.cpInsuranceRate) || 0;
    const insuranceCost = wantInsurance && declaredVal > 0 ? declaredVal * (insPct / 100) : 0;

    // Per-package subtotal
    let subtotal = freightCost + fuelCost + handlingFee + customsCost + insuranceCost;

    // Min charge
    const minCharge = parseFloat(params.cpMinCharge) || 0;
    if (subtotal < minCharge) subtotal = minCharge;

    // Total with quantity
    const total = subtotal * qty;

    // ETA
    const etaMap = {
      air: params.cpAirDays || '5-7',
      sea: params.cpSeaDays || '25-35',
      express: params.cpExpressDays || '3-5',
      rail: params.cpRailDays || '15-20',
      lastmile: params.cpLastmileDays || '1-3',
    };
    const eta = etaMap[route] || '—';

    // Route labels
    const routeLabel = {
      air: 'CN→AZ Air Freight',
      sea: 'CN→AZ Sea Freight',
      express: 'CN→AZ Express Cargo',
      rail: 'CN→AZ Rail Freight',
      lastmile: 'AZ Last-mile',
    }[route] || route;

    const pkgLabel = {
      standard: 'Standart',
      fragile: 'Həssas',
      dangerous: 'Təhlükəli',
      oversized: 'Böyük Ölçülü',
    }[pkgType] || pkgType;

    // Build result HTML
    const rows = [
      resultRow(I18n.t('calc.resRoute'), routeLabel),
      resultRow(I18n.t('calc.resActualWeight'), weight.toFixed(2) + ' kq'),
      volWeight > 0 ? resultRow(I18n.t('calc.resVolWeight'), volWeight.toFixed(2) + ' kq') : '',
      resultRow(I18n.t('calc.resChargeWeight'), '<b>' + chargeableWeight.toFixed(2) + ' kq</b>'),
      resultRow(I18n.t('calc.resRateKg'), '$' + ratePerKg.toFixed(2) + '/kq'),
      resultRow(I18n.t('calc.resPackageType'), pkgLabel + (coeff > 1 ? ' (x' + coeff.toFixed(2) + ')' : '')),
      resultRow(I18n.t('calc.resFreight'), '$' + freightCost.toFixed(2)),
      fuelCost > 0 ? resultRow(I18n.t('calc.resFuel') + ' (' + fuelPct + '%)', '$' + fuelCost.toFixed(2)) : '',
      resultRow(I18n.t('calc.resHandling'), '$' + handlingFee.toFixed(2)),
      customsCost > 0 ? resultRow(I18n.t('calc.resCustoms') + ' (' + customsPct + '%)', '$' + customsCost.toFixed(2)) : '',
      insuranceCost > 0 ? resultRow(I18n.t('calc.resInsurance') + ' (' + insPct + '%)', '$' + insuranceCost.toFixed(2)) : '',
      qty > 1 ? resultRow(I18n.t('calc.resPerPackage'), '$' + subtotal.toFixed(2)) : '',
      qty > 1 ? resultRow(I18n.t('calc.resQuantity'), 'x' + qty) : '',
    ].filter(Boolean).join('');

    $('calcResultRows').innerHTML = rows;
    $('calcTotalValue').textContent = '$' + total.toFixed(2);
    $('calcEstDays').textContent = eta + ' ' + I18n.t('calc.days');
    $('calcTotalBox')?.classList.remove('hidden');
  }

  function resultRow(label, value) {
    return `<div class="calc-row"><span class="calc-row-label">${label}</span><span class="calc-row-value mono">${value}</span></div>`;
  }

  function reset() {
    ['calcWeight', 'calcLength', 'calcWidth', 'calcHeight', 'calcDeclaredValue'].forEach(id => {
      const el = $(id);
      if (el) el.value = '';
    });
    $('calcRoute').value = 'air';
    $('calcPackageType').value = 'standard';
    $('calcInsurance').value = '0';
    $('calcQty').value = '1';
    $('calcResultRows').innerHTML = '<div class="calc-empty" data-i18n="calc.enterData">Məlumatları daxil edib "Hesabla" düyməsinə basın</div>';
    $('calcTotalBox')?.classList.add('hidden');
    I18n.translatePage();
  }

  return { render, renderParams, saveParams, compute, reset };
})();
