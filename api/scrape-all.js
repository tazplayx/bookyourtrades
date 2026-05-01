/**
 * Mega-aggregator — all Canadian trade company scrapers in one function.
 * Consolidated to stay within Vercel Hobby plan's 12-function limit.
 *
 * Sources (all free, no paid API required):
 *   1. Foursquare Places API  — free 1,000 calls/day
 *   2. HomeStars              — Canadian-specific JSON-LD (no key needed)
 *   3. Yelp Fusion API        — free 500 calls/day
 *   4. Yellow Pages Canada    — HTML / JSON-LD scraping
 *   5. OpenStreetMap          — Overpass API, free, global
 *   6. Canada 411             — HTML scraping (no key)
 *   7. BBB Canada             — HTML / JSON-LD scraping (no key)
 *
 * Time-based rotation: each cron run selects a subset of trades based
 * on the current day-of-month, ensuring full coverage over ~7 days
 * even with API rate limits.
 *
 * GET /api/scrape-all              — run all sources (auto trade batch)
 * GET /api/scrape-all?batch=1      — second city batch
 * GET /api/scrape-all?source=fsq   — Foursquare only
 * GET /api/scrape-all?source=hs    — HomeStars only
 * GET /api/scrape-all?source=yelp  — Yelp only
 * GET /api/scrape-all?source=yp    — Yellow Pages only
 * GET /api/scrape-all?source=osm   — OpenStreetMap only
 * GET /api/scrape-all?source=ca411 — Canada 411 only
 * GET /api/scrape-all?source=bbb   — BBB Canada only
 * GET /api/scrape-all?trade=Electrical — single trade override
 *
 * Environment variables:
 *   FOURSQUARE_API_KEY  — developer.foursquare.com (free)
 *   YELP_API_KEY        — yelp.com/developers (free)
 */

// ── All 31 trade definitions ──────────────────────────────────────────────────

const TRADES = [
  { trade:'Boilermaker',              icon:'🔥', fsqQuery:'boilermaker contractor',               yelpTerm:'boilermaker contractor',             yelpCat:'boilerrepair',          hsSlug:'boiler-repair-services',        ypKw:'boilermakers',              ca411Kw:'Boilermaker',  bbbCat:'boilermakers' },
  { trade:'Carpentry',                icon:'🪚', fsqQuery:'carpentry contractor',                 yelpTerm:'carpentry contractor',               yelpCat:'carpenters',            hsSlug:'carpenters-joiners',            ypKw:'carpenters',                ca411Kw:'Carpenter',    bbbCat:'carpenters' },
  { trade:'Cleaning & Janitorial',    icon:'🧹', fsqQuery:'commercial cleaning janitorial',       yelpTerm:'commercial cleaning janitorial',     yelpCat:'officecleaning',        hsSlug:'cleaning-services',            ypKw:'building-cleaning',         ca411Kw:'Janitorial',   bbbCat:'janitorial-services' },
  { trade:'Concrete & Masonry',       icon:'🧱', fsqQuery:'concrete masonry contractor',          yelpTerm:'concrete masonry contractor',        yelpCat:'masonry_concrete',      hsSlug:'concrete-masonry-stonework',   ypKw:'concrete-contractors',      ca411Kw:'Concrete',     bbbCat:'concrete-contractors' },
  { trade:'Demolition',               icon:'💣', fsqQuery:'demolition contractor',                yelpTerm:'demolition contractor',              yelpCat:'demolitionservices',    hsSlug:'demolition-services',          ypKw:'demolition-contractors',    ca411Kw:'Demolition',   bbbCat:'demolition-contractors' },
  { trade:'Drywall & Plastering',     icon:'🪣', fsqQuery:'drywall plastering contractor',        yelpTerm:'drywall plastering contractor',      yelpCat:'drywallinstallation',   hsSlug:'drywall-stucco',               ypKw:'drywall-contractors',       ca411Kw:'Drywall',      bbbCat:'drywall-contractors' },
  { trade:'Electrical',               icon:'⚡', fsqQuery:'electrical contractor',                yelpTerm:'electrical contractor',              yelpCat:'electricians',          hsSlug:'electricians',                 ypKw:'electricians',              ca411Kw:'Electrician',  bbbCat:'electricians' },
  { trade:'Elevator & Lift',          icon:'🛗', fsqQuery:'elevator lift contractor',             yelpTerm:'elevator lift contractor',           yelpCat:'elevatorservices',      hsSlug:'elevator-services',            ypKw:'elevator-contractors',      ca411Kw:'Elevator',     bbbCat:'elevator-contractors' },
  { trade:'Environmental Services',   icon:'🌿', fsqQuery:'environmental services contractor',    yelpTerm:'environmental contractor',           yelpCat:'environmental',         hsSlug:'environmental-services',       ypKw:'environmental-contractors', ca411Kw:'Environmental',bbbCat:'environmental-services' },
  { trade:'Fencing',                  icon:'🚧', fsqQuery:'fencing contractor',                   yelpTerm:'fencing contractor',                 yelpCat:'fences_gates',          hsSlug:'fence-installation',           ypKw:'fence-contractors',         ca411Kw:'Fencing',      bbbCat:'fencing-contractors' },
  { trade:'Fire Protection',          icon:'🔥', fsqQuery:'fire protection sprinkler contractor', yelpTerm:'fire protection contractor',         yelpCat:'fireprotection',        hsSlug:'fire-protection',              ypKw:'fire-protection',           ca411Kw:'Fire Protection',bbbCat:'fire-protection' },
  { trade:'Flooring',                 icon:'🪵', fsqQuery:'commercial flooring contractor',       yelpTerm:'commercial flooring contractor',     yelpCat:'flooring',              hsSlug:'flooring',                     ypKw:'flooring-contractors',      ca411Kw:'Flooring',     bbbCat:'flooring-contractors' },
  { trade:'General Contracting',      icon:'🏗️', fsqQuery:'general contractor construction',     yelpTerm:'general contractor',                 yelpCat:'generalcontractors',    hsSlug:'general-contractors',          ypKw:'general-contractors',       ca411Kw:'General Contractor',bbbCat:'general-contractors' },
  { trade:'Glazing & Glass',          icon:'🪟', fsqQuery:'glazing glass contractor',             yelpTerm:'glazing glass contractor',           yelpCat:'glassandmirrors',       hsSlug:'glass-glazing',                ypKw:'glazing-contractors',       ca411Kw:'Glazing',      bbbCat:'glass-and-glazing' },
  { trade:'HVAC',                     icon:'🌡️', fsqQuery:'HVAC heating cooling contractor',     yelpTerm:'HVAC heating cooling',               yelpCat:'hvac',                  hsSlug:'heating-cooling',              ypKw:'heating-air-conditioning',  ca411Kw:'HVAC',         bbbCat:'heating-air-conditioning' },
  { trade:'Insulation',               icon:'🧶', fsqQuery:'insulation contractor',                yelpTerm:'insulation contractor',              yelpCat:'insulationinstallation',hsSlug:'insulation',                   ypKw:'insulation-contractors',    ca411Kw:'Insulation',   bbbCat:'insulation-contractors' },
  { trade:'Landscaping',              icon:'🌱', fsqQuery:'commercial landscaping contractor',    yelpTerm:'commercial landscaping contractor',  yelpCat:'landscaping',           hsSlug:'landscapers-lawn-maintenance', ypKw:'landscaping',               ca411Kw:'Landscaping',  bbbCat:'landscaping' },
  { trade:'Locksmith & Access Control',icon:'🔐',fsqQuery:'locksmith access control commercial',  yelpTerm:'commercial locksmith',               yelpCat:'locksmith',             hsSlug:'locksmiths',                   ypKw:'locksmiths',                ca411Kw:'Locksmith',    bbbCat:'locksmiths' },
  { trade:'Millwright',               icon:'🔩', fsqQuery:'millwright industrial contractor',     yelpTerm:'millwright industrial',              yelpCat:'industrialengineering', hsSlug:'industrial-services',          ypKw:'millwrights',               ca411Kw:'Millwright',   bbbCat:'millwrights' },
  { trade:'Moving & Equipment Rigging',icon:'🏋️',fsqQuery:'rigging equipment moving contractor', yelpTerm:'equipment rigging contractor',       yelpCat:'movers',                hsSlug:'movers',                       ypKw:'riggers',                   ca411Kw:'Rigging',      bbbCat:'rigging' },
  { trade:'Painting & Coating',       icon:'🎨', fsqQuery:'commercial painting contractor',       yelpTerm:'commercial painting contractor',     yelpCat:'painters',              hsSlug:'painters-decorators',          ypKw:'painting-contractors',      ca411Kw:'Painter',      bbbCat:'painting-contractors' },
  { trade:'Paving & Asphalt',         icon:'🛣️', fsqQuery:'paving asphalt contractor',           yelpTerm:'paving asphalt contractor',          yelpCat:'paving',                hsSlug:'paving-asphalt',               ypKw:'paving-contractors',        ca411Kw:'Paving',       bbbCat:'paving-contractors' },
  { trade:'Pest Control',             icon:'🐛', fsqQuery:'commercial pest control',              yelpTerm:'commercial pest control',            yelpCat:'pestcontrol',           hsSlug:'pest-control',                 ypKw:'pest-control',              ca411Kw:'Pest Control', bbbCat:'pest-control' },
  { trade:'Pipefitting',              icon:'🛢️', fsqQuery:'pipefitting contractor',               yelpTerm:'pipefitting contractor',             yelpCat:'plumbing',              hsSlug:'plumbers-drain-pipe',          ypKw:'pipefitters',               ca411Kw:'Pipefitter',   bbbCat:'pipefitting' },
  { trade:'Plumbing',                 icon:'🔧', fsqQuery:'plumbing contractor',                  yelpTerm:'plumbing contractor',                yelpCat:'plumbing',              hsSlug:'plumbers-drain-pipe',          ypKw:'plumbers',                  ca411Kw:'Plumber',      bbbCat:'plumbers' },
  { trade:'Refrigeration',            icon:'❄️', fsqQuery:'refrigeration contractor',             yelpTerm:'refrigeration contractor',           yelpCat:'refrigerationservices', hsSlug:'refrigeration',                ypKw:'refrigeration-contractors', ca411Kw:'Refrigeration',bbbCat:'refrigeration-equipment' },
  { trade:'Roofing',                  icon:'🏚️', fsqQuery:'roofing contractor commercial',        yelpTerm:'roofing contractor',                 yelpCat:'roofing',               hsSlug:'roofers',                      ypKw:'roofing-contractors',       ca411Kw:'Roofer',       bbbCat:'roofing-contractors' },
  { trade:'Security Systems',         icon:'🔒', fsqQuery:'security systems contractor commercial',yelpTerm:'security systems contractor',       yelpCat:'securitysystems',       hsSlug:'security-alarm-systems',       ypKw:'security-systems',          ca411Kw:'Security',     bbbCat:'security-systems' },
  { trade:'Sheet Metal',              icon:'🔨', fsqQuery:'sheet metal contractor',               yelpTerm:'sheet metal contractor',             yelpCat:'metalfabricators',      hsSlug:'sheet-metal-hvac',             ypKw:'sheet-metal-contractors',   ca411Kw:'Sheet Metal',  bbbCat:'sheet-metal-work' },
  { trade:'Snow Removal',             icon:'❄️', fsqQuery:'commercial snow removal contractor',   yelpTerm:'commercial snow removal',            yelpCat:'snowremoval',           hsSlug:'snow-removal',                 ypKw:'snow-removal',              ca411Kw:'Snow Removal', bbbCat:'snow-removal' },
  { trade:'Welding & Fabrication',    icon:'⚙️', fsqQuery:'welding fabrication contractor',       yelpTerm:'welding fabrication',                yelpCat:'metalfabricators',      hsSlug:'welding-services',             ypKw:'welding',                   ca411Kw:'Welder',       bbbCat:'welding' },
];

