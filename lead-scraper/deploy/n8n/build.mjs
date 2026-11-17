#!/usr/bin/env node
// Builds the n8n workflows that run the lead pipeline on a schedule and put the scored
// leads in a Google Sheet. Import the JSON in n8n (Workflows > Import from file).
//   node deploy/n8n/build.mjs        -> deploy/n8n/<preset>-leads.json
//
// Flow: schedule (or "Run now") -> POST /runs -> wait 5 min -> GET /runs/:id -> done?
//   done   -> GET /runs/:id/leads.json -> one row per lead -> Google Sheet (update by domain) -> summary
//   failed -> stop with the error;  still running -> wait again
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const API = 'http://leads:8787';
const uuid = (seed) => {
  const h = crypto.createHash('sha1').update(seed).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), '4' + h.slice(13, 16), '8' + h.slice(17, 20), h.slice(20, 32)].join('-');
};
// Header auth credential (Authorization: Bearer <LEADS_API_TOKEN>), created once in n8n.
const AUTH = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
const CRED = { httpHeaderAuth: { id: 'REPLACE_ON_IMPORT', name: 'Leads API' } };

function workflow({ preset, title, sheetTab, cron }) {
  const n = (name, type, typeVersion, position, parameters, extra = {}) => ({ id: uuid(`${preset}:${name}`), name, type, typeVersion, position, parameters, ...extra });
  const nodes = [
    n('Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, 200], { rule: { interval: [{ field: 'cronExpression', expression: cron }] } }),
    n('Run now', 'n8n-nodes-base.manualTrigger', 1, [0, 400], {}),
    n('Start run', 'n8n-nodes-base.httpRequest', 4.2, [240, 300], {
      method: 'POST',
      url: `${API}/runs`,
      ...AUTH,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: JSON.stringify({ preset }),
      options: {},
    }, { credentials: CRED }),
    n('Wait 5 min', 'n8n-nodes-base.wait', 1.1, [480, 300], { amount: 5, unit: 'minutes' }, { webhookId: uuid(`${preset}:wait-hook`) }),
    n('Check run', 'n8n-nodes-base.httpRequest', 4.2, [720, 300], {
      url: `=${API}/runs/{{ $('Start run').first().json.id }}`,
      ...AUTH,
      options: {},
    }, { credentials: CRED }),
    n('Done?', 'n8n-nodes-base.if', 2.2, [960, 300], {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: uuid(`${preset}:done-cond`), leftValue: '={{ $json.status }}', rightValue: 'done', operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and',
      },
      options: {},
    }),
    n('Failed?', 'n8n-nodes-base.if', 2.2, [1200, 420], {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: uuid(`${preset}:failed-cond`), leftValue: '={{ $json.status }}', rightValue: 'failed', operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and',
      },
      options: {},
    }),
    n('Stop: run failed', 'n8n-nodes-base.stopAndError', 1, [1440, 500], { errorMessage: '={{ "Lead run failed: " + $json.error }}' }),
    n('Get scored leads', 'n8n-nodes-base.httpRequest', 4.2, [1200, 200], {
      url: `=${API}/runs/{{ $json.id }}/leads.json`,
      ...AUTH,
      options: { response: { response: { responseFormat: 'json' } } },
    }, { credentials: CRED }),
    n('One row per lead', 'n8n-nodes-base.code', 2, [1440, 200], {
      mode: 'runOnceForAllItems',
      jsCode: [
        '// The API returns an array of scored leads; n8n may hand it over as one item or many.',
        "const run = $('Check run').first().json;",
        'const rows = $input.all().flatMap((i) => (Array.isArray(i.json) ? i.json : Array.isArray(i.json.data) ? i.json.data : [i.json]));',
        'return rows.map((r) => ({ json: { run_date: (run.finished_at || "").slice(0, 10), run_id: run.id, ...r } }));',
      ].join('\n'),
    }),
    n('Google Sheet', 'n8n-nodes-base.googleSheets', 4.5, [1680, 200], {
      operation: 'appendOrUpdate',
      documentId: { __rl: true, mode: 'url', value: 'PASTE_YOUR_GOOGLE_SHEET_URL' },
      sheetName: { __rl: true, mode: 'name', value: sheetTab },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['domain'], schema: [] },
      options: {},
    }, { credentials: { googleSheetsOAuth2Api: { id: 'REPLACE_ON_IMPORT', name: 'Google Sheets account' } } }),
    n('Summary', 'n8n-nodes-base.code', 2, [1920, 200], {
      mode: 'runOnceForAllItems',
      jsCode: [
        "const run = $('Check run').first().json;",
        'return [{ json: { run_id: run.id, leads: run.leads, with_named_email: run.with_named_email, cost_usd: run.cost_usd, rows_written: $input.all().length, funnel: run.funnel } }];',
      ].join('\n'),
    }),
    n('Setup notes', 'n8n-nodes-base.stickyNote', 1, [0, -120], {
      width: 760,
      height: 280,
      content: [
        `## ${title}`,
        `Runs the ${preset} lead pipeline (no teardowns) and writes the scored leads, with remarks, to the Google Sheet tab "${sheetTab}" (rows are updated by domain).`,
        '',
        '1. Create a **Header Auth** credential named "Leads API": name `Authorization`, value `Bearer <LEADS_API_TOKEN from deploy/.env>`; select it in the three HTTP nodes.',
        '2. Connect Google Sheets in **Google Sheet** and paste your sheet URL. Create the tab first; the header row is written on the first run.',
        '3. The leads API must run on the same Docker network (lead-scraper/deploy). Test with **Run now**; a run takes 20-40 minutes.',
      ].join('\n'),
    }),
  ];
  const c = (from, to, output = 0) => [from, output, to];
  const edges = [
    c('Schedule', 'Start run'), c('Run now', 'Start run'), c('Start run', 'Wait 5 min'), c('Wait 5 min', 'Check run'), c('Check run', 'Done?'),
    c('Done?', 'Get scored leads', 0), c('Done?', 'Failed?', 1), c('Failed?', 'Stop: run failed', 0), c('Failed?', 'Wait 5 min', 1),
    c('Get scored leads', 'One row per lead'), c('One row per lead', 'Google Sheet'), c('Google Sheet', 'Summary'),
  ];
  const connections = {};
  for (const [from, out, to] of edges) {
    connections[from] ||= { main: [] };
    while (connections[from].main.length <= out) connections[from].main.push([]);
    connections[from].main[out].push({ node: to, type: 'main', index: 0 });
  }
  return { name: title, nodes, connections, settings: { executionOrder: 'v1', timezone: 'Asia/Kolkata' }, pinData: {} };
}

