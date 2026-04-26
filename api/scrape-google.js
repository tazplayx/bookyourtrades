/**
 * Vercel serverless function — discovers Canadian trade companies via
 * Google Places API (Text Search + Details), then enriches each result
 * by scraping the company's own website for email, phone, description,
 * and certifications.  Contact info always comes from the business
 * website, not just the Google listing.
 *
 * Environment variables (Vercel Dashboard):
 *   GOOGLE_PLACES_API_KEY — Google Cloud project key with Places API enabled
 *
 * GET /api/scrape-google               — all trades, top 8 cities
 * GET /api/scrape-google?trade=hvac    — single trade, top 8 cities
 * GET /api/scrape-google?city=Calgary  — all trades, one city
 * GET /api/scrape-google?batch=1       — second batch of cities (8–15)
 *
 * Edge-cached 24 hours.  A Vercel Cron refreshes daily at 06:30 UTC.
 */

// ── Configuration ────────────────────────────────────────────────────────────

const TRADES = [
  { trade: 'Boilermaker',          icon: '🔥', query: 'boilermaker contractor' },
  { trade: 'Carpentry',            icon: '🪚', query: 'carpentry contractor' },
  { trade: 'Concrete & Masonry',   icon: '🧱', query: 'concrete masonry contractor' },
  { trade: 'Electrical',           icon: '⚡', query: 'electrical contractor' },
  { trade: 'General Contracting',  icon: '🏗️', query: 'general contractor construction' },
  { trade: 'HVAC',                 icon: '🌡️', query: 'HVAC heating cooling contractor' },
  { trade: 'Millwright',           icon: '🔩', query: 'millwright industrial contractor' },
  { trade: 'Painting & Coating',   icon: '🎨', query: 'commercial painting coating contractor' },
  { trade: 'Pipefitting',          icon: '🛢️', query: 'pipefitting contractor' },
  { trade: 'Plumbing',             icon: '🔧', query: 'plumbing contractor' },
  { trade: 'Refrigeration',        icon: '❄️', query: 'refrigeration contractor' },
  { trade: 'Roofing',              icon: '🏚️', query: 'roofing contractor commercial' },
  { trade: 'Sheet Metal',          icon: '🔨', query: 'sheet metal contractor' },
  { trade: 'Welding & Fabrication',icon: '⚙️', query: 'welding fabrication contractor' },
];

// Two batches so crons can split the load
const CITIES_BATCH_0 = [
  'Toronto, Ontario',
  'Vancouver, British Columbia',
  'Calgary, Alberta',
  'Edmonton, Alberta',
  'Winnipeg, Manitoba',
  'Ottawa, Ontario',
  'Hamilton, Ontario',
  'Halifax, Nova Scotia',
];
const CITIES_BATCH_1 = [
  'Montreal, Quebec',
  'Regina, Saskatchewan',
  'Saskatoon, Saskatchewan',
  'Victoria, British Columbia',
  'Kelowna, British Columbia',
  'London, Ontario',
  'Windsor, Ontario',
  'Moncton, New Brunswick',
];

const CITY_PROVINCE = {
  'Toronto': 'ON', 'Ottawa': 'ON', 'Hamilton': 'ON', 'Mississauga': 'ON',
  'Brampton': 'ON', 'London': 'ON', 'Kitchener': 'ON', 'Windsor': 'ON',
  'Barrie': 'ON', 'Sudbury': 'ON', 'Thunder Bay': 'ON', 'Oakville': 'ON',
  'Vancouver': 'BC', 'Surrey': 'BC', 'Burnaby': 'BC', 'Victoria': 'BC',
  'Kelowna': 'BC', 'Abbotsford': 'BC', 'Richmond': 'BC', 'Kamloops': 'BC',
  'Calgary': 'AB', 'Edmonton': 'AB', 'Red Deer': 'AB', 'Lethbridge': 'AB',
  'Fort McMurray': 'AB',
  'Regina': 'SK', 'Saskatoon': 'SK',
  'Winnipeg': 'MB', 'Brandon': 'MB',
  'Montreal': 'QC', 'Quebec City': 'QC', 'Laval': 'QC', 'Gatineau': 'QC',
  'Sherbrooke': 'QC',
  'Halifax': 'NS', 'Moncton': 'NB', 'Fredericton': 'NB', 'Saint John': 'NB',
  "St. John's": 'NL', 'Charlottetown': 'PE',
};

