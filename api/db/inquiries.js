/**
 * GET    /api/db/inquiries           — list all (admin only)
 * POST   /api/db/inquiries           — create new inquiry (public)
 * PUT    /api/db/inquiries?id=xxx    — update status/replied (admin)
 * DELETE /api/db/inquiries?id=xxx    — delete (admin)
 */
const supabase        = require('./_supabase');
const { requireAdmin } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const admin = requireAdmin(req, res); if (!admin) return;
    const { data, error } = await supabase
      .from('inquiries').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { name, email, phone, subject, message } = req.body || {};
    if (!name || !email || !message) return res.status(400).json({ error: 'name, email, message required' });
    const id = 'inq_' + Date.now();
    const { data, error } = await supabase.from('inquiries').insert({
      id, name, email, phone: phone || '', subject: subject || 'General Inquiry', message
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    const admin = requireAdmin(req, res); if (!admin) return;
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const b = { ...req.body }; delete b.id;
    const { data, error } = await supabase.from('inquiries').update(b).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res); if (!admin) return;
    const { id } = req.query;
    const { error } = await supabase.from('inquiries').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
