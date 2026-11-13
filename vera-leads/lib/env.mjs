// Load vera-leads/.env (APIFY_TOKEN, MILLIONVERIFIER_KEY, ...) if it exists, so nothing needs `source`
// on Windows. Imported first by vera-leads.mjs so config.mjs sees it. Variables already set in the shell win.
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const file = fileURLToPath(new URL('../.env', import.meta.url))
if (fs.existsSync(file)) {
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m || process.env[m[1]] != null) continue
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}