// ── Cities — 47 Canadian cities across all provinces ─────────────────────────

const CITIES_A = [
  // Ontario — major
  { name:'Toronto',    loc:'Toronto, Ontario, Canada',              yelpLoc:'Toronto, ON',    hslug:'toronto--on',    prov:'ON' },
  { name:'Ottawa',     loc:'Ottawa, Ontario, Canada',               yelpLoc:'Ottawa, ON',     hslug:'ottawa--on',     prov:'ON' },
  { name:'Hamilton',   loc:'Hamilton, Ontario, Canada',             yelpLoc:'Hamilton, ON',   hslug:'hamilton--on',   prov:'ON' },
  { name:'Mississauga',loc:'Mississauga, Ontario, Canada',          yelpLoc:'Mississauga, ON',hslug:'mississauga--on',prov:'ON' },
  { name:'Brampton',   loc:'Brampton, Ontario, Canada',             yelpLoc:'Brampton, ON',   hslug:'brampton--on',   prov:'ON' },
  { name:'London',     loc:'London, Ontario, Canada',               yelpLoc:'London, ON',     hslug:'london--on',     prov:'ON' },
  { name:'Kitchener',  loc:'Kitchener, Ontario, Canada',            yelpLoc:'Kitchener, ON',  hslug:'kitchener--on',  prov:'ON' },
  { name:'Windsor',    loc:'Windsor, Ontario, Canada',              yelpLoc:'Windsor, ON',    hslug:'windsor--on',    prov:'ON' },
  { name:'Barrie',     loc:'Barrie, Ontario, Canada',               yelpLoc:'Barrie, ON',     hslug:'barrie--on',     prov:'ON' },
  { name:'Sudbury',    loc:'Sudbury, Ontario, Canada',              yelpLoc:'Sudbury, ON',    hslug:'sudbury--on',    prov:'ON' },
  { name:'Oakville',   loc:'Oakville, Ontario, Canada',             yelpLoc:'Oakville, ON',   hslug:'oakville--on',   prov:'ON' },
  { name:'Kingston',   loc:'Kingston, Ontario, Canada',             yelpLoc:'Kingston, ON',   hslug:'kingston--on',   prov:'ON' },
  // British Columbia
  { name:'Vancouver',  loc:'Vancouver, British Columbia, Canada',   yelpLoc:'Vancouver, BC',  hslug:'vancouver--bc',  prov:'BC' },
  { name:'Surrey',     loc:'Surrey, British Columbia, Canada',      yelpLoc:'Surrey, BC',     hslug:'surrey--bc',     prov:'BC' },
  { name:'Burnaby',    loc:'Burnaby, British Columbia, Canada',     yelpLoc:'Burnaby, BC',    hslug:'burnaby--bc',    prov:'BC' },
  { name:'Richmond',   loc:'Richmond, British Columbia, Canada',    yelpLoc:'Richmond, BC',   hslug:'richmond--bc',   prov:'BC' },
  { name:'Abbotsford', loc:'Abbotsford, British Columbia, Canada',  yelpLoc:'Abbotsford, BC', hslug:'abbotsford--bc', prov:'BC' },
  { name:'Kelowna',    loc:'Kelowna, British Columbia, Canada',     yelpLoc:'Kelowna, BC',    hslug:'kelowna--bc',    prov:'BC' },
  { name:'Victoria',   loc:'Victoria, British Columbia, Canada',    yelpLoc:'Victoria, BC',   hslug:'victoria--bc',   prov:'BC' },
  { name:'Kamloops',   loc:'Kamloops, British Columbia, Canada',    yelpLoc:'Kamloops, BC',   hslug:'kamloops--bc',   prov:'BC' },
  // Alberta
  { name:'Calgary',    loc:'Calgary, Alberta, Canada',              yelpLoc:'Calgary, AB',    hslug:'calgary--ab',    prov:'AB' },
  { name:'Edmonton',   loc:'Edmonton, Alberta, Canada',             yelpLoc:'Edmonton, AB',   hslug:'edmonton--ab',   prov:'AB' },
  { name:'Red Deer',   loc:'Red Deer, Alberta, Canada',             yelpLoc:'Red Deer, AB',   hslug:'red-deer--ab',   prov:'AB' },
  { name:'Lethbridge', loc:'Lethbridge, Alberta, Canada',           yelpLoc:'Lethbridge, AB', hslug:'lethbridge--ab', prov:'AB' },
];

