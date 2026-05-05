/**
 * GET    /api/db/providers          — list all (admin) or active only
 * POST   /api/db/providers          — create (admin)
 * PUT    /api/db/providers?id=xxx   — update
 * DELETE /api/db/providers?id=xxx   — delete (admin)
 */
const supabase         = require('./_supabase');
const { requireAdmin, getSession } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const session = getSession(req);
    let query = supabase.from('providers').select('*').order('company_name');
    if (!session || session.role !== 'admin') {
      query = query.eq('status', 'active');
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const admin = requireAdmin(req, res); if (!admin) return;
    const b = req.body || {};
    const { data, error } = await supabase.from('providers').insert(b).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    const session = getSession(req); if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    // Provider can only update their own listing
    if (session.role !== 'admin' && session.providerId !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const b = req.body || {};
    delete b.id; // never overwrite pk
    const { data, error } = await supabase.from('providers').update(b).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res); if (!admin) return;
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const { error } = await supabase.from('providers').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
