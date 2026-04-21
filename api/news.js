/**
 * Vercel serverless function — fetches and parses Ontario trades news from RSS feeds.
 * Returns up to 40 articles sorted newest-first.
 *
 * GET /api/news?category=electrical   — optional keyword filter
 * GET /api/news                       — all articles
 */

const FEEDS = [
  { url: 'https://canadiancontractor.ca/feed/',              source: 'Canadian Contractor',          icon: '🔨' },
  { url: 'https://www.constructioncanada.net/feed/',         source: 'Construction Canada',           icon: '🏗️' },
  { url: 'https://www.dailycommercialnews.com/feed/',        source: 'Daily Commercial News',         icon: '📰' },
  { url: 'https://www.on-sitemag.com/feed/',                 source: 'On-Site Magazine',              icon: '🦺' },
  { url: 'https://www.plumbingandhvac.ca/feed/',             source: 'Plumbing & HVAC',               icon: '🔧' },
  { url: 'https://electrical.ca/feed/',                      source: 'Electrical Canada',             icon: '⚡' },
  { url: 'https://www.constructiondive.com/feeds/news/',     source: 'Construction Dive',             icon: '📋' },
  { url: 'https://www.roofingcontractor.com/rss/topic/industry-news', source: 'Roofing Contractor',  icon: '🏚️' },
];

/* Pull text content from a CDATA or plain XML tag */
function extractTag(xml, tag) {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(xml);
  if (cdata) return cdata[1].trim();
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
  if (plain) return plain[1].replace(/<[^>]+>/g, '').trim();
  return '';
}

/* Extract first image URL from HTML content or enclosure/media tags */
function extractImage(item) {
  // 1. Try <enclosure url="..." type="image/..."/>
  const enc = /<enclosure[^>]+type="image\/[^"]*"[^>]+url="([^"]+)"/.exec(item)
           || /<enclosure[^>]+url="([^"]+)"[^>]+type="image\/[^"]*"/.exec(item);
  if (enc) return enc[1];

  // 2. Try <media:content url="..."/>
  const mc = /<media:content[^>]+url="([^"]+)"/.exec(item);
  if (mc) return mc[1];

  // 3. Try <media:thumbnail url="..."/>
  const mt = /<media:thumbnail[^>]+url="([^"]+)"/.exec(item);
  if (mt) return mt[1];

  // 4. Try first <img src="..."> in description/content
  const img = /<img[^>]+src=["']([^"']+)["']/.exec(item);
  if (img && /\.(jpg|jpeg|png|webp|gif)/i.test(img[1])) return img[1];

  return null;
}

/* Strip HTML tags, decode entities, and truncate */
function clean(str, maxLen = 220) {
  const stripped = str
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')   // remove figure blocks (image + caption)
    .replace(/<picture[\s\S]*?<\/picture>/gi, '')  // remove picture elements
    .replace(/<img[^>]*\/?>/gi, '')                // remove standalone img tags
    .replace(/<source[^>]*\/?>/gi, '')             // remove source tags
    .replace(/<[^>]+>/g, '')                       // remove all remaining HTML tags
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + '…' : stripped;
}

async function fetchFeed(feed) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BookYourTrades/1.0 (+https://bookyourtrades.com)' }
    });
    clearTimeout(timeout);
    if (!response.ok) return [];

    const xml = await response.text();
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    return itemMatches.slice(0, 6).map(m => {
      const item  = m[1];
      const title = extractTag(item, 'title');
      const link  = extractTag(item, 'link') || extractTag(item, 'guid');
      const desc  = clean(extractTag(item, 'description'));
      const raw   = extractTag(item, 'pubDate');
      const date  = raw ? new Date(raw) : new Date(0);
      const category = extractTag(item, 'category');
      const image = extractImage(item);
      if (!title || !link) return null;
      return {
        title,
        link,
        description: desc,
        source: feed.source,
        icon: feed.icon,
        category,
        image,
        pubDate: date.toISOString(),
        displayDate: isNaN(date) ? '' : date.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }),
      };
    }).filter(Boolean);

  } catch (e) {
    clearTimeout(timeout);
    return [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  /* Cache for 20 minutes */
  res.setHeader('Cache-Control', 's-maxage=1200, stale-while-revalidate=600');

  const keyword = (req.query?.category || '').toLowerCase().trim();

  const results = await Promise.allSettled(FEEDS.map(fetchFeed));

  let articles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  /* Sort newest first */
  articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  /* Optional keyword filter */
  if (keyword) {
    articles = articles.filter(a =>
      a.title.toLowerCase().includes(keyword) ||
      a.description.toLowerCase().includes(keyword) ||
      a.category.toLowerCase().includes(keyword)
    );
  }

  return res.status(200).json({
    articles: articles.slice(0, 40),
    fetched: new Date().toISOString(),
    total: articles.length,
  });
};
