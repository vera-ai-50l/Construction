// Renders the sample papers (eval/papers.mjs) to PDF, and two of them as phone photos (JPEG).
//   node n8n/mobilise/eval/make-papers.mjs        (needs Playwright's Chromium)
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { CASES, PHOTO_CASES, PAGE_CSS } from './papers.mjs'
const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, 'papers')
fs.mkdirSync(out, { recursive: true })
const { chromium } = createRequire(import.meta.url)('playwright')
const page = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE_CSS}</style></head><body><div class="page">${c.html}<div class="wm"><span>SAMPLE FOR TESTING</span></div></div></body></html>`
const b = await chromium.launch()
const p = await b.newPage()
for (const c of CASES) {
  await p.setContent(page(c), { waitUntil: 'load' })
  await p.pdf({ path: path.join(out, c.id + '.pdf'), format: 'A4', printBackground: true })
  if (PHOTO_CASES.includes(c.id)) {
    // a phone photo of the printed page: on a desk, a little rotated and in perspective, uneven light
    await p.setViewportSize({ width: 794, height: 1123 })
    const png = await p.screenshot({ fullPage: false })
    const desk = await b.newPage({ viewport: { width: 1200, height: 1600 } })
    await desk.setContent(`<body style="margin:0;background:radial-gradient(circle at 30% 20%,#a98d6d,#6e5640);height:1600px;overflow:hidden">
      <img src="data:image/png;base64,${png.toString('base64')}" style="position:absolute;left:150px;top:180px;width:900px;transform:perspective(1400px) rotateX(9deg) rotateZ(-3.5deg);box-shadow:0 30px 60px rgba(0,0,0,.45);filter:brightness(.93) contrast(1.05)">
      <div style="position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.18),rgba(0,0,0,.18))"></div></body>`)
    await desk.screenshot({ path: path.join(out, c.id + '-photo.jpg'), type: 'jpeg', quality: 78 })
    await desk.close()
  }
}
await b.close()
console.log('wrote', fs.readdirSync(out).sort().join(' '))
