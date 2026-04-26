/**
 * Mega-aggregator — all Canadian trade company scrapers in one function.
 * Consolidated to stay within Vercel Hobby plan's 12-function limit.
 *
 * Sources (all free, no paid API required):
 *   1. Foursquare Places API  — free 1,000 calls/day, returns website URL
 *   2. HomeStars              — no API key, Canadian-specific JSON-LD
 *   3. Yelp Fusion API        — free 500 calls/day, returns phone + address
 *   4. Yellow Pages Canada    — HTML scraping with JSON-LD extraction
 *   5. OpenStreetMap          — Overpass API, free, has lat/lng
 *
 * Every result with a website URL is enriched by visiting the company's
 * own website to extract email, phone, description, and certifications.
 *
 * GET /api/scrape-all              — run all sources
 * GET /api/scrape-all?source=fsq   — foursquare only
 * GET /api/scrape-all?source=hs    — homestars only
 * GET /api/scrape-all?source=yelp  — yelp only
 * GET /api/scrape-all?source=yp    — yellow pages only
 * GET /api/scrape-all?source=osm   — openstreetmap only
 * GET /api/scrape-all?batch=1      — second city batch (Foursquare)
 *
 * Edge-cached 24 h. Vercel Cron hits this daily at 05:00 UTC.
 *
 * Environment variables:
 *   FOURSQUARE_API_KEY  — developer.foursquare.com (free)
 *   YELP_API_KEY        — yelp.com/developers (free)
 */

// ── Shared trade definitions ──────────────────────────────────────────────────

const TRADES = [
  { trade: 'Boilermaker',           icon: '🔥', fsqQuery: 'boilermaker contractor',           yelpTerm: 'boilermaker contractor',          yelpCat: 'boilerrepair',          hsSlug: 'boiler-repair-services'          },
  { trade: 'Carpentry',             icon: '🪚', fsqQuery: 'carpentry contractor',              yelpTerm: 'carpentry contractor',             yelpCat: 'carpenters',            hsSlug: 'carpenters-joiners'              },
  { trade: 'Concrete & Masonry',    icon: '🧱', fsqQuery: 'concrete masonry contractor',       yelpTerm: 'concrete masonry contractor',      yelpCat: 'masonry_concrete',      hsSlug: 'concrete-masonry-stonework'      },
  { trade: 'Electrical',            icon: '⚡', fsqQuery: 'electrical contractor',             yelpTerm: 'electrical contractor',            yelpCat: 'electricians',          hsSlug: 'electricians'                    },
  { trade: 'General Contracting',   icon: '🏗️', fsqQuery: 'general contractor construction',  yelpTerm: 'general contractor',               yelpCat: 'generalcontractors',    hsSlug: 'general-contractors'             },
  { trade: 'HVAC',                  icon: '🌡️', fsqQuery: 'HVAC heating cooling contractor',  yelpTerm: 'HVAC heating cooling',             yelpCat: 'hvac',                  hsSlug: 'heating-cooling'                 },
  { trade: 'Millwright',            icon: '🔩', fsqQuery: 'millwright industrial contractor',  yelpTerm: 'millwright industrial',            yelpCat: 'industrialengineering', hsSlug: 'industrial-services'             },
  { trade: 'Painting & Coating',    icon: '🎨', fsqQuery: 'commercial painting contractor',    yelpTerm: 'commercial painting contractor',   yelpCat: 'painters',              hsSlug: 'painters-decorators'             },
  { trade: 'Pipefitting',           icon: '🛢️', fsqQuery: 'pipefitting contractor',           yelpTerm: 'pipefitting contractor',           yelpCat: 'plumbing',              hsSlug: 'plumbers-drain-pipe'             },
  { trade: 'Plumbing',              icon: '🔧', fsqQuery: 'plumbing contractor',              yelpTerm: 'plumbing contractor',              yelpCat: 'plumbing',              hsSlug: 'plumbers-drain-pipe'             },
  { trade: 'Refrigeration',         icon: '❄️', fsqQuery: 'refrigeration contractor',         yelpTerm: 'refrigeration contractor',         yelpCat: 'refrigerationservices', hsSlug: 'refrigeration'                   },
  { trade: 'Roofing',               icon: '🏚️', fsqQuery: 'roofing contractor commercial',    yelpTerm: 'roofing contractor',               yelpCat: 'roofing',               hsSlug: 'roofers'                         },
  { trade: 'Sheet Metal',           icon: '🔨', fsqQuery: 'sheet metal contractor',           yelpTerm: 'sheet metal contractor',           yelpCat: 'metalfabricators',      hsSlug: 'sheet-metal-hvac'                },
  { trade: 'Welding & Fabrication', icon: '⚙️', fsqQuery: 'welding fabrication contractor',   yelpTerm: 'welding fabrication',              yelpCat: 'metalfabricators',      hsSlug: 'welding-services'                },
];

