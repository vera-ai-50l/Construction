// Build: bundle src/main.js into one inline script and write
//   dist/index.html  - page fragment for the claude.ai artifact (no doctype/head/body)
//   dist/play.html   - full standalone page for the self-hosted server
// and copy assets/ to dist/assets/.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const dev = process.argv.includes('--dev');

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (!fs.existsSync(d) || fs.statSync(d).mtimeMs < fs.statSync(s).mtimeMs) fs.copyFileSync(s, d);
  }
}

const t0 = Date.now();
const res = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: !dev,
  sourcemap: false,
  target: ['es2020', 'safari15', 'chrome100', 'firefox100'],
  write: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"', __BUILD__: JSON.stringify(new Date().toISOString()) },
  logLevel: 'warning',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const css = fs.readFileSync(path.join(root, 'src/ui/style.css'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src/ui/shell.html'), 'utf8');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" media="print" onload="this.media=\'all\'" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap">';
const frag = `<title>Inside Job</title>
${fonts}
<style>${css}</style>
${shell}
<script>${js}</script>
`;
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), frag);
fs.writeFileSync(path.join(dist, 'play.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230a1018'/%3E%3Cpath d='M16 5 27 16 16 27 5 16Z' fill='none' stroke='%23ffb648' stroke-width='2'/%3E%3C/svg%3E"></head><body>${frag.replace('<div id="app">', '<div id="app" data-standalone>')}</body></html>`);
copyDir(path.join(root, 'assets'), path.join(dist, 'assets'));
// binary assets also go out as base64 text (see fetchBin in src/render/assets.js)
for (const sub of ['models', 'env']) {
  const d = path.join(dist, 'assets', sub);
  for (const f of fs.readdirSync(d)) if (/\.(glb|exr)$/.test(f)) fs.writeFileSync(path.join(d, f + '.b64.txt'), fs.readFileSync(path.join(d, f)).toString('base64'));
}
console.log(`built dist/index.html (${(frag.length / 1024).toFixed(0)} KB) in ${Date.now() - t0} ms`);
