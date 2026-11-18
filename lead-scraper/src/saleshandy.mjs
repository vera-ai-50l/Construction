// SalesHandy open API (https://open-api.saleshandy.com, header x-api-key).
// Used for: sequences and their steps/variants, custom fields, adding prospects to a
// sequence step with field names, and webhooks. Nothing here sends an email by itself:
// SalesHandy sends once a prospect sits in an active sequence.
//
// Key: SALESHANDY_API_KEY. In a cloud session the key is a saved network secret that the
// proxy adds to requests (use SALESHANDY_API_KEY=proxy-injected there). Never print it.
const BASE = 'https://open-api.saleshandy.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, body, { retries = 3 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'x-api-key': process.env.SALESHANDY_API_KEY || 'set-SALESHANDY_API_KEY', 'content-type': 'application/json', accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60000),
    });
    const text = await res.text();
    if (res.ok) return text ? JSON.parse(text) : null;
    if (res.status >= 500 && attempt < retries) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    const hint = res.status === 401 ? ' (check SALESHANDY_API_KEY)' : '';
    throw new Error(`SalesHandy ${method} ${path} failed: ${res.status}${hint} ${text.slice(0, 300)}`);
  }
}
const payload = (r) => r?.payload ?? r?.data ?? r;

export const sequences = async (name = '') => payload(await call('GET', `/v1/sequences?pageSize=100${name ? `&sequenceName=${encodeURIComponent(name)}` : ''}`));
export const steps = async (sequenceId) => payload(await call('GET', `/v1/sequences/${sequenceId}/steps`));
export const fields = async () => payload(await call('GET', '/v1/fields'));
export const webhooks = async () => payload(await call('GET', '/v1/webhook?pageSize=100'));
export const createSequence = async (title, opts = {}) => payload(await call('POST', '/v1/sequences', { title, ...opts }));
export const createStep = async (sequenceId, step) => payload(await call('POST', `/v1/sequences/${sequenceId}/steps`, step));
export const createField = async (label, fieldType = 'long-text') => payload(await call('POST', '/v1/fields', { label, fieldType }));
export const createWebhook = async ({ name, url, events, headers = {} }) => payload(await call('POST', '/v1/webhook/create', { name, webhookUrl: url, webhookEvent: events, headers }));
export const setSequenceStatus = async (ids, status) => payload(await call('POST', '/v1/sequences/status', { sequenceIds: ids, status }));

/** Add prospects (objects keyed by SalesHandy field names) to a sequence step. */
export async function importProspects(stepId, prospectList, { conflictAction = 'noUpdate', log = () => {} } = {}) {
  const r = await call('POST', '/v1/sequences/prospects/import-with-field-name', { prospectList, stepId, verifyProspects: false, conflictAction });
  const p = payload(r);
  const requestId = String(p?.requestId || r?.requestId || '');
  for (let i = 0; requestId && i < 20; i++) {
    const st = payload(await call('GET', `/v1/prospects/import-status/${requestId}`));
    const status = String(st?.status || '').toLowerCase();
    log(`saleshandy import ${requestId}: ${status || 'pending'}`);
    if (/complete|done|success|finished/.test(status)) return { requestId, status: st };
    if (/fail|error/.test(status)) throw new Error(`SalesHandy import ${requestId} failed: ${JSON.stringify(st).slice(0, 300)}`);
    await sleep(3000);
  }
  return { requestId, status: 'submitted' };
}

// The Kyre custom fields our CSV fills (created once with ensureFields).
export const KYRE_FIELDS = [
  ['Subject', 'text'], ['Subject Alt', 'text'], ['Email Body', 'long-text'], ['Follow Up 1', 'long-text'], ['Follow Up 2', 'long-text'],
  ['Send Group', 'text'], ['Email Verification', 'text'], ['Email Confidence', 'number'], ['Lead Source', 'text'], ['Kyre List', 'text'], ['Lead Finding From', 'text'],
];

export async function ensureFields({ dryRun = true, log = () => {} } = {}) {
  const f = await fields();
  const list = Array.isArray(f) ? f : f?.fields || f?.data || [];
  const have = new Set(list.map((x) => String(x.label || x.name || '').toLowerCase()));
  const missing = KYRE_FIELDS.filter(([l]) => !have.has(l.toLowerCase()));
  for (const [label, type] of missing) {
    log(`${dryRun ? '[dry run] would create' : 'creating'} custom field "${label}" (${type})`);
    if (!dryRun) await createField(label, type);
  }
  return missing.map(([l]) => l);
}
