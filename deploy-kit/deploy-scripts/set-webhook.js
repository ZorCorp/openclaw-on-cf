// Step 16a — Register the Telegram webhook so Telegram pushes updates to the worker.
// Reads NAME + SUBDOMAIN + TELEGRAM_TOKEN + GATEWAY_TOKEN from .env. Calls
// Telegram setWebhook with secret_token = GATEWAY_TOKEN so the worker can verify
// inbound requests really came from Telegram.
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const KIT = path.resolve(__dirname, '..');
for (const line of fs.readFileSync(path.join(KIT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const { NAME, SUBDOMAIN, TELEGRAM_TOKEN, GATEWAY_TOKEN } = process.env;
for (const [k, v] of Object.entries({ NAME, SUBDOMAIN, TELEGRAM_TOKEN, GATEWAY_TOKEN })) {
  if (!v) { console.error(`❌ ${k} missing in .env`); process.exit(1); }
}

const webhook = `https://moltbot-${NAME}.${SUBDOMAIN}.workers.dev/telegram-webhook`;
const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${encodeURIComponent(webhook)}&secret_token=${encodeURIComponent(GATEWAY_TOKEN)}`;

https.get(url, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    process.stdout.write(d + '\n');
    try {
      const r = JSON.parse(d);
      if (r.ok) { console.log(`\n✅ Webhook registered → ${webhook}`); process.exit(0); }
      console.error(`\n❌ setWebhook failed: ${r.description}`); process.exit(1);
    } catch (e) { console.error(`\n❌ Unexpected response.`); process.exit(1); }
  });
}).on('error', e => { console.error(`\n❌ ${e.message}`); process.exit(1); });