const CITIES_B = [
  // Alberta cont.
  { name:'Fort McMurray',loc:'Fort McMurray, Alberta, Canada',       yelpLoc:'Fort McMurray, AB',  hslug:'fort-mcmurray--ab',  prov:'AB' },
  { name:'Grande Prairie',loc:'Grande Prairie, Alberta, Canada',     yelpLoc:'Grande Prairie, AB', hslug:'grande-prairie--ab', prov:'AB' },
  // Saskatchewan
  { name:'Regina',     loc:'Regina, Saskatchewan, Canada',           yelpLoc:'Regina, SK',         hslug:'regina--sk',         prov:'SK' },
  { name:'Saskatoon',  loc:'Saskatoon, Saskatchewan, Canada',        yelpLoc:'Saskatoon, SK',      hslug:'saskatoon--sk',      prov:'SK' },
  // Manitoba
  { name:'Winnipeg',   loc:'Winnipeg, Manitoba, Canada',             yelpLoc:'Winnipeg, MB',       hslug:'winnipeg--mb',       prov:'MB' },
  { name:'Brandon',    loc:'Brandon, Manitoba, Canada',              yelpLoc:'Brandon, MB',        hslug:'brandon--mb',        prov:'MB' },
  // Quebec
  { name:'Montreal',   loc:'Montreal, Quebec, Canada',               yelpLoc:'Montreal, QC',       hslug:'montreal--qc',       prov:'QC' },
  { name:'Quebec City',loc:'Quebec City, Quebec, Canada',            yelpLoc:'Quebec City, QC',    hslug:'quebec--qc',         prov:'QC' },
  { name:'Laval',      loc:'Laval, Quebec, Canada',                  yelpLoc:'Laval, QC',          hslug:'laval--qc',          prov:'QC' },
  { name:'Gatineau',   loc:'Gatineau, Quebec, Canada',               yelpLoc:'Gatineau, QC',       hslug:'gatineau--qc',       prov:'QC' },
  { name:'Sherbrooke', loc:'Sherbrooke, Quebec, Canada',             yelpLoc:'Sherbrooke, QC',     hslug:'sherbrooke--qc',     prov:'QC' },
  // Maritime & Atlantic
  { name:'Halifax',    loc:'Halifax, Nova Scotia, Canada',           yelpLoc:'Halifax, NS',        hslug:'halifax--ns',        prov:'NS' },
  { name:'Moncton',    loc:'Moncton, New Brunswick, Canada',         yelpLoc:'Moncton, NB',        hslug:'moncton--nb',        prov:'NB' },
  { name:'Fredericton',loc:'Fredericton, New Brunswick, Canada',     yelpLoc:'Fredericton, NB',    hslug:'fredericton--nb',    prov:'NB' },
  { name:"Saint John", loc:"Saint John, New Brunswick, Canada",      yelpLoc:"Saint John, NB",     hslug:'saint-john--nb',     prov:'NB' },
  { name:"St. John's", loc:"St. John's, Newfoundland, Canada",       yelpLoc:"St. John's, NL",     hslug:'st-johns--nl',       prov:'NL' },
  { name:'Charlottetown',loc:'Charlottetown, PEI, Canada',           yelpLoc:'Charlottetown, PE',  hslug:'charlottetown--pe',  prov:'PE' },
  // Ontario extras
  { name:'Thunder Bay',loc:'Thunder Bay, Ontario, Canada',           yelpLoc:'Thunder Bay, ON',    hslug:'thunder-bay--on',    prov:'ON' },
  { name:'Guelph',     loc:'Guelph, Ontario, Canada',               yelpLoc:'Guelph, ON',         hslug:'guelph--on',         prov:'ON' },
  { name:'Oshawa',     loc:'Oshawa, Ontario, Canada',               yelpLoc:'Oshawa, ON',         hslug:'oshawa--on',         prov:'ON' },
  // BC extras
  { name:'Prince George',loc:'Prince George, British Columbia, Canada',yelpLoc:'Prince George, BC',hslug:'prince-george--bc', prov:'BC' },
  { name:'Nanaimo',    loc:'Nanaimo, British Columbia, Canada',      yelpLoc:'Nanaimo, BC',        hslug:'nanaimo--bc',        prov:'BC' },
];

const ALL_CITIES = [...CITIES_A, ...CITIES_B];

// ── Province lookup ───────────────────────────────────────────────────────────

const CITY_PROV = {};
for (const c of ALL_CITIES) CITY_PROV[c.name] = c.prov;

// ── Shared constants ──────────────────────────────────────────────────────────

