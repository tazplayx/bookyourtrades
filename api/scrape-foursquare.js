/**
 * Vercel serverless function — discovers Canadian trade companies via the
 * Foursquare Places API v3 (free tier: 1,000 calls/day), then enriches
 * each result by scraping the company's own website for email, phone,
 * description, and certifications.
 *
 * Environment variables:
 *   FOURSQUARE_API_KEY — from developer.foursquare.com (free account)
 *
 * GET /api/scrape-foursquare              — all trades, batch 0 cities
 * GET /api/scrape-foursquare?batch=1      — all trades, batch 1 cities
 * GET /api/scrape-foursquare?trade=hvac   — filter by trade
 *
 * Free tier usage estimate:
 *   14 trades × 8 cities = 112 calls/day per batch — well within 1,000/day
 *
 * Edge-cached 24 hours. Vercel Cron fires daily at 05:00 UTC.
 */

// ── Configuration ─────────────────────────────────────────────────────────────

const TRADES = [
  { trade: 'Boilermaker',           icon: '🔥', query: 'boilermaker contractor'            },
  { trade: 'Carpentry',             icon: '🪚', query: 'carpentry contractor'               },
  { trade: 'Concrete & Masonry',    icon: '🧱', query: 'concrete masonry contractor'        },
  { trade: 'Electrical',            icon: '⚡', query: 'electrical contractor'              },
  { trade: 'General Contracting',   icon: '🏗️', query: 'general contractor construction'   },
  { trade: 'HVAC',                  icon: '🌡️', query: 'HVAC heating cooling contractor'   },
  { trade: 'Millwright',            icon: '🔩', query: 'millwright industrial contractor'   },
  { trade: 'Painting & Coating',    icon: '🎨', query: 'commercial painting contractor'     },
  { trade: 'Pipefitting',           icon: '🛢️', query: 'pipefitting contractor'            },
  { trade: 'Plumbing',              icon: '🔧', query: 'plumbing contractor'               },
  { trade: 'Refrigeration',         icon: '❄️', query: 'refrigeration contractor'          },
  { trade: 'Roofing',               icon: '🏚️', query: 'roofing contractor commercial'     },
  { trade: 'Sheet Metal',           icon: '🔨', query: 'sheet metal contractor'            },
  { trade: 'Welding & Fabrication', icon: '⚙️', query: 'welding fabrication contractor'    },
];

const CITIES_0 = [
  'Toronto, Ontario, Canada',
  'Vancouver, British Columbia, Canada',
  'Calgary, Alberta, Canada',
  'Edmonton, Alberta, Canada',
  'Winnipeg, Manitoba, Canada',
  'Ottawa, Ontario, Canada',
  'Hamilton, Ontario, Canada',
  'Halifax, Nova Scotia, Canada',
];
const CITIES_1 = [
  'Montreal, Quebec, Canada',
  'Regina, Saskatchewan, Canada',
  'Saskatoon, Saskatchewan, Canada',
  'Victoria, British Columbia, Canada',
  'Kelowna, British Columbia, Canada',
  'London, Ontario, Canada',
  'Windsor, Ontario, Canada',
  'Moncton, New Brunswick, Canada',
];

const CITY_PROVINCE = {
  'Toronto':'ON','Ottawa':'ON','Hamilton':'ON','Mississauga':'ON','Brampton':'ON',
  'London':'ON','Kitchener':'ON','Windsor':'ON','Barrie':'ON','Sudbury':'ON',
  'Vancouver':'BC','Surrey':'BC','Burnaby':'BC','Victoria':'BC','Kelowna':'BC',
  'Abbotsford':'BC','Richmond':'BC','Kamloops':'BC',
  'Calgary':'AB','Edmonton':'AB','Red Deer':'AB','Lethbridge':'AB',
  'Regina':'SK','Saskatoon':'SK',
  'Winnipeg':'MB','Brandon':'MB',
  'Montreal':'QC','Quebec City':'QC','Laval':'QC','Gatineau':'QC',
  'Halifax':'NS','Moncton':'NB','Fredericton':'NB','Saint John':'NB',
  "St. John's":'NL','Charlottetown':'PE',
};

const SKIP_DOMAINS = [
  'foursquare','facebook','instagram','linkedin','twitter','yelp','google',
  'yellowpages','homestars','homeadvisor','kijiji','houzz','bbb','wikipedia',
  'youtube','tiktok','snapchat',
];

// ── Shared helpers ─────────────────────────────────────────────────────────────

function makeId(name, city) {
  const s = (name + '|' + (city||'')).toLowerCase().replace(/[^a-z0-9]/g,'');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return 'fsq_' + (h >>> 0).toString(36);
}

function cityOnly(s) { return (s||'').split(',')[0].trim(); }

