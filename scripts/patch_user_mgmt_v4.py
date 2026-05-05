"""
patch_user_mgmt_v4.py
User management for admin Accounts tab.
Key fix: adminEditUser builds the modal using createElement + .onclick
assignment, NOT inline onclick strings — avoiding all quote-escape hell.
"""
import sys, os, subprocess

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

FILE = os.path.join(os.path.dirname(__file__), '..', 'index.html')

with open(FILE, 'r', encoding='utf-8') as f:
    html = f.read()

original_len = len(html)
print(f'Loaded: {original_len} bytes')

# ═══════════════════════════════════════════════════════════════════════════════
# 1. REPLACE var userRows + var clientRows
# ═══════════════════════════════════════════════════════════════════════════════
OLD_ROWS_START = "var userRows = allUsers.map(function(u){"
OLD_ROWS_END   = "  /* ─── jobs table ─── */"

pos_start = html.find(OLD_ROWS_START)
pos_end   = html.find(OLD_ROWS_END, pos_start)
assert pos_start > 0, "userRows start not found"
assert pos_end   > 0, "jobs table comment not found"
print(f'userRows block: {pos_start} to {pos_end}')

# All JS strings on ONE line. No newlines inside single-quoted strings.
# data-uid attribute + this.dataset.uid used for IDs to avoid quote escaping.
NEW_ROWS = """\
  window._adminAllUsers   = allUsers;
  window._adminAllClients = allClients;

  var userRows = allUsers.map(function(u){
    var prov = App.providers.find(function(p){ return p.id===u.providerId; });
    var verBadge   = u.verified ? '<span class="badge badge-green">Verified</span>' : '<span class="badge badge-yellow">Unverified</span>';
    var listBadge  = prov ? (prov.status==='active' ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-yellow">Pending</span>') : '<span style="color:var(--s500)">No Listing</span>';
    var planBadge  = prov ? '<span class="badge ' + (prov.plan==='pro'?'badge-orange':'badge-navy') + '">' + (prov.plan||'free') + '</span>' : '<span style="color:var(--s500)">—</span>';
    var btnEdit    = '<button class="btn btn-sm aeu-edit" style="background:var(--n600);color:var(--s200);border:1px solid var(--n400);" data-uid="' + u.id + '" data-utype="provider">Edit</button>';
    var btnVerify  = u.verified ? '' : '<button class="btn btn-sm aeu-verify" style="background:#1A3A1A;color:#80C080;border:1px solid #2A5A2A;" data-uid="' + u.id + '" data-utype="provider">Verify</button>';
    var btnApprove = (prov && prov.status!=='active') ? '<button class="btn btn-sm aeu-approve" style="background:#1A2A3A;color:#80A8C0;border:1px solid #2A4A6A;" data-uid="' + prov.id + '">Approve Listing</button>' : '';
    var btnDel     = '<button class="btn btn-sm aeu-del" style="background:#4D1A1A;color:#F08080;border:1px solid #6D2A2A;" data-uid="' + u.id + '" data-utype="provider">Remove</button>';
    return '<tr style="border-top:1px solid var(--n500);" data-email="' + u.email.toLowerCase() + '" data-type="provider">' + '<td style="padding:10px 14px;color:var(--s200);">' + u.email + '</td>' + '<td style="padding:10px 14px;color:var(--s300);">' + (prov ? prov.companyName : '<em style="color:var(--s500);">No listing</em>') + '</td>' + '<td style="padding:10px 14px;">' + verBadge + '</td>' + '<td style="padding:10px 14px;">' + listBadge + '</td>' + '<td style="padding:10px 14px;">' + planBadge + '</td>' + '<td style="padding:10px 14px;display:flex;gap:6px;flex-wrap:wrap;">' + btnEdit + btnVerify + btnApprove + btnDel + '</td>' + '</tr>';
  }).join('');

  var clientRows = allClients.map(function(c){
    var verBadge  = c.verified ? '<span class="badge badge-green">Verified</span>' : '<span class="badge badge-yellow">Unverified</span>';
    var btnEdit   = '<button class="btn btn-sm aeu-edit" style="background:var(--n600);color:var(--s200);border:1px solid var(--n400);" data-uid="' + c.id + '" data-utype="client">Edit</button>';
    var btnVerify = c.verified ? '' : '<button class="btn btn-sm aeu-verify" style="background:#1A3A1A;color:#80C080;border:1px solid #2A5A2A;" data-uid="' + c.id + '" data-utype="client">Verify</button>';
    var btnDel    = '<button class="btn btn-sm aeu-del" style="background:#4D1A1A;color:#F08080;border:1px solid #6D2A2A;" data-uid="' + c.id + '" data-utype="client">Remove</button>';
    return '<tr style="border-top:1px solid var(--n500);" data-email="' + c.email.toLowerCase() + '" data-type="client">' + '<td style="padding:10px 14px;color:var(--s200);">' + (c.name||'—') + '</td>' + '<td style="padding:10px 14px;color:var(--s300);">' + c.email + '</td>' + '<td style="padding:10px 14px;">' + verBadge + '</td>' + '<td style="padding:10px 14px;"><span class="badge badge-navy">' + (c.role||'client') + '</span></td>' + '<td style="padding:10px 14px;display:flex;gap:6px;">' + btnEdit + btnVerify + btnDel + '</td>' + '</tr>';
  }).join('');

  """

