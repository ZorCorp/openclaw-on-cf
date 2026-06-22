// Step 12 — Generate a 256-bit Gateway Token (64-char hex) and write to .env.
// This is the dashboard login + Telegram setWebhook secret_token (Step 16).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const KIT = path.resolve(__dirname, '..');
const envPath = path.join(KIT, '.env');
const gt = crypto.randomBytes(32).toString('hex');

fs.appendFileSync(envPath, `GATEWAY_TOKEN=${gt}\n`);
console.log(`GATEWAY_TOKEN=${gt}`);
console.log(`\n✅ Generated. It's now in .env — Step 17 will read it from there.`);