const SKIP_DOMAINS = ['foursquare','facebook','instagram','linkedin','twitter','yelp','google','yellowpages','homestars','homeadvisor','kijiji','houzz','bbb.org','wikipedia','youtube','tiktok','canada411'];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Time-based trade rotation ─────────────────────────────────────────────────
// Divide trades into 7 groups; each day-of-month picks a different group.
// Full coverage in 7 days, keeps per-run API usage low.

function getTradeBatch(overrideTrade) {
  if (overrideTrade) return TRADES.filter(t => t.trade.toLowerCase() === overrideTrade.toLowerCase());
  const BATCH_SIZE = 5;
  const numBatches = Math.ceil(TRADES.length / BATCH_SIZE);
  const dayBatch   = (new Date().getDate() - 1) % numBatches;
  return TRADES.slice(dayBatch * BATCH_SIZE, (dayBatch + 1) * BATCH_SIZE);
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function makeId(prefix, name, city) {
  const s = (name + '|' + (city || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return prefix + '_' + (h >>> 0).toString(36);
}

function isSkippable(url) {
  if (!url) return true;
  try {
    const host = new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace(/^www\./, '').toLowerCase();
    return SKIP_DOMAINS.some(d => host.includes(d));
  } catch { return true; }
}

function guessEmail(website) {
  if (!website || isSkippable(website)) return '';
  try {
    const host = new URL(website.startsWith('http') ? website : 'https://' + website).hostname.replace(/^www\./, '').toLowerCase();
    return host.includes('.') ? 'info@' + host : '';
  } catch { return ''; }
}

function extractPhone(text) {
  if (!text) return '';
  const m = text.match(/(\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]([2-9]\d{2})[\s.\-](\d{4})/);
  return m ? m[0].trim() : '';
}

function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '').replace(/^1/, '').slice(-10);
}

function extractEmails(text) {
  if (!text) return [];
  const re  = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const bad = ['noreply', 'no-reply', 'donotreply', 'postmaster', 'bounce', 'example', 'test'];
  return [...new Set((text.match(re) || []).filter(e => {
    const lc = e.toLowerCase();
    return !bad.some(b => lc.startsWith(b)) && !SKIP_DOMAINS.some(d => lc.includes(d));
  }))];
}

function extractMeta(html, prop) {
  const r1 = new RegExp(`<meta[^>]+(?:name|property)=["']${prop}["'][^>]+content=["']([^"']{1,500})["']`, 'i');
  const r2 = new RegExp(`<meta[^>]+content=["']([^"']{1,500})["'][^>]+(?:name|property)=["']${prop}["']`, 'i');
  const m  = html.match(r1) || html.match(r2);
  return m ? m[1].trim() : '';
}

function parseJsonLd(html) {
  const re  = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out = [];
  for (const m of html.matchAll(re)) {
    try {
      const p     = JSON.parse(m[1].trim());
      const items = Array.isArray(p) ? p : [p];
      for (const item of items) {
        const nodes = item['@graph'] ? item['@graph'] : [item];
        for (const n of nodes)
          if (/LocalBusiness|Organization|Contractor|Electrician|Plumber|HVAC|Roofing|Construction|HomeAndConstruction/i.test(n['@type'] || ''))
            out.push(n);
      }
    } catch {}
  }
  return out;
}

function extractCerts(text) {
  const pats = [/ESA\s*licen[sc]e/i, /TSSA/i, /Red\s*Seal/i, /Journeyman/i, /Master\s*(Electrician|Plumber|HVAC)/i, /WSIB/i, /\bCOR\b/, /ISO\s*\d{4,5}/i, /SMACNA/i, /NFPA/i, /ASHRAE/i, /LEED/i, /ECRA/i];
  return [...new Set(pats.map(p => { const m = text.match(p); return m ? m[0].trim() : null; }).filter(Boolean))].slice(0, 6);
}

async function fetchHtml(url, ms = 7000) {
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*;q=0.8', 'Accept-Language': 'en-CA,en;q=0.9' },
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
  const out = { email: '', phone: '', description: '', certifications: [], yearsInBusiness: '', websiteVerified: false };
  if (!website || isSkippable(website)) return out;
  const base = website.replace(/\/$/, '');
  const html = await fetchHtml(base, 8000);
  if (!html) return out;
  out.websiteVerified = true;
  const ld    = parseJsonLd(html);
  out.phone   = (ld.find(n => n.telephone) || {}).telephone || extractPhone(html);
  const ldEmail = (ld.find(n => n.email) || {}).email || '';
  if (ldEmail && !isSkippable(ldEmail)) {
    out.email = ldEmail.toLowerCase();
  } else {
    const hits = [...[...html.matchAll(/href=["']mailto:([^"'?\s]+)["']/gi)].map(m => m[1]), ...extractEmails(html)];
    out.email  = [...new Set(hits)].find(e => !e.includes('example') && !e.includes('test')) || '';
  }
  const ldDesc = ld.map(n => n.description || '').find(d => d.length > 20) || '';
  out.description = (ldDesc || extractMeta(html, 'og:description') || extractMeta(html, 'description')).replace(/<[^>]+>/g, '').slice(0, 400).trim();
  out.certifications = extractCerts(html);
  const ym = html.match(/(?:serving|in\s+business|established|since|founded)\s+(?:for\s+)?(\d+)\s*\+?\s*years?/i)
          || html.match(/(\d+)\s*\+?\s*years?\s+(?:of\s+)?(?:experience|in\s+business|serving)/i);
  if (ym) out.yearsInBusiness = ym[1] + ' years';
  if (!out.email) {
    for (const path of ['/contact', '/contact-us', '/about']) {
      const ch  = await fetchHtml(base + path, 5000);
      if (!ch) continue;
      const hits = [...[...ch.matchAll(/href=["']mailto:([^"'?\s]+)["']/gi)].map(m => m[1]), ...extractEmails(ch)];
      const f    = [...new Set(hits)].find(e => !e.includes('example') && !e.includes('test'));
      if (f) { out.email = f; break; }
    }
  }
  return out;
}

// ── SOURCE 1: Foursquare Places API ──────────────────────────────────────────

async function fetchFoursquare(cities, trades, apiKey) {
  if (!apiKey) return [];
  const authHeader = apiKey.startsWith('fsq3') ? apiKey : 'fsq3' + apiKey;
  const FSQ    = 'https://api.foursquare.com/v3/places/search';
  const FIELDS = 'fsq_id,name,location,tel,website,rating,stats,categories';

  async function search(trade, city) {
    const url  = `${FSQ}?query=${encodeURIComponent(trade.fsqQuery)}&near=${encodeURIComponent(city.loc)}&limit=50&fields=${FIELDS}`;
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { 'Authorization': authHeader, 'Accept': 'application/json' } });
      clearTimeout(t);
      if (!r.ok) { console.warn('[fsq]', r.status); return []; }
      const d = await r.json();
      return (d.results || []).filter(r => {
        const cc = (r.location?.country || r.location?.cc || '').toUpperCase();
        return !cc || cc === 'CA' || cc === 'CANADA';
      });
    } catch { clearTimeout(t); return []; }
  }

  const pairs    = cities.flatMap(city => trades.map(trade => ({ trade, city })));
  const settled  = await Promise.allSettled(pairs.map(({ trade, city }) => search(trade, city)));
  const rawResults = settled.filter(r => r.status === 'fulfilled').flatMap((r, i) => {
    const { trade, city } = pairs[i];
    return (r.value || []).map(b => ({ b, trade, city }));
  });

  return Promise.all(rawResults.map(async ({ b, trade, city }) => {
    const loc      = b.location || {};
    const bizCity  = loc.locality || loc.city || city.name;
    const prov     = (loc.region || CITY_PROV[bizCity] || city.prov || '').replace(/^CA-/, '').slice(0, 2).toUpperCase();
    const website  = b.website || '';
    const fsqPhone = (b.tel || '').replace(/[^\d+\-() ]/g, '').trim();
    const enriched = await enrichFromWebsite(website);
    return {
      id: makeId('fsq', b.name, bizCity),
      companyName: b.name, tradeType: trade.trade, icon: trade.icon,
      phone: enriched.phone || fsqPhone, email: enriched.email || guessEmail(website), website,
      description: enriched.description || `${trade.trade} contractor serving ${bizCity}${prov ? ', ' + prov : ''}.`,
      serviceAreas: [bizCity], city: bizCity, province: prov || CITY_PROV[city.name] || '',
      rating: b.rating ? +(b.rating / 2).toFixed(1) : 0, reviewCount: b.stats?.total_ratings || 0,
      featured: false, claimed: false, plan: 'free', source: 'Foursquare Places',
      websiteVerified: enriched.websiteVerified, certifications: enriched.certifications,
      yearsInBusiness: enriched.yearsInBusiness, licenseNumber: '',
    };
  }));
}

