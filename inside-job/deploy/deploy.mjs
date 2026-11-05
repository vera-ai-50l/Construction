#!/usr/bin/env node
// Deploy Inside Job to the n8n server.
//
//   node deploy/deploy.mjs --package [file]   build and write inside-job.tgz (upload it through the
//                                             Google Cloud SSH window, then run the line it prints)
//   node deploy/deploy.mjs                    build, copy over ssh and install (needs ssh key access)
//   node deploy/deploy.mjs --check            only check the live address
//
// Reads (nothing secret is stored in this repo):
//   IJ_DOMAIN   the game's address, e.g. game.getveraai.com. Its DNS A record must point at the
//               server. Leave it empty to serve http://<server>:8080 instead of going through Caddy.
//   VERA_SSH    ssh target for the direct mode, e.g. you@35.255.23.220
//
// The server side is deploy/install.sh, packed into the archive. It finds the Caddy container,
// runs the game on its network, adds the domain to the Caddyfile once and reloads Caddy.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.env.VERA_SSH || '';
const domain = (process.env.IJ_DOMAIN || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const pkgIdx = process.argv.indexOf('--package');

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

if (pkgIdx < 0 && !target) fail('Set VERA_SSH=user@host first, or use --package to make a file to upload.');
if (domain && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) fail('IJ_DOMAIN does not look like a domain name: ' + domain);

// 1. Build here, so the server only needs Docker.
const run = (cmd) => { console.log('$ ' + cmd); execSync(cmd, { cwd: root, stdio: 'inherit' }); };
if (!fs.existsSync(path.join(root, 'node_modules', 'esbuild'))) run('npm ci');
run('npm run build');

// 2. Package the standalone game: server, page and assets (not the artifact-only copies).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inside-job-'));
const top = path.join(tmp, 'inside-job-deploy');
const stage = path.join(top, 'ctx');
fs.mkdirSync(stage, { recursive: true });
fs.copyFileSync(path.join(root, 'deploy', 'install.sh'), path.join(top, 'install.sh'));
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
execFileSync('tar', ['-czf', 'inside-job.tgz', 'inside-job-deploy'], { cwd: tmp, stdio: 'inherit' });
console.log(`packaged ${(fs.statSync(path.join(tmp, 'inside-job.tgz')).size / 1e6).toFixed(1)} MB`);
const installLine = (dir) => `cd ${dir} && rm -rf inside-job-deploy && tar -xzf inside-job.tgz && sh inside-job-deploy/install.sh ${domain}`.trim();

if (pkgIdx >= 0) {
  const next = process.argv[pkgIdx + 1];
  const out = path.resolve(next && !next.startsWith('--') ? next : path.join(root, 'inside-job.tgz'));
  fs.copyFileSync(path.join(tmp, 'inside-job.tgz'), out);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\nWrote ' + out);
  console.log('Upload it in the Google Cloud SSH window (UPLOAD FILE), then paste:\n');
  console.log('  ' + installLine('~'));
  process.exit(0);
}

// 3. Copy it up and install it with deploy/install.sh.
const ssh = (input) => execFileSync('ssh', [target, 'sh -s'], { input, stdio: ['pipe', 'inherit', 'inherit'] });
console.log('$ ssh ' + target + ' (prepare)');
ssh('set -e\nrm -rf /tmp/inside-job-up && mkdir -p /tmp/inside-job-up\n');
console.log('$ scp inside-job.tgz ' + target + ':/tmp/inside-job-up/');
execFileSync('scp', ['inside-job.tgz', target + ':/tmp/inside-job-up/'], { cwd: tmp, stdio: 'inherit' });
console.log('$ ssh ' + target + ' (install)');
ssh('set -e\n' + installLine('/tmp/inside-job-up') + '\nrm -rf /tmp/inside-job-up\n');
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