const CITIES_0 = [
  { name: 'Toronto',   loc: 'Toronto, Ontario, Canada',              yelpLoc: 'Toronto, ON',    hslug: 'toronto--on',    prov: 'ON' },
  { name: 'Vancouver', loc: 'Vancouver, British Columbia, Canada',   yelpLoc: 'Vancouver, BC',  hslug: 'vancouver--bc',  prov: 'BC' },
  { name: 'Calgary',   loc: 'Calgary, Alberta, Canada',              yelpLoc: 'Calgary, AB',    hslug: 'calgary--ab',    prov: 'AB' },
  { name: 'Edmonton',  loc: 'Edmonton, Alberta, Canada',             yelpLoc: 'Edmonton, AB',   hslug: 'edmonton--ab',   prov: 'AB' },
  { name: 'Ottawa',    loc: 'Ottawa, Ontario, Canada',               yelpLoc: 'Ottawa, ON',     hslug: 'ottawa--on',     prov: 'ON' },
  { name: 'Winnipeg',  loc: 'Winnipeg, Manitoba, Canada',            yelpLoc: 'Winnipeg, MB',   hslug: 'winnipeg--mb',   prov: 'MB' },
  { name: 'Hamilton',  loc: 'Hamilton, Ontario, Canada',             yelpLoc: 'Hamilton, ON',   hslug: 'hamilton--on',   prov: 'ON' },
  { name: 'Halifax',   loc: 'Halifax, Nova Scotia, Canada',          yelpLoc: 'Halifax, NS',    hslug: 'halifax--ns',    prov: 'NS' },
];
const CITIES_1 = [
  { name: 'Montreal',  loc: 'Montreal, Quebec, Canada',              yelpLoc: 'Montreal, QC',   hslug: 'montreal--qc',   prov: 'QC' },
  { name: 'Regina',    loc: 'Regina, Saskatchewan, Canada',          yelpLoc: 'Regina, SK',     hslug: 'regina--sk',     prov: 'SK' },
  { name: 'Saskatoon', loc: 'Saskatoon, Saskatchewan, Canada',       yelpLoc: 'Saskatoon, SK',  hslug: 'saskatoon--sk',  prov: 'SK' },
  { name: 'Victoria',  loc: 'Victoria, British Columbia, Canada',    yelpLoc: 'Victoria, BC',   hslug: 'victoria--bc',   prov: 'BC' },
  { name: 'Kelowna',   loc: 'Kelowna, British Columbia, Canada',     yelpLoc: 'Kelowna, BC',    hslug: 'kelowna--bc',    prov: 'BC' },
  { name: 'London',    loc: 'London, Ontario, Canada',               yelpLoc: 'London, ON',     hslug: 'london--on',     prov: 'ON' },
  { name: 'Windsor',   loc: 'Windsor, Ontario, Canada',              yelpLoc: 'Windsor, ON',    hslug: 'windsor--on',    prov: 'ON' },
  { name: 'Moncton',   loc: 'Moncton, New Brunswick, Canada',        yelpLoc: 'Moncton, NB',    hslug: 'moncton--nb',    prov: 'NB' },
];
const ALL_CITIES = [...CITIES_0, ...CITIES_1];

