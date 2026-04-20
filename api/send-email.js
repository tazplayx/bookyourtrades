/**
 * Vercel serverless function — sends transactional emails via Resend.
 *
 * Environment variables (Vercel Dashboard):
 *   RESEND_API_KEY   — your Resend API key (https://resend.com)
 *   ADMIN_EMAIL      — admin notification email (e.g. corey@bookyourtrades.com)
 *
 * POST /api/send-email
 * Body: { type: 'verification'|'admin_alert'|'welcome', email, data: {} }
 */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL || 'hello@bookyourtrades.com';

  if (!apiKey) {
    // Silently succeed if not configured — don't break registration flow
    return res.status(200).json({ ok: true, note: 'Email not configured' });
  }

  const { type, email, data = {} } = req.body || {};

  let subject, html, to;

  if (type === 'verification') {
    to = email;
    subject = 'Verify your BookYourTrades account';
    html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <div style="background:#1A3A6E;padding:24px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;">BookYourTrades</h1>
        </div>
        <div style="padding:32px;background:#f9f9f9;">
          <h2 style="color:#1A3A6E;">Welcome to BookYourTrades!</h2>
          <p>Hi ${data.name || ''},</p>
          <p>Thanks for registering${data.company ? ' for <strong>' + data.company + '</strong>' : ''}. Please verify your email address to activate your account.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${data.verifyUrl}" style="background:#E8620A;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px;">Verify My Email</a>
          </div>
          <p style="font-size:13px;color:#666;">This link expires in 24 hours. If you didn't register, you can ignore this email.</p>
        </div>
        <div style="padding:16px;text-align:center;font-size:12px;color:#999;">
          BookYourTrades Inc. &bull; Ontario, Canada &bull; <a href="https://bookyourtrades.com">bookyourtrades.com</a>
        </div>
      </div>`;
  } else if (type === 'welcome') {
    to = email;
    subject = 'Welcome to BookYourTrades — Your account is ready';
    html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <div style="background:#1A3A6E;padding:24px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;">BookYourTrades</h1>
        </div>
        <div style="padding:32px;background:#f9f9f9;">
          <h2 style="color:#1A3A6E;">You're all set, ${data.name || ''}!</h2>
          <p>Your BookYourTrades account is now active${data.company ? ' for <strong>' + data.company + '</strong>' : ''}.</p>
          <p>Here's what you can do next:</p>
          <ul>
            <li>Complete your profile to appear higher in search results</li>
            <li>Upload your certifications and licence numbers</li>
            <li>Browse available job requests in your trade area</li>
            <li>Upgrade to Pro to unlock unlimited booking requests</li>
          </ul>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://bookyourtrades.com/dashboard" style="background:#E8620A;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;">Go to Dashboard</a>
          </div>
        </div>
        <div style="padding:16px;text-align:center;font-size:12px;color:#999;">
          BookYourTrades Inc. &bull; Ontario, Canada
        </div>
      </div>`;
  } else if (type === 'admin_alert') {
    to = adminEmail;
    subject = '[BookYourTrades] ' + (data.subject || 'New Activity');
    html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:#1A3A6E;">BookYourTrades Alert</h2>
        <p><strong>${data.subject || 'New activity on your platform'}</strong></p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          ${Object.entries(data.details || {}).map(([k,v]) =>
            `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;width:40%;">${k}</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:500;">${v}</td></tr>`
          ).join('')}
        </table>
        <p style="margin-top:24px;font-size:13px;color:#999;">
          <a href="https://bookyourtrades.com/admin">View admin panel &rarr;</a>
        </p>
      </div>`;
  } else {
    return res.status(400).json({ error: 'Unknown email type' });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BookYourTrades <noreply@bookyourtrades.com>',
        to: [to],
        subject,
        html,
      }),
    });

    const result = await r.json();
    if (result.error) return res.status(400).json({ error: result.error.message });
    return res.status(200).json({ ok: true, id: result.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
