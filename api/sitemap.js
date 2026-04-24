const BASE_URL = 'https://bookyourtrades.com';

const STATIC_PAGES = [
  { path: '/',                 changefreq: 'daily',   priority: '1.0' },
  { path: '/directory',        changefreq: 'weekly',  priority: '0.9' },
  { path: '/register',         changefreq: 'monthly', priority: '0.7' },
  { path: '/login',            changefreq: 'monthly', priority: '0.5' },
  { path: '/how-it-works',     changefreq: 'monthly', priority: '0.7' },
  { path: '/pricing',          changefreq: 'monthly', priority: '0.8' },
  { path: '/rfq',              changefreq: 'weekly',  priority: '0.8' },
  { path: '/blog',             changefreq: 'weekly',  priority: '0.7' },
  { path: '/jobs',             changefreq: 'weekly',  priority: '0.7' },
  { path: '/news',             changefreq: 'weekly',  priority: '0.7' },
  { path: '/trades-education', changefreq: 'weekly',  priority: '0.6' },
  { path: '/terms',            changefreq: 'monthly', priority: '0.3' },
  { path: '/privacy',          changefreq: 'monthly', priority: '0.3' },
  { path: '/disclaimer',       changefreq: 'monthly', priority: '0.3' },
];

// Hardcoded seed provider IDs
const PROVIDER_IDS = [
  'r1',  'r2',  'r3',  'r4',  'r5',  'r6',  'r7',  'r8',
  'r9',  'r10', 'r11', 'r12', 'r13', 'r14', 'r15', 'r16',
  'r17', 'r18', 'r19', 'r20', 'r21', 'r22', 'r23', 'r24',
  'bc1', 'bc2', 'bc3', 'bc4', 'bc5',
  'ab1', 'ab2', 'ab3', 'ab4', 'ab5',
  'sk1', 'sk2',
  'mb1', 'mb2',
  'qca1', 'qca2', 'qca3',
  'at1', 'at2', 'at3',
];

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

module.exports = (req, res) => {
  const today = getTodayDate();

  const staticEntries = STATIC_PAGES.map(({ path, changefreq, priority }) => `
  <url>
    <loc>${BASE_URL}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('');

  const providerEntries = PROVIDER_IDS.map(id => `
  <url>
    <loc>${BASE_URL}/directory/${id}</loc>
    <lastmod>2025-01-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries}${providerEntries}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 's-maxage=86400');
  res.status(200).send(xml);
};
