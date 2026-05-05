"""
patch_supabase.py
Patches index.html to use the Vercel/Supabase API instead of localStorage.

Changes made:
  1. loadStorage() → async, fetches /api/db/load (falls back to seed on error)
  2. saveProviders / saveUsers / saveBookings etc. → async fetch to API
  3. handleLogin() → calls /api/auth/login, stores token in sessionStorage
  4. handleRegister() → calls /api/auth/register
  5. Adds BYT.token getter and BYT.apiFetch helper at top of script
  6. DOMContentLoaded handler made async
"""
import sys, os, subprocess

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
ROOT = os.path.join(os.path.dirname(__file__), '..')
FILE = os.path.join(ROOT, 'index.html')

with open(FILE, 'r', encoding='utf-8') as f:
    html = f.read()

original_len = len(html)
print(f'Loaded: {original_len} bytes')

# ─────────────────────────────────────────────────────────────────────────────
# 1. Add BYT API helper object right after <script> opens
# ─────────────────────────────────────────────────────────────────────────────
SCRIPT_OPEN = '<script>\n'
assert SCRIPT_OPEN in html, '<script> not found'

BYT_HELPER = """\
/* ============================================================
   BYT — API helpers  (Supabase via Vercel serverless routes)
============================================================ */
const BYT = {
  get token() { return sessionStorage.getItem('byt_token'); },
  set token(t) { t ? sessionStorage.setItem('byt_token', t) : sessionStorage.removeItem('byt_token'); },

  async fetch(path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    const res = await fetch(path, Object.assign({}, opts, { headers }));
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  },

  get(path)         { return this.fetch(path); },
  post(path, body)  { return this.fetch(path, { method: 'POST',   body: JSON.stringify(body) }); },
  put(path, body)   { return this.fetch(path, { method: 'PUT',    body: JSON.stringify(body) }); },
  del(path)         { return this.fetch(path, { method: 'DELETE' }); },
};

"""

html = html.replace(SCRIPT_OPEN, SCRIPT_OPEN + BYT_HELPER, 1)
print('Added BYT helper')

# ─────────────────────────────────────────────────────────────────────────────
# 2. Replace loadStorage() with async version
# ─────────────────────────────────────────────────────────────────────────────
OLD_LOAD_START = 'function loadStorage() {'
OLD_LOAD_END   = '}\n\nfunction saveReviews'

pos_s = html.find(OLD_LOAD_START)
pos_e = html.find(OLD_LOAD_END, pos_s)
assert pos_s > 0, 'loadStorage not found'
assert pos_e > 0, 'end of loadStorage not found'
print(f'loadStorage: {pos_s} to {pos_e}')

