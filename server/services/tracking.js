const config = require('../config');

/**
 * Tracking service — adapter pattern for multiple carriers
 * Each provider returns: [{ event, location, source, occurred_at }]
 */

const providers = {
  // Demo provider — simulates realistic tracking events
  demo: async (shipment) => {
    const now = new Date().toISOString();
    const steps = [
      { event: 'Shipment created', location: 'Origin' },
      { event: 'Arrived at China warehouse', location: 'Guangzhou' },
      { event: 'Departed origin', location: 'Guangzhou' },
      { event: 'Arrived at transit hub', location: 'Transit' },
      { event: 'Customs clearance started', location: 'Baku' },
      { event: 'Arrived at AZ warehouse', location: 'Baku' },
      { event: 'Out for delivery', location: 'Baku' },
      { event: 'Delivered', location: 'Baku' },
    ];
    // Pick next step based on status
    const statusMap = {
      'CREATED': 0, 'AT_CN_WAREHOUSE': 1, 'IN_TRANSIT': 2,
      'CUSTOMS': 4, 'AT_AZ_WAREHOUSE': 5, 'DELIVERED': 7,
    };
    const idx = Math.min(statusMap[shipment.status] || 0, steps.length - 1);
    const step = steps[idx];
    return [{ event: step.event, location: step.location, source: 'demo', occurred_at: now }];
  },

  // FedEx adapter
  fedex: async (shipment) => {
    if (!config.tracking.fedex.apiKey) {
      throw new Error('FedEx API key not configured');
    }
    const trackingNumber = shipment.awb;
    if (!trackingNumber) throw new Error('No tracking number (AWB) on shipment');

    // FedEx Track API v1
    const tokenRes = await fetch('https://apis.fedex.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.tracking.fedex.apiKey,
        client_secret: config.tracking.fedex.secret,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('FedEx auth failed');

    const trackRes = await fetch('https://apis.fedex.com/track/v1/trackingnumbers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify({
        trackingInfo: [{ trackingNumberInfo: { trackingNumber } }],
        includeDetailedScans: true,
      }),
    });
    const trackData = await trackRes.json();

    const results = trackData?.output?.completeTrackResults?.[0]?.trackResults?.[0];
    if (!results?.scanEvents) return [];

    return results.scanEvents.map(ev => ({
      event: ev.eventDescription || ev.eventType,
      location: [ev.scanLocation?.city, ev.scanLocation?.countryCode].filter(Boolean).join(', '),
      source: 'fedex',
      occurred_at: ev.date || new Date().toISOString(),
    }));
  },

  // UPS adapter
  ups: async (shipment) => {
    if (!config.tracking.ups.clientId) {
      throw new Error('UPS API credentials not configured');
    }
    const trackingNumber = shipment.awb;
    if (!trackingNumber) throw new Error('No tracking number (AWB) on shipment');

    const tokenRes = await fetch('https://onlinetools.ups.com/security/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.tracking.ups.clientId}:${config.tracking.ups.secret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('UPS auth failed');

    const trackRes = await fetch(`https://onlinetools.ups.com/api/track/v1/details/${trackingNumber}`, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'transId': Date.now().toString() },
    });
    const trackData = await trackRes.json();

    const activities = trackData?.trackResponse?.shipment?.[0]?.package?.[0]?.activity || [];
    return activities.map(a => ({
      event: a.status?.description || a.status?.type,
      location: [a.location?.address?.city, a.location?.address?.country].filter(Boolean).join(', '),
      source: 'ups',
      occurred_at: `${a.date?.slice(0,4)}-${a.date?.slice(4,6)}-${a.date?.slice(6,8)}T${a.time?.slice(0,2)}:${a.time?.slice(2,4)}:00`,
    }));
  },

  // DHL adapter
  dhl: async (shipment) => {
    if (!config.tracking.dhl.apiKey) {
      throw new Error('DHL API key not configured');
    }
    const trackingNumber = shipment.awb;
    if (!trackingNumber) throw new Error('No tracking number (AWB) on shipment');

    const trackRes = await fetch(`https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(trackingNumber)}`, {
      headers: { 'DHL-API-Key': config.tracking.dhl.apiKey },
    });
    const trackData = await trackRes.json();

    const events = trackData?.shipments?.[0]?.events || [];
    return events.map(ev => ({
      event: ev.description || ev.statusCode,
      location: [ev.location?.address?.addressLocality, ev.location?.address?.countryCode].filter(Boolean).join(', '),
      source: 'dhl',
      occurred_at: ev.timestamp || new Date().toISOString(),
    }));
  },
};

async function track(providerName, shipment) {
  const provider = providers[providerName];
  if (!provider) throw new Error(`Unknown tracking provider: ${providerName}`);
  return provider(shipment);
}

module.exports = { track, providers };
