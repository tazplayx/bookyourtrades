/**
 * GET    /api/db/blog               — list published posts (public)
 * POST   /api/db/blog               — create post (admin)
 * PUT    /api/db/blog?id=xxx        — update (admin)
 * DELETE /api/db/blog?id=xxx        — delete (admin)
 */
const supabase        = require('./_supabase');
const { requireAdmin } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('blog_posts').select('*').eq('published', true)
      .order('published_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const admin = requireAdmin(req, res); if (!admin) return;
    const b = req.body || {};
    if (!b.title) return res.status(400).json({ error: 'title required' });
    const id   = 'blog' + Date.now();
    const slug = b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const { data, error } = await supabase.from('blog_posts').insert({
      id, slug, title: b.title, excerpt: b.excerpt || '',
      content: b.content || '', author: b.author || 'BookYourTrades Team',
      category: b.category || 'General', image_url: b.imageUrl || '',
      published: b.published !== false,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    const admin = requireAdmin(req, res); if (!admin) return;
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const b = { ...req.body }; delete b.id;
    const { data, error } = await supabase.from('blog_posts').update(b).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res); if (!admin) return;
    const { id } = req.query;
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
