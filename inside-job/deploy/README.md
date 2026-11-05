# Hosting Inside Job

The game is one Node process: it serves the page and runs the WebSocket relay
that links the Runner and the Hacker. Both players open the same address.

**Vercel will not work for co-op.** Vercel runs short-lived serverless
functions, and the relay needs one long-running process that holds both
players' connections. Use your VPS (permanent) or a tunnel from your own
computer (quick, for tonight).

## Tonight: run it on your Windows machine

In the `inside-job` folder:

```
npm ci
npm run build
node server.js
```

In a second terminal, open a free Cloudflare quick tunnel and send your
partner the `https://….trycloudflare.com` address it prints:

```
npx cloudflared tunnel --url http://localhost:8080
```

Keep both terminals open while you play. The address changes every time you
start the tunnel, and the browser keeps your crew save per address, so a new
address starts a fresh crew. Use the VPS if you want your progress to stick.

## Permanent: your VPS (next to n8n)

One command from your own computer builds the game, copies it to the VPS,
starts it next to n8n and adds its address to Caddy, which gets the HTTPS
certificate. Running it again updates the game. It never touches n8n.

Before the first run:

1. The VPS runs the n8n stack from `infra/` (Docker, with containers called
   `n8n` and `caddy`). See `infra/README.md`.
2. Add a DNS A record for the game's address (for example `game.example.com`)
   pointing at the VPS IP.
3. You can log in with `ssh user@your-vps-ip` without typing a password
   (an SSH key), the same login the n8n deploy uses.

Then, from the `inside-job` folder (Windows PowerShell):

```
$env:VERA_SSH = 'root@203.0.113.10'
$env:IJ_DOMAIN = 'game.example.com'
node deploy/deploy.mjs
```

macOS or Linux: `VERA_SSH=root@203.0.113.10 IJ_DOMAIN=game.example.com node deploy/deploy.mjs`.

Add `$env:VERA_SUDO = '1'` if Docker needs sudo on the VPS. The script waits
for the live address and prints it. Both players open it and use the same
crew code. `node deploy/deploy.mjs --check` checks the address again later.

No domain yet? Leave `IJ_DOMAIN` empty. The game then runs on
`http://your-vps-ip:8080` (open port 8080 in the VPS firewall), without Caddy.

If you ever copy `infra/Caddyfile` over the server's copy again, rerun the
deploy: it adds the game's block back.

### By hand

Without the script: copy this folder to the server, `docker build -t
inside-job .`, run it on Caddy's Docker network with `--name inside-job`, and
add this block to the Caddyfile:

```
game.example.com {
	encode zstd gzip
	reverse_proxy inside-job:8080
}
```

Without Docker, any Linux box with Node 18+ works: `npm ci && npm run build`,
then keep `PORT=8080 node server.js` running (systemd or pm2) behind any
HTTPS reverse proxy that passes WebSocket upgrades on `/ws`.
