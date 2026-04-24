/**
 * Vercel serverless function — emails a trade company when a new lead
 * (booking request) is submitted on their BookYourTrades listing page.
 *
 * Environment variables (set in Vercel Dashboard):
 *   RESEND_API_KEY   — your Resend API key (https://resend.com)
 *
 * The FROM address must be a domain verified in Resend.
 * Default: leads@bookyourtrades.com
 *
 * POST /api/send-lead
 * Body (JSON):
 *   companyName    — contractor's business name
 *   companyEmail   — contractor's email (recipient)
 *   tradeType      — e.g. "Electrical"
 *   leadName       — client's name
 *   leadEmail      — client's email (used as reply-to)
 *   leadPhone      — client's phone number
 *   serviceDate    — preferred service date (optional)
 *   serviceTime    — preferred time slot (optional)
 *   jobDescription — project details (optional)
 */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;

  // Graceful degradation — if email isn't configured the booking still saves locally
  if (!apiKey) {
    console.log('[send-lead] RESEND_API_KEY not set — skipping email');
    return res.status(200).json({ sent: false, reason: 'not_configured' });
  }

  const {
    companyName   = 'Contractor',
    companyEmail,
    tradeType     = 'Trade',
    leadName,
    leadEmail,
    leadPhone     = '',
    serviceDate   = '',
    serviceTime   = '',
    jobDescription = '',
  } = req.body || {};

  if (!companyEmail || !leadName || !leadEmail) {
    return res.status(400).json({ error: 'companyEmail, leadName, and leadEmail are required' });
  }

  // ── HTML email ─────────────────────────────────────────────────────────────
  const row = (label, value) => value
    ? `<tr>
        <td style="padding:8px 12px;color:#64748B;font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td>
        <td style="padding:8px 12px;color:#E2E8F0;font-weight:600;">${value}</td>
       </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0B1929;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:32px auto;border-radius:10px;overflow:hidden;border:1px solid #1E3A5C;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0F1923 0%,#1A2C42 100%);padding:28px 32px;text-align:center;border-bottom:2px solid #E0621A;">
      <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#E0621A;font-weight:700;margin-bottom:6px;">New Lead</div>
      <div style="font-size:28px;font-weight:700;color:white;">📋 Booking Request</div>
      <div style="font-size:13px;color:#94A3B8;margin-top:6px;">via BookYourTrades.com</div>
    </div>

    <!-- Body -->
    <div style="background:#111E2D;padding:28px 32px;">
      <p style="color:#CBD5E1;font-size:15px;margin:0 0 20px;">
        Hi <strong style="color:white;">${companyName}</strong>,<br><br>
        You have a new quote request from a client on
        <a href="https://bookyourtrades.com" style="color:#E0621A;">BookYourTrades.com</a>.
        Reply directly to this email to respond.
      </p>

      <!-- Lead details table -->
      <div style="background:#0B1929;border:1px solid #1E3A5C;border-radius:8px;overflow:hidden;margin-bottom:20px;">
        <div style="background:#0F1923;padding:10px 16px;border-bottom:1px solid #1E3A5C;">
          <span style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#64748B;font-weight:700;">Client Details</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          ${row('Name',           leadName)}
          ${row('Email',         `<a href="mailto:${leadEmail}" style="color:#E0621A;">${leadEmail}</a>`)}
          ${row('Phone',         leadPhone ? `<a href="tel:${leadPhone}" style="color:#E0621A;">${leadPhone}</a>` : '')}
          ${row('Trade Needed',  tradeType)}
          ${row('Preferred Date', serviceDate)}
          ${row('Preferred Time', serviceTime)}
        </table>
      </div>

      ${jobDescription ? `
      <!-- Project description -->
      <div style="background:#0B1929;border:1px solid #1E3A5C;border-radius:8px;overflow:hidden;margin-bottom:20px;">
        <div style="background:#0F1923;padding:10px 16px;border-bottom:1px solid #1E3A5C;">
          <span style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#64748B;font-weight:700;">Project Description</span>
        </div>
        <div style="padding:16px;color:#CBD5E1;font-size:14px;line-height:1.6;">${jobDescription}</div>
      </div>` : ''}

      <!-- CTA -->
      <div style="text-align:center;margin:24px 0 8px;">
        <a href="mailto:${leadEmail}" style="display:inline-block;background:#E0621A;color:white;padding:13px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.03em;">
          Reply to ${leadName} →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#0B1929;border-top:1px solid #1E3A5C;padding:16px 32px;text-align:center;">
      <p style="color:#475569;font-size:12px;margin:0;">
        Sent by <a href="https://bookyourtrades.com" style="color:#E0621A;">BookYourTrades.com</a>
        — Canada's Commercial Trades Directory.<br>
        To manage your listing, visit your
        <a href="https://bookyourtrades.com/dashboard" style="color:#E0621A;">contractor dashboard</a>.
      </p>
    </div>

  </div>
</body>
</html>`;

  // ── Send via Resend ─────────────────────────────────────────────────────────
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     'BookYourTrades Leads <leads@bookyourtrades.com>',
        to:       [companyEmail],
        reply_to: leadEmail,
        subject:  `New Lead: ${leadName} is looking for a ${tradeType} contractor — BookYourTrades`,
        html,
      }),
    });

    const result = await r.json();
    if (!r.ok) {
      console.error('[send-lead] Resend error:', JSON.stringify(result));
      // Return 200 so client UX is unaffected — booking already saved locally
      return res.status(200).json({ sent: false, reason: 'send_failed' });
    }
    return res.status(200).json({ sent: true, id: result.id });
  } catch (err) {
    console.error('[send-lead] fetch error:', err.message);
    return res.status(200).json({ sent: false, reason: 'network_error' });
  }
};
