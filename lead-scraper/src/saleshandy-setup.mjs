#!/usr/bin/env node
// SalesHandy setup for Kyre (sequences only; never touches Vera's sequences).
//
//   node src/saleshandy-setup.mjs list                      sequences + step IDs (read only)
//   node src/saleshandy-setup.mjs fields                    which Kyre custom fields are missing (read only)
//   node src/saleshandy-setup.mjs fields --live             create the missing ones
//   node src/saleshandy-setup.mjs copy --from "Kyre · Teardown · 17 Nov final (20)"      (dry run)
//   node src/saleshandy-setup.mjs copy --from "..." --live  create the six Kyre sequences (A/B/C x verified/catch-all),
//                                                           copying the steps and email content of the --from sequence
//                                                           so merge fields work exactly as in the one already sending
//   node src/saleshandy-setup.mjs webhook --url https://<n8n>/webhook/kyre-replies --secret-header X-Kyre-Key [--live]
//
// New sequences are created PAUSED with no sender accounts: attach the Kyre inboxes and the
// schedule in SalesHandy, then resume them yourself. Then write their step IDs into
// config/saleshandy.json (the "list" command prints them).
import { parseArgs } from 'node:util';
import { sequences, steps, createSequence, createStep, createWebhook, webhooks, ensureFields } from './saleshandy.mjs';

const { values: a, positionals } = parseArgs({ allowPositionals: true, options: { from: { type: 'string' }, live: { type: 'boolean', default: false }, url: { type: 'string' }, 'secret-header': { type: 'string', default: 'X-Kyre-Key' }, prefix: { type: 'string', default: 'Kyre' } } });
const cmd = positionals[0] || 'list';
const VERA = /vera/i;
const arr = (x) => (Array.isArray(x) ? x : x?.sequences || x?.steps || x?.data || []);

if (cmd === 'list') {
  for (const s of arr(await sequences())) {
    console.log(`${s.active ? 'active ' : 'paused '} ${s.id}  ${s.title}${VERA.test(s.title) ? '   (Vera: never used by Kyre)' : ''}`);
    for (const st of s.steps || []) console.log(`           step ${st.id}  #${st.number ?? st.order ?? ''} ${st.name || st.type || ''}`);
  }
} else if (cmd === 'fields') {
  const missing = await ensureFields({ dryRun: !a.live, log: console.log });
  console.log(missing.length ? `${missing.length} missing` : 'all Kyre fields exist');
} else if (cmd === 'copy') {
  if (!a.from) throw new Error('--from "<existing Kyre sequence title>" is required');
  const src = arr(await sequences(a.from)).find((s) => s.title === a.from) || arr(await sequences(a.from))[0];
  if (!src) throw new Error(`no sequence called "${a.from}"`);
  if (VERA.test(src.title)) throw new Error('refusing to copy a Vera sequence');
  const srcSteps = arr(await steps(src.id));
  console.log(`source "${src.title}": ${srcSteps.length} steps`);
  const names = [
    ['A', 'AI App Glow-Up'], ['B', 'Dashboard Sprint'], ['C', 'Accessibility + Conversion Fix'],
  ].flatMap(([k, offer]) => [[`${a.prefix} ${k} · ${offer} · verified`], [`${a.prefix} ${k} · ${offer} · catch-all`]]).map(([t]) => t);
  const existing = new Set(arr(await sequences()).map((s) => s.title));
  for (const title of names) {
    if (existing.has(title)) {
      console.log(`exists: ${title}`);
      continue;
    }
    if (!a.live) {
      console.log(`[dry run] would create "${title}" with ${srcSteps.length} steps`);
      continue;
    }
    const seq = await createSequence(title);
    const id = seq?.id || seq?.sequenceId;
    for (const st of srcSteps) {
      const variants = (st.variants || []).filter((v) => v.payload || v.subject || v.content).map((v) => ({ payload: v.payload || { subject: v.subject, content: v.content } }));
      if (!variants.length) continue;
      await createStep(id, { type: 'Email', variants, absoluteDays: st.absoluteDays || st.relativeDays || st.waitDays || 1 });
    }
    console.log(`created "${title}" (${id}), paused: attach Kyre inboxes + schedule in SalesHandy, then resume`);
  }
} else if (cmd === 'webhook') {
  if (!a.url) throw new Error('--url https://<your n8n>/webhook/kyre-replies is required');
  const events = ['reply-received', 'email-bounced', 'prospect-unsubscribed', 'sequence-paused', 'email-account-disconnected', 'email-account-paused'];
  const have = arr(await webhooks()).find((w) => w.webhookUrl === a.url || w.url === a.url);
  if (have) console.log(`webhook already exists for ${a.url}`);
  else if (!a.live) console.log(`[dry run] would create webhook -> ${a.url} for ${events.join(', ')} with header ${a['secret-header']}`);
  else {
    // The shared secret comes from the environment so it never lands in shell history or code.
    const secret = process.env.KYRE_WEBHOOK_SECRET;
    if (!secret) throw new Error('set KYRE_WEBHOOK_SECRET (the same value as in the n8n workflow)');
    await createWebhook({ name: 'Kyre replies to Telegram', url: a.url, events, headers: { [a['secret-header']]: secret } });
    console.log(`webhook created -> ${a.url}`);
  }
} else throw new Error(`unknown command ${cmd}`);
