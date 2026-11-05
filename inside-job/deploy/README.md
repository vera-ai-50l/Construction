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

The VPS already runs Caddy for n8n (see `infra/`). Caddy forwards WebSocket
connections without extra settings and gets the HTTPS certificate on its own.

1. Point an A record for a game subdomain (for example `game.example.com`) at
   the VPS.
2. Copy this `inside-job` folder to the server, for example `/opt/inside-job`.
3. Add the game to `infra/docker-compose.yml` on the server, under `services:`:

   ```yaml
     inside-job:
       build: /opt/inside-job
       container_name: inside-job
       restart: unless-stopped
       expose:
         - '8080'
       logging: *logs
   ```

4. Add a block for the subdomain to `infra/Caddyfile`:

   ```
   game.example.com {
   	encode zstd gzip
   	reverse_proxy inside-job:8080
   }
   ```

5. From the `infra` folder on the server, run `docker compose up -d --build`.
   Open `https://game.example.com`. Both of you use that address and the
   same crew code.

To update the game later, copy the new `inside-job` folder over and run
`docker compose up -d --build inside-job`.

Without Docker, any Linux box with Node 18+ works: `npm ci && npm run build`,
then keep `PORT=8080 node server.js` running (systemd or pm2) behind any
HTTPS reverse proxy that passes WebSocket upgrades on `/ws`.
