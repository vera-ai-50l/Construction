# Desk 05: One-day Mobilisation

Open a new site in one day instead of three. The contractor sends papers and photos on WhatsApp from three days before the visit. Vera checks each paper against the site's own facts and sends a gap list every evening. On the day, the engineer uses a phone page: tap a line, take the photo, speak the remark. GPS is stored with each photo, and QR stickers place photos in rooms where GPS cannot. By evening the NOC report is drafted and waits for his one-tap sign-off. Afterwards the contractor closes open items by replying with a photo, and the engineer accepts them from his phone.

**The board** (`docs/desk-05/board.html`, published as a private artifact) covers who it is for, the three decisions and every node. This file covers how to run it.

## What is here

| Path | What it is |
|---|---|
| `n8n/mobilise/checklist.mjs` | The checklist template `mob-v1`: 77 lines in 7 areas, each with evidence type, severity, paper checks and a "good evidence" hint. QA/EHS values in `params`. |
| `n8n/mobilise/logic.mjs` | Every decision made by code: line binding, AI confidence gate, paper checks, geofence, gap list, scoring, report. Each function is pasted whole into an n8n Code node. |
| `n8n/mobilise/workflows.mjs` | The 13 n8n workflows, defined once. Each node says what it does and which guardrails it has. |
| `n8n/mobilise/build.mjs` | `check` (tests + guardrail lint), `build` (n8n JSON, board page, walk sample), `validate` (n8n-mcp schema check). |
| `n8n/mobilise/test.mjs` | 114 checks. They run the generated Code-node source, the same text n8n runs. |
| `n8n/mobilise/schema.sql` | Postgres tables, the `apply_answer` and `file_evidence` functions for button answers, and the `ai_accuracy` view. Safe to run again on an existing database (it adds the new columns). |
| `n8n/mobilise/dist/*.json` | Importable workflows (rebuilt by `npm run build:mobilise`). |
| `app/walk`, `components/walk/Walk.tsx` | The engineer's walk page. Without a link token it runs as a demo on the sample site. |
| `components/walk/SiteMap.tsx` | The site map on the walk page: drawn areas, his position and trail; mark an area by standing in it or walking its corners. |
| `app/walk/stickers`, `components/walk/Stickers.tsx` | Printable QR stickers (A4), signed for one site. |

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
| 03 | Walk page API | Webhook GET / POST `vera/mob/walk` (capture, trail, finish, zone, spot, stickers) |
| 04 | Evening gap list | 7 PM daily, or the contractor typing "status" |
| 05 | One reply per burst | Every minute |
| 06 | NOC report draft | Walk finished, or 9 PM safety net |
| 07 | Open items after the visit | 9 AM daily |
| 08 | Set up a new site | n8n form |
| 09 | Send on WhatsApp | Called by everything that sends |
| 10 | Read and check a paper | Called by 02 when a paper is filed by a button tap |
| 11 | Show a file with buttons | Called by 02 (engineer closes an item) and 12 (reviewer) |
| 12 | Review queue on WhatsApp | Every 5 minutes |

## Decisions in one line each

