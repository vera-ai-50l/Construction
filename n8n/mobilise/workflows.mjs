// Desk 05 One-day Mobilisation: the n8n workflows, defined once.
//
// build.mjs turns this file into (1) importable n8n workflow JSON and (2) the board data,
// so the node map on the board is always the workflow that runs. Node positions here are
// the n8n canvas positions.
//
// Every node carries:
//   does    one line, plain English, shown on the board and as the n8n node note
//   guard   the guardrails on this node: retry | dedupe | idempotent | error-out | human | schema | auth | window | timeout | audit
// Code nodes run a function from logic.mjs (fn) or a short snippet (code) that needs
// n8n-only helpers (binary data, crypto, $env).

import * as L from './logic.mjs'
import { lines as TEMPLATE, areas as AREAS, params as PARAMS } from './checklist.mjs'

export const IDS = {
  errors: 'veraMob00Errors1',
  inbound: 'veraMob01Inbound',
  process: 'veraMob02Process',
  walk: 'veraMob03WalkApi',
  gaps: 'veraMob04GapList',
  replies: 'veraMob05Replies',
  noc: 'veraMob06NocRprt',
  closure: 'veraMob07Closure',
  setup: 'veraMob08SetupMb',
  send: 'veraMob09SendWa1',
  readPaper: 'veraMob10ReadPpr',
  show: 'veraMob11ShowEvd',
  reviews: 'veraMob12Reviews',
}

const GRAPH = 'https://graph.facebook.com/v23.0' // bump deliberately, like the n8n image tag
const CLAUDE = 'https://api.anthropic.com/v1/messages'
const SARVAM = 'https://api.sarvam.ai/speech-to-text'

export const CREDS = {
  pg: { postgres: { id: 'veraPostgres01', name: 'Vera Postgres' } },
  wa: { httpHeaderAuth: { id: 'veraWaToken001', name: 'WhatsApp Cloud API token (Authorization: Bearer …)' } },
  claude: { httpHeaderAuth: { id: 'veraAnthropic01', name: 'Anthropic API key (x-api-key)' } },
  sarvam: { httpHeaderAuth: { id: 'veraSarvam0001', name: 'Sarvam API key (api-subscription-key)' } },
  s3: { aws: { id: 'veraS3Evidence', name: 'Vera evidence bucket (ap-south-1)' } },
  smtp: { smtp: { id: 'veraOpsSmtp001', name: 'Vera ops email' } },
}

// ---------------------------------------------------------------- node helpers

const X = 280
const Y = 200
const at = (c, r) => [c * X, r * Y]

const n = (name, kind, params, pos, does, extra = {}) => ({ name, kind, params, pos, does, guard: [], ...extra })
const code = (name, fn, pos, does, extra = {}) => n(name, 'code', {}, pos, does, { fn, ...extra })
const snippet = (name, src, pos, does, extra = {}) => n(name, 'code', {}, pos, does, { src, ...extra })