// Domains to skip when building guessed email / scraping
const SKIP_DOMAINS = [
  'google', 'facebook', 'instagram', 'linkedin', 'twitter', 'yelp',
  'yellowpages', 'homestars', 'homeadvisor', 'kijiji', 'houzz', 'bbb',
  'angieslist', 'thumbtack', 'bark.com', 'wikipedia', 'youtube',
];

// Max results to fetch Details for per trade+city combo
const MAX_DETAILS_PER_COMBO = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeId(name, city) {
  const str = (name + '|' + (city || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return 'goog_' + (h >>> 0).toString(36);
}

function cityOnly(cityStr) {
  // "Toronto, Ontario" → "Toronto"
  return (cityStr || '').split(',')[0].trim();
}

function isSkippableDomain(url) {
  if (!url) return true;
  try {
    const host = new URL(url.startsWith('http') ? url : 'https://' + url)
      .hostname.replace(/^www\./, '').toLowerCase();
    return SKIP_DOMAINS.some(s => host.includes(s));
  } catch { return true; }
}

function guessEmail(website) {
  if (!website || isSkippableDomain(website)) return '';
  try {
    const host = new URL(website.startsWith('http') ? website : 'https://' + website)
      .hostname.replace(/^www\./, '').toLowerCase();
    if (!host || !host.includes('.')) return '';
    return 'info@' + host;
  } catch { return ''; }
}

/** Extract the first Canadian phone number from a blob of text */
function extractPhone(text) {
  if (!text) return '';
  const m = text.match(/(\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]([2-9]\d{2})[\s.\-](\d{4})/);
  return m ? m[0].trim() : '';
}

/** Extract email addresses from text; skip common noreply/social patterns */
function extractEmails(text) {
  if (!text) return [];
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const skipPrefixes = ['noreply', 'no-reply', 'donotreply', 'mailer', 'bounce', 'postmaster'];
  return [...new Set((text.match(re) || []).filter(e => {
    const lc = e.toLowerCase();
    if (skipPrefixes.some(p => lc.startsWith(p))) return false;
    if (SKIP_DOMAINS.some(s => lc.includes(s))) return false;
    return true;
  }))];
}

/** Pull text from specific HTML meta tags */
function extractMeta(html, property) {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${property}["'][^>]+content=["']([^"']{1,500})["']`,
    'i'
  );
  const m = html.match(re) || html.match(
    new RegExp(`<meta[^>]+content=["']([^"']{1,500})["'][^>]+(?:name|property)=["']${property}["']`, 'i')
  );
  return m ? m[1].trim() : '';
}

/** Parse JSON-LD blocks from HTML, return all LocalBusiness objects */
function parseJsonLd(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const results = [];
  for (const m of html.matchAll(re)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item) continue;
        const graph = item['@graph'] || [item];
        for (const node of graph) {
          const t = node['@type'] || '';
          if (/LocalBusiness|Organization|Corporation|Contractor|Electrician|Plumber|HVACBusiness|RoofingContractor|GeneralContractor|HomeAndConstruction/i.test(t)) {
            results.push(node);
          }
        }
      }
    } catch { /* skip malformed blocks */ }
  }
  return results;
}

/** Extract description from the page — prefer JSON-LD, then OG, then meta */
function extractDescription(html, jsonLdItems) {
  if (jsonLdItems.length > 0) {
    const desc = jsonLdItems.map(n => n.description || '').find(d => d.length > 20);
    if (desc) return desc.replace(/<[^>]+>/g, '').slice(0, 400).trim();
  }
  const og  = extractMeta(html, 'og:description');
  const std = extractMeta(html, 'description');
  return (og || std).replace(/<[^>]+>/g, '').slice(0, 400).trim();
}

/** Extract certifications / licences from visible text (regex keywords) */
function extractCertifications(text) {
  const patterns = [
    /ESA\s*licence/i, /TSSA/i, /Red\s*Seal/i, /Journeyman/i,
    /Master\s*(Electrician|Plumber|HVAC)/i, /WSIB/i, /COR/i,
    /ISO\s*\d{4,5}/i, /SMACNA/i, /NFPA/i, /ASHRAE/i, /LEED/i,
    /TSSA\s*certified/i, /ECRA/i, /MEP/i,
  ];
  const certs = [];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) certs.push(m[0].replace(/\s+/g, ' ').trim());
  }
  return [...new Set(certs)].slice(0, 6);
}

