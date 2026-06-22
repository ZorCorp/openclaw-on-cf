// Step 1 — Verify host tools (node, docker, docker daemon) + kit-local wrangler.
// No inputs. Prints versions + final OK line. Exits 1 if anything missing.
const { execFileSync, spawnSync } = require('node:child_process');
const path = require('node:path');

const isWin = process.platform === 'win32';
const KIT = path.resolve(__dirname, '..');
const moltworker = path.join(KIT, 'moltworker');
const wrangler = path.join(moltworker, 'node_modules', '.bin', isWin ? 'wrangler.cmd' : 'wrangler');

function check(label, fn) {
  try { console.log(`${label}: ${fn().trim()}`); }
  catch (e) { console.error(`❌ ${label}: ${e.message.split('\n')[0]}`); process.exit(1); }
}

check('node', () => execFileSync('node', ['--version'], { encoding: 'utf8' }));
check('docker', () => execFileSync('docker', ['--version'], { encoding: 'utf8' }));

// Docker daemon — execFileSync with stderr captured so we can show the real error
const dockerInfo = spawnSync('docker', ['info'], { encoding: 'utf8' });
if (dockerInfo.status !== 0) {
  console.error('❌ docker daemon: not reachable. Open Docker Desktop and wait for the whale icon to go solid.');
  process.exit(1);
}
console.log('docker daemon: OK');

check('kit wrangler', () => execFileSync(wrangler, ['--version'], { encoding: 'utf8', shell: isWin }));
console.log('\n✅ All tools verified.');
