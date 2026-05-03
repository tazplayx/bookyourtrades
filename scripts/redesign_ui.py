import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
content = open('C:/Personal/trades-ontario/index.html', 'r', encoding='utf-8', newline='').read()
original_len = len(content)

def replace_once(old, new, label=''):
    global content
    if old in content:
        content = content.replace(old, new, 1)
        print(f'  ✓ {label}')
    else:
        print(f'  ✗ NOT FOUND: {label}')

# ─────────────────────────────────────────
# 1. FONTS — add Bebas Neue + Share Tech Mono
# ─────────────────────────────────────────
replace_once(
    'family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap',
    'family=Bebas+Neue&family=Share+Tech+Mono&family=Barlow+Condensed:ital,wght@0,300;0,400;0,600;0,700;0,800;1,700&family=Barlow:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap',
    'Google Fonts + Bebas Neue + Share Tech Mono'
)

# ─────────────────────────────────────────
# 2. CSS VARIABLES — full palette overhaul
# ─────────────────────────────────────────
OLD_VARS = """:root {
  /* === Brightened dark palette — significantly more readable === */
  --n900: #0D1B2A;    /* body bg        was #060E1A — 40% brighter */
  --n800: #142333;    /* section/nav bg  was #0B1929 */
  --n700: #1B3048;    /* card bg         was #102338 — clearly lighter */
  --n600: #243F5C;    /* alt / hover bg  was #162D49 */
  --n500: #2E5272;    /* border          was #1D3A5C — now visible */
  --n400: #406D96;    /* border strong   was #2A4F78 */
  --s400: #6A92B0;    /* muted text      was #4E728E */
  --s300: #9CBDD6;    /* secondary text  was #7A9AB5 — 25% brighter */
  --s200: #C4DAEA;    /* body text       was #B0C8D9 */
  --s100: #E2EFF8;    /* lightest bg     was #DDE9F0 */
  --o600: #BE5215;
  --o500: #E0621A;
  --o400: #F07030;
  --o300: #F59460;
  --white: #FFFFFF;
  --text: #EDF5FC;    /* primary text    was #EAF0F6 — crisper white */
  --muted: #6A92B0;

  /* === Light-zone palette (pricing, blog, feature sections) === */
  --lz-bg:      #F5F7FA;
  --lz-surface: #FFFFFF;
  --lz-border:  #E2E8F0;
  --lz-text:    #1A2332;
  --lz-sub:     #4A6070;
  --lz-muted:   #718096;
}"""

NEW_VARS = """:root {
  /* === Blueprint-grade dark palette === */
  --n900: #070d1a;    /* deepest bg */
  --n800: #0c1628;    /* section bg */
  --n700: #111f38;    /* card bg */
  --n600: #172843;    /* hover/alt bg */
  --n500: #1e3554;    /* border */
  --n400: #284d74;    /* border strong */
  --s400: #4a6a88;    /* muted text */
  --s300: #7a9ab8;    /* secondary text */
  --s200: #aac8e0;    /* body text */
  --s100: #cce0f0;    /* lightest */
  --o600: #c4500f;
  --o500: #e05a15;
  --o400: #ff6b2b;
  --o300: #ff8c52;
  --white: #ffffff;
  --text:  #e8f4ff;
  --muted: #4a6a88;

  /* === Cyan accent system (new) === */
  --cyan:        #00c8ff;
  --cyan2:       #33d5ff;
  --cyan-dim:    rgba(0,200,255,0.09);
  --cyan-mid:    rgba(0,200,255,0.18);
  --cyan-border: rgba(0,200,255,0.20);
  --cyan-glow:   rgba(0,200,255,0.35);

  /* === Blueprint grid lines === */
  --grid-line:   rgba(0,180,255,0.055);
  --grid-line2:  rgba(0,180,255,0.022);

  /* === Light-zone palette (pricing, blog, feature sections) === */
  --lz-bg:      #F5F7FA;
  --lz-surface: #FFFFFF;
  --lz-border:  #E2E8F0;
  --lz-text:    #1A2332;
  --lz-sub:     #4A6070;
  --lz-muted:   #718096;
}"""

replace_once(OLD_VARS, NEW_VARS, 'CSS variables')

# ─────────────────────────────────────────
# 3. BODY — add blueprint grid background
# ─────────────────────────────────────────
OLD_BODY = """body {
  font-family: 'Barlow', sans-serif;
  background: var(--n900);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}"""

NEW_BODY = """body {
  font-family: 'Barlow', sans-serif;
  background: var(--n900);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
  position: relative;
}

/* Blueprint grid — persistent across every page */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px),
    linear-gradient(var(--grid-line2) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line2) 1px, transparent 1px);
  background-size: 80px 80px, 80px 80px, 20px 20px, 20px 20px;
  pointer-events: none;
  z-index: 0;
}"""

