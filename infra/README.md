# n8n server

n8n (pinned) behind Caddy, which gets and renews the HTTPS certificate on its own.

## One-time setup on a fresh Ubuntu VPS

1. Point an A record for the n8n domain at the VPS. Open ports 80 and 443.
2. Install Docker: `curl -fsSL https://get.docker.com | sh`
3. Copy this folder to the server, e.g. `/opt/vera`.
4. `cp .env.example .env`, then fill in the domain, email and a new encryption key (`openssl rand -hex 32`). Keep a copy of the key somewhere safe.
5. `docker compose up -d`, then open `https://<domain>` and create the owner account.

## Load the demo workflows

From the repo, on your machine:

```
VERA_SSH=user@host node n8n/vera-demo.mjs deploy     # builds, copies, imports, publishes, restarts n8n
VERA_N8N_URL=https://<domain> node n8n/vera-demo.mjs smoke
```

`VERA_SUDO=1` if docker needs sudo on the server; `VERA_N8N_CONTAINER` if the container is not called `n8n`.

## Upkeep

- Upgrade: change the image tag in `docker-compose.yml`, `docker compose pull && docker compose up -d`.
- Backup: `docker run --rm -v vera_n8n_data:/d -v $PWD:/b alpine tar czf /b/n8n-$(date +%F).tgz -C /d .`
- Executions older than 7 days are pruned; container logs are capped at 30 MB each.