- **Channel**: WhatsApp Cloud API direct, with our own n8n workflow and narrow AI calls. Not Meta Business Agent (customer-service bot, no control over filing or the audit trail). Not a general AI agent (hard to audit; Meta's terms from 15 Jan 2026 bar general-purpose assistants on the Business API). A BSP is optional. The walk page is needed for the visit day because WhatsApp removes location data from photos.
- **GPS**: The browser's high-accuracy location on the walk page, with the phone's own ± metres. Results are in / edge / out / unknown against each area's shape. Areas come from the contractor's location pins at T−3; the engineer replaces them on the day from the walk page (stand in the area, or walk its corners; fixes weaker than ±30 m are refused). GPS proves the area, not the room or floor: for those, signed QR stickers at the door. Phones are typically ±3–5 m in the open, ±10–30 m near towers and ±30–100 m indoors.
- **Photo to line**: The engineer chooses the line before taking the photo, so there is nothing to tag. The contractor binds by replying to our message (line, open item or area + number) or with a code in the caption or file name. AI is used only when none of these is given. It picks from that area's open lines, and the answer schema allows only those codes. At ≥ 0.90 with a 0.30 lead the item is filed; between 0.45 and 0.90 the sender gets buttons; otherwise a Vera reviewer decides on WhatsApp. Shadow mode (on by default for a new site) sends every AI choice to the sender as buttons, and the `ai_accuracy` view measures how often AI was right before auto-filing is switched on. AI never judges compliance; a paper filed by a button is still read and checked (WF-10).
- **The 24-hour window**: messages with their own approved template use it. Anything else (buttons, a photo to approve, the NOC to sign) is held, and one generic template `vera_mob_action_needed` with a **Show me** button is sent instead; the tap opens the window and Vera sends what was held.

## Deploying

1. **Database**: run `schema.sql` on the Vera Postgres.
2. **Server**: `infra/docker-compose.yml` now adds the Desk 05 variables and a Gotenberg container for PDFs. Fill in the new lines in `infra/.env.example`.
3. **Reviewers**: add each Vera reviewer as a contact with no site: `insert into contacts (mobilisation_id, phone, name, role) values (null, '91…', 'Name', 'reviewer');`. Review items wait until there is at least one.
4. **Credentials in n8n**: create these, with these names. The ids in the JSON are placeholders; n8n asks you to map them on import.
   - `Vera Postgres`
   - `WhatsApp Cloud API token` (Header Auth, `Authorization: Bearer <system user token>`)
   - `Anthropic API key` (Header Auth, `x-api-key`)
   - `Sarvam API key` (Header Auth, `api-subscription-key`)
   - `Vera evidence bucket` (AWS, ap-south-1)
   - `Vera ops email` (SMTP)
5. **Import**: import 09, 11 and 00 first, then the rest (`n8n import:workflow --input=…`), then publish each. Every workflow already names WF-00 as its error workflow.
6. **Meta app**: set the callback URL to `https://<n8n>/webhook/vera/mob/wa` with `VERA_WA_VERIFY_TOKEN`, and subscribe to `messages`. Meta allows one webhook per app, which is why WF-01 is the only door in.
7. **Templates to get approved** (utility): `vera_mob_welcome`, `vera_mob_gap_list`, `vera_mob_engineer_brief`, `vera_mob_walk_link`, `vera_mob_open_item`, `vera_mob_escalation`, and `vera_mob_action_needed` (body: "Vera has {{1}} for you.", one quick-reply button "Show me"). Their parameters are in the workflows.
8. **Walk page**: set `NEXT_PUBLIC_VERA_N8N_URL` on the Next.js deployment, and set `VERA_WALK_URL` to `<site>/walk`.

## How it was checked

- `npm run check:mobilise`: 114 checks pass. They cover the decision functions and the generated Code-node source (signature check, file hash, walk link and sticker sign and verify, retry counter, shadow mode). The lint checks that every error output is wired, every Switch has a fallback, SQL uses parameters only, and every webhook path answers.
- n8n-mcp `validate_workflow`: 0 errors and 0 warnings on all 13 workflows.
- Imported and published in n8n 2.44.5, then run against a real Postgres:
  - WhatsApp in: Meta verify with the right and wrong token, an unsigned POST (401), a duplicate delivery (dropped), an unknown number (logged), a photo whose download failed (review queue).
  - Gap list on "baki kya hai?": sent to the contractor and the engineer (logged as not sent, because Meta is unreachable from the test box).
  - N/A: the request reaches the engineer; an N/A for a line not on the site gets help instead; his "Approve" marks the line N/A and the contractor is told.
  - Closing an item from a photo: the engineer's "Accept" closes the item and the line; the contractor pressing the same button is refused.
  - A PDF confirmed by button is filed and sent to WF-10 for reading (bucket unreachable here, so it goes to the review queue).
  - "Show me" releases the held message and sends it again.
  - Reviewer: WF-12 hands out items, WF-11 sends each (text and buttons still go when the file cannot be fetched); the reviewer files a photo on a line and accepts a paper; a contractor cannot use a reviewer button; `ai_accuracy` counts the confirmed items.
  - Walk page: checklist load, forged link (401), invalid capture (400), storage outage (503), trail points (204), marking an area (saved; a ±60 m fix refused), stickers (signed; an edited code refused), finish (202; the PDF service is down here, so the review queue gets the reason).
  - No message left in "processing".
- The walk page, site map and sticker sheet were run in a phone-sized browser (Playwright, iPhone 13 profile) with no errors.
- These runs found and fixed nine bugs:
  - a retry loop that never stopped
  - messages left in "processing"
  - bigint ids rejected by typed inputs
  - the webhook path parameter
  - a UUID cast that ran before validation
  - the confirm flow, which had no evidence row to bind to
  - the engineer's evening line never sent (it read the contractor send's output)
  - the N/A request had no engineer to go to, and a line code was cast to a number
  - template button replies ("Show me") fell into "what we accept"
- **Not run yet**: real Meta, Claude, Sarvam and S3 calls (no credentials or network access to them here), and the walk page on a real phone at a real site.

## Known limits and next steps

- The checklist values marked "set by QA" must come from the developer's QA and EHS teams.
- A QR sticker proves the walk link was used to scan it, not that the phone was at the door: a photo of a sticker could be scanned elsewhere. Each scan keeps its GPS and time, so a mismatch shows in the record; the report does not yet flag it on its own.
- A web page cannot detect fake-GPS apps. The cross-checks are the photo itself, server time against phone time, the continuous trail and the stickers.
- Marking an area needs signal at that moment (it is not queued like captures).
- The site map is a plain drawing in metres with no satellite background, so it works offline and sends nothing to a map provider. A satellite view for drawing areas from the office is a possible addition.
- The AI auto-file threshold (0.90 with a 0.30 lead) is a starting value. Set it from the `ai_accuracy` view after the shadow-mode sites.

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
