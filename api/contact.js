/**
 * POST /api/contact
 * Accepts contact form submissions, sends email notification to admin.
 * Body: { name, email, phone, subject, message }
 */

const FROM = 'BookYourTrades <info@bookyourtrades.com>';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey     = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL || 'info@bookyourtrades.com';

  const { name, email, phone, subject, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'name, email, and message are required' });
  }

  const ts = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' });
  const subjectLine = `[BookYourTrades Inquiry] ${subject || 'General Inquiry'} — ${name}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>New Inquiry</title></head>
<body style="margin:0;padding:0;background:#0B1929;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="padding:32px 16px;">
<div style="max-width:600px;margin:0 auto;border-radius:10px;overflow:hidden;border:1px solid #1E3A5C;">
  <div style="background:#0F1923;padding:24px 32px;text-align:center;border-bottom:2px solid #E0621A;">
    <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#E0621A;font-weight:700;">BookYourTrades</div>
    <div style="font-size:13px;color:#94A3B8;">New Contact Form Submission</div>
  </div>
  <div style="background:#111E2D;padding:32px;">
    <h2 style="color:white;font-size:20px;margin:0 0 20px;">📬 New Inquiry — ${subject || 'General'}</h2>
    <div style="background:#0B1929;border:1px solid #1E3A5C;border-radius:8px;overflow:hidden;margin:0 0 20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:10px 14px;color:#64748B;font-size:13px;white-space:nowrap;border-bottom:1px solid #1E3A5C;">Name</td><td style="padding:10px 14px;color:#E2E8F0;font-weight:600;border-bottom:1px solid #1E3A5C;">${name}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748B;font-size:13px;white-space:nowrap;border-bottom:1px solid #1E3A5C;">Email</td><td style="padding:10px 14px;border-bottom:1px solid #1E3A5C;"><a href="mailto:${email}" style="color:#E0621A;">${email}</a></td></tr>
        ${phone ? `<tr><td style="padding:10px 14px;color:#64748B;font-size:13px;white-space:nowrap;border-bottom:1px solid #1E3A5C;">Phone</td><td style="padding:10px 14px;color:#E2E8F0;border-bottom:1px solid #1E3A5C;">${phone}</td></tr>` : ''}
        <tr><td style="padding:10px 14px;color:#64748B;font-size:13px;white-space:nowrap;border-bottom:1px solid #1E3A5C;">Subject</td><td style="padding:10px 14px;color:#E2E8F0;border-bottom:1px solid #1E3A5C;">${subject || '—'}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748B;font-size:13px;white-space:nowrap;">Received</td><td style="padding:10px 14px;color:#E2E8F0;">${ts} ET</td></tr>
      </table>
    </div>
    <div style="background:#0B1929;border:1px solid #1E3A5C;border-left:3px solid #E0621A;border-radius:8px;padding:20px;margin-bottom:24px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;margin-bottom:10px;">Message</div>
      <div style="color:#CBD5E1;font-size:15px;line-height:1.7;white-space:pre-wrap;">${message}</div>
    </div>
    <div style="text-align:center;margin:0 0 8px;">
      <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject || 'Your BookYourTrades Inquiry')}" style="display:inline-block;background:#E0621A;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Reply to ${name} →</a>
    </div>
    <div style="text-align:center;margin-top:8px;">
      <a href="https://bookyourtrades.com/admin" style="display:inline-block;background:#1E3A5C;color:#94A3B8;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:13px;">View Admin Panel</a>
    </div>
  </div>
  <div style="background:#0B1929;border-top:1px solid #1E3A5C;padding:16px 32px;text-align:center;">
    <p style="color:#475569;font-size:12px;margin:0;">BookYourTrades — <a href="https://bookyourtrades.com" style="color:#E0621A;">bookyourtrades.com</a></p>
  </div>
</div>
</td></tr>
</table>
</body></html>`;

  // Confirmation email to sender
  const confirmHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0B1929;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="padding:32px 16px;">
<div style="max-width:600px;margin:0 auto;border-radius:10px;overflow:hidden;border:1px solid #1E3A5C;">
  <div style="background:#0F1923;padding:24px 32px;text-align:center;border-bottom:2px solid #E0621A;">
    <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#E0621A;font-weight:700;">BookYourTrades</div>
    <div style="font-size:13px;color:#94A3B8;">Canada's Commercial Trades Directory</div>
  </div>
  <div style="background:#111E2D;padding:32px;">
    <h2 style="color:white;font-size:22px;margin:0 0 16px;">We received your message ✅</h2>
    <p style="color:#CBD5E1;line-height:1.7;">Hi <strong style="color:white;">${name}</strong>,</p>
    <p style="color:#CBD5E1;line-height:1.7;">
      Thanks for reaching out to BookYourTrades! We've received your inquiry and our team will respond to
      <strong style="color:white;">${email}</strong> within 1–2 business days.
    </p>
    <div style="background:#0B1929;border:1px solid #1E3A5C;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;margin-bottom:8px;">Your message</div>
      <div style="color:#94A3B8;font-size:14px;line-height:1.6;white-space:pre-wrap;">${message.slice(0, 300)}${message.length > 300 ? '...' : ''}</div>
    </div>
    <p style="color:#CBD5E1;line-height:1.7;">
      In the meantime, feel free to <a href="https://bookyourtrades.com/directory" style="color:#E0621A;">browse our directory</a>
      or <a href="https://bookyourtrades.com/rfq" style="color:#E0621A;">post a job request</a>.
    </p>
  </div>
  <div style="background:#0B1929;border-top:1px solid #1E3A5C;padding:16px 32px;text-align:center;">
    <p style="color:#475569;font-size:12px;margin:0;"><a href="https://bookyourtrades.com" style="color:#E0621A;">bookyourtrades.com</a> &bull; info@bookyourtrades.com</p>
  </div>
</div>
</td></tr>
</table>
</body></html>`;

  if (!apiKey) {
    console.warn('[contact] RESEND_API_KEY not set — logging inquiry only');
    console.log('[contact]', JSON.stringify({ name, email, phone, subject, message, ts }));
    return res.status(200).json({ ok: true, note: 'logged_only' });
  }

  try {
    // Send admin notification
    const [adminRes, confirmRes] = await Promise.allSettled([
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM, to: [adminEmail], subject: subjectLine, html,
          reply_to: email,
          text: `New inquiry from ${name} (${email})\nSubject: ${subject || 'General'}\n\n${message}`,
        }),
      }),
      // Send confirmation to sender
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM, to: [email],
          subject: 'We received your message — BookYourTrades',
          html: confirmHtml,
          text: `Hi ${name},\n\nThanks for contacting BookYourTrades! We'll reply to ${email} within 1–2 business days.\n\nYour message:\n${message}\n\n— The BookYourTrades Team\nhttps://bookyourtrades.com`,
        }),
      }),
    ]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] error:', err.message);
    return res.status(200).json({ ok: false, note: 'send_error' });
  }
};