// ── SOURCE 2: HomeStars ───────────────────────────────────────────────────────

async function fetchHomeStars(cities, trades) {
  async function scrapePage(trade, city) {
    const urls = [
      `https://homestars.com/companies/search?q=${encodeURIComponent(trade.hsSlug)}&location=${city.hslug}`,
      `https://homestars.com/ca/search/view?utf8=%E2%9C%93&term=${encodeURIComponent(trade.hsSlug)}&tag_cities[]=${city.hslug}`,
    ];
    for (const url of urls) {
      const html = await fetchHtml(url, 9000);
      if (!html || html.length < 1000) continue;
      const ld        = parseJsonLd(html);
      const companies = [];
      if (ld.length > 0) {
        for (const biz of ld) {
          const name = (biz.name || '').trim();
          if (!name || name.length < 2) continue;
          const addr    = biz.address || {};
          const bizCity = (addr.addressLocality || city.name).trim();
          const prov    = (addr.addressRegion || CITY_PROV[bizCity] || city.prov || '').replace(/^CA-/, '').trim();
          const phone   = (biz.telephone || '').replace(/[^\d+\-() ]/g, '').trim();
          const website = (biz.url || biz.sameAs || '').trim();
          const email   = (biz.email || '').toLowerCase().trim();
          const desc    = (biz.description || '').replace(/<[^>]+>/g, '').slice(0, 400).trim();
          companies.push({ _name: name, _city: bizCity, _prov: prov, _phone: phone, _website: isSkippable(website) ? '' : website, _email: isSkippable(email) ? '' : email, _desc: desc, _rating: parseFloat(biz.aggregateRating?.ratingValue || 0), _revCnt: parseInt(biz.aggregateRating?.reviewCount || 0, 10) });
        }
      }
      if (companies.length < 3) {
        const profileRe = /href=["'](\/companies\/\d+-[^"'?#\s]+)["'][^>]*>([^<]{3,80})<\/a>/gi;
        const phoneRe   = /(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/g;
        const names     = [...html.matchAll(profileRe)].map(m => ({ slug: m[1], name: m[2].trim() })).filter(m => m.name.length > 2);
        const phones    = [...html.matchAll(phoneRe)].map(m => m[1].trim());
        for (let i = 0; i < Math.min(names.length, 20); i++)
          companies.push({ _name: names[i].name, _city: city.name, _prov: city.prov, _phone: phones[i] || '', _website: '', _email: '', _desc: '', _rating: 0, _revCnt: 0, _hsPath: names[i].slug });
      }
      if (companies.length > 0) return { companies, trade, city };
    }
    return { companies: [], trade, city };
  }

  const pairs   = cities.flatMap(city => trades.map(trade => ({ trade, city })));
  const results = [];
  for (const city of cities) {
    const cityTrades = pairs.filter(p => p.city.name === city.name);
    const settled    = await Promise.allSettled(cityTrades.map(({ trade, city }) => scrapePage(trade, city)));
    for (let i = 0; i < settled.length; i++)
      if (settled[i].status === 'fulfilled') results.push(settled[i].value);
    await new Promise(r => setTimeout(r, 150));
  }

  return Promise.all(results.flatMap(({ companies, trade, city }) =>
    companies.map(async item => {
      let website = item._website;
      if (!website && item._hsPath) {
        const html = await fetchHtml('https://homestars.com' + item._hsPath, 6000);
        if (html) {
          const ld  = parseJsonLd(html);
          const u   = (ld.find(n => n.url) || {}).url || '';
          if (u && !isSkippable(u)) website = u;
          else { const m = html.match(/(?:Visit Website|company website)[^<]*<[^>]+href=["']([^"']+)["']/i); if (m && !isSkippable(m[1])) website = m[1]; }
        }
      }
      const enriched = await enrichFromWebsite(website);
      return {
        id: makeId('hs', item._name, item._city),
        companyName: item._name, tradeType: trade.trade, icon: trade.icon,
        phone: enriched.phone || item._phone, email: enriched.email || item._email || guessEmail(website), website,
        description: enriched.description || item._desc || `${trade.trade} contractor serving ${item._city}${item._prov ? ', ' + item._prov : ''}.`,
        serviceAreas: [item._city], city: item._city, province: item._prov || CITY_PROV[item._city] || '',
        rating: item._rating, reviewCount: item._revCnt,
        featured: false, claimed: false, plan: 'free', source: 'HomeStars',
        websiteVerified: enriched.websiteVerified, certifications: enriched.certifications,
        yearsInBusiness: enriched.yearsInBusiness, licenseNumber: '',
      };
    })
  ));
}

// ── SOURCE 3: Yelp Fusion API ─────────────────────────────────────────────────

async function fetchYelp(cities, trades, apiKey) {
  if (!apiKey) return [];

  async function search(trade, city) {
    const params = new URLSearchParams({ term: trade.yelpTerm, location: city.yelpLoc, categories: trade.yelpCat, limit: '50', locale: 'en_CA' });
    const ctrl   = new AbortController();
    const t      = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch(`https://api.yelp.com/v3/businesses/search?${params}`, {
        signal: ctrl.signal,
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Accept': 'application/json' },
      });
      clearTimeout(t);
      if (!r.ok) return [];
      const d = await r.json();
      return (d.businesses || []).filter(b => { const cc = (b.location?.country || '').toUpperCase(); return !cc || cc === 'CA'; });
    } catch { clearTimeout(t); return []; }
  }

  const pairs   = cities.flatMap(city => trades.map(trade => ({ trade, city })));
  const settled = await Promise.allSettled(pairs.map(({ trade, city }) => search(trade, city)));

  return settled.filter(r => r.status === 'fulfilled').flatMap((r, i) => {
    const { trade, city } = pairs[i];
    return (r.value || []).map(b => {
      const loc     = b.location || {};
      const bizCity = loc.city || city.name;
      const prov    = (loc.state || city.prov || '').replace(/^CA-/, '').toUpperCase().slice(0, 2);
      return {
        id: makeId('yelp', b.name, bizCity),
        companyName: b.name, tradeType: trade.trade, icon: trade.icon,
        phone: (b.phone || b.display_phone || '').replace(/[^\d+\-() ]/g, '').trim(),
        email: '', website: '',
        description: (b.snippet_text || `${trade.trade} contractor serving ${bizCity}${prov ? ', ' + prov : ''}.`).slice(0, 400),
        serviceAreas: [bizCity], city: bizCity, province: prov || CITY_PROV[city.name] || '',
        rating: b.rating || 0, reviewCount: b.review_count || 0,
        featured: false, claimed: false, plan: 'free', source: 'Yelp',
        websiteVerified: false, certifications: [], yearsInBusiness: '', licenseNumber: '',
        imageUrl: b.image_url || '',
      };
    });
  });
}

