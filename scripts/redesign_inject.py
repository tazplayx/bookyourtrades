#!/usr/bin/env python3
"""
Redesign injection script for BookYourTrades
Injects CSS overrides + new hero HTML + scroll JS
"""

import re

SRC = 'C:/Personal/trades-ontario/index.html'

with open(SRC, 'r', encoding='utf-8', newline='') as f:
    content = f.read()

# ─────────────────────────────────────────────────────────────
# 1. CSS OVERRIDES (injected before </style>)
# ─────────────────────────────────────────────────────────────
CSS_OVERRIDES = r"""
/* ============================================================
   REDESIGN OVERRIDES — blueprint aesthetic
============================================================ */

/* --- Extended CSS vars --- */
:root {
  --n900: #070d1a;
  --n800: #0d1828;
  --n700: #122035;
  --cyan: #00c8ff;
  --cyan-dim: rgba(0,200,255,0.08);
  --cyan-glow: rgba(0,200,255,0.25);
  --cyan-border: rgba(0,200,255,0.18);
  --grid-line:  rgba(0,180,255,0.06);
  --grid-line2: rgba(0,180,255,0.025);
  --orange: #ff6b2b;
  --orange-glow: rgba(255,107,43,0.3);
}

/* --- Blueprint grid background --- */
body {
  background: var(--n900);
  position: relative;
}
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px),
    linear-gradient(var(--grid-line2) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line2) 1px, transparent 1px);
  background-size: 80px 80px, 80px 80px, 20px 20px, 20px 20px;
  background-position: -1px -1px, -1px -1px, -1px -1px, -1px -1px;
}

/* Ensure all content sits above grid */
#app, nav, #navbar, .page, footer { position: relative; z-index: 1; }

/* --- Typography: Bebas Neue for display headings --- */
h1, h2 {
  font-family: 'Bebas Neue', 'Barlow Condensed', sans-serif;
  font-weight: 400;
  line-height: 1.0;
  letter-spacing: 0.04em;
}
h3, h4, h5, h6 {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: 0.06em;
}

/* --- Glassmorphic Navbar --- */
#navbar {
  background: rgba(7,13,26,0.82) !important;
  backdrop-filter: blur(18px) saturate(150%) !important;
  -webkit-backdrop-filter: blur(18px) saturate(150%) !important;
  border-bottom: 1px solid var(--cyan-border) !important;
  box-shadow: 0 0 40px rgba(0,200,255,0.07), 0 2px 0 rgba(0,200,255,0.12) !important;
  transition: background 0.3s, box-shadow 0.3s;
}
#navbar.scrolled {
  background: rgba(7,13,26,0.96) !important;
  box-shadow: 0 0 60px rgba(0,200,255,0.12), 0 2px 0 rgba(0,200,255,0.18) !important;
}

/* Nav logo pulse ring */
.nav-logo-mark {
  background: var(--orange) !important;
  box-shadow: 0 0 0 0 var(--orange-glow);
  animation: logoPulse 3s ease-in-out infinite;
}
@keyframes logoPulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--orange-glow); }
  50%       { box-shadow: 0 0 0 8px rgba(255,107,43,0); }
}

/* Cyan nav links */
.nav-link:hover, .nav-link.active {
  color: var(--cyan) !important;
}
.nav-link {
  position: relative;
  transition: color 0.2s;
}
.nav-link::after {
  content: '';
  position: absolute;
  bottom: -4px; left: 0; right: 0;
  height: 1px;
  background: var(--cyan);
  transform: scaleX(0);
  transform-origin: center;
  transition: transform 0.25s ease;
}
.nav-link:hover::after, .nav-link.active::after { transform: scaleX(1); }

/* Nav CTA button */
.nav-cta {
  background: transparent !important;
  border: 1px solid var(--cyan) !important;
  color: var(--cyan) !important;
  font-family: 'Share Tech Mono', monospace !important;
  letter-spacing: 0.08em !important;
  font-size: 12px !important;
  padding: 8px 18px !important;
  transition: background 0.2s, box-shadow 0.2s, color 0.2s !important;
}
.nav-cta:hover {
  background: var(--cyan-dim) !important;
  box-shadow: 0 0 16px var(--cyan-glow) !important;
  color: white !important;
}

/* ============================================================
   HERO — parallax, radial glow, scan lines, bracket corners
============================================================ */
.hero {
  position: relative;
  min-height: 80vh;
  display: flex;
  align-items: center;
  background: var(--n900) !important;
  overflow: hidden;
  padding: 100px 0 80px;
}

/* Radial glow behind hero content */
.hero::before {
  content: '';
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 140%;
  height: 140%;
  background: radial-gradient(ellipse 60% 55% at 50% 40%,
    rgba(0,200,255,0.09) 0%,
    rgba(255,107,43,0.04) 40%,
    transparent 70%);
  pointer-events: none;
  z-index: 0;
}

/* Scan line overlay */
.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(0,200,255,0.012) 3px,
    rgba(0,200,255,0.012) 4px
  );
  pointer-events: none;
  z-index: 0;
}

.hero .container {
  position: relative;
  z-index: 2;
}

/* Bracket corners on hero */
.hero-bracket-tl, .hero-bracket-tr,
.hero-bracket-bl, .hero-bracket-br {
  position: absolute;
  width: 40px; height: 40px;
  border-color: var(--cyan);
  border-style: solid;
  opacity: 0.4;
  z-index: 2;
}
.hero-bracket-tl { top:20px; left:24px; border-width:2px 0 0 2px; }
.hero-bracket-tr { top:20px; right:24px; border-width:2px 2px 0 0; }
.hero-bracket-bl { bottom:20px; left:24px; border-width:0 0 2px 2px; }
.hero-bracket-br { bottom:20px; right:24px; border-width:0 2px 2px 0; }

/* Hero text overrides */
.hero-eyebrow {
  font-family: 'Share Tech Mono', monospace !important;
  font-size: 11px !important;
  letter-spacing: 0.25em !important;
  text-transform: uppercase !important;
  color: var(--cyan) !important;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.hero-eyebrow::before {
  content: '';
  display: inline-block;
  width: 32px; height: 1px;
  background: var(--cyan);
}

.hero h1 {
  font-size: clamp(52px, 7vw, 96px) !important;
  font-family: 'Bebas Neue', sans-serif !important;
  font-weight: 400 !important;
  line-height: 0.95 !important;
  letter-spacing: 0.03em !important;
  color: white !important;
  animation: heroReveal 0.8s ease both;
  animation-delay: 0.1s;
}
.hero h1 .accent-cyan { color: var(--cyan); }
.hero h1 .accent-orange { color: var(--orange); }

.hero p {
  font-family: 'Barlow', sans-serif;
  color: var(--s300);
  font-size: 16px;
  line-height: 1.7;
  max-width: 580px;
  margin-top: 20px;
  animation: heroReveal 0.8s ease both;
  animation-delay: 0.25s;
}

@keyframes heroReveal {
  from { opacity: 0; transform: translateY(22px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Hero search bar redesign */
.search-bar {
  background: rgba(7,13,26,0.8) !important;
  border: 1px solid var(--cyan-border) !important;
  backdrop-filter: blur(12px) !important;
  border-radius: 4px !important;
  box-shadow: 0 0 0 0 var(--cyan-glow);
  transition: box-shadow 0.3s, border-color 0.3s;
  animation: heroReveal 0.8s ease both;
  animation-delay: 0.4s;
  margin-top: 32px;
  padding: 6px !important;
}
.search-bar:focus-within {
  border-color: var(--cyan) !important;
  box-shadow: 0 0 0 3px rgba(0,200,255,0.12) !important;
}
.search-bar input {
  background: transparent !important;
  color: white !important;
  font-family: 'Barlow', sans-serif !important;
}
.search-bar input::placeholder { color: rgba(156,189,214,0.5) !important; }
.search-bar select {
  background: rgba(13,24,40,0.9) !important;
  color: var(--s300) !important;
  border-left: 1px solid var(--cyan-border) !important;
  border-right: 1px solid var(--cyan-border) !important;
}
.search-bar button {
  background: var(--orange) !important;
  font-family: 'Bebas Neue', sans-serif !important;
  font-size: 16px !important;
  letter-spacing: 0.1em !important;
  border-radius: 2px !important;
  padding: 10px 28px !important;
  transition: background 0.2s, box-shadow 0.2s !important;
}
.search-bar button:hover {
  background: #ff4f0d !important;
  box-shadow: 0 0 20px var(--orange-glow) !important;
}

/* Hero stats row */
.hero-stats-row {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
  margin-top: 32px;
  animation: heroReveal 0.8s ease both;
  animation-delay: 0.55s;
}
.hero-stat-val {
  font-family: 'Bebas Neue', sans-serif !important;
  font-size: 26px !important;
  color: var(--cyan) !important;
  line-height: 1 !important;
  display: block !important;
}
.hero-stat-val.orange { color: var(--orange) !important; }

/* ============================================================
   SECTION / CARD overrides
============================================================ */

/* Section headings */
.section-header h2,
.section-title {
  font-family: 'Bebas Neue', sans-serif !important;
  font-weight: 400 !important;
  letter-spacing: 0.05em !important;
  font-size: clamp(32px, 4vw, 52px) !important;
}

.section-header p,
.section-subtitle {
  font-family: 'Barlow', sans-serif;
  color: var(--s400);
}

/* Category cards — cyan glow on hover */
.category-card {
  border: 1px solid rgba(0,200,255,0.1) !important;
  background: rgba(13,24,40,0.7) !important;
  backdrop-filter: blur(6px);
  transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s !important;
}
.category-card:hover {
  border-color: var(--cyan) !important;
  box-shadow: 0 0 24px rgba(0,200,255,0.15) !important;
  transform: translateY(-4px) !important;
}
.cat-icon {
  font-size: 32px;
  margin-bottom: 10px;
  filter: drop-shadow(0 0 8px rgba(0,200,255,0.3));
}

/* Provider cards */
.provider-card, .listing-card, .result-card {
  border: 1px solid rgba(0,200,255,0.08) !important;
  background: rgba(13,24,40,0.8) !important;
  transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s !important;
}
.provider-card:hover, .listing-card:hover, .result-card:hover {
  border-color: rgba(0,200,255,0.3) !important;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(0,200,255,0.1) !important;
  transform: translateY(-3px) !important;
}

/* Primary buttons */
.btn, .btn-primary, button[class*="btn"] {
  font-family: 'Barlow Condensed', sans-serif !important;
  font-weight: 700 !important;
  letter-spacing: 0.05em !important;
}
.btn-primary, .btn-orange {
  background: var(--orange) !important;
  border: none !important;
  transition: background 0.2s, box-shadow 0.2s, transform 0.15s !important;
}
.btn-primary:hover, .btn-orange:hover {
  background: #ff4f0d !important;
  box-shadow: 0 0 24px var(--orange-glow) !important;
  transform: translateY(-1px) !important;
}

/* CTA section dark bg */
.cta-section, [class*="cta-bg"] {
  background: var(--n900) !important;
  border-top: 1px solid var(--cyan-border);
  border-bottom: 1px solid var(--cyan-border);
  position: relative;
  overflow: hidden;
}
.cta-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 60% 80% at 50% 50%, rgba(0,200,255,0.06) 0%, transparent 70%);
  pointer-events: none;
}

/* ============================================================
   SCROLL REVEAL
============================================================ */
.reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
.reveal-delay-1 { transition-delay: 0.1s; }
.reveal-delay-2 { transition-delay: 0.2s; }
.reveal-delay-3 { transition-delay: 0.3s; }
.reveal-delay-4 { transition-delay: 0.4s; }

/* ============================================================
   FOOTER
============================================================ */
footer {
  border-top: 1px solid var(--cyan-border) !important;
  background: rgba(7,13,26,0.95) !important;
}

/* ============================================================
   FORMS / INPUTS
============================================================ */
input[type="text"], input[type="email"], input[type="password"],
input[type="tel"], input[type="number"], textarea, select {
  border: 1px solid rgba(0,200,255,0.15) !important;
  background: rgba(13,24,40,0.7) !important;
  color: white !important;
  transition: border-color 0.2s, box-shadow 0.2s !important;
}
input[type="text"]:focus, input[type="email"]:focus,
input[type="password"]:focus, textarea:focus, select:focus {
  border-color: var(--cyan) !important;
  box-shadow: 0 0 0 3px rgba(0,200,255,0.1) !important;
  outline: none !important;
}

/* ============================================================
   MOBILE
============================================================ */
@media (max-width: 768px) {
  .hero { min-height: 60vh; padding: 80px 0 60px; }
  .hero h1 { font-size: clamp(42px, 12vw, 64px) !important; }
  .hero-bracket-tl, .hero-bracket-tr,
  .hero-bracket-bl, .hero-bracket-br { display: none; }
  body::before { background-size: 40px 40px, 40px 40px, 10px 10px, 10px 10px; }
}
"""

