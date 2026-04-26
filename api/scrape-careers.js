/**
 * Vercel serverless function — comprehensive Canadian trades job scraper.
 * Sources:
 *   1. Government of Canada Job Bank (most reliable Canadian source)
 *   2. Indeed Canada RSS
 *   3. WorkBC / BC Jobs
 *
 * GET /api/scrape-careers              — all trades, all provinces
 * GET /api/scrape-careers?trade=HVAC   — filter by trade
 * GET /api/scrape-careers?prov=ON      — filter by province
 *
 * Edge-cached 4 h. Vercel Cron warms cache every 4 h.
 *
 * Environment variables: none required (public RSS feeds)
 */

// ── Trade definitions ────────────────────────────────────────────────────────
const TRADES = [
  { trade: 'Electrical',            keywords: ['electrician','electrical apprentice','electrical contractor'],   icon: '⚡' },
  { trade: 'Plumbing',              keywords: ['plumber','plumbing apprentice','journeyman plumber'],            icon: '🔧' },
  { trade: 'HVAC',                  keywords: ['hvac technician','refrigeration mechanic','hvac apprentice'],   icon: '🌡️' },
  { trade: 'Roofing',               keywords: ['roofer','roofing','sheet metal roofer'],                        icon: '🏚️' },
  { trade: 'Welding & Fabrication', keywords: ['welder','welding fabrication','mig welder'],                    icon: '⚙️' },
  { trade: 'Millwright',            keywords: ['millwright','industrial mechanic'],                              icon: '🔩' },
  { trade: 'Carpentry',             keywords: ['carpenter','carpentry apprentice','framer'],                     icon: '🪚' },
  { trade: 'General Contracting',   keywords: ['general contractor','construction foreman','site supervisor'],  icon: '🏗️' },
  { trade: 'Sheet Metal',           keywords: ['sheet metal worker','ductwork installer','tinsmith'],           icon: '🔨' },
  { trade: 'Pipefitting',           keywords: ['pipefitter','steamfitter','gas fitter'],                        icon: '🛢️' },
  { trade: 'Concrete & Masonry',    keywords: ['concrete finisher','mason','bricklayer','drywaller'],           icon: '🧱' },
  { trade: 'Refrigeration',         keywords: ['refrigeration mechanic','refrigeration technician'],            icon: '❄️' },
  { trade: 'Painting & Coating',    keywords: ['industrial painter','spray painter','coatings applicator'],    icon: '🎨' },
  { trade: 'Ironworker',            keywords: ['ironworker','structural steel','reinforcing rod worker'],       icon: '🏛️' },
];

// Province map for location parsing
const CITY_PROVINCE = {
  'Toronto':'ON','Ottawa':'ON','Hamilton':'ON','Mississauga':'ON','Brampton':'ON',
  'London':'ON','Windsor':'ON','Kitchener':'ON','Barrie':'ON','Sudbury':'ON',
  'Thunder Bay':'ON','Oakville':'ON','Burlington':'ON','Oshawa':'ON','Kingston':'ON',
  'Guelph':'ON','Waterloo':'ON','Cambridge':'ON','St. Catharines':'ON','Sault Ste. Marie':'ON',
  'Brantford':'ON','Niagara Falls':'ON','North Bay':'ON','Peterborough':'ON',
  'Vancouver':'BC','Surrey':'BC','Burnaby':'BC','Richmond':'BC','Kelowna':'BC',
  'Victoria':'BC','Abbotsford':'BC','Kamloops':'BC','Prince George':'BC','Langley':'BC',
  'Calgary':'AB','Edmonton':'AB','Red Deer':'AB','Lethbridge':'AB','Fort McMurray':'AB',
  'Grande Prairie':'AB','Medicine Hat':'AB','Airdrie':'AB',
  'Regina':'SK','Saskatoon':'SK','Moose Jaw':'SK','Prince Albert':'SK',
  'Winnipeg':'MB','Brandon':'MB','Portage la Prairie':'MB',
  'Montreal':'QC','Quebec City':'QC','Laval':'QC','Gatineau':'QC',
  'Sherbrooke':'QC','Longueuil':'QC','Saguenay':'QC','Trois-Rivières':'QC',
  'Halifax':'NS','Dartmouth':'NS','Cape Breton':'NS',
  'Moncton':'NB','Fredericton':'NB','Saint John':'NB',
  "St. John's":'NL','Corner Brook':'NL',
  'Charlottetown':'PE',
  'Whitehorse':'YT','Yellowknife':'NT',
};