const CITY_PROV = {
  'Toronto':'ON','Ottawa':'ON','Hamilton':'ON','Mississauga':'ON','Brampton':'ON','London':'ON','Windsor':'ON','Barrie':'ON','Sudbury':'ON','Oakville':'ON','Kitchener':'ON',
  'Vancouver':'BC','Victoria':'BC','Kelowna':'BC','Surrey':'BC','Burnaby':'BC','Abbotsford':'BC','Richmond':'BC','Kamloops':'BC',
  'Calgary':'AB','Edmonton':'AB','Red Deer':'AB','Lethbridge':'AB','Fort McMurray':'AB',
  'Regina':'SK','Saskatoon':'SK',
  'Winnipeg':'MB','Brandon':'MB',
  'Montreal':'QC','Quebec City':'QC','Laval':'QC','Gatineau':'QC','Sherbrooke':'QC',
  'Halifax':'NS','Moncton':'NB','Fredericton':'NB','Saint John':'NB',"St. John's":'NL','Charlottetown':'PE',
};

const YP_CITIES = ['Toronto','Vancouver','Calgary','Edmonton','Ottawa','Winnipeg','Hamilton','Halifax','London','Regina','Saskatoon','Victoria','Kelowna','Montreal','Windsor','Moncton'];

const SKIP_DOMAINS = ['foursquare','facebook','instagram','linkedin','twitter','yelp','google','yellowpages','homestars','homeadvisor','kijiji','houzz','bbb','wikipedia','youtube','tiktok'];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function makeId(prefix, name, city) {
  const s = (name+'|'+(city||'')).toLowerCase().replace(/[^a-z0-9]/g,'');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h<<5)+h)^s.charCodeAt(i);
  return prefix+'_'+(h>>>0).toString(36);
}

function isSkippable(url) {
  if (!url) return true;
  try {
    const host = new URL(url.startsWith('http')?url:'https://'+url).hostname.replace(/^www\./,'').toLowerCase();
    return SKIP_DOMAINS.some(d=>host.includes(d));
  } catch { return true; }
}

function guessEmail(website) {
  if (!website||isSkippable(website)) return '';
  try {
    const host = new URL(website.startsWith('http')?website:'https://'+website).hostname.replace(/^www\./,'').toLowerCase();
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
          if (/LocalBusiness|Organization|Contractor|Electrician|Plumber|HVAC|Roofing|Construction|HomeAndConstruction/i.test(n['@type']||''))
            out.push(n);
      }
    } catch {}
  }
  return out;
}

function extractCerts(text) {
  const pats=[/ESA\s*licen[sc]e/i,/TSSA/i,/Red\s*Seal/i,/Journeyman/i,/Master\s*(Electrician|Plumber|HVAC)/i,/WSIB/i,/\bCOR\b/,/ISO\s*\d{4,5}/i,/SMACNA/i,/NFPA/i,/ASHRAE/i,/LEED/i,/ECRA/i];
  return [...new Set(pats.map(p=>{const m=text.match(p);return m?m[0].trim():null;}).filter(Boolean))].slice(0,6);
}