replace_once(OLD_BODY, NEW_BODY, 'body blueprint grid')

# ─────────────────────────────────────────
# 4. HEADINGS — Bebas Neue for h1-h6
# ─────────────────────────────────────────
OLD_H = """h1, h2, h3, h4, h5, h6 {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: 0.03em;
}"""

NEW_H = """h1, h2, h3, h4, h5, h6 {
  font-family: 'Bebas Neue', sans-serif;
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: 0.04em;
}"""

replace_once(OLD_H, NEW_H, 'headings → Bebas Neue')

# ─────────────────────────────────────────
# 5. NAVIGATION — glassmorphic redesign
# ─────────────────────────────────────────
OLD_NAV = """#navbar {
  background: var(--n800);
  border-bottom: 3px solid var(--o500);
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}

.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 68px;
}

.nav-logo { display: flex; align-items: center; gap: 10px; }

.nav-logo-mark {
  width: 38px; height: 38px;
  background: var(--o500);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 800; font-size: 16px; color: white; flex-shrink: 0;
}

.nav-logo-name {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 800; font-size: 22px; color: white;
  letter-spacing: 0.05em; line-height: 1; display: block;
}

.nav-logo-sub {
  font-size: 10px; font-weight: 500; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--o400); line-height: 1;
  margin-top: 2px; display: block;
}

.nav-links { display: flex; align-items: center; gap: 4px; }

.nav-link {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600; font-size: 15px; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--s200);
  padding: 6px 14px; border-radius: 3px;
  transition: color 0.2s, background 0.2s;
}
.nav-link:hover { color: white; background: var(--n600); }"""

NEW_NAV = """#navbar {
  background: rgba(7,13,26,0.85);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border-bottom: 1px solid var(--cyan-border);
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 2px 40px rgba(0,0,0,0.5), 0 1px 0 var(--cyan-border);
  transition: background 0.3s ease;
}

#navbar.scrolled {
  background: rgba(7,13,26,0.96);
  border-bottom-color: rgba(0,200,255,0.28);
}

.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

.nav-logo { display: flex; align-items: center; gap: 10px; }

.nav-logo-mark {
  width: 36px; height: 36px;
  background: var(--o500);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 16px; color: white; flex-shrink: 0;
  box-shadow: 0 0 16px rgba(255,107,43,0.4);
}

.nav-logo-name {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 24px; color: white;
  letter-spacing: 0.08em; line-height: 1; display: block;
}

.nav-logo-sub {
  font-family: 'Share Tech Mono', monospace;
  font-size: 9px; font-weight: 400; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--cyan); line-height: 1;
  margin-top: 2px; display: block; opacity: 0.8;
}

.nav-links { display: flex; align-items: center; gap: 2px; }

.nav-link {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600; font-size: 14px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--s300);
  padding: 6px 14px;
  transition: color 0.2s;
  position: relative;
}
.nav-link::after {
  content: '';
  position: absolute; bottom: 2px; left: 14px; right: 14px;
  height: 1px; background: var(--cyan);
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.25s ease;
}
.nav-link:hover { color: var(--white); }
.nav-link:hover::after { transform: scaleX(1); }"""

replace_once(OLD_NAV, NEW_NAV, 'navbar glassmorphic redesign')

# ─────────────────────────────────────────
# 6. NAV DROPDOWNS — updated colors
# ─────────────────────────────────────────
OLD_DROP = """.nav-dropdown-menu {
  position: absolute; top: calc(100% + 6px); left: 0;
  background: var(--n700); border: 1px solid var(--n500);
  border-top: 2px solid var(--o500);
  border-radius: 0 0 6px 6px; padding: 6px 0; min-width: 200px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  opacity: 0; visibility: hidden; transform: translateY(-6px);
  transition: opacity 0.15s, transform 0.15s, visibility 0.15s; z-index: 1100;
}"""

NEW_DROP = """.nav-dropdown-menu {
  position: absolute; top: calc(100% + 4px); left: 0;
  background: rgba(11,22,40,0.97);
  backdrop-filter: blur(20px);
  border: 1px solid var(--cyan-border);
  border-top: 2px solid var(--cyan);
  border-radius: 0 0 4px 4px; padding: 6px 0; min-width: 210px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,200,255,0.05);
  opacity: 0; visibility: hidden; transform: translateY(-8px);
  transition: opacity 0.18s, transform 0.18s, visibility 0.18s; z-index: 1100;
}"""

replace_once(OLD_DROP, NEW_DROP, 'dropdown menu')

OLD_DROP_TRIGGER = """.nav-dropdown-trigger {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600; font-size: 15px; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--s200);
  padding: 6px 14px; border-radius: 3px;
  transition: color 0.2s, background 0.2s;
  display: flex; align-items: center; gap: 5px;
  cursor: pointer; background: none; border: none;
}
.nav-dropdown-trigger:hover,
.nav-dropdown:hover .nav-dropdown-trigger { color: white; background: var(--n600); }"""