html = html[:pos_start] + NEW_ROWS + html[pos_end:]
print('Replaced userRows/clientRows')

# ═══════════════════════════════════════════════════════════════════════════════
# 2. REPLACE ACCOUNTS tab content
# ═══════════════════════════════════════════════════════════════════════════════
OLD_ACCT_START = "/* ACCOUNTS */"
OLD_ACCT_END   = "/* MEMBERSHIPS */"

pos_a = html.find(OLD_ACCT_START)
pos_b = html.find(OLD_ACCT_END, pos_a)
assert pos_a > 0 and pos_b > 0
print(f'ACCOUNTS tab: {pos_a} to {pos_b}')

NEW_ACCOUNTS_TAB = """\
/* ACCOUNTS */
    + '<div id="atab-accounts" class="tab-content">'
    + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:20px;">'
    + '<input id="adminUserSearch" class="form-control" style="max-width:280px;" placeholder="Search by email or name..." oninput="adminFilterUsers()" />'
    + '<select id="adminUserTypeFilter" class="form-control" style="max-width:150px;" onchange="adminFilterUsers()"><option value="">All Types</option><option value="provider">Providers</option><option value="client">Clients</option></select>'
    + '<select id="adminUserVerFilter" class="form-control" style="max-width:160px;" onchange="adminFilterUsers()"><option value="">All Statuses</option><option value="verified">Verified</option><option value="unverified">Unverified</option></select>'
    + '</div>'
    + '<div style="overflow-x:auto;"><table id="adminUsersTable" style="width:100%;border-collapse:collapse;font-size:14px;">'
    + '<thead><tr style="background:var(--n700);color:var(--s300);"><th style="padding:10px 14px;text-align:left;">Email</th><th style="padding:10px 14px;text-align:left;">Name / Company</th><th style="padding:10px 14px;text-align:left;">Account</th><th style="padding:10px 14px;text-align:left;">Listing</th><th style="padding:10px 14px;text-align:left;">Plan</th><th style="padding:10px 14px;text-align:left;">Actions</th></tr></thead>'
    + '<tbody id="adminUsersTbody">' + userRows + clientRows + '</tbody>'
    + '</table></div>'
    + '</div>'

    """

html = html[:pos_a] + NEW_ACCOUNTS_TAB + html[pos_b:]
print('Replaced ACCOUNTS tab HTML')