# ─────────────────────────────────────────────────────────────
# 2. INJECT CSS before </style>
# ─────────────────────────────────────────────────────────────
STYLE_END = '</style>'
idx = content.find(STYLE_END)
if idx == -1:
    print("✗ </style> not found!")
else:
    content = content[:idx] + CSS_OVERRIDES + content[idx:]
    print(f"✓ CSS overrides injected at char {idx}")

# ─────────────────────────────────────────────────────────────
# 3. ADD BRACKET CORNERS + stats classes to hero HTML
# ─────────────────────────────────────────────────────────────
OLD_HERO_EYEBROW = '<div class="hero-eyebrow">Canada\'s Commercial Trades Registry</div>'
NEW_HERO_EYEBROW = """<div class="hero-bracket-tl"></div>
      <div class="hero-bracket-tr"></div>
      <div class="hero-bracket-bl"></div>
      <div class="hero-bracket-br"></div>
      <div class="hero-eyebrow">Canada's Commercial Trades Registry</div>"""

if OLD_HERO_EYEBROW in content:
    content = content.replace(OLD_HERO_EYEBROW, NEW_HERO_EYEBROW)
    print("✓ Hero bracket corners injected")
else:
    print("✗ Hero eyebrow not found")

# ─────────────────────────────────────────────────────────────
# 4. Update hero H1 to use accent spans
# ─────────────────────────────────────────────────────────────
OLD_H1 = '<h1>Find Certified<br><span>Trade Professionals</span><br>Across Canada</h1>'
NEW_H1 = '<h1>Find <span class="accent-cyan">Certified</span><br>Trade <span class="accent-orange">Professionals</span><br>Across Canada</h1>'