NEW_DROP_TRIGGER = """.nav-dropdown-trigger {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600; font-size: 14px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--s300);
  padding: 6px 14px;
  transition: color 0.2s;
  display: flex; align-items: center; gap: 5px;
  cursor: pointer; background: none; border: none;
}
.nav-dropdown-trigger:hover,
.nav-dropdown:hover .nav-dropdown-trigger { color: white; }"""

replace_once(OLD_DROP_TRIGGER, NEW_DROP_TRIGGER, 'dropdown trigger')

# ─────────────────────────────────────────
# 7. BUTTONS — refresh with cyan option
# ─────────────────────────────────────────
OLD_BTN = """.btn {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700; font-size: 15px;
  letter-spacing: 0.08em; text-transform: uppercase;
  padding: 10px 22px; border-radius: 3px; border: none;
  transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px;
}

.btn-orange {
  background: var(--o500); color: white;
  box-shadow: 0 2px 8px rgba(232,98,26,0.3);
}
.btn-orange:hover { background: var(--o400); box-shadow: 0 4px 16px rgba(232,98,26,0.4); transform: translateY(-1px); }

.btn-outline {
  background: transparent; color: var(--o400);
  border: 2px solid var(--o500);
}
.btn-outline:hover { background: var(--o500); color: white; }

.btn-navy {
  background: var(--n600); color: var(--text);
  border: 1px solid var(--n400);
}
.btn-navy:hover { background: var(--n500); }

.btn-sm  { padding: 7px 16px; font-size: 13px; }
.btn-lg  { padding: 14px 32px; font-size: 17px; }"""

NEW_BTN = """.btn {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700; font-size: 14px;
  letter-spacing: 0.10em; text-transform: uppercase;
  padding: 10px 24px; border: none;
  transition: all 0.22s; display: inline-flex; align-items: center; gap: 8px;
  position: relative; overflow: hidden;
}

.btn::after {
  content: '';
  position: absolute; inset: 0;
  background: rgba(255,255,255,0);
  transition: background 0.2s;
}
.btn:hover::after { background: rgba(255,255,255,0.06); }

.btn-orange {
  background: var(--o500); color: white;
  box-shadow: 0 2px 16px rgba(224,90,21,0.35);
}
.btn-orange:hover {
  background: var(--o400);
  box-shadow: 0 4px 24px rgba(255,107,43,0.5);
  transform: translateY(-2px);
}

.btn-cyan {
  background: var(--cyan); color: var(--n900);
  box-shadow: 0 2px 16px var(--cyan-glow);
  font-weight: 700;
}
.btn-cyan:hover {
  background: var(--cyan2);
  box-shadow: 0 4px 28px var(--cyan-glow);
  transform: translateY(-2px);
}

.btn-outline {
  background: transparent; color: var(--o400);
  border: 1.5px solid var(--o500);
}
.btn-outline:hover { background: var(--o500); color: white; }

.btn-outline-cyan {
  background: transparent; color: var(--cyan);
  border: 1.5px solid var(--cyan-border);
}
.btn-outline-cyan:hover {
  background: var(--cyan-dim);
  border-color: var(--cyan);
}

.btn-navy {
  background: var(--n700); color: var(--text);
  border: 1px solid var(--n500);
}
.btn-navy:hover { background: var(--n600); border-color: var(--n400); }

.btn-sm  { padding: 7px 16px; font-size: 12px; }
.btn-lg  { padding: 14px 36px; font-size: 16px; }"""

replace_once(OLD_BTN, NEW_BTN, 'buttons + new cyan button')

# ─────────────────────────────────────────
# 8. HERO — full parallax redesign
# ─────────────────────────────────────────
OLD_HERO_CSS = """.hero {
  background: var(--n800);
  position: relative; overflow: hidden;
  padding: 80px 0 90px;
  background-image: url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1600&q=80&auto=format&fit=crop');
  background-size: cover;
  background-position: center 40%;
  background-repeat: no-repeat;
}
.hero::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(105deg, rgba(6,14,26,0.93) 0%, rgba(11,25,41,0.87) 55%, rgba(6,14,26,0.72) 100%);
  z-index: 0;
}
.hero::after {
  content: ''; position: absolute; bottom: 0; left: 0; right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--o600), var(--o500), var(--o400));
}

.hero-eyebrow {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700; font-size: 12px; letter-spacing: 0.2em;
  text-transform: uppercase; color: var(--o400);
  margin-bottom: 16px; display: flex; align-items: center; gap: 10px;
}
.hero-eyebrow::before {
  content: ''; display: block; width: 32px; height: 2px; background: var(--o500);
}

.hero h1 {
  font-size: clamp(48px, 6vw, 84px); font-weight: 800;
  line-height: 1; letter-spacing: 0.02em; color: white; margin-bottom: 20px;
}
.hero h1 span { color: var(--o400); }

.hero p {
  font-size: 18px; color: var(--s300); max-width: 560px;
  margin-bottom: 40px; font-weight: 300; line-height: 1.7;
}"""

