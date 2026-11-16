// Minimal Apify client: start an actor run, wait for it, read its dataset.
// Token: APIFY_TOKEN. (In a cloud session with a saved network secret for
// api.apify.com, the proxy adds the real token and this placeholder is replaced.)
const BASE = 'https://api.apify.com/v2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function headers() {
  return {
    authorization: `Bearer ${process.env.APIFY_TOKEN || 'set-APIFY_TOKEN'}`,
    'content-type': 'application/json',
  };
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  const text = await res.text();
  if (!res.ok) {
    const hint = res.status === 401 ? ' (check APIFY_TOKEN)' : res.status === 402 ? ' (Apify account out of credit)' : '';
    throw new Error(`Apify ${method} ${path} failed: ${res.status}${hint} ${text.slice(0, 200)}`);
  }
  return text ? JSON.parse(text) : null;
}

/**
 * Run an actor and return its dataset items.
 * @param actor  "username/actor-name"
 * @param input  actor input JSON
 * @param opts   { maxWaitSecs = 900, memoryMbytes, log }
 */
export async function runActor(actor, input, { maxWaitSecs = 900, memoryMbytes, log = () => {} } = {}) {
  const id = actor.replace('/', '~');
  const qs = memoryMbytes ? `?memory=${memoryMbytes}` : '';
  const started = await call('POST', `/acts/${id}/runs${qs}`, input);
  const run = started.data;
  log(`apify: ${actor} run ${run.id} started`);
  const deadline = Date.now() + maxWaitSecs * 1000;
  let status = run.status;
  while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
    if (Date.now() > deadline) throw new Error(`Apify run ${run.id} still ${status} after ${maxWaitSecs}s; check it in the Apify console`);
    await sleep(5000);
    status = (await call('GET', `/actor-runs/${run.id}`)).data.status;
  }
  if (status !== 'SUCCEEDED') throw new Error(`Apify run ${run.id} ended ${status}`);
  const items = await call('GET', `/datasets/${run.defaultDatasetId}/items?clean=true&format=json`);
  const final = (await call('GET', `/actor-runs/${run.id}`)).data;
  log(`apify: ${actor} returned ${items.length} items (usage $${(final.usageTotalUsd ?? 0).toFixed(3)})`);
  return items;
}
