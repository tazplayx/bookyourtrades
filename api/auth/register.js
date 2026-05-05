/**
 * POST /api/auth/register
 * Body: { email, password, companyName, tradeType, contactName, phone,
 *         website, licenseNumber, yearsInBusiness, description,
 *         serviceAreas[], city, province, profileType }
 * Returns: { token, user, provider }
 */
const supabase = require('../db/_supabase');
const { sign }  = require('../db/_auth');
const bcrypt    = require('bcryptjs');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const d = req.body || {};
  if (!d.email || !d.password || !d.companyName || !d.tradeType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check duplicate
  const { data: existing } = await supabase
    .from('users').select('id').eq('email', d.email.toLowerCase().trim()).single();
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const hash = await bcrypt.hash(d.password, 10);
  const pid  = 'p' + Date.now();
  const uid  = 'u' + Date.now();

  // Create provider
  const { data: prov, error: pErr } = await supabase.from('providers').insert({
    id:               pid,
    company_name:     d.companyName,
    trade_type:       d.tradeType,
    description:      d.description || '',
    contact_name:     d.contactName || '',
    email:            d.email.toLowerCase().trim(),
    phone:            d.phone || '',
    website:          d.website || '',
    license_number:   d.licenseNumber || '',
    years_in_business: d.yearsInBusiness || '',
    service_areas:    Array.isArray(d.serviceAreas) ? d.serviceAreas : [],
    city:             d.city || '',
    province:         d.province || 'ON',
    profile_type:     d.profileType || 'company',
    status:           'pending_approval',
    claimed:          true,
    source:           'self-registered',
  }).select().single();

  if (pErr) { console.error(pErr); return res.status(500).json({ error: 'Failed to create listing' }); }

  // Create user
  const { data: user, error: uErr } = await supabase.from('users').insert({
    id:            uid,
    email:         d.email.toLowerCase().trim(),
    password_hash: hash,
    role:          'provider',
    provider_id:   pid,
    name:          d.contactName || d.companyName,
  }).select().single();

  if (uErr) {
    await supabase.from('providers').delete().eq('id', pid);
    return res.status(500).json({ error: 'Failed to create account' });
  }

  const payload = { id: user.id, email: user.email, role: 'provider', providerId: pid, name: user.name };
  const token   = sign({ ...payload, iat: Date.now() });

  res.status(201).json({ token, user: payload, provider: prov });
};