NEW_HERO_CSS = """.hero {
  background: var(--n900);
  position: relative; overflow: hidden;
  padding: 100px 0 110px;
  min-height: 600px;
}

/* Parallax layer — blueprint grid gets fixed, hero has additional radial glow */
.hero::before {
  content: '';
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,200,255,0.07) 0%, transparent 70%),
    radial-gradient(ellipse 50% 40% at 10% 100%, rgba(255,107,43,0.06) 0%, transparent 60%);
  z-index: 0;
  pointer-events: none;
}

/* Horizon line at bottom */
.hero::after {
  content: '';
  position: absolute; bottom: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--cyan) 30%, var(--o500) 70%, transparent);
  opacity: 0.5;
}

/* Animated scan-line effect */
.hero-scanline {
  position: absolute; inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(0,0,0,0.025) 3px,
    rgba(0,0,0,0.025) 6px
  );
  pointer-events: none; z-index: 1;
}

/* Corner tech brackets */
.hero-bracket-tl,
.hero-bracket-tr {
  position: absolute; width: 40px; height: 40px;
  z-index: 2; opacity: 0.35;
}
.hero-bracket-tl { top: 24px; left: 24px; border-top: 2px solid var(--cyan); border-left: 2px solid var(--cyan); }
.hero-bracket-tr { top: 24px; right: 24px; border-top: 2px solid var(--cyan); border-right: 2px solid var(--cyan); }

.hero-eyebrow {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px; letter-spacing: 0.28em;
  text-transform: uppercase; color: var(--cyan);
  margin-bottom: 20px;
  display: inline-flex; align-items: center; gap: 12px;
  background: var(--cyan-dim);
  border: 1px solid var(--cyan-border);
  padding: 5px 16px;
  opacity: 0;
  animation: heroReveal 0.6s ease forwards 0.1s;
}
.hero-eyebrow::before {
  content: '//'; opacity: 0.5; font-family: 'Share Tech Mono', monospace;
}

.hero h1 {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(64px, 8vw, 112px); font-weight: 400;
  line-height: 0.92; letter-spacing: 0.03em; color: white; margin-bottom: 24px;
  opacity: 0;
  animation: heroReveal 0.7s ease forwards 0.25s;
}
.hero h1 .accent-cyan  { color: var(--cyan); }
.hero h1 .accent-orange { color: var(--o400); }

.hero p {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 20px; color: var(--s300); max-width: 580px;
  margin-bottom: 44px; font-weight: 300; line-height: 1.65;
  opacity: 0;
  animation: heroReveal 0.7s ease forwards 0.4s;
}

@keyframes heroReveal {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}"""

replace_once(OLD_HERO_CSS, NEW_HERO_CSS, 'hero CSS redesign')

# ─────────────────────────────────────────
# 9. SEARCH BAR — elevated design
# ─────────────────────────────────────────
OLD_SEARCH = """/* Search Bar */
.search-bar {
  display: flex; max-width: 660px;
  background: var(--n600); border: 2px solid var(--n400);
  border-radius: 5px; overflow: hidden;
  box-shadow: 0 4px 24px rgba(0,0,0,0.3);
  transition: border-color 0.2s;
}
.search-bar:focus-within { border-color: var(--o500); }
.search-bar input {
  flex: 1; background: transparent; border: none;
  color: var(--text); padding: 14px 18px; font-size: 16px; outline: none;
}
.search-bar input::placeholder { color: var(--s400); }
.search-bar select {
  background: var(--n500); border: none;
  border-left: 1px solid var(--n400);
  color: var(--s200); padding: 0 14px; font-size: 15px; outline: none; min-width: 160px;
}
.search-bar button {
  background: var(--o500); border: none; color: white; padding: 0 24px;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase;
  transition: background 0.2s; white-space: nowrap;
}
.search-bar button:hover { background: var(--o400); }"""

