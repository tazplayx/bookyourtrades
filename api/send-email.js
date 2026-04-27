/**
 * Vercel serverless function — sends all transactional emails via Resend.
 * FROM address: info@bookyourtrades.com (verified domain in Resend)
 *
 * Environment variables (Vercel Dashboard):
 *   RESEND_API_KEY  — Resend API key
 *   ADMIN_EMAIL     — where admin alerts go (default: info@bookyourtrades.com)
 *
 * POST /api/send-email
 * Body: { type, email, data: {} }
 *
 * Types:
 *   verification         — email verify link for new accounts
 *   welcome              — client welcome after registration
 *   contractor_welcome   — contractor welcome after listing created
 *   admin_alert          — internal alert to admin inbox
 *   new_lead_unclaimed   — outreach email to scraped/unclaimed contractor
 *   application_approved — contractor approved by admin
 *   application_rejected — contractor rejected by admin
 *   email_verification   — provider email verification token
 *   claim_verification   — ownership claim verification email
 *   review_approved      — notify contractor their review was approved
 */

const FROM = 'BookYourTrades <info@bookyourtrades.com>';

// Shared email shell — dark branded
function shell(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#0B1929;font-family:Arial,Helvetica,sans-serif;}
  a{color:#E0621A;}
</style></head>
<body>
<div style="max-width:600px;margin:32px auto;border-radius:10px;overflow:hidden;border:1px solid #1E3A5C;">
  <div style="background:linear-gradient(135deg,#0F1923,#1A2C42);padding:24px 32px;text-align:center;border-bottom:2px solid #E0621A;">
    <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#E0621A;font-weight:700;margin-bottom:4px;">BookYourTrades</div>
    <div style="font-size:13px;color:#94A3B8;">Canada's Commercial Trades Directory</div>
  </div>
  <div style="background:#111E2D;padding:32px;">
    ${bodyHtml}
  </div>
  <div style="background:#0B1929;border-top:1px solid #1E3A5C;padding:16px 32px;text-align:center;">
    <p style="color:#475569;font-size:12px;margin:0;">
      <a href="https://bookyourtrades.com" style="color:#E0621A;">bookyourtrades.com</a>
      &nbsp;&bull;&nbsp; info@bookyourtrades.com
      &nbsp;&bull;&nbsp; Canada's commercial trades directory
    </p>
  </div>
</div>
</body></html>`;
}

function btn(href, label) {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${href}" style="display:inline-block;background:#E0621A;color:white;padding:13px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">${label}</a>
  </div>`;
}

function row(label, value) {
  return value
    ? `<tr>
        <td style="padding:8px 12px;color:#64748B;font-size:13px;white-space:nowrap;">${label}</td>
        <td style="padding:8px 12px;color:#E2E8F0;font-weight:600;">${value}</td>
       </tr>`
    : '';
}

function infoTable(rows) {
  return `<div style="background:#0B1929;border:1px solid #1E3A5C;border-radius:8px;overflow:hidden;margin:20px 0;">
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
  </div>`;
}

// ── Email templates ──────────────────────────────────────────────────────────

function buildVerification(data) {
  return {
    subject: 'Verify your BookYourTrades account',
    html: shell(`
      <h2 style="color:white;font-size:22px;margin:0 0 16px;">Confirm your email address</h2>
      <p style="color:#CBD5E1;line-height:1.7;">Hi <strong style="color:white;">${data.name || 'there'}</strong>,</p>
      <p style="color:#CBD5E1;line-height:1.7;">Thanks for registering${data.company ? ' for <strong style="color:white;">' + data.company + '</strong>' : ''} on BookYourTrades. Click below to verify your email and activate your account.</p>
      ${btn(data.verifyUrl || 'https://bookyourtrades.com', 'Verify My Email →')}
      <p style="color:#64748B;font-size:13px;text-align:center;">This link expires in 24 hours. If you didn't register, you can safely ignore this email.</p>
    `),
  };
}

function buildWelcomeClient(data) {
  return {
    subject: 'Welcome to BookYourTrades — Your account is ready',
    html: shell(`
      <h2 style="color:white;font-size:22px;margin:0 0 16px;">You're all set, ${data.name || 'there'}! 🎉</h2>
      <p style="color:#CBD5E1;line-height:1.7;">Your BookYourTrades account is now active. Here's what you can do:</p>
      <ul style="color:#CBD5E1;line-height:2;padding-left:20px;">
        <li>Browse licensed trade contractors across Canada</li>
        <li>Submit quote requests directly on contractor profiles</li>
        <li>Post a job and get matched with local contractors</li>
        <li>Track all your requests in your dashboard</li>
      </ul>
      ${btn('https://bookyourtrades.com/directory', 'Browse Contractors →')}
    `),
  };
}

function buildWelcomeContractor(data) {
  return {
    subject: `Your listing is live on BookYourTrades — ${data.company || 'Welcome!'}`,
    html: shell(`
      <h2 style="color:white;font-size:22px;margin:0 0 8px;">Your listing is live! 🚀</h2>
      <p style="color:#E0621A;font-size:14px;margin:0 0 20px;font-weight:600;">${data.company || ''}</p>
      <p style="color:#CBD5E1;line-height:1.7;">Hi <strong style="color:white;">${data.name || 'there'}</strong>, your <strong style="color:white;">${data.trade || 'trade'}</strong> listing is now visible to commercial clients searching BookYourTrades across Canada.</p>
      ${infoTable(
        row('Trade', data.trade || '') +
        row('Service Area', data.city || '') +
        row('Listing Status', 'Live — Pending Approval')
      )}
      <p style="color:#CBD5E1;line-height:1.7;margin-bottom:8px;"><strong style="color:white;">Next steps to get more leads:</strong></p>
      <ul style="color:#CBD5E1;line-height:2;padding-left:20px;margin:0 0 20px;">
        <li>Add your licence number and certifications to rank higher</li>
        <li>Upload project photos to stand out</li>
        <li>Upgrade to Pro for unlimited booking requests and featured placement</li>
      </ul>
      ${btn('https://bookyourtrades.com/dashboard', 'Go to Your Dashboard →')}
      <p style="color:#64748B;font-size:13px;text-align:center;">Questions? Reply to this email or contact <a href="mailto:info@bookyourtrades.com">info@bookyourtrades.com</a></p>
    `),
  };
}

function buildAdminAlert(data, adminEmail) {
  return {
    to: adminEmail,
    subject: '[BookYourTrades] ' + (data.subject || 'New Activity'),
    html: shell(`
      <h2 style="color:white;font-size:20px;margin:0 0 16px;">Platform Alert</h2>
      <p style="color:#CBD5E1;">${data.subject || 'New activity on your platform'}</p>
      ${infoTable(
        Object.entries(data.details || {}).map(([k, v]) => row(k, v)).join('')
      )}
      ${btn('https://bookyourtrades.com/admin', 'View Admin Panel →')}
    `),
  };
}

function buildNewLeadUnclaimed(data) {
  // Outreach to a scraped contractor who hasn't claimed their listing yet
  return {
    subject: `📋 New client lead waiting for you on BookYourTrades`,
    html: shell(`
      <h2 style="color:white;font-size:22px;margin:0 0 8px;">A client is looking for a ${data.tradeType || 'trade'} contractor</h2>
      <p style="color:#E0621A;font-size:13px;margin:0 0 20px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">New Lead via BookYourTrades.com</p>
      <p style="color:#CBD5E1;line-height:1.7;">Hi <strong style="color:white;">${data.companyName || 'there'}</strong>,</p>
      <p style="color:#CBD5E1;line-height:1.7;">
        A client has submitted a quote request for <strong style="color:white;">${data.tradeType || 'trade work'}</strong> in your area through
        <a href="https://bookyourtrades.com">BookYourTrades.com</a>.
        We found your business in our directory — claim your free listing to respond directly.
      </p>
      ${infoTable(
        row('Client Name', data.leadName || '') +
        row('Phone', data.leadPhone || '') +
        row('Email', `<a href="mailto:${data.leadEmail}" style="color:#E0621A;">${data.leadEmail}</a>`) +
        row('Trade Needed', data.tradeType || '') +
        row('Preferred Date', data.serviceDate || '') +
        row('Location', data.city || '')
      )}
      ${data.jobDescription ? `
      <div style="background:#0B1929;border:1px solid #1E3A5C;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">Project Details</p>
        <p style="color:#CBD5E1;margin:0;line-height:1.7;">${data.jobDescription}</p>
      </div>` : ''}
      <p style="color:#CBD5E1;line-height:1.7;"><strong style="color:white;">To respond to this lead,</strong> claim your free listing on BookYourTrades. It takes 2 minutes and is completely free.</p>
      ${btn('https://bookyourtrades.com/register', 'Claim Your Free Listing →')}
      <p style="color:#64748B;font-size:12px;text-align:center;line-height:1.6;">
        BookYourTrades is Canada's commercial trades directory. Your business was listed based on publicly available information.
        To remove your listing, contact <a href="mailto:info@bookyourtrades.com">info@bookyourtrades.com</a>.
      </p>
    `),
  };
}

function buildApplicationApproved(data) {
  return {
    subject: `🎉 Your listing has been approved — ${data.company || 'BookYourTrades'}`,
    html: shell(`
      <h2 style="color:white;font-size:22px;margin:0 0 8px;">You're approved and live! 🎉</h2>
      <p style="color:#E0621A;font-size:14px;margin:0 0 20px;font-weight:600;">${data.company || ''}</p>
      <p style="color:#CBD5E1;line-height:1.7;">Hi <strong style="color:white;">${data.name || 'there'}</strong>,</p>
      <p style="color:#CBD5E1;line-height:1.7;">
        Great news — your contractor listing on BookYourTrades has been <strong style="color:#4ADE80;">reviewed and approved</strong>.
        Commercial clients across Canada can now find and contact your business.
      </p>
      ${infoTable(
        row('Business', data.company || '') +
        row('Trade', data.trade || '') +
        row('Service Area', data.city || '') +
        row('Plan', data.plan || 'Free') +
        row('Status', '<span style="color:#4ADE80;font-weight:700;">✓ Approved</span>')
      )}
      <p style="color:#CBD5E1;line-height:1.7;"><strong style="color:white;">Maximize your leads:</strong></p>
      <ul style="color:#CBD5E1;line-height:2;padding-left:20px;margin:0 0 20px;">
        <li>Complete your profile with certifications and photos</li>
        <li>Respond to RFQ leads quickly to win more jobs</li>
        <li>Upgrade to <strong style="color:#E0621A;">Pro ($49/mo)</strong> for featured placement and unlimited contacts</li>
      </ul>
      ${btn('https://bookyourtrades.com/dashboard', 'Go to Your Dashboard →')}
      <p style="color:#64748B;font-size:13px;text-align:center;">Questions? <a href="mailto:info@bookyourtrades.com">info@bookyourtrades.com</a></p>
    `),
  };
}

function buildApplicationRejected(data) {
  return {
    subject: `Your BookYourTrades application — ${data.company || 'Update'}`,
    html: shell(`
      <h2 style="color:white;font-size:22px;margin:0 0 16px;">Application Update</h2>
      <p style="color:#CBD5E1;line-height:1.7;">Hi <strong style="color:white;">${data.name || 'there'}</strong>,</p>
      <p style="color:#CBD5E1;line-height:1.7;">
        Thank you for applying to list your business on BookYourTrades. After reviewing your application,
        we were unable to approve <strong style="color:white;">${data.company || 'your listing'}</strong> at this time.
      </p>
      ${data.reason ? `
      <div style="background:#0B1929;border:1px solid #1E3A5C;border-left:3px solid #E0621A;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="color:#64748B;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">Reason</p>
        <p style="color:#CBD5E1;margin:0;line-height:1.7;">${data.reason}</p>
      </div>` : ''}
      <p style="color:#CBD5E1;line-height:1.7;">
        Common reasons for rejection include incomplete trade licence information, unverifiable business details,
        or service areas outside our current coverage. You're welcome to reapply once these are resolved.
      </p>
      ${btn('https://bookyourtrades.com/register', 'Reapply Now →')}
      <p style="color:#64748B;font-size:13px;text-align:center;">
        If you believe this is an error, please contact <a href="mailto:info@bookyourtrades.com">info@bookyourtrades.com</a> with your business details.
      </p>
    `),
  };
}

function buildEmailVerification(data) {
  return {
    subject: 'Verify your BookYourTrades email address',
    html: shell(`
      <h2 style="color:white;font-size:22px;margin:0 0 16px;">Confirm your email address</h2>
      <p style="color:#CBD5E1;line-height:1.7;">Hi <strong style="color:white;">${data.name || 'there'}</strong>,</p>
      <p style="color:#CBD5E1;line-height:1.7;">
        You registered <strong style="color:white;">${data.company || 'your business'}</strong> on BookYourTrades.
        Click below to verify your email address and complete your registration.
      </p>
      ${btn(data.verifyUrl, 'Verify My Email →')}
      <p style="color:#64748B;font-size:13px;text-align:center;line-height:1.8;">
        This link expires in <strong style="color:white;">24 hours</strong>.<br>
        If you didn't register on BookYourTrades, you can safely ignore this email.
      </p>
    `),
  };
}

function buildClaimVerification(data) {
  return {
    subject: `Verify your ownership claim — ${data.company || 'BookYourTrades'}`,
    html: shell(`
      <h2 style="color:white;font-size:22px;margin:0 0 16px;">Confirm your listing claim</h2>
      <p style="color:#CBD5E1;line-height:1.7;">Hi <strong style="color:white;">${data.name || 'there'}</strong>,</p>
      <p style="color:#CBD5E1;line-height:1.7;">
        You requested to claim the <strong style="color:white;">${data.company || 'contractor'}</strong> listing on BookYourTrades.
        Click below to verify your email and submit this claim for admin review.
      </p>
      ${infoTable(
        row('Business', data.company || '') +
        row('Trade', data.trade || '') +
        row('City', data.city || '')
      )}
      ${btn(data.verifyUrl, 'Verify & Submit Claim →')}
      <p style="color:#64748B;font-size:13px;text-align:center;line-height:1.8;">
        After verification, an admin will review your claim within 1–2 business days.<br>
        Questions? <a href="mailto:info@bookyourtrades.com">info@bookyourtrades.com</a>
      </p>
    `),
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey     = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL || 'info@bookyourtrades.com';

  if (!apiKey) {
    return res.status(200).json({ ok: true, note: 'RESEND_API_KEY not set — email skipped' });
  }

  const { type, email, data = {} } = req.body || {};

  let to, subject, html;

  switch (type) {
    case 'verification':
      to = email;
      ({ subject, html } = buildVerification(data));
      break;
    case 'welcome':
      to = email;
      ({ subject, html } = buildWelcomeClient(data));
      break;
    case 'contractor_welcome':
      to = email;
      ({ subject, html } = buildWelcomeContractor(data));
      break;
    case 'admin_alert': {
      const built = buildAdminAlert(data, adminEmail);
      to = built.to || adminEmail;
      subject = built.subject;
      html = built.html;
      break;
    }
    case 'new_lead_unclaimed':
      to = data.companyEmail;
      if (!to) return res.status(400).json({ error: 'companyEmail required' });
      ({ subject, html } = buildNewLeadUnclaimed(data));
      break;
    case 'application_approved':
      to = email;
      ({ subject, html } = buildApplicationApproved(data));
      break;
    case 'application_rejected':
      to = email;
      ({ subject, html } = buildApplicationRejected(data));
      break;
    case 'email_verification':
      to = email;
      ({ subject, html } = buildEmailVerification(data));
      break;
    case 'claim_verification':
      to = email;
      ({ subject, html } = buildClaimVerification(data));
      break;
    default:
      return res.status(400).json({ error: 'Unknown email type: ' + type });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });

    const result = await r.json();
    if (!r.ok) {
      console.error('[send-email] Resend error:', JSON.stringify(result));
      return res.status(200).json({ ok: false, note: 'send_failed' });
    }
    return res.status(200).json({ ok: true, id: result.id });
  } catch (err) {
    console.error('[send-email] fetch error:', err.message);
    return res.status(200).json({ ok: false, note: 'network_error' });
  }
};
