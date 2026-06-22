// Step 13 — Write all 14 wrangler secrets into the bot's Worker.
// Cross-platform (Mac / Linux / Windows). Locates its own bot workspace
// ($script_dir/..), loads that bot's .env, and uses the bot's local wrangler.
// Values come from .env — never hard-coded here.
//
// Usage (from kit root, any OS):
//   node deploy-scripts/secrets.js
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DIR = __dirname;
const BOT = path.resolve(DIR, '..');
const moltworker = path.join(BOT, 'moltworker');
const isWin = process.platform === 'win32';
const wrangler = path.join(moltworker, 'node_modules', '.bin', isWin ? 'wrangler.cmd' : 'wrangler');

// Load uncommented KEY=value lines from .env into process.env.
for (const line of fs.readFileSync(path.join(BOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const { NAME, SUBDOMAIN, ACCOUNT_ID, AIG_TOKEN, GATEWAY_TOKEN,
        TELEGRAM_TOKEN, R2_ACCESS_KEY, R2_SECRET_KEY } = process.env;

const SECRETS = [
  ['ANTHROPIC_API_KEY',             'sk-ant-dummy-bypass-key-not-real'],
  ['CLOUDFLARE_AI_GATEWAY_API_KEY', AIG_TOKEN],
  ['CF_AI_GATEWAY_ACCOUNT_ID',      ACCOUNT_ID],
  ['CF_AI_GATEWAY_GATEWAY_ID',      'agent-shared-gateway'],
  ['CF_AI_GATEWAY_MODEL',           'workers-ai/@cf/google/gemma-4-26b-a4b-it'],
  ['MOLTBOT_GATEWAY_TOKEN',         GATEWAY_TOKEN],
  ['TELEGRAM_BOT_TOKEN',            TELEGRAM_TOKEN],
  ['WORKER_URL',                    `https://moltbot-${NAME}.${SUBDOMAIN}.workers.dev`],
  ['DEV_MODE',                      'true'],
  ['DEBUG_ROUTES',                  'true'],
  ['CF_ACCOUNT_ID',                 ACCOUNT_ID],
  ['R2_BUCKET_NAME',                `moltbot-${NAME}-data`],
  ['R2_ACCESS_KEY_ID',              R2_ACCESS_KEY],
  ['R2_SECRET_ACCESS_KEY',          R2_SECRET_KEY],
];

function putSecret(name, value) {
  return new Promise((resolve, reject) => {
    const p = spawn(wrangler, ['secret', 'put', name], {
      cwd: moltworker,
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: isWin,    // .cmd shim on Windows needs cmd.exe
    });
    p.stdin.end(value);
    p.on('exit', code => code === 0 ? resolve() : reject(new Error(`wrangler secret put ${name} failed (exit ${code})`)));
    p.on('error', reject);
  });
}

(async () => {
  for (const [name, value] of SECRETS) {
    if (value === undefined || value === '') {
      throw new Error(`Missing value for ${name} — check your .env`);
    }
    await putSecret(name, value);
  }
})().catch(err => { console.error(err.message); process.exit(1); });