NEW_SEARCH = """/* Search Bar */
.search-bar {
  display: flex; max-width: 680px;
  background: rgba(12,22,40,0.9);
  backdrop-filter: blur(16px);
  border: 1.5px solid var(--cyan-border);
  overflow: hidden;
  box-shadow: 0 4px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,200,255,0.04);
  transition: border-color 0.25s, box-shadow 0.25s;
  opacity: 0;
  animation: heroReveal 0.7s ease forwards 0.55s;
}
.search-bar:focus-within {
  border-color: var(--cyan);
  box-shadow: 0 4px 32px rgba(0,0,0,0.4), 0 0 20px var(--cyan-glow);
}
.search-bar input {
  flex: 1; background: transparent; border: none;
  color: var(--text); padding: 15px 20px; font-size: 15px; outline: none;
  font-family: 'Barlow Condensed', sans-serif; font-weight: 400; letter-spacing: 0.03em;
}
.search-bar input::placeholder { color: var(--s400); }
.search-bar select {
  background: rgba(0,200,255,0.06); border: none;
  border-left: 1px solid var(--cyan-border);
  color: var(--s200); padding: 0 14px; font-size: 14px; outline: none;
  min-width: 160px; font-family: 'Barlow Condensed', sans-serif;
}
.search-bar button {
  background: var(--o500); border: none; color: white; padding: 0 28px;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 17px; letter-spacing: 0.10em;
  transition: background 0.2s, box-shadow 0.2s; white-space: nowrap;
}
.search-bar button:hover {
  background: var(--o400);
  box-shadow: inset 0 0 20px rgba(255,255,255,0.1);
}"""

replace_once(OLD_SEARCH, NEW_SEARCH, 'search bar redesign')

# ─────────────────────────────────────────
# 10. CATEGORY GRID CARDS — improved
# ─────────────────────────────────────────
OLD_CAT = """.category-card {
  background: var(--n700); border: 1px solid var(--n500);
  border-radius: 6px; padding: 20px 12px; text-align: center;
  cursor: pointer; transition: all 0.2s;
}
.category-card:hover { background: var(--n600); border-color: var(--o500); transform: translateY(-2px); }
.category-card:hover .cat-icon { color: var(--o400); }

.cat-icon { font-size: 28px; margin-bottom: 8px; color: var(--s300); transition: color 0.2s; }
.cat-name {
  font-family: 'Barlow Condensed', sans-serif; font-weight: 600; font-size: 14px;
  letter-spacing: 0.05em; text-transform: uppercase; color: var(--s200);
}"""

NEW_CAT = """.category-card {
  background: var(--n700);
  border: 1px solid var(--n500);
  border-top: 2px solid transparent;
  padding: 22px 12px; text-align: center;
  cursor: pointer;
  transition: all 0.22s;
  position: relative; overflow: hidden;
}
.category-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, var(--cyan), var(--o500));
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.3s ease;
}
.category-card:hover::before { transform: scaleX(1); }
.category-card:hover {
  background: var(--n600);
  border-color: var(--cyan-border);
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px var(--cyan-border);
}
.category-card:hover .cat-icon { transform: scale(1.15); filter: drop-shadow(0 0 8px var(--cyan-glow)); }

.cat-icon {
  font-size: 28px; margin-bottom: 10px; display: block;
  transition: transform 0.25s, filter 0.25s;
}
.cat-name {
  font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 13px;
  letter-spacing: 0.07em; text-transform: uppercase; color: var(--s200);
  line-height: 1.2;
}"""

replace_once(OLD_CAT, NEW_CAT, 'category cards redesign')

# ─────────────────────────────────────────
# 11. SECTION HEADERS — tag-style labels
# ─────────────────────────────────────────
OLD_SHEAD = """.section-header {
  display: flex; align-items: flex-end; justify-content: space-between;
  margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid var(--n500);
}

.section-label {
  font-family: 'Barlow Condensed', sans-serif; font-weight: 700;
  font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--o500); margin-bottom: 4px;
}"""

NEW_SHEAD = """.section-header {
  display: flex; align-items: flex-end; justify-content: space-between;
  margin-bottom: 36px; padding-bottom: 20px;
  border-bottom: 1px solid rgba(0,180,255,0.12);
}

.section-label {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase;
  color: var(--cyan); margin-bottom: 6px;
  display: inline-flex; align-items: center; gap: 8px;
}
.section-label::before { content: '//'; opacity: 0.5; }"""

replace_once(OLD_SHEAD, NEW_SHEAD, 'section headers redesign')

OLD_STITLE = """.section-title {
  font-size: clamp(28px, 3.5vw, 42px); font-weight: 800;
  color: white; letter-spacing: 0.02em;
}"""

NEW_STITLE = """.section-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(36px, 4vw, 56px); font-weight: 400;
  color: white; letter-spacing: 0.04em; line-height: 0.95;
}"""

replace_once(OLD_STITLE, NEW_STITLE, 'section title')

# ─────────────────────────────────────────
# 12. PROVIDER CARDS — enhanced
# ─────────────────────────────────────────
OLD_CARD = """.provider-card {
  background: var(--n700);
  border: 1px solid var(--n500);
  border-left: 4px solid var(--o500);
  border-radius: 6px; padding: 24px;
  transition: all 0.2s; cursor: pointer;
}
.provider-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  border-color: var(--o400); background: var(--n600);
}"""