function isSkippable(url) {
  if (!url) return true;
  try {
    const host = new URL(url.startsWith('http') ? url : 'https://'+url)
      .hostname.replace(/^www\./,'').toLowerCase();
    return SKIP_DOMAINS.some(d => host.includes(d));
  } catch { return true; }
}

function guessEmail(website) {
  if (!website || isSkippable(website)) return '';
  try {
    const host = new URL(website.startsWith('http') ? website : 'https://'+website)
      .hostname.replace(/^www\./,'').toLowerCase();
    return host.includes('.') ? 'info@'+host : '';
  } catch { return ''; }
}

function extractPhone(text) {
  if (!text) return '';
  const m = text.match(/(\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]([2-9]\d{2})[\s.\-](\d{4})/);
  return m ? m[0].trim() : '';
}

function extractEmails(text) {
  if (!text) return [];
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const bad = ['noreply','no-reply','donotreply','postmaster','bounce','example','test'];
  return [...new Set((text.match(re)||[]).filter(e => {
    const lc = e.toLowerCase();
    return !bad.some(b => lc.startsWith(b)) && !SKIP_DOMAINS.some(d => lc.includes(d));
  }))];
}

function extractMeta(html, prop) {
  const r1 = new RegExp(`<meta[^>]+(?:name|property)=["']${prop}["'][^>]+content=["']([^"']{1,500})["']`,'i');
  const r2 = new RegExp(`<meta[^>]+content=["']([^"']{1,500})["'][^>]+(?:name|property)=["']${prop}["']`,'i');
  const m = html.match(r1) || html.match(r2);
  return m ? m[1].trim() : '';
}

function parseJsonLd(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out = [];
  for (const m of html.matchAll(re)) {
    try {
      const p = JSON.parse(m[1].trim());
      const items = Array.isArray(p) ? p : [p];
      for (const item of items) {
        const nodes = item['@graph'] ? item['@graph'] : [item];
        for (const n of nodes) {
          if (/LocalBusiness|Organization|Contractor|Electrician|Plumber|HVAC|Roofing|Construction/i.test(n['@type']||''))
            out.push(n);
        }
      }
    } catch {}
  }
  return out;
}

function extractCerts(text) {
  const patterns = [
    /ESA\s*licen[sc]e/i, /TSSA/i, /Red\s*Seal/i, /Journeyman/i,
    /Master\s*(Electrician|Plumber|HVAC)/i, /WSIB/i, /\bCOR\b/,
    /ISO\s*\d{4,5}/i, /SMACNA/i, /NFPA/i, /ASHRAE/i, /LEED/i, /ECRA/i,
  ];
  return [...new Set(patterns.map(p => { const m = text.match(p); return m ? m[0].trim() : null; }).filter(Boolean))].slice(0,6);
}

async function fetchHtml(url, ms = 7000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BookYourTradesBot/1.0; +https://bookyourtrades.com)',
        'Accept': 'text/html,*/*;q=0.8',
        'Accept-Language': 'en-CA,en;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('html') && !ct.includes('text')) return null;
    return await r.text();
  } catch { clearTimeout(t); return null; }
}

// ── Website enrichment ────────────────────────────────────────────────────────

async function enrichFromWebsite(website) {
  const out = { email:'', phone:'', description:'', certifications:[], yearsInBusiness:'', websiteVerified:false };
  if (!website || isSkippable(website)) return out;

  const base = website.replace(/\/$/,'');
  const html  = await fetchHtml(base, 8000);
  if (!html) return out;

  out.websiteVerified = true;
  const ld = parseJsonLd(html);

  // Phone
  out.phone = (ld.find(n=>n.telephone)||{}).telephone || extractPhone(html);

  // Email — JSON-LD → mailto links → text scan
  const ldEmail = (ld.find(n=>n.email)||{}).email || '';
  if (ldEmail && !isSkippable(ldEmail)) {
    out.email = ldEmail.toLowerCase();
  } else {
    const mailtoHits = [...html.matchAll(/href=["']mailto:([^"'?\s]+)["']/gi)].map(m=>m[1]);
    const textHits   = extractEmails(html);
    out.email = [...new Set([...mailtoHits,...textHits])].find(e=>!e.includes('example')&&!e.includes('test')) || '';
  }

  // Description
  const ldDesc = (ld.map(n=>n.description||'').find(d=>d.length>20)||'');
  out.description = (ldDesc || extractMeta(html,'og:description') || extractMeta(html,'description'))
    .replace(/<[^>]+>/g,'').slice(0,400).trim();

  // Certifications
  out.certifications = extractCerts(html);

  // Years in business
  const ym = html.match(/(?:serving|in\s+business|established|since|founded)\s+(?:for\s+)?(\d+)\s*\+?\s*years?/i)
          || html.match(/(\d+)\s*\+?\s*years?\s+(?:of\s+)?(?:experience|in\s+business|serving)/i);
  if (ym) out.yearsInBusiness = ym[1]+' years';

  // Contact page fallback for email
  if (!out.email) {
    for (const path of ['/contact','/contact-us','/about']) {
      const chtml = await fetchHtml(base+path, 5000);
      if (!chtml) continue;
      const hits = [
        ...[...chtml.matchAll(/href=["']mailto:([^"'?\s]+)["']/gi)].map(m=>m[1]),
        ...extractEmails(chtml),
      ];
      const found = [...new Set(hits)].find(e=>!e.includes('example')&&!e.includes('test'));
      if (found) { out.email = found; break; }
    }
  }

  return out;
}

