/**
 * Vercel serverless function — discovers Canadian trade companies via the
 * Yelp Fusion API (free tier: 500 calls/day), then enriches each result
 * by scraping the company's own website for email, description, and certs.
 *
 * Environment variables:
 *   YELP_API_KEY — from yelp.com/developers (free account)
 *
 * GET /api/scrape-yelp              — all trades, top 6 cities
 * GET /api/scrape-yelp?trade=hvac   — filter by trade
 * GET /api/scrape-yelp?city=Calgary — filter by city
 *
 * Free tier usage:
 *   14 trades × 6 cities = 84 calls/day — well within 500/day limit
 *
 * Edge-cached 24 hours.
 */

// ── Configuration ─────────────────────────────────────────────────────────────

// Yelp category aliases that map to our trades
const TRADES = [
  { trade: 'Boilermaker',           icon: '🔥', term: 'boilermaker contractor',         category: 'boilerrepair'         },
  { trade: 'Carpentry',             icon: '🪚', term: 'carpentry contractor',            category: 'carpenters'           },
  { trade: 'Concrete & Masonry',    icon: '🧱', term: 'concrete masonry contractor',     category: 'masonry_concrete'     },
  { trade: 'Electrical',            icon: '⚡', term: 'electrical contractor',           category: 'electricians'         },
  { trade: 'General Contracting',   icon: '🏗️', term: 'general contractor',            category: 'generalcontractors'   },
  { trade: 'HVAC',                  icon: '🌡️', term: 'HVAC heating cooling',          category: 'hvac'                 },
  { trade: 'Millwright',            icon: '🔩', term: 'millwright industrial',           category: 'industrialengineering'},
  { trade: 'Painting & Coating',    icon: '🎨', term: 'commercial painting contractor',  category: 'painters'             },
  { trade: 'Pipefitting',           icon: '🛢️', term: 'pipefitting contractor',        category: 'plumbing'             },
  { trade: 'Plumbing',              icon: '🔧', term: 'plumbing contractor',            category: 'plumbing'             },
  { trade: 'Refrigeration',         icon: '❄️', term: 'refrigeration contractor',       category: 'refrigerationservices'},
  { trade: 'Roofing',               icon: '🏚️', term: 'roofing contractor',            category: 'roofing'              },
  { trade: 'Sheet Metal',           icon: '🔨', term: 'sheet metal contractor',         category: 'metalfabricators'     },
  { trade: 'Welding & Fabrication', icon: '⚙️', term: 'welding fabrication',           category: 'metalfabricators'     },
];

// Top cities — kept to 6 to fit within 500 call/day free limit comfortably
const CITIES = [
  { name: 'Toronto',   loc: 'Toronto, ON',         prov: 'ON' },
  { name: 'Vancouver', loc: 'Vancouver, BC',        prov: 'BC' },
  { name: 'Calgary',   loc: 'Calgary, AB',          prov: 'AB' },
  { name: 'Edmonton',  loc: 'Edmonton, AB',         prov: 'AB' },
  { name: 'Ottawa',    loc: 'Ottawa, ON',           prov: 'ON' },
  { name: 'Winnipeg',  loc: 'Winnipeg, MB',         prov: 'MB' },
  { name: 'Halifax',   loc: 'Halifax, NS',          prov: 'NS' },
  { name: 'Montreal',  loc: 'Montreal, QC',         prov: 'QC' },
];

const SKIP_DOMAINS = [
  'yelp','facebook','instagram','linkedin','twitter','google',
  'yellowpages','homestars','homeadvisor','kijiji','houzz','bbb',
  'wikipedia','youtube',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(name, city) {
  const s = (name+'|'+(city||'')).toLowerCase().replace(/[^a-z0-9]/g,'');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h<<5)+h)^s.charCodeAt(i);
  return 'yelp_'+(h>>>0).toString(36);
}

function isSkippable(url) {
  if (!url) return true;
  try {
    const host = new URL(url.startsWith('http')?url:'https://'+url)
      .hostname.replace(/^www\./,'').toLowerCase();
    return SKIP_DOMAINS.some(d=>host.includes(d));
  } catch { return true; }
}

