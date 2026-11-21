# Vera: build handover (first beta client)

21 Nov 2026 · For a new chat that will plan, then build, the real Vera product. Read all of it before doing anything.

---

## 0. How to use this document

You are the engineer and product architect for Vera AI. The work has two phases, in this order:

1. **Plan (no product code).** For each product: the end-to-end workflow, the tools, the data model, where a human checks the output, what can go wrong, and the effort. Then one shared architecture. The founders review and approve it.
2. **Build.** Only after the plan is approved. The first beta site is the priority; build what it needs first.

Ask the founders when something here is unclear or a decision is theirs (sections 7 and 9 list the open ones). Don't guess at what the client said.

---

## 1. The situation, honestly

- **A first client has agreed to run a beta** of Vera on one of his sites. He was shown the five products on the review page (`https://getveraai.vercel.app/review`, source in this repo, see section 4). He will share the number of his **senior engineer**, who will be our day-to-day contact on site.
- **The product is not built.** What exists is a convincing demo, not a working system:
  - The web page and its animations are real.
  - Behind it, two or three **n8n workflows** run plain JavaScript on **fictional sample JSON**. They prove the logic and the maths (matching, norms, wastage, money at risk), nothing more.
  - There is **no** real data intake: no WhatsApp connection, no speech-to-text, no reading of challan photos, no reading of registers or Excel files.
  - "Reading" a site message today is **keyword and alias matching** on pre-written sample text. There is no AI model in the loop.
  - No database, no logins, no per-client separation, no delivery (nothing is actually sent on WhatsApp, no PDFs, no real Tally file).
- **What we promised on the page** (section 3) is the bar. Where we can't meet it for the beta, we say so to the client before the beta starts, not after.

**Client details (founders to fill in):**

| | |
|---|---|
| Client firm | [name, contractor or developer, size, number of live sites] |
| Who agreed | [name, role] |
| Beta site | [site name, location, stage of work, approx. size] |
| Senior engineer | [name, contact comes from the client] |
| Products he showed interest in | [which of the five] |
| What he said he wants to see | [his words] |
| NDA | [signed / to be signed] |
| Agreed start date and length | [ ] |

---

## 2. Company context

- **Vera AI:** an AI back office for **mid-size Indian construction contractors and developers** (roughly ₹50–500 Cr revenue) in Mumbai, Thane, Navi Mumbai and Pune. The buyer is the MD or owner, often also the project head.
- **The core idea:** site teams already report on **WhatsApp** (voice notes in Hindi or Marathi, Hinglish texts, photos, challan photos) and keep registers in Excel or on paper. Vera turns what already exists into records, and finds where material money leaks. **No new app for the site team.**
- **Team:** three founders, roughly 5, 8 and 5–6 hours a day. Plans must fit that.
- **Commercial ladder:** free 2-hour site-record test → free one-package material check (under NDA) → paid Material Leak Check (₹50,000 + a share of client-confirmed recoveries) → Site Record Desk monthly subscription (price not set). Pilots are free or at cost.

**Rules that are not negotiable:**

- **Money maths in code, never in an AI model.** AI may read and extract (voice, photos, handwriting); every quantity, rate and rupee figure is computed in deterministic code and traceable to a source line (slip number, challan number, message).
- **Never guess.** A message, photo or row Vera can't read confidently is marked for a person to check, never filled in.
- **No real client data without a signed NDA.** Client data never goes into git, sample files, screenshots or prompts shared outside the team. Agree what we keep and when we delete it.
- **Sample data is fictional** and labelled as sample data.
- **Never use Lodha's name or logo** in anything client-facing, marketing or public. (Lodha is a warm relationship, not a client.)
- **India's DPDP rules apply from May 2027.** Design for consent, a record of where data came from, and deletion from the start.
- **No secrets in files.** API keys live in environment variables or the server, never in the repo.
- Writing style for anything client-facing: plain, short, no em dashes.

---

## 3. The five products as promised (the review page)

The review page is the developer view. It shows these five, in this order. "Promised" is what the page tells the client; "Demo today" is what actually exists.

### 3.1 One-day Site Opening (for developers)