/** Fetch a URL with timeout; return HTML string or null */
async function fetchHtml(url, timeoutMs = 7000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; BookYourTradesBot/1.0; +https://bookyourtrades.com)',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-CA,en;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('html') && !ct.includes('text')) return null;
    return await r.text();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── Website enrichment ───────────────────────────────────────────────────────

/**
 * Visits the company's own website (homepage, then /contact if needed) and
 * extracts: email, phone, description, certifications, years in business.
 * Always prefers website-sourced data over the Google listing.
 */
async function enrichFromWebsite(website) {
  const result = {
    email: '', phone: '', description: '', certifications: [], yearsInBusiness: '',
    websiteVerified: false,
  };
  if (!website || isSkippableDomain(website)) return result;

  const base = website.replace(/\/$/, '');

  // 1 ── Fetch homepage
  const homeHtml = await fetchHtml(base, 8000);
  if (!homeHtml) return result;

  result.websiteVerified = true;
  const ldItems = parseJsonLd(homeHtml);

  // Phone — JSON-LD first, then text regex
  const ldPhone = (ldItems.find(n => n.telephone) || {}).telephone || '';
  result.phone = ldPhone || extractPhone(homeHtml);

  // Email — JSON-LD first, then mailto links, then text regex
  const ldEmail = (ldItems.find(n => n.email) || {}).email || '';
  if (ldEmail && !isSkippableDomain(ldEmail)) {
    result.email = ldEmail.toLowerCase();
  } else {
    const mailtoRe = /href=["']mailto:([^"'?\s]+)["']/gi;
    const mailtoMatches = [...homeHtml.matchAll(mailtoRe)].map(m => m[1]);
    const extracted = extractEmails(homeHtml);
    const allEmails = [...new Set([...mailtoMatches, ...extracted])];
    result.email = allEmails.find(e => !e.includes('example') && !e.includes('test')) || '';
  }

  // Description
  result.description = extractDescription(homeHtml, ldItems);

  // Certifications
  result.certifications = extractCertifications(homeHtml);

  // Years in business
  const yrMatch = homeHtml.match(/(?:serving|in\s+business|established|since|founded)\s+(?:for\s+)?(\d+)\s*\+?\s*years?/i)
    || homeHtml.match(/(\d+)\s*\+?\s*years?\s+(?:of\s+)?(?:experience|in\s+business|serving)/i);
  if (yrMatch) result.yearsInBusiness = yrMatch[1] + '+ years';

  // 2 ── If no email yet, try /contact page
  if (!result.email) {
    const contactUrls = [base + '/contact', base + '/contact-us', base + '/about'];
    for (const cu of contactUrls) {
      const html = await fetchHtml(cu, 5000);
      if (!html) continue;
      const mailtoMatches2 = [...html.matchAll(/href=["']mailto:([^"'?\s]+)["']/gi)].map(m => m[1]);
      const extracted2 = extractEmails(html);
      const found = [...new Set([...mailtoMatches2, ...extracted2])]
        .find(e => !e.includes('example') && !e.includes('test'));
      if (found) { result.email = found; break; }
    }
  }

  return result;
}

// ── Google Places API ─────────────────────────────────────────────────────────

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

/** Text search: find place IDs matching "trade query city Canada" */
async function placesTextSearch(tradeQuery, city, apiKey) {
  const q   = encodeURIComponent(`${tradeQuery} ${city} Canada`);
  const url = `${PLACES_BASE}/textsearch/json?query=${q}&region=ca&key=${apiKey}`;

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return [];
    const data = await r.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[scrape-google] Places text search status:', data.status, data.error_message || '');
    }
    return (data.results || []).slice(0, MAX_DETAILS_PER_COMBO * 2); // grab extra to filter
  } catch {
    clearTimeout(timer);
    return [];
  }
}