// ── Foursquare API ────────────────────────────────────────────────────────────

const FSQ_URL = 'https://api.foursquare.com/v3/places/search';
const FSQ_FIELDS = 'fsq_id,name,location,tel,website,rating,stats,categories';

async function fsqSearch(tradeObj, cityStr, apiKey) {
  const url = `${FSQ_URL}?query=${encodeURIComponent(tradeObj.query)}&near=${encodeURIComponent(cityStr)}&limit=50&fields=${FSQ_FIELDS}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Authorization': `fsq3${apiKey}`, 'Accept': 'application/json' },
    });
    clearTimeout(t);
    if (!r.ok) {
      console.warn('[scrape-foursquare] API error', r.status, await r.text().catch(()=>''));
      return [];
    }
    const data = await r.json();
    return data.results || [];
  } catch { clearTimeout(t); return []; }
}

async function fetchAndEnrich(tradeObj, cityStr, apiKey) {
  const city = cityOnly(cityStr);
  const results = await fsqSearch(tradeObj, cityStr, apiKey);
  if (!results.length) return [];

  // Filter to Canada only — Foursquare sometimes returns US results
  const canadian = results.filter(r => {
    const country = (r.location?.country || r.location?.cc || '').toUpperCase();
    return !country || country === 'CA' || country === 'CANADA';
  });

  return Promise.all(
    canadian.map(async r => {
      const loc    = r.location || {};
      const bizCity = loc.locality || loc.city || city;
      const prov   = (loc.region || CITY_PROVINCE[bizCity] || '').replace(/^CA-/,'').slice(0,2).toUpperCase();
      const website = r.website || '';
      const fsqPhone = (r.tel || '').replace(/[^\d+\-() ]/g,'').trim();

      // Enrich from the company's own website
      const enriched = await enrichFromWebsite(website);

      return {
        id:              makeId(r.name, bizCity),
        companyName:     r.name,
        tradeType:       tradeObj.trade,
        icon:            tradeObj.icon,
        phone:           enriched.phone || fsqPhone,
        email:           enriched.email || guessEmail(website),
        website,
        description:     enriched.description || `${tradeObj.trade} contractor serving ${bizCity}${prov ? ', '+prov : ''}.`,
        serviceAreas:    [bizCity],
        city:            bizCity,
        province:        prov || CITY_PROVINCE[city] || '',
        rating:          r.rating ? +(r.rating / 2).toFixed(1) : 0, // FSQ rates 0–10, convert to 0–5
        reviewCount:     r.stats?.total_ratings || 0,
        featured:        false,
        claimed:         false,
        plan:            'free',
        source:          'Foursquare Places',
        websiteVerified: enriched.websiteVerified,
        certifications:  enriched.certifications,
        yearsInBusiness: enriched.yearsInBusiness,
        licenseNumber:   '',
      };
    })
  );
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=7200');

  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ companies:[], total:0, note:'FOURSQUARE_API_KEY not configured', fetched:new Date().toISOString() });
  }

  const tradeParam = (req.query?.trade||'').toLowerCase().trim();
  const batchParam = parseInt(req.query?.batch||'0', 10);
  const cityParam  = (req.query?.city||'').trim();

  const trades = tradeParam ? TRADES.filter(t=>t.trade.toLowerCase().includes(tradeParam)) : TRADES;
  const cities = cityParam ? [cityParam] : (batchParam === 1 ? CITIES_1 : CITIES_0);

  console.log(`[scrape-foursquare] ${trades.length} trades × ${cities.length} cities`);

  const settled = await Promise.allSettled(
    cities.flatMap(city => trades.map(trade => fetchAndEnrich(trade, city, apiKey)))
  );

  let companies = settled.filter(r=>r.status==='fulfilled').flatMap(r=>r.value);

  // Deduplicate — website-verified entries win
  companies.sort((a,b) => {
    const s = c => (c.websiteVerified?8:0)+(c.email?4:0)+(c.phone?2:0)+(c.website?1:0);
    return s(b)-s(a);
  });
  const seen = new Set();
  companies = companies.filter(c => {
    const k = c.companyName.toLowerCase().replace(/[^a-z0-9]/g,'')+c.city.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  console.log(`[scrape-foursquare] ${companies.length} unique companies`);
  return res.status(200).json({ companies, total:companies.length, cities, fetched:new Date().toISOString(), source:'Foursquare Places + Website Enrichment' });
};
