FROM docker.io/cloudflare/sandbox:0.7.0

# Install Node.js 22 (required by OpenClaw) and rclone (for R2 persistence)
# Also install Chrome dependencies for agent-browser
ENV NODE_VERSION=22.16.0
RUN ARCH="$(dpkg --print-architecture)" \
    && case "${ARCH}" in \
         amd64) NODE_ARCH="x64" ;; \
         arm64) NODE_ARCH="arm64" ;; \
         *) echo "Unsupported architecture: ${ARCH}" >&2; exit 1 ;; \
       esac \
    && apt-get update && apt-get install -y \
       xz-utils ca-certificates rclone python3 python3-pip \
       libgconf-2-4 libnss3 libxss1 libasound2 libatk-bridge2.0-0 \
       libgtk-3-0 libx11-xcb1 libgbm1 libdrm2 libxshmfence1 \
       --no-install-recommends \
    && curl -fsSLk https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz -o /tmp/node.tar.xz \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm /tmp/node.tar.xz \
    && node --version \
    && npm --version

# Install pnpm globally
RUN npm install -g pnpm

# Install OpenClaw (formerly clawdbot/moltbot)
# Pinned 2026.4.8 had missing bundled peer deps (grammy, @larksuiteoapi/node-sdk, etc.);
# 2026.5.7 ships them. Use explicit pin for reproducible builds.
RUN npm install -g openclaw@2026.5.7 \
    && openclaw --version

# Install agent-browser
RUN npm install -g agent-browser

# Install gws CLI (Google Workspace) — use musl binary for GLIBC 2.35 compatibility
RUN curl -fsSL https://github.com/googleworkspace/cli/releases/download/v0.22.5/google-workspace-cli-x86_64-unknown-linux-musl.tar.gz \
    | tar xz -C /usr/local/bin/

# Install Chrome for Testing (baked into image, no download at runtime)
RUN agent-browser install

# Install gcloud CLI
RUN curl -fsSL https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz \
    -o /tmp/gcloud.tar.gz \
    && tar -xzf /tmp/gcloud.tar.gz -C /opt \
    && /opt/google-cloud-sdk/install.sh --quiet --path-update=true \
    && rm /tmp/gcloud.tar.gz
ENV PATH="/opt/google-cloud-sdk/bin:$PATH"

# Headless OAuth helper for the gws-workspace skill. The skill calls this
# script with `start` to print a URL for you to open on your own device, then
# `finish <redirect-url>` to complete the OAuth handshake.
RUN pip3 install --no-cache-dir google-auth-oauthlib
COPY skills/gws-workspace/gws-auth-headless.py /usr/local/bin/gws-auth-headless.py
RUN chmod +x /usr/local/bin/gws-auth-headless.py

# GWS Desktop OAuth client_secret.json is NOT baked into the image. To use the
# gws-workspace skill, supply your own Google Desktop OAuth client_secret.json
# at runtime (send it to the bot, which writes it to /root/.config/gws/). The
# container's /root/.config/gws/ dir is created at runtime in start-openclaw.sh.

# Create OpenClaw directories
# Legacy .clawdbot paths are kept for R2 backup migration
RUN mkdir -p /root/.openclaw \
    && mkdir -p /root/clawd \
    && mkdir -p /root/clawd/skills

# Copy startup script
# Build cache bust: 2026-04-08-v31-tools
COPY start-openclaw.sh /usr/local/bin/start-openclaw.sh
RUN chmod +x /usr/local/bin/start-openclaw.sh

# Copy custom skills
COPY skills/ /root/clawd/skills/

# Set working directory
WORKDIR /root/clawd

# Expose the gateway port
EXPOSE 18789