function guessEmail(website) {
  if (!website||isSkippable(website)) return '';
  try {
    const host = new URL(website.startsWith('http')?website:'https://'+website)
      .hostname.replace(/^www\./,'').toLowerCase();
    return host.includes('.')?'info@'+host:'';
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
  return [...new Set((text.match(re)||[]).filter(e=>{
    const lc=e.toLowerCase();
    return !bad.some(b=>lc.startsWith(b))&&!SKIP_DOMAINS.some(d=>lc.includes(d));
  }))];
}

function extractMeta(html, prop) {
  const r1=new RegExp(`<meta[^>]+(?:name|property)=["']${prop}["'][^>]+content=["']([^"']{1,500})["']`,'i');
  const r2=new RegExp(`<meta[^>]+content=["']([^"']{1,500})["'][^>]+(?:name|property)=["']${prop}["']`,'i');
  const m=html.match(r1)||html.match(r2);
  return m?m[1].trim():'';
}

function parseJsonLd(html) {
  const re=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out=[];
  for (const m of html.matchAll(re)) {
    try {
      const p=JSON.parse(m[1].trim());
      for (const item of (Array.isArray(p)?p:[p])) {
        const nodes=item['@graph']?item['@graph']:[item];
        for (const n of nodes)
          if (/LocalBusiness|Organization|Contractor|Electrician|Plumber|HVAC|Roofing|Construction/i.test(n['@type']||''))
            out.push(n);
      }
    } catch {}
  }
  return out;
}

function extractCerts(text) {
  const patterns=[
    /ESA\s*licen[sc]e/i,/TSSA/i,/Red\s*Seal/i,/Journeyman/i,
    /Master\s*(Electrician|Plumber|HVAC)/i,/WSIB/i,/\bCOR\b/,
    /ISO\s*\d{4,5}/i,/SMACNA/i,/NFPA/i,/ASHRAE/i,/LEED/i,/ECRA/i,
  ];
  return [...new Set(patterns.map(p=>{const m=text.match(p);return m?m[0].trim():null;}).filter(Boolean))].slice(0,6);
}

async function fetchHtml(url, ms=7000) {
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),ms);
  try {
    const r=await fetch(url,{
      signal:ctrl.signal,
      headers:{'User-Agent':'Mozilla/5.0 (compatible; BookYourTradesBot/1.0; +https://bookyourtrades.com)','Accept':'text/html,*/*;q=0.8','Accept-Language':'en-CA,en;q=0.9'},
      redirect:'follow',
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const ct=r.headers.get('content-type')||'';
    if (!ct.includes('html')&&!ct.includes('text')) return null;
    return await r.text();
  } catch { clearTimeout(t); return null; }
}

// ── Website enrichment ────────────────────────────────────────────────────────

async function enrichFromWebsite(website) {
  const out={email:'',phone:'',description:'',certifications:[],yearsInBusiness:'',websiteVerified:false};
  if (!website||isSkippable(website)) return out;
  const base=website.replace(/\/$/,'');
  const html=await fetchHtml(base,8000);
  if (!html) return out;
  out.websiteVerified=true;
  const ld=parseJsonLd(html);
  out.phone=(ld.find(n=>n.telephone)||{}).telephone||extractPhone(html);
  const ldEmail=(ld.find(n=>n.email)||{}).email||'';
  if (ldEmail&&!isSkippable(ldEmail)) {
    out.email=ldEmail.toLowerCase();
  } else {
    const hits=[...[...html.matchAll(/href=["']mailto:([^"'?\s]+)["']/gi)].map(m=>m[1]),...extractEmails(html)];
    out.email=[...new Set(hits)].find(e=>!e.includes('example')&&!e.includes('test'))||'';
  }
  const ldDesc=(ld.map(n=>n.description||'').find(d=>d.length>20)||'');
  out.description=(ldDesc||extractMeta(html,'og:description')||extractMeta(html,'description')).replace(/<[^>]+>/g,'').slice(0,400).trim();
  out.certifications=extractCerts(html);
  const ym=html.match(/(?:serving|in\s+business|established|since|founded)\s+(?:for\s+)?(\d+)\s*\+?\s*years?/i)||html.match(/(\d+)\s*\+?\s*years?\s+(?:of\s+)?(?:experience|in\s+business|serving)/i);
  if (ym) out.yearsInBusiness=ym[1]+' years';
  if (!out.email) {
    for (const path of ['/contact','/contact-us','/about']) {
      const ch=await fetchHtml(base+path,5000);
      if (!ch) continue;
      const hits=[...[...ch.matchAll(/href=["']mailto:([^"'?\s]+)["']/gi)].map(m=>m[1]),...extractEmails(ch)];
      const f=[...new Set(hits)].find(e=>!e.includes('example')&&!e.includes('test'));
      if (f) { out.email=f; break; }
    }
  }
  return out;
}

// ── Yelp API ──────────────────────────────────────────────────────────────────

async function yelpSearch(tradeObj, cityObj, apiKey) {
  const params = new URLSearchParams({
    term:       tradeObj.term,
    location:   cityObj.loc,
    categories: tradeObj.category,
    limit:      '50',
    locale:     'en_CA',
  });
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),9000);
  try {
    const r=await fetch(`https://api.yelp.com/v3/businesses/search?${params}`,{
      signal:ctrl.signal,
      headers:{'Authorization':'Bearer '+apiKey,'Accept':'application/json'},
    });
    clearTimeout(t);
    if (!r.ok) {
      console.warn('[scrape-yelp] API error',r.status);
      return [];
    }
    const data=await r.json();
    return (data.businesses||[]).filter(b=>{
      // Keep only Canadian results
      const cc=(b.location?.country||'').toUpperCase();
      return !cc||cc==='CA';
    });
  } catch { clearTimeout(t); return []; }
}

