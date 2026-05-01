/**
 * Comprehensive XML sitemap for BookYourTrades.com
 *
 * Generates URLs for:
 *   - Static pages
 *   - All 31 trade-type filtered directory pages
 *   - All 47 city filtered directory pages
 *   - Top trade×city landing pages (31 trades × 20 key cities = 620 URLs)
 *   - Seed provider profile pages
 *   - Blog post pages (static + future dynamic)
 */

const BASE_URL = 'https://bookyourtrades.com';

// ── Static pages ──────────────────────────────────────────────────────────────

const STATIC_PAGES = [
  { path: '/',                 changefreq: 'daily',   priority: '1.0' },
  { path: '/directory',        changefreq: 'daily',   priority: '0.9' },
  { path: '/register',         changefreq: 'monthly', priority: '0.7' },
  { path: '/how-it-works',     changefreq: 'monthly', priority: '0.8' },
  { path: '/pricing',          changefreq: 'monthly', priority: '0.8' },
  { path: '/rfq',              changefreq: 'weekly',  priority: '0.8' },
  { path: '/blog',             changefreq: 'weekly',  priority: '0.7' },
  { path: '/jobs',             changefreq: 'weekly',  priority: '0.7' },
  { path: '/news',             changefreq: 'weekly',  priority: '0.7' },
  { path: '/trades-education', changefreq: 'weekly',  priority: '0.6' },
  { path: '/login',            changefreq: 'monthly', priority: '0.4' },
  { path: '/terms',            changefreq: 'monthly', priority: '0.3' },
  { path: '/privacy',          changefreq: 'monthly', priority: '0.3' },
  { path: '/disclaimer',       changefreq: 'monthly', priority: '0.3' },
];

// ── All 31 trade types ────────────────────────────────────────────────────────

const TRADE_TYPES = [
  'Boilermaker', 'Carpentry', 'Cleaning & Janitorial', 'Concrete & Masonry',
  'Demolition', 'Drywall & Plastering', 'Electrical', 'Elevator & Lift',
  'Environmental Services', 'Fencing', 'Fire Protection', 'Flooring',
  'General Contracting', 'Glazing & Glass', 'HVAC', 'Insulation',
  'Landscaping', 'Locksmith & Access Control', 'Millwright', 'Moving & Equipment Rigging',
  'Painting & Coating', 'Paving & Asphalt', 'Pest Control', 'Pipefitting',
  'Plumbing', 'Refrigeration', 'Roofing', 'Security Systems',
  'Sheet Metal', 'Snow Removal', 'Welding & Fabrication',
];

// ── Cities — 47 Canadian cities ───────────────────────────────────────────────

const ALL_CITIES = [
  // Ontario
  'Toronto','Ottawa','Hamilton','Mississauga','Brampton','London','Kitchener',
  'Windsor','Barrie','Sudbury','Oakville','Kingston','Thunder Bay','Guelph','Oshawa',
  // British Columbia
  'Vancouver','Surrey','Burnaby','Richmond','Abbotsford','Kelowna','Victoria','Kamloops','Prince George','Nanaimo',
  // Alberta
  'Calgary','Edmonton','Red Deer','Lethbridge','Fort McMurray','Grande Prairie',
  // Saskatchewan
  'Regina','Saskatoon',
  // Manitoba
  'Winnipeg','Brandon',
  // Quebec
  'Montreal','Quebec City','Laval','Gatineau','Sherbrooke',
  // Maritime & Atlantic
  'Halifax','Moncton','Fredericton','Saint John',"St. John's",'Charlottetown',
];

// Key cities for trade×city matrix (top 20 by search volume)
const KEY_CITIES = [
  'Toronto','Vancouver','Calgary','Edmonton','Ottawa','Winnipeg','Hamilton',
  'Halifax','Montreal','Mississauga','Brampton','London','Kitchener',
  'Victoria','Kelowna','Regina','Saskatoon','Windsor','Barrie','Sudbury',
];

// ── Seed provider IDs ─────────────────────────────────────────────────────────

const PROVIDER_IDS = [
  'r1','r2','r3','r4','r5','r6','r7','r8',
  'r9','r10','r11','r12','r13','r14','r15','r16',
  'r17','r18','r19','r20','r21','r22','r23','r24',
  'bc1','bc2','bc3','bc4','bc5',
  'ab1','ab2','ab3','ab4','ab5',
  'sk1','sk2',
  'mb1','mb2',
  'qca1','qca2','qca3',
  'at1','at2','at3',
];

// ── Static blog slugs (dynamic posts covered by /blog) ────────────────────────

const BLOG_SLUGS = [
  'find-licensed-electrician-ontario',
  'hvac-maintenance-tips-commercial',
  'choosing-commercial-roofing-contractor',
  'plumbing-codes-canada-2024',
  'welding-certifications-guide',
  'red-seal-trades-canada',
  'commercial-construction-permits-ontario',
  'safety-requirements-construction-sites',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0];
}

function url(path, changefreq, priority, lastmod) {
  return `
  <url>
    <loc>${BASE_URL}${path}</loc>
    <lastmod>${lastmod || today()}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function encodeParam(val) {
  return encodeURIComponent(val).replace(/%20/g, '+');
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = (req, res) => {
  const entries = [];

  // 1. Static pages
  for (const { path, changefreq, priority } of STATIC_PAGES) {
    entries.push(url(path, changefreq, priority));
  }

  // 2. Trade-type directory pages  (/directory?trade=Electrical)
  for (const trade of TRADE_TYPES) {
    entries.push(url(`/directory?trade=${encodeParam(trade)}`, 'weekly', '0.8'));
  }

  // 3. City directory pages  (/directory?city=Toronto)
  for (const city of ALL_CITIES) {
    entries.push(url(`/directory?city=${encodeParam(city)}`, 'weekly', '0.7'));
  }

  // 4. Trade × city landing pages  (/directory?trade=Electrical&city=Toronto)
  //    Only for top-20 key cities × all 31 trades = up to 620 URLs
  for (const trade of TRADE_TYPES) {
    for (const city of KEY_CITIES) {
      entries.push(url(
        `/directory?trade=${encodeParam(trade)}&city=${encodeParam(city)}`,
        'weekly', '0.7'
      ));
    }
  }

  // 5. Seed provider profile pages
  for (const id of PROVIDER_IDS) {
    entries.push(url(`/directory/${id}`, 'monthly', '0.6', '2025-01-01'));
  }

  // 6. Blog posts
  for (const slug of BLOG_SLUGS) {
    entries.push(url(`/blog/${slug}`, 'monthly', '0.6'));
  }

  // 7. Individual city pages for biggest markets (SEO landing pages)
  const TOP_CITIES = ['Toronto','Vancouver','Calgary','Edmonton','Ottawa','Winnipeg','Montreal','Hamilton'];
  for (const city of TOP_CITIES) {
    // These map to /directory?city=X which is already covered above,
    // but we also add clean /trades/:city style if the SPA supports it
    // (future-proofing for when those routes exist)
    // entries.push(url(`/trades/${city.toLowerCase().replace(/\s+/g,'-')}`, 'weekly', '0.8'));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">${entries.join('')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
  res.status(200).send(xml);
};
