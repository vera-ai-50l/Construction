# Desk 05: One-day Mobilisation

Open a new site in one day instead of three. The contractor sends papers and photos on WhatsApp from three days before the visit. Vera checks each paper against the site's own facts and sends a gap list every evening. On the day, the engineer uses a phone page: tap a line, take the photo, speak the remark. GPS is stored with each photo. By evening the NOC report is drafted and waits for his one-tap sign-off.

**The board** (`docs/desk-05/board.html`, published as a private artifact) covers who it is for, the three decisions and every node. This file covers how to run it.

## What is here

| Path | What it is |
|---|---|
| `n8n/mobilise/checklist.mjs` | The checklist template `mob-v1`: 77 lines in 7 areas, each with evidence type, severity, paper checks and a "good evidence" hint. QA/EHS values in `params`. |
| `n8n/mobilise/logic.mjs` | Every decision made by code: line binding, AI confidence gate, paper checks, geofence, gap list, scoring, report. Each function is pasted whole into an n8n Code node. |
| `n8n/mobilise/workflows.mjs` | The 10 n8n workflows, defined once. Each node says what it does and which guardrails it has. |
| `n8n/mobilise/build.mjs` | `check` (tests + guardrail lint), `build` (n8n JSON, board page, walk sample), `validate` (n8n-mcp schema check). |
| `n8n/mobilise/test.mjs` | 88 checks. They run the generated Code-node source, the same text n8n runs. |
| `n8n/mobilise/schema.sql` | Postgres tables and the `apply_answer` function for button answers. |
| `n8n/mobilise/dist/*.json` | Importable workflows (rebuilt by `npm run build:mobilise`). |
| `app/walk`, `components/walk/Walk.tsx` | The engineer's walk page. Without a link token it runs as a demo on the sample site. |

```bash
npm run check:mobilise
```

```bash
npm run build:mobilise
```

## The workflows

| | Workflow | Trigger |
|---|---|---|
| 00 | Errors and stuck messages | Error Trigger for all others, plus a 10-minute sweeper |
| 01 | WhatsApp in (router) | Meta webhook: verify (GET), events (POST) |
| 02 | Process one message | Called by 01 for each new message |
| 03 | Walk page API | Webhook GET / POST `vera/mob/walk` |
| 04 | Evening gap list | 7 PM daily, or the contractor typing "status" |
| 05 | One reply per burst | Every minute |
| 06 | NOC report draft | Walk finished, or 9 PM safety net |
| 07 | Open items after the visit | 9 AM daily |
| 08 | Set up a new site | n8n form |
| 09 | Send on WhatsApp | Called by everything that sends |

## Decisions in one line each

