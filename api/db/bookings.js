/**
 * GET  /api/db/bookings              — list (admin: all; provider: own; client: own)
 * POST /api/db/bookings              — create booking (public)
 * PUT  /api/db/bookings?id=xxx       — update status
 */
const supabase        = require('./_supabase');
const { getSession, requireSession } = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
    if (session.role === 'provider') query = query.eq('provider_id', session.providerId);
    else if (session.role === 'client') query = query.eq('client_id', session.id);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.providerId || !b.clientName || !b.clientEmail) {
      return res.status(400).json({ error: 'providerId, clientName, clientEmail required' });
    }
    const id = 'b' + Date.now();
    const { data, error } = await supabase.from('bookings').insert({
      id,
      provider_id:   b.providerId,
      client_id:     b.clientId || null,
      client_name:   b.clientName,
      client_email:  b.clientEmail,
      client_phone:  b.clientPhone || '',
      message:       b.message || '',
      preferred_date: b.preferredDate || null,
      status:        'pending',
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    const session = requireSession(req, res); if (!session) return;
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const b = { ...req.body }; delete b.id;
    const { data, error } = await supabase.from('bookings').update(b).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  res.status(405).json({ error: 'Method not allowed' });
};
