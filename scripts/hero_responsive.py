#!/usr/bin/env python3
"""
Hero redesign + mobile responsiveness + dropdown z-index fix
- Full-width hero with stock photo + dark blue overlay
- Wider container, 90vh height, proper layout
- Fix dropdown z-index
- Comprehensive mobile/tablet responsive CSS
- Mobile hamburger nav
"""

SRC = 'C:/Personal/trades-ontario/index.html'

with open(SRC, 'r', encoding='utf-8', newline='') as f:
    content = f.read()

# ─────────────────────────────────────────────────────────────
# 1. Change hero container from .container to .container-wide
# ─────────────────────────────────────────────────────────────
OLD_HERO_DIV = '<div class="container" style="position:relative;z-index:1;">'
NEW_HERO_DIV = '<div class="container-wide" style="position:relative;z-index:2;">'
if OLD_HERO_DIV in content:
    content = content.replace(OLD_HERO_DIV, NEW_HERO_DIV, 1)
    print('✓ Hero container widened')
else:
    print('✗ Hero container not found')

# ─────────────────────────────────────────────────────────────
# 2. Add hamburger button to navbar HTML
# ─────────────────────────────────────────────────────────────
OLD_NAV_INNER = '<div class="nav-inner">'
NEW_NAV_INNER = '''<div class="nav-inner">
      <button class="nav-hamburger" id="navHamburger" onclick="toggleMobileNav()" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>'''
if OLD_NAV_INNER in content:
    content = content.replace(OLD_NAV_INNER, NEW_NAV_INNER, 1)
    print('✓ Hamburger button added to nav')
else:
    print('✗ nav-inner not found')

# ─────────────────────────────────────────────────────────────
# 3. Add mobile nav toggle JS before </body>
# ─────────────────────────────────────────────────────────────
OLD_BODY_END = '</body>'
MOBILE_NAV_JS = '''
<script>
function toggleMobileNav() {
  var nav = document.getElementById('navLinks');
  var btn = document.getElementById('navHamburger');
  if (!nav) return;
  var open = nav.classList.toggle('mobile-open');
  btn.classList.toggle('open', open);
}
// Close mobile nav on route change
var _origNav2 = window.navigate;
if (typeof _origNav2 === 'function') {
  window.navigate = function() {
    _origNav2.apply(this, arguments);
    var nav = document.getElementById('navLinks');
    var btn = document.getElementById('navHamburger');
    if (nav) nav.classList.remove('mobile-open');
    if (btn) btn.classList.remove('open');
  };
}
</script>
</body>'''
content = content.replace('</body>', MOBILE_NAV_JS, 1)
print('✓ Mobile nav JS injected')

