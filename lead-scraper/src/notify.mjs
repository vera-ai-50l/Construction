#!/usr/bin/env node
// Send a Telegram message through the n8n relay (deploy/n8n/kyre-telegram-relay.json).
// KYRE_NOTIFY_URL = https://<your-n8n>/webhook/kyre-notify
// The header X-Kyre-Key is added by the cloud proxy (saved network secret for the n8n host),
// or from KYRE_WEBHOOK_SECRET when run elsewhere. Without KYRE_NOTIFY_URL it only prints.
//   node src/notify.mjs "text"      or      echo "text" | node src/notify.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function notify(text, { log = console.error } = {}) {
  const url = process.env.KYRE_NOTIFY_URL;
  if (!url) {
    log(`[notify, no KYRE_NOTIFY_URL set]\n${text}`);
    return { sent: false };
  }
  const headers = { 'content-type': 'application/json' };
  if (process.env.KYRE_WEBHOOK_SECRET) headers['X-Kyre-Key'] = process.env.KYRE_WEBHOOK_SECRET;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ text }), signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`notify failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return { sent: true };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let text = process.argv.slice(2).join(' ');
  if (!text) for await (const c of process.stdin) text += c;
  console.log(JSON.stringify(await notify(text.trim())));
}