// ── SOURCE 4: Yellow Pages Canada ─────────────────────────────────────────────

function extractLocalBusinesses(data) {
  if (!data || typeof data !== 'object') return [];
  const t = data['@type'] || '';
  if (/LocalBusiness|HomeAndConstruction|Electrician|Plumber|GeneralContractor|HVACBusiness|RoofingContractor/i.test(t)) return [data];
  if (t === 'ItemList' && Array.isArray(data.itemListElement)) return data.itemListElement.map(i => i.item || i).filter(i => i['@type'] && i['@type'] !== 'ListItem');
  if (Array.isArray(data)) return data.flatMap(extractLocalBusinesses);
  if (data['@graph']) return extractLocalBusinesses(data['@graph']);
  return [];
}

async function fetchYellowPages(cities, trades) {
  async function fetchPage(trade, city) {
    const url  = `https://www.yellowpages.ca/search/si/1/${encodeURIComponent(trade.ypKw)}/${encodeURIComponent(city.name)}`;
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*;q=0.8', 'Accept-Language': 'en-CA,en;q=0.9' } });
      clearTimeout(t);
      if (!r.ok) return [];
      const html       = await r.text();
      const jsonLdRe   = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      const businesses = [];
      for (const m of html.matchAll(jsonLdRe)) {
        try { businesses.push(...extractLocalBusinesses(JSON.parse(m[1].trim()))); } catch {}
      }
      if (businesses.length > 0) {
        return businesses.map(b => {
          const name    = (b.name || '').trim();
          if (!name || name.length < 2) return null;
          const addr    = b.address || {};
          const bizCity = (addr.addressLocality || city.name).trim();
          const prov    = (addr.addressRegion || CITY_PROV[bizCity] || city.prov || '').replace(/^CA-/, '').trim();
          const phone   = (b.telephone || '').replace(/[^\d+\-() ]/g, '').trim();
          const website = (b.url || b.sameAs || '').trim();
          const email   = (b.email || guessEmail(website)).trim().toLowerCase();
          return {
            id: makeId('yp', name, bizCity),
            companyName: name, tradeType: trade.trade, icon: trade.icon,
            phone, email, website,
            description: (b.description || '').replace(/<[^>]+>/g, '').slice(0, 400).trim() || `${trade.trade} contractor serving ${bizCity}${prov ? ', ' + prov : ''}.`,
            serviceAreas: [bizCity], city: bizCity, province: prov || CITY_PROV[city.name] || '',
            rating: parseFloat(b.aggregateRating?.ratingValue || 0), reviewCount: parseInt(b.aggregateRating?.reviewCount || 0, 10),
            featured: false, claimed: false, plan: 'free', source: 'Yellow Pages Canada',
            websiteVerified: false, certifications: [], yearsInBusiness: '', licenseNumber: '',
          };
        }).filter(Boolean);
      }
      // HTML fallback
      const linkRe  = /href="(\/bus\/[^"]+)"[^>]*>([^<]{3,80})<\/a>/gi;
      const phoneRe = /(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/g;
      const names   = [...html.matchAll(linkRe)].map(m => m[2].trim()).filter(n => n.length > 2);
      const phones  = [...html.matchAll(phoneRe)].map(m => m[1].trim());
      return names.slice(0, 20).map((name, i) => ({
        id: makeId('yp', name, city.name),
        companyName: name, tradeType: trade.trade, icon: trade.icon,
        phone: phones[i] || '', email: '', website: '',
        description: `${trade.trade} contractor serving ${city.name}.`,
        serviceAreas: [city.name], city: city.name, province: city.prov,
        rating: 0, reviewCount: 0, featured: false, claimed: false, plan: 'free', source: 'Yellow Pages Canada',
        websiteVerified: false, certifications: [], yearsInBusiness: '', licenseNumber: '',
      }));
    } catch { clearTimeout(t); return []; }
  }

  const pairs   = cities.flatMap(city => trades.map(trade => ({ trade, city })));
  const settled = await Promise.allSettled(pairs.map(({ trade, city }) => fetchPage(trade, city)));
  return settled.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
}

// ── SOURCE 5: OpenStreetMap / Overpass API ────────────────────────────────────

