"""
fix_dashboards.py
Comprehensive update to BookYourTrades index.html.
"""
import sys, os
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

FILE = r'C:/Personal/trades-ontario/index.html'

with open(FILE, 'r', encoding='utf-8') as f:
    html = f.read()

original_len = len(html)
print(f'Loaded {original_len:,} bytes')

# ── 1. BUMP SEED_VERSION ──────────────────────────────────────────────────────
OLD_SEED = "const SEED_VERSION = '2026-05-01-v1'; // Dashboard leads overhaul — SEED_RFQS, onboarding card, upgrade CTAs, 5-free lead gating"
NEW_SEED = "const SEED_VERSION = '2026-05-04-v3'; // Super admin panel, contact page, inquiries, provider listing management"
assert OLD_SEED in html, "SEED_VERSION not found"
html = html.replace(OLD_SEED, NEW_SEED, 1)
print('SEED_VERSION bumped')

# ── 2. ADD saveInquiries() ────────────────────────────────────────────────────
OLD_SAVE = "function saveBookings()  { localStorage.setItem('to_bookings',  JSON.stringify(App.bookings));  }"
NEW_SAVE = OLD_SAVE + "\nfunction saveInquiries() { localStorage.setItem('to_inquiries', JSON.stringify(App.inquiries)); }"
assert OLD_SAVE in html, "saveBookings not found"
html = html.replace(OLD_SAVE, NEW_SAVE, 1)
print('saveInquiries() added')

# ── 3. LOAD INQUIRIES IN loadStorage() ───────────────────────────────────────
OLD_LOAD = "  if (sap) App.applications = JSON.parse(sap);\n\n  // Initialize dynamic blog posts"
NEW_LOAD = (
    "  if (sap) App.applications = JSON.parse(sap);\n\n"
    "  const sinq = localStorage.getItem('to_inquiries');\n"
    "  App.inquiries = sinq ? JSON.parse(sinq) : [];\n\n"
    "  // Initialize dynamic blog posts"
)
assert OLD_LOAD in html, "applications load block not found"
html = html.replace(OLD_LOAD, NEW_LOAD, 1)
print('App.inquiries loaded in loadStorage()')

# ── 4. ADD page-contact HTML ──────────────────────────────────────────────────
CONTACT_PAGE = open(r'C:/Personal/trades-ontario/scripts/_contact_page.html', 'r', encoding='utf-8').read()
OLD_TERMS = "<!-- ============================================================\n     PAGE: TERMS OF SERVICE\n============================================================ -->"
assert OLD_TERMS in html, "Terms page marker not found"
html = html.replace(OLD_TERMS, CONTACT_PAGE + OLD_TERMS, 1)
print('page-contact HTML added')

# ── 5. ADD /contact ROUTE ─────────────────────────────────────────────────────
OLD_ROUTE = (
    "  } else if (page === 'disclaimer') {\n"
    "    document.getElementById('page-disclaimer').classList.add('active');\n"
    "    updateSEO({ title: 'Contractor Disclaimer | BookYourTrades', description: 'Important disclaimers regarding trade contractor listings and booking on BookYourTrades.' });\n"
    "  } else {"
)
NEW_ROUTE = (
    "  } else if (page === 'disclaimer') {\n"
    "    document.getElementById('page-disclaimer').classList.add('active');\n"
    "    updateSEO({ title: 'Contractor Disclaimer | BookYourTrades', description: 'Important disclaimers regarding trade contractor listings and booking on BookYourTrades.' });\n"
    "  } else if (page === 'contact') {\n"
    "    document.getElementById('page-contact').classList.add('active');\n"
    "    updateSEO({ title: 'Contact Us | BookYourTrades', description: 'Get in touch with BookYourTrades — support, listing issues, partnerships, and general inquiries.' });\n"
    "  } else {"
)
assert OLD_ROUTE in html, "disclaimer route not found"
html = html.replace(OLD_ROUTE, NEW_ROUTE, 1)
print('/contact route added')

# ── 6. ADD handleContactSubmit() + saveAvailability() + saveMyListing() ───────
FUNCTIONS_JS = open(r'C:/Personal/trades-ontario/scripts/_new_functions.js', 'r', encoding='utf-8').read()
OLD_JOBS_CMT = "/* ============================================================\n   JOBS BOARD — multi-source, filterable, paginated\n============================================================ */"
assert OLD_JOBS_CMT in html, "JOBS BOARD comment not found"
html = html.replace(OLD_JOBS_CMT, FUNCTIONS_JS + "\n\n" + OLD_JOBS_CMT, 1)
print('handleContactSubmit / saveAvailability / saveMyListing added')

# ── 7. REPLACE renderAdmin() (second definition) ─────────────────────────────
ADMIN_MARKER = (
    "/* ============================================================\n"
    "   ADMIN PANEL\n"
    "============================================================ */\n"
    "function renderAdmin() {\n"
    "  if (!App.currentUser || App.currentUser.role !== 'admin') { navigate('/login'); return; }"
)
assert ADMIN_MARKER in html, "Admin panel marker not found"
pos = html.find(ADMIN_MARKER)
AFTER_ADMIN_MARKER = "\nfunction renderMyJobs() {"
pos_after = html.find(AFTER_ADMIN_MARKER, pos)
assert pos_after > 0, "renderMyJobs not found after admin"
old_admin_block = html[pos:pos_after]
print(f'Old admin block: {len(old_admin_block):,} chars')