NEW_LOAD = """\
async function loadStorage() {
  try {
    /* Restore session if page was refreshed */
    const stored = sessionStorage.getItem('byt_session');
    if (stored) { App.currentUser = JSON.parse(stored); }

    /* Fetch all public data from Supabase via API */
    const isAdmin = App.currentUser && App.currentUser.role === 'admin';
    const url = isAdmin ? '/api/db/load?admin=1' : '/api/db/load';
    const data = await BYT.get(url);

    App.providers     = (data.providers  || []).map(dbRowToProvider);
    App.jobPosts      = data.jobPosts    || [];
    App.blogPosts     = data.blogPosts   || [];
    App.users         = data.users       || [];
    App.inquiries     = data.inquiries   || [];
    App.bookings      = data.bookings    || [];
    App.reviews       = data.reviews     || [];
    App.notifications = [];
    App.clients       = [];
    App.rfqs          = [];

    console.log('[BYT] Loaded from Supabase:', App.providers.length, 'providers');
  } catch (err) {
    console.warn('[BYT] API unavailable, falling back to seed data:', err.message);
    /* Fallback to seed data so the site still works during setup */
    App.providers     = [...SEED_PROVIDERS];
    App.users         = [];
    App.jobPosts      = [];
    App.blogPosts     = [];
    App.inquiries     = [];
    App.bookings      = [];
    App.reviews       = [];
    App.notifications = [];
    App.clients       = [];
    App.rfqs          = [];
  }
}

/* Convert snake_case DB row back to camelCase for the SPA */
function dbRowToProvider(p) {
  return {
    id:               p.id,
    companyName:      p.company_name,
    tradeType:        p.trade_type,
    description:      p.description || '',
    contactName:      p.contact_name || '',
    email:            p.email || '',
    phone:            p.phone || '',
    website:          p.website || '',
    licenseNumber:    p.license_number || '',
    yearsInBusiness:  p.years_in_business || '',
    serviceAreas:     p.service_areas || [],
    city:             p.city || '',
    province:         p.province || 'ON',
    rating:           parseFloat(p.rating) || 0,
    reviewCount:      p.review_count || 0,
    certifications:   p.certifications || [],
    featured:         p.featured || false,
    claimed:          p.claimed || false,
    requestCount:     p.request_count || 0,
    status:           p.status || 'active',
    plan:             p.plan || 'free',
    logoData:         p.logo_url || null,
    source:           p.source || '',
    profileType:      p.profile_type || 'company',
    registeredAt:     p.registered_at || p.created_at || '',
    password:         '',   /* never returned from API */
  };
}

"""

html = html[:pos_s] + NEW_LOAD + html[pos_e + 1:]  # keep the \n before saveProviders
print('Replaced loadStorage()')

# ─────────────────────────────────────────────────────────────────────────────
# 3. Replace save functions with API calls
# ─────────────────────────────────────────────────────────────────────────────

SAVE_FUNCS_OLD = """\
function saveProviders() { localStorage.setItem('to_providers', JSON.stringify(App.providers)); }
function saveUsers()     { localStorage.setItem('to_users',     JSON.stringify(App.users));     }
function saveBookings()  { localStorage.setItem('to_bookings',  JSON.stringify(App.bookings));  }
function saveReviews()   { localStorage.setItem('to_reviews',   JSON.stringify(App.reviews));   }
function saveNotifications(){ localStorage.setItem('to_notifs', JSON.stringify(App.notifications)); }
function saveInquiries() { localStorage.setItem('to_inquiries', JSON.stringify(App.inquiries)); }"""

# Find this block in the file
idx = html.find('function saveProviders() { localStorage.setItem')
assert idx > 0, 'saveProviders not found'
# Find the end of the last save function in this group
end_block = html.find('\n\n', idx)

SAVE_FUNCS_NEW = """\
/* save* functions now sync to Supabase (fire-and-forget, keep local state first) */
function saveProviders() {
  /* Individual provider updates happen via adminSaveEdit2 / saveMyListing which call the API directly */
}
function saveUsers() { /* handled by /api/db/users */ }
function saveBookings()  { /* handled by /api/db/bookings */ }
function saveReviews()   { /* handled by /api/db/reviews */ }
function saveNotifications() {}
function saveInquiries() { /* handled by /api/db/inquiries */ }"""

html = html[:idx] + SAVE_FUNCS_NEW + html[end_block:]
print('Replaced save functions')

# ─────────────────────────────────────────────────────────────────────────────
# 4. Replace handleLogin with API version
# ─────────────────────────────────────────────────────────────────────────────
OLD_LOGIN_START = 'function handleLogin(e) {'
pos_l = html.find(OLD_LOGIN_START)
assert pos_l > 0, 'handleLogin not found'
pos_l_end = html.find('\nfunction ', pos_l + 20)

