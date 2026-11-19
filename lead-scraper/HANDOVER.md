# Handover: Kyre outbound (leads → teardowns → SalesHandy)

> **Newer:** `KYRE-HANDOFF.md` (19 Nov) tells the whole story since, including the Send Desk, scheduled runs, SalesHandy batches and the signal-engine plan. Read that first.

Paste this whole file into the new Claude session, then upload the data zip (`kyre-lead-data.zip`, sent
separately because it holds prospect names and emails). Everything below is what the founder asked for
and what was decided over 16–18 Nov 2026. Read it fully before doing anything.

---

## 0. The task right now (start here)

1. **Today:** the founder sent **18** first emails on 17 Nov (SalesHandy sequence
   **"Kyre · Teardown · 17 Nov final (20)"**). One reply already: **Julian (Athletedata) — "Interested"** →
   make sure the founder replies to him.
2. **Tomorrow (19 Nov): send 40.** The plan is in `out/send-2026-11-19/send-plan.xlsx`:
   - **18 ready**: prepared emails not yet sent → `out/send-2026-11-19/saleshandy-ready.csv` (same columns
     as the founder's SalesHandy file). Nothing to do except import.
   - **22 to log in**: tab "2 Log in today" (sign-up URL, email, verification, save-session command).
     **12 reserves** in tab "3 Reserve" (use if a sign-up asks for a card/phone or fails).
3. **How the founder wants the 22 done:** *you* do every step in **their browser**; *they* only do the
   login / sign-up part (you can't log in for them). For each product:
   - open the sign-up page, wait while the founder signs up / logs in (with a Kyre work account),
   - then **you** walk the product: dashboard, main screens, onboarding, empty states, settings pages that
     are safe to view, on laptop and phone,
   - **jot down everything**: the signals, what needs improving, **what is likely causing people to leave
     the site (bounce)**, **what is likely causing signed-up users to leave (churn)**, and how they can get
     **more sign-ups** and **keep the people who signed up** (see section 6 for the checklist),
   - then write that company's email in the exact format of section 7 and add it to a SalesHandy CSV with the
     same columns as `saleshandy-ready.csv`.
   - If the new session has **Claude in Chrome** (or another browser tool on the founder's computer), use it.
     If not, use the guided tour script: `npm run tour -- out/send-2026-11-19/send-plan.xlsx` (section 5).
4. Deliver: `saleshandy-login-22.csv` (same columns) + a short findings table per company. Mark which rows are
   group 1 (verified) and group 2 (catch-all).

---

## 1. The business

- **Kyre** = the founder's **productized interface-redesign business** for AI-era software. (In the
  positioning brief the brand was the placeholder `[STUDIO]`; it is now Kyre.)
- **Vera** = a *separate* business of the same founders (AI automations for Indian construction companies,
  repo `vera-ai-50l/construction`, the Next.js demo + `infra/` n8n server). **Keep Vera as is. Never send Kyre
  email from Vera domains or inboxes.**
- Positioning (from the founder's positioning brief): *"We redesign the products AI built — delivered as a
  pull request in your own code, measured on the one number that matters, at a fixed price."*
  - Outcome, not deliverables. Shipped as code (a PR in their repo). Fixed price, fast.
  - Main call to action = **the free teardown**: a genuine strength, fixable wins, and a before/after mock of
    one screen, no call needed.
  - Tone: direct, plain, short sentences, engineer-with-taste. No jargon, no emoji, no exclamation marks.
  - **Accuracy guardrails:** never invent results, logos, testimonials, conversion lifts or case studies.
    Prices are planned packages. Quote only what was actually seen on their screens.

### ICPs and offers (from the founder's market report, "Tab 1", section 11, and the brief)

| Type | Who | Offer (planned price) | Buying signals |
| --- | --- | --- | --- |
| **A** | Founders of AI-built apps (Lovable, Bolt, v0, Replit, Base44) **with paying users** | "AI App Glow-Up": 5 screens (landing, sign-up, onboarding, main dashboard, pricing), accessibility + security check, PR in 7 days, **$1,500** | custom domain, pricing page / Stripe, public revenue, "Made with Lovable", recent launch, complaints about design/churn |
| **B** | Seed / Series A **B2B SaaS** with a real app (dashboards, tables, data, workflows). **Non-YC preferred**, broad SaaS, *not only* AI-eval tools | "Dashboard Sprint": 1 dashboard + chart/table/empty-state kit, PR in ~2 weeks, **$6,000–9,000** | raised in the last 6–12 months, **open product-designer role**, crowded tables/default charts |
| **C** | **US/EU Shopify brands, $1–25M revenue** | "Accessibility + Conversion Fix": audit + theme code fixes + product page/checkout UX, **$2,500–4,000** + $300/mo monitoring | ships to US/EU, custom theme (or still on a free theme), accessibility overlay widget, past lawsuit, EU expansion |

---

## 2. Everything the founder asked for / decided (in order)

1. Deep ICP research first (done: Claude Doc "ICP Research & Market Validation — B2B Interface Redesign").
2. Build a scraper that gives leads (sites + emails) for the ICPs. Teardown-style first email; Excel/CSV for
   SalesHandy; flag sites that need a login; founder logs in by hand, then dashboards get screenshotted.
3. **Subjects must be customized with a signal** (the specific thing seen) for open rate.
4. **Only named decision-makers. Never info@/hello@/support@ or any shared inbox.** (The founder was upset
   when shared inboxes were labelled "ready" once. Flag shared-inbox-only leads clearly; never send to them.)
5. Leads must be genuinely **vibe-coded / not polished** for Type A (YC lists were too polished).
6. Use **MillionVerifier + Apify**; keep costs minimum; prefer cheap scrapers.
7. Test each tool on a sample and **map the funnel with counts and cost per step** (done; every run writes
   `funnel.md`).
8. Infra: the founder has a **VPS**; build the Type A flow (up to scoring, **no teardown**) as a weekly
   n8n/cron job with a **remarks** column (e.g. "demo is behind a login wall").
9. Type B and C: **50 scored leads each**, no teardowns; for B, remark whether **login is required**.
10. Type B should be **non-YC** and **good SaaS in general**, from **multiple sources**.
11. Test **designer-hiring job posts** as a source for A, B, C. Result: works for B, small top-up for C,
    nothing for A. **Keep the job-post lists as separate spreadsheets/lists** (signal-based) from the
    source-based lists; a company never appears in both.
12. Sending: started **17 Nov with 18 emails**, ramp up daily (**40 on 19 Nov**), increase slowly.
13. The founder shared a **signal-engine** project (Python; Vera + a lead-gen firm sharing one SalesHandy
    account). Decision: **the lead-gen business in it becomes Kyre; Vera stays as is.** Plan in section 9.
14. SalesHandy API: **"for now use it just for creating and managing sequences."** The key was pasted in
    chat once → **it must be rotated**, and the new key saved as a secret (environment variable / secure
    credential), never in chat, code, YAML or commits.
15. Now: do the 22 logins in the founder's browser (founder logs in, Claude does the rest) and write up
    signals, bounce and churn causes and improvements.

---

## 3. Code and setup

- Repo `vera-ai-50l/construction`, branch **`claude/quirky-dirac-6uu2xw`**, folder **`lead-scraper/`**
  (Node 22, ESM). Everything is committed there except data (`out/`), sessions (`auth/`) and tours (`tours/`),
  which are git-ignored on purpose (personal data and cookies).
- Setup on the founder's computer:
  ```bash
  git clone https://github.com/vera-ai-50l/construction && cd construction && git checkout claude/quirky-dirac-6uu2xw
  cd lead-scraper && npm install && npx playwright install chromium
  unzip ~/Downloads/kyre-lead-data.zip -d .      # creates out/... with the lead data
  npm test                                       # 22 tests should pass
  ```
- Keys (environment variables only): `APIFY_TOKEN` (Apify; finder, Google search, bounceverify),
  `MILLIONVERIFIER_API_KEY` + `MV_PRICE_USD` (optional; `--verifier mv`), `SALESHANDY_API_KEY` (only for the
  sequence work). On cloud sessions the Apify token was a proxy-injected secret (`APIFY_TOKEN=proxy-injected`).

### Main commands

| Command | What it does |
| --- | --- |
| `npm run leads -- --profile vibe --sources trustmrr,showhn,commoncrawl --find-contacts --finder none --name-search --max-candidates 5 --access-check` | Type A leads |
| `npm run leads -- --profile type_b --sources news,ats,hn ...` / `--sources jobs` | Type B source-based / job-post list |
| `npm run leads -- --profile type_c --sources shopify ...` / `--sources jobs` | Type C stores / job-post list |
| `npm run pipeline -- --preset type_a\|type_b\|type_c\|type_b_jobs\|type_c_jobs` | One weekly run up to scoring + remarks (never delivers a company twice) |
| `npm run serve` | HTTP API for n8n (`deploy/README.md`) |
| `node src/lead-sheet.mjs out/<run> --top 50` | Colour-coded scored workbook with remarks |
| `node src/login-sheet.mjs` | `out/login-queue/login-queue.xlsx`: every lead behind a login, with save-session commands |
| `node src/tomorrow-sheet.mjs --sent <SalesHandy export> --prepared <final csv> --target 40 --out out/send-<date>` | Next day's send plan |
| `npm run login -- <sign-up url> <domain>` | Opens a visible browser; the founder logs in; saves `auth/<domain>.json` |
| `npm run tour -- out/send-2026-11-19/send-plan.xlsx` | Guided tour (section 5) |
| `npm run teardown -- --leads <run>/leads.json --only <domains> --reuse` | Teardown (uses saved sessions; hand-written reviews in `<run>/reviews/<domain>.json` win) |
| `node src/batch-sheet.mjs out/batch-40` | Batch workbook with email + teardown confidence |

Code map (`lead-scraper/src`): `sources/` (trustmrr, showhn, commoncrawl, serp, yc, funding (news RSS),
hiring-design (job boards via Google, HN Who is hiring), design-jobs (Himalayas, Remotive, We Work Remotely,
Dribbble + classifier into A/B/C), shopify), `enrich/` (site, vibe, access = login check, contacts,
namesearch), `teardown/` (audit, findings, email, review, workbook), `score.mjs`, `remarks.mjs`,
`confidence.mjs`, `funnel.mjs`, `pipeline.mjs`, `server.mjs`, `tour.mjs`. Deploy: `deploy/` (Docker, n8n
workflows per preset, cron). README.md and deploy/README.md explain all of it.

---

## 4. What exists (data in the zip, under `out/`)

| File / folder | What |
| --- | --- |
| `send-2026-11-19/send-plan.xlsx` | **Tomorrow's plan**: 18 ready, 22 to log in, 12 reserve, already-sent list |
| `send-2026-11-19/saleshandy-ready.csv` | The 18 ready emails, SalesHandy columns |
| `saleshandy-final.csv`, `saleshandy-sent-2026-11-17.csv` | The founder's 36-lead file and the SalesHandy export of the 18 sent |
| `login-queue/login-queue.xlsx` | All 78 leads behind a login (+24 sales-gated on a second tab) |
| `batch-40/` | Type A batch: leads, teardowns, screenshots, hand-written reviews, workbook |
| `type-b2-50/` | **Type B non-YC**, 50 scored leads with login remarks (`leads-scored.xlsx`) |
| `jobs-test-b/` | **Type B job-post list**, 43 new companies hiring a designer |
| `type-b-50/` | Older Type B YC list (50) |
| `type-c-50/` | **Type C** 50 Shopify stores, scored |
| `jobs-test-c/` | **Type C job-post list**, 9 stores hiring a designer |
| `state/` | Which companies each weekly list already delivered (never deliver twice) |

The 22 to log in tomorrow (company names; emails are in the sheet): Natural, BuyWander, Sequence, Numeral, Ad Machine, Verdun, Archal, Traceforce, Antithesis, Outpost, Plek AI, Cribl, Shapes, ChatFeatured, MapTiler, Zed Industries, Sumary, Sundream Studio, Paraito, Taxwire, August, Rentana.
Use the sheet as the source of truth. Cribl and Zed may be too big for a new studio: swap them for reserves if so.

---

## 5. Doing the 22 (browser)

**With a browser tool (preferred):** for each row of tab "2 Log in today": open `sign_up_url` → tell the
founder "please log in / sign up now" → wait → walk the product. Look, don't change: no forms submitted,
no payment details, no invites, no deleting, no settings changes. Take screenshots (laptop and phone width).

**Without a browser tool:** the founder runs `npm run tour -- out/send-2026-11-19/send-plan.xlsx`. For each
product it opens a visible browser on the sign-up page; the founder logs in and presses Enter; the script
then follows the product's own menu links (never buttons or forms, skips logout/billing/delete/invite/export),
screenshots every screen on laptop and phone, and records page text, load time, console errors and
serious accessibility issues into `tours/<domain>/` (`tour.json` + PNGs). The founder zips `tours/` and
uploads it; the session analyses the screenshots and writes the emails. `--only a.com,b.com` limits it.
Sessions land in `auth/` (private; never commit, never upload).

---

## 6. What to jot down per product (the analysis the founder asked for)

Write a findings table per company: **screen · what is seen (quote on-screen text) · why it hurts (bounce /
sign-up / activation / churn) · fix**. Cover:

- **Bounce (people leave the site before signing up):** unclear headline / value proposition, two
  different pitches (desktop vs phone), slow or heavy pages, pop-ups/cookie bars covering the first screen,
  too many competing buttons, stock images instead of the product, trust claims without proof, broken or
  placeholder content, mobile layout bugs, tiny tap targets, contrast/accessibility failures.
- **Sign-up friction:** card or payment before seeing the product, long forms, work-email-only walls,
  broken OAuth (silent failures, raw JSON errors), "create account" links that go elsewhere, no clear
  next step.
- **Activation (first session):** empty dashboard with no guidance, "Welcome back" on a first visit,
  confusing or contradictory empty states, sales pop-ups over the first steps, jargon before value,
  truncated labels, broken images, features greyed out, unclear navigation.
- **Churn (signed-up users stop using it):** no reason to come back (no saved progress, no notifications,
  no summary), dense tables with no hierarchy, default charts, numbers that look wrong, inconsistent empty
  values, hidden core actions, upsells interrupting work, unexplained warnings.
- **Signals** to note for the email and the sheet: what they're hiring for, recent funding, builder
  fingerprints, plan/pricing, what's clearly working (one genuine strength, quoted).
- Never claim to know their real churn or bounce numbers. Describe the likely effect on a visitor; quote
  only what you measured (load time, MB, tap targets, axe issues) or saw.

---

## 7. Email format (exactly as used in the 17 Nov send)

SalesHandy columns: `Email, First Name, Last Name, Company, Website, subject, subject_alt, email_body,
followup_1, followup_2, send_group, email_verification, email_confidence, lead_finding_from`
(`lead_finding_from` = homepage / sign-up flow / signed-in dashboard). The sequence also has custom fields
(Greeting, Opener, What Works, Fix 1, Fix 2, Quickest Win, Mock Page, Subject, Subject Alt, Send Group,
Email/Teardown Confidence, Lead Source, Body 1–3, Follow Up 1A/1B/2A/2B) — keep filling the CSV columns
above; the founder maps them.

- **subject**: 3–7 words, lowercase except names/quoted text, about the single most specific thing seen,
  e.g. `'choose a proj...' in diploi's top bar`, `matrix os asks for billing before anything else`.
- **subject_alt**: `{First}, about your {screen}` (or `about your {screen} at {company}` without a name).
- **email_body**:
  ```
  Hi {First},                      (or "Hi there," when there is no first name)

  {Biggest finding, quoting the on-screen text.} {One sentence: the effect on a visitor/user.}

  I signed up for {Company} and went through it as a new user, from the homepage to the dashboard.
  I liked that {one genuine, specific strength, quoted}.

  I can put together a before/after of your {screen}, no call needed. Want me to send it?
  ```
  (Homepage-only leads: "I went through {Company} on a laptop and on a phone.")
- **followup_1**: `One more thing I noticed: {second finding}. {effect}.\n\nThe fix is small: {fix}. Happy to include it in the before/after.`
- **followup_2**: `Last note from me. If the {screen} is not a priority right now, no problem.\n\nIf it is, reply "yes" and I will send the before/after this week.`
- Plain text, no links in email 1, no exclamation marks, no invented numbers. SalesHandy adds the signature,
  postal address and opt-out.

---

## 8. Rules (do not break)

- **Never** email shared inboxes (info@, hello@, support@, sales@, team@, contact@, customercare@,
  partnership@, licensing@, wholesale@, solutions@, employer@, question@, company-named mailboxes...).
  `src/enrich/site.mjs isRoleMailbox()` has the list.
- **Germany and Austria: no cold email** (UWG §7) → LinkedIn only. UK: limited companies only.
- **Send groups:** group 1 = verified "ok" (send first); group 2 = **catch-all** (cannot be confirmed; send as
  a separate batch, stop if bounces pass ~3%). 17 Nov + 19 Nov are mostly catch-all, so watch bounces.
- Ramp slowly: 18 → 40, 20–40 per inbox per day, warmed secondary domain, SPF/DKIM/DMARC, SalesHandy bounce
  auto-pause on.
- Never bypass logins, CAPTCHAs, paywalls or bot checks; respect robots.txt; never use someone else's login;
  never scrape LinkedIn (only Google result titles), Reddit, Upwork, Fiverr, Product Hunt pages.
- Names found by Google search can be wrong: check the LinkedIn link before sending (two wrong matches were
  caught: walnut.nl, omagic.ai).
- No secrets in chat, files or commits. `out/`, `auth/`, `tours/` stay private.
- Signal engine: `DRY_RUN=true` until the founder says "go live"; any paid run or SalesHandy push needs the
  founder's OK first.

---

## 9. Signal engine plan (agreed, not built yet)

Signal engine = the founder's Python project (FastAPI dashboard, playbooks in YAML, compliance gate,
SalesHandy push, outcomes webhook, stop-loss). Agreed split:

- **Our lead-scraper** keeps: finding companies, vibe/login/store checks, names + verified emails, and
  **writing the teardown email** (the teardown *is* the email, so it comes before the push).
- **Signal engine** takes: scoring by playbook weights/half-lives, dedupe across Vera and Kyre, compliance
  gate, daily caps / hot cap / stop-loss, **SalesHandy push**, replies/bounces back via `/outcomes`,
  suppression, dashboard.
- Changes: replace `lg_acquisition_recruiters` / `lg_delivery_template` with **Kyre playbooks**
  (`kyre_type_a`, `kyre_type_b`, `kyre_type_b_jobs`, `kyre_type_c`, `kyre_type_c_jobs`), each with its own
  SalesHandy step (`SH_STEP_KYRE_A/B/C`); hard rule 1 becomes "Kyre never sends from Vera inboxes";
  new source `kyre_leads` + endpoint `POST /ingest/kyre`; `steps/copy.py` uses our teardown as the copy;
  a separate low-cap **catch-all step** per type; "login required" Type B leads go to the Review queue.
  **Vera's playbook and code untouched.**
- Waiting on the founder: Kyre sequences + step IDs, separate Kyre sending domains, `SALESHANDY_API_KEY` (new,
  rotated) in the engine's `.env`, and the catch-all decision.

SalesHandy API scope for now: **create and manage sequences only** (no prospect pushes without an OK).
API base `https://open-api.saleshandy.com`, header `x-api-key`.

---

## 10. Results so far (for context)

| List | Leads | Named email | Cost |
| --- | --- | --- | --- |
| Type A batch of 40 (TrustMRR, Show HN, Common Crawl + gap fill) | 40 | 40 (10 ok, 30 catch-all) | ~$0.50 |
| Type B YC (old) | 50 | 50 (13 ok) | $0.38 |
| Type B non-YC | 50 | 50 (18 ok) | $0.56 |
| Type B job posts | 43 new | 32 | $0.19 (+$0.10 shared) |
| Type C Shopify | 50 | 40 (9 ok) | $0.59 |
| Type C job posts | 9 | 6 | $0.03 |

Learned: Apollo-type finders (pipelinelabs, microworlds) know almost none of the tiny/new companies; the
Google "LinkedIn title" name search is what works (~$0.0045/company). ~75% of addresses are catch-all.
Design job posts don't reach Type A founders. FinSMEs, EU-Startups, Reddit, Product Hunt block bots.

## 11. Open items

- The 22 logins + tour + emails for 19 Nov (section 0).
- Founder replies to Julian (Athletedata, interested).
- Rotate the SalesHandy key; save the new one as a secret.
- Deploy the weekly pipeline on the VPS (`deploy/README.md`); copy `out/state/` to the server first.
- Build the signal-engine Kyre integration (section 9) when the founder gives the go-ahead.
- Optional: move job-board + HN design roles fully into the job-post Type B list (founder to decide).
