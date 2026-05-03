#!/usr/bin/env python3
"""
Replace the flat category grid with:
  1. A custom dropdown list (click to open, all 31 trades listed with icon + count)
  2. A "Browse all X categories" expand toggle that reveals the full icon grid
"""

SRC = 'C:/Personal/trades-ontario/index.html'

with open(SRC, 'r', encoding='utf-8', newline='') as f:
    content = f.read()

# ─────────────────────────────────────────────────────────────
# 1. CSS — inject before </style>
# ─────────────────────────────────────────────────────────────
CSS = r"""
/* ============================================================
   CATEGORY DROPDOWN + EXPAND
============================================================ */
.cat-ui-wrap { position: relative; }

/* ── Dropdown trigger ── */
.cat-dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  max-width: 520px;
  padding: 14px 18px;
  background: rgba(13,24,40,0.8);
  border: 1px solid var(--cyan-border, rgba(0,200,255,0.18));
  color: var(--s200, #C4DAEA);
  font-family: 'Barlow', sans-serif;
  font-size: 15px;
  cursor: pointer;
  border-radius: 4px;
  transition: border-color 0.2s, box-shadow 0.2s;
  backdrop-filter: blur(8px);
}
.cat-dropdown-trigger:hover,
.cat-dropdown-trigger.open {
  border-color: var(--cyan, #00c8ff);
  box-shadow: 0 0 0 3px rgba(0,200,255,0.10);
}
.cat-dropdown-trigger .trigger-left {
  display: flex; align-items: center; gap: 10px;
}
.cat-dropdown-trigger .trigger-icon {
  font-size: 18px; line-height: 1;
}
.cat-dropdown-trigger .trigger-label {
  font-family: 'Barlow', sans-serif;
  font-size: 15px;
  color: var(--s300, #9CBDD6);
}
.cat-dropdown-trigger .trigger-chevron {
  width: 18px; height: 18px;
  fill: none; stroke: var(--cyan, #00c8ff); stroke-width: 2;
  transition: transform 0.25s ease;
  flex-shrink: 0;
}
.cat-dropdown-trigger.open .trigger-chevron {
  transform: rotate(180deg);
}

/* ── Dropdown panel ── */
.cat-dropdown-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 100%;
  max-width: 520px;
  background: rgba(10,20,36,0.97);
  border: 1px solid var(--cyan-border, rgba(0,200,255,0.18));
  border-radius: 4px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,200,255,0.08);
  backdrop-filter: blur(16px);
  z-index: 200;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.25s ease;
  opacity: 0;
}
.cat-dropdown-panel.open {
  max-height: 460px;
  opacity: 1;
  overflow-y: auto;
}
.cat-dropdown-panel::-webkit-scrollbar { width: 4px; }
.cat-dropdown-panel::-webkit-scrollbar-track { background: transparent; }
.cat-dropdown-panel::-webkit-scrollbar-thumb { background: rgba(0,200,255,0.25); border-radius: 2px; }

.cat-dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 18px;
  cursor: pointer;
  transition: background 0.15s, padding-left 0.15s;
  border-bottom: 1px solid rgba(0,200,255,0.05);
}
.cat-dropdown-item:last-child { border-bottom: none; }
.cat-dropdown-item:hover {
  background: rgba(0,200,255,0.07);
  padding-left: 24px;
}
.cat-dropdown-item:hover .cdi-name {
  color: var(--cyan, #00c8ff);
}
.cat-dropdown-item .cdi-icon {
  font-size: 20px;
  width: 28px; text-align: center; flex-shrink: 0;
}
.cat-dropdown-item .cdi-name {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.04em;
  color: var(--text, #EDF5FC);
  flex: 1;
  transition: color 0.15s;
}
.cat-dropdown-item .cdi-count {
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  color: var(--s400, #406D96);
  flex-shrink: 0;
}

/* ── Expand / collapse toggle ── */
.cat-expand-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
}
.cat-expand-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  background: transparent;
  border: 1px solid rgba(0,200,255,0.2);
  color: var(--cyan, #00c8ff);
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 2px;
  transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.cat-expand-btn:hover {
  background: rgba(0,200,255,0.07);
  border-color: var(--cyan, #00c8ff);
  box-shadow: 0 0 16px rgba(0,200,255,0.15);
}
.cat-expand-btn svg {
  width: 14px; height: 14px;
  fill: none; stroke: currentColor; stroke-width: 2;
  transition: transform 0.25s;
}
.cat-expand-btn.expanded svg { transform: rotate(180deg); }

/* ── Full icon grid (collapsed by default) ── */
.cat-grid-full {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.45s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.3s ease,
              margin-top 0.3s ease;
  opacity: 0;
  margin-top: 0;
}
.cat-grid-full.expanded {
  max-height: 1200px;
  opacity: 1;
  margin-top: 20px;
}
"""

STYLE_END = '</style>'
idx = content.find(STYLE_END)
content = content[:idx] + CSS + content[idx:]
print(f'✓ CSS injected')

# ─────────────────────────────────────────────────────────────
# 2. Wrap categoryGrid div with new UI wrapper
# ─────────────────────────────────────────────────────────────
OLD_SECTION = '      <div class="category-grid" id="categoryGrid"></div>'
NEW_SECTION = '''      <div class="cat-ui-wrap">
        <!-- Dropdown trigger -->
        <button class="cat-dropdown-trigger" id="catDropdownTrigger" onclick="toggleCatDropdown()" aria-expanded="false">
          <span class="trigger-left">
            <span class="trigger-icon" id="catTriggerIcon">🏗️</span>
            <span class="trigger-label" id="catTriggerLabel">Select a trade category...</span>
          </span>
          <svg class="trigger-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <!-- Dropdown panel -->
        <div class="cat-dropdown-panel" id="catDropdownPanel"></div>
      </div>
      <!-- Expand row -->
      <div class="cat-expand-row">
        <button class="cat-expand-btn" id="catExpandBtn" onclick="toggleCatGrid()">
          <svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>
          Browse all 31 categories
        </button>
      </div>
      <!-- Full icon grid (expandable) -->
      <div class="cat-grid-full" id="catGridFull">
        <div class="category-grid" id="categoryGrid"></div>
      </div>'''

