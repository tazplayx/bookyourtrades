/**
 * Vercel serverless function — fetches trade job postings from Indeed Canada RSS feeds.
 * Returns up to 60 listings sorted newest-first.
 *
 * GET /api/careers                      — all trades jobs
 * GET /api/careers?trade=electrician    — filter by trade keyword
 * GET /api/careers?city=Vancouver       — filter by city
 * GET /api/careers?province=BC          — filter by province
 */

const TRADE_FEEDS = [
  { trade: 'Electrical',            keyword: 'electrician',          icon: '⚡' },
  { trade: 'Plumbing',              keyword: 'plumber',              icon: '🔧' },
  { trade: 'HVAC',                  keyword: 'hvac+technician',      icon: '🌡️' },
  { trade: 'Roofing',               keyword: 'roofer',               icon: '🏚️' },
  { trade: 'Welding & Fabrication', keyword: 'welder',               icon: '⚙️' },
  { trade: 'Millwright',            keyword: 'millwright',           icon: '🔩' },
  { trade: 'Carpentry',             keyword: 'carpenter',            icon: '🪚' },
  { trade: 'General Contracting',   keyword: 'general+contractor',   icon: '🏗️' },
  { trade: 'Sheet Metal',           keyword: 'sheet+metal+worker',   icon: '🔨' },
  { trade: 'Pipefitting',           keyword: 'pipefitter',           icon: '🛢️' },
  { trade: 'Concrete & Masonry',    keyword: 'concrete+mason',       icon: '🧱' },
  { trade: 'Refrigeration',         keyword: 'refrigeration+mechanic', icon: '❄️' },
];

const CANADIAN_CITIES = [
  'Toronto', 'Vancouver', 'Calgary', 'Edmonton', 'Montreal', 'Ottawa',
  'Winnipeg', 'Hamilton', 'Mississauga', 'Halifax'
];

// Build Indeed Canada RSS URL for a trade keyword
function indeedUrl(keyword, city) {
  const loc = city ? encodeURIComponent(city + ', Canada') : 'Canada';
  return `https://ca.indeed.com/rss?q=${keyword}&l=${loc}&sort=date&limit=10`;
}

// Workopolis RSS (if available)
function workopolisUrl(keyword) {
  return `https://www.workopolis.com/jobsearch/find-jobs?ak=${keyword}&lg=en&what=${keyword}&where=Canada&rss=true`;
}

function extractTag(xml, tag) {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(xml);
  if (cdata) return cdata[1].trim();
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
  if (plain) return plain[1].replace(/<[^>]+>/g, '').trim();
  return '';
}

function clean(str, maxLen = 300) {
  const stripped = str
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + '…' : stripped;
}

// Extract city/province from job location string
function parseLocation(locStr) {
  if (!locStr) return { city: '', province: '' };
  // Common patterns: "Toronto, ON", "Vancouver, BC", "Calgary, AB"
  const match = /^([^,]+),\s*([A-Z]{2})/i.exec(locStr.trim());
  if (match) return { city: match[1].trim(), province: match[2].toUpperCase() };
  return { city: locStr.trim(), province: '' };
}

async function fetchIndeedFeed(trade, keyword) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    // Try fetching for a couple of major cities to get variety
    const url = indeedUrl(keyword, '');
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BookYourTrades/1.0 (+https://bookyourtrades.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });
    clearTimeout(timeout);
    if (!response.ok) return [];

    const xml = await response.text();
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    return itemMatches.slice(0, 8).map(m => {
      const item = m[1];
      const title    = extractTag(item, 'title');
      const link     = extractTag(item, 'link') || extractTag(item, 'guid');
      const desc     = clean(extractTag(item, 'description'));
      const locRaw   = extractTag(item, 'location') || '';
      const company  = extractTag(item, 'source') || extractTag(item, 'author') || '';
      const pubDate  = extractTag(item, 'pubDate');
      const date     = pubDate ? new Date(pubDate) : new Date();
      const { city, province } = parseLocation(locRaw);

      if (!title || !link) return null;

      // Guess province from city if not present
      const canadaCityProvinces = {
        'Toronto': 'ON', 'Ottawa': 'ON', 'Hamilton': 'ON', 'Mississauga': 'ON',
        'Vancouver': 'BC', 'Surrey': 'BC', 'Burnaby': 'BC', 'Victoria': 'BC',
        'Calgary': 'AB', 'Edmonton': 'AB', 'Red Deer': 'AB', 'Lethbridge': 'AB',
        'Winnipeg': 'MB', 'Brandon': 'MB',
        'Regina': 'SK', 'Saskatoon': 'SK',
        'Montreal': 'QC', 'Quebec City': 'QC', 'Laval': 'QC',
        'Halifax': 'NS', 'Moncton': 'NB', 'Fredericton': 'NB',
      };
      const resolvedProvince = province || canadaCityProvinces[city] || '';

      return {
        id: 'jb_' + Buffer.from(link).toString('base64').slice(0, 12),
        title: title.replace(/\s*-\s*(indeed\.ca|ca\.indeed\.com).*$/i, '').trim(),
        company,
        location: city ? (city + (resolvedProvince ? ', ' + resolvedProvince : '')) : locRaw || 'Canada',
        city,
        province: resolvedProvince,
        trade: trade.trade,
        icon:  trade.icon,
        description: desc,
        link,
        source: 'Indeed Canada',
        sourceUrl: 'https://ca.indeed.com',
        pubDate: date.toISOString(),
        displayDate: isNaN(date) ? '' : date.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }),
        type: 'Full-time', // default
      };
    }).filter(Boolean);

  } catch (e) {
    clearTimeout(timeout);
    return [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  /* Cache for 30 minutes */
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900');

  const tradeFilter    = (req.query?.trade    || '').toLowerCase().trim();
  const cityFilter     = (req.query?.city     || '').toLowerCase().trim();
  const provinceFilter = (req.query?.province || '').toUpperCase().trim();

  // Fetch from up to 6 trade feeds concurrently
  const feedsToFetch = tradeFilter
    ? TRADE_FEEDS.filter(t => t.trade.toLowerCase().includes(tradeFilter) || t.keyword.includes(tradeFilter))
    : TRADE_FEEDS.slice(0, 8); // limit concurrent requests

  const results = await Promise.allSettled(feedsToFetch.map(t => fetchIndeedFeed(t, t.keyword)));

  let jobs = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Apply filters
  if (cityFilter) {
    jobs = jobs.filter(j => j.city.toLowerCase().includes(cityFilter) || j.location.toLowerCase().includes(cityFilter));
  }
  if (provinceFilter) {
    jobs = jobs.filter(j => j.province === provinceFilter);
  }

  // Sort newest first
  jobs.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Deduplicate by title+company
  const seen = new Set();
  jobs = jobs.filter(j => {
    const key = (j.title + '|' + j.company).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return res.status(200).json({
    jobs: jobs.slice(0, 60),
    fetched: new Date().toISOString(),
    total: jobs.length,
    sources: ['Indeed Canada'],
  });
};
