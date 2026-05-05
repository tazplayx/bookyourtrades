/**
 * Shared auth helper — verifies the BYT session token sent in the
 * Authorization header by the SPA.
 *
 * Token is a base64-encoded JSON payload signed with BYT_SESSION_SECRET.
 * Simple HMAC-SHA256 — no JWT dependency needed.
 */
const crypto = require('crypto');

const SECRET = process.env.BYT_SESSION_SECRET || 'change-me-in-vercel-env';

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig  = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return `${data}.${sig}`;
}

function verify(token) {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  if (sig !== expected) return null;
  try { return JSON.parse(Buffer.from(data, 'base64').toString()); }
  catch { return null; }
}

function getSession(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return null;
  return verify(auth.slice(7));
}

function requireSession(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return session;
}

function requireAdmin(req, res) {
  const session = requireSession(req, res);
  if (!session) return null;
  if (session.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return null;
  }
  return session;
}

module.exports = { sign, verify, getSession, requireSession, requireAdmin };
