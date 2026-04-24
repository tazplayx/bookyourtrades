/**
 * Vercel serverless function — scrapes Yellow Pages Canada for trade businesses.
 *
 * GET /api/scrape-yellowpages?city=Toronto
 * GET /api/scrape-yellowpages?city=Vancouver&trade=Electrical
 *
 * Returns structured company objects with phone, guessed email, address, website.
 * Edge-cached 24 hours. Falls back gracefully if YP blocks the request.
 *
 * Email strategy: if a business has a website (e.g. voltpro.ca),
 * we construct info@voltpro.ca so auto-lead emails can fire immediately.
 */

const TRADE_KEYWORDS = [
  { trade: 'Electrical',            icon: '⚡',  kw: 'electricians'            },
  { trade: 'Plumbing',              icon: '🔧',  kw: 'plumbers'                },
  { trade: 'HVAC',                  icon: '🌡️', kw: 'heating-air-conditioning' },
  { trade: 'Roofing',               icon: '🏚️', kw: 'roofing-contractors'      },
  { trade: 'Welding & Fabrication', icon: '⚙️',  kw: 'welding'                 },
  { trade: 'Carpentry',             icon: '🪚',  kw: 'carpenters'              },
  { trade: 'General Contracting',   icon: '🏗️', kw: 'general-contractors'      },
  { trade: 'Sheet Metal',           icon: '🔨',  kw: 'sheet-metal-contractors' },
  { trade: 'Concrete & Masonry',    icon: '🧱',  kw: 'concrete-contractors'    },
  { trade: 'Millwright',            icon: '🔩',  kw: 'millwrights'             },
  { trade: 'Pipefitting',           icon: '🛢️', kw: 'pipefitters'             },
  { trade: 'Refrigeration',         icon: '❄️',  kw: 'refrigeration-contractors'},
  { trade: 'Painting & Coating',    icon: '🎨',  kw: 'painting-contractors'    },
  { trade: 'Flooring',              icon: '🪵',  kw: 'flooring-contractors'    },
  { trade: 'Insulation',            icon: '🏠',  kw: 'insulation-contractors'  },
];

const CITY_PROVINCE = {
  'Toronto':'ON','Ottawa':'ON','Hamilton':'ON','Mississauga':'ON','Brampton':'ON',
  'London':'ON','Kitchener':'ON','Windsor':'ON','Barrie':'ON','Sudbury':'ON',
  'Vancouver':'BC','Surrey':'BC','Burnaby':'BC','Victoria':'BC','Kelowna':'BC',
  'Abbotsford':'BC','Richmond':'BC','Kamloops':'BC',
  'Calgary':'AB','Edmonton':'AB','Red Deer':'AB','Lethbridge':'AB','Fort McMurray':'AB',
  'Regina':'SK','Saskatoon':'SK',
  'Winnipeg':'MB','Brandon':'MB',
  'Montreal':'QC','Quebec City':'QC','Laval':'QC','Gatineau':'QC','Sherbrooke':'QC',
  'Halifax':'NS','Moncton':'NB','Fredericton':'NB','Saint John':'NB',
  "St. John's":'NL','Charlottetown':'PE',
};

// Make a stable, repeatable ID from name+city
function makeId(name, city) {
  const str = (name + '|' + city).toLowerCase().replace(/[^a-z0-9]/g, '');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return 'yp_' + (h >>> 0).toString(36);
}

