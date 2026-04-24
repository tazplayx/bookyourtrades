/**
 * Vercel serverless function — fetches real Canadian trade businesses from
 * OpenStreetMap via the Overpass API.  No API key required.
 *
 * GET /api/scrape-companies              — all trades
 * GET /api/scrape-companies?trade=hvac   — filter by trade keyword
 *
 * Results are edge-cached for 24 hours on Vercel's CDN.
 * A daily Vercel Cron (see vercel.json) keeps the cache warm.
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const TRADE_QUERIES = [
  {
    trade: 'Electrical', icon: '⚡',
    tags: ['craft=electrician', 'shop=electrical', 'trade=electrician'],
  },
  {
    trade: 'Plumbing', icon: '🔧',
    tags: ['craft=plumber', 'trade=plumber', 'shop=plumber'],
  },
  {
    trade: 'HVAC', icon: '🌡️',
    tags: ['craft=hvac_technician', 'trade=hvac', 'shop=hvac'],
  },
  {
    trade: 'Roofing', icon: '🏚️',
    tags: ['craft=roofer', 'trade=roofer'],
  },
  {
    trade: 'Welding & Fabrication', icon: '⚙️',
    tags: ['craft=welder', 'trade=welder'],
  },
  {
    trade: 'Carpentry', icon: '🪚',
    tags: ['craft=carpenter', 'trade=carpenter', 'shop=carpenter'],
  },
  {
    trade: 'General Contracting', icon: '🏗️',
    tags: ['craft=construction_worker', 'office=construction_company'],
  },
  {
    trade: 'Pipefitting', icon: '🛢️',
    tags: ['craft=pipefitter', 'trade=pipefitter'],
  },
  {
    trade: 'Sheet Metal', icon: '🔨',
    tags: ['craft=sheetmetal_worker', 'trade=sheet_metal_worker'],
  },
  {
    trade: 'Concrete & Masonry', icon: '🧱',
    tags: ['craft=mason', 'craft=bricklayer', 'trade=concrete_worker'],
  },
];

const PROVINCE_ABBR = {
  'Alberta': 'AB', 'British Columbia': 'BC', 'Manitoba': 'MB',
  'New Brunswick': 'NB', 'Newfoundland and Labrador': 'NL', 'Nova Scotia': 'NS',
  'Ontario': 'ON', 'Prince Edward Island': 'PE', 'Quebec': 'QC',
  'Saskatchewan': 'SK', 'Northwest Territories': 'NT', 'Nunavut': 'NU', 'Yukon': 'YT',
  // Short form already
  'AB':'AB','BC':'BC','MB':'MB','NB':'NB','NL':'NL','NS':'NS',
  'ON':'ON','PE':'PE','QC':'QC','SK':'SK','NT':'NT','NU':'NU','YT':'YT',
};

/** Build an Overpass QL query for a set of key=value tags, filtered to Canada */
function buildQuery(tradeObj) {
  // Use Canada's ISO bounding box — roughly (42°N 52°E) to (83°N 141°W)
  const bbox = '41.67,-141.01,83.11,-52.62';
  const nodeFilters = tradeObj.tags
    .map(tag => {
      const [k, v] = tag.split('=');
      return `node["${k}"="${v}"]["name"](${bbox});`;
    })
    .join('\n  ');

  return `[out:json][timeout:25];
(
  ${nodeFilters}
);
out body 60;`;
}

async function fetchOverpass(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = await res.json();
    return json.elements || [];
  } catch (e) {
    clearTimeout(timer);
    return [];
  }
}

function mapElement(el, tradeObj) {
  const t = el.tags || {};
  const name = t.name || t['name:en'];
  if (!name) return null;

  const phone   = (t.phone || t['contact:phone'] || t['contact:mobile'] || '').replace(/^tel:/, '');
  const website = t.website || t['contact:website'] || '';
  const email   = t.email   || t['contact:email']   || '';
  const city    = t['addr:city'] || t['addr:town'] || '';
  const provRaw = t['addr:province'] || t['addr:state'] || '';
  const province = PROVINCE_ABBR[provRaw] || provRaw.toUpperCase().slice(0, 2);

  const serviceAreas = city ? [city] : (province ? [province] : ['Canada']);

  return {
    id:          'osm_' + el.id,
    companyName: name,
    tradeType:   tradeObj.trade,
    icon:        tradeObj.icon,
    phone,
    email,
    website,
    description: t.description || `${tradeObj.trade} contractor — ${serviceAreas[0] || 'Canada'}.`,
    serviceAreas,
    city,
    province,
    lat:         el.lat,
    lng:         el.lon,
    rating:      0,
    reviewCount: 0,
    featured:    false,
    claimed:     false,
    plan:        'free',
    source:      'OpenStreetMap',
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Cache 24 hours at the edge; serve stale for up to 2 hours while revalidating
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=7200');

  const tradeFilter = (req.query?.trade || '').toLowerCase().trim();
  const tradesToFetch = tradeFilter
    ? TRADE_QUERIES.filter(t => t.trade.toLowerCase().includes(tradeFilter))
    : TRADE_QUERIES;

  // Fetch all trade feeds concurrently
  const settled = await Promise.allSettled(
    tradesToFetch.map(async t => {
      const elements = await fetchOverpass(buildQuery(t));
      return elements.map(el => mapElement(el, t)).filter(Boolean);
    })
  );

  let companies = settled
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Deduplicate by normalised name + city
  const seen = new Set();
  companies = companies.filter(c => {
    const key = (c.companyName + '|' + c.city).toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: companies with phone/email/website first (most useful leads)
  companies.sort((a, b) => {
    const scoreA = (a.phone ? 2 : 0) + (a.email ? 2 : 0) + (a.website ? 1 : 0);
    const scoreB = (b.phone ? 2 : 0) + (b.email ? 2 : 0) + (b.website ? 1 : 0);
    return scoreB - scoreA;
  });

  return res.status(200).json({
    companies,
    total:   companies.length,
    fetched: new Date().toISOString(),
    source:  'OpenStreetMap / Overpass API',
  });
};
