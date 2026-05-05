/**
 * GET    /api/db/jobs               — list all active job posts
 * POST   /api/db/jobs               — create job post (provider or admin)
 * PUT    /api/db/jobs?id=xxx        — update
 * DELETE /api/db/jobs?id=xxx        — delete
 */
const supabase       = require('./_supabase');
const { requireSession, requireAdmin } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('job_posts').select('*').order('posted_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const b = req.body || {};
    if (!b.title) return res.status(400).json({ error: 'title required' });
    const id = 'job' + Date.now();
    const { data, error } = await supabase.from('job_posts').insert({
      id,
      provider_id:  session.providerId || null,
      company_name: b.companyName || '',
      title:        b.title,
      trade_type:   b.tradeType || '',
      location:     b.location || '',
      description:  b.description || '',
      pay_range:    b.payRange || '',
      job_type:     b.jobType || 'Full-time',
      experience:   b.experience || '',
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    const session = requireSession(req, res); if (!session) return;
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const b = { ...req.body }; delete b.id;
    const { data, error } = await supabase.from('job_posts').update(b).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const session = requireSession(req, res); if (!session) return;
    const { id } = req.query;
    const { error } = await supabase.from('job_posts').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
