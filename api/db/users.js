/**
 * GET  /api/db/users            — list all users (admin only, no password_hash)
 * PUT  /api/db/users?id=xxx     — update user (admin or self)
 * DELETE /api/db/users?id=xxx   — delete user + provider (admin only)
 */
const supabase        = require('./_supabase');
const { requireAdmin, getSession } = require('./_auth');
const bcrypt          = require('bcryptjs');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const admin = requireAdmin(req, res); if (!admin) return;
    const { data, error } = await supabase
      .from('users')
      .select('id,email,role,provider_id,name,verified,created_at')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'PUT') {
    const session = getSession(req); if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    if (session.role !== 'admin' && session.id !== id) return res.status(403).json({ error: 'Forbidden' });

    const b = { ...req.body };
    delete b.id; delete b.password_hash;

    if (b.password) {
      if (b.password.length < 6) return res.status(400).json({ error: 'Password too short' });
      b.password_hash = await bcrypt.hash(b.password, 10);
      delete b.password;
    }

    const { data, error } = await supabase
      .from('users').update(b).eq('id', id)
      .select('id,email,role,provider_id,name,verified').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res); if (!admin) return;
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    // Get user first to find linked provider
    const { data: user } = await supabase.from('users').select('provider_id').eq('id', id).single();
    if (user?.provider_id) {
      await supabase.from('providers').delete().eq('id', user.provider_id);
    }
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
