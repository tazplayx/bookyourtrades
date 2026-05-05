/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user: { id, email, role, providerId, name } }
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

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (error || !user) return res.status(401).json({ error: 'Invalid email or password' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid email or password' });

  const payload = { id: user.id, email: user.email, role: user.role, providerId: user.provider_id, name: user.name };
  const token   = sign({ ...payload, iat: Date.now() });

  res.status(200).json({ token, user: payload });
};
