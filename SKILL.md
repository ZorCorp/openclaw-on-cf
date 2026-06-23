---
name: deploy-openclaw
description: "Deploy your own OpenClaw bot — an AI agent with both a Telegram channel and a web dashboard — to your own Cloudflare account. Self-service: clone this kit, collect your Cloudflare + Telegram tokens into a local .env, run the pre-built deploy scripts, and ship a Worker + Container + R2 + AI Gateway. Use when a developer (or an agent acting for them) wants to stand up an OpenClaw bot on Cloudflare from scratch."
---

# Deploy OpenClaw on Cloudflare (self-service)

This skill walks **you** (a developer, or an AI agent acting on your behalf in
Claude Code / Cursor / a terminal) through deploying an **OpenClaw** bot to
**your own** Cloudflare account. Everything runs on your own machine against
your own accounts — there is no shared host and no multi-tenant isolation to
worry about.

**What you build:** a Cloudflare **Worker** fronting a long-lived **Container**
(the agent runtime), backed by an **R2 bucket** (state) and a shared **AI
Gateway**. Reachable on **two channels** — a Telegram bot you create, and a web
**dashboard**. ~17 steps, ~25 minutes.

OpenClaw differs from Hermes: it runs Telegram in **webhook** mode, ships a
**web dashboard** (with its own Gateway Token login), and writes **14** worker
secrets.

## Prerequisites

- **node** ≥ 22 and **git** (Windows: run everything in **Git Bash**).
- **Docker Desktop** installed and **running** (the deploy builds an image
  locally). Confirm the whale icon is solid.
- A **Cloudflare account on the Workers Paid plan** ($5/mo — Containers
  require it).
