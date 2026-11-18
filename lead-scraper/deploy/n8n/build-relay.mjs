#!/usr/bin/env node
// Builds deploy/n8n/kyre-telegram-relay.json: the n8n workflow behind every Kyre Telegram
// message.
//   POST /webhook/kyre-replies  SalesHandy webhook (reply-received, email-bounced,
//                               prospect-unsubscribed, sequence-paused, account problems)
//                               -> classify -> Telegram (out-of-office replies are dropped)
//   POST /webhook/kyre-notify   {"text": "..."} from the daily Claude run -> Telegram
// Both webhooks require the header X-Kyre-Key (n8n "Header Auth" credential), so nobody else
// can post into your Telegram. The bot token lives only in n8n's Telegram credential.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { saleshandyAlert } from '../../src/replies.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const uuid = (seed) => {
  const h = crypto.createHash('sha1').update(seed).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), '4' + h.slice(13, 16), '8' + h.slice(17, 20), h.slice(20, 32)].join('-');
};
const n = (name, type, typeVersion, position, parameters, extra = {}) => ({ id: uuid(`kyre-relay:${name}`), name, type, typeVersion, position, parameters, ...extra });
const AUTH = { httpHeaderAuth: { id: 'REPLACE_ON_IMPORT', name: 'Kyre webhook secret' } };
const TG = { telegramApi: { id: 'REPLACE_ON_IMPORT', name: 'Kyre Telegram bot' } };
const CHAT = 'PASTE_YOUR_TELEGRAM_CHAT_ID';
const tgParams = (text) => ({ chatId: CHAT, text, additionalFields: { parse_mode: 'HTML', disable_web_page_preview: true, appendAttribution: false } });

const nodes = [
  n('SalesHandy events', 'n8n-nodes-base.webhook', 2, [0, 0], { httpMethod: 'POST', path: 'kyre-replies', authentication: 'headerAuth', responseMode: 'onReceived', options: {} }, { webhookId: uuid('kyre-replies'), credentials: AUTH }),
  n('Read the event', 'n8n-nodes-base.code', 2, [260, 0], {
    mode: 'runOnceForEachItem',
    jsCode: ['// Generated from lead-scraper/src/replies.mjs. Edit there, then rebuild.', saleshandyAlert.toString(), '', 'return { json: saleshandyAlert($json.body || $json) };'].join('\n'),
  }),
  n('Worth a ping?', 'n8n-nodes-base.if', 2.2, [520, 0], {
    conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [{ id: uuid('notify-cond'), leftValue: '={{ $json.notify }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' },
    options: {},
  }),
  n('Telegram: reply alert', 'n8n-nodes-base.telegram', 1.2, [780, -60], tgParams('={{ $json.text }}'), { credentials: TG }),
  n('Daily run notice', 'n8n-nodes-base.webhook', 2, [0, 300], { httpMethod: 'POST', path: 'kyre-notify', authentication: 'headerAuth', responseMode: 'onReceived', options: {} }, { webhookId: uuid('kyre-notify'), credentials: AUTH }),
  n('Telegram: daily notice', 'n8n-nodes-base.telegram', 1.2, [260, 300], tgParams('={{ $json.body.text }}'), { credentials: TG }),
  n('Setup notes', 'n8n-nodes-base.stickyNote', 1, [0, -320], {
    width: 760,
    height: 260,
    content: [
      '## Kyre: Telegram alerts',
      '1. Telegram: message @BotFather, /newbot, copy the token into a **Telegram** credential named "Kyre Telegram bot". Send your bot a message, then get your chat id (e.g. from @userinfobot) and paste it into both Telegram nodes (Chat ID).',
      '2. Create a **Header Auth** credential "Kyre webhook secret": name `X-Kyre-Key`, value = a long random string (`openssl rand -hex 24`). Select it on both webhooks.',
      '3. Activate. SalesHandy webhook URL: `https://<your-n8n>/webhook/kyre-replies` (create it with `node src/saleshandy-setup.mjs webhook ...`). Daily notices: `https://<your-n8n>/webhook/kyre-notify`.',
    ].join('\n'),
  }),
];
const connections = {
  'SalesHandy events': { main: [[{ node: 'Read the event', type: 'main', index: 0 }]] },
  'Read the event': { main: [[{ node: 'Worth a ping?', type: 'main', index: 0 }]] },
  'Worth a ping?': { main: [[{ node: 'Telegram: reply alert', type: 'main', index: 0 }], []] },
  'Daily run notice': { main: [[{ node: 'Telegram: daily notice', type: 'main', index: 0 }]] },
};
const wf = { name: 'Kyre: Telegram alerts (replies + daily run)', nodes, connections, settings: { executionOrder: 'v1', timezone: 'Asia/Kolkata' }, pinData: {} };
writeFileSync(path.join(here, 'kyre-telegram-relay.json'), JSON.stringify(wf, null, 2));
console.log(`wrote deploy/n8n/kyre-telegram-relay.json (${nodes.length} nodes)`);