const cond = (expr) => ({
  options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
  conditions: [{ id: 'c1', leftValue: expr, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
  combinator: 'and',
})
const iff = (name, expr, pos, does, extra = {}) => n(name, 'if', { conditions: cond(expr), looseTypeValidation: true, options: {} }, pos, does, extra)

const sw = (name, field, outputs, pos, does, extra = {}) =>
  n(name, 'switch', {
    rules: {
      values: outputs.map((o) => ({
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
          conditions: [{ leftValue: field, rightValue: o, operator: { type: 'string', operation: 'equals' } }],
          combinator: 'and',
        },
        renameOutput: true,
        outputKey: o,
      })),
    },
    options: { fallbackOutput: 'extra', renameFallbackOutput: 'Other' },
  }, pos, does, { outputs: outputs.concat(['Other']), ...extra })

// Postgres v2.5+ splits a plain-string parameter on commas, so every query gets ONE expression
// that returns an array: each value stays one parameter, and undefined becomes NULL (never shifts).
export function toParams(replacement) {
  const parts = [...String(replacement || '').matchAll(/\{\{([\s\S]*?)\}\}/g)].map((m) => m[1].trim())
  return parts.length ? '={{ [' + parts.map((e) => '(' + e + ') ?? null').join(', ') + '] }}' : ''
}
const pg = (name, query, replacement, pos, does, extra = {}) =>
  n(name, 'pg', { operation: 'executeQuery', query, options: replacement ? { queryReplacement: toParams(replacement) } : {} }, pos, does, {
    creds: CREDS.pg, retry: true, ...extra,
  })

const http = (name, o, pos, does, extra = {}) => {
  const p = { method: o.method || 'POST', url: o.url }
  if (o.auth) Object.assign(p, { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' })
  if (o.headers) Object.assign(p, { sendHeaders: true, headerParameters: { parameters: Object.entries(o.headers).map(([k, v]) => ({ name: k, value: v })) } })
  if (o.json) Object.assign(p, { sendBody: true, specifyBody: 'json', jsonBody: o.json })
  if (o.form) Object.assign(p, { sendBody: true, contentType: 'multipart-form-data', bodyParameters: { parameters: o.form } })
  p.options = { timeout: o.timeout || 30000, ...(o.file ? { response: { response: { responseFormat: 'file' } } } : {}) }
  return n(name, 'http', p, pos, does, { creds: o.auth ? CREDS[o.auth] : undefined, retry: true, ...extra })
}

const respond = (name, status, body, pos, does, extra = {}) =>
  n(name, 'respond', body === null
    ? { respondWith: 'noData', options: { responseCode: status } }
    : typeof body === 'string' && !body.startsWith('={{')
      ? { respondWith: 'text', responseBody: body, options: { responseCode: status } }
      : { respondWith: 'json', responseBody: body, options: { responseCode: status } }, pos, does, extra)

const hook = (name, method, path, pos, does, extra = {}) =>
  n(name, 'webhook', { httpMethod: method, path, responseMode: 'responseNode', options: { ...(extra.raw ? { rawBody: true } : {}), ...(extra.cors ? { allowedOrigins: '*' } : {}) } }, pos, does, extra)

// Call the Send sub-workflow. Everything that goes out on WhatsApp goes through it.
const send = (name, pos, does, m, extra = {}) =>
  n(name, 'exec', execParams(IDS.send, {
    contact_id: m.contact || '={{ $json.contact_id }}',
    mobilisation_id: m.mob || '={{ $json.mobilisation_id }}',
    kind: m.kind,
    area: m.area || '',
    line_code: m.line || '',
    ref: m.ref || '',
    request: m.request || '={{ $json.request }}',
  }, true), pos, does, extra)

const sub = (name, wfId, inputs, pos, does, extra = {}) => n(name, 'exec', execParams(wfId, inputs, false), pos, does, extra)

function execParams(wfId, inputs, wait) {
  const types = { contact_id: 'number', mobilisation_id: 'number', message_id: 'number', evidence_id: 'number', request: 'object', msg: 'object' }
  return {
    workflowId: { __rl: true, value: wfId, mode: 'id' },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: inputs,
      matchingColumns: [],
      schema: Object.keys(inputs).map((k) => ({ id: k, displayName: k, required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: types[k] || 'string' })),
      attemptToConvertTypes: true, // Postgres returns bigint ids as strings
      convertFieldsToString: false,
    },
    mode: 'each',
    options: { waitForSubWorkflow: wait },
  }
}

const trigger = (name, inputs, pos, does) =>
  n(name, 'sub', { inputSource: 'workflowInputs', workflowInputs: { values: Object.entries(inputs).map(([k, t]) => ({ name: k, type: t })) } }, pos, does)

const cron = (name, expression, pos, does) => n(name, 'cron', { rule: { interval: [{ field: 'cronExpression', expression }] } }, pos, does)
const noop = (name, pos, does) => n(name, 'noop', {}, pos, does)

function wf(id, name, purpose, build) {
  const w = { id, name, purpose, nodes: [], edges: [] }
  const api = {
    add(...nodes) { for (const x of nodes) w.nodes.push(x); return api },
    // edge kinds: main (default), true, false, error, or a Switch output name, or loop/done for Loop Over Items
    link(from, to, kind = 'main') { w.edges.push({ from, to, kind }); return api },
  }
  build(api)
  return w
}

// ---------------------------------------------------------------- snippets (n8n-only helpers)

// Meta signs every webhook body with the app secret (X-Hub-Signature-256). Checked over the
// raw bytes: re-serialising the parsed JSON would change them.
const SIG = `// Why Code: needs the raw body bytes and a constant-time compare (crypto).
const crypto = require('crypto');
const item = $input.first();
const raw = await this.helpers.getBinaryDataBuffer(0, 'data');
const secret = $env.VERA_WA_APP_SECRET || '';
const want = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
const got = String((item.json.headers || {})['x-hub-signature-256'] || '');
const ok = !!secret && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
let body = null;
try { body = JSON.parse(raw.toString('utf8')); } catch (e) { body = null; }
return [{ json: { ok: ok && body !== null, body, body_sha: crypto.createHash('sha256').update(raw).digest('hex') } }];`

const HASH = `// Why Code: hashing the downloaded bytes and checking size limits needs the binary buffer.
const crypto = require('crypto');
const item = $input.item;
const ctx = $('Load and lock message').item.json;
const buf = await this.helpers.getBinaryDataBuffer($itemIndex, 'data');
const sha = crypto.createHash('sha256').update(buf).digest('hex');
const mime = (item.binary && item.binary.data && item.binary.data.mimeType) || ctx.message.mime || '';
const limits = { image: 5e6, document: 25e6, audio: 16e6, video: 16e6 };
const tooBig = buf.length > (limits[ctx.message.type] || 5e6);
const reused = (ctx.known_hashes || []).find((h) => h.sha256 === sha) || null;
const ext = (mime.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '');
return {
  json: { ...ctx, file: { sha256: sha, bytes: buf.length, mime, tooBig, reused_from: reused ? reused.line_code || 'another line' : '' },
          s3_key: 'mob/' + ctx.mobilisation_id + '/' + sha.slice(0, 2) + '/' + sha + '.' + ext,
          file_ok: !tooBig && !reused },
  binary: item.binary,
};`

const MEDIA = (fnName, fnSrc) => `// ${fnName}: generated from n8n/mobilise/logic.mjs. Edit there, then rebuild.
// Why Code: the photo / PDF bytes go into the AI request as base64.
const item = $input.item;
const buf = await this.helpers.getBinaryDataBuffer($itemIndex, 'data');
const input = { ...item.json, __media: { b64: buf.toString('base64'), mime: (item.binary.data.mimeType || '').split(';')[0] } };
${fnSrc}
return { json: ${fnName}(input), binary: item.binary };`

const WALK_CHECK = `// Why Code: walk links are signed (HMAC) so a forwarded link expires and cannot be forged.
const crypto = require('crypto');
const item = $input.item;
const h = item.json.headers || {};
const token = String(h['x-vera-walk'] || (item.json.query || {}).t || '');
const [walkId, exp, sig] = token.split('.');
const want = crypto.createHmac('sha256', $env.VERA_WALK_SECRET || '').update(walkId + '.' + exp).digest('base64url');
const ok = !!sig && sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want)) && Number(exp) * 1000 > Date.now();
return { json: { ...item.json, walk_ok: ok, walk_id: ok ? Number(walkId) : null } };`

const WALK_SIGN = `// Why Code: signs the engineer's walk link (HMAC, expires the day after the visit).
const crypto = require('crypto');
const item = $input.item;
const exp = Math.floor(Date.parse(item.json.visit_date + 'T23:59:59+05:30') / 1000) + 86400;
const base = item.json.walk_id + '.' + exp;
const token = base + '.' + crypto.createHmac('sha256', $env.VERA_WALK_SECRET || '').update(base).digest('base64url');
const url = ($env.VERA_WALK_URL || 'https://vera.example/walk') + '#t=' + token;
return { json: { ...item.json, request: {
  body: { type: 'text', text: { preview_url: false, body: '*Site visit ' + item.json.visit_date + ': ' + item.json.project + '*\\nOpen this on the day. Tap a line, take the photo, say your remark. GPS is recorded with each photo.\\n' + url } },
  template: { name: 'vera_mob_walk_link', language: 'en', params: [item.json.project, item.json.visit_date, url] } } } };`

const PHOTO_FILE = `// Why Code: the walk page sends the photo as base64 JSON (it queues offline); this makes it a file.
const item = $input.item;
const b = item.json.body;
const mime = b.photo_mime || 'image/jpeg';
const binary = b.photo_b64 ? { data: { data: b.photo_b64, mimeType: mime, fileName: b.capture_id + '.jpg', fileExtension: 'jpg' } } : {};
const json = { ...item.json, has_photo: !!b.photo_b64, s3_key: 'mob/' + item.json.mobilisation_id + '/walk/' + b.capture_id + '.jpg' };
delete json.body.photo_b64;
return { json, binary };`

const PAGE_FILE = `// Why Code: Gotenberg wants the report page as an index.html file.
const item = $input.item;
return { json: { ...item.json, html: undefined }, binary: { data: { data: Buffer.from(item.json.html, 'utf8').toString('base64'), mimeType: 'text/html', fileName: 'index.html', fileExtension: 'html' } } };`

const PARSE_FIELDS = `// Why Code: read the structured answer, and refuse anything that is not one.
const item = $input.item;
const res = item.json;
const ctx = $('Build extract request').item.json;
const tb = (res.content || []).find((b) => b.type === 'text');
let fields = null;
try { fields = res.stop_reason === 'end_turn' ? JSON.parse(tb.text) : null; } catch (e) { fields = null; }
return { json: { ...ctx, request: undefined, fields: fields || { readable: false }, fields_ok: !!fields } };`

const READ_FORM = `// Why Code: maps the form's labels to field names (one node instead of a long Set).
const f = $input.item.json;
const k = { 'Project': 'project', 'Package': 'package', 'Contractor (legal name)': 'contractor_name', 'Other spellings of the contractor name': 'contractor_aliases',
  'Site address': 'site_address', 'Address words that must appear on papers': 'site_keywords', 'Work start date': 'start_date', 'Engineer visit date': 'visit_date',
  'Contract end date': 'contract_end', 'Contract value (₹)': 'contract_value_inr', 'Planned peak labour': 'peak_workers', 'Concrete': 'concrete',
  'Tower crane / hoist at site': 'lifting', 'Creche needed': 'creche', 'Excavation at start': 'excavation',
  'Contractor phone (WhatsApp)': 'contractor_phone', 'Engineer phone (WhatsApp)': 'engineer_phone', 'Shadow mode: a person confirms every AI filing': 'shadow' };
const out = {};
for (const [label, key] of Object.entries(k)) out[key] = f[label] == null ? '' : f[label];
return { json: out };`

const ALERT = `// Why Code: one readable alert; never includes message contents or secrets.
const e = $input.item.json;
const ex = e.execution || {};
const err = ex.error || {};
return { json: {
  workflow: (e.workflow || {}).name || '', execution_id: ex.id || '', node: ex.lastNodeExecuted || '', url: ex.url || '',
  message: String(err.message || 'unknown error').slice(0, 500),
  subject: 'Vera Desk 05: ' + ((e.workflow || {}).name || 'workflow') + ' failed at ' + (ex.lastNodeExecuted || '?'),
  text: 'Workflow: ' + ((e.workflow || {}).name || '') + '\\nNode: ' + (ex.lastNodeExecuted || '') + '\\nError: ' + String(err.message || '').slice(0, 500) + '\\nExecution: ' + (ex.url || '') +
    '\\n\\nThe message is not lost: the raw webhook is in inbox, and messages stuck in "processing" go to the review queue in 10 minutes.',
} };`

// ---------------------------------------------------------------- SQL

const SQL = {
  inbox: `insert into inbox (body_sha, payload) values ($1, $2::jsonb)
on conflict (body_sha) do update set body_sha = excluded.body_sha
returning id as inbox_id, payload as body;`,
  status: `update outbound set status = $2, error = nullif($3, '[]')::jsonb where wamid = $1
returning id, mobilisation_id, contact_id, kind, status, error;`,
  claim: `with m as (
  insert into messages (wamid, inbox_id, type, body) values ($1, $2, $3, $4::jsonb)
  on conflict (wamid) do nothing returning id
) select coalesce((select id from m), 0) as message_id;`,
  sender: `with c as (
  update contacts set last_inbound_at = now()
  where id = (select c2.id from contacts c2 left join mobilisations mo on mo.id = c2.mobilisation_id
              where c2.phone = $1 and (mo.phase <> 'closed' or (c2.role = 'reviewer' and c2.mobilisation_id is null))
              order by mo.visit_date desc nulls last limit 1)
  returning id, mobilisation_id, role
) update messages set contact_id = (select id from c), mobilisation_id = (select mobilisation_id from c)
  where id = $2
  returning id as message_id, contact_id, mobilisation_id, coalesce((select role from c), '') as role;`,
  load: `update messages set state = 'processing', state_at = now() where id = $1 and state in ('new', 'needs_human')
returning id as message_id, contact_id, mobilisation_id, body as message,
  (select role from contacts where id = messages.contact_id) as contact_role,
  (select json_agg(json_build_object('code', code, 'area', area, 'text', text, 'evidence', evidence, 'when', "when",
          'severity', severity, 'docType', doc_type, 'rules', rules, 'hint', hint, 'status', status) order by code)
     from lines where mobilisation_id = messages.mobilisation_id) as lines,
  (select json_agg(json_build_object('wamid', wamid, 'kind', kind, 'area', area, 'line', line_code, 'ref', ref))
     from outbound where contact_id = messages.contact_id and sent_at > now() - interval '30 days') as prompts,
  (select json_build_object('line', line_code, 'at', extract(epoch from at) * 1000) from pending_picks where contact_id = messages.contact_id) as "pendingPick",
  (select json_agg(json_build_object('sha256', sha256, 'line_code', line_code)) from evidence where mobilisation_id = messages.mobilisation_id) as known_hashes,
  (select row_to_json(mo) from mobilisations mo where mo.id = messages.mobilisation_id) as mob,
  (select id from contacts where mobilisation_id = messages.mobilisation_id and role = 'engineer' limit 1) as engineer_contact_id;`,
  saveEvidence: `with e as (
  insert into evidence (mobilisation_id, line_code, message_id, kind, s3_key, sha256, mime, bytes, bind_method, bind_confidence, ai, fields, checks, created_by, transcript, transcript_lang)
  values ($1, nullif($2, ''), $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14, nullif($18, ''), nullif($19, '')) returning id
), l as (
  update lines set status = case
      when $15 = 'accepted' then 'accepted' when $15 = 'rejected' then 'rejected' when $15 = 'review' then 'review'
      when status in ('open', 'rejected') then 'filed' else status end,
    reason = nullif($16, ''), expires_on = nullif($17, '')::date, status_at = now()
  where mobilisation_id = $1 and code = $2 and status not in ('ok', 'not_ok', 'na')  -- never overwrite the engineer's decision
  returning code
), a as (
  insert into audit_log (actor, action, entity, entity_id, detail)
  select case when $9 like 'ai%' then 'ai' else 'contact:' || $14 end, 'file_evidence', 'line', $2, json_build_object('evidence', (select id from e), 'method', $9, 'paper', $15)
), q as (
  -- a paper whose checks need something that was not printed or not read: a person decides
  insert into review_queue (mobilisation_id, message_id, evidence_id, reason)
  select $1, $3, (select id from e), 'Paper needs a person: ' || coalesce(nullif($16, ''), 'check it') where $15 = 'review'
)
select (select id from e) as evidence_id, (select code from l) as line_updated;`,
  review: `insert into review_queue (mobilisation_id, message_id, reason, options) values ($1, $2, $3, $4::jsonb) returning id as review_id;`,
  release: `update outbound set released_at = now()
where contact_id = $1 and held_body is not null and released_at is null and sent_at > now() - interval '7 days'
returning contact_id, mobilisation_id, kind, coalesce(area, '') as area, coalesce(line_code, '') as line_code, coalesce(ref, '') as ref, held_body as request;`,
  queueReply: `insert into reply_queue (mobilisation_id, contact_id, fragment) values ($1, $2, $3::jsonb) returning id;`,
  done: `update messages set state = 'done', state_at = now() where id = $1 returning id;`,
  needsHuman: `update messages set state = 'needs_human', state_at = now(), error = $2 where id = $1 returning id;`,
}

// ---------------------------------------------------------------- shared Code-node functions

// One line for the reply: accepted / sent back (with why) / filed. Used by WF-02 and WF-10.
function makeFragment(input) {
  const p = input.paper || {}
  const line = (input.binding && input.binding.line) || (typeof input.line === 'string' ? input.line : (input.line || {}).code)
  const kind = p.status === 'accepted' ? 'accepted' : p.status === 'rejected' ? 'rejected' : p.status === 'review' ? 'review' : 'filed'
  const reason = (p.checks || []).filter((c) => c.result !== 'pass').map((c) => c.note).join('; ')
  return { ...input, saved_line: line, fragment: { kind, line, reason, photo: (input.message || {}).type === 'image' } }
}

// Sticker codes: <site>.<area>.<n>.<HMAC>, signed with the walk secret, so a code cannot be
// made up and a sticker from another site is refused.
const STICKER_OK = `const __sp = String(input.body && input.body.spot || '').split('.');
const __sw = require('crypto').createHmac('sha256', $env.VERA_WALK_SECRET || '').update('spot.' + __sp.slice(0, 3).join('.')).digest('base64url').slice(0, 22);
input.spot_area = __sp.length === 4 && (__sp[3] || '').length === __sw.length && require('crypto').timingSafeEqual(Buffer.from(__sp[3]), Buffer.from(__sw)) && Number(__sp[0]) === Number(input.mobilisation_id) ? __sp[1] : '';`

const SPOT_CHECK = `// Why Code: verifies the sticker's signature (HMAC) with the walk secret.
const crypto = require('crypto');
const item = $input.item;
const code = String((item.json.body || {}).code || '');
const parts = code.split('.');
const want = crypto.createHmac('sha256', $env.VERA_WALK_SECRET || '').update('spot.' + parts.slice(0, 3).join('.')).digest('base64url').slice(0, 22);
const sig = parts[3] || '';
const ok = parts.length === 4 && /^\\d+$/.test(parts[0]) && /^[A-Z]{2,3}$/.test(parts[1]) && /^\\d{1,2}$/.test(parts[2]) && sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
return { json: { ...item.json, spot_ok: ok, spot: ok ? { mobilisation_id: Number(parts[0]), area: parts[1], sticker: Number(parts[2]) } : null } };`

const STICKER_SIGN = `// Why Code: signs one code per sticker (HMAC with the walk secret).
const crypto = require('crypto');
const item = $input.item;
const per = Math.max(1, Math.min(20, Number(($('Check walk link ').item.json.body || {}).per_area) || 4));
const sign = (s) => crypto.createHmac('sha256', $env.VERA_WALK_SECRET || '').update('spot.' + s).digest('base64url').slice(0, 22);
const stickers = [];
for (const a of item.json.areas || []) for (let n = 1; n <= per; n++) { const s = item.json.mobilisation_id + '.' + a + '.' + n; stickers.push({ area: a, n, code: s + '.' + sign(s) }); }
return { json: { project: item.json.project, stickers } };`

const CLAUDE_HEADERS = { 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01', 'content-type': 'application/json' }

// ---------------------------------------------------------------- the workflows

export const workflows = [
  // ------------------------------------------------------------------ WF-01
  wf(IDS.inbound, 'Vera 05 · 01 WhatsApp in (router)',
    'The one door for WhatsApp. Checks the message is really from Meta, stores it before anything else, answers Meta at once, drops duplicates, and hands each message to WF-02.',
    (w) => w.add(
      hook('WhatsApp verify (GET)', 'GET', 'vera/mob/wa', at(0, 0), 'Meta checks the webhook URL once, when it is set up.', { guard: ['auth'] }),
      iff('Verify token right?', "={{ $json.query['hub.mode'] === 'subscribe' && $json.query['hub.verify_token'] === $env.VERA_WA_VERIFY_TOKEN }}", at(1, 0), 'Only our own token passes.', { guard: ['auth'] }),
      respond('Echo challenge', 200, "={{ $('WhatsApp verify (GET)').item.json.query['hub.challenge'] }}", at(2, -0.5), 'Meta gets its challenge back.'),
      respond('Reject verify', 403, 'forbidden', at(2, 0.5), 'Wrong token: refused.'),

      hook('WhatsApp events (POST)', 'POST', 'vera/mob/wa', at(0, 2), 'Every message and delivery status from Meta arrives here.', { raw: true }),
      snippet('Check Meta signature', SIG, at(1, 2), 'HMAC of the raw body with the app secret. Anything not signed by Meta stops here.', { guard: ['auth', 'error-out'], mode: 'all', onError: true }),
      iff('Signed by Meta?', '={{ $json.ok }}', at(2, 2), 'Pass or refuse.'),
      respond('Reject unsigned', 401, '={{ { "error": "unauthorized" } }}', at(3, 3), 'Not from Meta: 401, nothing stored.'),
      pg('Save raw to inbox', SQL.inbox, '={{ $json.body_sha }},={{ JSON.stringify($json.body) }}', at(3, 2), 'The raw body is written first. If anything later breaks, it can be replayed.', { guard: ['retry', 'idempotent', 'error-out', 'audit'], onError: true }),
      respond('Tell Meta: try again', 500, '={{ { "error": "storage_unavailable" } }}', at(4, 3.2), 'Database down: Meta gets a 500 and redelivers later. Nothing is lost.'),
      respond('Tell Meta: received', 200, '={{ { "ok": true } }}', at(4, 2), 'Meta gets 200 within a second. Work continues after this.', { guard: ['timeout'] }),
      code('Split into events', L.explodeEvents, at(5, 2), 'One item per message and per delivery status.', { mode: 'all' }),
      sw('Message or status?', '={{ $json.kind }}', ['message', 'status'], at(6, 2), 'Statuses update what we sent; messages get processed.'),
      pg('Update delivery status', SQL.status, "={{ $json.wamid }},={{ $json.status }},={{ JSON.stringify($json.errors) }}", at(7, 3.2), 'Sent / delivered / read / failed, on our outbound log.', { guard: ['retry'], alwaysOutput: true }),
      iff('Send failed?', "={{ $json.status === 'failed' && $json.kind !== 'review' }}", at(8, 3.2), 'A failed send must not go unnoticed. (A failed send to a reviewer is only logged, so it cannot loop.)'),
      pg('Flag failed send', `insert into review_queue (mobilisation_id, reason, options) values ($1, 'WhatsApp could not deliver: ' || $2, '[]'::jsonb) returning id;`, "={{ $json.mobilisation_id }},={{ JSON.stringify($json.error) }}", at(9, 3.2), 'Goes to the review queue with the error code.', { guard: ['human'] }),
      noop('Nothing to do', at(7, 4.4), 'Empty or unknown event.'),
      pg('Claim message', SQL.claim, "={{ $json.wamid }},={{ $json.inbox_id }},={{ $json.type }},={{ JSON.stringify($json) }}", at(7, 2), 'Insert by WhatsApp message id. Meta can send the same message twice; the second one gets id 0.', { guard: ['dedupe', 'retry'] }),
      iff('First time we see it?', '={{ $json.message_id > 0 }}', at(8, 2), 'Duplicates stop here.'),
      noop('Duplicate: ignore', at(9, 1), 'Already processed.'),
      pg('Who sent it?', SQL.sender, "={{ $('Split into events').item.json.from }},={{ $json.message_id }}", at(9, 2), 'Phone number → contact, role, site. Also restarts the 24-hour window.', { guard: ['window'], alwaysOutput: true }),
      iff('Known person?', "={{ !!$json.contact_id }}", at(10, 2), 'Only registered contractor, engineer and reviewer numbers are processed.', { guard: ['auth'] }),
      pg('Log unknown number', `update messages set state = 'done', error = 'unknown sender' where id = $1 returning id;`, '={{ $json.message_id }}', at(11, 3), 'Nothing is read from unknown numbers. Vera ops sees the count daily.', { guard: ['audit'] }),
      sub('Process the message', IDS.process, { message_id: '={{ $json.message_id }}' }, at(11, 2), 'Hands over to WF-02 and does not wait, so the router stays fast.'),
    )
      .link('WhatsApp verify (GET)', 'Verify token right?').link('Verify token right?', 'Echo challenge', 'true').link('Verify token right?', 'Reject verify', 'false')
      .link('WhatsApp events (POST)', 'Check Meta signature').link('Check Meta signature', 'Signed by Meta?').link('Check Meta signature', 'Tell Meta: try again', 'error')
      .link('Signed by Meta?', 'Save raw to inbox', 'true').link('Signed by Meta?', 'Reject unsigned', 'false')
      .link('Save raw to inbox', 'Tell Meta: received').link('Save raw to inbox', 'Tell Meta: try again', 'error')
      .link('Tell Meta: received', 'Split into events').link('Split into events', 'Message or status?')
      .link('Message or status?', 'Claim message', 'message').link('Message or status?', 'Update delivery status', 'status').link('Message or status?', 'Nothing to do', 'Other')
      .link('Update delivery status', 'Send failed?').link('Send failed?', 'Flag failed send', 'true')
      .link('Claim message', 'First time we see it?').link('First time we see it?', 'Who sent it?', 'true').link('First time we see it?', 'Duplicate: ignore', 'false')
      .link('Who sent it?', 'Known person?').link('Known person?', 'Process the message', 'true').link('Known person?', 'Log unknown number', 'false')),

  // ------------------------------------------------------------------ WF-02
  wf(IDS.process, 'Vera 05 · 02 Process one message',
    'Files one photo, paper, voice note or text against the right checklist line. Deterministic binding first; AI only picks from open lines; unsure answers go back to the sender as buttons or to a person.',
    (w) => w.add(
      trigger('From the router', { message_id: 'number' }, at(0, 2), 'Gets one message id from WF-01.'),
      pg('Load and lock message', SQL.load, '={{ $json.message_id }}', at(1, 2), 'Message, sender, site, open lines, our recent prompts. Marked "processing" so a stuck one is found later.', { guard: ['idempotent', 'retry'] }),
      sw('What kind of message?', '={{ ["interactive","button"].includes($json.message.type) ? "interactive" : $json.contact_role === "reviewer" ? "text" : ["image","document","audio","video"].includes($json.message.type) ? "media" : $json.message.type }}', ['media', 'text', 'interactive', 'location'], at(2, 2), 'Photo / PDF / voice, typed text, a button answer, or a location pin.'),

      // media lane
      http('Get media link', { method: 'GET', url: `=${GRAPH}/{{ $json.message.media_id }}`, auth: 'wa' }, at(3, 0), 'Meta gives a download link valid for 5 minutes.', { guard: ['retry', 'error-out', 'timeout'], onError: true }),
      http('Download the file', { method: 'GET', url: '={{ $json.url }}', auth: 'wa', file: true, timeout: 60000 }, at(4, 0), 'Downloaded at once, before the link expires.', { guard: ['retry', 'error-out', 'timeout'], onError: true }),
      snippet('Hash and size check', HASH, at(5, 0), 'SHA-256 of the file. Same file already used on another line, or too large: stopped.', { guard: ['dedupe', 'schema'] }),
      iff('File OK?', '={{ $json.file_ok }}', at(6, 0), 'Reused or oversized files do not get filed.'),
      code('Explain file problem', (input) => ({ ...input, request: { body: { type: 'text', text: { body: input.file.reused_from ? 'This exact file was already sent for ' + input.file.reused_from + '. Please send a new photo for this line.' : 'This file is too large. Please send a smaller photo or a PDF under 25 MB.' } } } }), at(7, -1), 'Tells the sender why, in one line.'),
      send('Send file problem', at(8, -1), 'Through WF-09.', { kind: 'reply' }),
      iff('Voice note?', "={{ $json.message.type === 'audio' }}", at(7, -1.6), 'Voice is typed out first, so a spoken line code ("LC teen") can bind it.'),
      http('Transcribe voice (Sarvam)', { url: SARVAM, auth: 'sarvam', form: [{ parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }, { name: 'model', value: 'saaras:v3' }, { name: 'mode', value: 'transcribe' }, { name: 'language_code', value: 'unknown' }], timeout: 90000 }, at(8, -2.4), 'Hindi / Marathi / Hinglish → text in its own script. English comes in the report.', { guard: ['retry', 'error-out', 'timeout'], onError: true }),
      snippet('Add transcript', `// Why Code: puts the transcript on the message and keeps the audio file on the item.
const ctx = $('Hash and size check').item;
const r = $input.item.json;
const t = r && r.transcript ? String(r.transcript) : '';
const message = { ...ctx.json.message, text: t, transcript_lang: (r && r.language_code) || '' };
return { json: { ...ctx.json, message, transcript: t || '[voice note: transcription failed, listen in Vera]', transcript_lang: message.transcript_lang }, binary: ctx.binary };`, at(9, -2.4), 'If transcription failed, the audio is still filed and the report says "listen".'),
      n('Store in evidence bucket', 's3', { resource: 'file', operation: 'upload', bucketName: '={{ $env.VERA_S3_BUCKET }}', fileName: '={{ $json.s3_key }}', binaryData: true, binaryPropertyName: 'data', additionalFields: {} }, at(10, -1), 'Encrypted bucket in Mumbai (ap-south-1). Key = hash, so the same file is stored once.', { creds: CREDS.s3, retry: true, guard: ['retry', 'idempotent', 'error-out'], onError: true }),
      n('Keep file after upload', 'merge', { mode: 'chooseBranch', chooseBranchMode: 'waitForAll', output: 'specifiedInput', useDataOfInput: 1 }, at(11, -0.2), 'Waits for the upload, then carries the original item (with the file) on. Upload failed = never reaches here.', { inputs: 2 }),
      code('Bind to checklist line', L.bindLine, at(12, -0.2), 'Reply-to-line, code in caption, reply-to-area + number, picked from list. Only if none: AI.', { assign: 'binding', guard: ['schema'] }),
      sw('How was it bound?', '={{ $json.binding.line ? "bound" : $json.binding.needsAi ? "ai" : "ask" }}', ['bound', 'ai', 'ask'], at(13, -0.2), 'Bound for sure / AI must choose / ask the sender.'),
      code('Build classify request', L.buildClassifyRequest, at(14, 1), 'Photo, PDF or voice transcript + the short list of open lines. The answer schema only allows those codes or NONE.', { media: true, guard: ['schema'] }),
      http('Claude: which line?', { url: CLAUDE, auth: 'claude', headers: { 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01', 'content-type': 'application/json' }, json: '={{ JSON.stringify($json.request) }}', timeout: 90000 }, at(15, 1), 'AI chooses a line and gives an honest confidence. It never says whether the site is OK.', { guard: ['retry', 'error-out', 'timeout', 'schema'], onError: true }),
      code('Confidence gate', L.gateMatch, at(16, 1), '≥ 0.90 with a 0.30 lead: file it. 0.45–0.90: ask the sender. Unreadable, suspicious, refused or malformed: a person. Shadow mode (first sites): never files on its own.', { guard: ['human', 'schema'], pre: "input = { ...$('Build classify request').item.json, request: undefined, ai: $input.item.json }; if (input.mob && input.mob.flags && input.mob.flags.shadow) input.thresholds = { auto: 2 };" }),
      sw('Sure enough?', '={{ $json.decision }}', ['auto', 'confirm', 'human'], at(17, 1), 'File it / ask the sender / a person.', { guard: ['human'] }),
      pg('Save as unfiled evidence', `insert into evidence (mobilisation_id, line_code, message_id, kind, s3_key, sha256, mime, bytes, bind_method, ai, transcript, transcript_lang, created_by)
values ($1, null, $2, $3, $4, $5, $6, $7, 'ai', $8::jsonb, nullif($9, ''), nullif($10, ''), $11) returning id as evidence_id;`,
        "={{ $json.mobilisation_id }},={{ $json.message_id }},={{ $json.message.type === 'document' ? 'document' : $json.message.type === 'audio' ? 'audio' : 'photo' }},={{ $json.s3_key }},={{ $json.file.sha256 }},={{ $json.file.mime }},={{ $json.file.bytes }},={{ JSON.stringify($json.ai_answer || null) }},={{ $json.transcript || '' }},={{ $json.transcript_lang || '' }},={{ $json.contact_id }}",
        at(18, 2.1), 'The file is kept, with no line yet, so the button answer has something to file.', { guard: ['audit', 'retry'] }),
      code('Build confirm buttons', L.buildConfirm, at(19, 2.1), 'Top 3 lines as one-tap buttons, plus "Something else".', { pre: "input = { ...$('Save as unfiled evidence').item.json, ...input }; input = { ...input, ...($('Confidence gate').isExecuted ? $('Confidence gate').item.json : $('Bind to checklist line').item.json), evidence_id: $input.item.json.evidence_id, wamid: ($('Load and lock message').item.json.message || {}).wamid }; input.options = input.options && input.options.length ? input.options : ((input.binding && input.binding.ask && input.binding.candidates) || []);" }),
      send('Ask sender to confirm', at(20, 2.1), 'The answer comes back as a button reply and is applied in one transaction.', { kind: 'confirm', ref: "={{ String($json.message_id) }}" }),
      pg('Send to review queue', SQL.review, "={{ $('Load and lock message').item.json.mobilisation_id }},={{ $('Load and lock message').item.json.message_id }},={{ $json.reason || ($json.error && $json.error.message) || 'Could not process automatically' }},={{ JSON.stringify($json.options || []) }}", at(18, 3.3), 'A person files it, usually within the hour. The sender is told it is being checked.', { guard: ['human', 'audit'] }),
      pg('Mark needs a person', SQL.needsHuman, "={{ $('Load and lock message').item.json.message_id }},={{ ($json.error && $json.error.message) || $json.reason || 'step failed' }}", at(19, 3.3), 'Any failed step lands here: download, storage, AI. The message is never dropped.', { guard: ['human', 'error-out'] }),
      iff('Is it a paper line?', "={{ ['document','both'].includes((($json.lines || []).find(l => l.code === ($json.binding.line || $json.line)) || {}).evidence) && $json.message.type !== 'audio' }}", at(18, -0.2), 'Papers get read and checked; site photos wait for the engineer.'),
      code('Build extract request', L.buildExtractRequest, at(19, -1.4), 'Asks AI to copy the fields exactly. Null when not printed: never a guess.', { media: true, guard: ['schema'], pre: "input.line = (input.lines || []).find((l) => l.code === (input.binding.line || input.line));" }),
      http('Claude: read the paper', { url: CLAUDE, auth: 'claude', headers: { 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01', 'content-type': 'application/json' }, json: '={{ JSON.stringify($json.request) }}', timeout: 120000 }, at(20, -1.4), 'Name, address, dates, workers covered, sum insured…', { guard: ['retry', 'error-out', 'timeout'], onError: true }),
      snippet('Parse the fields', PARSE_FIELDS, at(21, -1.4), 'Anything that is not a clean answer counts as unread.', { guard: ['schema'] }),
      code('Check paper rules', L.checkPaper, at(22, -1.4), 'Plain code: valid on start? covers peak labour? sum insured ≥ contract? Each check says why.', { guard: ['audit'], pre: "input.mob = input.mob || {}; input.params = " + JSON.stringify(PARAMS) + ";" }),
      code('Make reply fragment', makeFragment, at(23, -0.2), 'One line for the reply: accepted / sent back (with why) / filed.'),
      pg('Save evidence and line', SQL.saveEvidence,
        "={{ $json.mobilisation_id }},={{ $json.saved_line }},={{ $json.message_id }},={{ $json.message.type === 'document' ? 'document' : $json.message.type === 'audio' ? 'audio' : 'photo' }},={{ $json.s3_key }},={{ $json.file.sha256 }},={{ $json.file.mime }},={{ $json.file.bytes }},={{ $json.binding.line ? $json.binding.method : 'ai-auto' }},={{ $json.binding.line ? 1 : $json.confidence }},={{ JSON.stringify($json.ai_answer || null) }},={{ JSON.stringify($json.fields || null) }},={{ JSON.stringify(($json.paper || {}).checks || null) }},={{ $json.contact_id }},={{ ($json.paper || {}).status || 'filed' }},={{ $json.fragment.reason }},={{ ($json.paper || {}).expires_on || '' }},={{ $json.transcript || '' }},={{ $json.transcript_lang || '' }}",
        at(24, -0.2), 'Evidence row + line status + audit entry, in one statement. Never overwrites the engineer\'s own decision.', { guard: ['audit', 'retry'] }),
      pg('Queue the reply', SQL.queueReply, "={{ $('Make reply fragment').item.json.mobilisation_id }},={{ $('Make reply fragment').item.json.contact_id }},={{ JSON.stringify($('Make reply fragment').item.json.fragment) }}", at(25, -0.2), 'WF-05 sends one reply per burst, not one per photo.', { guard: ['retry'] }),
      pg('Mark done', SQL.done, "={{ $('Load and lock message').item.json.message_id }}", at(28, -0.2), 'Finished.'),
      iff('Closes an open item?', "={{ !!($('Make reply fragment').item.json.binding || {}).open_item }}", at(26, -0.2), 'Sent as a reply to an open-item reminder.'),
      pg('Propose closure', `with o as (
  update open_items set status = 'proposed_closed', closed_evidence_id = $2 where id = $1::bigint and status = 'open' and mobilisation_id = $3
  returning id, mobilisation_id, line_code, text, finding
) select o.id as open_item_id, o.mobilisation_id, o.line_code, o.text, o.finding, $2::bigint as evidence_id,
  (select id from contacts where mobilisation_id = o.mobilisation_id and role = 'engineer' limit 1) as contact_id,
  (select project from mobilisations where id = o.mobilisation_id) as project from o;`,
        "={{ $('Make reply fragment').item.json.binding.open_item }},={{ $('Save evidence and line').item.json.evidence_id }},={{ $('Make reply fragment').item.json.mobilisation_id }}",
        at(27, -1.2), 'Item marked "proposed closed" with this photo. Only items of the sender\'s own site.', { guard: ['audit', 'idempotent'], alwaysOutput: true }),
      iff('Waiting for the engineer?', '={{ !!$json.open_item_id }}', at(28, -1.2), 'Already proposed or closed: nothing more to ask.'),
      code('Build closure ask', L.buildClosureAsk, at(29, -1.6), 'Photo + "Accept, close it" / "Not fixed".'),
      sub('Ask engineer to close', IDS.show, { contact_id: '={{ $json.contact_id }}', mobilisation_id: '={{ $json.mobilisation_id }}', kind: 'close', ref: '={{ String($json.open_item_id) }}', evidence_id: '={{ $json.evidence_id }}', msg: '={{ $json.msg }}' }, at(30, -1.6), 'WF-11 sends the photo with the buttons. His tap closes the item and the line.', { guard: ['human'] }),

      // text lane
      code('Read typed text', L.readTextCommand, at(3, 4), '"status", "baki kya hai", "LC-10 NA creche not needed", or a remark.'),
      sw('Which command?', '={{ $json.command }}', ['gap_list', 'help', 'request_na', 'remark'], at(4, 4), 'Small, fixed set of commands. Anything else is a remark.'),
      sub('Send the gap list now', IDS.gaps, { mobilisation_id: '={{ $json.mobilisation_id }}' }, at(5, 3.4), 'Same list as 7 PM, on demand.'),
      code('Build help text', (input) => ({
        ...input,
        request: { body: { type: 'text', text: { body: input.help === 'reviewer'
          ? 'Review items come here as messages with buttons. Answer with the buttons; typed messages are not filed.'
          : input.help === 'unknown_line'
            ? input.line + ' is not on this site\'s checklist. Send *status* to see the line codes.'
            : 'Send photos or PDFs as a *reply* to the area message, with the line number in the caption (e.g. 3). Send *status* to see what is still needed. Voice notes are fine.' } } },
      }), at(5, 4.4), 'Two lines of help (reviewers and unknown line codes get their own line).'),
      send('Send help', at(6, 4.4), 'Through WF-09.', { kind: 'help' }),
      code('Build N/A request', (input) => ({ ...input, request: { summary: 'a not-applicable request', body: { type: 'interactive', interactive: { type: 'button', body: { text: 'Contractor asks to mark ' + input.line + ' as not applicable: "' + (input.reason || 'no reason given') + '". Approve?' }, action: { buttons: [{ type: 'reply', reply: { id: 'na:' + input.line + ':approve', title: 'Approve N/A' } }, { type: 'reply', reply: { id: 'na:' + input.line + ':reject', title: 'Reject' } }] } } } } }), at(5, 5.4), 'Only the engineer can mark a line N/A.', { guard: ['human'] }),
      send('Ask engineer about N/A', at(6, 5.4), 'Engineer decides with one tap. The contractor hears the answer.', { kind: 'confirm', contact: '={{ $json.engineer_contact_id }}', line: '={{ $json.line }}' }, { guard: ['human'] }),
      pg('Save remark', `insert into evidence (mobilisation_id, line_code, message_id, kind, transcript, bind_method, created_by) values ($1, null, $2, 'remark', $3, 'text', $4) returning id;`, '={{ $json.mobilisation_id }},={{ $json.message_id }},={{ $json.message.text }},={{ $json.contact_id }}', at(5, 6.4), 'Kept against the site; shown to the engineer.', { guard: ['audit'] }),

      // interactive lane
      code('Read button answer', L.parseAnswer, at(3, 7.4), 'The button id says what it is: bind / pick / na / close / sign. Role checked: only the engineer can sign.', { guard: ['auth'] }),
      iff('Allowed?', '={{ $json.answer.ok }}', at(4, 7.4), 'Wrong role or unknown button: refused.'),
      iff('"Show me" tapped?', "={{ $json.answer.verb === 'show' }}", at(5, 7.4), 'The generic template\'s button: send what was held while their 24-hour window was closed.', { guard: ['window'] }),
      pg('Release held messages', SQL.release, '={{ $json.contact_id }}', at(6, 6.8), 'Everything held for this person in the last 7 days, once.', { guard: ['idempotent', 'window'], alwaysOutput: true }),
      iff('Anything held?', '={{ !!$json.request }}', at(7, 6.8), 'Nothing held: nothing to send.'),
      send('Send held message', at(8, 6.6), 'Now inside the window, so the real message (buttons, photo, PDF) goes out.', { kind: '={{ $json.kind }}', area: '={{ $json.area }}', line: '={{ $json.line_code }}', ref: '={{ $json.ref }}' }),
      pg('Apply answer', `select apply_answer($1::jsonb) as result;`, "={{ JSON.stringify({ ...$json.answer, wamid: $json.message.wamid }) }}", at(6, 8), 'One database transaction, with an audit entry. Checks the person belongs to the site the button is about.', { guard: ['audit', 'idempotent', 'auth'] }),
      iff('Paper to re-read?', '={{ !!($json.result && $json.result.reread) }}', at(7, 8), 'A paper filed by a button has not been read yet.'),
      sub('Re-read the paper', IDS.readPaper, { evidence_id: '={{ $json.result.evidence_id }}' }, at(8, 7.8), 'WF-10 reads it and runs the paper checks, as if it had been bound at once.'),

      // location lane
      pg('Save location pin', `insert into zones (mobilisation_id, area, name, shape, source)
select $1, o.area, o.area || ' (pin from contractor)', json_build_object('circle', json_build_object('lat', $2::float, 'lng', $3::float, 'radius_m', 30)), 'contractor_pin'
from outbound o where o.wamid = $4 and o.kind = 'area' returning id;`, "={{ $json.mobilisation_id }},={{ $json.message.location.lat }},={{ $json.message.location.lng }},={{ $json.message.context_wamid }}", at(3, 8.6), 'A pin sent as a reply to an area prompt becomes a 30 m circle for that area. The engineer can redraw it.', { alwaysOutput: true }),

      code('Build "what we accept"', (input) => ({ ...input, request: { body: { type: 'text', text: { body: 'Please send a photo, a PDF or a voice note. Videos and stickers are not filed.' } } } }), at(3, 9.8), 'Unsupported types get a polite line, not silence.'),
      send('Send "what we accept"', at(4, 9.8), 'Through WF-09.', { kind: 'help' }),
    )
      .link('From the router', 'Load and lock message').link('Load and lock message', 'What kind of message?')
      .link('What kind of message?', 'Get media link', 'media').link('What kind of message?', 'Read typed text', 'text')
      .link('What kind of message?', 'Read button answer', 'interactive').link('What kind of message?', 'Save location pin', 'location').link('What kind of message?', 'Build "what we accept"', 'Other')
      .link('Get media link', 'Download the file').link('Get media link', 'Send to review queue', 'error')
      .link('Download the file', 'Hash and size check').link('Download the file', 'Send to review queue', 'error')
      .link('Hash and size check', 'File OK?').link('File OK?', 'Voice note?', 'true').link('File OK?', 'Explain file problem', 'false').link('Explain file problem', 'Send file problem')
      .link('Voice note?', 'Transcribe voice (Sarvam)', 'true').link('Voice note?', 'Store in evidence bucket', 'false').link('Voice note?', 'Keep file after upload', 'false')
      .link('Transcribe voice (Sarvam)', 'Add transcript').link('Transcribe voice (Sarvam)', 'Add transcript', 'error')
      .link('Add transcript', 'Store in evidence bucket').link('Add transcript', 'Keep file after upload')
      .link('Store in evidence bucket', 'Keep file after upload', 'in2').link('Store in evidence bucket', 'Send to review queue', 'error')
      .link('Keep file after upload', 'Bind to checklist line').link('Bind to checklist line', 'How was it bound?')
      .link('How was it bound?', 'Is it a paper line?', 'bound').link('How was it bound?', 'Build classify request', 'ai').link('How was it bound?', 'Save as unfiled evidence', 'ask').link('How was it bound?', 'Send to review queue', 'Other')
      .link('Build classify request', 'Claude: which line?').link('Claude: which line?', 'Confidence gate').link('Claude: which line?', 'Send to review queue', 'error')
      .link('Confidence gate', 'Sure enough?')
      .link('Sure enough?', 'Is it a paper line?', 'auto').link('Sure enough?', 'Save as unfiled evidence', 'confirm').link('Sure enough?', 'Send to review queue', 'human').link('Sure enough?', 'Send to review queue', 'Other')
      .link('Save as unfiled evidence', 'Build confirm buttons').link('Build confirm buttons', 'Ask sender to confirm')
      .link('Is it a paper line?', 'Build extract request', 'true').link('Is it a paper line?', 'Make reply fragment', 'false')
      .link('Build extract request', 'Claude: read the paper').link('Claude: read the paper', 'Parse the fields').link('Claude: read the paper', 'Send to review queue', 'error')
      .link('Parse the fields', 'Check paper rules').link('Check paper rules', 'Make reply fragment')
      .link('Make reply fragment', 'Save evidence and line').link('Save evidence and line', 'Queue the reply').link('Queue the reply', 'Closes an open item?')
      .link('Closes an open item?', 'Propose closure', 'true').link('Closes an open item?', 'Mark done', 'false')
      .link('Propose closure', 'Waiting for the engineer?').link('Waiting for the engineer?', 'Build closure ask', 'true').link('Waiting for the engineer?', 'Mark done', 'false')
      .link('Build closure ask', 'Ask engineer to close').link('Ask engineer to close', 'Mark done')
      .link('Send to review queue', 'Mark needs a person')
      .link('Read typed text', 'Which command?')
      .link('Which command?', 'Send the gap list now', 'gap_list').link('Which command?', 'Build help text', 'help').link('Which command?', 'Build N/A request', 'request_na').link('Which command?', 'Save remark', 'remark').link('Which command?', 'Save remark', 'Other')
      .link('Build help text', 'Send help').link('Build N/A request', 'Ask engineer about N/A')
      .link('Send the gap list now', 'Mark done').link('Send help', 'Mark done').link('Ask engineer about N/A', 'Mark done').link('Save remark', 'Mark done')
      .link('Ask sender to confirm', 'Mark done').link('Send file problem', 'Mark done').link('Save location pin', 'Mark done').link('Send "what we accept"', 'Mark done')
      .link('Read button answer', 'Allowed?').link('Allowed?', '"Show me" tapped?', 'true').link('Allowed?', 'Build "what we accept"', 'false')
      .link('"Show me" tapped?', 'Release held messages', 'true').link('"Show me" tapped?', 'Apply answer', 'false')
      .link('Release held messages', 'Anything held?').link('Anything held?', 'Send held message', 'true').link('Anything held?', 'Mark done', 'false').link('Send held message', 'Mark done')
      .link('Apply answer', 'Paper to re-read?').link('Paper to re-read?', 'Re-read the paper', 'true').link('Paper to re-read?', 'Mark done', 'false').link('Re-read the paper', 'Mark done')
      .link('Build "what we accept"', 'Send "what we accept"')),

  // ------------------------------------------------------------------ WF-03
  wf(IDS.walk, 'Vera 05 · 03 Walk page API',
    'Back end for the engineer\'s phone page on the visit day: load the checklist, take each capture (photo + GPS + status + voice), record the GPS trail, mark areas, record QR sticker scans, print stickers, finish the walk.',
    (w) => w.add(
      hook('Walk page opens (GET)', 'GET', 'vera/mob/walk', at(0, 0), 'The page asks for this site\'s checklist.', { guard: ['auth'], cors: true }),
      snippet('Check walk link', WALK_CHECK, at(1, 0), 'Signed link, expires the day after the visit.', { onError: true, guard: ['auth', 'error-out'] }),
      iff('Link valid?', '={{ $json.walk_ok }}', at(2, 0), 'Forwarded or expired links stop here.'),
      respond('Respond 401', 401, '={{ { "error": "unauthorized", "message": "This walk link has expired. Ask Vera for a new one." } }}', at(3, 1), 'Clear message for the page.'),
      pg('Load checklist for walk', `select w.id as walk_id, mo.project, mo.visit_date, json_agg(json_build_object('code', l.code, 'area', l.area, 'text', l.text, 'severity', l.severity, 'status', l.status, 'when', l."when", 'evidence', l.evidence) order by l.code) as lines,
  (select jsonb_agg(jsonb_build_object('area', z.area, 'name', z.name) || z.shape) from zones z where z.mobilisation_id = mo.id) as zones
from walks w join mobilisations mo on mo.id = w.mobilisation_id join lines l on l.mobilisation_id = mo.id where w.id = $1 group by w.id, mo.id;`, '={{ $json.walk_id }}', at(3, 0), 'Lines, statuses, papers already accepted, and the drawn areas.', { onError: true, guard: ['error-out', 'retry'] }),
      respond('Send checklist', 200, '={{ $json }}', at(4, 0), 'The page caches it, so it works with no signal.'),

      hook('Walk page posts (POST)', 'POST', 'vera/mob/walk', at(0, 2.5), 'capture / trail / finish / zone / spot / stickers (body.action). The page retries until it gets an answer.', { guard: ['auth'], cors: true }),
      snippet('Check walk link ', WALK_CHECK, at(1, 2.5), 'Same check.', { onError: true, guard: ['auth', 'error-out'] }),
      iff('Link valid? ', '={{ $json.walk_ok }}', at(2, 2.5), 'Forwarded or expired links stop here.'),
      respond('Respond 401 ', 401, '={{ { "error": "unauthorized" } }}', at(3, 3.5), 'Page shows "ask for a new link".'),
      sw('Which action?', '={{ $json.body.action }}', ['capture', 'trail', 'finish', 'zone', 'spot', 'stickers'], at(3, 2.5), 'Six kinds of post.'),
      pg('Load walk', `select w.id as walk_id, w.mobilisation_id, w.engineer_id, (select json_agg(code) from lines where mobilisation_id = w.mobilisation_id) as visit_lines,
  (select jsonb_agg(jsonb_build_object('area', area, 'name', name) || shape) from zones where mobilisation_id = w.mobilisation_id) as zones,
  (select row_to_json(e) from evidence e where e.capture_id::text = $2) as existing
from walks w where w.id = $1;`, "={{ $json.walk_id }},={{ $json.body.capture_id || '' }}", at(4, 1.6), 'Lines, areas, and whether this capture was already saved.', { onError: true, guard: ['error-out', 'retry'] }),
      code('Validate capture', L.validateCapture, at(5, 1.6), 'UUID per capture, known line code, size limits, sane GPS, phone clock vs server clock.', { guard: ['schema', 'error-out'], onError: true, pre: "input.body = $('Check walk link ').item.json.body;" }),
      iff('Capture valid?', '={{ $json.valid }}', at(6, 1.6), 'Bad input gets a 400 with the reasons.', { guard: ['schema'] }),
      respond('Respond 400', 400, '={{ { "error": "validation_error", "details": $json.errors } }}', at(7, 2.6), 'The page shows the reason and keeps the capture.'),
      iff('Already saved?', '={{ !!$json.existing }}', at(7, 1.6), 'Same capture_id = a retry from a weak network. Answer as before, save nothing twice.', { guard: ['idempotent'] }),
      respond('Respond saved (again)', 200, '={{ { "ok": true, "duplicate": true, "geo": $json.existing.geo_check } }}', at(8, 0.6), 'Idempotent answer.'),
      code('Place on site map', L.geofence, at(8, 1.6), 'Phone fix (with its own ± metres) against the area drawn for this line: in / edge / out / unknown. A sticker of this area scanned just before counts as in. Never blocks the capture.', { onError: true, pre: "input.gps = input.body.gps; input.line_area = String(input.body.line || '').split('-')[0]; input.params = " + JSON.stringify(PARAMS.geofence) + ';\n' + STICKER_OK }),
      snippet('Photo to file', PHOTO_FILE, at(9, 1.6), 'Base64 from the page → a file.', { onError: true, guard: ['error-out'] }),
      n('Store walk photo', 's3', { resource: 'file', operation: 'upload', bucketName: '={{ $env.VERA_S3_BUCKET }}', fileName: '={{ $json.s3_key }}', binaryData: true, binaryPropertyName: 'data', additionalFields: {} }, at(10, 1.6), 'Same bucket as WhatsApp evidence.', { creds: CREDS.s3, retry: true, guard: ['retry', 'error-out'], onError: true }),
      respond('Respond: try again', 503, '={{ { "error": "service_unavailable", "message": "Saved on the phone. Will retry." } }}', at(11, 2.6), 'Storage down: the page keeps the capture and retries.'),
      pg('Save capture and line', `with e as (
  insert into evidence (mobilisation_id, line_code, capture_id, kind, s3_key, mime, gps, geo_check, bind_method, bind_confidence, transcript, created_by)
  values ($1, $2, $3::uuid, 'photo', $4, 'image/jpeg', $5::jsonb, $6::jsonb, 'walk-line', 1, nullif($7, ''), $8)
  on conflict (capture_id) do nothing returning id
) update lines set status = case when $9 = 'photo' then status else $9 end, remark = coalesce(nullif($7, ''), remark), status_by = $8, status_at = now()
  where mobilisation_id = $1 and code = $2 returning code, status;`,
      "={{ $('Photo to file').item.json.mobilisation_id }},={{ $('Photo to file').item.json.body.line }},={{ $('Photo to file').item.json.body.capture_id }},={{ $('Photo to file').item.json.s3_key }},={{ JSON.stringify($('Photo to file').item.json.body.gps || null) }},={{ JSON.stringify($('Photo to file').item.json.geo) }},={{ $('Photo to file').item.json.body.remark || '' }},={{ $('Photo to file').item.json.engineer_id }},={{ $('Photo to file').item.json.body.status }}",
      at(11, 1.6), 'The line was chosen before the shutter: binding is certain. Status is the engineer\'s own.', { onError: true, guard: ['error-out', 'idempotent', 'audit', 'retry'] }),
      respond('Respond saved', 200, "={{ { ok: true, line: $json.code, status: $json.status, geo: $('Place on site map').item.json.geo } }}", at(12, 1.6), 'The page shows "inside Labour camp" or "38 m outside: are you in the right area?"'),
      iff('Voice remark attached?', "={{ !!$('Photo to file').item.json.body.audio_b64 }}", at(13, 1.6), 'Voice is transcribed after the page has its answer.'),
      code('Voice to file', (input) => input, at(14, 1.1), 'Base64 → audio file.', { src: `const item = $input.item;\nconst b = $('Photo to file').item.json.body;\nreturn { json: { capture_id: b.capture_id }, binary: { data: { data: b.audio_b64, mimeType: b.audio_mime || 'audio/webm', fileName: b.capture_id + '.webm', fileExtension: 'webm' } } };` }),
      http('Transcribe remark', { url: SARVAM, auth: 'sarvam', form: [{ parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }, { name: 'model', value: 'saaras:v3' }, { name: 'mode', value: 'transcribe' }, { name: 'language_code', value: 'unknown' }], timeout: 90000 }, at(15, 1.1), 'Original words kept; English comes in the report.', { guard: ['retry', 'error-out'], onError: true }),
      pg('Save remark transcript', `update evidence set transcript = coalesce(transcript || ' ', '') || $2, transcript_lang = $3 where capture_id = $1::uuid returning id;`, "={{ $('Voice to file').item.json.capture_id }},={{ $json.transcript || '[voice remark: transcription failed, listen in Vera]' }},={{ $json.language_code || '' }}", at(16, 1.1), 'If transcription failed, the report says so.', { guard: ['retry'] }),

      pg('Save trail points', `insert into trail (walk_id, ts, lat, lng, accuracy)
select $1, (p->>'ts')::timestamptz, (p->>'lat')::float, (p->>'lng')::float, (p->>'accuracy')::real from json_array_elements($2::json) p
on conflict do nothing returning 1;`, "={{ $json.walk_id }},={{ JSON.stringify(($json.body.points || []).slice(0, 500)) }}", at(4, 3.4), 'Batches of GPS points every 20 s while the page is open. Duplicates ignored.', { onError: true, guard: ['error-out', 'idempotent', 'retry'], alwaysOutput: true }),
      respond('Respond 204', 204, null, at(5, 3.4), 'No body.'),
      pg('Mark walk finished', `update walks set finished_at = coalesce(finished_at, now()) where id = $1 returning mobilisation_id;`, '={{ $json.walk_id }}', at(4, 4.6), 'Once only.', { onError: true, guard: ['error-out', 'idempotent'] }),
      respond('Respond 202', 202, '={{ { "ok": true, "message": "Report is being drafted. It will come on WhatsApp." } }}', at(5, 4.6), 'The page can close.'),
      sub('Draft the NOC report', IDS.noc, { mobilisation_id: '={{ $json.mobilisation_id }}' }, at(6, 4.6), 'WF-06 runs in the background.'),

      // mark an area: standing in it (circle) or walking its corners (polygon)
      pg('Areas for marking', `select w.id as walk_id, w.mobilisation_id, (select json_agg(distinct area) from lines where mobilisation_id = w.mobilisation_id) as areas from walks w where w.id = $1;`, '={{ $json.walk_id }}', at(4, 5.8), 'Which areas this site has.', { onError: true, guard: ['error-out', 'retry'] }),
      code('Check the area shape', L.validateZone, at(5, 5.8), 'Known area, 3–30 corners or a 5–150 m circle, GPS ±30 m or better, a sane size.', { guard: ['schema'], onError: true, pre: "input.body = $('Check walk link ').item.json.body;" }),
      iff('Shape OK?', '={{ $json.valid }}', at(6, 5.8), 'Bad shapes get a 400 with the reasons.', { guard: ['schema'] }),
      pg('Save area shape', `with w as (select mobilisation_id, engineer_id from walks where id = $1),
d as (delete from zones z using w where z.mobilisation_id = w.mobilisation_id and z.area = $2 returning z.id),
i as (insert into zones (mobilisation_id, area, name, shape, source) select w.mobilisation_id, $2, $3, $4::jsonb, 'engineer_drawn' from w returning id),
a as (insert into audit_log (actor, action, entity, entity_id, detail) select 'contact:' || w.engineer_id, 'mark_area', 'zone', $2, json_build_object('shape', $4::jsonb, 'replaced', (select count(*) from d)) from w)
select (select count(*) from i) as saved, (select count(*) from d) as replaced;`, "={{ $json.walk_id }},={{ $json.zone.area }},={{ $json.zone.name }},={{ JSON.stringify($json.zone.shape) }}", at(7, 5.8), 'The engineer\'s shape replaces the contractor\'s pin for that area. The old one stays in the audit log.', { onError: true, guard: ['error-out', 'audit'] }),
      respond('Respond area saved', 200, "={{ { ok: $json.saved > 0, replaced: $json.replaced } }}", at(8, 5.8), 'The page draws it at once.'),
      respond('Respond bad shape', 400, '={{ { "error": "validation_error", "details": $json.errors } }}', at(7, 6.8), 'The page says why (usually: GPS too weak, wait and try again).'),

      // a QR sticker was scanned
      snippet('Check sticker', SPOT_CHECK, at(4, 7.8), 'The code is signed: a made-up or altered code fails here.', { guard: ['auth'], onError: true }),
      iff('Sticker genuine?', '={{ $json.spot_ok }}', at(5, 7.8), 'Only signed codes count.'),
      pg('Record sticker scan', `insert into spot_checks (walk_id, area, sticker, ts, gps)
select w.id, $2, $3, coalesce(nullif($4, '')::timestamptz, now()), $5::jsonb from walks w where w.id = $1 and w.mobilisation_id = $6
on conflict do nothing returning area;`, "={{ $json.walk_id }},={{ $json.spot.area }},={{ $json.spot.sticker }},={{ $json.body.client_ts || '' }},={{ JSON.stringify($json.body.gps || null) }},={{ $json.spot.mobilisation_id }}", at(6, 7.8), 'Kept with time and GPS. A sticker from another site records nothing.', { onError: true, guard: ['error-out', 'audit', 'idempotent'], alwaysOutput: true }),
      respond('Respond sticker', 200, "={{ { ok: !!$json.area, area: $json.area || null, message: $json.area ? 'Sticker recorded' : 'This sticker belongs to another site' } }}", at(7, 7.8), 'The page switches to that area.'),
      respond('Respond bad sticker', 400, '={{ { "error": "validation_error", "details": ["This is not a Vera sticker for this site"] } }}', at(6, 8.8), 'Refused.'),

      // print stickers
      pg('Areas for stickers', `select w.id as walk_id, w.mobilisation_id, mo.project, (select json_agg(distinct area) from lines where mobilisation_id = w.mobilisation_id and "when" = 'walk') as areas
from walks w join mobilisations mo on mo.id = w.mobilisation_id where w.id = $1;`, '={{ $json.walk_id }}', at(4, 9.8), 'The areas walked on this site.', { onError: true, guard: ['error-out', 'retry'] }),
      snippet('Sign sticker codes', STICKER_SIGN, at(5, 9.8), 'One signed code per sticker (default 4 per area).', { guard: ['auth'], onError: true }),
      respond('Respond stickers', 200, '={{ $json }}', at(6, 9.8), 'The page prints them as QR codes, A4.'),

      respond('Respond 500', 500, '={{ { "error": "internal_error", "message": "Saved on the phone. Will retry." } }}', at(2, 11), 'Any step that breaks still answers the page, so it keeps the capture and retries.'),
    )
      .link('Walk page opens (GET)', 'Check walk link').link('Check walk link', 'Link valid?').link('Link valid?', 'Load checklist for walk', 'true').link('Link valid?', 'Respond 401', 'false')
      .link('Load checklist for walk', 'Send checklist')
      .link('Walk page posts (POST)', 'Check walk link ').link('Check walk link ', 'Link valid? ').link('Link valid? ', 'Which action?', 'true').link('Link valid? ', 'Respond 401 ', 'false')
      .link('Which action?', 'Load walk', 'capture').link('Which action?', 'Save trail points', 'trail').link('Which action?', 'Mark walk finished', 'finish').link('Which action?', 'Respond 401 ', 'Other')
      .link('Load walk', 'Validate capture').link('Validate capture', 'Capture valid?').link('Capture valid?', 'Already saved?', 'true').link('Capture valid?', 'Respond 400', 'false')
      .link('Already saved?', 'Respond saved (again)', 'true').link('Already saved?', 'Place on site map', 'false')
      .link('Place on site map', 'Photo to file').link('Photo to file', 'Store walk photo').link('Store walk photo', 'Save capture and line').link('Store walk photo', 'Respond: try again', 'error')
      .link('Save capture and line', 'Respond saved').link('Respond saved', 'Voice remark attached?').link('Voice remark attached?', 'Voice to file', 'true')
      .link('Voice to file', 'Transcribe remark').link('Transcribe remark', 'Save remark transcript').link('Transcribe remark', 'Save remark transcript', 'error')
      .link('Save trail points', 'Respond 204')
      .link('Mark walk finished', 'Respond 202').link('Respond 202', 'Draft the NOC report')
      .link('Which action?', 'Areas for marking', 'zone').link('Areas for marking', 'Check the area shape').link('Check the area shape', 'Shape OK?')
      .link('Shape OK?', 'Save area shape', 'true').link('Shape OK?', 'Respond bad shape', 'false').link('Save area shape', 'Respond area saved')
      .link('Which action?', 'Check sticker', 'spot').link('Check sticker', 'Sticker genuine?').link('Sticker genuine?', 'Record sticker scan', 'true').link('Sticker genuine?', 'Respond bad sticker', 'false')
      .link('Record sticker scan', 'Respond sticker')
      .link('Which action?', 'Areas for stickers', 'stickers').link('Areas for stickers', 'Sign sticker codes').link('Sign sticker codes', 'Respond stickers')
      .link('Areas for marking', 'Respond 500', 'error').link('Check the area shape', 'Respond 500', 'error').link('Save area shape', 'Respond 500', 'error')
      .link('Check sticker', 'Respond 500', 'error').link('Record sticker scan', 'Respond 500', 'error').link('Areas for stickers', 'Respond 500', 'error').link('Sign sticker codes', 'Respond 500', 'error')
      .link('Check walk link', 'Respond 500', 'error').link('Load checklist for walk', 'Respond 500', 'error').link('Load walk', 'Respond 500', 'error').link('Save capture and line', 'Respond 500', 'error').link('Save trail points', 'Respond 500', 'error').link('Mark walk finished', 'Respond 500', 'error').link('Check walk link ', 'Respond 500', 'error').link('Validate capture', 'Respond 500', 'error').link('Place on site map', 'Respond 500', 'error').link('Photo to file', 'Respond 500', 'error')),

  // ------------------------------------------------------------------ WF-04
  wf(IDS.gaps, 'Vera 05 · 04 Evening gap list',
    '7 PM, three days before the visit until the day before: what is still missing goes to the contractor, and a one-line readiness note goes to the engineer.',
    (w) => w.add(
      cron('Every evening 7 PM', '0 19 * * *', at(0, 0), 'IST (instance timezone Asia/Kolkata).'),
      trigger('On demand (status)', { mobilisation_id: 'number' }, at(0, 1.2), 'When the contractor types "status".'),
      pg('Sites in paper-check window', `select mo.id as mobilisation_id, row_to_json(mo) as mob,
  (select json_agg(json_build_object('code', code, 'area', area, 'text', text, 'when', "when", 'severity', severity, 'evidence', evidence, 'status', status, 'reason', reason) order by code) from lines where mobilisation_id = mo.id) as lines,
  c.id as contact_id, extract(epoch from c.last_inbound_at) * 1000 as last_inbound_ms,
  (select id from contacts where mobilisation_id = mo.id and role = 'engineer' limit 1) as engineer_contact_id
from mobilisations mo join contacts c on c.mobilisation_id = mo.id and c.role = 'contractor'
where mo.phase = 'paper' and (mo.id = nullif($1, '')::bigint or ($1 = '' and mo.visit_date between current_date and current_date + 3));`, "={{ $json.mobilisation_id ? String($json.mobilisation_id) : '' }}", at(1, 0.6), 'Every site whose visit is in the next 3 days (or the one that asked).', { guard: ['retry'] }),
      n('One site at a time', 'loop', { batchSize: 1, options: {} }, at(2, 0.6), 'A failure on one site does not stop the others.'),
      code('Build gap list', L.gapList, at(3, 0), 'Missing papers by severity, what was sent back and why, how many site photos so far.'),
      send('Send to contractor', at(4, 0), 'Free inside 24 h of their last message; otherwise the approved utility template.', { kind: 'gap_list', request: '={{ { body: { type: "text", text: { preview_url: false, body: $json.gap.text } }, template: $json.gap.template } }}' }, { guard: ['window'] }),
      send('Tell the engineer', at(5, 0), '"Ready to travel" or the list of critical papers still open.', { kind: 'gap_list', contact: "={{ $('Build gap list').item.json.engineer_contact_id }}", mob: "={{ $('Build gap list').item.json.mobilisation_id }}", request: "={{ { body: { type: 'text', text: { body: $('Build gap list').item.json.gap.engineer_line } }, template: { name: 'vera_mob_engineer_brief', language: 'en', params: [$('Build gap list').item.json.gap.engineer_line] } } }}" }),
      noop('All sites done', at(3, 1.6), 'End of run.'),
    )
      .link('Every evening 7 PM', 'Sites in paper-check window').link('On demand (status)', 'Sites in paper-check window')
      .link('Sites in paper-check window', 'One site at a time')
      .link('One site at a time', 'Build gap list', 'loop').link('One site at a time', 'All sites done', 'done')
      .link('Build gap list', 'Send to contractor').link('Send to contractor', 'Tell the engineer').link('Tell the engineer', 'One site at a time')),

  // ------------------------------------------------------------------ WF-05
  wf(IDS.replies, 'Vera 05 · 05 One reply per burst',
    'Contractors send 20 photos in a minute. Instead of 20 replies, Vera waits until the burst goes quiet for 90 seconds and sends one summary.',
    (w) => w.add(
      n('Every minute', 'cron', { rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] } }, at(0, 0), 'Small, cheap query.'),
      pg('Bursts that went quiet', `with q as (
  select contact_id from reply_queue where sent_at is null and claimed_at is null
  group by contact_id having max(created_at) < now() - interval '90 seconds'
), c as (
  update reply_queue r set claimed_at = now() from q where r.contact_id = q.contact_id and r.sent_at is null and r.claimed_at is null
  returning r.id, r.contact_id, r.mobilisation_id, r.fragment
)
select contact_id, max(mobilisation_id) as mobilisation_id, json_agg(fragment order by id) as fragments, json_agg(id) as ids,
  (select count(*) from lines l where l.mobilisation_id = max(c.mobilisation_id) and l.status not in ('accepted', 'ok', 'na') and l."when" = 'paper') as open_count
from c group by contact_id;`, '', at(1, 0), 'Claims each burst once, so two runs never send the same reply.', { guard: ['idempotent', 'retry'] }),
      code('Compose one reply', L.composeReply, at(2, 0), '"✅ Accepted PAP-03. ↩️ PAP-04 sent back: sum insured below contract value. Still open: 6."'),
      send('Send the reply', at(3, 0), 'Through WF-09.', { kind: 'reply', request: '={{ { body: { type: "text", text: { body: $json.reply } } } }}' }),
      pg('Mark reply sent', `update reply_queue set sent_at = now() where id = any(($1)::bigint[]) returning id;`, "={{ '{' + $('Compose one reply').item.json.ids.join(',') + '}' }}", at(4, 0), 'Done.'),
    )
      .link('Every minute', 'Bursts that went quiet').link('Bursts that went quiet', 'Compose one reply').link('Compose one reply', 'Send the reply').link('Send the reply', 'Mark reply sent')),

  // ------------------------------------------------------------------ WF-06
  wf(IDS.noc, 'Vera 05 · 06 NOC report draft',
    'When the walk ends: code scores the checklist and decides the recommendation; AI only words the engineer\'s remarks in English; the wording is checked; a PDF goes to the engineer to sign with one tap.',
    (w) => w.add(
      trigger('When the walk is finished', { mobilisation_id: 'number' }, at(0, 0), 'From WF-03.'),
      cron('Every night 9 PM (safety net)', '0 21 * * *', at(0, 1.4), 'Catches a walk the engineer forgot to finish.'),
      pg('Walks with no report', `select w.mobilisation_id from walks w join mobilisations mo on mo.id = w.mobilisation_id
where mo.visit_date = current_date and not exists (select 1 from noc_reports r where r.mobilisation_id = w.mobilisation_id);`, '', at(1, 1.4), 'Today\'s visits without a draft.'),
      pg('Load the visit', `select mo.id as mobilisation_id, row_to_json(mo) as mob, mo.visit_date::text as visit_date,
  (select json_agg(json_build_object('code', l.code, 'area', l.area, 'text', l.text, 'severity', l.severity, 'when', l."when", 'status', l.status, 'reason', l.reason, 'remark', l.remark,
      'photos', (select count(*) from evidence e where e.mobilisation_id = mo.id and e.line_code = l.code)) order by l.code) from lines l where l.mobilisation_id = mo.id) as lines,
  (select json_agg(json_build_object('line', e.line_code, 'text', e.transcript, 'lang', e.transcript_lang)) from evidence e where e.mobilisation_id = mo.id and e.transcript is not null) as remarks,
  (select json_agg(json_build_object('lat', t.lat, 'lng', t.lng, 'accuracy', t.accuracy, 'ts', t.ts)) from trail t join walks w on w.id = t.walk_id where w.mobilisation_id = mo.id) as trail,
  (select json_agg(json_build_object('gps', e.gps)) from evidence e where e.mobilisation_id = mo.id and e.gps is not null) as captures,
  (select json_agg(json_build_object('area', s.area, 'ts', s.ts, 'gps', s.gps)) from spot_checks s join walks w on w.id = s.walk_id where w.mobilisation_id = mo.id) as spots,
  (select jsonb_agg(jsonb_build_object('area', z.area, 'name', z.name) || z.shape) from zones z where z.mobilisation_id = mo.id) as zones,
  (select json_agg(distinct l.area) from lines l where l.mobilisation_id = mo.id and l."when" = 'walk') as walk_areas,
  (select id from contacts where mobilisation_id = mo.id and role = 'engineer' limit 1) as contact_id,
  (select coalesce(max(version), 0) + 1 from noc_reports where mobilisation_id = mo.id) as version
from mobilisations mo where mo.id = $1;`, '={{ $json.mobilisation_id }}', at(2, 0.6), 'Every line, photo count, transcript, GPS fix and area.', { guard: ['retry'] }),
      code('Which areas were walked', L.walkCoverage, at(3, 0.6), 'An area counts as walked only with GPS fixes inside it (allowing for each fix\'s own error), or a sticker scanned there.', { pre: 'input.params = ' + JSON.stringify(PARAMS.geofence) + ';' }),
      code('Score the visit', L.scoreVisit, at(4, 0.6), 'Recommendation by rule: any critical open or an area not walked → not ready; majors open → ready with conditions.', { guard: ['audit'] }),
      code('Build wording request', L.buildNarrativeRequest, at(5, 0.6), 'Remarks + open items, already decided. AI is told not to decide anything.'),
      http('Claude: word the observations', { url: CLAUDE, auth: 'claude', headers: { 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01', 'content-type': 'application/json' }, json: '={{ JSON.stringify($json.request) }}', timeout: 180000 }, at(6, 0.6), 'Hindi / Marathi remarks → plain English observations, citing line codes.', { guard: ['retry', 'error-out', 'timeout'], onError: true }),
      code('Check the wording', L.checkNarrative, at(7, 0.6), 'Only known line codes, no verdict words. If it fails, the engineer\'s own transcripts go in instead.', { guard: ['schema'], pre: "input = { ...$('Build wording request').item.json, request: undefined, ai: $input.item.json };" }),
      code('Build report page', L.renderReport, at(8, 0.6), 'Recommendation, open items with due dates, areas walked, observations. Says which parts AI wrote.'),
      snippet('Page to file', PAGE_FILE, at(9, 0.6), 'index.html for the PDF service.'),
      http('HTML to PDF (Gotenberg)', { url: '={{ $env.VERA_GOTENBERG_URL }}/forms/chromium/convert/html', form: [{ parameterType: 'formBinaryData', name: 'files', inputDataFieldName: 'data' }], file: true, timeout: 60000 }, at(10, 0.6), 'Self-hosted, next to n8n. No report leaves our servers to be printed.', { guard: ['retry', 'error-out'], onError: true }),
      http('Upload PDF to WhatsApp', { url: `=${GRAPH}/{{ $env.VERA_WA_PHONE_NUMBER_ID }}/media`, auth: 'wa', form: [{ name: 'messaging_product', value: 'whatsapp' }, { name: 'type', value: 'application/pdf' }, { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }], timeout: 60000 }, at(11, -0.4), 'The PDF goes to WhatsApp as a media file: there is never a public link to the report.', { guard: ['retry', 'error-out'], onError: true }),
      n('Both done', 'merge', { mode: 'chooseBranch', chooseBranchMode: 'waitForAll', output: 'specifiedInput', useDataOfInput: 2 }, at(12, 0.1), 'Waits for the bucket copy and the WhatsApp upload; carries the media id on.', { inputs: 2 }),
      n('Store report PDF', 's3', { resource: 'file', operation: 'upload', bucketName: '={{ $env.VERA_S3_BUCKET }}', fileName: "={{ 'mob/' + $('Load the visit').item.json.mobilisation_id + '/noc-v' + $('Load the visit').item.json.version + '.pdf' }}", binaryData: true, binaryPropertyName: 'data', additionalFields: {} }, at(11, 0.6), 'Versioned: a re-draft never overwrites a signed report.', { creds: CREDS.s3, retry: true, guard: ['retry', 'audit'] }),
      pg('Save NOC draft', `insert into noc_reports (mobilisation_id, version, score, narrative, narrative_ok, s3_key)
values ($1, $2, $3::jsonb, $4::jsonb, $5, $6) on conflict (mobilisation_id, version) do nothing returning id as noc_id, mobilisation_id;`,
      "={{ $('Load the visit').item.json.mobilisation_id }},={{ $('Load the visit').item.json.version }},={{ JSON.stringify($('Check the wording').item.json.score) }},={{ JSON.stringify($('Check the wording').item.json.narrative) }},={{ $('Check the wording').item.json.narrative_ok }},={{ 'mob/' + $('Load the visit').item.json.mobilisation_id + '/noc-v' + $('Load the visit').item.json.version + '.pdf' }}",
      at(13, 0.6), 'Draft saved.', { guard: ['idempotent'] }),
      pg('Create open items', `insert into open_items (mobilisation_id, line_code, severity, text, finding, due_on)
select $1, o->>'line', o->>'severity', o->>'text', o->>'finding', (o->>'due_on')::date from json_array_elements($2::json) o
where not exists (select 1 from open_items x where x.mobilisation_id = $1 and x.line_code = o->>'line' and x.status <> 'closed') returning id;`,
      "={{ $('Save NOC draft').item.json.mobilisation_id }},={{ JSON.stringify($('Check the wording').item.json.score.open_items) }}", at(14, 0.6), 'Each open line becomes a dated item for WF-07.', { alwaysOutput: true }),
      code('Build sign-off message', (input) => input, at(15, 0.6), 'PDF + Approve / With conditions / Hold buttons.', { src: `const v = $('Load the visit').item.json;
const s = $('Check the wording').item.json.score;
const noc = $('Save NOC draft').item.json.noc_id;
const label = { ready: 'Ready to start', conditional: 'Ready with conditions', not_ready: 'Not ready' }[s.recommendation];
return { json: { contact_id: v.contact_id, mobilisation_id: v.mobilisation_id, ref: String(noc), request: { summary: 'the NOC report to sign', body: { type: 'interactive', interactive: {
  type: 'button', header: { type: 'document', document: { id: $('Upload PDF to WhatsApp').item.json.id, filename: 'NOC-draft-' + v.mob.project + '.pdf' } },
  body: { text: v.mob.project + ': ' + label + '. ' + s.done + '/' + s.total + ' lines closed; ' + s.critical_open + ' critical, ' + s.major_open + ' major open. Please read and sign.' },
  action: { buttons: [ { type: 'reply', reply: { id: 'sign:' + noc + ':approve', title: 'Approve' } }, { type: 'reply', reply: { id: 'sign:' + noc + ':conditions', title: 'With conditions' } }, { type: 'reply', reply: { id: 'sign:' + noc + ':hold', title: 'Hold' } } ] } } } } } };` }),
      send('Send to engineer to sign', at(16, 0.6), 'The button reply from his own number is the sign-off, kept with its WhatsApp id. The NOC is never issued without it.', { kind: 'noc', ref: '={{ $json.ref }}' }, { guard: ['human', 'audit'] }),
      pg('Alert: report failed', `insert into review_queue (mobilisation_id, reason) values ($1, 'NOC PDF could not be made or uploaded: ' || $2) returning id;`, "={{ $('Load the visit').item.json.mobilisation_id }},={{ ($json.error && ($json.error.message || JSON.stringify($json.error)).slice(0, 300)) || $json.message || 'see the n8n execution ' + $execution.id }}", at(11, 2), 'Vera ops sends it by hand; the engineer is not left waiting.', { guard: ['human'] }),
    )
      .link('When the walk is finished', 'Load the visit').link('Every night 9 PM (safety net)', 'Walks with no report').link('Walks with no report', 'Load the visit')
      .link('Load the visit', 'Which areas were walked').link('Which areas were walked', 'Score the visit').link('Score the visit', 'Build wording request')
      .link('Build wording request', 'Claude: word the observations').link('Claude: word the observations', 'Check the wording').link('Claude: word the observations', 'Check the wording', 'error')
      .link('Check the wording', 'Build report page').link('Build report page', 'Page to file').link('Page to file', 'HTML to PDF (Gotenberg)')
      .link('HTML to PDF (Gotenberg)', 'Store report PDF').link('HTML to PDF (Gotenberg)', 'Upload PDF to WhatsApp').link('HTML to PDF (Gotenberg)', 'Alert: report failed', 'error')
      .link('Store report PDF', 'Both done').link('Upload PDF to WhatsApp', 'Both done', 'in2').link('Upload PDF to WhatsApp', 'Alert: report failed', 'error')
      .link('Both done', 'Save NOC draft').link('Save NOC draft', 'Create open items').link('Create open items', 'Build sign-off message').link('Build sign-off message', 'Send to engineer to sign')),

  // ------------------------------------------------------------------ WF-07
  wf(IDS.closure, 'Vera 05 · 07 Open items after the visit',
    'Every morning: reminders for items due, escalation for critical items overdue. The contractor replies to the reminder with a photo; the engineer approves it from the photo, not another visit.',
    (w) => w.add(
      cron('Every morning 9 AM', '0 9 * * *', at(0, 0), 'IST.'),
      pg('Items due or overdue', `select oi.id, oi.mobilisation_id, json_build_object('id', oi.id, 'line', oi.line_code, 'severity', oi.severity, 'text', oi.text, 'finding', oi.finding, 'due_on', oi.due_on::text) as item,
  mo.project, current_date::text as today,
  (select id from contacts where mobilisation_id = oi.mobilisation_id and role = 'contractor' limit 1) as contact_id,
  (select id from contacts where mobilisation_id = oi.mobilisation_id and role = 'project_head' limit 1) as head_contact_id
from open_items oi join mobilisations mo on mo.id = oi.mobilisation_id where oi.status = 'open' and oi.due_on <= current_date;`, '', at(1, 0), 'Only items that are due.', { guard: ['retry'] }),
      n('Each item', 'loop', { batchSize: 1, options: {} }, at(2, 0), 'One at a time.'),
      code('Reminder or escalate?', L.reminderPlan, at(3, -0.5), 'Critical and overdue → the project head hears about it.'),
      send('Remind the contractor', at(4, -0.5), 'Sent as a message they can reply to: the reply binds to this item for sure.', { kind: 'open_item', line: '={{ $json.item.line }}', ref: '={{ String($json.item.id) }}' }),
      iff('Escalate?', "={{ $('Reminder or escalate?').item.json.who === 'escalate' }}", at(5, -0.5), 'Only critical items, only when overdue.'),
      send('Tell the project head', at(6, -1.2), 'One line with the item and days overdue.', { kind: 'open_item', contact: "={{ $('Reminder or escalate?').item.json.head_contact_id }}", mob: "={{ $('Reminder or escalate?').item.json.mobilisation_id }}", request: "={{ { body: { type: 'text', text: { body: $('Reminder or escalate?').item.json.escalation } }, template: { name: 'vera_mob_escalation', language: 'en', params: [$('Reminder or escalate?').item.json.escalation] } } }}" }),
      noop('All reminders sent', at(3, 1), 'End of run.'),
    )
      .link('Every morning 9 AM', 'Items due or overdue').link('Items due or overdue', 'Each item')
      .link('Each item', 'Reminder or escalate?', 'loop').link('Each item', 'All reminders sent', 'done')
      .link('Reminder or escalate?', 'Remind the contractor').link('Remind the contractor', 'Escalate?')
      .link('Escalate?', 'Tell the project head', 'true').link('Escalate?', 'Each item', 'false').link('Tell the project head', 'Each item')),

  // ------------------------------------------------------------------ WF-08
  wf(IDS.setup, 'Vera 05 · 08 Set up a new site',
    'The engineer (or planning) fills one form: site, contractor, dates, contract value, peak labour, phones. Vera creates the checklist, sends the contractor the area prompts, and sends the engineer his walk link.',
    (w) => w.add(
      n('New site form', 'form', {
        formTitle: 'New site mobilisation',
        formDescription: 'Five minutes, once per site. Vera uses these facts to check every paper the contractor sends.',
        formFields: { values: [
          ['Project', 'text', true], ['Package', 'text', false], ['Contractor (legal name)', 'text', true], ['Other spellings of the contractor name', 'text', false],
          ['Site address', 'textarea', true], ['Address words that must appear on papers', 'text', true], ['Work start date', 'date', true], ['Engineer visit date', 'date', true],
          ['Contract end date', 'date', true], ['Contract value (₹)', 'number', true], ['Planned peak labour', 'number', true],
          ['Concrete', 'dropdown', true, ['plant', 'rmc']], ['Tower crane / hoist at site', 'dropdown', true, ['yes', 'no']], ['Creche needed', 'dropdown', true, ['yes', 'no']],
          ['Excavation at start', 'dropdown', true, ['yes', 'no']], ['Contractor phone (WhatsApp)', 'text', true], ['Engineer phone (WhatsApp)', 'text', true],
          ['Shadow mode: a person confirms every AI filing', 'dropdown', true, ['yes', 'no']],
        ].map(([fieldLabel, fieldType, requiredField, opts]) => ({ fieldLabel, fieldType, requiredField, ...(opts ? { fieldOptions: { values: opts.map((option) => ({ option })) } } : {}) })) },
        options: {},
      }, at(0, 0), 'An n8n form behind login. No spreadsheet to keep in sync.', { guard: ['auth'] }),
      snippet('Read the form', READ_FORM, at(1, 0), 'Labels → field names.'),
      code('Check the form', L.validateSetup, at(2, 0), 'Dates in order, numbers are numbers, phones have country code.', { guard: ['schema'] }),
      iff('Form OK?', '={{ $json.valid }}', at(3, 0), 'Wrong input stops here, with reasons.'),
      n('Show what is wrong', 'stop', { errorMessage: "={{ 'Please fix: ' + $json.errors.join('; ') }}" }, at(4, 1), 'The form shows the error.'),
      code('Copy checklist for this site', L.instantiateChecklist, at(4, 0), 'Template ' + 'mob-v1' + ': only the lines that apply (plant or RMC, crane, creche, excavation).', { pre: 'input.template = ' + JSON.stringify(TEMPLATE) + '; input.areas = ' + JSON.stringify(AREAS) + ';' }),
      pg('Create site, lines, contacts', `with mo as (
  insert into mobilisations (project, package, contractor_name, contractor_aliases, site_address, site_keywords, start_date, visit_date, contract_end, contract_value_inr, peak_workers, flags, template_version)
  select c->>'project', c->>'package', c->>'contractor_name', c->'contractor_aliases', c->>'site_address', c->'site_keywords', (c->>'start_date')::date, (c->>'visit_date')::date, (c->>'contract_end')::date,
    (c->>'contract_value_inr')::numeric, (c->>'peak_workers')::int, c->'flags', 'mob-v1' from (select $1::jsonb c) x returning id
), l as (
  insert into lines (mobilisation_id, code, area, text, evidence, "when", severity, doc_type, rules, hint)
  select (select id from mo), r->>'code', r->>'area', r->>'text', r->>'evidence', r->>'when', r->>'severity', r->>'doc_type', r->'rules', r->>'hint' from jsonb_array_elements($2::jsonb) r returning 1
), k as (
  insert into contacts (mobilisation_id, phone, role) values ((select id from mo), $3, 'contractor'), ((select id from mo), $4, 'engineer') returning id, role
), wk as (
  insert into walks (mobilisation_id, engineer_id, expires_at) select (select id from mo), (select id from k where role = 'engineer'), ($5::date + 2)::timestamptz returning id
)
select (select id from mo) as mobilisation_id, (select id from k where role = 'contractor') as contractor_contact_id, (select id from k where role = 'engineer') as engineer_contact_id,
  (select id from wk) as walk_id, (select count(*) from l) as lines_created;`,
      "={{ JSON.stringify($json.clean) }},={{ JSON.stringify($json.checklist) }},={{ $json.clean.contractor_phone }},={{ $json.clean.engineer_phone }},={{ $json.clean.visit_date }}", at(5, 0), 'All in one statement: either the whole site is created or nothing is.', { guard: ['audit'] }),
      code('Build area prompts', L.buildAreaPrompts, at(6, 0), 'One message per area, each listing its lines by number.', { mode: 'all', pre: "input.checklist = $('Copy checklist for this site').first().json.checklist; input.checklist_areas = $('Copy checklist for this site').first().json.checklist_areas;" }),
      send('Send area prompts', at(7, 0), 'The first one goes as the welcome template (outside the 24 h window); the contractor\'s reply opens the window for the rest.', { kind: 'area', area: '={{ $json.area }}', contact: '={{ $json.contact_id }}' }),
      snippet('Sign the walk link', WALK_SIGN, at(6, 1.2), 'Signed link for the engineer, valid until the day after the visit.', { guard: ['auth'], pre: '' }),
      send('Send engineer the walk link', at(7, 1.2), 'Through WF-09.', { kind: 'help', contact: "={{ $('Create site, lines, contacts').item.json.engineer_contact_id }}", mob: "={{ $('Create site, lines, contacts').item.json.mobilisation_id }}" }),
    )
      .link('New site form', 'Read the form').link('Read the form', 'Check the form').link('Check the form', 'Form OK?')
      .link('Form OK?', 'Copy checklist for this site', 'true').link('Form OK?', 'Show what is wrong', 'false')
      .link('Copy checklist for this site', 'Create site, lines, contacts').link('Create site, lines, contacts', 'Build area prompts').link('Create site, lines, contacts', 'Sign the walk link')
      .link('Build area prompts', 'Send area prompts').link('Sign the walk link', 'Send engineer the walk link')),

  // ------------------------------------------------------------------ WF-09
  wf(IDS.send, 'Vera 05 · 09 Send on WhatsApp',
    'The only way Vera sends anything. Picks session message or template by the 24-hour window, logs every message id (so replies bind to lines), backs off on rate limits, and never fails silently.',
    (w) => w.add(
      trigger('Asked to send', { contact_id: 'number', mobilisation_id: 'number', kind: 'string', area: 'string', line_code: 'string', ref: 'string', request: 'object' }, at(0, 0), 'Who, what, and why (kind / area / line).'),
      pg('Load contact and window', `select $1::bigint as contact_id, c.phone, c.last_inbound_at, c.role from contacts c where c.id = $1;`, '={{ $json.contact_id }}', at(1, 0), 'Phone and when they last wrote to us.', { guard: ['retry'] }),
      code('Session or template?', L.chooseSendMode, at(2, 0), 'Inside 24 h of their last message: the message itself. Outside: its approved template; or, for buttons, photos and the NOC, one generic template with a "Show me" button while the real message is held.', { guard: ['window'], pre: "input = { ...input, request: $('Asked to send').item.json.request, attempt: input.attempt || 0 };" }),
      iff('Can send?', '={{ $json.can_send }}', at(3, 0), 'No phone, or outside the window with no template: not sent, logged.', { guard: ['window'] }),
      pg('Log not sent', `insert into outbound (mobilisation_id, contact_id, kind, area, line_code, ref, payload, status, error) values ($1, $2, $3, $4, $5, $6, $7::jsonb, 'not_sent', $8::jsonb) returning id;`,
        "={{ $('Asked to send').item.json.mobilisation_id }},={{ $('Asked to send').item.json.contact_id }},={{ $('Asked to send').item.json.kind }},={{ $('Asked to send').item.json.area }},={{ $('Asked to send').item.json.line_code }},={{ $('Asked to send').item.json.ref }},={{ JSON.stringify($('Asked to send').item.json.request) }},={{ JSON.stringify({ why: $json.why || $json.send_error && $json.send_error.note }) }}",
        at(4, 1.2), 'Shows up in the daily ops list.', { guard: ['human', 'audit'] }),
      http('Send to WhatsApp', { url: `=${GRAPH}/{{ $env.VERA_WA_PHONE_NUMBER_ID }}/messages`, auth: 'wa', json: '={{ JSON.stringify($json.payload) }}' }, at(4, 0), 'Graph API messages endpoint.', { guard: ['error-out', 'timeout'], onError: true, retry: false }),
      pg('Log what we sent', `insert into outbound (wamid, mobilisation_id, contact_id, kind, area, line_code, ref, payload, held_body) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb) returning id, wamid;`,
        "={{ $json.messages[0].id }},={{ $('Asked to send').item.json.mobilisation_id }},={{ $('Asked to send').item.json.contact_id }},={{ $('Asked to send').item.json.kind }},={{ $('Asked to send').item.json.area }},={{ $('Asked to send').item.json.line_code }},={{ $('Asked to send').item.json.ref }},={{ JSON.stringify($('Session or template?').item.json.payload) }},={{ $('Session or template?').item.json.mode === 'hold' ? JSON.stringify($('Session or template?').item.json.held_body) : null }}",
        at(5, 0), 'The message id is what makes "reply to this message" bind for sure. A held message is kept here until they tap "Show me".', { guard: ['audit', 'retry'] }),
      code('Why did it fail?', L.classifySendError, at(5, 2.2), 'Reads the WhatsApp error code: rate limit, window closed, bad number.', { pre: "const prev = $('Wait 30 s').isExecuted ? Number($('Wait 30 s').item.json.attempt || 0) : 0; const base = $('Session or template?').item.json; input = { ...base, attempt: Math.max(Number(base.attempt || 0), prev), error: $input.item.json.error || $input.item.json };" }),
      sw('Retry?', '={{ $json.send_error.action }}', ['retry', 'needs_template'], at(6, 2.2), 'Rate limit → wait and retry (max 3). Window closed → template. Bad number → a person.'),
      n('Wait 30 s', 'wait', { amount: 30, unit: 'seconds' }, at(7, 1.6), 'WhatsApp limits how fast one person can be messaged.'),
    )
      .link('Asked to send', 'Load contact and window').link('Load contact and window', 'Session or template?').link('Session or template?', 'Can send?')
      .link('Can send?', 'Send to WhatsApp', 'true').link('Can send?', 'Log not sent', 'false')
      .link('Send to WhatsApp', 'Log what we sent').link('Send to WhatsApp', 'Why did it fail?', 'error')
      .link('Why did it fail?', 'Retry?').link('Retry?', 'Wait 30 s', 'retry').link('Retry?', 'Session or template?', 'needs_template').link('Retry?', 'Log not sent', 'Other')
      .link('Wait 30 s', 'Send to WhatsApp')),

  // ------------------------------------------------------------------ WF-10
  wf(IDS.readPaper, 'Vera 05 · 10 Read and check a paper',
    'A paper filed by a button tap (sender or reviewer) has not been read yet. This reads it from the bucket and runs the same paper checks as WF-02, so no paper is accepted without them.',
    (w) => w.add(
      trigger('Paper filed by a button', { evidence_id: 'number' }, at(0, 0), 'From WF-02 after a confirm or review answer.'),
      pg('Load the paper', `select e.id as evidence_id, e.mobilisation_id, e.s3_key, e.mime, e.created_by as contact_id, e.message_id, row_to_json(mo) as mob,
  json_build_object('code', l.code, 'text', l.text, 'docType', l.doc_type, 'rules', l.rules, 'evidence', l.evidence) as line,
  json_build_object('line', l.code, 'method', e.bind_method) as binding,
  json_build_object('type', case when e.kind = 'document' then 'document' else 'image' end) as message
from evidence e join mobilisations mo on mo.id = e.mobilisation_id join lines l on l.mobilisation_id = e.mobilisation_id and l.code = e.line_code
where e.id = $1 and e.s3_key is not null;`, '={{ $json.evidence_id }}', at(1, 0), 'The file, its line and the site facts.', { guard: ['retry'] }),
      n('Get it from the bucket', 's3', { resource: 'file', operation: 'download', bucketName: '={{ $env.VERA_S3_BUCKET }}', fileKey: '={{ $json.s3_key }}', binaryPropertyName: 'data' }, at(2, 0), 'The stored copy, by its hash key.', { creds: CREDS.s3, retry: true, guard: ['retry', 'error-out'], onError: true }),
      snippet('File with its details', `// Why Code: the S3 node returns the file; this puts the line and site facts back with it.
const item = $input.item;
return { json: $('Load the paper').item.json, binary: item.binary };`, at(3, 0), 'One item: file + line + site.'),
      code('Build extract request', L.buildExtractRequest, at(5, 0), 'Same request as WF-02: copy the fields exactly, null when not printed.', { media: true, guard: ['schema'] }),
      http('Claude: read the paper', { url: CLAUDE, auth: 'claude', headers: CLAUDE_HEADERS, json: '={{ JSON.stringify($json.request) }}', timeout: 120000 }, at(6, 0), 'Name, address, dates, workers covered, sum insured…', { guard: ['retry', 'error-out', 'timeout'], onError: true }),
      snippet('Parse the fields', PARSE_FIELDS, at(7, 0), 'Anything that is not a clean answer counts as unread.', { guard: ['schema'] }),
      code('Check paper rules', L.checkPaper, at(8, 0), 'Plain code, same rules as WF-02. Each check says why.', { guard: ['audit'], pre: 'input.params = ' + JSON.stringify(PARAMS) + ';' }),
      code('Make reply fragment', makeFragment, at(9, 0), 'Accepted / sent back (with why) / being checked.'),
      pg('Save the checks', `with e as (
  update evidence set fields = $2::jsonb, checks = $3::jsonb where id = $1 returning mobilisation_id, line_code, message_id
), l as (
  update lines set status = $4, reason = nullif($5, ''), expires_on = nullif($6, '')::date, status_at = now()
  from e where lines.mobilisation_id = e.mobilisation_id and lines.code = e.line_code and lines.status not in ('ok', 'not_ok', 'na', 'accepted') returning lines.code
), q as (
  insert into review_queue (mobilisation_id, message_id, evidence_id, reason)
  select e.mobilisation_id, e.message_id, $1, 'Paper needs a person: ' || coalesce(nullif($5, ''), 'check it') from e where $4 = 'review'
), a as (
  insert into audit_log (actor, action, entity, entity_id, detail) select 'ai', 'check_paper', 'evidence', $1::text, json_build_object('status', $4) from e
) select (select code from l) as line_updated;`,
        "={{ $json.evidence_id }},={{ JSON.stringify($json.fields || null) }},={{ JSON.stringify(($json.paper || {}).checks || null) }},={{ ($json.paper || {}).status || 'review' }},={{ $json.fragment.reason }},={{ ($json.paper || {}).expires_on || '' }}",
        at(10, 0), 'Checks on the evidence, status on the line, a review item if a person must look. Never overwrites the engineer\'s decision.', { guard: ['audit', 'retry'] }),
      iff('Sender known?', "={{ !!$('Make reply fragment').item.json.contact_id }}", at(11, 0), 'Files sent by a contractor get a reply; nothing to reply to otherwise.'),
      pg('Queue the reply', SQL.queueReply, "={{ $('Make reply fragment').item.json.mobilisation_id }},={{ $('Make reply fragment').item.json.contact_id }},={{ JSON.stringify($('Make reply fragment').item.json.fragment) }}", at(12, -0.5), 'Goes out with the next burst reply (WF-05).', { guard: ['retry'] }),
      pg('Send to review queue', `insert into review_queue (mobilisation_id, evidence_id, reason) select mobilisation_id, id, 'Could not re-read the paper: ' || $2 from evidence where id = $1 returning id;`,
        "={{ $('Paper filed by a button').item.json.evidence_id }},={{ ($json.error && $json.error.message) || 'step failed' }}", at(7, 1.4), 'Bucket or AI failed: a person checks the paper. It stays filed on its line.', { guard: ['human'] }),
    )
      .link('Paper filed by a button', 'Load the paper').link('Load the paper', 'Get it from the bucket')
      .link('Get it from the bucket', 'File with its details').link('Get it from the bucket', 'Send to review queue', 'error').link('File with its details', 'Build extract request')
      .link('Build extract request', 'Claude: read the paper').link('Claude: read the paper', 'Parse the fields').link('Claude: read the paper', 'Send to review queue', 'error')
      .link('Parse the fields', 'Check paper rules').link('Check paper rules', 'Make reply fragment').link('Make reply fragment', 'Save the checks')
      .link('Save the checks', 'Sender known?').link('Sender known?', 'Queue the reply', 'true')),

  // ------------------------------------------------------------------ WF-11
  wf(IDS.show, 'Vera 05 · 11 Show a file with buttons',
    'Sends a stored photo or paper to one person with answer buttons: the engineer approving a fixed item, a Vera reviewer filing an item. The file is uploaded to WhatsApp as media, so no public link to evidence ever exists.',
    (w) => w.add(
      trigger('Asked to show', { contact_id: 'number', mobilisation_id: 'number', kind: 'string', ref: 'string', evidence_id: 'number', msg: 'object' }, at(0, 0), 'Who, which file, what text and which buttons.'),
      iff('Has a file?', '={{ Number($json.evidence_id) > 0 }}', at(1, 0), 'Some review items have no file (a failed download).'),
      pg('Find the file', `select id, s3_key, coalesce(mime, '') as mime, kind from evidence where id = $1;`, '={{ $json.evidence_id }}', at(2, -0.6), 'Where it is stored.', { guard: ['retry'], alwaysOutput: true }),
      n('Get the file', 's3', { resource: 'file', operation: 'download', bucketName: '={{ $env.VERA_S3_BUCKET }}', fileKey: '={{ $json.s3_key }}', binaryPropertyName: 'data' }, at(3, -0.6), 'From the evidence bucket.', { creds: CREDS.s3, retry: true, guard: ['retry', 'error-out'], onError: true }),
      http('Upload to WhatsApp', { url: `=${GRAPH}/{{ $env.VERA_WA_PHONE_NUMBER_ID }}/media`, auth: 'wa', form: [{ name: 'messaging_product', value: 'whatsapp' }, { name: 'type', value: "={{ $('Find the file').item.json.mime || 'image/jpeg' }}" }, { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }], timeout: 60000 }, at(4, -0.6), 'Media id, valid 30 days. Nothing public.', { guard: ['retry', 'error-out', 'timeout'], onError: true }),
      code('Build the message', L.buildEvidenceMessage, at(5, 0), 'Picture + up to 3 buttons, or the picture then a list. If the file could not be fetched, the text and buttons still go.', {
        mode: 'all',
        pre: "const t = $('Asked to show').first().json; const f = $('Find the file').isExecuted ? $('Find the file').first().json : {}; input = { ...t, media_id: typeof input.id === 'string' && $('Upload to WhatsApp').isExecuted ? input.id : '', media_mime: f.mime || '', media_kind: f.kind || '' };",
      }),
      send('Send it', at(6, 0), 'Through WF-09: outside the 24-hour window it is held behind a "Show me" template.', { kind: '={{ $json.kind }}', ref: '={{ $json.ref }}' }, { guard: ['window'] }),
    )
      .link('Asked to show', 'Has a file?').link('Has a file?', 'Find the file', 'true').link('Has a file?', 'Build the message', 'false')
      .link('Find the file', 'Get the file').link('Get the file', 'Upload to WhatsApp').link('Get the file', 'Build the message', 'error')
      .link('Upload to WhatsApp', 'Build the message').link('Upload to WhatsApp', 'Build the message', 'error')
      .link('Build the message', 'Send it')),

  // ------------------------------------------------------------------ WF-12
  wf(IDS.reviews, 'Vera 05 · 12 Review queue on WhatsApp',
    'Every 5 minutes, new review items go to a Vera reviewer on WhatsApp with the file and one-tap answers: which line, accept / send back a paper, ask to send again, or handled. Answers come back through WF-02.',
    (w) => w.add(
      n('Every 5 minutes', 'cron', { rule: { interval: [{ field: 'minutes', minutesInterval: 5 }] } }, at(0, 0), 'Small query.'),
      pg('Hand out new items', `with r as (
  select id, row_number() over (order by id) - 1 as k, count(*) over () as n from contacts where role = 'reviewer' and mobilisation_id is null
), q as (
  select id from review_queue where resolved_at is null and sent_at is null and exists (select 1 from r) order by id limit 20 for update skip locked
), u as (
  update review_queue rq set sent_at = now(), reviewer_id = (select r.id from r where r.k = rq.id % r.n) from q where rq.id = q.id
  returning rq.id, rq.reviewer_id, rq.mobilisation_id, rq.reason, rq.options, rq.evidence_id, rq.message_id
)
select u.id as review_id, u.reviewer_id, u.mobilisation_id, u.reason, u.options, coalesce(u.evidence_id, 0) as evidence_id, u.message_id,
  mo.project, e.line_code, l.text as line_text, l.evidence as line_evidence, m.body as message,
  (select json_agg(json_build_object('code', x.code, 'text', x.text) order by x.code) from lines x where x.mobilisation_id = u.mobilisation_id and x.status not in ('accepted', 'ok', 'na')) as open_lines
from u left join mobilisations mo on mo.id = u.mobilisation_id left join evidence e on e.id = u.evidence_id
  left join lines l on l.mobilisation_id = u.mobilisation_id and l.code = e.line_code left join messages m on m.id = u.message_id
order by u.id;`, '', at(1, 0), 'Each item to one reviewer (round robin), claimed once. No reviewer on file: items wait.', { guard: ['idempotent', 'retry'] }),
      code('Build review message', L.buildReviewMessage, at(2, 0), 'Unfiled file: pick the line. Paper to check: accept / send back. No file: ask to resend / handled.', { guard: ['human'] }),
      sub('Show it to the reviewer', IDS.show, { contact_id: '={{ $json.contact_id }}', mobilisation_id: '={{ $json.mobilisation_id }}', kind: 'review', ref: '={{ $json.ref }}', evidence_id: '={{ $json.evidence_id }}', msg: '={{ $json.msg }}' }, at(3, 0), 'WF-11 sends the file with the answers.'),
    )
      .link('Every 5 minutes', 'Hand out new items').link('Hand out new items', 'Build review message').link('Build review message', 'Show it to the reviewer')),

  // ------------------------------------------------------------------ WF-00
  wf(IDS.errors, 'Vera 05 · 00 Errors and stuck messages',
    'Catch-all for every Desk 05 workflow. Logs the failure, emails Vera ops (a different channel from WhatsApp, so a WhatsApp outage cannot hide itself), and every 10 minutes sends messages stuck in "processing" to the review queue.',
    (w) => w.add(
      n('When any workflow fails', 'errorTrigger', {}, at(0, 0), 'Set as the error workflow on WF-01 to WF-12.'),
      snippet('Describe the failure', ALERT, at(1, 0), 'Workflow, node, error, link. No message contents, no secrets.'),
      pg('Log the error', `insert into errors (workflow, execution_id, node, message, url) values ($1, $2, $3, $4, $5) returning id;`, '={{ $json.workflow }},={{ $json.execution_id }},={{ $json.node }},={{ $json.message }},={{ $json.url }}', at(2, 0), 'Kept even if email fails.', { guard: ['audit'], onError: true }),
      n('Email Vera ops', 'email', { fromEmail: '={{ $env.VERA_OPS_FROM }}', toEmail: '={{ $env.VERA_OPS_EMAIL }}', subject: "={{ $('Describe the failure').item.json.subject }}", emailFormat: 'text', text: "={{ $('Describe the failure').item.json.text }}", options: {} }, at(3, 0), 'Email, not WhatsApp: a WhatsApp outage must not hide its own alert.', { creds: CREDS.smtp, retry: true, guard: ['retry'] }),
      n('Every 10 minutes', 'cron', { rule: { interval: [{ field: 'minutes', minutesInterval: 10 }] } }, at(0, 1.4), 'Sweeper.'),
      pg('Messages stuck in processing', `with s as (
  update messages set state = 'needs_human', error = 'stuck in processing' where state = 'processing' and state_at < now() - interval '10 minutes' returning id, mobilisation_id
) insert into review_queue (mobilisation_id, message_id, reason) select mobilisation_id, id, 'Stuck in processing for 10 minutes' from s returning id;`, '', at(1, 1.4), 'A crash between nodes still ends with a person looking at the message.', { guard: ['human'] }),
    )
      .link('When any workflow fails', 'Describe the failure').link('Describe the failure', 'Log the error').link('Log the error', 'Email Vera ops').link('Log the error', 'Email Vera ops', 'error')
      .link('Every 10 minutes', 'Messages stuck in processing')),
]