async function fetchHtml(url, ms=7000) {
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),ms);
  try {
    const r=await fetch(url,{
      signal:ctrl.signal,
      headers:{'User-Agent':UA,'Accept':'text/html,*/*;q=0.8','Accept-Language':'en-CA,en;q=0.9'},
      redirect:'follow',
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const ct=r.headers.get('content-type')||'';
    if (!ct.includes('html')&&!ct.includes('text')) return null;
    return await r.text();
  } catch { clearTimeout(t); return null; }
}

// ── Website enrichment (visits the actual company website) ────────────────────

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

// ── SOURCE 1: Foursquare Places API ──────────────────────────────────────────

async function fetchFoursquare(cities, apiKey) {
  if (!apiKey) return [];
  const authHeader = apiKey.startsWith('fsq3') ? apiKey : `fsq3${apiKey}`;
  const FSQ = 'https://api.foursquare.com/v3/places/search';
  const FIELDS = 'fsq_id,name,location,tel,website,rating,stats,categories';

  async function search(trade, city) {
    const url=`${FSQ}?query=${encodeURIComponent(trade.fsqQuery)}&near=${encodeURIComponent(city.loc)}&limit=50&fields=${FIELDS}`;
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),9000);
    try {
      const r=await fetch(url,{signal:ctrl.signal,headers:{'Authorization':authHeader,'Accept':'application/json'}});
      clearTimeout(t);
      if (!r.ok) { console.warn('[fsq] error',r.status); return []; }
      const d=await r.json();
      return (d.results||[]).filter(r=>{
        const cc=(r.location?.country||r.location?.cc||'').toUpperCase();
        return !cc||cc==='CA'||cc==='CANADA';
      });
    } catch { clearTimeout(t); return []; }
  }

  const pairs = cities.flatMap(city=>TRADES.map(trade=>({trade,city})));
  const settled = await Promise.allSettled(pairs.map(({trade,city})=>search(trade,city)));

  const rawResults = settled.filter(r=>r.status==='fulfilled').flatMap((r,i)=>{
    const {trade,city} = pairs[i];
    return (r.value||[]).map(b=>({b,trade,city}));
  });

  return Promise.all(rawResults.map(async ({b,trade,city})=>{
    const loc=b.location||{};
    const bizCity=loc.locality||loc.city||city.name;
    const prov=(loc.region||CITY_PROV[bizCity]||city.prov||'').replace(/^CA-/,'').slice(0,2).toUpperCase();
    const website=b.website||'';
    const fsqPhone=(b.tel||'').replace(/[^\d+\-() ]/g,'').trim();
    const enriched=await enrichFromWebsite(website);
    return {
      id:makeId('fsq',b.name,bizCity),
      companyName:b.name,tradeType:trade.trade,icon:trade.icon,
      phone:enriched.phone||fsqPhone,email:enriched.email||guessEmail(website),website,
      description:enriched.description||`${trade.trade} contractor serving ${bizCity}${prov?', '+prov:''}.`,
      serviceAreas:[bizCity],city:bizCity,province:prov||CITY_PROV[city.name]||'',
      rating:b.rating?+(b.rating/2).toFixed(1):0,reviewCount:b.stats?.total_ratings||0,
      featured:false,claimed:false,plan:'free',source:'Foursquare Places',
      websiteVerified:enriched.websiteVerified,certifications:enriched.certifications,
      yearsInBusiness:enriched.yearsInBusiness,licenseNumber:'',
    };
  }));
}

// ── SOURCE 2: HomeStars (no API key needed) ───────────────────────────────────

