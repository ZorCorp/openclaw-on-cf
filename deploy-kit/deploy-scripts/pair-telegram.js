// Step 16b — Approve a Telegram pairing code on the deployed worker.
// Usage:  node deploy-scripts/pair-telegram.js <CODE>
// Reads NAME + SUBDOMAIN from .env. Calls /debug/cli?cmd=openclaw+pairing+approve+telegram+<CODE>.
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const code = (process.argv[2] || '').trim();
if (!code) { console.error('❌ Usage: node deploy-scripts/pair-telegram.js <CODE>'); process.exit(1); }
if (!/^[A-Za-z0-9]{4,16}$/.test(code)) {
  console.error(`❌ Pairing code "${code}" looks malformed (expected 4-16 alphanumerics).`);
  process.exit(1);
}

const KIT = path.resolve(__dirname, '..');
for (const line of fs.readFileSync(path.join(KIT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const { NAME, SUBDOMAIN } = process.env;
if (!NAME || !SUBDOMAIN) { console.error('❌ NAME / SUBDOMAIN missing in .env'); process.exit(1); }

const url = `https://moltbot-${NAME}.${SUBDOMAIN}.workers.dev/debug/cli?cmd=${encodeURIComponent('openclaw pairing approve telegram ' + code)}`;

https.get(url, { timeout: 60_000 }, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    let r; try { r = JSON.parse(d); } catch (e) { console.error('❌ Unexpected response: ' + d.slice(0, 200)); process.exit(1); }
    const stdout = r.stdout || '';
    const stderr = r.stderr || '';
    // The /debug/cli response uses a `status` field ("completed" / "failed") with no exit_code.
    // Most reliable signal is the literal "Approved ..." line in stdout from the openclaw CLI.
    if (/approved/i.test(stdout)) {
      console.log(stdout.trim());
      console.log('\n✅ Telegram bot paired.');
      process.exit(0);
    }
    if (/bad pairing code|invalid|not found|no such|no pending/i.test(stderr)) {
      console.error('❌ Bad pairing code. Ask the bot for a fresh code (send /start again).');
      console.error(stderr.trim().slice(0, 300));
      process.exit(1);
    }
    console.error(`❌ Approval failed (status ${r.status}).\n${(stdout + stderr).trim().slice(0, 300)}`);
    process.exit(1);
  });
}).on('error', e => { console.error(`❌ ${e.message}`); process.exit(1); });