const PROVINCE_NAMES = {
  ON:'Ontario', BC:'British Columbia', AB:'Alberta', SK:'Saskatchewan',
  MB:'Manitoba', QC:'Quebec', NS:'Nova Scotia', NB:'New Brunswick',
  NL:'Newfoundland', PE:'PEI', YT:'Yukon', NT:'NWT', NU:'Nunavut',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function extractTag(xml, tag) {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(xml);
  if (cdata) return cdata[1].trim();
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
  if (plain) return plain[1].replace(/<[^>]+>/g, '').trim();
  return '';
}

function clean(str, maxLen = 280) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim()
    .slice(0, maxLen) + (str.length > maxLen ? '…' : '');
}

function parseLocation(locStr) {
  if (!locStr) return { city: '', province: '' };
  // "Toronto, ON", "Vancouver, BC", "Alberta", "Remote - Canada"
  const m1 = /^([^,\-–]+)[,\-–]\s*([A-Z]{2})\b/.exec(locStr.trim());
  if (m1) return { city: m1[1].trim(), province: m1[2] };
  const m2 = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z]{2})$/.exec(locStr.trim());
  if (m2) return { city: m2[1].trim(), province: m2[2] };
  // Province only?
  const provMatch = Object.entries(PROVINCE_NAMES).find(([code]) => locStr.toUpperCase().includes(code));
  if (provMatch) return { city: '', province: provMatch[0] };
  return { city: locStr.trim(), province: '' };
}

function resolveProvince(city, province) {
  if (province && province.length === 2) return province;
  return CITY_PROVINCE[city] || '';
}

function detectExperience(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  if (/\b(apprentice|1st year|2nd year|3rd year|4th year|pre-apprentice|entry.?level|no experience)\b/.test(text)) return 'Apprenticeship / Entry Level';
  if (/\b(journeyman|journeyperson|certificate of qualification|cq holder|red seal|red-seal|inter.?provincial)\b/.test(text)) return 'Journeyman / Red Seal';
  if (/\b(foreman|supervisor|lead hand|master electrician|master plumber|senior)\b/.test(text)) return 'Senior / Supervisor';
  return 'Experienced';
}

function detectType(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  if (/\b(apprentice|apprenticeship|co-op|summer student|intern)\b/.test(text)) return 'Apprenticeship';
  if (/\bpart.?time\b/.test(text)) return 'Part-time';
  if (/\b(contract|subcontract|sub-contract|project.?based|temporary)\b/.test(text)) return 'Contract';
  return 'Full-time';
}

function makeJobId(source, link) {
  const str = (source + link).toLowerCase().replace(/[^a-z0-9]/g, '');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return 'jb_' + (h >>> 0).toString(36);
}

// ── Source: Government of Canada Job Bank ────────────────────────────────────
// Public RSS feed — no API key needed, returns structured trade job data
const JOB_BANK_BASE = 'https://www.jobbank.gc.ca/jobsearch/rss';