if OLD_SECTION in content:
    content = content.replace(OLD_SECTION, NEW_SECTION)
    print('✓ Category section HTML updated')
else:
    print('✗ Category section not found')

# ─────────────────────────────────────────────────────────────
# 3. Update renderHome() to also build the dropdown
# ─────────────────────────────────────────────────────────────
OLD_RENDER = '''function renderHome() {
  const cg = document.getElementById('categoryGrid');
  if (cg) cg.innerHTML = TRADE_CATEGORIES.map(c => `
    <div class="category-card" onclick="navigateToCategory('${c.name}')">
      <div class="cat-icon">${c.icon}</div>
      <div class="cat-name">${c.name}</div>
      <div style="font-size:12px;color:var(--s400);margin-top:4px;">${c.count} listings</div>
    </div>
  `).join('');

  const fg = document.getElementById('featuredGrid');
  if (fg) fg.innerHTML = App.providers.filter(p => p.featured && p.status !== 'pending_approval').slice(0,3).map(p => providerCardHTML(p)).join('');
}'''

NEW_RENDER = '''function renderHome() {
  // Full icon grid
  const cg = document.getElementById('categoryGrid');
  if (cg) cg.innerHTML = TRADE_CATEGORIES.map(c => `
    <div class="category-card" onclick="navigateToCategory('${c.name}');closeCatDropdown();">
      <div class="cat-icon">${c.icon}</div>
      <div class="cat-name">${c.name}</div>
      <div style="font-size:12px;color:var(--s400);margin-top:4px;">${c.count} listings</div>
    </div>
  `).join('');

  // Dropdown list
  const dp = document.getElementById('catDropdownPanel');
  if (dp) dp.innerHTML = TRADE_CATEGORIES.map(c => `
    <div class="cat-dropdown-item" onclick="navigateToCategory('${c.name}');closeCatDropdown();setDropdownLabel('${c.icon}','${c.name}');">
      <span class="cdi-icon">${c.icon}</span>
      <span class="cdi-name">${c.name}</span>
      <span class="cdi-count">${c.count} listings</span>
    </div>
  `).join('');

  const fg = document.getElementById('featuredGrid');
  if (fg) fg.innerHTML = App.providers.filter(p => p.featured && p.status !== 'pending_approval').slice(0,3).map(p => providerCardHTML(p)).join('');
}

function toggleCatDropdown() {
  const trigger = document.getElementById('catDropdownTrigger');
  const panel   = document.getElementById('catDropdownPanel');
  if (!trigger || !panel) return;
  const open = panel.classList.toggle('open');
  trigger.classList.toggle('open', open);
  trigger.setAttribute('aria-expanded', open);
}

function closeCatDropdown() {
  const trigger = document.getElementById('catDropdownTrigger');
  const panel   = document.getElementById('catDropdownPanel');
  if (trigger) trigger.classList.remove('open');
  if (panel)   panel.classList.remove('open');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function setDropdownLabel(icon, name) {
  const iconEl  = document.getElementById('catTriggerIcon');
  const labelEl = document.getElementById('catTriggerLabel');
  if (iconEl)  iconEl.textContent  = icon;
  if (labelEl) labelEl.textContent = name;
}

function toggleCatGrid() {
  const grid = document.getElementById('catGridFull');
  const btn  = document.getElementById('catExpandBtn');
  if (!grid || !btn) return;
  const expanded = grid.classList.toggle('expanded');
  btn.classList.toggle('expanded', expanded);
  btn.innerHTML = expanded
    ? `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2"><polyline points="18 15 12 9 6 15"/></svg> Hide categories`
    : `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg> Browse all 31 categories`;
}'''

if OLD_RENDER in content:
    content = content.replace(OLD_RENDER, NEW_RENDER)
    print('✓ renderHome() updated with dropdown + expand logic')
else:
    print('✗ renderHome() not found — checking partial')
    idx = content.find('function renderHome()')
    print(f'  function at: {idx}')

# ─────────────────────────────────────────────────────────────
# 4. Close dropdown on outside click (add to scroll JS block)
# ─────────────────────────────────────────────────────────────
OLD_SCROLL_JS = '// ── Redesign: Scroll animations & navbar'
NEW_SCROLL_PREFIX = '''// ── Close category dropdown on outside click
document.addEventListener('click', function(e) {
  var trigger = document.getElementById('catDropdownTrigger');
  var panel   = document.getElementById('catDropdownPanel');
  if (trigger && panel && !trigger.contains(e.target) && !panel.contains(e.target)) {
    closeCatDropdown && closeCatDropdown();
  }
});

// ── Redesign: Scroll animations & navbar'''

if OLD_SCROLL_JS in content:
    content = content.replace(OLD_SCROLL_JS, NEW_SCROLL_PREFIX, 1)
    print('✓ Outside-click close handler added')
else:
    print('✗ Scroll JS anchor not found')

# ─────────────────────────────────────────────────────────────
# 5. Write
# ─────────────────────────────────────────────────────────────
with open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print(f'\nDone! {len(content):,} chars written')