# ═══════════════════════════════════════════════════════════════════════════════
# 3. GLOBAL USER MANAGEMENT FUNCTIONS
#    KEY: adminEditUser uses createElement + .onclick — no inline onclick strings
# ═══════════════════════════════════════════════════════════════════════════════
GLOBAL_FUNCS = r"""
/* ============================================================
   USER MANAGEMENT — GLOBAL ADMIN FUNCTIONS
   Buttons use class-based delegation (no inline onclick in strings)
============================================================ */

/* Delegate clicks on the users table */
document.addEventListener('click', function(e) {
  var btn = e.target.closest('button');
  if (!btn) return;
  var uid   = btn.dataset.uid;
  var utype = btn.dataset.utype;
  if (btn.classList.contains('aeu-edit'))    { e.stopPropagation(); adminEditUser(uid, utype); }
  if (btn.classList.contains('aeu-verify'))  { e.stopPropagation(); adminVerifyUser(uid, utype); }
  if (btn.classList.contains('aeu-approve')) { e.stopPropagation(); adminVerifyListing(uid); }
  if (btn.classList.contains('aeu-del'))     { e.stopPropagation(); adminDeleteUser(uid, utype); }
});

function adminFilterUsers() {
  var search = (document.getElementById('adminUserSearch') || {}).value || '';
  var typeF  = (document.getElementById('adminUserTypeFilter') || {}).value || '';
  var verF   = (document.getElementById('adminUserVerFilter') || {}).value || '';
  search = search.toLowerCase();
  var tbody = document.getElementById('adminUsersTbody');
  if (!tbody) return;
  tbody.querySelectorAll('tr[data-type]').forEach(function(row) {
    var matchS = !search || (row.textContent || '').toLowerCase().indexOf(search) >= 0;
    var matchT = !typeF  || row.dataset.type === typeF;
    var matchV = !verF   || (verF === 'verified' ? !!row.querySelector('.badge-green') : !row.querySelector('.badge-green'));
    row.style.display = (matchS && matchT && matchV) ? '' : 'none';
  });
}

function adminEditUser(id, type) {
  if (!id) return;
  var allU = type === 'provider' ? (window._adminAllUsers || []) : (window._adminAllClients || []);
  var user = allU.find(function(u) { return u.id === id; });
  if (!user) { showToast('User not found', 'error'); return; }
  var prov = type === 'provider' ? (App.providers || []).find(function(p) { return p.id === user.providerId; }) : null;

  /* Remove any existing modal */
  var old = document.getElementById('adminUserModal');
  if (old) old.remove();

  /* Build modal element — NO inline onclick to avoid string-quote issues */
  var mo = document.createElement('div');
  mo.id = 'adminUserModal';
  mo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';

  var inner = document.createElement('div');
  inner.style.cssText = 'background:var(--n800);border:1px solid var(--n500);border-radius:12px;padding:32px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;';

  /* Header row */
  var hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;';
  hdr.innerHTML = '<h3 style="font-size:18px;color:white;margin:0;">Edit ' + (type === 'provider' ? 'Provider' : 'Client') + ' Account</h3>';
  var closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&#215;';
  closeBtn.style.cssText = 'background:none;border:none;color:var(--s400);font-size:22px;cursor:pointer;';
  closeBtn.onclick = function() { mo.remove(); };
  hdr.appendChild(closeBtn);
  inner.appendChild(hdr);

  /* Alert placeholder */
  var alertDiv = document.createElement('div');
  alertDiv.id = 'adminUserModalAlert';
  inner.appendChild(alertDiv);

  /* Form fields */
  var fields = '<div class="form-group"><label class="form-label">Email</label><input id="aedit_email" class="form-control" value="' + (user.email || '') + '" /></div>';

  if (type === 'provider') {
    fields += '<div class="form-group"><label class="form-label">Company Name</label><input id="aedit_company" class="form-control" value="' + (prov ? prov.companyName || '' : '') + '" /></div>';
    fields += '<div class="form-group"><label class="form-label">Contact Name</label><input id="aedit_contact" class="form-control" value="' + (prov ? prov.contactName || '' : '') + '" /></div>';
    fields += '<div class="form-group"><label class="form-label">Phone</label><input id="aedit_phone" class="form-control" value="' + (prov ? prov.phone || '' : '') + '" /></div>';
    fields += '<div class="form-group"><label class="form-label">Plan</label><select id="aedit_plan" class="form-control">'
      + '<option' + (!prov || !prov.plan || prov.plan === 'free' ? ' selected' : '') + '>free</option>'
      + '<option' + (prov && prov.plan === 'pro' ? ' selected' : '') + '>pro</option>'
      + '<option' + (prov && prov.plan === 'enterprise' ? ' selected' : '') + '>enterprise</option>'
      + '</select></div>';
    fields += '<div class="form-group"><label class="form-label">Listing Status</label><select id="aedit_status" class="form-control">'
      + '<option' + (prov && prov.status === 'active' ? ' selected' : '') + '>active</option>'
      + '<option' + (!prov || prov.status === 'pending' ? ' selected' : '') + '>pending</option>'
      + '<option' + (prov && prov.status === 'suspended' ? ' selected' : '') + '>suspended</option>'
      + '</select></div>';
  } else {
    fields += '<div class="form-group"><label class="form-label">Name</label><input id="aedit_name" class="form-control" value="' + (user.name || '') + '" /></div>';
  }
  fields += '<div class="form-group"><label class="form-label">New Password <span style="font-size:12px;color:var(--s400);">(leave blank to keep)</span></label><input id="aedit_pw" class="form-control" type="password" placeholder="Min 6 chars..." /></div>';

  var formWrap = document.createElement('div');
  formWrap.innerHTML = fields;
  inner.appendChild(formWrap);

  /* Buttons */
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;margin-top:20px;';
  var saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-orange';
  saveBtn.textContent = 'Save Changes';
  saveBtn.onclick = function() { adminSaveUser(id, type); };
  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-outline';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = function() { mo.remove(); };
  btnRow.appendChild(saveBtn);
  btnRow.appendChild(cancelBtn);
  inner.appendChild(btnRow);

  mo.appendChild(inner);
  document.body.appendChild(mo);
}

function adminSaveUser(id, type) {
  var email = (document.getElementById('aedit_email') || {}).value || '';
  if (!email) { showToast('Email is required', 'error'); return; }

  var uidx = App.users.findIndex(function(u) { return u.id === id; });
  if (uidx >= 0) App.users[uidx].email = email;

  if (type === 'provider' && uidx >= 0) {
    var user = App.users[uidx];
    if (user.providerId) {
      var pidx = App.providers.findIndex(function(p) { return p.id === user.providerId; });
      if (pidx >= 0) {
        var cn = (document.getElementById('aedit_company') || {}).value; if (cn !== undefined) App.providers[pidx].companyName = cn;
        var ct = (document.getElementById('aedit_contact') || {}).value; if (ct !== undefined) App.providers[pidx].contactName = ct;
        var ph = (document.getElementById('aedit_phone')   || {}).value; if (ph !== undefined) App.providers[pidx].phone = ph;
        var pl = (document.getElementById('aedit_plan')    || {}).value; if (pl) App.providers[pidx].plan = pl;
        var st = (document.getElementById('aedit_status')  || {}).value; if (st) App.providers[pidx].status = st;
        saveProviders();
      }
    }
  } else if (type === 'client' && uidx >= 0) {
    var nm = (document.getElementById('aedit_name') || {}).value;
    if (nm !== undefined) App.users[uidx].name = nm;
  }

  if (uidx >= 0) {
    var pw = (document.getElementById('aedit_pw') || {}).value || '';
    if (pw.length >= 6) App.users[uidx].password = pw;
    saveUsers();
  }

  var modal = document.getElementById('adminUserModal');
  if (modal) modal.remove();
  showToast('User saved!', 'success');
  renderAdmin();
}

function adminVerifyUser(id, type) {
  var idx = App.users.findIndex(function(u) { return u.id === id; });
  if (idx < 0) { showToast('User not found', 'error'); return; }
  App.users[idx].verified = true;
  saveUsers();
  showToast('Account verified!', 'success');
  renderAdmin();
}

function adminVerifyListing(providerId) {
  var pidx = App.providers.findIndex(function(p) { return p.id === providerId; });
  if (pidx < 0) { showToast('Provider not found', 'error'); return; }
  App.providers[pidx].status  = 'active';
  App.providers[pidx].claimed = true;
  saveProviders();
  showToast('Listing approved!', 'success');
  renderAdmin();
}

function adminDeleteUser(id, type) {
  if (!confirm('Remove this user? This cannot be undone.')) return;
  if (type === 'provider') {
    var u = App.users.find(function(x) { return x.id === id; });
    if (u && u.providerId) {
      App.providers = App.providers.filter(function(p) { return p.id !== u.providerId; });
      saveProviders();
    }
  }
  App.users = App.users.filter(function(x) { return x.id !== id; });
  saveUsers();
  showToast('User removed', 'success');
  renderAdmin();
}

"""