- **Promise:** the first inspection of a new site, done and written up in **one day instead of three**.
- **Inputs:** the developer's mobilisation checklist (50–100 points); contractor certificates sent on WhatsApp; photos taken on the walk; spoken remarks.
- **Steps promised:**
  1. Load their checklist once.
  2. Three days before: the contractor sends certificates on WhatsApp; Vera reads each one (BOCW registration, labour licence, workmen's compensation, CAR insurance, plant calibration, consent to operate) and checks names, dates and amounts.
  3. That evening: one list to the contractor of what's missing, expired or short.
  4. On the day: the engineer walks the site with the checklist on the phone; each photo is tagged to a checklist line with time and location.
  5. Spoken remarks (Hindi, Marathi, English) become written observations against the right line.
  6. By evening: the inspection report about 80% written; open items closed later on photos.
- **Outputs:** missing-document list before the visit; checklist with photos, time and location; same-day report draft; open items closed on photos.
- **Demo today:** page only. Status on the page: "In design". No workflow.

### 3.2 Material Leak Check (one-time, one site)

- **Promise:** find what the site paid for and never got, **in one week**.
- **Inputs:** purchase orders, delivery challans, gate or weighbridge book, stores issue slips, BOQ work done.
- **Steps promised:**
  1. Clean and line up the registers; list missing or unreadable rows.
  2. PO → challan → gate: duplicates, short supply beyond 0.5%, rates above PO, deliveries with no PO.
  3. Issue → BOQ: needed = work done × consumption norm, plus allowed wastage (cement 2%, steel 3%); anything issued beyond that is overuse, by wing and supervisor.
  4. Book stock vs the next 8 weeks' need: excess stock and coming shortages.
  5. One-page ₹ summary for the MD: recoverable from suppliers, stoppable on site, every line traceable.
- **Outputs:** 1-page ₹ summary; supplier claim list with challan numbers; overuse by wing and supervisor; extra and short stock, valued.
- **Demo today:** n8n workflow `veraDemoLeakChk1` (`n8n/flows/leak.mjs`, built by `n8n/vera-demo.mjs`), on clean sample JSON. The matching and maths logic is the most reusable piece we have. Missing: reading real registers (Excel exports, scans, photos of paper books).

### 3.3 Site Record Desk (daily and weekly, all sites)

- **Promise:** supervisors keep sending voice notes; the owner gets a record **every morning**.
- **Inputs:** voice notes (Hindi, Marathi, Hinglish), texts, site photos, challan photos.
- **Steps promised:**
  1. Site master set up once: contractors, planned activities, supplier challan prefixes, open POs, labour day rate, pending RA bills.
  2. Read every message: labour by contractor, progress, material received, stock left, hindrances and hours lost. Unreadable → "noted" for the supervisor, never guessed.
  3. One dated daily record per site, with a hindrance register and photos.
  4. Money at risk: idle labour × hours × day rate, client delays you can claim, unpaid or returned RA bills, deliveries with no PO, stock that will stop work, sites that went silent.
  5. **8 AM WhatsApp brief** for the owner; **weekly progress report every Monday** (planned vs done, per site); **Tally import** file for the receipts.
- **Outputs:** 8 AM WhatsApp brief; daily progress record per site; weekly report; hindrance register with photos and times; Tally receipt-note import.
- **Demo today:** n8n workflow `veraDemoSiteDsk1` (`n8n/flows/desk.mjs`) on 15 pre-written sample messages with English glosses, read by keyword matching. Missing: everything real (WhatsApp intake, speech-to-text, photo reading, delivery).

### 3.4 Cross-Site Stock Balance (weekly, across sites)

- **Promise:** one sheet a week: which site has too much, which will run short, who sends what to whom.
- **Inputs:** stock at each site; next 4 weeks of planned work; purchase requests and open POs; batch dates (cement, admixtures).
- **Steps promised:** book stock by site corrected by the latest physical count → need for the next 4 weeks → excess (valued) and shortage (with the date it stops work), old cement first → match excess to shortage with distance and truck cost, naming both supervisors → one buy list for purchase → a transfer note per truck and a Tally stock journal.
- **Outputs:** weekly stock sheet; excess and shortage, valued; transfers with supervisor names; one buy list; cash stuck in excess stock.
- **Demo today:** page only ("Building with first customers"). Needs two or more sites, so it may not apply to a one-site beta.

### 3.5 Supervisor-wise Wastage (part of the Leak Check, monthly)

- **Promise:** see which supervisor, on which floor, used more than the allowed wastage.
- **Inputs:** stores issue slips with supervisor; BOQ work done by floor; RMC delivery tickets; the client's allowed wastage norms.
- **Steps promised:** tie every slip to a supervisor, wing and floor (slips with no name go back to stores) → BOQ work done per floor → allowed = work × norm + wastage (cement 2%, steel 3%, RMC 1.5%) → over-limit by supervisor, floor and material, valued at PO rate → a monthly table ranked by ₹, each supervisor gets only their own lines on WhatsApp.
- **Outputs:** wastage by supervisor, wing and floor; over-limit quantity valued at PO rate; slip numbers behind every line; each supervisor's lines on WhatsApp.
- **Demo today:** a view on top of the Leak Check workflow's overuse output.

### Also in the repo (not on the review page)

- **Free-Issue Material Reconciliation** (developer ↔ contractor): `n8n/flows/free-issue.mjs`, documented in `n8n/FREE-ISSUE.md`. For developers who supply cement and steel to contractors and recover the excess from RA bills. Logic and rules are well specified; worth reusing if the beta client is a developer.
- **Plant & Formwork Desk:** contractor-only, shown on the contractor page, not the review page. Out of scope for this beta.

---

## 4. What's in the repo

Repo `vera-ai-50l/Construction`, branch `claude/dreamy-feynman-40g8v2`.

| Path | What it is |
|---|---|
| `content/desks.ts` | **Source of truth for what each product promises** (all text in section 3 comes from here) |
| `components/DemoPage.tsx`, `app/review/page.tsx`, `app/demo/[[...firm]]/page.tsx` | The demo site (Next.js on Vercel). `/review` = developer view, five products |
| `n8n/vera-demo.mjs` | Builds the demo n8n workflows from plain JS and deploys them; `node n8n/vera-demo.mjs check` runs the self-checks |
| `n8n/flows/leak.mjs`, `desk.mjs`, `free-issue.mjs` | The logic of each demo workflow |
| `n8n/FREE-ISSUE.md` | Rules for free-issue reconciliation (rounding, missing counts, confidence labels) |
| `website/HANDOFF-LODHA.md` | Earlier handover: how the demo is wired, request and response shapes, n8n conventions that worked |
| `infra/` | Docker Compose + Caddy for self-hosted n8n |
| `vera-leads/` | The sales lead scraper. Not part of the product; ignore |
| `docs/two-engine-hedge.md`, `docs/vera-outreach.md` | Business plan and sales plan. Context only |

**n8n conventions that worked** (from `website/HANDOFF-LODHA.md`): Webhook v2 with `responseMode: responseNode`; one Code node per logical step; Respond to Webhook; a sticky note explaining the workflow; deploy = import, publish, then restart the container (webhooks register on startup).

---

## 5. Phase 1: the plan (what to produce)

### 5.1 For each product, one workflow spec

For each of the five (plus free-issue if the client is a developer):

1. **Trigger and timing:** what starts it (a message arriving, 7:30 am daily, Monday, month end, on request).
2. **Data capture:** exactly how each input reaches us, from whom, in what format. Be concrete about the real formats on Indian sites: paper registers, photos of paper, Excel, Tally exports, ERP or SAP exports, WhatsApp groups.
3. **Extraction:** how raw input becomes structured rows (speech-to-text, photo reading, Excel parsing, LLM extraction to a fixed schema), with a confidence score per field.
4. **Validation and human review:** what is checked automatically, what goes to a person, who that person is (us or the client), and how they approve or correct it.
5. **Computation:** the deterministic rules (reuse the demo logic), with the norms and tolerances the client must confirm.
6. **Output and delivery:** format (WhatsApp text, PDF, Excel, Tally import), recipient, time.
7. **Data model:** tables and key fields.
8. **Failure modes:** missing data, bad audio, blurry photos, a supervisor who stops sending, a wrong norm, duplicates, and what the system does in each case.
9. **Effort:** build time in days, running cost per site per month, founder time per site per week once live.
10. **Beta version vs full version:** what's manual in the beta and gets automated later.

Draw each workflow as a diagram (Mermaid is fine) plus a table of steps.

### 5.2 One shared architecture

Most products share the same machinery. Design it once:

| Layer | Decide | Candidates to evaluate (verify current pricing, limits and terms; don't assume) |
|---|---|---|
| WhatsApp intake | How site messages reach us | WhatsApp Business Platform (Cloud API) number that supervisors message or forward to; check what it supports for groups today. Exported chats as a fallback. Unofficial WhatsApp Web libraries break WhatsApp's terms and risk the number being banned; only with the founders' explicit sign-off |
| Speech-to-text | Hindi, Marathi, Hinglish voice notes, site noise | Indian-language specialists (e.g. Sarvam), Whisper-family models, Google speech. Test on real voice notes from the beta site before choosing |
| Photo and document reading | Challans, issue slips, certificates, handwritten registers | A vision-capable LLM with structured output, or a document OCR service. Test on real challans |
| Extraction | Text → structured rows against the site master | An LLM with a strict JSON schema and the site master in the prompt; confidence per field; anything low goes to review |
| Rules engine | All quantities and money | Deterministic code, reusing the demo logic. Unit-tested against hand-worked answer keys |
| Orchestration | Where the pipeline runs | n8n (already used, quick to change) vs a small code service (easier to test and version). Recommend one, with reasons |
| Storage | Records, files, audit trail | Postgres + object storage for audio and photos, India region if possible. Every derived number links to its source |
| Review console | Where a person checks and corrects | Something simple first (a sheet or a small web page), so reviewing is fast |
| Delivery | Briefs, reports, files | WhatsApp messages (business-initiated messages outside the 24-hour window need approved templates; plan for that), PDF, Excel, Tally import format (check which Tally versions and formats the client uses) |
| Security | Client data | Per-client separation, access control, encryption, retention and deletion, audit log, NDA terms, DPDP readiness |

Use current Claude models for any AI step unless testing shows something else is clearly better for Indian languages.

### 5.3 The beta plan

Recommend:

- **Which products to run in the beta** (one site, probably one or two products, not five). Likely the Site Record Desk (data flows every day on WhatsApp, value shows in week one) plus the Leak Check or Wastage once registers are in hand. Justify against what the client said he wants.
- **A human-assisted first version:** for the first weeks, a founder reviews every extraction and output before it reaches the client, so quality is high while automation catches up. Plan for the review time and measure it; reducing it is the automation roadmap.
- **Success measures agreed before the start:** for example, daily record delivered by 8 AM on X of Y days; Z% of messages read without correction; ₹ found in the material check confirmed by the client.
- **Timeline:** week by week from kickoff to first output and to the end of the beta.
- **What we tell the client up front** about what's manual and what's automated in the beta.

### 5.4 Discovery checklist for the first site visit / call with the senior engineer

Turn this into a short questionnaire and a list of sample files to request (under NDA):

- **Site:** type, wings or towers, floors, stage of work, number of supervisors and contractors, working hours.
- **Reporting today:** who sends what, in which WhatsApp groups, which languages, voice vs text vs photo, how many messages a day, who writes the DPR, who reads it.
- **Registers:** how POs, challans, gate entries, stores issue and stock are kept (paper, Excel, ERP, Tally, SAP), who keeps them, how up to date.
- **Norms:** consumption norms and wastage allowances they use, and the contract terms for contractors.
- **Measurement:** how work done is measured and certified (MB, BOQ, RA bills, BBS for steel).
- **Outputs:** who should receive what, when, in what format; whether they use Tally (version) or an ERP.
- **Access:** can a Vera number join their groups or will they forward; phones the team uses; consent from the people whose messages we read.
- **Their biggest pain on this site right now,** in their words.
- **Samples to collect:** one day of WhatsApp messages (voice, text, photos), 10 challans, 10 issue slips, one month of the stores register, the BOQ, a recent DPR, a recent RA bill.

---

## 6. Phase 2: build (after the plan is approved)

- Start from the beta site's real samples. Build the intake and extraction for those first, then the rules, then delivery.
- Reuse the demo logic (`n8n/flows/*.mjs`) for the rules; port it if the architecture moves off n8n.
- Every rule gets tests with hand-worked answers. Every output line links back to its source.
- Small, verified steps; commit often; never commit client data or keys.
- Keep the demo site working; it's still the sales tool.

---

## 7. Open questions for the founders

1. Is the beta client a contractor or a developer? (Changes which products fit, and whether free-issue reconciliation matters.)
2. Which products did he respond to most, and what exactly did he agree to?
3. Is the beta free, at cost, or paid? What happens at the end if it works?
4. Has the NDA been signed?
5. How much founder time per week can go to running the beta by hand while it's being automated?
6. Budget per month for APIs, hosting and a WhatsApp Business number.
7. Is there an existing VPS and n8n we should use, and who has access?

---

## 8. First message to paste in the new chat

```
Read docs/vera-build-handover.md in full, then content/desks.ts, n8n/flows/*.mjs, n8n/FREE-ISSUE.md and website/HANDOFF-LODHA.md.

We are in Phase 1: plan only, no product code. Start by asking me the open questions in section 7 that you need answered. Then produce, one product at a time, the workflow spec in section 5.1 (with a Mermaid diagram), then the shared architecture in 5.2, then the beta plan in 5.3 and the discovery questionnaire in 5.4. Put the plan in docs/vera-build-plan.md and keep it updated as we decide things. Mark every tool choice as "to verify" until we've tested it on real samples.
```