async function fetchHomeStars(cities) {
  async function scrapePage(trade, city) {
    const urls=[
      `https://homestars.com/companies/search?q=${encodeURIComponent(trade.hsSlug)}&location=${city.hslug}`,
      `https://homestars.com/ca/search/view?utf8=%E2%9C%93&term=${encodeURIComponent(trade.hsSlug)}&tag_cities[]=${city.hslug}`,
    ];
    for (const url of urls) {
      const html=await fetchHtml(url,9000);
      if (!html||html.length<1000) continue;
      const ld=parseJsonLd(html);
      const companies=[];
      if (ld.length>0) {
        for (const biz of ld) {
          const name=(biz.name||'').trim();
          if (!name||name.length<2) continue;
          const addr=biz.address||{};
          const bizCity=(addr.addressLocality||city.name).trim();
          const prov=(addr.addressRegion||CITY_PROV[bizCity]||city.prov||'').replace(/^CA-/,'').trim();
          const phone=(biz.telephone||'').replace(/[^\d+\-() ]/g,'').trim();
          const website=(biz.url||biz.sameAs||'').trim();
          const email=(biz.email||'').toLowerCase().trim();
          const desc=(biz.description||'').replace(/<[^>]+>/g,'').slice(0,400).trim();
          companies.push({_name:name,_city:bizCity,_prov:prov,_phone:phone,_website:isSkippable(website)?'':website,_email:isSkippable(email)?'':email,_desc:desc,_rating:parseFloat(biz.aggregateRating?.ratingValue||0),_revCnt:parseInt(biz.aggregateRating?.reviewCount||0,10)});
        }
      }
      if (companies.length<3) {
        const profileRe=/href=["'](\/companies\/\d+-[^"'?#\s]+)["'][^>]*>([^<]{3,80})<\/a>/gi;
        const phoneRe=/(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/g;
        const names=[...html.matchAll(profileRe)].map(m=>({slug:m[1],name:m[2].trim()})).filter(m=>m.name.length>2);
        const phones=[...html.matchAll(phoneRe)].map(m=>m[1].trim());
        for (let i=0;i<Math.min(names.length,20);i++)
          companies.push({_name:names[i].name,_city:city.name,_prov:city.prov,_phone:phones[i]||'',_website:'',_email:'',_desc:'',_rating:0,_revCnt:0,_hsPath:names[i].slug});
      }
      if (companies.length>0) return {companies,trade,city};
    }
    return {companies:[],trade,city};
  }

  const pairs=cities.flatMap(city=>TRADES.map(trade=>({trade,city})));
  const results=[];
  // Process by city with a small delay to be polite
  for (const city of cities) {
    const cityTrades=pairs.filter(p=>p.city.name===city.name);
    const settled=await Promise.allSettled(cityTrades.map(({trade,city})=>scrapePage(trade,city)));
    for (let i=0;i<settled.length;i++) {
      if (settled[i].status==='fulfilled') results.push(settled[i].value);
    }
    await new Promise(r=>setTimeout(r,150));
  }

  return Promise.all(results.flatMap(({companies,trade,city})=>
    companies.map(async item=>{
      let website=item._website;
      if (!website&&item._hsPath) {
        const html=await fetchHtml('https://homestars.com'+item._hsPath,6000);
        if (html) {
          const ld=parseJsonLd(html);
          const u=(ld.find(n=>n.url)||{}).url||'';
          if (u&&!isSkippable(u)) website=u;
          else { const m=html.match(/(?:Visit Website|company website)[^<]*<[^>]+href=["']([^"']+)["']/i); if (m&&!isSkippable(m[1])) website=m[1]; }
        }
      }
      const enriched=await enrichFromWebsite(website);
      return {
        id:makeId('hs',item._name,item._city),
        companyName:item._name,tradeType:trade.trade,icon:trade.icon,
        phone:enriched.phone||item._phone,email:enriched.email||item._email||guessEmail(website),website,
        description:enriched.description||item._desc||`${trade.trade} contractor serving ${item._city}${item._prov?', '+item._prov:''}.`,
        serviceAreas:[item._city],city:item._city,province:item._prov||CITY_PROV[item._city]||'',
        rating:item._rating,reviewCount:item._revCnt,
        featured:false,claimed:false,plan:'free',source:'HomeStars',
        websiteVerified:enriched.websiteVerified,certifications:enriched.certifications,
        yearsInBusiness:enriched.yearsInBusiness,licenseNumber:'',
      };
    })
  ));
}

// ── SOURCE 3: Yelp Fusion API ─────────────────────────────────────────────────

async function fetchYelp(cities, apiKey) {
  if (!apiKey) return [];

  async function search(trade, city) {
    const params=new URLSearchParams({term:trade.yelpTerm,location:city.yelpLoc,categories:trade.yelpCat,limit:'50',locale:'en_CA'});
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),9000);
    try {
      const r=await fetch(`https://api.yelp.com/v3/businesses/search?${params}`,{
        signal:ctrl.signal,
        headers:{'Authorization':'Bearer '+apiKey,'Accept':'application/json'},
      });
      clearTimeout(t);
      if (!r.ok) return [];
      const d=await r.json();
      return (d.businesses||[]).filter(b=>{ const cc=(b.location?.country||'').toUpperCase(); return !cc||cc==='CA'; });
    } catch { clearTimeout(t); return []; }
  }

  const pairs=cities.flatMap(city=>TRADES.map(trade=>({trade,city})));
  const settled=await Promise.allSettled(pairs.map(({trade,city})=>search(trade,city)));

  return settled.filter(r=>r.status==='fulfilled').flatMap((r,i)=>{
    const {trade,city}=pairs[i];
    return (r.value||[]).map(b=>{
      const loc=b.location||{};
      const bizCity=loc.city||city.name;
      const prov=(loc.state||city.prov||'').replace(/^CA-/,'').toUpperCase().slice(0,2);
      return {
        id:makeId('yelp',b.name,bizCity),
        companyName:b.name,tradeType:trade.trade,icon:trade.icon,
        phone:(b.phone||b.display_phone||'').replace(/[^\d+\-() ]/g,'').trim(),
        email:'',website:'',
        description:(b.snippet_text||`${trade.trade} contractor serving ${bizCity}${prov?', '+prov:''}.`).slice(0,400),
        serviceAreas:[bizCity],city:bizCity,province:prov||CITY_PROV[city.name]||'',
        rating:b.rating||0,reviewCount:b.review_count||0,
        featured:false,claimed:false,plan:'free',source:'Yelp',
        websiteVerified:false,certifications:[],yearsInBusiness:'',licenseNumber:'',
        imageUrl:b.image_url||'',
      };
    });
  });
}

