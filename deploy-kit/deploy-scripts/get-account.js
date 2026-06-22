// Step 3 — Verify CF token + derive ACCOUNT_ID by running `wrangler whoami`.
// Reads CLOUDFLARE_API_TOKEN from .env. Appends ACCOUNT_ID + CLOUDFLARE_ACCOUNT_ID
// to .env (the second name pins wrangler to this account so subsequent commands
// don't pick up a stale cached account). Prints account name + id.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const isWin = process.platform === 'win32';
const KIT = path.resolve(__dirname, '..');
const moltworker = path.join(KIT, 'moltworker');
const envPath = path.join(KIT, '.env');
const wrangler = path.join(moltworker, 'node_modules', '.bin', isWin ? 'wrangler.cmd' : 'wrangler');

// Load .env so wrangler sees CLOUDFLARE_API_TOKEN.
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const r = spawnSync(wrangler, ['whoami'], {
  cwd: moltworker, encoding: 'utf8', shell: isWin,
});
const out = (r.stdout || '') + (r.stderr || '');
process.stdout.write(out);

if (r.status !== 0 || /authentication error|not authorized/i.test(out)) {
  console.error('\n❌ wrangler whoami failed. Token bad or missing perms — redo Step 2 (overwrite the .env line).');
  process.exit(1);
}

const m = out.match(/[0-9a-f]{32}/);
if (!m) {
  console.error('\n❌ Could not extract ACCOUNT_ID from wrangler output. Paste the above into the troubleshooting table.');
  process.exit(1);
}
const id = m[0];

fs.appendFileSync(envPath, `ACCOUNT_ID=${id}\nCLOUDFLARE_ACCOUNT_ID=${id}\n`);
console.log(`\n✅ ACCOUNT_ID=${id} (written to .env, both names)`);