/** Place Details: get website, phone, rating for a single place_id */
async function placeDetails(placeId, apiKey) {
  const fields = 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,business_status';
  const url = `${PLACES_BASE}/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const data = await r.json();
    if (data.status !== 'OK') return null;
    return data.result || null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── Per-trade-city fetch + enrichment ────────────────────────────────────────

async function fetchAndEnrich(tradeObj, cityStr, apiKey) {
  const city = cityOnly(cityStr);

  // 1. Text search
  const searchResults = await placesTextSearch(tradeObj.query, cityStr, apiKey);
  if (searchResults.length === 0) return [];

  // Take top N by result order (Google ranks by relevance/proximity)
  const top = searchResults.slice(0, MAX_DETAILS_PER_COMBO);

  // 2. Fetch Details for each (in parallel)
  const detailsSettled = await Promise.allSettled(
    top.map(r => placeDetails(r.place_id, apiKey))
  );

  const companies = [];

  for (let i = 0; i < top.length; i++) {
    const search  = top[i];
    const details = detailsSettled[i].status === 'fulfilled' ? detailsSettled[i].value : null;

    if (!search.name) continue;

    // Parse address from Google
    const addrParts = (details?.formatted_address || search.formatted_address || '').split(',');
    const parsedCity     = addrParts.length >= 3 ? addrParts[addrParts.length - 3].trim() : city;
    const parsedProvRaw  = addrParts.length >= 2 ? addrParts[addrParts.length - 2].trim() : '';
    const parsedProv     = CITY_PROVINCE[parsedCity] || parsedProvRaw.replace(/\s+\w{5}\d\w{3}.*$/, '').trim().toUpperCase().slice(0, 2) || '';

    const website = details?.website || '';
    const googlePhone = (details?.formatted_phone_number || '').replace(/[^\d+\-() ]/g, '').trim();

    // 3. Enrich from company's own website
    const enriched = await enrichFromWebsite(website);

    // Merge — website data wins over Google listing data for contact info
    const phone = enriched.phone || googlePhone;
    const email = enriched.email || guessEmail(website);
    const desc  = enriched.description || `${tradeObj.trade} contractor serving ${parsedCity}${parsedProv ? ', ' + parsedProv : ''}.`;

    if (!parsedCity && !city) continue; // skip if no location at all

    companies.push({
      id:              makeId(search.name, parsedCity || city),
      companyName:     search.name,
      tradeType:       tradeObj.trade,
      icon:            tradeObj.icon,
      phone,
      email,
      website,
      description:     desc,
      serviceAreas:    [parsedCity || city],
      city:            parsedCity || city,
      province:        parsedProv || CITY_PROVINCE[city] || '',
      rating:          details?.rating || (search.rating || 0),
      reviewCount:     details?.user_ratings_total || (search.user_ratings_total || 0),
      featured:        false,
      claimed:         false,
      plan:            'free',
      source:          'Google Places',
      websiteVerified: enriched.websiteVerified,
      certifications:  enriched.certifications,
      yearsInBusiness: enriched.yearsInBusiness,
      licenseNumber:   '',
    });
  }

  return companies;
}

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Cache 24 h at edge, serve stale up to 2 h while revalidating
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=7200');

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      companies: [], total: 0, note: 'GOOGLE_PLACES_API_KEY not configured',
      fetched: new Date().toISOString(),
    });
  }

  // Query param filters
  const tradeParam = (req.query?.trade || '').toLowerCase().trim();
  const cityParam  = (req.query?.city  || '').trim();
  const batchParam = parseInt(req.query?.batch || '0', 10);

  const tradesToRun = tradeParam
    ? TRADES.filter(t => t.trade.toLowerCase().includes(tradeParam))
    : TRADES;

  let citiesToRun;
  if (cityParam) {
    citiesToRun = [cityParam];
  } else {
    citiesToRun = batchParam === 1 ? CITIES_BATCH_1 : CITIES_BATCH_0;
  }

  console.log(`[scrape-google] ${tradesToRun.length} trades × ${citiesToRun.length} cities`);

  // Fan out — all trade+city combos concurrently
  // Vercel Pro functions get 60s; Hobby gets 10s.
  // At 14 trades × 8 cities = 112 combos each doing ~3 fetches (search+details+website):
  // too many for one call → chunk by city to keep function duration sane.
  const allSettled = await Promise.allSettled(
    citiesToRun.flatMap(city =>
      tradesToRun.map(trade => fetchAndEnrich(trade, city, apiKey))
    )
  );

  let companies = allSettled
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Deduplicate by normalized name + city (website-enriched entries win — they're sorted first)
  companies.sort((a, b) => {
    const score = c =>
      (c.websiteVerified ? 8 : 0) +
      (c.email ? 4 : 0) +
      (c.phone ? 2 : 0) +
      (c.description?.length > 50 ? 1 : 0);
    return score(b) - score(a);
  });

  const seen = new Set();
  companies = companies.filter(c => {
    const key = c.companyName.toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + (c.city || '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[scrape-google] returning ${companies.length} unique companies`);

  return res.status(200).json({
    companies,
    total:    companies.length,
    trades:   tradesToRun.length,
    cities:   citiesToRun,
    fetched:  new Date().toISOString(),
    source:   'Google Places API + Website Enrichment',
  });
};