// Derive a likely contact email from a business website URL
function guessEmail(website) {
  if (!website || typeof website !== 'string') return '';
  try {
    const raw = website.trim().replace(/^\/\//, 'https://');
    const url = new URL(raw.startsWith('http') ? raw : 'https://' + raw);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    // Skip social / aggregator domains
    const skip = ['yellowpages.ca','facebook.com','instagram.com','linkedin.com',
                   'twitter.com','yelp.ca','yelp.com','google.com','homeadvisor.com',
                   'homestars.com','kijiji.ca','indeed.com'];
    if (skip.some(s => host.includes(s))) return '';
    if (!host || !host.includes('.')) return '';
    return 'info@' + host;
  } catch { return ''; }
}

// Pull LocalBusiness items out of any JSON-LD structure
function extractLocalBusinesses(data) {
  if (!data || typeof data !== 'object') return [];
  const type = data['@type'];

  if (type === 'LocalBusiness' || type === 'HomeAndConstructionBusiness'
      || type === 'Electrician' || type === 'Plumber' || type === 'GeneralContractor'
      || type === 'HVACBusiness' || type === 'RoofingContractor') {
    return [data];
  }
  if (type === 'ItemList' && Array.isArray(data.itemListElement)) {
    return data.itemListElement
      .map(i => (i.item || i))
      .filter(i => i['@type'] && i['@type'] !== 'ListItem');
  }
  if (Array.isArray(data)) {
    return data.flatMap(extractLocalBusinesses);
  }
  // Nested graph
  if (data['@graph']) return extractLocalBusinesses(data['@graph']);
  return [];
}

function mapBusiness(b, tradeObj, city) {
  const name = (b.name || '').trim();
  if (!name || name.length < 2) return null;

  const addr     = b.address || {};
  const bizCity  = (addr.addressLocality || city || '').trim();
  const province = (addr.addressRegion   || CITY_PROVINCE[bizCity] || '').replace(/^CA-/, '').trim();
  const phone    = (b.telephone || '').replace(/[^\d+\-() ]/g, '').trim();
  const website  = (b.url || b.sameAs || '').trim();
  const email    = (b.email || guessEmail(website)).trim().toLowerCase();
  const desc     = (b.description || '').replace(/<[^>]+>/g, '').trim();
  const ratingV  = parseFloat(b.aggregateRating?.ratingValue  || 0);
  const ratingC  = parseInt(b.aggregateRating?.reviewCount    || 0, 10);

  if (!bizCity) return null; // skip entries with no location

  return {
    id:          makeId(name, bizCity),
    companyName: name,
    tradeType:   tradeObj.trade,
    icon:        tradeObj.icon,
    phone,
    email,
    website,
    description: desc || `${tradeObj.trade} contractor serving ${bizCity}${province ? ', ' + province : ''}.`,
    serviceAreas:[bizCity],
    city:        bizCity,
    province,
    rating:      ratingV,
    reviewCount: ratingC,
    featured:    false,
    claimed:     false,
    plan:        'free',
    source:      'Yellow Pages Canada',
    yearsInBusiness: '',
    certifications: [],
    licenseNumber: '',
  };
}

// HTML fallback — extract name/phone pairs when JSON-LD is absent/empty
function parseHtmlFallback(html, tradeObj, city) {
  const results = [];

  // Yellow Pages listing link pattern: /bus/Ontario/Toronto/Volt-Pro-Electrical/
  const linkRe = /href="(\/bus\/[^"]+)"[^>]*>([^<]{3,80})<\/a>/gi;
  const phoneRe = /(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/g;

  const names  = [...html.matchAll(linkRe)].map(m => m[2].trim()).filter(n => n.length > 2);
  const phones = [...html.matchAll(phoneRe)].map(m => m[1].trim());

  for (let i = 0; i < Math.min(names.length, 30); i++) {
    results.push({
      id:          makeId(names[i], city),
      companyName: names[i],
      tradeType:   tradeObj.trade,
      icon:        tradeObj.icon,
      phone:       phones[i] || '',
      email:       '',
      website:     '',
      description: `${tradeObj.trade} contractor serving ${city}.`,
      serviceAreas:[city],
      city,
      province:    CITY_PROVINCE[city] || '',
      rating:      0,
      reviewCount: 0,
      featured:    false,
      claimed:     false,
      plan:        'free',
      source:      'Yellow Pages Canada',
      yearsInBusiness: '',
      certifications: [],
      licenseNumber: '',
    });
  }
  return results;
}

async function fetchYPPage(tradeObj, city) {
  const kw  = encodeURIComponent(tradeObj.kw);
  const loc = encodeURIComponent(city);
  const url = `https://www.yellowpages.ca/search/si/1/${kw}/${loc}`;

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-CA,en;q=0.9',
        'Cache-Control':   'no-cache',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const html = await res.text();

    // 1. Try JSON-LD extraction (most reliable)
    const jsonLdRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const businesses = [];
    for (const m of html.matchAll(jsonLdRe)) {
      try {
        const parsed = JSON.parse(m[1].trim());
        businesses.push(...extractLocalBusinesses(parsed));
      } catch {}
    }
    if (businesses.length > 0) {
      return businesses.map(b => mapBusiness(b, tradeObj, city)).filter(Boolean);
    }

    // 2. HTML fallback
    return parseHtmlFallback(html, tradeObj, city);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Cache 24 h at CDN edge, serve stale while revalidating for up to 2 h
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=7200');

  const cityParam  = (req.query?.city  || 'Toronto').trim();
  const tradeParam = (req.query?.trade || '').toLowerCase().trim();

  const tradesToFetch = tradeParam
    ? TRADE_KEYWORDS.filter(t => t.trade.toLowerCase().includes(tradeParam))
    : TRADE_KEYWORDS;

  // Fetch all trades for this city concurrently
  const settled = await Promise.allSettled(
    tradesToFetch.map(t => fetchYPPage(t, cityParam))
  );

  let companies = settled
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Deduplicate by id
  const seen = new Set();
  companies = companies.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  // Sort: listings with phone first, then email, then website
  companies.sort((a, b) => {
    const score = c => (c.phone ? 4 : 0) + (c.email ? 2 : 0) + (c.website ? 1 : 0);
    return score(b) - score(a);
  });

  return res.status(200).json({
    companies,
    total:   companies.length,
    city:    cityParam,
    fetched: new Date().toISOString(),
    source:  'Yellow Pages Canada',
  });
};
