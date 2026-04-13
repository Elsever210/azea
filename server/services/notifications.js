const config = require('../config');

/**
 * Notification service — SMS via Twilio, Email via SendGrid
 */

async function sendSMS(to, body) {
  const { sid, token, from } = config.twilio;
  if (!sid || !token || !from) {
    throw new Error('Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.');
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });

  const data = await res.json();
  if (data.error_code) throw new Error(`Twilio error: ${data.message}`);
  return data;
}

async function sendEmail(to, subject, body) {
  const { apiKey, from } = config.sendgrid;
  if (!apiKey || !from) {
    throw new Error('SendGrid not configured. Set SENDGRID_API_KEY, SENDGRID_FROM_EMAIL.');
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }], subject }],
      from: { email: from },
      content: [{ type: 'text/plain', value: body }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SendGrid error: ${res.status} ${text}`);
  }
  return { status: 'sent' };
}

async function send({ type, recipient, subject, body }) {
  if (type === 'sms') return sendSMS(recipient, body);
  if (type === 'email') return sendEmail(recipient, subject, body);
  throw new Error(`Unknown notification type: ${type}`);
}

module.exports = { send, sendSMS, sendEmail };
