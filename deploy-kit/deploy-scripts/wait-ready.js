// Step 15 — Wait for the deployed container to be ready.
// Self-loads .env (NAME + SUBDOMAIN). Step 1: explicit wake call to the worker
// root URL so the Durable Object spins up a container instance (polling alone
// won't reliably trigger cold-boot — see Hermes wait-ready.js for the same
// pattern). Step 2: poll /debug/gateway-api?path=/health up to 5 min until the
// inner gateway responds with JSON.
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const KIT = path.resolve(__dirname, '..');
for (const line of fs.readFileSync(path.join(KIT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const { NAME, SUBDOMAIN } = process.env;
if (!NAME || !SUBDOMAIN) { console.error('❌ NAME / SUBDOMAIN missing in .env'); process.exit(1); }

const base = `https://moltbot-${NAME}.${SUBDOMAIN}.workers.dev`;

function get(url, timeoutMs) {
  return new Promise(resolve => {
    const req = https.get(url, { timeout: timeoutMs }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.on('error', () => resolve(''));
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('⏳ Waking the container (cold boot ~1-3 min: pull image, rclone restore, start gateway)...');
  await get(`${base}/`, 60_000);   // explicit wake — triggers Durable Object to spin up container instance
  console.log('   polling /health for up to 5 min...');
  for (let i = 1; i <= 20; i++) {
    const r = await get(`${base}/debug/gateway-api?path=/health`, 10_000);
    if (r && !/not listening/i.test(r) && /\{/.test(r)) {
      console.log(`\n✅ READY after ${i} probe(s).`);
      process.exit(0);
    }
    process.stdout.write('.');
    await sleep(15_000);
  }
  console.error(`\n⚠️ Container not ready after 5 min. Pull logs:`);
  console.error(`   curl -s "${base}/debug/processes?logs=true"`);
  console.error('Common causes: wrong CF_AI_GATEWAY_MODEL (Step 13) or Authenticated Gateway toggle off (Step 9).');
  process.exit(1);
})();
