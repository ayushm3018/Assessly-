#!/usr/bin/env bash
# Deploys Assessly to the shared EC2 box (the one that also runs CodeSync).
# Builds the client here, ships it plus the API source, restarts the API, reloads Caddy.
set -euo pipefail

HOST="${HOST:-ubuntu@3.7.67.26}"
KEY="${KEY:-$HOME/.ssh/codesync-key.pem}"
SSH="ssh -i $KEY"

cd "$(dirname "$0")/.."

# The box only has 1GB of RAM, so the Vite build happens here. VITE_SERVER_URL is
# empty in production so API calls stay same-origin; the other VITE_* come from client/.env.
(cd client && npm ci && VITE_SERVER_URL= npm run build)

$SSH "$HOST" 'sudo mkdir -p /srv/www/assessly /srv/caddy/sites ~/assessly && sudo chown -R "$USER": /srv/www/assessly /srv/caddy/sites ~/assessly'

rsync -az --delete -e "$SSH" client/dist/ "$HOST:/srv/www/assessly/"
rsync -az --delete -e "$SSH" --exclude node_modules --exclude 'public/*' server/ "$HOST:assessly/server/"
rsync -az -e "$SSH" docker-compose.yml "$HOST:assessly/"
rsync -az -e "$SSH" deploy/assessly.caddy "$HOST:/srv/caddy/sites/"

$SSH "$HOST" 'cd ~/assessly && sudo docker compose up -d --build && sudo docker image prune -f \
  && sudo docker exec codesync-caddy-1 caddy reload --config /etc/caddy/Caddyfile'

echo "Deployed. Check: curl -I https://assessly.ddnsgeek.com"
