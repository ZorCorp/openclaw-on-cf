// Step 17 — Approve ALL pending device requests until none remain.
//
// A dashboard Connect raises TWO pendings: the dashboard device itself
// (clientId "openclaw-control-ui") AND an internal cli scope-upgrade
// (clientId "cli") that the gateway needs before it can grant the dashboard's
// operator scopes. Approving only the dashboard leaves the gateway in a
// "scope upgrade pending" state -> approvals fall back to a local copy and the
// UI stays on "pairing required". So: loop list -> approve every pending ->
// re-check, until pending is empty (the scope-upgrade is often raised only
// after the first approve, so a single pass isn't enough).
//
// Self-loads .env. Prints a JSON summary on the last line:
//   {"approved":N,"pendingLeft":0,"dashboardPaired":true}
const https = require('https');
const fs = require('node:fs');
const path = require('node:path');
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const U = `https://moltbot-${process.env.NAME}.${process.env.SUBDOMAIN}.workers.dev`;

function cli(cmd) {
  return new Promise(resolve => {
    https.get(`${U}/debug/cli?cmd=${encodeURIComponent(cmd)}`, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({}); } });
    }).on('error', () => resolve({}));
  });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function listDevices() {
  const r = await cli('openclaw devices list --json');
  try { return JSON.parse(r.stdout || '{}'); } catch (e) { return {}; }
}

(async () => {
  let approved = 0;
  for (let round = 0; round < 8; round++) {
    const out = await listDevices();
    const pend = Array.isArray(out.pending) ? out.pending : [];
    if (pend.length === 0) break;
    for (const p of pend) {
      if (p.requestId) { await cli(`openclaw devices approve ${p.requestId}`); approved++; }
    }
    await sleep(1500); // give the gateway time to raise the follow-up scope-upgrade
  }
  const out = await listDevices();
  const pendingLeft = (out.pending || []).length;
  const dashboardPaired = (out.paired || []).some(x => x.clientId === 'openclaw-control-ui');
  console.log(JSON.stringify({ approved, pendingLeft, dashboardPaired }));
})();