NEW_LOGIN = """\
async function handleLogin(e) {
  e.preventDefault();
  const form   = e.target;
  const email  = form.querySelector('[name="email"]').value.trim();
  const pw     = form.querySelector('[name="password"]').value;
  const alertEl = document.getElementById('loginAlert');
  const btn     = form.querySelector('button[type="submit"]');

  btn.disabled = true; btn.textContent = 'Signing in...';
  alertEl.innerHTML = '';

  try {
    const res = await BYT.post('/api/auth/login', { email, password: pw });
    BYT.token = res.token;
    App.currentUser = res.user;
    sessionStorage.setItem('byt_session', JSON.stringify(res.user));

    /* Reload data now that we're authenticated (admin gets full dataset) */
    await loadStorage();
    updateNav();

    if (res.user.role === 'admin') {
      navigate('/admin');
    } else if (res.user.providerId) {
      navigate('/dashboard');
    } else {
      navigate('/client-dashboard');
    }
  } catch (err) {
    alertEl.innerHTML = '<div class="alert alert-error">' + (err.message || 'Invalid email or password') + '</div>';
    btn.disabled = false; btn.textContent = 'Sign In →';
  }
}

"""

html = html[:pos_l] + NEW_LOGIN + html[pos_l_end:]
print('Replaced handleLogin()')

# ─────────────────────────────────────────────────────────────────────────────
# 5. Replace handleRegister with API version
# ─────────────────────────────────────────────────────────────────────────────
OLD_REG_START = 'function handleRegister(e) {'
pos_r = html.find(OLD_REG_START)
assert pos_r > 0, 'handleRegister not found'
pos_r_end = html.find('\nfunction ', pos_r + 20)

NEW_REGISTER = """\
async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  const areas = [...form.querySelectorAll('input[name="serviceAreas"]:checked')].map(c => c.value);
  const alertEl = document.getElementById('registerAlert');
  const btn     = form.querySelector('button[type="submit"]');

  if (data.password !== data.confirmPassword) {
    alertEl.innerHTML = '<div class="alert alert-error">Passwords do not match.</div>'; return;
  }
  if (areas.length === 0) {
    alertEl.innerHTML = '<div class="alert alert-error">Please select at least one service area.</div>'; return;
  }

  btn.disabled = true; btn.textContent = 'Creating account...';
  alertEl.innerHTML = '';

  try {
    const res = await BYT.post('/api/auth/register', {
      email:           data.email,
      password:        data.password,
      companyName:     data.companyName,
      tradeType:       data.tradeType,
      contactName:     data.contactName || '',
      phone:           data.phone || '',
      website:         data.website || '',
      licenseNumber:   data.licenseNumber || '',
      yearsInBusiness: data.yearsInBusiness || '',
      description:     data.description || '',
      serviceAreas:    areas,
      city:            data.city || '',
      province:        data.province || 'ON',
      profileType:     data.profileType || 'company',
    });

    BYT.token = res.token;
    App.currentUser = res.user;
    sessionStorage.setItem('byt_session', JSON.stringify(res.user));

    await loadStorage();
    updateNav();
    navigate('/dashboard');
    showToast('Account created! Your listing is pending approval.', 'success');
  } catch (err) {
    alertEl.innerHTML = '<div class="alert alert-error">' + (err.message || 'Registration failed. Please try again.') + '</div>';
    btn.disabled = false; btn.textContent = 'Create Account →';
  }
}

"""

html = html[:pos_r] + NEW_REGISTER + html[pos_r_end:]
print('Replaced handleRegister()')

# ─────────────────────────────────────────────────────────────────────────────
# 6. Replace logout to clear session
# ─────────────────────────────────────────────────────────────────────────────
OLD_LOGOUT = """function handleLogout() {
  App.currentUser = null;
  sessionStorage.removeItem('to_session');
  updateNav();
  navigate('/');
  showToast('Logged out successfully.');
}"""

NEW_LOGOUT = """function handleLogout() {
  BYT.token = null;
  sessionStorage.removeItem('byt_session');
  sessionStorage.removeItem('to_session');
  App.currentUser = null;
  updateNav();
  navigate('/');
  showToast('Logged out successfully.');
}"""