- **Channel**: WhatsApp Cloud API direct, with our own n8n workflow and narrow AI calls. Not Meta Business Agent (customer-service bot, no control over filing or the audit trail). Not a general AI agent (hard to audit; Meta's terms from 15 Jan 2026 bar general-purpose assistants on the Business API). A BSP is optional. The walk page is needed for the visit day because WhatsApp removes location data from photos.
- **GPS**: The browser's high-accuracy location on the walk page, with the phone's own ± metres. Results are in / edge / out / unknown against areas drawn on a map, or pinned by the contractor. It proves the area, not the room or floor; a QR sticker can cover rooms. Phones are typically ±3–5 m in the open, ±10–30 m near towers and ±30–100 m indoors.
- **Photo to line**: The engineer chooses the line before taking the photo, so there is nothing to tag. The contractor binds by replying to our message (line, open item or area + number) or with a code in the caption or file name. AI is used only when none of these is given. It picks from that area's open lines, and the answer schema allows only those codes. At ≥ 0.90 with a 0.30 lead the item is filed; between 0.45 and 0.90 the sender gets buttons; otherwise a person decides. AI never judges compliance.

## Deploying

1. **Database**: run `schema.sql` on the Vera Postgres.
2. **Server**: `infra/docker-compose.yml` now adds the Desk 05 variables and a Gotenberg container for PDFs. Fill in the new lines in `infra/.env.example`.
3. **Credentials in n8n**: create these, with these names. The ids in the JSON are placeholders; n8n asks you to map them on import.
   - `Vera Postgres`
   - `WhatsApp Cloud API token` (Header Auth, `Authorization: Bearer <system user token>`)
   - `Anthropic API key` (Header Auth, `x-api-key`)
   - `Sarvam API key` (Header Auth, `api-subscription-key`)
   - `Vera evidence bucket` (AWS, ap-south-1)
   - `Vera ops email` (SMTP)
4. **Import**: import 09 and 00 first, then the rest (`n8n import:workflow --input=…`), then publish each. Every workflow already names WF-00 as its error workflow.
5. **Meta app**: set the callback URL to `https://<n8n>/webhook/vera/mob/wa` with `VERA_WA_VERIFY_TOKEN`, and subscribe to `messages`. Meta allows one webhook per app, which is why WF-01 is the only door in.
6. **Templates to get approved** (utility): `vera_mob_welcome`, `vera_mob_gap_list`, `vera_mob_engineer_brief`, `vera_mob_walk_link`, `vera_mob_open_item`, `vera_mob_escalation`. Their parameters are in the workflows.
7. **Walk page**: set `NEXT_PUBLIC_VERA_N8N_URL` on the Next.js deployment, and set `VERA_WALK_URL` to `<site>/walk`.

## How it was checked

- `npm run check:mobilise`: 88 checks pass. They cover the decision functions and the generated Code-node source (signature check, file hash, walk link sign and verify, retry counter). The lint checks that every error output is wired, every Switch has a fallback, SQL uses parameters only, and every webhook path answers.
- n8n-mcp `validate_workflow` (strict): 0 errors on all 10 workflows.
- Imported and published in n8n 2.44.5, then run against a real Postgres:
  - Meta verify, both the right and wrong token
  - an unsigned POST (401)
  - a signed text message, which builds the gap list and logs the send as not sent because Meta is unreachable from the test box
  - a duplicate delivery (dropped)
  - an unknown number (logged)
  - a photo whose download failed (sent to the review queue)
  - a walk-page checklist load, a forged link (401) and an invalid capture (400)
  - a storage outage (503) and trail points (204)
- That run found and fixed six bugs:
  - a retry loop that never stopped
  - messages left in "processing"
  - bigint ids rejected by typed inputs
  - the webhook path parameter
  - a UUID cast that ran before validation
  - the confirm flow, which had no evidence row to bind to
- **Not run yet**: real Meta, Claude, Sarvam and S3 calls (no credentials or network access to them here), and the walk page on a real phone at a real site.

## Known limits (v1) and next steps

- A paper filed by a button answer, rather than read automatically, goes to the review queue for its paper checks. Next: re-read it from S3 automatically.
- The review queue is a table. Next: send each item to a Vera reviewer number on WhatsApp with buttons.
- Area drawing is done in SQL or with contractor pins. Next: a map screen on the walk page.
- QR stickers for rooms and floors are designed but not built.
- Shadow mode (a person confirms every AI filing on the first two sites) is a process step. The AI's answer is stored in `evidence.ai` so the accuracy can be measured.
- The checklist values marked "set by QA" must come from the developer's QA and EHS teams.

## Sources

- Meta, WhatsApp Flows media upload components (PhotoPicker camera-only, limits): https://developers.facebook.com/docs/whatsapp/flows/reference/media_upload
- Meta, location request messages: https://developers.secure.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/location-request-messages
- Meta, media URLs expire after 5 minutes: https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media
- Meta Business Agent Platform capabilities: https://developers.facebook.com/documentation/meta-business-agent/capabilities
- 360dialog, Meta Business Agent known limitations: https://docs.360dialog.com/docs/mba/meta-business-agent/known-limitations
- Meta Business Agent in India (July 2026): https://www.businesstoday.in/technology/artificial-intelligence/story/meta-unveils-ai-business-agent-platform-for-whatsapp-instagram-and-messenger-534739-2026-06-03
- WhatsApp general-purpose chatbot policy from 15 Jan 2026: https://respond.io/blog/whatsapp-general-purpose-chatbots-ban
- WhatsApp pricing (per message, India): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing and https://baat.ai/blog/whatsapp-api-pricing-india
- n8n WhatsApp Trigger, one webhook per app: https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.whatsappTrigger/
- WhatsApp strips photo location in photo mode: https://www.fast.io/resources/whatsapp-telegram-signal-photo-metadata-preservation/
- MDN, `GeolocationCoordinates.accuracy` (metres, 95% confidence): https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates/accuracy
- Smartphone GNSS accuracy and multipath: https://pmc.ncbi.nlm.nih.gov/articles/PMC9788430/ and https://insidegnss.com/?p=186033
- Labour Codes in force from 21 Nov 2025 (OSH Code covers BOCW and CLRA): https://www.livelaw.in/amp/top-stories/centre-brings-four-labour-codes-into-operation-with-effect-from-november-21-310772
- Sarvam speech-to-text (saaras:v3, codemix mode): https://docs.sarvam.ai/api/changelog
- n8n skills used while building: https://github.com/czlonkowski/n8n-skills
