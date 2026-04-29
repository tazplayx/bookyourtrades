/**
 * Vercel serverless function — publishes blog posts to social media.
 *
 * Supports two providers (whichever key is set wins; Blotato takes priority):
 *   BLOTATO_API_KEY  — Blotato REST API  (POST /v2/posts)
 *   AYRSHARE_API_KEY — Ayrshare REST API (POST /api/post)
 *
 * POST /api/publish-social
 * Body: {
 *   title:        string   — blog post title
 *   excerpt:      string   — short description
 *   slug:         string   — URL slug  (/blog/<slug>)
 *   tag:          string   — category tag (Electrical, HVAC, etc.)
 *   body:         string?  — optional full HTML (stripped to plain text for copy)
 *   platforms:    string[] — e.g. ["linkedin","twitter","instagram"]
 *   scheduleDate: string?  — ISO date to schedule (omit = post now)
 *   accountIds:   object?  — { platform: blotato_account_id } (Blotato only)
 * }
 *
 * Response: { ok, provider, results|result|note }
 */

const BLOTATO_BASE  = 'https://backend.blotato.com/v2';
const AYRSHARE_BASE = 'https://app.ayrshare.com/api';

// ── Emoji map by trade/tag ────────────────────────────────────────────────────
function tradeEmoji(tag) {
  const map = {
    'Electrical':       '⚡',
    'Plumbing':         '🔧',
    'HVAC':             '❄️',
    'Roofing':          '🏗️',
    'Welding':          '🔥',
    'Carpentry':        '🪚',
    'Concrete':         '🏛️',
    'General Contracting': '🏢',
    'Hiring Guide':     '📋',
    'Industry Insight': '💡',
    'Safety':           '🦺',
  };
  for (const [key, val] of Object.entries(map)) {
    if (tag && tag.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return '🔨';
}

// ── Strip HTML tags from body for plain-text copy ────────────────────────────
function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Build social copy ─────────────────────────────────────────────────────────
function buildCopy(data) {
  const { title, excerpt, slug, tag } = data;
  const emoji   = tradeEmoji(tag);
  const url     = 'https://bookyourtrades.com/blog/' + encodeURIComponent(slug);
  const tagLine = tag ? `#${tag.replace(/\s+/g, '')} ` : '';

  return [
    `${emoji} ${title}`,
    '',
    excerpt || '',
    '',
    `🔗 ${url}`,
    '',
    `${tagLine}#TradesCanada #CommercialTrades #Contractors #BookYourTrades`,
  ].join('\n').trim();
}

// ── Blotato publish ───────────────────────────────────────────────────────────
async function publishBlotato(apiKey, copy, platforms, scheduleDate, accountIds) {
  const results = [];

  for (const platform of platforms) {
    const payload = {
      post: {
        text: copy,
        platforms: [{
          platform: platform.toLowerCase(),
          accountId: (accountIds && accountIds[platform]) || '',
        }],
      },
    };
    if (scheduleDate) payload.post.scheduleDate = scheduleDate;

    try {
      const r = await fetch(`${BLOTATO_BASE}/posts`, {
        method:  'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const json = await r.json();
      results.push({ platform, ok: r.ok, ...json });
    } catch (err) {
      results.push({ platform, ok: false, error: err.message });
    }
  }
  return results;
}

// ── Ayrshare publish ──────────────────────────────────────────────────────────
async function publishAyrshare(apiKey, copy, platforms, scheduleDate) {
  const payload = {
    post:          copy,
    platforms:     platforms.map(p => p.toLowerCase()),
    shortenLinks:  true,
  };
  if (scheduleDate) payload.scheduleDate = scheduleDate;

  const r = await fetch(`${AYRSHARE_BASE}/post`, {
    method:  'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  return r.json();
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST only' });

  const blotatoKey  = process.env.BLOTATO_API_KEY;
  const ayrshareKey = process.env.AYRSHARE_API_KEY;

  if (!blotatoKey && !ayrshareKey) {
    return res.status(200).json({ ok: false, note: 'No social API key configured. Set BLOTATO_API_KEY or AYRSHARE_API_KEY in Vercel environment variables.' });
  }

  const {
    title, excerpt, slug, tag, body,
    platforms   = ['linkedin', 'twitter'],
    scheduleDate,
    accountIds  = {},
  } = req.body || {};

  if (!title || !slug) {
    return res.status(400).json({ error: 'title and slug are required' });
  }

  const copy = buildCopy({ title, excerpt: excerpt || stripHtml(body).slice(0, 200), slug, tag });

  try {
    if (blotatoKey) {
      const results = await publishBlotato(blotatoKey, copy, platforms, scheduleDate, accountIds);
      return res.status(200).json({ ok: true, provider: 'blotato', copy, results });
    }

    const result = await publishAyrshare(ayrshareKey, copy, platforms, scheduleDate);
    return res.status(200).json({ ok: true, provider: 'ayrshare', copy, result });

  } catch (err) {
    console.error('[publish-social] error:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
};