NEW_ADMIN_BLOCK = open(r'C:/Personal/trades-ontario/scripts/_admin_panel.js', 'r', encoding='utf-8').read()
html = html[:pos] + NEW_ADMIN_BLOCK + "\n" + html[pos_after:]
print('renderAdmin() replaced with 9-tab super-admin panel')

# ── 8. ADD "My Listing" TAB BUTTON ───────────────────────────────────────────
OLD_TAB_BAR_END = (
    '        <button class="tab-btn" onclick="switchTab(\'tab-photos\',this)">&#128247; Photos</button>\n'
    '      </div>'
)
# Find the one inside renderDashboard (search from a known context)
# We'll find it after the 'tab-leads' context
tab_bar_search = "switchTab('tab-leads',this)"
pos_tab = html.find(tab_bar_search)
assert pos_tab > 0, "tab-leads not found"
# Find OLD_TAB_BAR_END after pos_tab
pos_tab_bar = html.find(OLD_TAB_BAR_END, pos_tab)
assert pos_tab_bar > 0, "Tab bar end not found after tab-leads"
NEW_TAB_BAR_END = (
    '        <button class="tab-btn" onclick="switchTab(\'tab-photos\',this)">&#128247; Photos</button>\n'
    '        <button class="tab-btn" onclick="switchTab(\'tab-my-listing\',this)">&#127970; My Listing</button>\n'
    '      </div>'
)
html = html[:pos_tab_bar] + NEW_TAB_BAR_END + html[pos_tab_bar + len(OLD_TAB_BAR_END):]
print('My Listing tab button added')

# ── 9. ADD tab-my-listing CONTENT BEFORE DASHBOARD CLOSE ─────────────────────
MY_LISTING_TAB = open(r'C:/Personal/trades-ontario/scripts/_my_listing_tab.html', 'r', encoding='utf-8').read()

OLD_DASH_END = (
    '      </div>\n\n'
    '    </div>\n'
    '  `;\n'
    '  renderMyJobs();\n'
    '  renderPhotosTab(prov);\n'
    '}'
)
# Find occurrence after the tab-leads context
pos_dash_end = html.find(OLD_DASH_END, pos_tab)
assert pos_dash_end > 0, f"Dashboard closing not found after pos {pos_tab}"
NEW_DASH_END = (
    '      </div>\n\n'
    + MY_LISTING_TAB + '\n\n'
    '    </div>\n'
    '  `;\n'
    '  renderMyJobs();\n'
    '  renderPhotosTab(prov);\n'
    '}'
)
html = html[:pos_dash_end] + NEW_DASH_END + html[pos_dash_end + len(OLD_DASH_END):]
print('tab-my-listing content added')

# ── 10. FIX AVAILABILITY SAVE BUTTON ─────────────────────────────────────────
OLD_AVAIL_BTN = "          <button class=\"btn btn-orange\" onclick=\"showToast('Availability saved!','success')\">Save Availability</button>"
NEW_AVAIL_BTN = "          <button class=\"btn btn-orange\" onclick=\"saveAvailability()\">Save Availability</button>"
if OLD_AVAIL_BTN in html:
    html = html.replace(OLD_AVAIL_BTN, NEW_AVAIL_BTN, 1)
    print('Availability save button fixed')
else:
    print('WARNING: Availability save button not found')

# ── 11. ADD Contact link to footer nav ───────────────────────────────────────
if "navigate('/contact')" not in html:
    OLD_PRIV_LINK = "onclick=\"navigate('/privacy')\" style=\"color:var(--s400);cursor:pointer;font-size:13px;\">Privacy Policy</a>"
    if OLD_PRIV_LINK in html:
        NEW_PRIV_LINK = (
            OLD_PRIV_LINK + "\n"
            "              <a onclick=\"navigate('/contact')\" style=\"color:var(--s400);cursor:pointer;font-size:13px;\">Contact Us</a>"
        )
        html = html.replace(OLD_PRIV_LINK, NEW_PRIV_LINK, 1)
        print('Contact link added to footer')
    else:
        print('WARNING: footer privacy link not found')
else:
    print('Contact link already present')

# ── 12. RESPONSIVE CSS FOR CONTACT PAGE ──────────────────────────────────────
CONTACT_CSS = (
    "\n/* Contact page responsive */\n"
    "@media (max-width: 768px) { .contact-grid { grid-template-columns: 1fr !important; } }\n"
)
last_style_pos = html.rfind("</style>")
if last_style_pos > 0:
    html = html[:last_style_pos] + CONTACT_CSS + html[last_style_pos:]
    print('Responsive CSS added')

# ── WRITE ─────────────────────────────────────────────────────────────────────
with open(FILE, 'w', encoding='utf-8') as f:
    f.write(html)

print(f'\nDone! Wrote {len(html):,} bytes (was {original_len:,}), delta +{len(html)-original_len:,}')
