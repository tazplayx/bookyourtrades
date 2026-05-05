/**
 * Run with: node scripts/export_seed.js
 * Extracts SEED_PROVIDERS from index.html and writes scripts/_seed_data.json
 */
const fs   = require('fs');
const path = require('path');

const html  = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');

// Extract the SEED_PROVIDERS array using a controlled eval
const start = html.indexOf('SEED_PROVIDERS = [');
const end   = html.indexOf('\n];', start) + 3;
const block = html.slice(start, end);

// Use Function() to evaluate the JS object literal safely
// (it's our own code, not user input)
const TRADE_TYPES = [];
let SEED_PROVIDERS = [];
try {
  const fn = new Function('TRADE_TYPES', block + '\nreturn SEED_PROVIDERS;');
  SEED_PROVIDERS = fn(TRADE_TYPES);
} catch (e) {
  console.error('Parse error:', e.message);
  process.exit(1);
}

const out = { providers: SEED_PROVIDERS };
const outPath = path.join(__dirname, '_seed_data.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');
console.log(`Exported ${SEED_PROVIDERS.length} providers to ${outPath}`);
