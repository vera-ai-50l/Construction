#!/usr/bin/env node
// Deploy Inside Job to the VPS in one command, from Windows, macOS or Linux.
//
//   node deploy/deploy.mjs            build here, copy to the VPS, (re)start the game
//   node deploy/deploy.mjs --check    only check the live address
//
// Reads (nothing secret is stored in this repo):
//   VERA_SSH    ssh target, e.g. root@203.0.113.10 (key auth via your ssh-agent / ~/.ssh/config)
//   IJ_DOMAIN   the game's address, e.g. game.example.com. Its DNS A record must point at the
//               VPS. The game joins the Caddy container from infra/ and Caddy gets the HTTPS
//               certificate. Leave it empty to skip Caddy and serve http://<vps>:8080 instead.
//   VERA_SUDO   set to 1 if docker needs sudo on the VPS
//
// Needs `ssh`, `scp` and `tar` on this machine (all built into Windows 10 and 11) and
// Docker on the VPS. Running it again updates the game; it never touches n8n.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.env.VERA_SSH || '';
const domain = (process.env.IJ_DOMAIN || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const sudo = process.env.VERA_SUDO === '1';

function fail(msg) { console.error('\n' + msg); process.exit(1); }

async function check(url, tries = 1) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const body = await res.text();
      if (res.ok && body.includes('Inside Job')) { console.log('✓ ' + url + ' is serving the game'); return true; }
      console.log(`… ${url} answered ${res.status}`);
    } catch (e) { console.log(`… ${url} not reachable yet (${e.cause?.code || e.message})`); }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}

const liveUrl = () => (domain ? 'https://' + domain + '/' : 'http://' + target.replace(/^.*@/, '') + ':8080/');

if (process.argv.includes('--check')) {
  if (!domain && !target) fail('Set IJ_DOMAIN (or VERA_SSH) first.');
  process.exit((await check(liveUrl())) ? 0 : 1);
}

if (!target) fail('Set VERA_SSH=user@host first (the same login you use for the n8n server).');
if (domain && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) fail('IJ_DOMAIN does not look like a domain name: ' + domain);

// 1. Build here, so the server only needs Docker.
const run = (cmd) => { console.log('$ ' + cmd); execSync(cmd, { cwd: root, stdio: 'inherit' }); };
if (!fs.existsSync(path.join(root, 'node_modules', 'esbuild'))) run('npm ci');
run('npm run build');

// 2. Package the standalone game: server, page and assets (not the artifact-only copies).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inside-job-'));
const stage = path.join(tmp, 'ctx');
fs.mkdirSync(stage);
for (const f of ['package.json', 'server.js']) fs.copyFileSync(path.join(root, f), path.join(stage, f));
fs.cpSync(path.join(root, 'dist'), path.join(stage, 'dist'), {
  recursive: true,
  filter: (src) => !src.endsWith('.b64.txt') && path.basename(src) !== 'index.html',
});
fs.writeFileSync(path.join(stage, 'Dockerfile'), [
  'FROM node:22-alpine',
  'WORKDIR /app',
  'COPY . .',
  'ENV PORT=8080',
  'EXPOSE 8080',
  'USER node',
  'CMD ["node", "server.js"]',
  '',
].join('\n'));
execFileSync('tar', ['-czf', 'inside-job.tgz', '-C', 'ctx', '.'], { cwd: tmp, stdio: 'inherit' });
console.log(`packaged ${(fs.statSync(path.join(tmp, 'inside-job.tgz')).size / 1e6).toFixed(1)} MB`);

// 3. Copy it up and (re)start the container. One POSIX sh script, sent on stdin.
const ssh = (input) => execFileSync('ssh', [target, 'sh -s'], { input, stdio: ['pipe', 'inherit', 'inherit'] });
console.log('$ ssh ' + target + ' (prepare)');
ssh('set -e\nrm -rf /tmp/inside-job-deploy && mkdir -p /tmp/inside-job-deploy\n');
console.log('$ scp inside-job.tgz ' + target + ':/tmp/inside-job-deploy/');
execFileSync('scp', ['inside-job.tgz', target + ':/tmp/inside-job-deploy/'], { cwd: tmp, stdio: 'inherit' });

const remote = `set -e
D="${sudo ? 'sudo docker' : 'docker'}"
SUDO="${sudo ? 'sudo' : ''}"
DOMAIN="${domain}"
command -v docker >/dev/null 2>&1 || { echo "Docker is not installed on the VPS: curl -fsSL https://get.docker.com | sh"; exit 2; }
cd /tmp/inside-job-deploy
mkdir ctx && tar -xzf inside-job.tgz -C ctx
echo "building the image on the VPS..."
$D build -q -t inside-job:latest ctx >/dev/null
$D rm -f inside-job >/dev/null 2>&1 || true
if [ -n "$DOMAIN" ]; then
  if ! $D ps --format '{{.Names}}' | grep -qx caddy; then
    echo "No running container called caddy. Start the n8n stack in infra/ first (docker compose up -d),"
    echo "or deploy without IJ_DOMAIN to serve the game on port 8080."
    exit 3
  fi
  NET=$($D inspect caddy --format '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' | head -n 1)
  $D run -d --name inside-job --restart unless-stopped --network "$NET" \\
    --log-opt max-size=10m --log-opt max-file=3 inside-job:latest >/dev/null
  CF=$($D inspect caddy --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')
  [ -n "$CF" ] || { echo "Could not find the Caddyfile mounted into the caddy container."; exit 4; }
  if grep -q "^$DOMAIN {" "$CF"; then
    echo "Caddy already serves $DOMAIN"
  else
    # append in place: the Caddyfile is bind-mounted as a single file
    printf '\\n# Inside Job game (added by inside-job/deploy/deploy.mjs)\\n%s {\\n\\tencode zstd gzip\\n\\treverse_proxy inside-job:8080\\n}\\n' "$DOMAIN" | $SUDO tee -a "$CF" >/dev/null
    echo "added $DOMAIN to $CF"
  fi
  $D exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
else
  $D run -d --name inside-job --restart unless-stopped -p 8080:8080 \\
    --log-opt max-size=10m --log-opt max-file=3 inside-job:latest >/dev/null
  echo "serving on port 8080 (open it in the VPS firewall if needed)"
fi
$D image prune -f >/dev/null 2>&1 || true
rm -rf /tmp/inside-job-deploy
$D ps --filter name=inside-job --format 'container {{.Names}}: {{.Status}}'
`;
console.log('$ ssh ' + target + ' (build and start)');
ssh(remote);
fs.rmSync(tmp, { recursive: true, force: true });

// 4. Wait for the live address. A new domain can take a minute for the certificate.
console.log('\nChecking ' + liveUrl() + ' ...');
if (await check(liveUrl(), domain ? 18 : 6)) {
  console.log('\nDeployed. Both players open ' + liveUrl() + ' and use the same crew code.');
} else {
  console.log('\nThe container is running but the address is not answering yet.');
  if (domain) console.log('Check that the A record for ' + domain + ' points at the VPS and ports 80 and 443 are open, then run: node deploy/deploy.mjs --check');
  else console.log('Check that port 8080 is open in the VPS firewall, then run: node deploy/deploy.mjs --check');
  process.exitCode = 1;
}