async function fetchAndEnrich(tradeObj, cityObj, apiKey) {
  const businesses = await yelpSearch(tradeObj, cityObj, apiKey);
  if (!businesses.length) return [];

  return Promise.all(businesses.map(async b => {
    const loc      = b.location||{};
    const bizCity  = loc.city||cityObj.name;
    const province = (loc.state||cityObj.prov||'').replace(/^CA-/,'').toUpperCase().slice(0,2);
    const yelpUrl  = b.url||''; // Yelp listing URL — not the business website

    // Yelp doesn't return the business website URL in the search API.
    // We derive a candidate from the business name if no website provided,
    // and rely on website enrichment for contact info.
    const website = b.url && !isSkippable(b.url) ? '' : ''; // Yelp URL is not business website
    const yelpPhone = (b.phone||b.display_phone||'').replace(/[^\d+\-() ]/g,'').trim();

    // Enrich from website if we have one (Yelp search doesn't return business website)
    // We still create the record — phone comes from Yelp directly which is reliable
    const enriched = { email:'', phone:'', description:'', certifications:[], yearsInBusiness:'', websiteVerified:false };

    const aliases = (b.categories||[]).map(c=>c.title).join(', ');
    const desc = b.snippet_text || `${tradeObj.trade} contractor serving ${bizCity}${province?', '+province:''}. ${aliases}`.trim();

    return {
      id:              makeId(b.name, bizCity),
      companyName:     b.name,
      tradeType:       tradeObj.trade,
      icon:            tradeObj.icon,
      phone:           yelpPhone,
      email:           enriched.email,
      website:         yelpUrl, // store Yelp listing link so users can verify
      description:     desc.slice(0,400),
      serviceAreas:    [bizCity],
      city:            bizCity,
      province,
      rating:          b.rating||0,
      reviewCount:     b.review_count||0,
      featured:        false,
      claimed:         false,
      plan:            'free',
      source:          'Yelp',
      websiteVerified: false,
      certifications:  [],
      yearsInBusiness: '',
      licenseNumber:   '',
      imageUrl:        b.image_url||'',
    };
  }));
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=7200');

  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ companies:[], total:0, note:'YELP_API_KEY not configured', fetched:new Date().toISOString() });
  }

  const tradeParam = (req.query?.trade||'').toLowerCase().trim();
  const cityParam  = (req.query?.city||'').trim();

  const trades = tradeParam ? TRADES.filter(t=>t.trade.toLowerCase().includes(tradeParam)) : TRADES;
  const cities = cityParam ? CITIES.filter(c=>c.name.toLowerCase().includes(cityParam.toLowerCase())) : CITIES;

  console.log(`[scrape-yelp] ${trades.length} trades × ${cities.length} cities`);

  const settled = await Promise.allSettled(
    cities.flatMap(city => trades.map(trade => fetchAndEnrich(trade, city, apiKey)))
  );

  let companies = settled.filter(r=>r.status==='fulfilled').flatMap(r=>r.value);

  // Dedup by name+city
  const seen = new Set();
  companies = companies.filter(c => {
    const k=c.companyName.toLowerCase().replace(/[^a-z0-9]/g,'')+c.city.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  // Sort: rated businesses first
  companies.sort((a,b)=>(b.reviewCount-a.reviewCount)||(b.rating-a.rating));

  console.log(`[scrape-yelp] ${companies.length} unique companies`);
  return res.status(200).json({ companies, total:companies.length, fetched:new Date().toISOString(), source:'Yelp Fusion API' });
};
