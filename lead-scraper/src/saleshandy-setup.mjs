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
//   node src/saleshandy-setup.mjs batch --csv <file> --title "Kyre · Free report · 20 Nov (25)" --from "<template sequence>"
//        [--schedule "<schedule name>"] [--senders a@trykyre.com,b@trykyre.com] [--live] [--start]
//        one CSV -> one new sequence: the template's steps, settings and schedule; the line above
//        "Hi <name>," goes in the preheader (inbox preview); Kyre inboxes only; every push check
//        (shared inboxes, DE/AT, anyone already in SalesHandy, daily caps). --start resumes it.
//   node src/saleshandy-setup.mjs webhook --url https://<n8n>/webhook/kyre-replies --secret-header X-Kyre-Key [--live]
//
// New sequences are created PAUSED with no sender accounts: attach the Kyre inboxes and the
// schedule in SalesHandy, then resume them yourself. Then write their step IDs into
// config/saleshandy.json (the "list" command prints them).
import { parseArgs } from 'node:util';
import { sequences, steps, createSequence, createStep, createWebhook, webhooks, ensureFields, sequenceSettings, updateSettings, schedules, emailAccounts, isKyreSender, assertKyreSenders, importProspects, setSequenceStatus } from './saleshandy.mjs';
import { readQueue, plan, toProspect, saleshandyLog } from './push.mjs';