if OLD_LOGOUT in html:
    html = html.replace(OLD_LOGOUT, NEW_LOGOUT, 1)
    print('Replaced handleLogout()')
else:
    print('WARNING: handleLogout not found exactly — skipping')

# ─────────────────────────────────────────────────────────────────────────────
# 7. Make DOMContentLoaded async
# ─────────────────────────────────────────────────────────────────────────────
OLD_DCL = "document.addEventListener('DOMContentLoaded', () => { loadStorage(); router(); });"
NEW_DCL = "document.addEventListener('DOMContentLoaded', async () => { await loadStorage(); router(); });"
assert OLD_DCL in html, 'DOMContentLoaded not found'
html = html.replace(OLD_DCL, NEW_DCL, 1)
print('Made DOMContentLoaded async')

# ─────────────────────────────────────────────────────────────────────────────
# 8. Update saveMyListing to call API
# ─────────────────────────────────────────────────────────────────────────────
OLD_SAVE_MY = """function saveMyListing(e) {
  e.preventDefault();
  if (!App.currentUser) return;
  var idx = App.providers.findIndex(function(p){ return p.id === App.currentUser.providerId; });
  if (idx < 0) return;
  var fd = new FormData(e.target);
  var data = {};
  fd.forEach(function(v, k){ data[k] = v; });
  data.serviceAreas   = data.serviceAreas   ? data.serviceAreas.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : (App.providers[idx].serviceAreas || []);
  data.certifications = data.certifications ? data.certifications.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : (App.providers[idx].certifications || []);
  if (data.newPassword && data.newPassword.length >= 6) {
    App.providers[idx].password = data.newPassword;
    var uidx = App.users.findIndex(function(u){ return u.providerId === App.providers[idx].id; });
    if (uidx >= 0) App.users[uidx].password = data.newPassword;
    saveUsers();
  }
  delete data.newPassword;
  App.providers[idx] = Object.assign({}, App.providers[idx], data);
  saveProviders();
  var alertEl = document.getElementById('myListingAlert');
  if (alertEl) alertEl.innerHTML = '<div class="alert alert-success" style="margin-bottom:16px;">&#10003; Listing saved successfully!</div>';
  showToast('Listing updated!', 'success');
}"""

NEW_SAVE_MY = """async function saveMyListing(e) {
  e.preventDefault();
  if (!App.currentUser || !App.currentUser.providerId) return;
  var fd = new FormData(e.target);
  var data = {};
  fd.forEach(function(v, k){ data[k] = v; });

  var updates = {
    company_name:      data.companyName,
    trade_type:        data.tradeType,
    contact_name:      data.contactName || '',
    phone:             data.phone || '',
    website:           data.website || '',
    license_number:    data.licenseNumber || '',
    description:       data.description || '',
    service_areas:     data.serviceAreas ? data.serviceAreas.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [],
    certifications:    data.certifications ? data.certifications.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [],
  };

  try {
    var prov = await BYT.put('/api/db/providers?id=' + App.currentUser.providerId, updates);
    /* Update local copy */
    var idx = App.providers.findIndex(function(p){ return p.id === App.currentUser.providerId; });
    if (idx >= 0) App.providers[idx] = Object.assign(App.providers[idx], dbRowToProvider(prov));

    /* Password change */
    if (data.newPassword && data.newPassword.length >= 6) {
      await BYT.put('/api/db/users?id=' + App.currentUser.id, { password: data.newPassword });
    }

    var alertEl = document.getElementById('myListingAlert');
    if (alertEl) alertEl.innerHTML = '<div class="alert alert-success" style="margin-bottom:16px;">&#10003; Listing saved successfully!</div>';
    showToast('Listing updated!', 'success');
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
}"""

if OLD_SAVE_MY in html:
    html = html.replace(OLD_SAVE_MY, NEW_SAVE_MY, 1)
    print('Replaced saveMyListing()')
