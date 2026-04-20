/**
 * Vercel serverless function — creates a Stripe Checkout Session
 * for BookYourTrades Pro ($49 CAD/mo) or Enterprise ($149 CAD/mo) subscriptions.
 *
 * Environment variables (set in Vercel Dashboard → Settings → Environment Variables):
 *   STRIPE_SECRET_KEY     — sk_test_... (sandbox) or sk_live_... (production)
 *   STRIPE_PRO_PRICE_ID   — price_1TOJTf6rH0SW1eMM0kGDMckK  (sandbox default)
 *   STRIPE_ENT_PRICE_ID   — price_1TOJU26rH0SW1eMMpEXlsuWm  (sandbox default)
 *
 * Sandbox Price IDs are hard-coded as fallbacks so the feature works immediately
 * in test mode without needing to set the env vars manually.
 */

const LIVE_PRO_PRICE_ID = 'price_1TOJqu5yTZtUoaYXJxQCWu3C';  // $49 CAD/month  (live)
const LIVE_ENT_PRICE_ID = 'price_1TOJrr5yTZtUoaYXJA8JAqbE';  // $149 CAD/month (live)

module.exports = async function handler(req, res) {
  /* CORS */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({
      error: 'Stripe secret key not configured. Add STRIPE_SECRET_KEY to your Vercel environment variables.'
    });
  }

  const { plan, email, successUrl, cancelUrl } = req.body || {};

  /* Use env var if set, otherwise fall back to live Price IDs */
  const priceId = plan === 'pro'
    ? (process.env.STRIPE_PRO_PRICE_ID || LIVE_PRO_PRICE_ID)
    : (process.env.STRIPE_ENT_PRICE_ID || LIVE_ENT_PRICE_ID);

  try {
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: successUrl || 'https://bookyourtrades.com/dashboard?subscribed=1',
      cancel_url:  cancelUrl  || 'https://bookyourtrades.com/pricing',
      'payment_method_types[0]': 'card',
      'subscription_data[trial_period_days]': '14',
      'allow_promotion_codes': 'true',
      'billing_address_collection': 'auto',
    });

    if (email) params.append('customer_email', email);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (session.error) {
      return res.status(400).json({ error: session.error.message });
    }

    return res.status(200).json({ url: session.url });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