const { values: a, positionals } = parseArgs({ allowPositionals: true, options: { from: { type: 'string' }, csv: { type: 'string' }, title: { type: 'string' }, schedule: { type: 'string' }, senders: { type: 'string' }, start: { type: 'boolean', default: false }, cap: { type: 'string', default: '40' }, live: { type: 'boolean', default: false }, one: { type: 'boolean', default: false }, url: { type: 'string' }, 'secret-header': { type: 'string', default: 'X-Kyre-Key' }, prefix: { type: 'string', default: 'Kyre' } } });
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
  const all = arr(await sequences());
  const ordered = [...srcSteps].sort((x, y) => x.number - y.number);
  const want = ordered.map((st) => st.relativeDays);
  for (const title of names) {
    const have = all.find((s) => s.title === title);
    const haveSteps = have ? arr(await steps(have.id)).length : 0;
    if (have && haveSteps >= ordered.length) {
      console.log(`exists: ${title}`);
      continue;
    }
    if (!a.live) {
      console.log(`[dry run] would ${have ? 'finish' : 'create'} "${title}" with ${ordered.length} steps`);
      continue;
    }
    let id = have?.id;
    if (!id) {
      const kyre = (await emailAccounts()).filter((x) => x.status === 1 && isKyreSender(x.fromEmail));
      if (!kyre.length) throw new Error('no active Kyre inbox to send from');
      const made = await createSequence(title, { emailAccountIds: kyre.map((x) => x.id) });
      id = made?.id || made?.sequenceId || made?.sequence?.id || arr(await sequences(title)).find((s) => s.title === title)?.id;
      if (!id) throw new Error(`created "${title}" but could not read its id`);
    }
    // relativeDays is the wait after the previous step (0, 3, 5); absoluteDays is the send day (1, 4, 9).
    let day = 1;
    for (const [i, st] of ordered.entries()) {
      if (i > 0) day += Number(st.relativeDays) || 1;
      if (i < haveSteps) continue;
      const variants = (st.variants || []).map((v) => { const p = v.payload || v; return { payload: { subject: p.subject || '', content: p.content || '' } }; }).filter((v) => v.payload.content);
      if (!variants.length) continue;
      await createStep(id, { type: 1, variants, absoluteDays: day }); // type 1 = Email (the API refuses the name)
    }
    const made = arr(await steps(id)).sort((x, y) => x.number - y.number).map((st) => st.relativeDays);
    console.log(`${have ? 'finished' : 'created'} "${title}" (${id}), paused. Waits ${made.join('/')} days (template ${want.join('/')})`);
    if (made.join() !== want.join()) throw new Error(`step timing differs from the template: stopping so you can check "${title}" in SalesHandy`);
    if (a.one) break;
  }
} else if (cmd === 'batch') {
  if (!a.csv || !a.title || !a.from) throw new Error('batch needs --csv, --title and --from "<template sequence>"');
  if (VERA.test(a.title) || VERA.test(a.from)) throw new Error('Kyre never uses Vera sequences');
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const rows = readQueue(a.csv);
  const known = await saleshandyLog();
  const cfg = { dailyCap: Number(a.cap), catchAllDailyCap: 30, steps: Object.fromEntries(['A', 'B', 'C'].map((k) => [k, { verified: 'NEW', catch_all: 'NEW' }])) };
  const decisions = plan(rows, cfg, { log: known }, today);
  const go = decisions.filter((d) => !d.skip).map((d) => rows.find((r) => String(r.email).toLowerCase().trim() === d.email));
  const prospects = go.map(toProspect);
  const problems = prospects.filter((p) => !p.Opener || !p.Greeting || !p['Body 1'] || !p['Body 2'] || p['Body 3'] || !p['Follow Up 1A'] || !p['Follow Up 2A']).map((p) => p.Email);
  for (const d of decisions.filter((x) => x.skip)) console.log(`held back: ${d.email} (${d.skip})`);
  console.log(`${prospects.length} of ${rows.length} pass the checks (${go.filter((r) => /^1|ok/i.test(r.send_group || r.email_verification)).length} verified)`);
  if (problems.length) throw new Error(`email text does not fit Opener / Greeting / Body 1-2 / Follow Up 1A-2B for: ${problems.join(', ')}`);
  const src = arr(await sequences(a.from)).find((x) => x.title === a.from);
  if (!src) throw new Error(`no sequence called "${a.from}"`);
  const srcSteps = arr(await steps(src.id)).sort((x, y) => x.number - y.number);
  const srcSettings = await sequenceSettings(src.id);
  const sched = a.schedule ? (await schedules()).find((x) => x.name === a.schedule) : srcSettings?.schedule;
  if (!sched) throw new Error(`no schedule called "${a.schedule}"`);
  const wanted = a.senders ? a.senders.split(',').map((x) => x.trim().toLowerCase()) : null;
  const senders = (await emailAccounts()).filter((x) => x.status === 1 && isKyreSender(x.fromEmail) && (!wanted || wanted.includes(x.fromEmail.toLowerCase())));
  if (!senders.length) throw new Error('no active Kyre inbox to send from');
  console.log(`template "${src.title}": ${srcSteps.length} steps, waits ${srcSteps.map((x) => x.relativeDays).join('/')} days`);
  console.log(`schedule: ${sched.name} (${sched.timezone})`);
  console.log(`senders: ${senders.map((x) => x.fromEmail).join(', ')}`);
  console.log(`preview of the first email: [${prospects[0]?.Opener}] ${prospects[0]?.Greeting} ${prospects[0]?.['Body 1'].slice(0, 80)}...`);
  if (!a.live) {
    console.log(`[dry run] would create "${a.title}" with ${prospects.length} prospects${a.start ? ' and start it' : ' (paused)'}`);
  } else {
    if (arr(await sequences(a.title)).some((x) => x.title === a.title)) throw new Error(`"${a.title}" already exists`);
    const made = await createSequence(a.title, { emailAccountIds: senders.map((x) => x.id), scheduleId: sched.id });
    const id = made?.id || made?.sequenceId || made?.sequence?.id || arr(await sequences(a.title)).find((x) => x.title === a.title)?.id;
    if (!id) throw new Error('created the sequence but could not read its id');
    console.log(`created "${a.title}" (${id})`);
    await assertKyreSenders(id, a.title);
    let day = 1;
    for (const [i, st] of srcSteps.entries()) {
      if (i > 0) day += Number(st.relativeDays) || 1;
      const variants = st.variants.map((v) => ({ payload: { subject: v.payload.subject || '', content: v.payload.content || '', preheader: i === 0 ? '{{Opener}}' : v.payload.preheader || '' } }));
      await createStep(id, { type: 1, variants, absoluteDays: day });
    }
    const newSteps = arr(await steps(id)).sort((x, y) => x.number - y.number);
    if (newSteps.map((x) => x.relativeDays).join() !== srcSteps.map((x) => x.relativeDays).join()) throw new Error('step timing differs from the template: check it in SalesHandy before importing');
    const settings = (srcSettings?.settings || []).map((x) => ({ code: x.code, value: String(x.value ?? '') }));
    if (settings.length) await updateSettings(id, settings);
    const r = await importProspects(newSteps[0].id, prospects, { log: console.log });
    console.log(`imported: ${JSON.stringify(r).slice(0, 300)}`);
    if (a.start) {
      await setSequenceStatus([id], 'resume');
      console.log(`started: sends in "${sched.name}" (${sched.timezone}), within each inbox's daily limit`);
    } else console.log('left paused');
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