async function fetchJobBank(tradeObj) {
  const keyword = tradeObj.keywords[0];
  const url = `${JOB_BANK_BASE}?searchstring=${encodeURIComponent(keyword)}&locationstring=Canada&date=14&sort=D`;
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'BookYourTrades-JobScraper/1.0 (+https://bookyourtrades.com)', 'Accept': 'application/rss+xml, text/xml, */*' }
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    return items.slice(0, 15).map(m => {
      const item  = m[1];
      const title = extractTag(item, 'title');
      const link  = extractTag(item, 'link') || extractTag(item, 'guid');
      const desc  = clean(extractTag(item, 'description'));
      const locRaw = extractTag(item, 'location') || extractTag(item, 'georss:featureName') || '';
      const company = extractTag(item, 'jobLocation') || extractTag(item, 'author') || '';
      const wage    = extractTag(item, 'salary') || extractTag(item, 'baseSalary') || '';
      const pubDate = extractTag(item, 'pubDate') || extractTag(item, 'published') || '';
      const date    = pubDate ? new Date(pubDate) : new Date();
      if (!title || !link) return null;

      // Job Bank title format: "Job Title - Company - City, Province"
      // OR "Job Title (Company) – City"
      let parsedTitle = title, parsedCompany = company, parsedLocStr = locRaw;
      const dashParts = title.split(/\s+[–\-]\s+/);
      if (dashParts.length >= 3) {
        parsedTitle    = dashParts[0].trim();
        parsedCompany  = dashParts[1].trim();
        parsedLocStr   = dashParts.slice(2).join(' - ').trim();
      } else if (dashParts.length === 2 && !locRaw) {
        parsedTitle   = dashParts[0].trim();
        parsedLocStr  = dashParts[1].trim();
      }
      const { city, province } = parseLocation(parsedLocStr || locRaw);
      const resolvedProv = resolveProvince(city, province);

      return {
        id: makeJobId('jb', link),
        title: parsedTitle,
        company: parsedCompany || 'Employer on Job Bank',
        location: city ? city + (resolvedProv ? ', ' + resolvedProv : '') : (parsedLocStr || 'Canada'),
        city, province: resolvedProv,
        trade: tradeObj.trade, icon: tradeObj.icon,
        type: detectType(parsedTitle, desc),
        experience: detectExperience(parsedTitle, desc),
        wage: wage ? clean(wage, 60) : '',
        description: desc,
        link, source: 'Job Bank Canada',
        sourceUrl: 'https://www.jobbank.gc.ca',
        sourceBadge: '🍁',
        pubDate: isNaN(date) ? new Date().toISOString() : date.toISOString(),
        displayDate: isNaN(date) ? 'Recently' : date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    }).filter(Boolean);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ── Source: Indeed Canada ────────────────────────────────────────────────────
const INDEED_BASE = 'https://ca.indeed.com/rss';

async function fetchIndeed(tradeObj) {
  const keyword = tradeObj.keywords[0];
  const url = `${INDEED_BASE}?q=${encodeURIComponent(keyword)}&l=Canada&sort=date&limit=15&fromage=14`;
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookYourTrades/1.0)', 'Accept': 'application/rss+xml, text/xml, */*' }
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    return items.slice(0, 12).map(m => {
      const item    = m[1];
      const title   = extractTag(item, 'title').replace(/\s*-\s*(indeed\.ca|ca\.indeed\.com).*$/i, '').trim();
      const link    = extractTag(item, 'link') || extractTag(item, 'guid');
      const desc    = clean(extractTag(item, 'description'));
      const locRaw  = extractTag(item, 'location') || '';
      const company = extractTag(item, 'source') || '';
      const pubDate = extractTag(item, 'pubDate') || '';
      const date    = pubDate ? new Date(pubDate) : new Date();
      if (!title || !link) return null;

      const { city, province } = parseLocation(locRaw);
      const resolvedProv = resolveProvince(city, province);

      // Filter out non-Canadian results
      if (province && !PROVINCE_NAMES[province]) return null;

      return {
        id: makeJobId('in', link),
        title, company: company || 'Employer on Indeed',
        location: city ? city + (resolvedProv ? ', ' + resolvedProv : '') : (locRaw || 'Canada'),
        city, province: resolvedProv,
        trade: tradeObj.trade, icon: tradeObj.icon,
        type: detectType(title, desc),
        experience: detectExperience(title, desc),
        wage: '',
        description: desc,
        link, source: 'Indeed Canada',
        sourceUrl: 'https://ca.indeed.com',
        sourceBadge: '📋',
        pubDate: isNaN(date) ? new Date().toISOString() : date.toISOString(),
        displayDate: isNaN(date) ? 'Recently' : date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    }).filter(Boolean);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ── Source: WorkBC / BC Trades (Job Bank BC query) ───────────────────────────
async function fetchWorkBC(tradeObj) {
  const keyword = tradeObj.keywords[0];
  const url = `${JOB_BANK_BASE}?searchstring=${encodeURIComponent(keyword)}&locationstring=British+Columbia&prov=BC&date=14&sort=D`;
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'BookYourTrades-JobScraper/1.0 (+https://bookyourtrades.com)', 'Accept': 'application/rss+xml, text/xml, */*' }
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    return items.slice(0, 8).map(m => {
      const item  = m[1];
      const title = extractTag(item, 'title');
      const link  = extractTag(item, 'link') || extractTag(item, 'guid');
      const desc  = clean(extractTag(item, 'description'));
      const locRaw = extractTag(item, 'location') || '';
      const pubDate = extractTag(item, 'pubDate') || '';
      const date    = pubDate ? new Date(pubDate) : new Date();
      if (!title || !link) return null;
      const dashParts = title.split(/\s+[–\-]\s+/);
      const parsedTitle   = dashParts[0] || title;
      const parsedCompany = dashParts[1] || '';
      const parsedLoc     = dashParts.slice(2).join(' ').trim() || locRaw;
      const { city, province } = parseLocation(parsedLoc || 'BC');
      const resolvedProv = resolveProvince(city, province || 'BC');
      return {
        id: makeJobId('wbc', link),
        title: parsedTitle.trim(), company: parsedCompany.trim() || 'BC Employer',
        location: city ? city + ', BC' : 'British Columbia',
        city, province: resolvedProv || 'BC',
        trade: tradeObj.trade, icon: tradeObj.icon,
        type: detectType(parsedTitle, desc),
        experience: detectExperience(parsedTitle, desc),
        wage: '', description: desc,
        link, source: 'Job Bank — BC',
        sourceUrl: 'https://www.workbc.ca',
        sourceBadge: '🏔️',
        pubDate: isNaN(date) ? new Date().toISOString() : date.toISOString(),
        displayDate: isNaN(date) ? 'Recently' : date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    }).filter(Boolean);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ── Source: Alberta Job Bank ─────────────────────────────────────────────────
async function fetchAlberta(tradeObj) {
  const keyword = tradeObj.keywords[0];
  const url = `${JOB_BANK_BASE}?searchstring=${encodeURIComponent(keyword)}&locationstring=Alberta&prov=AB&date=14&sort=D`;
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'BookYourTrades-JobScraper/1.0 (+https://bookyourtrades.com)', 'Accept': 'application/rss+xml, text/xml, */*' }
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    return items.slice(0, 8).map(m => {
      const item  = m[1];
      const title = extractTag(item, 'title');
      const link  = extractTag(item, 'link') || extractTag(item, 'guid');
      const desc  = clean(extractTag(item, 'description'));
      const pubDate = extractTag(item, 'pubDate') || '';
      const date    = pubDate ? new Date(pubDate) : new Date();
      if (!title || !link) return null;
      const dashParts = title.split(/\s+[–\-]\s+/);
      const parsedTitle   = (dashParts[0] || title).trim();
      const parsedCompany = (dashParts[1] || '').trim();
      const parsedLoc     = dashParts.slice(2).join(' ').trim();
      const { city } = parseLocation(parsedLoc || 'AB');
      return {
        id: makeJobId('ab', link),
        title: parsedTitle, company: parsedCompany || 'Alberta Employer',
        location: city ? city + ', AB' : 'Alberta',
        city, province: 'AB',
        trade: tradeObj.trade, icon: tradeObj.icon,
        type: detectType(parsedTitle, desc),
        experience: detectExperience(parsedTitle, desc),
        wage: '', description: desc,
        link, source: 'Job Bank — Alberta',
        sourceUrl: 'https://alis.alberta.ca',
        sourceBadge: '🛢️',
        pubDate: isNaN(date) ? new Date().toISOString() : date.toISOString(),
        displayDate: isNaN(date) ? 'Recently' : date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    }).filter(Boolean);
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

  // 4-hour CDN cache + 1-hour stale
  res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=3600');

  const tradeFilter = (req.query?.trade || '').toLowerCase().trim();
  const provFilter  = (req.query?.prov  || '').toUpperCase().trim();

  // Select trades to scrape
  const tradesToFetch = tradeFilter
    ? TRADES.filter(t => t.trade.toLowerCase().includes(tradeFilter) || t.keywords.some(k => k.includes(tradeFilter)))
    : TRADES;

  // Fan out all fetches concurrently
  const fetches = tradesToFetch.flatMap(t => [
    fetchJobBank(t),
    fetchIndeed(t),
    fetchWorkBC(t),
    fetchAlberta(t),
  ]);

  const settled = await Promise.allSettled(fetches);
  let jobs = settled
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Deduplicate by id, then by normalised title+company
  const seenIds  = new Set();
  const seenKeys = new Set();
  jobs = jobs.filter(j => {
    if (seenIds.has(j.id)) return false;
    seenIds.add(j.id);
    const key = (j.title + '|' + j.company).toLowerCase().replace(/[^a-z0-9|]/g, '');
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  // Apply province filter if requested
  if (provFilter) jobs = jobs.filter(j => j.province === provFilter);

  // Sort newest-first
  jobs.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Summarise sources
  const bySource = {};
  jobs.forEach(j => { bySource[j.source] = (bySource[j.source] || 0) + 1; });

  return res.status(200).json({
    jobs,
    total:   jobs.length,
    sources: bySource,
    trades:  [...new Set(jobs.map(j => j.trade))].sort(),
    provinces: [...new Set(jobs.map(j => j.province).filter(Boolean))].sort(),
    fetched: new Date().toISOString(),
  });
};
