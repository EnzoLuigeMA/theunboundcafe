// Meta Conversions API (CAPI) — server-side endpoint.
//
// Receives events from the browser (see /meta-capi.js) and forwards them to
// Meta's Graph API. The access token is read from the META_CAPI_TOKEN
// environment variable (configured in the Vercel dashboard) and is NEVER
// exposed to the client. Events are deduplicated against the browser Pixel
// through a shared event_id.
//
// Environment variables (set in Vercel → Project → Settings → Environment Variables):
//   META_CAPI_TOKEN     REQUIRED — the Conversions API access token (secret)
//   META_PIXEL_ID       optional — defaults to the public Pixel ID below
//   META_TEST_EVENT_CODE  optional — only while testing in Events Manager

const crypto = require('crypto');

// The Pixel ID is public (it also appears in the client-side Pixel), so it is
// safe to default it here. Only the access token is a secret.
const PIXEL_ID = process.env.META_PIXEL_ID || '1014649747721914';
const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE;
const API_VERSION = 'v21.0';

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(String(value).trim().toLowerCase())
    .digest('hex');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ACCESS_TOKEN) {
    // Token not configured — never leak which value is missing.
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const {
      event_name = 'PageView',
      event_id,
      event_source_url,
      fbp,
      fbc,
      email,
      phone,
    } = body;

    // Client IP and user agent are taken from the request, not the payload.
    const clientIp =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      (req.socket && req.socket.remoteAddress) ||
      undefined;
    const userAgent = req.headers['user-agent'];

    const user_data = {};
    if (clientIp) user_data.client_ip_address = clientIp;
    if (userAgent) user_data.client_user_agent = userAgent;
    if (fbp) user_data.fbp = fbp;
    if (fbc) user_data.fbc = fbc;
    if (email) user_data.em = [sha256(email)];
    if (phone) user_data.ph = [sha256(String(phone).replace(/\D/g, ''))];

    const payload = {
      data: [
        {
          event_name,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          event_source_url,
          event_id,
          user_data,
        },
      ],
    };
    if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;

    const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    const fbRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await fbRes.json();

    if (!fbRes.ok) {
      return res.status(502).json({ error: 'Meta API error', details: result });
    }
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
};
