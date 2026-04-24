/**
 * Aggregator — calls all scraper sources in parallel and returns a merged,
 * deduplicated list of Canadian trade contractors.
 *
 * GET /api/scrape-all            — all major cities, all trades
 * GET /api/scrape-all?cities=3   — limit to top N cities (default 8)
 *
 * Sources:
 *   1. Yellow Pages Canada (/api/scrape-yellowpages) — primary, has phones + emails
 *   2. OpenStreetMap via Overpass API               — secondary, has lat/lng
 *
 * Edge-cached 24 h. A Vercel Cron hits this daily to keep cache warm.
 * On a Vercel Pro plan add to vercel.json crons:
 *   { "path": "/api/scrape-all", "schedule": "0 5 * * *" }
 */

const BASE_URL = process.env.VERCEL_URL
  ? 'https://' + process.env.VERCEL_URL
  : 'http://localhost:3000';

// Cities to scrape — ordered by population / trade-market size
const CITIES = [
  'Toronto', 'Vancouver', 'Calgary', 'Edmonton', 'Montreal',
  'Ottawa', 'Winnipeg', 'Hamilton', 'Halifax', 'Regina',
  'Saskatoon', 'Victoria', 'Kelowna', 'London', 'Windsor',
  'Mississauga', 'Brampton', 'Surrey', 'Burnaby', 'Quebec City',
];

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const OSM_TAGS = [
  ['craft',  'electrician'],  ['craft',  'plumber'],
  ['craft',  'hvac_technician'], ['craft', 'roofer'],
  ['craft',  'welder'],       ['craft',  'carpenter'],
  ['craft',  'pipefitter'],   ['craft',  'mason'],
  ['craft',  'bricklayer'],   ['trade',  'electrician'],
  ['trade',  'plumber'],      ['trade',  'carpenter'],
  ['shop',   'electrical'],   ['shop',   'plumber'],
  ['office', 'construction_company'],
];

const TRADE_BY_TAG = {
  electrician: 'Electrical', plumber: 'Plumbing', hvac_technician: 'HVAC',
  roofer: 'Roofing', welder: 'Welding & Fabrication', carpenter: 'Carpentry',
  pipefitter: 'Pipefitting', mason: 'Concrete & Masonry', bricklayer: 'Concrete & Masonry',
  electrical: 'Electrical', construction_company: 'General Contracting',
};

const TRADE_ICONS = {
  'Electrical':'⚡','Plumbing':'🔧','HVAC':'🌡️','Roofing':'🏚️',
  'Welding & Fabrication':'⚙️','Carpentry':'🪚','General Contracting':'🏗️',
  'Sheet Metal':'🔨','Concrete & Masonry':'🧱','Millwright':'🔩',
  'Pipefitting':'🛢️','Refrigeration':'❄️','Painting & Coating':'🎨',
};

const PROVINCE_MAP = {
  'Toronto':'ON','Ottawa':'ON','Hamilton':'ON','Mississauga':'ON','Brampton':'ON',
  'London':'ON','Kitchener':'ON','Windsor':'ON','Barrie':'ON','Sudbury':'ON',
  'Vancouver':'BC','Surrey':'BC','Burnaby':'BC','Victoria':'BC','Kelowna':'BC',
  'Calgary':'AB','Edmonton':'AB','Red Deer':'AB','Lethbridge':'AB',
  'Regina':'SK','Saskatoon':'SK',
  'Winnipeg':'MB','Brandon':'MB',
  'Montreal':'QC','Quebec City':'QC','Laval':'QC','Gatineau':'QC',
  'Halifax':'NS','Moncton':'NB','Fredericton':'NB','Saint John':'NB',
};

function makeId(name, city) {
  const str = (name + '|' + city).toLowerCase().replace(/[^a-z0-9]/g, '');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return 'osm_' + (h >>> 0).toString(36);
}

