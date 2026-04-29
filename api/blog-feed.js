/**
 * Vercel serverless function — fetches blog posts from a GitHub repo
 * that is synced from an Obsidian vault (via obsidian-git plugin).
 *
 * Environment variables (Vercel Dashboard):
 *   GITHUB_TOKEN       — Personal access token (repo read scope)
 *   OBSIDIAN_REPO      — GitHub repo in owner/repo format, e.g. "corey/byt-brain"
 *   OBSIDIAN_BLOG_PATH — Path inside repo where .md posts live (default: "blog")
 *   OBSIDIAN_BRANCH    — Branch to read from (default: "main")
 *
 * GET /api/blog-feed
 * Returns: { ok, source, posts: [...] }
 *
 * Each post object:
 *   { slug, title, tag, icon, author, date, readTime, image, excerpt, body }
 *
 * Markdown file format (YAML frontmatter + body):
 * ---
 * title: How to Find a Licensed Electrician
 * slug: find-licensed-electrician-ontario
 * tag: Electrical
 * icon: ⚡
 * author: BookYourTrades Editorial
 * date: April 10, 2026
 * readTime: 5 min read
 * image: https://images.unsplash.com/...
 * excerpt: Short description for cards.
 * ---
 * Full HTML or Markdown body here...
 *
 * Cache: 10-minute stale-while-revalidate via Vercel edge headers.
 */

const GITHUB_API = 'https://api.github.com';

// ── Simple YAML frontmatter parser ────────────────────────────────────────────
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)/);
  if (!match) return { meta: {}, body: raw };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
    if (key) meta[key] = val;
  }
  return { meta, body: match[2].trim() };
}

// ── Convert Markdown to basic HTML (headings, bold, links, lists) ─────────────
function mdToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[h|u|b|l])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

// ── Fetch list of .md files from GitHub ──────────────────────────────────────
async function fetchFileList(repo, blogPath, branch, token) {
  const url = `${GITHUB_API}/repos/${repo}/contents/${blogPath}?ref=${branch}`;
  const r   = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept':        'application/vnd.github.v3+json',
      'User-Agent':    'BookYourTrades/1.0',
    },
  });
  if (!r.ok) throw new Error(`GitHub API ${r.status}: ${await r.text()}`);
  const files = await r.json();
  return Array.isArray(files) ? files.filter(f => f.name.endsWith('.md')) : [];
}

// ── Fetch and parse a single .md file ────────────────────────────────────────
async function fetchPost(file, token) {
  const r = await fetch(file.url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept':        'application/vnd.github.v3+json',
      'User-Agent':    'BookYourTrades/1.0',
    },
  });
  if (!r.ok) return null;
  const json    = await r.json();
  const content = Buffer.from(json.content, 'base64').toString('utf-8');
  const { meta, body } = parseFrontmatter(content);

  // Derive slug from filename if not in frontmatter
  const slug = meta.slug || file.name.replace(/\.md$/, '').toLowerCase().replace(/\s+/g, '-');

  // Convert body: if it looks like Markdown (no HTML tags), convert it
  const bodyHtml = body.includes('<') ? body : mdToHtml(body);

  return {
    slug,
    title:    meta.title    || slug,
    tag:      meta.tag      || 'Trade Knowledge',
    icon:     meta.icon     || '📰',
    author:   meta.author   || 'BookYourTrades Editorial',
    date:     meta.date     || '',
    readTime: meta.readTime || meta.read_time || '5 min read',
    image:    meta.image    || meta.cover     || '',
    excerpt:  meta.excerpt  || meta.description || body.slice(0, 160).replace(/[#*[\]]/g, '').trim(),
    body:     bodyHtml,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'GET only' });

  // 10-min stale-while-revalidate cache at Vercel edge
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');

  const token    = process.env.GITHUB_TOKEN;
  const repo     = process.env.OBSIDIAN_REPO;
  const blogPath = process.env.OBSIDIAN_BLOG_PATH || 'blog';
  const branch   = process.env.OBSIDIAN_BRANCH    || 'main';

  if (!token || !repo) {
    return res.status(200).json({
      ok:     false,
      source: 'not_configured',
      note:   'Set GITHUB_TOKEN and OBSIDIAN_REPO in Vercel environment variables to enable Obsidian blog sync.',
      posts:  [],
    });
  }

  try {
    const files = await fetchFileList(repo, blogPath, branch, token);
    if (files.length === 0) {
      return res.status(200).json({ ok: true, source: 'github', posts: [] });
    }

    // Fetch all files in parallel (cap at 20 to avoid rate limits)
    const toFetch = files.slice(0, 20);
    const posts   = (await Promise.all(toFetch.map(f => fetchPost(f, token)))).filter(Boolean);

    // Sort newest first if date is parseable
    posts.sort((a, b) => {
      const da = new Date(a.date), db = new Date(b.date);
      if (isNaN(da) || isNaN(db)) return 0;
      return db - da;
    });

    return res.status(200).json({ ok: true, source: 'github', repo, branch, blogPath, count: posts.length, posts });
  } catch (err) {
    console.error('[blog-feed] error:', err.message);
    return res.status(200).json({ ok: false, source: 'github_error', error: err.message, posts: [] });
  }
};