NEW_CARD = """.provider-card {
  background: var(--n700);
  border: 1px solid var(--n500);
  border-left: 3px solid var(--cyan);
  padding: 24px;
  transition: all 0.25s; cursor: pointer;
  position: relative; overflow: hidden;
}
.provider-card::after {
  content: '';
  position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, var(--cyan), var(--o500), transparent);
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.3s ease;
}
.provider-card:hover::after { transform: scaleX(1); }
.provider-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 36px rgba(0,0,0,0.4), 0 0 0 1px var(--cyan-border);
  border-color: var(--cyan); background: var(--n600);
}"""

replace_once(OLD_CARD, NEW_CARD, 'provider cards redesign')

# ─────────────────────────────────────────
# 13. FORM CONTROLS — sharper style
# ─────────────────────────────────────────
OLD_FORM = """.form-control {
  width: 100%;
  background: var(--n700);
  border: 1.5px solid var(--n400);
  color: var(--text);
  padding: 11px 14px; border-radius: 4px;
  font-size: 15px; outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-control:focus { border-color: var(--o500); box-shadow: 0 0 0 3px rgba(224,98,26,0.15); }
.form-control::placeholder { color: var(--s400); }
.form-control option { background: var(--n700); }
textarea.form-control { resize: vertical; min-height: 100px; }"""

NEW_FORM = """.form-control {
  width: 100%;
  background: var(--n800);
  border: 1.5px solid var(--n500);
  color: var(--text);
  padding: 12px 16px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 15px; letter-spacing: 0.02em; outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.form-control:focus {
  border-color: var(--cyan);
  background: rgba(0,200,255,0.03);
  box-shadow: 0 0 0 3px var(--cyan-dim), 0 0 12px var(--cyan-glow);
}
.form-control::placeholder { color: var(--s400); }
.form-control option { background: var(--n800); }
textarea.form-control { resize: vertical; min-height: 100px; }"""

replace_once(OLD_FORM, NEW_FORM, 'form controls')

# ─────────────────────────────────────────
# 14. PAGE-SECTION spacing
# ─────────────────────────────────────────
replace_once(
    '.page-section { padding: 60px 0; }',
    '.page-section { padding: 72px 0; position: relative; z-index: 2; }',
    'page-section z-index'
)

# ─────────────────────────────────────────
# 15. ADD SCROLL-REVEAL + PARALLAX + NAV SCROLL DETECTION CSS
#     Append to </style>
# ─────────────────────────────────────────
EXTRA_CSS = """
/* ============================================================
   SCROLL-REVEAL ANIMATIONS
============================================================ */
.reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.55s ease, transform 0.55s ease;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
.reveal-left {
  opacity: 0;
  transform: translateX(-28px);
  transition: opacity 0.55s ease, transform 0.55s ease;
}
.reveal-left.visible {
  opacity: 1;
  transform: translateX(0);
}

/* Stagger delays */
.reveal-d1 { transition-delay: 0.08s; }
.reveal-d2 { transition-delay: 0.16s; }
.reveal-d3 { transition-delay: 0.24s; }
.reveal-d4 { transition-delay: 0.32s; }
.reveal-d5 { transition-delay: 0.40s; }

/* ============================================================
   STATS ROW (hero bottom)
============================================================ */
.hero-stats-row {
  display: flex; gap: 36px; flex-wrap: wrap;
  margin-top: 28px;
  opacity: 0;
  animation: heroReveal 0.7s ease forwards 0.7s;
}
.hero-stat-item { display: flex; flex-direction: column; gap: 2px; }
.hero-stat-val {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 38px; color: var(--cyan); line-height: 1;
  text-shadow: 0 0 20px var(--cyan-glow);
}
.hero-stat-val.orange { color: var(--o400); text-shadow: 0 0 20px rgba(255,107,43,0.4); }
.hero-stat-lbl {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px; letter-spacing: 0.15em;
  text-transform: uppercase; color: var(--s400);
}

/* ============================================================
   BLUEPRINT TAG LABELS  (section eyebrows)
============================================================ */
.blueprint-tag {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--cyan);
  background: var(--cyan-dim);
  border: 1px solid var(--cyan-border);
  padding: 4px 14px; margin-bottom: 12px;
}
.blueprint-tag::before { content: '//'; opacity: 0.5; }

.blueprint-tag.orange {
  color: var(--o400);
  background: rgba(255,107,43,0.07);
  border-color: rgba(255,107,43,0.22);
}
.blueprint-tag.orange::before { content: '//'; }

/* ============================================================
   FEATURE CARDS (homepage why-us section)
============================================================ */
.feature-card {
  background: var(--n700);
  border: 1px solid var(--n500);
  padding: 32px 28px;
  position: relative; overflow: hidden;
  transition: transform 0.25s, box-shadow 0.25s, border-color 0.25s;
}
.feature-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: var(--cyan);
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.35s ease;
}
.feature-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.4); border-color: var(--cyan-border); }
.feature-card:hover::before { transform: scaleX(1); }

.feature-icon {
  width: 52px; height: 52px;
  background: var(--cyan-dim); border: 1px solid var(--cyan-border);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; margin-bottom: 18px;
  transition: background 0.2s, box-shadow 0.2s;
}
.feature-card:hover .feature-icon {
  background: rgba(0,200,255,0.14);
  box-shadow: 0 0 20px var(--cyan-glow);
}
.feature-card h3 {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 26px; letter-spacing: 0.04em;
  color: var(--white); margin-bottom: 10px; line-height: 1;
}
.feature-card p {
  font-size: 15px; color: var(--s300); line-height: 1.6; font-weight: 300;
}

/* ============================================================
   HORIZONTAL RULE / SECTION DIVIDER
============================================================ */
.h-rule {
  width: 100%; height: 1px;
  background: linear-gradient(90deg, var(--cyan) 0%, rgba(0,200,255,0.2) 50%, transparent 100%);
  margin: 0 0 0;
  opacity: 0.5;
}

/* ============================================================
   SCROLLBAR STYLING
============================================================ */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--n900); }
::-webkit-scrollbar-thumb { background: var(--n500); }
::-webkit-scrollbar-thumb:hover { background: var(--cyan); }

/* ============================================================
   NAV CTA BUTTON
============================================================ */
.nav-cta {
  font-family: 'Bebas Neue', sans-serif !important;
  font-size: 15px !important; letter-spacing: 0.10em !important;
  background: var(--o500) !important; color: white !important;
  padding: 8px 20px !important; margin-left: 8px;
  transition: background 0.2s, box-shadow 0.2s !important;
  box-shadow: 0 0 0 1px rgba(255,107,43,0.3);
}
.nav-cta:hover {
  background: var(--o400) !important;
  box-shadow: 0 0 16px rgba(255,107,43,0.4) !important;
  transform: none !important;
}
.nav-cta::after { display: none !important; }
"""

