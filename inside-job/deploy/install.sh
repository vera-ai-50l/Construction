#!/bin/sh
# Installs or updates Inside Job on the n8n server, next to n8n and Caddy.
# deploy.mjs packs this script with the built game into inside-job.tgz. On the server:
#
#   tar -xzf inside-job.tgz && sh inside-job-deploy/install.sh game.getveraai.com
#
# With a domain, the game joins Caddy's Docker network and Caddy serves it over HTTPS
# (the domain's DNS A record must point at the server). Without one it serves port 8080.
# Running it again updates the game. It never changes n8n.
set -e
DOMAIN=$(printf '%s' "$1" | tr 'A-Z' 'a-z')
case "$DOMAIN" in *[!a-z0-9.-]*) echo "Not a domain name: $DOMAIN"; exit 1;; esac
cd "$(dirname "$0")"

command -v docker >/dev/null 2>&1 || { echo "Docker is not installed on this server."; exit 2; }
D=docker
docker info >/dev/null 2>&1 || D="sudo docker"

echo "Building the game image..."
$D build -q -t inside-job:latest ./ctx >/dev/null
$D rm -f inside-job >/dev/null 2>&1 || true

if [ -n "$DOMAIN" ]; then
  # The Caddy container: compose service "caddy" (e.g. n8n-caddy-1), or a container named caddy.
  CADDY=$($D ps --filter label=com.docker.compose.service=caddy --format '{{.Names}}' | head -n 1)
  [ -n "$CADDY" ] || CADDY=$($D ps --format '{{.Names}}' | grep -x caddy || true)
  if [ -z "$CADDY" ]; then
    echo "No running Caddy container. Start n8n first: cd ~/n8n && docker compose up -d"
    exit 3
  fi
  NET=$($D inspect "$CADDY" --format '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' | head -n 1)
  $D run -d --name inside-job --restart unless-stopped --network "$NET" \
    --log-opt max-size=10m --log-opt max-file=3 inside-job:latest >/dev/null
  CF=$($D inspect "$CADDY" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')
  [ -n "$CF" ] || { echo "Could not find the Caddyfile used by $CADDY."; exit 4; }
  if grep -q "^$DOMAIN {" "$CF"; then
    echo "Caddy already serves $DOMAIN"
  else
    TEE="tee -a"; [ -w "$CF" ] || TEE="sudo tee -a"
    # append in place: the Caddyfile is bind-mounted as a single file
    printf '\n# Inside Job game (added by inside-job/deploy/install.sh)\n%s {\n\tencode zstd gzip\n\treverse_proxy inside-job:8080\n}\n' "$DOMAIN" | $TEE "$CF" >/dev/null
    echo "Added $DOMAIN to $CF"
  fi
  $D exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  URL="https://$DOMAIN/"
else
  $D run -d --name inside-job --restart unless-stopped -p 8080:8080 \
    --log-opt max-size=10m --log-opt max-file=3 inside-job:latest >/dev/null
  URL="http://<server-ip>:8080/ (open port 8080 in the firewall)"
fi
$D image prune -f >/dev/null 2>&1 || true
$D ps --filter name=inside-job --format 'Container {{.Names}}: {{.Status}}'
echo ""
echo "Inside Job is running. Open $URL"
echo "A new domain can take a minute for its HTTPS certificate."