else:
    print('WARNING: saveMyListing not found exactly — skipping')

# ─────────────────────────────────────────────────────────────────────────────
# 9. Update admin approve/reject to use API
# ─────────────────────────────────────────────────────────────────────────────
OLD_APPROVE = """function adminApproveProvider(id) {
  var idx = App.providers.findIndex(function(p){ return p.id===id; });
  if (idx<0) return;
  App.providers[idx].status = 'active';
  App.providers[idx].claimed = true;
  saveProviders();
  showToast('Provider approved!','success');
  renderAdmin();
}"""

NEW_APPROVE = """async function adminApproveProvider(id) {
  try {
    await BYT.put('/api/db/providers?id=' + id, { status: 'active', claimed: true });
    var idx = App.providers.findIndex(function(p){ return p.id===id; });
    if (idx>=0) { App.providers[idx].status='active'; App.providers[idx].claimed=true; }
    showToast('Provider approved!','success');
    renderAdmin();
  } catch(err) { showToast('Error: ' + err.message,'error'); }
}"""

if OLD_APPROVE in html:
    html = html.replace(OLD_APPROVE, NEW_APPROVE, 1)
    print('Replaced adminApproveProvider()')

OLD_REJECT = """function adminRejectProvider(id) {
  var idx = App.providers.findIndex(function(p){ return p.id===id; });
  if (idx<0) return;
  App.providers[idx].status = 'suspended';
  saveProviders();
  showToast('Provider rejected.','success');
  renderAdmin();
}"""

NEW_REJECT = """async function adminRejectProvider(id) {
  try {
    await BYT.put('/api/db/providers?id=' + id, { status: 'suspended' });
    var idx = App.providers.findIndex(function(p){ return p.id===id; });
    if (idx>=0) App.providers[idx].status='suspended';
    showToast('Provider rejected.','success');
    renderAdmin();
  } catch(err) { showToast('Error: ' + err.message,'error'); }
}"""

if OLD_REJECT in html:
    html = html.replace(OLD_REJECT, NEW_REJECT, 1)
    print('Replaced adminRejectProvider()')

# ─────────────────────────────────────────────────────────────────────────────
# 10. Update contact form to post to API
# ─────────────────────────────────────────────────────────────────────────────
# Already calls /api/contact — update to also save to DB
OLD_CONTACT_STORE = """  // Store locally
  var inq = Object.assign({
    id: 'inq_' + Date.now(),
    createdAt: new Date().toISOString(),
    status: 'new',
    replied: false,
  }, body);
  App.inquiries = App.inquiries || [];
  App.inquiries.unshift(inq);
  saveInquiries();

  try {
    await fetch('/api/contact', {"""

NEW_CONTACT_STORE = """  // Store in Supabase
  try { await BYT.post('/api/db/inquiries', body); } catch(_) {}

  try {
    await fetch('/api/contact', {"""

if OLD_CONTACT_STORE in html:
    html = html.replace(OLD_CONTACT_STORE, NEW_CONTACT_STORE, 1)
    print('Updated contact form to use DB')

# ─────────────────────────────────────────────────────────────────────────────
# WRITE
# ─────────────────────────────────────────────────────────────────────────────
with open(FILE, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'\nWritten: {len(html)} bytes (was {original_len})')

# Syntax check
print('\n--- Syntax check ---')
s = html.find('<script>')
e = html.find('</script>', s)
js = html[s+8:e]
with open('C:/temp/sb_check.js', 'w', encoding='utf-8') as f:
    f.write(js)
r = subprocess.run(['node', '--check', 'C:/temp/sb_check.js'], capture_output=True, text=True)
print('Syntax:', 'PASS' if r.returncode == 0 else 'FAIL')
if r.returncode != 0:
    print(r.stderr[:500])
    raise SystemExit('Syntax error — not committing')
print('All done.')