replace_once('</style>', EXTRA_CSS + '\n</style>', 'extra CSS animations + components')

# ─────────────────────────────────────────
# 16. UPDATE HOME PAGE HERO HTML
# ─────────────────────────────────────────
OLD_HERO_HTML = """  <!-- Hero -->
  <section class="hero">
    <div class="container" style="position:relative;z-index:1;">
      <div class="hero-eyebrow">Canada's Commercial Trades Registry</div>
      <h1>Find Certified<br><span>Trade Professionals</span><br>Across Canada</h1>
      <p>Connect with licensed electricians, plumbers, HVAC specialists, welders, roofers, and more. Verified trade contractors from coast to coast ready to quote your next project.</p>
      <div class="search-bar">
        <input type="text" id="heroSearch" placeholder="Search trades, companies, services..." />
        <select id="heroCity">
          <option value="">All Canadian Cities</option>
          <option>Toronto</option><option>Ottawa</option><option>Hamilton</option><option>Mississauga</option>
          <option>London</option><option>Windsor</option><option>Brampton</option><option>Kitchener</option>
          <option>Barrie</option><option>Sudbury</option><option>Thunder Bay</option><option>Oakville</option>
          <option>Burlington</option><option>St. Catharines</option><option>Sarnia</option><option>Chatham</option>
          <option>Guelph</option><option>Cambridge</option><option>Waterloo</option><option>Kingston</option>
          <option>Peterborough</option><option>Oshawa</option><option>Ajax</option><option>Markham</option>
          <option>Vaughan</option><option>Richmond Hill</option><option>Sault Ste. Marie</option>
          <option>North Bay</option><option>Brantford</option><option>Niagara Falls</option>
          <option>Belleville</option><option>Orillia</option>
        </select>
        <button onclick="doHeroSearch()">Search</button>
      </div>
      <div style="margin-top:24px;display:flex;gap:32px;flex-wrap:wrap;">
        <div style="font-size:14px;color:var(--s300);">
          <span style="color:var(--o400);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:22px;">80+</span>
          <span style="margin-left:6px;">Listed Contractors</span>
        </div>
        <div style="font-size:14px;color:var(--s300);">
          <span style="color:var(--o400);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:22px;">31</span>
          <span style="margin-left:6px;">Trade Categories</span>
        </div>
        <div style="font-size:14px;color:var(--s300);">
          <span style="color:var(--o400);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:22px;">Canada-Wide</span>
          <span style="margin-left:6px;">Coverage</span>
        </div>
      </div>
    </div>
  </section>"""

