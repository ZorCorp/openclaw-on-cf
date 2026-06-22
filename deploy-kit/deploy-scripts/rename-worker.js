// Step 6 — Rename worker + R2 binding in moltworker/wrangler.jsonc to match NAME.
// Reads NAME from .env. Replaces moltbot-sandbox -> moltbot-${NAME} and
// moltbot-data -> moltbot-${NAME}-data. Prints the changed name/bucket_name lines.
const fs = require('node:fs');
const path = require('node:path');

const KIT = path.resolve(__dirname, '..');
const cfgPath = path.join(KIT, 'moltworker', 'wrangler.jsonc');

// Load NAME from .env
for (const line of fs.readFileSync(path.join(KIT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const NAME = process.env.NAME;
if (!NAME) { console.error('❌ NAME missing in .env (Setup step b)'); process.exit(1); }

const before = fs.readFileSync(cfgPath, 'utf8');
const after = before
  .replace(/moltbot-sandbox/g, `moltbot-${NAME}`)
  .replace(/moltbot-data/g, `moltbot-${NAME}-data`);

if (before === after) {
  console.log(`(wrangler.jsonc already names this bot — no changes needed)`);
} else {
  fs.writeFileSync(cfgPath, after);
}

// Show the renamed lines for confirmation.
for (const line of after.split(/\r?\n/)) {
  if (/"name"|bucket_name/.test(line)) console.log(line);
}
console.log(`\n✅ Worker renamed to moltbot-${NAME}, bucket to moltbot-${NAME}-data.`);
