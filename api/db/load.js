/**
 * GET /api/db/load
 * Returns all data the SPA needs to boot:
 * providers, job_posts, blog_posts (public data only — no user passwords)
 *
 * GET /api/db/load?admin=1  (requires admin session)
 * Also returns: users (no password_hash), inquiries, bookings, reviews
 */
const supabase        = require('./_supabase');
const { getSession }  = require('./_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Always load public data
    const [provRes, jobRes, blogRes] = await Promise.all([
      supabase.from('providers').select('*').order('company_name'),
      supabase.from('job_posts').select('*').order('posted_at', { ascending: false }),
      supabase.from('blog_posts').select('*').eq('published', true).order('published_at', { ascending: false }),
    ]);

    const result = {
      providers: provRes.data || [],
      jobPosts:  jobRes.data  || [],
      blogPosts: blogRes.data || [],
    };

    // Admin-only data
    const session = getSession(req);
    if (req.query.admin === '1' && session && session.role === 'admin') {
      const [userRes, inqRes, bookRes, revRes] = await Promise.all([
        supabase.from('users').select('id,email,role,provider_id,name,verified,created_at').order('created_at', { ascending: false }),
        supabase.from('inquiries').select('*').order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').order('created_at', { ascending: false }),
        supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      ]);
      result.users    = userRes.data  || [];
      result.inquiries = inqRes.data  || [];
      result.bookings  = bookRes.data || [];
      result.reviews   = revRes.data  || [];
    }

    res.status(200).json(result);
  } catch (err) {
    console.error('load error:', err);
    res.status(500).json({ error: 'Failed to load data' });
  }
};