- **Telegram** installed (you'll make a bot with BotFather).

You do **not** need a global `wrangler` install — the kit pins its own.

## How commands work

Every command runs from the kit root (`openclaw-on-cf/deploy-kit`). The
pre-built scripts in `deploy-scripts/` each load `.env` themselves and use the
kit-local wrangler, so you just invoke them with `node deploy-scripts/<name>.js`.
You collect tokens into `.env` as you go; later steps read them from there. Treat
`.env` as secret (it's chmod 600 and gitignored) — don't paste its values back
into chat.

---

## Step 0: Get the kit and pick a name

```bash
git clone --branch v1.0 https://github.com/ZorCorp/openclaw-on-cf.git
cd openclaw-on-cf/deploy-kit
(cd moltworker && npm install --no-audit --no-fund)   # one-time, ~30s–2min
cp env.template .env && chmod 600 .env
printf 'NAME=alice\n' >> .env                          # ← change "alice"; lowercase, letters/digits/hyphens
set -a; source .env; set +a
echo "NAME=$NAME"
```

`NAME` becomes your worker (`moltbot-<NAME>`) and R2 bucket
(`moltbot-<NAME>-data`). It **must be lowercase**.

## Step 1: Verify tools

```bash
node deploy-scripts/verify-tools.js
```

Checks node, docker, the docker daemon, and the kit-local wrangler. If it exits
non-zero, fix the missing tool (most often: start Docker Desktop) and re-run.

## Step 2: Create a Cloudflare API Token

In the Cloudflare dashboard:

1. Open https://dash.cloudflare.com/profile/api-tokens
2. **Create Token** → use the **"Edit Cloudflare Workers"** template.
3. Add these permissions:
   - Account → **AI Gateway** → Edit
   - Account → **Workers R2 Storage** → Edit
   - Account → **Billing** → Read
4. Account Resources → Include → your account.
5. Zone Resources → All zones → Continue to summary → **Create Token** → copy it.

```bash
printf 'CLOUDFLARE_API_TOKEN=%s\n' 'PASTE_TOKEN_HERE' >> .env
```

## Step 3: Verify token + derive your account id

```bash
node deploy-scripts/get-account.js
```

Writes both `ACCOUNT_ID` and `CLOUDFLARE_ACCOUNT_ID` to `.env`. If it fails, the
token is wrong or missing permissions — redo Step 2 (append a fresh
`CLOUDFLARE_API_TOKEN=` line; `source .env` uses the last one).

## Step 4: Confirm Workers Paid plan

```bash
node deploy-scripts/check-plan.js
```

`OK` → good. `NO_WORKERS_PLAN` → upgrade to Workers Paid ($5/mo).

## Step 5: Fetch your workers.dev subdomain

```bash
node deploy-scripts/get-subdomain.js
```

If empty, register one at
`https://dash.cloudflare.com/<ACCOUNT_ID>/workers/onboarding`, then re-run. Save:

```bash
printf 'SUBDOMAIN=%s\n' 'YOUR_SUBDOMAIN' >> .env
```

Your bot will live at `https://moltbot-<NAME>.<SUBDOMAIN>.workers.dev`.

## Step 6: Name the worker + bucket

```bash
node deploy-scripts/rename-worker.js
```

Rewrites `moltworker/wrangler.jsonc` to `moltbot-<NAME>` / `moltbot-<NAME>-data`.

## Step 7: Create the R2 bucket

```bash
node deploy-scripts/create-bucket.js
```

Creates `moltbot-<NAME>-data` (auto-declines the "add binding?" prompt — the
binding is already in `wrangler.jsonc`). "Already exists" is fine.

## Step 8: Create / reuse the shared AI Gateway

```bash
node deploy-scripts/create-gateway.js
```

Creates the fixed `agent-shared-gateway` in your account (reused if it exists).

## Step 9: Create an AI Gateway auth token

In the dashboard:

1. Open `https://dash.cloudflare.com/<ACCOUNT_ID>/ai/ai-gateway/gateways/agent-shared-gateway`
2. **Settings** → **Authenticated Gateway** → **Create authentication token**.
3. Name it `moltbot-<NAME>`, keep defaults, Create, copy.
4. ⚠️ **Enable the "Authenticated Gateway" toggle.**

```bash
printf 'AIG_TOKEN=%s\n' 'PASTE_AIG_TOKEN' >> .env
```

## Step 10: Create an R2 API token

In the dashboard:

1. Open `https://dash.cloudflare.com/<ACCOUNT_ID>/r2/api-tokens`
2. **Create Account API Token**, name `moltbot-<NAME>-r2`.
3. Permission: **Object Read & Write**.
4. Specify bucket → **Apply to specific buckets only** → `moltbot-<NAME>-data`.
5. TTL: Forever → Create. Copy **both** keys.

```bash
printf 'R2_ACCESS_KEY=%s\nR2_SECRET_KEY=%s\n' 'ACCESS_KEY_ID' 'SECRET_ACCESS_KEY' >> .env
```

## Step 11: Create your Telegram bot

1. In Telegram, open **@BotFather**, send `/newbot`, pick a display name and a
   username ending in `bot`.
2. Copy the token (like `8622764702:AAGk-…`).

```bash
printf 'TELEGRAM_TOKEN=%s\n' 'PASTE_BOT_TOKEN' >> .env
node deploy-scripts/get-bot-username.js
printf 'BOT_USERNAME=%s\n' 'THE_USERNAME_IT_PRINTED' >> .env
```

If `get-bot-username.js` prints empty, the token is wrong — redo this step.

## Step 12: Generate the Gateway Token (dashboard login)

```bash
node deploy-scripts/gen-gateway-token.js
```

Generates a 256-bit `GATEWAY_TOKEN`, writes it to `.env`, and prints it. **Save
the printed value** — it's your web dashboard login (used in Step 17).

## Step 12.5: Completeness check (before deploy)

```bash
set -a; source .env; set +a
for k in NAME CLOUDFLARE_API_TOKEN ACCOUNT_ID SUBDOMAIN AIG_TOKEN R2_ACCESS_KEY R2_SECRET_KEY TELEGRAM_TOKEN GATEWAY_TOKEN; do
  eval "v=\${$k}"; [ -z "$v" ] && echo "MISSING: $k"
done; echo "check done"
```

Fill any `MISSING` key from its step, then continue.

## Step 13: Write the 14 worker secrets

```bash
node deploy-scripts/secrets.js
```

Loads `.env` and writes all 14 secrets into your worker via wrangler. If one
fails with a "use versions secret put" hint, retry just that one:
`(cd moltworker && ./node_modules/.bin/wrangler versions secret put <NAME>)`.

## Step 14: Deploy

```bash
set -a; source .env; set +a
(cd moltworker && npm run deploy 2>&1 | tail -40)
```

Builds the image with your local Docker, pushes to Cloudflare, provisions the
container. ~2–10 minutes (faster with cached layers). Watch at
`https://dash.cloudflare.com/<ACCOUNT_ID>/workers/services/view/moltbot-<NAME>/production`.

## Step 15: Wait for the container to boot

```bash
node deploy-scripts/wait-ready.js
```

Polls `/health` until ready (~5 min max).

## Step 16: Wire the Telegram webhook + pair

OpenClaw runs Telegram in **webhook** mode (the container can't long-poll). Wire
the webhook first:

```bash
node deploy-scripts/set-webhook.js
```

Expect `{"ok":true,...}`. Then pair:

1. In Telegram, open **@<BOT_USERNAME>** and tap **Start** (or send `hi`).
2. The bot replies with a pairing code like `H2YPBRTM`.
3. Approve it:

```bash
node deploy-scripts/pair-telegram.js THE_PAIRING_CODE
```

If it reports a bad code, send `hi` again for a fresh one.

## Step 17: Pair the web dashboard

Open the dashboard with your Gateway Token in the URL so it auto-authenticates
(`GATEWAY_TOKEN` is from Step 12, already in `.env`):

```bash
set -a; source .env; set +a
echo "https://moltbot-${NAME}.${SUBDOMAIN}.workers.dev/?token=${GATEWAY_TOKEN}"
```

Open that URL — it should land on **"device pairing required"** (expected). If
instead you see "Invalid or missing token", paste your `GATEWAY_TOKEN` into the
**Gateway Token** field and click **Connect**. Then approve the pairing:

```bash
node deploy-scripts/approve-devices.js
```

A dashboard Connect raises **two** pendings (the device + an internal scope
upgrade), so the script loops list → approve → re-check until none remain. It
prints a JSON summary like `{"approved":2,"pendingLeft":0,"dashboardPaired":true}`:

- `dashboardPaired: true` and `pendingLeft: 0` → done.
- `dashboardPaired: false`, `approved: 0` → you haven't clicked **Connect** yet.
- `pendingLeft > 0` → run it once more. (The bot works regardless of dashboard
  pairing — you can skip it.)

Each approve prints `Direct scope access failed; using local fallback` — that is
**expected and fine**; trust the JSON summary.

## Done

Your OpenClaw bot is live on two channels:

- **Telegram:** `@<BOT_USERNAME>`
- **Dashboard:** `https://moltbot-<NAME>.<SUBDOMAIN>.workers.dev/` (log in with
  your Gateway Token)

---

## Optional: Google Workspace (gws) access

The image bundles a `gws-workspace` skill (Gmail/Drive/Calendar via a headless
OAuth flow). The public image does **not** include any OAuth client — to use it,
supply your **own** Google Desktop OAuth `client_secret.json` at runtime, then
ask the bot to log in to gws. See `deploy-kit/moltworker/skills/gws-workspace/`
for how the skill authenticates. You can skip this entirely.

## Hard don'ts

- **Don't deploy with the bare `moltbot-sandbox` name** — run Step 6 (rename)
  before Steps 7/13/14.
- **NAME is always lowercase** (folder, worker, bucket).
- Use the **dashboard Connect + `approve-devices.js`** path for dashboard
  pairing — not any `/_admin/` page.
- Keep `.env` out of git (it's gitignored) and don't echo its secret values.

## Troubleshooting

| Symptom | Action |
|---|---|
| `wrangler whoami` fails after Step 2 | Token bad / missing perms → redo Step 2, append a fresh `CLOUDFLARE_API_TOKEN=` line |
| `ACCOUNT_ID` empty after Step 3 | Print raw `wrangler whoami`; confirm account-level access |
| `SUBDOMAIN` empty | Register a workers.dev subdomain (Step 5) |
| wrangler "stale account" error | Confirm `CLOUDFLARE_ACCOUNT_ID` is in `.env` and sourced (Step 3) |
| `wrangler secret put` wants "versions secret put" | Use `versions secret put` for that one secret |
| Health check "not listening" | Keep polling, allow up to ~5 min |
| Telegram bot silent to "hi" | Re-run Step 16 `set-webhook.js`; check `getWebhookInfo` |
| Pairing "Bad pairing code" | Send `hi` again for a fresh code |
| Dashboard "Invalid token" vs "Pairing required" | Wrong Gateway Token pasted — recheck Step 17 (value from Step 12) |
