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

## Permanent: the n8n server (Google Cloud)

The game runs next to n8n on the same server, behind the same Caddy, at its own
subdomain. Running the install again updates the game. It never touches n8n.

1. **DNS.** In Namecheap, open Domain List, then Manage for `getveraai.com`,
   then Advanced DNS. Add an A record with Host `game` and Value set to the
   server's static IP (the same IP as the `n8n` record). Wait until
   dnschecker.org shows that IP for `game.getveraai.com`.
2. **Build the upload file** on your computer, in the `inside-job` folder:

   ```
   npm ci
   npm run build
   node deploy/deploy.mjs --package
   ```

   This writes `inside-job.tgz`.
3. **Upload it.** Google Cloud console, Compute Engine, VM instances, then
   **SSH** on `n8n-server`. In the SSH window, click **UPLOAD FILE** and pick
   `inside-job.tgz`. It lands in your home folder.
4. **Install.** Paste this one line in the SSH window and press Enter:

   ```
   cd ~ && rm -rf inside-job-deploy && tar -xzf inside-job.tgz && sh inside-job-deploy/install.sh game.getveraai.com
   ```

5. Open `https://game.getveraai.com`. The first load can take up to a minute
   while Caddy gets the certificate.

To update the game later, repeat steps 2 to 4.

If something fails: `docker logs inside-job` shows the game's log, and
`cd ~/n8n && docker compose logs caddy` shows certificate problems (usually
DNS not pointing at the server yet).

### With an SSH key

If your computer can log in with `ssh you@server-ip` without a password,
one command does steps 2 to 4:

```
$env:VERA_SSH = 'you@35.255.23.220'
$env:IJ_DOMAIN = 'game.getveraai.com'
node deploy/deploy.mjs
```

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