async function fetchOSM() {
  const OVERPASS = 'https://overpass-api.de/api/interpreter';
  const OSM_TAGS = [
    ['craft','electrician'],['craft','plumber'],['craft','hvac_technician'],['craft','roofer'],
    ['craft','welder'],['craft','carpenter'],['craft','pipefitter'],['craft','mason'],['craft','bricklayer'],
    ['craft','painter'],['craft','glazier'],['craft','insulation'],['craft','pest_control'],
    ['trade','electrician'],['trade','plumber'],['trade','carpenter'],['trade','roofer'],
    ['shop','electrical'],['shop','plumber'],['office','construction_company'],
    ['amenity','snow_removal'],
  ];
  const TRADE_BY_TAG = {
    electrician: 'Electrical', plumber: 'Plumbing', hvac_technician: 'HVAC', roofer: 'Roofing',
    welder: 'Welding & Fabrication', carpenter: 'Carpentry', pipefitter: 'Pipefitting',
    mason: 'Concrete & Masonry', bricklayer: 'Concrete & Masonry',
    painter: 'Painting & Coating', glazier: 'Glazing & Glass', insulation: 'Insulation',
    pest_control: 'Pest Control', electrical: 'Electrical', plumber_shop: 'Plumbing',
    construction_company: 'General Contracting', snow_removal: 'Snow Removal',
  };
  const ICONS = { 'Electrical':'⚡','Plumbing':'🔧','HVAC':'🌡️','Roofing':'🏚️','Welding & Fabrication':'⚙️','Carpentry':'🪚','General Contracting':'🏗️','Concrete & Masonry':'🧱','Pipefitting':'🛢️','Painting & Coating':'🎨','Glazing & Glass':'🪟','Insulation':'🧶','Pest Control':'🐛','Snow Removal':'❄️' };

  const bbox        = '41.67,-141.01,83.11,-52.62';
  const nodeFilters = OSM_TAGS.map(([k, v]) => `node["${k}"="${v}"]["name"](${bbox});`).join('\n  ');
  const query       = `[out:json][timeout:30];\n(\n  ${nodeFilters}\n);\nout body 200;`;

  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 28000);
  try {
    const r = await fetch(OVERPASS, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query), signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return [];
    const json = await r.json();
    return (json.elements || []).map(el => {
      const tags    = el.tags || {};
      const name    = tags.name || tags['name:en'];
      if (!name) return null;
      const tagKey  = Object.keys(tags).find(k => OSM_TAGS.some(([tk]) => tk === k) && TRADE_BY_TAG[tags[k]]);
      const trade   = tagKey ? (TRADE_BY_TAG[tags[tagKey]] || 'General Contracting') : 'General Contracting';
      const city    = tags['addr:city'] || tags['addr:town'] || '';
      const prov    = (tags['addr:province'] || tags['addr:state'] || '').replace(/^CA-/, '');
      const web     = tags.website || tags['contact:website'] || '';
      const phone   = (tags.phone || tags['contact:phone'] || '').replace(/^tel:/, '');
      const email   = tags.email || tags['contact:email'] || guessEmail(web);
      return {
        id: makeId('osm', name, city || prov),
        companyName: name, tradeType: trade, icon: ICONS[trade] || '🔧',
        phone, email, website: web,
        description: tags.description || `${trade} contractor — ${city || prov || 'Canada'}.`,
        serviceAreas: [city || prov || 'Canada'], city, province: prov,
        lat: el.lat, lng: el.lon,
        rating: 0, reviewCount: 0, featured: false, claimed: false, plan: 'free', source: 'OpenStreetMap',
        websiteVerified: false, certifications: [], yearsInBusiness: '', licenseNumber: '',
      };
    }).filter(Boolean);
  } catch { clearTimeout(t); return []; }
}

// ── SOURCE 6: Canada 411 ──────────────────────────────────────────────────────

