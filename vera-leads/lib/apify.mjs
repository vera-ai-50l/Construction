// Run an Apify actor and return its dataset items. Token from APIFY_TOKEN.
// Uses start + poll (not run-sync) so long scrapes don't hit the 5-minute sync limit.
import fs from 'node:fs'
import { log, sleep } from './util.mjs'

const API = 'https://api.apify.com/v2'

export async function runActor(actor, input, { maxWaitMin = 30 } = {}) {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN is not set. Get it from Apify Console > Settings > API & Integrations.')
  const h = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  const id = actor.replace('/', '~')
  const start = await fetch(`${API}/acts/${id}/runs`, { method: 'POST', headers: h, body: JSON.stringify(input) })
  if (!start.ok) throw new Error(`Apify ${actor}: ${start.status} ${await start.text()}`)
  const run = (await start.json()).data
  log(`Apify ${actor}: run ${run.id} started`)
  const until = Date.now() + maxWaitMin * 60000
  let st = run
  while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(st.status)) {
    if (Date.now() > until) throw new Error(`Apify ${actor}: still ${st.status} after ${maxWaitMin} min (run ${run.id}). Fetch it later with --from-file.`)
    await sleep(10000)
    st = (await (await fetch(`${API}/actor-runs/${run.id}`, { headers: h })).json()).data
  }
  if (st.status !== 'SUCCEEDED') throw new Error(`Apify ${actor}: run ${run.id} ${st.status}`)
  const items = await (await fetch(`${API}/datasets/${st.defaultDatasetId}/items?clean=true&format=json`, { headers: h })).json()
  log(`Apify ${actor}: ${items.length} items`)
  return items
}

// Items from a dataset exported by hand from the Apify console (JSON array, or JSON lines).
export function readItems(file) {
  const s = fs.readFileSync(file, 'utf8').trim()
  if (s.startsWith('[')) return JSON.parse(s)
  return s.split('\n').filter(Boolean).map(l => JSON.parse(l))
}