// ── SOURCE 4: Yellow Pages Canada ────────────────────────────────────────────

const YP_TRADE_KW = [
  {trade:'Electrical',icon:'⚡',kw:'electricians'},
  {trade:'Plumbing',icon:'🔧',kw:'plumbers'},
  {trade:'HVAC',icon:'🌡️',kw:'heating-air-conditioning'},
  {trade:'Roofing',icon:'🏚️',kw:'roofing-contractors'},
  {trade:'Welding & Fabrication',icon:'⚙️',kw:'welding'},
  {trade:'Carpentry',icon:'🪚',kw:'carpenters'},
  {trade:'General Contracting',icon:'🏗️',kw:'general-contractors'},
  {trade:'Sheet Metal',icon:'🔨',kw:'sheet-metal-contractors'},
  {trade:'Concrete & Masonry',icon:'🧱',kw:'concrete-contractors'},
  {trade:'Millwright',icon:'🔩',kw:'millwrights'},
  {trade:'Pipefitting',icon:'🛢️',kw:'pipefitters'},
  {trade:'Refrigeration',icon:'❄️',kw:'refrigeration-contractors'},
  {trade:'Painting & Coating',icon:'🎨',kw:'painting-contractors'},
];

function extractLocalBusinesses(data) {
  if (!data||typeof data!=='object') return [];
  const t=data['@type']||'';
  if (/LocalBusiness|HomeAndConstruction|Electrician|Plumber|GeneralContractor|HVACBusiness|RoofingContractor/i.test(t)) return [data];
  if (t==='ItemList'&&Array.isArray(data.itemListElement)) return data.itemListElement.map(i=>i.item||i).filter(i=>i['@type']&&i['@type']!=='ListItem');
  if (Array.isArray(data)) return data.flatMap(extractLocalBusinesses);
  if (data['@graph']) return extractLocalBusinesses(data['@graph']);
  return [];
}

