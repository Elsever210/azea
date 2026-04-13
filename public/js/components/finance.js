/**
 * Finance component
 */
const Finance = (() => {
  async function render() {
    const period = $('fPeriod').value || 'ALL';
    try {
      const data = await API.get(`/finance?period=${period}`);
      $('fRevenue').textContent = money(data.revenue);
      $('fCosts').textContent = money(data.costs);
      $('fProfit').textContent = money(data.profit);
    } catch (err) {
      console.error('Finance render:', err);
    }
  }

  return { render };
})();