function guessEmail(website) {
  if (!website) return '';
  try {
    const raw = website.trim().replace(/^\/\//, 'https://');
    const url = new URL(raw.startsWith('http') ? raw : 'https://' + raw);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const skip = ['yellowpages','facebook','instagram','linkedin','twitter',
                  'yelp','google','homeadvisor','homestars','kijiji'];
    if (skip.some(s => host.includes(s))) return '';
    if (!host.includes('.')) return '';
    return 'info@' + host;
  } catch { return ''; }
}

// ── OSM scraper ──────────────────────────────────────────────────────────────
async function fetchOSM() {
  const bbox = '41.67,-141.01,83.11,-52.62'; // Canada bounding box
  const nodeFilters = OSM_TAGS
    .map(([k, v]) => `node["${k}"="${v}"]["name"](${bbox});`)
    .join('\n  ');

  const query = `[out:json][timeout:30];\n(\n  ${nodeFilters}\n);\nout body 200;`;
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 28000);
  try {
    const r = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const json = await r.json();
    return (json.elements || []).map(el => {
      const t  = el.tags || {};
      const name = t.name || t['name:en'];
      if (!name) return null;
      const tagKey = Object.keys(t).find(k => OSM_TAGS.some(([tk]) => tk === k) && TRADE_BY_TAG[t[k]]);
      const trade  = tagKey ? (TRADE_BY_TAG[t[tagKey]] || 'General Contracting') : 'General Contracting';
      const city   = t['addr:city'] || t['addr:town'] || '';
      const prov   = (t['addr:province'] || t['addr:state'] || '').replace(/^CA-/, '');
      const web    = t.website || t['contact:website'] || '';
      const phone  = (t.phone || t['contact:phone'] || '').replace(/^tel:/, '');
      const email  = t.email || t['contact:email'] || guessEmail(web);
      const areas  = city ? [city] : (prov ? [prov] : ['Canada']);
      return {
        id: makeId(name, city || prov),
        companyName: name, tradeType: trade,
        icon: TRADE_ICONS[trade] || '🔧',
        phone, email, website: web,
        description: t.description || `${trade} contractor — ${areas[0]}.`,
        serviceAreas: areas, city, province: prov,
        lat: el.lat, lng: el.lon,
        rating: 0, reviewCount: 0,
        featured: false, claimed: false, plan: 'free',
        source: 'OpenStreetMap',
        yearsInBusiness: '', certifications: [], licenseNumber: '',
      };
    }).filter(Boolean);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ── Yellow Pages scraper (calls internal /api/scrape-yellowpages) ─────────────
async function fetchYP(city) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${BASE_URL}/api/scrape-yellowpages?city=${encodeURIComponent(city)}`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const data = await r.json();
    return data.companies || [];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=7200');

  const maxCities = Math.min(parseInt(req.query?.cities || '8', 10), CITIES.length);
  const citiesToFetch = CITIES.slice(0, maxCities);

  // Run all scrapers concurrently
  const [osmResult, ...ypResults] = await Promise.allSettled([
    fetchOSM(),
    ...citiesToFetch.map(city => fetchYP(city)),
  ]);

  let companies = [
    ...(osmResult.status === 'fulfilled' ? osmResult.value : []),
    ...ypResults.flatMap(r => r.status === 'fulfilled' ? r.value : []),
  ];

  // Deduplicate — prefer entries with more contact info
  // Sort by contact richness first so richer entries win dedup
  companies.sort((a, b) => {
    const s = c => (c.phone ? 4 : 0) + (c.email ? 2 : 0) + (c.website ? 1 : 0);
    return s(b) - s(a);
  });

  const seen = new Set();
  companies = companies.filter(c => {
    const key = c.companyName.toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + c.city.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Fill province from city lookup if missing
  companies = companies.map(c => ({
    ...c,
    province: c.province || PROVINCE_MAP[c.city] || '',
  }));

  return res.status(200).json({
    companies,
    total:   companies.length,
    cities:  citiesToFetch,
    fetched: new Date().toISOString(),
    sources: ['Yellow Pages Canada', 'OpenStreetMap'],
  });
};
