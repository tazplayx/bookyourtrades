/**
 * GET  /api/db/reviews?providerId=xxx  — public approved reviews for a provider
 * POST /api/db/reviews                 — submit review (queued for approval)
 * PUT  /api/db/reviews?id=xxx          — approve/reject (admin)
 */
const supabase        = require('./_supabase');
const { requireAdmin } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { providerId } = req.query;
    let query = supabase.from('reviews').select('*').eq('approved', true).order('created_at', { ascending: false });
    if (providerId) query = query.eq('provider_id', providerId);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { providerId, reviewerName, reviewerEmail, rating, comment } = req.body || {};
    if (!providerId || !rating) return res.status(400).json({ error: 'providerId and rating required' });
    const id = 'rev' + Date.now();
    const { data, error } = await supabase.from('reviews').insert({
      id, provider_id: providerId,
      reviewer_name:  reviewerName || 'Anonymous',
      reviewer_email: reviewerEmail || '',
      rating: parseInt(rating), comment: comment || '',
      approved: false,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    // Update provider rating average
    const { data: approved } = await supabase.from('reviews').select('rating').eq('provider_id', providerId).eq('approved', true);
    if (approved?.length) {
      const avg = approved.reduce((s, r) => s + r.rating, 0) / approved.length;
      await supabase.from('providers').update({ rating: avg, review_count: approved.length }).eq('id', providerId);
    }
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    const admin = requireAdmin(req, res); if (!admin) return;
    const { id } = req.query;
    const b = { ...req.body }; delete b.id;
    const { data, error } = await supabase.from('reviews').update(b).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res); if (!admin) return;
    const { id } = req.query;
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
