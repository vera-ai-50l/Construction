// Minimal Apify client: start an actor run, wait for it, read its dataset.
// Token: APIFY_TOKEN. (In a cloud session with a saved network secret for
// api.apify.com, the proxy adds the real token and this placeholder is replaced.)
import { addCost } from './ledger.mjs';

const BASE = 'https://api.apify.com/v2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function headers() {
  return {
    authorization: `Bearer ${process.env.APIFY_TOKEN || 'set-APIFY_TOKEN'}`,
    'content-type': 'application/json',
  };
}

async function call(method, path, body) {
  // Temporary server errors (502/503/504, dropped connections) are retried; others are not.
  for (let attempt = 0; ; attempt++) {
    try {
      return await callOnce(method, path, body);
    } catch (e) {
      const transient = /failed: 5\d\d|fetch failed|ECONNRESET|socket hang up|timeout/i.test(e.message);
      if (!transient || attempt >= 4 || (method === 'POST' && !/fetch failed|ECONNRESET/.test(e.message))) throw e;
      await sleep(3000 * (attempt + 1));
    }
  }
}

async function callOnce(method, path, body) {
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
  let final = (await call('GET', `/actor-runs/${run.id}`)).data;
  // Pay-per-event charges reach the run record a few seconds after it ends.
  for (let i = 0; i < 4 && !final.usageTotalUsd && items.length; i++) {
    await sleep(3000);
    final = (await call('GET', `/actor-runs/${run.id}`)).data;
  }
  // Pay-per-event runs can lag in usageTotalUsd: price the charged events directly.
  if (!final.usageTotalUsd && final.chargedEventCounts && final.pricingInfo?.pricingPerEvent?.actorChargeEvents) {
    const prices = final.pricingInfo.pricingPerEvent.actorChargeEvents;
    final.usageTotalUsd = Object.entries(final.chargedEventCounts).reduce((sum, [ev, n]) => sum + n * (prices[ev]?.eventPriceUsd || 0), 0);
  }
  log(`apify: ${actor} returned ${items.length} items (usage $${(final.usageTotalUsd ?? 0).toFixed(3)})`);
  // Actual billed usage for the run, as Apify reports it.
  addCost(`apify:${actor}`, { units: items.length, usd: final.usageTotalUsd ?? 0, unit: 'item' });
  return items;
}