async function fetchYellowPages(cities) {
  async function fetchPage(tradeKw, city) {
    const url=`https://www.yellowpages.ca/search/si/1/${encodeURIComponent(tradeKw.kw)}/${encodeURIComponent(city)}`;
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),9000);
    try {
      const r=await fetch(url,{signal:ctrl.signal,headers:{'User-Agent':UA,'Accept':'text/html,*/*;q=0.8','Accept-Language':'en-CA,en;q=0.9','Cache-Control':'no-cache'}});
      clearTimeout(t);
      if (!r.ok) return [];
      const html=await r.text();
      const jsonLdRe=/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      const businesses=[];
      for (const m of html.matchAll(jsonLdRe)) {
        try { businesses.push(...extractLocalBusinesses(JSON.parse(m[1].trim()))); } catch {}
      }
      if (businesses.length>0) {
        return businesses.map(b=>{
          const name=(b.name||'').trim();
          if (!name||name.length<2) return null;
          const addr=b.address||{};
          const bizCity=(addr.addressLocality||city).trim();
          const prov=(addr.addressRegion||CITY_PROV[bizCity]||'').replace(/^CA-/,'').trim();
          const phone=(b.telephone||'').replace(/[^\d+\-() ]/g,'').trim();
          const website=(b.url||b.sameAs||'').trim();
          const email=(b.email||guessEmail(website)).trim().toLowerCase();
          return {
            id:makeId('yp',name,bizCity),
            companyName:name,tradeType:tradeKw.trade,icon:tradeKw.icon,
            phone,email,website,
            description:(b.description||'').replace(/<[^>]+>/g,'').slice(0,400).trim()||`${tradeKw.trade} contractor serving ${bizCity}${prov?', '+prov:''}.`,
            serviceAreas:[bizCity],city:bizCity,province:prov||CITY_PROV[city]||'',
            rating:parseFloat(b.aggregateRating?.ratingValue||0),reviewCount:parseInt(b.aggregateRating?.reviewCount||0,10),
            featured:false,claimed:false,plan:'free',source:'Yellow Pages Canada',
            websiteVerified:false,certifications:[],yearsInBusiness:'',licenseNumber:'',
          };
        }).filter(Boolean);
      }
      // HTML fallback
      const linkRe=/href="(\/bus\/[^"]+)"[^>]*>([^<]{3,80})<\/a>/gi;
      const phoneRe=/(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/g;
      const names=[...html.matchAll(linkRe)].map(m=>m[2].trim()).filter(n=>n.length>2);
      const phones=[...html.matchAll(phoneRe)].map(m=>m[1].trim());
      return names.slice(0,20).map((name,i)=>({
        id:makeId('yp',name,city),
        companyName:name,tradeType:tradeKw.trade,icon:tradeKw.icon,
        phone:phones[i]||'',email:'',website:'',
        description:`${tradeKw.trade} contractor serving ${city}.`,
        serviceAreas:[city],city,province:CITY_PROV[city]||'',
        rating:0,reviewCount:0,featured:false,claimed:false,plan:'free',source:'Yellow Pages Canada',
        websiteVerified:false,certifications:[],yearsInBusiness:'',licenseNumber:'',
      }));
    } catch { clearTimeout(t); return []; }
  }

  const pairs=cities.flatMap(city=>YP_TRADE_KW.map(kw=>({kw,city})));
  const settled=await Promise.allSettled(pairs.map(({kw,city})=>fetchPage(kw,city)));
  return settled.filter(r=>r.status==='fulfilled').flatMap(r=>r.value);
}

// ── SOURCE 5: OpenStreetMap / Overpass API ────────────────────────────────────

