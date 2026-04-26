/**
 * Vercel serverless function — scrapes HomeStars.com, Canada's largest
 * contractor review platform, for trade company listings.
 *
 * No API key required. HomeStars embeds rich JSON-LD LocalBusiness markup
 * in every search results page and profile page.
 *
 * GET /api/scrape-homestars              — all trades, top cities
 * GET /api/scrape-homestars?trade=hvac   — single trade
 * GET /api/scrape-homestars?city=Calgary — single city
 *
 * After finding companies on HomeStars, we visit each company's own
 * website (if listed) to enrich with email, phone, and certifications.
 *
 * Edge-cached 24 hours.
 */

// ── Configuration ─────────────────────────────────────────────────────────────

const TRADES = [
  { trade: 'Boilermaker',           icon: '🔥', slug: 'boiler-repair-services'              },
  { trade: 'Carpentry',             icon: '🪚', slug: 'carpenters-joiners'                  },
  { trade: 'Concrete & Masonry',    icon: '🧱', slug: 'concrete-masonry-stonework'          },
  { trade: 'Electrical',            icon: '⚡', slug: 'electricians'                        },
  { trade: 'General Contracting',   icon: '🏗️', slug: 'general-contractors'                },
  { trade: 'HVAC',                  icon: '🌡️', slug: 'heating-cooling'                    },
  { trade: 'Millwright',            icon: '🔩', slug: 'industrial-services'                 },
  { trade: 'Painting & Coating',    icon: '🎨', slug: 'painters-decorators'                 },
  { trade: 'Pipefitting',           icon: '🛢️', slug: 'plumbers-drain-pipe'                },
  { trade: 'Plumbing',              icon: '🔧', slug: 'plumbers-drain-pipe'                 },
  { trade: 'Refrigeration',         icon: '❄️', slug: 'refrigeration'                       },
  { trade: 'Roofing',               icon: '🏚️', slug: 'roofers'                            },
  { trade: 'Sheet Metal',           icon: '🔨', slug: 'sheet-metal-hvac'                    },
  { trade: 'Welding & Fabrication', icon: '⚙️', slug: 'welding-services'                   },
];

const CITIES = [
  { name: 'Toronto',      slug: 'toronto--on'          },
  { name: 'Vancouver',    slug: 'vancouver--bc'         },
  { name: 'Calgary',      slug: 'calgary--ab'           },
  { name: 'Edmonton',     slug: 'edmonton--ab'          },
  { name: 'Ottawa',       slug: 'ottawa--on'            },
  { name: 'Winnipeg',     slug: 'winnipeg--mb'          },
  { name: 'Hamilton',     slug: 'hamilton--on'          },
  { name: 'Halifax',      slug: 'halifax--ns'           },
  { name: 'London',       slug: 'london--on'            },
  { name: 'Kelowna',      slug: 'kelowna--bc'           },
  { name: 'Regina',       slug: 'regina--sk'            },
  { name: 'Saskatoon',    slug: 'saskatoon--sk'         },
  { name: 'Victoria',     slug: 'victoria--bc'          },
];

const CITY_PROVINCE = {
  'Toronto':'ON','Ottawa':'ON','Hamilton':'ON','London':'ON','Windsor':'ON','Barrie':'ON',
  'Vancouver':'BC','Victoria':'BC','Kelowna':'BC','Surrey':'BC','Burnaby':'BC',
  'Calgary':'AB','Edmonton':'AB','Red Deer':'AB','Lethbridge':'AB',
  'Regina':'SK','Saskatoon':'SK',
  'Winnipeg':'MB','Brandon':'MB',
  'Montreal':'QC','Quebec City':'QC','Laval':'QC','Gatineau':'QC',
  'Halifax':'NS','Moncton':'NB','Fredericton':'NB',"St. John's":'NL','Charlottetown':'PE',
};