if OLD_H1 in content:
    content = content.replace(OLD_H1, NEW_H1)
    print("✓ Hero H1 accents injected")
else:
    print("✗ Hero H1 not found — checking for partial match")
    h1_idx = content.find('<h1>Find Certified')
    if h1_idx != -1:
        print(f"  Found at {h1_idx}:", repr(content[h1_idx:h1_idx+100]))

# ─────────────────────────────────────────────────────────────
# 5. Update hero stats row — add Share Tech Mono class
# ─────────────────────────────────────────────────────────────
OLD_STATS = "style=\"color:var(--o400);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:22px;\">80+</span>"
NEW_STATS = "class=\"hero-stat-val\">80+</span>"
if OLD_STATS in content:
    content = content.replace(OLD_STATS, NEW_STATS)
    print("✓ Hero stat val class (80+) updated")
else:
    print("✗ Hero stat 80+ not found")

# ─────────────────────────────────────────────────────────────
# 6. Reveal classes on section grid items
# ─────────────────────────────────────────────────────────────
# Add reveal to section-header divs
content = content.replace('<div class="section-header">', '<div class="section-header reveal">', 1)
print("✓ reveal class on first section-header")

# ─────────────────────────────────────────────────────────────
# 7. SCROLL JS (IntersectionObserver + navbar scrolled)
#    Injected before </body>
# ─────────────────────────────────────────────────────────────
SCROLL_JS = """
<script>
// ── Redesign: Scroll animations & navbar ────────────────────
(function() {
  // Navbar scroll state
  var navbar = document.getElementById('navbar');
  window.addEventListener('scroll', function() {
    if (navbar) {
      if (window.scrollY > 40) navbar.classList.add('scrolled');
      else navbar.classList.remove('scrolled');
    }
  }, { passive: true });

  // IntersectionObserver for .reveal elements
  var io = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  function initReveal() {
    document.querySelectorAll('.reveal').forEach(function(el) {
      if (!el.classList.contains('visible')) io.observe(el);
    });
  }

  // Run on initial load
  document.addEventListener('DOMContentLoaded', initReveal);

  // Re-run after SPA navigation (patch navigate())
  var _origNavigate = window.navigate;
  if (typeof _origNavigate === 'function') {
    window.navigate = function() {
      _origNavigate.apply(this, arguments);
      setTimeout(initReveal, 120);
    };
  }

  // Also run after short delay for already-loaded page
  setTimeout(initReveal, 200);
})();
</script>
"""

BODY_END = '</body>'
body_idx = content.rfind(BODY_END)
if body_idx != -1:
    content = content[:body_idx] + SCROLL_JS + content[body_idx:]
    print("✓ Scroll JS injected before </body>")
else:
    print("✗ </body> not found")

# ─────────────────────────────────────────────────────────────
# 8. Write output
# ─────────────────────────────────────────────────────────────
with open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print(f"\nDone! {len(content):,} chars written to {SRC}")