async function fetchOSM() {
  const OVERPASS = 'https://overpass-api.de/api/interpreter';
  const OSM_TAGS = [
    ['craft','electrician'],['craft','plumber'],['craft','hvac_technician'],['craft','roofer'],
    ['craft','welder'],['craft','carpenter'],['craft','pipefitter'],['craft','mason'],['craft','bricklayer'],
    ['trade','electrician'],['trade','plumber'],['trade','carpenter'],
    ['shop','electrical'],['shop','plumber'],['office','construction_company'],
  ];
  const TRADE_BY_TAG = {
    electrician:'Electrical',plumber:'Plumbing',hvac_technician:'HVAC',roofer:'Roofing',
    welder:'Welding & Fabrication',carpenter:'Carpentry',pipefitter:'Pipefitting',
    mason:'Concrete & Masonry',bricklayer:'Concrete & Masonry',
    electrical:'Electrical',construction_company:'General Contracting',
  };
  const ICONS = {'Electrical':'⚡','Plumbing':'🔧','HVAC':'🌡️','Roofing':'🏚️','Welding & Fabrication':'⚙️','Carpentry':'🪚','General Contracting':'🏗️','Concrete & Masonry':'🧱','Pipefitting':'🛢️'};

  const bbox='41.67,-141.01,83.11,-52.62';
  const nodeFilters=OSM_TAGS.map(([k,v])=>`node["${k}"="${v}"]["name"](${bbox});`).join('\n  ');
  const query=`[out:json][timeout:30];\n(\n  ${nodeFilters}\n);\nout body 200;`;

  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),28000);
  try {
    const r=await fetch(OVERPASS,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query),signal:ctrl.signal});
    clearTimeout(t);
    if (!r.ok) return [];
    const json=await r.json();
    return (json.elements||[]).map(el=>{
      const tags=el.tags||{};
      const name=tags.name||tags['name:en'];
      if (!name) return null;
      const tagKey=Object.keys(tags).find(k=>OSM_TAGS.some(([tk])=>tk===k)&&TRADE_BY_TAG[tags[k]]);
      const trade=tagKey?(TRADE_BY_TAG[tags[tagKey]]||'General Contracting'):'General Contracting';
      const city=tags['addr:city']||tags['addr:town']||'';
      const prov=(tags['addr:province']||tags['addr:state']||'').replace(/^CA-/,'');
      const web=tags.website||tags['contact:website']||'';
      const phone=(tags.phone||tags['contact:phone']||'').replace(/^tel:/,'');
      const email=tags.email||tags['contact:email']||guessEmail(web);
      return {
        id:makeId('osm',name,city||prov),
        companyName:name,tradeType:trade,icon:ICONS[trade]||'🔧',
        phone,email,website:web,
        description:tags.description||`${trade} contractor — ${city||prov||'Canada'}.`,
        serviceAreas:[city||prov||'Canada'],city,province:prov,
        lat:el.lat,lng:el.lon,
        rating:0,reviewCount:0,featured:false,claimed:false,plan:'free',source:'OpenStreetMap',
        websiteVerified:false,certifications:[],yearsInBusiness:'',licenseNumber:'',
      };
    }).filter(Boolean);
  } catch { clearTimeout(t); return []; }
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function dedupe(companies) {
  companies.sort((a,b)=>{
    const s=c=>(c.websiteVerified?16:0)+(c.source==='Foursquare Places'?8:0)+(c.source==='HomeStars'?6:0)+(c.source==='Yelp'?4:0)+(c.email?3:0)+(c.phone?2:0)+(c.website?1:0);
    return s(b)-s(a);
  });
  const seen=new Set();
  return companies.filter(c=>{
    const k=c.companyName.toLowerCase().replace(/[^a-z0-9]/g,'')+c.city.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).map(c=>({...c, province:c.province||CITY_PROV[c.city]||''}));
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

  // Which city set to use for Foursquare (batched to manage API quota)
  const fsqCities = batch === 1 ? CITIES_1 : CITIES_0;

  console.log(`[scrape-all] source=${source||'all'} batch=${batch} fsq=${!!fsqKey} yelp=${!!yelpKey}`);

  let companies = [];

  if (!source || source === 'fsq' || source === 'foursquare') {
    const r = await fetchFoursquare(fsqCities, fsqKey);
    companies.push(...r);
    console.log(`[scrape-all] fsq: ${r.length}`);
  }
  if (!source || source === 'hs' || source === 'homestars') {
    const r = await fetchHomeStars(ALL_CITIES.slice(0,8));
    companies.push(...r);
    console.log(`[scrape-all] homestars: ${r.length}`);
  }
  if (!source || source === 'yelp') {
    const r = await fetchYelp(CITIES_0, yelpKey);
    companies.push(...r);
    console.log(`[scrape-all] yelp: ${r.length}`);
  }
  if (!source || source === 'yp') {
    const r = await fetchYellowPages(YP_CITIES.slice(0,8));
    companies.push(...r);
    console.log(`[scrape-all] yp: ${r.length}`);
  }
  if (!source || source === 'osm') {
    const r = await fetchOSM();
    companies.push(...r);
    console.log(`[scrape-all] osm: ${r.length}`);
  }

  const deduped = dedupe(companies);
  console.log(`[scrape-all] total after dedupe: ${deduped.length}`);

  return res.status(200).json({
    companies: deduped,
    total:     deduped.length,
    fetched:   new Date().toISOString(),
    sources:   ['Foursquare Places', 'HomeStars', 'Yelp', 'Yellow Pages Canada', 'OpenStreetMap'],
  });
};