NEW_HERO_HTML = """  <!-- Hero -->
  <section class="hero">
    <div class="hero-scanline"></div>
    <div class="hero-bracket-tl"></div>
    <div class="hero-bracket-tr"></div>
    <div class="container" style="position:relative;z-index:2;">
      <div class="hero-eyebrow">Canada's Commercial Trades Registry</div>
      <h1>Find <span class="accent-cyan">Certified</span><br>Trade Professionals<br><span class="accent-orange">Across Canada</span></h1>
      <p>Connect with licensed electricians, plumbers, HVAC specialists, welders, roofers, and more. Verified trade contractors from coast to coast — ready to quote your next project.</p>
      <div class="search-bar">
        <input type="text" id="heroSearch" placeholder="Search trades, companies, services..." />
        <select id="heroCity">
          <option value="">All Canadian Cities</option>
          <option>Toronto</option><option>Ottawa</option><option>Hamilton</option><option>Mississauga</option>
          <option>London</option><option>Windsor</option><option>Brampton</option><option>Kitchener</option>
          <option>Barrie</option><option>Sudbury</option><option>Thunder Bay</option><option>Oakville</option>
          <option>Burlington</option><option>St. Catharines</option><option>Sarnia</option><option>Chatham</option>
          <option>Guelph</option><option>Cambridge</option><option>Waterloo</option><option>Kingston</option>
          <option>Peterborough</option><option>Oshawa</option><option>Ajax</option><option>Markham</option>
          <option>Vaughan</option><option>Richmond Hill</option><option>Sault Ste. Marie</option>
          <option>North Bay</option><option>Brantford</option><option>Niagara Falls</option>
          <option>Belleville</option><option>Orillia</option>
        </select>
        <button onclick="doHeroSearch()">Search</button>
      </div>
      <div class="hero-stats-row">
        <div class="hero-stat-item">
          <span class="hero-stat-val">80<span style="font-size:0.6em">+</span></span>
          <span class="hero-stat-lbl">Listed Contractors</span>
        </div>
        <div class="hero-stat-item">
          <span class="hero-stat-val">31</span>
          <span class="hero-stat-lbl">Trade Categories</span>
        </div>
        <div class="hero-stat-item">
          <span class="hero-stat-val orange">Canada</span>
          <span class="hero-stat-lbl">Nationwide Coverage</span>
        </div>
        <div class="hero-stat-item">
          <span class="hero-stat-val">Free</span>
          <span class="hero-stat-lbl">To Post a Job</span>
        </div>
      </div>
    </div>
  </section>"""

replace_once(OLD_HERO_HTML, NEW_HERO_HTML, 'hero HTML')

# ─────────────────────────────────────────
# 17. NAV — add nav-cta class to the register/login buttons
#     and update logo sub-text
# ─────────────────────────────────────────
replace_once(
    "<a class=\"nav-logo\" onclick=\"navigate('/')\">",
    "<a class=\"nav-logo\" onclick=\"navigate('/')\" style=\"text-decoration:none;\">",
    'nav logo link'
)

# ─────────────────────────────────────────
# 18. ADD SCROLL ANIMATIONS + NAV SCROLL JS
#     before closing </body>
# ─────────────────────────────────────────
SCROLL_JS = """
<script>
/* ── Nav scroll effect ── */
(function() {
  var nav = document.getElementById('navbar');
  if (!nav) return;
  window.addEventListener('scroll', function() {
    if (window.scrollY > 30) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }, { passive: true });
})();

/* ── Scroll-reveal with IntersectionObserver ── */
(function() {
  var io = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.10 });

  function markReveal() {
    /* Mark category cards */
    document.querySelectorAll('.category-card').forEach(function(el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = (i * 0.04) + 's';
      io.observe(el);
    });
    /* Provider cards */
    document.querySelectorAll('.provider-card').forEach(function(el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = (i * 0.06) + 's';
      io.observe(el);
    });
    /* Section headers */
    document.querySelectorAll('.section-header, .page-section > .container > h2').forEach(function(el) {
      el.classList.add('reveal');
      io.observe(el);
    });
    /* Feature cards */
    document.querySelectorAll('.feature-card').forEach(function(el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = (i * 0.08) + 's';
      io.observe(el);
    });
  }

  /* Run after initial render and re-run on SPA navigation */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markReveal);
  } else {
    markReveal();
  }

  /* Re-apply after SPA route changes */
  var _origNavigate = window.navigate;
  if (typeof _origNavigate === 'function') {
    window.navigate = function() {
      _origNavigate.apply(this, arguments);
      setTimeout(markReveal, 120);
    };
  }
})();
</script>
"""

replace_once('</body>', SCROLL_JS + '\n</body>', 'scroll animation JS')

# ─────────────────────────────────────────
# 19. UPDATE CTA SECTION COLOURS
# ─────────────────────────────────────────
replace_once(
    'background:linear-gradient(135deg,var(--o600) 0%,',
    'background:linear-gradient(135deg,#0a1422 0%,',
    'CTA section bg to dark'
)

# ─────────────────────────────────────────
# WRITE FILE
# ─────────────────────────────────────────
open('C:/Personal/trades-ontario/index.html', 'w', encoding='utf-8', newline='').write(content)
print(f'\nDone! {original_len:,} → {len(content):,} chars (+{len(content)-original_len:,})')
