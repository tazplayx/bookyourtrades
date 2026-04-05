// Vercel Serverless Function — Stripe Payment Intent
// Deploy this with your STRIPE_SECRET_KEY set in Vercel Environment Variables:
//   Dashboard → Project → Settings → Environment Variables → STRIPE_SECRET_KEY

module.exports = async function handler(req, res) {
  // CORS headers so the SPA can call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'Stripe secret key not configured. Set STRIPE_SECRET_KEY in Vercel environment variables.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }

  const amount      = body.amount      || 299;   // cents — $2.99 CAD
  const currency    = body.currency    || 'cad';
  const description = body.description || 'BookYourTrades Lead Connection Fee';
  const bookingId   = body.bookingId   || '';

  try {
    const params = new URLSearchParams({
      amount:      String(amount),
      currency,
      description,
      'metadata[bookingId]': bookingId,
      'automatic_payment_methods[enabled]': 'true',
    });

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + secretKey,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: data.error?.message || 'Stripe error' });
    }

    return res.status(200).json({ clientSecret: data.client_secret });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