const SKIP_DOMAINS = [
  'homestars','facebook','instagram','linkedin','twitter','yelp','google',
  'yellowpages','homeadvisor','kijiji','houzz','bbb','wikipedia','youtube',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(name, city) {
  const s=(name+'|'+(city||'')).toLowerCase().replace(/[^a-z0-9]/g,'');
  let h=5381;
  for (let i=0;i<s.length;i++) h=((h<<5)+h)^s.charCodeAt(i);
  return 'hs_'+(h>>>0).toString(36);
}

function isSkippable(url) {
  if (!url) return true;
  try {
    const host=new URL(url.startsWith('http')?url:'https://'+url).hostname.replace(/^www\./,'').toLowerCase();
    return SKIP_DOMAINS.some(d=>host.includes(d));
  } catch { return true; }
}

function guessEmail(website) {
  if (!website||isSkippable(website)) return '';
  try {
    const host=new URL(website.startsWith('http')?website:'https://'+website).hostname.replace(/^www\./,'').toLowerCase();
    return host.includes('.')?'info@'+host:'';
  } catch { return ''; }
}

function extractPhone(text) {
  if (!text) return '';
  const m=text.match(/(\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]([2-9]\d{2})[\s.\-](\d{4})/);
  return m?m[0].trim():'';
}

function extractEmails(text) {
  if (!text) return [];
  const re=/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const bad=['noreply','no-reply','donotreply','postmaster','bounce','example','test'];
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
        for (const n of nodes) {
          const t=n['@type']||'';
          if (/LocalBusiness|Organization|Contractor|Electrician|Plumber|HVAC|Roofing|Construction|HomeAndConstruction/i.test(t))
            out.push(n);
        }
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

async function fetchHtml(url, ms=8000) {
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),ms);
  try {
    const r=await fetch(url,{
      signal:ctrl.signal,
      headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml,*/*;q=0.8','Accept-Language':'en-CA,en;q=0.9','Cache-Control':'no-cache'},
      redirect:'follow',
    });
    clearTimeout(t);
    if (!r.ok) return null;
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
  if (ldEmail&&!isSkippable(ldEmail)) { out.email=ldEmail.toLowerCase(); }
  else {
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

// ── HomeStars scraping ────────────────────────────────────────────────────────

/**
 * HomeStars search URL pattern:
 * https://homestars.com/ca/search/view?utf8=✓&term={service}&tag_cities[]={city-slug}
 * or the category browsing pages:
 * https://homestars.com/companies/search?q={trade-slug}&location={city-slug}
 */
async function scrapeHomeStarsPage(tradeObj, cityObj) {
  // Try both URL patterns
  const urls = [
    `https://homestars.com/companies/search?q=${encodeURIComponent(tradeObj.slug)}&location=${cityObj.slug}`,
    `https://homestars.com/ca/search/view?utf8=%E2%9C%93&term=${encodeURIComponent(tradeObj.slug)}&tag_cities[]=${cityObj.slug}`,
  ];

  for (const url of urls) {
    const html = await fetchHtml(url, 9000);
    if (!html || html.length < 1000) continue;

    const companies = [];
    const ld = parseJsonLd(html);

    // JSON-LD extraction — HomeStars embeds ItemList or multiple LocalBusiness nodes
    if (ld.length > 0) {
      for (const biz of ld) {
        const name = (biz.name||'').trim();
        if (!name || name.length < 2) continue;

        const addr   = biz.address||{};
        const city   = (addr.addressLocality||cityObj.name).trim();
        const prov   = (addr.addressRegion||CITY_PROVINCE[city]||'').replace(/^CA-/,'').trim();
        const phone  = (biz.telephone||'').replace(/[^\d+\-() ]/g,'').trim();
        const website= (biz.url||biz.sameAs||'').trim();
        const email  = (biz.email||'').toLowerCase().trim();
        const desc   = (biz.description||'').replace(/<[^>]+>/g,'').slice(0,400).trim();
        const rating = parseFloat(biz.aggregateRating?.ratingValue||0);
        const revCnt = parseInt(biz.aggregateRating?.reviewCount||0,10);

        if (!isSkippable(website)&&!email&&!phone) continue; // skip bare stubs

        companies.push({
          _name:    name,
          _city:    city,
          _prov:    prov,
          _phone:   phone,
          _website: isSkippable(website)?'':website,
          _email:   isSkippable(email)?'':email,
          _desc:    desc,
          _rating:  rating,
          _revCnt:  revCnt,
        });
      }
    }

    // HTML fallback — parse visible company names and links when JSON-LD is sparse
    if (companies.length < 3) {
      // HomeStars company profile links: /companies/{id}-{company-name}
      const profileRe=/href=["'](\/companies\/\d+-[^"'?#\s]+)["'][^>]*>([^<]{3,80})<\/a>/gi;
      const phoneRe=/(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/g;
      const names=[...html.matchAll(profileRe)].map(m=>({slug:m[1],name:m[2].trim()})).filter(m=>m.name.length>2);
      const phones=[...html.matchAll(phoneRe)].map(m=>m[1].trim());
      for (let i=0;i<Math.min(names.length,20);i++) {
        companies.push({
          _name:    names[i].name,
          _city:    cityObj.name,
          _prov:    CITY_PROVINCE[cityObj.name]||'',
          _phone:   phones[i]||'',
          _website: '',
          _email:   '',
          _desc:    '',
          _rating:  0,
          _revCnt:  0,
          _hsPath:  names[i].slug, // for follow-up profile scrape
        });
      }
    }

    if (companies.length > 0) return companies;
  }
  return [];
}

/** Optionally visit a HomeStars profile page to get the company website */
async function getWebsiteFromHsProfile(hsPath) {
  if (!hsPath) return '';
  const html=await fetchHtml('https://homestars.com'+hsPath,6000);
  if (!html) return '';
  // HomeStars puts the business website in JSON-LD or in a "Visit Website" link
  const ld=parseJsonLd(html);
  const ldUrl=(ld.find(n=>n.url)||{}).url||'';
  if (ldUrl&&!isSkippable(ldUrl)) return ldUrl;
  const m=html.match(/(?:Visit Website|company website)[^<]*<[^>]+href=["']([^"']+)["']/i);
  if (m&&!isSkippable(m[1])) return m[1];
  return '';
}

// ── Per trade+city handler ────────────────────────────────────────────────────

async function fetchAndEnrich(tradeObj, cityObj) {
  const raw = await scrapeHomeStarsPage(tradeObj, cityObj);
  if (!raw.length) return [];

  return Promise.all(raw.map(async item => {
    let website = item._website;

    // If no website from search page, try the profile page
    if (!website && item._hsPath) {
      website = await getWebsiteFromHsProfile(item._hsPath);
    }

    const enriched = await enrichFromWebsite(website);

    return {
      id:              makeId(item._name, item._city),
      companyName:     item._name,
      tradeType:       tradeObj.trade,
      icon:            tradeObj.icon,
      phone:           enriched.phone || item._phone,
      email:           enriched.email || item._email || guessEmail(website),
      website,
      description:     enriched.description || item._desc || `${tradeObj.trade} contractor serving ${item._city}${item._prov?', '+item._prov:''}.`,
      serviceAreas:    [item._city],
      city:            item._city,
      province:        item._prov || CITY_PROVINCE[item._city] || '',
      rating:          item._rating,
      reviewCount:     item._revCnt,
      featured:        false,
      claimed:         false,
      plan:            'free',
      source:          'HomeStars',
      websiteVerified: enriched.websiteVerified,
      certifications:  enriched.certifications,
      yearsInBusiness: enriched.yearsInBusiness,
      licenseNumber:   '',
    };
  }));
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=7200');

  const tradeParam = (req.query?.trade||'').toLowerCase().trim();
  const cityParam  = (req.query?.city||'').trim();

  const trades = tradeParam ? TRADES.filter(t=>t.trade.toLowerCase().includes(tradeParam)) : TRADES;
  const cities = cityParam ? CITIES.filter(c=>c.name.toLowerCase().includes(cityParam.toLowerCase())) : CITIES;

  console.log(`[scrape-homestars] ${trades.length} trades × ${cities.length} cities`);

  // Stagger requests slightly to be polite to HomeStars (no API key = be a good citizen)
  const results = [];
  for (const city of cities) {
    const settled = await Promise.allSettled(trades.map(t => fetchAndEnrich(t, city)));
    results.push(...settled.filter(r=>r.status==='fulfilled').flatMap(r=>r.value));
    // Small delay between cities
    await new Promise(r => setTimeout(r, 200));
  }

  // Dedup
  const seen = new Set();
  const companies = results
    .sort((a,b)=>(b.reviewCount-a.reviewCount)||(b.rating-a.rating))
    .filter(c=>{
      const k=c.companyName.toLowerCase().replace(/[^a-z0-9]/g,'')+c.city.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

  console.log(`[scrape-homestars] ${companies.length} unique companies`);
  return res.status(200).json({ companies, total:companies.length, fetched:new Date().toISOString(), source:'HomeStars' });
};