INSERT_BEFORE = "\nfunction renderAdminListingsTable2("
pos_insert = html.find(INSERT_BEFORE)
assert pos_insert > 0, "renderAdminListingsTable2 not found"
print(f'Inserting global functions at {pos_insert}')

html = html[:pos_insert] + GLOBAL_FUNCS + html[pos_insert:]
print('Inserted global user management functions')

# ═══════════════════════════════════════════════════════════════════════════════
# 4. WRITE FILE
# ═══════════════════════════════════════════════════════════════════════════════
with open(FILE, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'Written: {len(html)} bytes (was {original_len})')

# ═══════════════════════════════════════════════════════════════════════════════
# 5. SYNTAX CHECK via Node.js
# ═══════════════════════════════════════════════════════════════════════════════
print('\n--- Syntax check ---')
with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

s = content.find('<script>')
e = content.find('</script>', s)   # first closing tag after main script open
js_block = content[s+8:e]

tmp_js = os.path.join(os.path.dirname(__file__), '..', '_syntax_check.js')
with open(tmp_js, 'w', encoding='utf-8') as f:
    f.write(js_block)

result = subprocess.run(['node', '--check', tmp_js], capture_output=True, text=True)
os.remove(tmp_js)

if result.returncode == 0:
    print('Node.js syntax check: PASSED')
else:
    print('Node.js syntax check: FAILED')
    print(result.stderr[:800])
    raise SystemExit('Fix syntax errors before committing.')

# ═══════════════════════════════════════════════════════════════════════════════
# 6. CONTENT CHECKS
# ═══════════════════════════════════════════════════════════════════════════════
print('\n--- Content checks ---')
checks = [
    (True,  'function adminFilterUsers()'),
    (True,  'function adminEditUser('),
    (True,  'function adminSaveUser('),
    (True,  'function adminVerifyUser('),
    (True,  'function adminVerifyListing('),
    (True,  'function adminDeleteUser('),
    (True,  'window._adminAllUsers'),
    (True,  'adminUsersTbody'),
    (True,  'aeu-edit'),
    (True,  'aeu-verify'),
    (True,  'aeu-del'),
    (False, 'buildProviderUserRow'),
    (False, 'buildClientRow'),
]
all_good = True
for expect_present, needle in checks:
    found = needle in content
    ok = found == expect_present
    if not ok: all_good = False
    print(f'  {"PASS" if ok else "FAIL"}: {"found" if found else "not found"} "{needle}"')

if all_good:
    print('\nAll checks passed — safe to commit.')
else:
    raise SystemExit('Content checks failed — fix before committing.')
