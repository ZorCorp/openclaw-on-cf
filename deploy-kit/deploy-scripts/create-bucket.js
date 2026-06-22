// Step 7 — Create the R2 bucket `moltbot-${NAME}-data`.
// Reads NAME + CLOUDFLARE_API_TOKEN from .env. Pipes "n\n" to wrangler so it
// auto-declines the "add binding on your behalf?" prompt (the binding is already
// in wrangler.jsonc). Idempotent: "bucket already exists" is a non-error.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const isWin = process.platform === 'win32';
const KIT = path.resolve(__dirname, '..');
const moltworker = path.join(KIT, 'moltworker');
const wrangler = path.join(moltworker, 'node_modules', '.bin', isWin ? 'wrangler.cmd' : 'wrangler');

for (const line of fs.readFileSync(path.join(KIT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const NAME = process.env.NAME;
if (!NAME) { console.error('❌ NAME missing in .env'); process.exit(1); }
const bucket = `moltbot-${NAME}-data`;

const p = spawn(wrangler, ['r2', 'bucket', 'create', bucket], {
  cwd: moltworker, stdio: ['pipe', 'pipe', 'pipe'], shell: isWin,
});
p.stdin.end('n\n');
let out = '';
p.stdout.on('data', c => { out += c; process.stdout.write(c); });
p.stderr.on('data', c => { out += c; process.stderr.write(c); });
p.on('exit', code => {
  if (code === 0 || /already exists/i.test(out)) {
    console.log(`\n✅ R2 bucket ${bucket} ready.`);
    process.exit(0);
  }
  console.error(`\n❌ wrangler r2 bucket create failed (exit ${code}).`);
  process.exit(1);
});