# ─────────────────────────────────────────────────────────────
# 4. CSS — inject before </style>
# ─────────────────────────────────────────────────────────────
CSS = r"""
/* ============================================================
   HERO REDESIGN — full-width, stock photo, wider layout
============================================================ */
.hero {
  min-height: 92vh !important;
  display: flex !important;
  align-items: center !important;
  padding: 120px 0 80px !important;
  background-image: url('https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1920&q=80&auto=format&fit=crop') !important;
  background-size: cover !important;
  background-position: center 35% !important;
  background-repeat: no-repeat !important;
  background-attachment: fixed;
}

/* Dark blue overlay — layered for depth */
.hero::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  background:
    linear-gradient(
      105deg,
      rgba(4,10,22,0.96) 0%,
      rgba(7,18,40,0.90) 40%,
      rgba(5,14,35,0.75) 70%,
      rgba(4,10,22,0.60) 100%
    ) !important;
  z-index: 0 !important;
}

/* Orange accent bar at bottom */
.hero::after {
  content: '' !important;
  position: absolute !important;
  bottom: 0 !important; left: 0 !important; right: 0 !important;
  height: 3px !important;
  background: linear-gradient(90deg, var(--o600), var(--o500), var(--cyan)) !important;
  z-index: 3 !important;
}

.hero .container-wide {
  position: relative;
  z-index: 2;
}

/* Hero content — wider text block */
.hero h1 {
  font-size: clamp(56px, 6.5vw, 100px) !important;
  max-width: 820px !important;
  margin-bottom: 20px !important;
}

.hero p {
  max-width: 640px !important;
  font-size: 17px !important;
  margin-top: 16px !important;
}

/* Wider search bar */
.search-bar {
  max-width: 780px !important;
  margin-top: 36px !important;
}

/* Stats row */
.hero-stats-row {
  gap: 40px !important;
  margin-top: 40px !important;
}

/* ============================================================
   DROPDOWN Z-INDEX FIX
============================================================ */
.cat-ui-wrap {
  position: relative;
  z-index: 500;
}
.cat-dropdown-panel {
  z-index: 9999 !important;
}
/* Ensure page-section doesn't clip the dropdown */
.page-section {
  overflow: visible !important;
}
/* The category section specifically */
section.page-section:has(.cat-ui-wrap) {
  overflow: visible !important;
  z-index: 10 !important;
}

/* ============================================================
   MOBILE HAMBURGER NAV
============================================================ */
.nav-hamburger {
  display: none;
  flex-direction: column;
  justify-content: space-between;
  width: 28px; height: 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 1100;
  order: 3;
}
.nav-hamburger span {
  display: block;
  width: 100%; height: 2px;
  background: var(--text);
  border-radius: 2px;
  transition: transform 0.25s, opacity 0.2s;
  transform-origin: center;
}
.nav-hamburger.open span:nth-child(1) { transform: translateY(9px) rotate(45deg); }
.nav-hamburger.open span:nth-child(2) { opacity: 0; }
.nav-hamburger.open span:nth-child(3) { transform: translateY(-9px) rotate(-45deg); }

/* ============================================================
   TABLET — 1024px
============================================================ */
@media (max-width: 1024px) {
  .hero {
    padding: 100px 0 70px !important;
    background-attachment: scroll;
  }
  .hero h1 { font-size: clamp(48px, 6vw, 72px) !important; }
  .search-bar { max-width: 100% !important; }

  /* Nav: hide text-only links */
  .nav-links {
    display: none;
    position: fixed;
    top: 68px; left: 0; right: 0;
    background: rgba(7,13,26,0.98);
    backdrop-filter: blur(20px);
    flex-direction: column;
    padding: 16px 24px 24px;
    border-bottom: 1px solid var(--cyan-border);
    z-index: 999;
    gap: 4px;
  }
  .nav-links.mobile-open { display: flex; }
  .nav-links .nav-link {
    padding: 12px 0;
    font-size: 18px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .nav-links .nav-link:last-child { border-bottom: none; }
  .nav-hamburger { display: flex; }

  /* Hide dropdowns inside mobile nav */
  .nav-dropdown { display: none !important; }

  /* Category grid — 4 columns on tablet */
  .category-grid {
    grid-template-columns: repeat(4, 1fr) !important;
  }
}

/* ============================================================
   MOBILE — 768px
============================================================ */
@media (max-width: 768px) {
  /* Hero */
  .hero {
    min-height: 100svh !important;
    padding: 90px 0 60px !important;
    align-items: flex-start !important;
    background-position: center center !important;
  }
  .hero h1 {
    font-size: clamp(44px, 13vw, 64px) !important;
    line-height: 0.95 !important;
    max-width: 100% !important;
  }
  .hero p {
    font-size: 15px !important;
    max-width: 100% !important;
  }

  /* Search bar stacks vertically */
  .search-bar {
    flex-direction: column !important;
    border-radius: 6px !important;
    overflow: visible !important;
    background: transparent !important;
    border: none !important;
    gap: 8px !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  .search-bar input {
    border: 1px solid var(--cyan-border) !important;
    border-radius: 4px !important;
    background: rgba(7,13,26,0.9) !important;
    backdrop-filter: blur(12px) !important;
    padding: 14px 16px !important;
    font-size: 15px !important;
  }
  .search-bar select {
    border: 1px solid var(--cyan-border) !important;
    border-left: 1px solid var(--cyan-border) !important;
    border-radius: 4px !important;
    background: rgba(7,13,26,0.9) !important;
    padding: 12px 16px !important;
    width: 100% !important;
    font-size: 15px !important;
  }
  .search-bar button {
    border-radius: 4px !important;
    padding: 13px 24px !important;
    font-size: 18px !important;
    width: 100% !important;
    text-align: center !important;
  }

  /* Stats row */
  .hero-stats-row {
    gap: 24px 32px !important;
    margin-top: 28px !important;
  }
  .hero-stat-val { font-size: 30px !important; }

  /* Bracket corners hidden on mobile */
  .hero-bracket-tl, .hero-bracket-tr,
  .hero-bracket-bl, .hero-bracket-br { display: none !important; }

  /* Blueprint grid — smaller grid on mobile */
  body::before {
    background-size: 40px 40px, 40px 40px, 10px 10px, 10px 10px !important;
  }

  /* Nav */
  .nav-hamburger { display: flex !important; }
  .nav-links { display: none; }
  .nav-links.mobile-open { display: flex; }
  .nav-actions .nav-cta { display: none; }

  /* Category dropdown */
  .cat-dropdown-trigger { max-width: 100% !important; }
  .cat-dropdown-panel { max-width: 100% !important; }

  /* Category grid — 2 columns on mobile */
  .category-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 10px !important;
  }
  .category-card { padding: 16px 10px !important; }
  .cat-icon { font-size: 26px !important; }
  .cat-name { font-size: 11px !important; }

  /* Provider cards full width */
  #featuredGrid {
    grid-template-columns: 1fr !important;
  }

  /* Sections */
  .page-section { padding: 40px 0 !important; }
  .section-title { font-size: clamp(28px, 8vw, 40px) !important; }

  /* Pricing cards stack */
  .pricing-grid, [class*="pricing"] {
    grid-template-columns: 1fr !important;
  }

  /* Footer columns stack */
  .footer-grid, .footer-cols, .footer-columns {
    grid-template-columns: 1fr !important;
    gap: 32px !important;
  }

  /* General container padding */
  .container, .container-wide {
    padding: 0 16px !important;
  }
}

/* ============================================================
   SMALL MOBILE — 480px
============================================================ */
@media (max-width: 480px) {
  .hero {
    padding: 80px 0 48px !important;
  }
  .hero h1 { font-size: clamp(38px, 14vw, 54px) !important; }
  .hero-eyebrow { font-size: 9px !important; letter-spacing: 0.18em !important; }
  .hero-stats-row { gap: 16px 24px !important; }
  .hero-stat-val { font-size: 26px !important; }

  /* Nav height */
  .nav-inner { height: 60px !important; }
  .nav-logo-text { font-size: 18px !important; }

  /* Category grid — 2 compact columns */
  .category-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 8px !important;
  }
  .category-card { padding: 14px 8px !important; min-height: auto !important; }
  .cat-icon { font-size: 22px !important; }

  /* Cat dropdown full width */
  .cat-expand-row { flex-wrap: wrap !important; }
  .cat-expand-btn { width: 100% !important; justify-content: center !important; }
}
"""

STYLE_END = '</style>'
idx = content.rfind(STYLE_END)
content = content[:idx] + CSS + content[idx:]
print('✓ CSS injected')

# ─────────────────────────────────────────────────────────────
# 5. Write
# ─────────────────────────────────────────────────────────────
with open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print(f'\nDone! {len(content):,} chars written')