const FLOWS = [
  { preset: 'type_a', title: 'Leads: Type A (AI-built apps), weekly', sheetTab: 'Type A leads', cron: '17 7 * * 1' },
  { preset: 'type_b', title: 'Leads: Type B (funded AI SaaS), weekly', sheetTab: 'Type B leads', cron: '23 7 * * 2' },
  { preset: 'type_c', title: 'Leads: Type C (Shopify brands), weekly', sheetTab: 'Type C leads', cron: '29 7 * * 3' },
  { preset: 'type_b_jobs', title: 'Leads: Type B hiring a designer (job-post signal), weekly', sheetTab: 'Type B leads - job posts', cron: '41 7 * * 4' },
  { preset: 'type_c_jobs', title: 'Leads: Type C hiring a designer (job-post signal), weekly', sheetTab: 'Type C leads - job posts', cron: '47 7 * * 4' },
];
for (const f of FLOWS) {
  const wf = workflow(f);
  // Sanity: every connection points at a node that exists.
  const names = new Set(wf.nodes.map((x) => x.name));
  for (const [from, { main }] of Object.entries(wf.connections)) for (const outs of main) for (const e of outs) if (!names.has(from) || !names.has(e.node)) throw new Error(`bad edge ${from} -> ${e.node}`);
  const file = path.join(here, `${f.preset.replace(/_/g, '-')}-leads.json`);
  writeFileSync(file, JSON.stringify(wf, null, 2));
  console.log(`wrote ${path.relative(process.cwd(), file)} (${wf.nodes.length} nodes)`);
}