async function fetchCanada411(cities, trades) {
  async function scrapePage(trade, city) {
    // Canada 411 business search URL pattern
    const url  = `https://www.canada411.ca/search/?stype=si&what=${encodeURIComponent(trade.ca411Kw)}&where=${encodeURIComponent(city.name + ', ' + city.prov)}`;
    const html = await fetchHtml(url, 8000);
    if (!html || html.length < 1000) return [];

    const results = [];

    // Try JSON-LD first
    const ld = parseJsonLd(html);
    for (const biz of ld) {
      const name = (biz.name || '').trim();
      if (!name || name.length < 2) continue;
      const addr    = biz.address || {};
      const bizCity = (addr.addressLocality || city.name).trim();
      const prov    = (addr.addressRegion || CITY_PROV[bizCity] || city.prov || '').replace(/^CA-/, '').trim();
      const phone   = (biz.telephone || '').replace(/[^\d+\-() ]/g, '').trim();
      const website = (biz.url || '').trim();
      const email   = (biz.email || guessEmail(website)).trim().toLowerCase();
      results.push({
        id: makeId('ca411', name, bizCity),
        companyName: name, tradeType: trade.trade, icon: trade.icon,
        phone, email, website: isSkippable(website) ? '' : website,
        description: (biz.description || '').replace(/<[^>]+>/g, '').slice(0, 400).trim() || `${trade.trade} contractor serving ${bizCity}${prov ? ', ' + prov : ''}.`,
        serviceAreas: [bizCity], city: bizCity, province: prov || CITY_PROV[city.name] || '',
        rating: parseFloat(biz.aggregateRating?.ratingValue || 0), reviewCount: parseInt(biz.aggregateRating?.reviewCount || 0, 10),
        featured: false, claimed: false, plan: 'free', source: 'Canada 411',
        websiteVerified: false, certifications: [], yearsInBusiness: '', licenseNumber: '',
      });
    }
    if (results.length > 0) return results;

    // HTML fallback — extract listing cards
    // Canada 411 uses <a class="listingTitle"> and data- attributes
    const nameRe  = /class="[^"]*(?:listingTitle|bizName)[^"]*"[^>]*>([^<]{2,80})<\/a>/gi;
    const phoneRe = /(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/g;
    const addrRe  = /class="[^"]*address[^"]*"[^>]*>([^<]{5,120})<\//gi;
    const names   = [...html.matchAll(nameRe)].map(m => m[1].trim()).filter(n => n.length > 2);
    const phones  = [...html.matchAll(phoneRe)].map(m => m[1].trim());
    const addrs   = [...html.matchAll(addrRe)].map(m => m[1].trim());

    return names.slice(0, 20).map((name, i) => ({
      id: makeId('ca411', name, city.name),
      companyName: name, tradeType: trade.trade, icon: trade.icon,
      phone: phones[i] || '', email: '', website: '',
      description: addrs[i] ? `${trade.trade} contractor — ${addrs[i]}` : `${trade.trade} contractor serving ${city.name}, ${city.prov}.`,
      serviceAreas: [city.name], city: city.name, province: city.prov,
      rating: 0, reviewCount: 0, featured: false, claimed: false, plan: 'free', source: 'Canada 411',
      websiteVerified: false, certifications: [], yearsInBusiness: '', licenseNumber: '',
    }));
  }

  const pairs   = cities.flatMap(city => trades.map(trade => ({ trade, city })));
  const settled = await Promise.allSettled(pairs.map(({ trade, city }) => scrapePage(trade, city)));
  return settled.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
}

// ── SOURCE 7: BBB Canada ──────────────────────────────────────────────────────

async function fetchBBB(cities, trades) {
  async function scrapePage(trade, city) {
    // BBB Canada search URL
    const url  = `https://www.bbb.org/search?find_text=${encodeURIComponent(trade.bbbCat)}&find_loc=${encodeURIComponent(city.name + ', ' + city.prov + ', Canada')}&country=CA`;
    const html = await fetchHtml(url, 9000);
    if (!html || html.length < 1000) return [];

    const results = [];

    // Try JSON-LD first
    const ld = parseJsonLd(html);
    for (const biz of ld) {
      const name = (biz.name || '').trim();
      if (!name || name.length < 2) continue;
      const addr    = biz.address || {};
      const bizCity = (addr.addressLocality || city.name).trim();
      const prov    = (addr.addressRegion || CITY_PROV[bizCity] || city.prov || '').replace(/^CA-/, '').trim();
      const phone   = (biz.telephone || '').replace(/[^\d+\-() ]/g, '').trim();
      const website = (biz.url || '').trim();
      const email   = (biz.email || guessEmail(website)).trim().toLowerCase();
      const rating  = parseFloat(biz.aggregateRating?.ratingValue || 0);
      results.push({
        id: makeId('bbb', name, bizCity),
        companyName: name, tradeType: trade.trade, icon: trade.icon,
        phone, email, website: isSkippable(website) ? '' : website,
        description: (biz.description || '').replace(/<[^>]+>/g, '').slice(0, 400).trim() || `${trade.trade} contractor serving ${bizCity}${prov ? ', ' + prov : ''}.`,
        serviceAreas: [bizCity], city: bizCity, province: prov || CITY_PROV[city.name] || '',
        rating, reviewCount: parseInt(biz.aggregateRating?.reviewCount || 0, 10),
        featured: false, claimed: false, plan: 'free', source: 'BBB Canada',
        websiteVerified: false, certifications: [], yearsInBusiness: '', licenseNumber: '',
      });
    }
    if (results.length > 0) return results;

    // HTML fallback — BBB uses data-testid attributes for business cards
    const nameRe  = /data-testid="[^"]*business-name[^"]*"[^>]*>([^<]{2,80})<\//gi;
    const phoneRe = /(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/g;
    const names   = [...html.matchAll(nameRe)].map(m => m[1].trim()).filter(n => n.length > 2);
    const phones  = [...html.matchAll(phoneRe)].map(m => m[1].trim());

    return names.slice(0, 20).map((name, i) => ({
      id: makeId('bbb', name, city.name),
      companyName: name, tradeType: trade.trade, icon: trade.icon,
      phone: phones[i] || '', email: '', website: '',
      description: `${trade.trade} contractor serving ${city.name}, ${city.prov}.`,
      serviceAreas: [city.name], city: city.name, province: city.prov,
      rating: 0, reviewCount: 0, featured: false, claimed: false, plan: 'free', source: 'BBB Canada',
      websiteVerified: false, certifications: [], yearsInBusiness: '', licenseNumber: '',
    }));
  }

  const pairs   = cities.flatMap(city => trades.map(trade => ({ trade, city })));
  const settled = await Promise.allSettled(pairs.map(({ trade, city }) => scrapePage(trade, city)));
  return settled.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function dedupe(companies) {
  // Score companies by data quality — better sources win
  companies.sort((a, b) => {
    const score = c =>
      (c.websiteVerified ? 16 : 0) +
      (c.source === 'Foursquare Places' ? 8 : 0) +
      (c.source === 'HomeStars' ? 7 : 0) +
      (c.source === 'BBB Canada' ? 6 : 0) +
      (c.source === 'Yelp' ? 5 : 0) +
      (c.source === 'Yellow Pages Canada' ? 4 : 0) +
      (c.source === 'Canada 411' ? 3 : 0) +
      (c.email ? 3 : 0) + (c.phone ? 2 : 0) + (c.website ? 1 : 0);
    return score(b) - score(a);
  });

  // Dedupe by name+city combo
  const seenName = new Set();
  // Also dedupe by normalized phone (if available)
  const seenPhone = new Set();

  return companies.filter(c => {
    const nameKey = c.companyName.toLowerCase().replace(/[^a-z0-9]/g, '') + (c.city || '').toLowerCase().replace(/\s/g, '');
    if (seenName.has(nameKey)) return false;
    seenName.add(nameKey);

    // Secondary phone dedup — skip if we already have same phone in same trade
    if (c.phone) {
      const norm = normalizePhone(c.phone);
      if (norm.length === 10) {
        const phoneKey = norm + c.tradeType;
        if (seenPhone.has(phoneKey)) return false;
        seenPhone.add(phoneKey);
      }
    }
    return true;
  }).map(c => ({ ...c, province: c.province || CITY_PROV[c.city] || '' }));
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=7200');

  const fsqKey  = process.env.FOURSQUARE_API_KEY || '';
  const yelpKey = process.env.YELP_API_KEY       || '';
  const source  = (req.query?.source || '').toLowerCase();
  const batch   = parseInt(req.query?.batch || '0', 10);
  const tradeQ  = req.query?.trade || '';

  // City set: batch 0 = CITIES_A (24 cities), batch 1 = CITIES_B (23 cities)
  const cities  = batch === 1 ? CITIES_B : CITIES_A;

  // Trade set: rotate by day (5 trades/day → full coverage in ~7 days)
  const trades  = getTradeBatch(tradeQ);

  console.log(`[scrape-all] source=${source || 'all'} batch=${batch} trades=${trades.map(t => t.trade).join(',')} cities=${cities.length} fsq=${!!fsqKey} yelp=${!!yelpKey}`);

  let companies = [];

  try {
    if (!source || source === 'fsq' || source === 'foursquare') {
      const r = await fetchFoursquare(cities, trades, fsqKey);
      companies.push(...r);
      console.log(`[scrape-all] fsq: ${r.length}`);
    }
    if (!source || source === 'hs' || source === 'homestars') {
      const r = await fetchHomeStars(cities.slice(0, 12), trades);
      companies.push(...r);
      console.log(`[scrape-all] homestars: ${r.length}`);
    }
    if (!source || source === 'yelp') {
      const r = await fetchYelp(cities.slice(0, 10), trades, yelpKey);
      companies.push(...r);
      console.log(`[scrape-all] yelp: ${r.length}`);
    }
    if (!source || source === 'yp') {
      const r = await fetchYellowPages(cities.slice(0, 10), trades);
      companies.push(...r);
      console.log(`[scrape-all] yp: ${r.length}`);
    }
    if (!source || source === 'ca411') {
      const r = await fetchCanada411(cities.slice(0, 10), trades);
      companies.push(...r);
      console.log(`[scrape-all] ca411: ${r.length}`);
    }
    if (!source || source === 'bbb') {
      const r = await fetchBBB(cities.slice(0, 8), trades);
      companies.push(...r);
      console.log(`[scrape-all] bbb: ${r.length}`);
    }
    if (!source || source === 'osm') {
      const r = await fetchOSM();
      companies.push(...r);
      console.log(`[scrape-all] osm: ${r.length}`);
    }
  } catch (err) {
    console.error('[scrape-all] fatal:', err.message);
  }

  const deduped = dedupe(companies);
  console.log(`[scrape-all] total after dedupe: ${deduped.length}`);

  return res.status(200).json({
    companies:   deduped,
    total:       deduped.length,
    fetched:     new Date().toISOString(),
    tradeBatch:  trades.map(t => t.trade),
    cityBatch:   batch,
    sources:     ['Foursquare Places', 'HomeStars', 'Yelp', 'Yellow Pages Canada', 'Canada 411', 'BBB Canada', 'OpenStreetMap'],
  });
};
// deployed 2026-04-29
