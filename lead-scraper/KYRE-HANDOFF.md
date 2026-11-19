# Kyre outbound: handoff (16–19 Nov 2026)

This is for the next Claude (or person) picking up Kyre's outbound. It tells the story so far: what we
built, what came out of each step, what worked, what didn't, and where it could go next.

Nothing here is fixed. Every tool, source, threshold and email format below exists because it was the
best idea at the time it was tried. If you find a better way to pull good leads, change it. The one aim
is **to pull the best leads and turn them into conversations**. Treat the rest as notes from the people
who were here before you.

The older `HANDOVER.md` in this folder is a snapshot from 18 Nov. Where the two differ, this file is
more recent.

---

## 1. What Kyre is

Kyre is the founder's productized interface-redesign business: *"We redesign the products AI built,
delivered as a pull request in your own code, measured on the one number that matters, at a fixed
price."* The way in is a free look at the prospect's own product: first a "teardown", now a "free report".

Three kinds of customer have been tried:

| Type | Who | Offer (planned) | Signals that a company fits |
|---|---|---|---|
| **A** | Founders of AI-built apps (Lovable, Bolt, v0, Replit, Base44) with paying users | AI App Glow-Up, about $1,500 | custom domain, pricing page or Stripe, public revenue, "made with" badges, recent launch |
| **B** | Seed / Series A B2B SaaS with a real app (dashboards, tables, workflows). Non-YC turned out better. Broad SaaS, not only AI tools | Dashboard Sprint, $6–9K | raised in the last 6–12 months, hiring a product designer, crowded tables, default charts |
| **C** | US/EU Shopify brands with $1–25M revenue | Accessibility + Conversion Fix, $2.5–4K | custom or free theme, accessibility overlay widget, ships to US/EU |

**Vera** is a separate business of the same founders (AI for Indian construction companies; this repo's
Next.js app and `infra/` belong to it). It shares the SalesHandy account. The founder wants Vera left
as it is, and Kyre mail never sent from Vera's inboxes (getveraai.com). Kyre's inboxes are on
trykyre.com and getkyre.com.

---

## 2. How it evolved, step by step

### Phase 1: research and the first scraper (16 Nov)
- ICP research first (a Claude Doc, "ICP Research & Market Validation"), then the founder's market report
  ("Tab 1") and positioning brief.
- First scraper: find companies, find a contact, take screenshots, write a teardown email, export a CSV
  for SalesHandy. Products behind a login were flagged for the founder to log in by hand.
- **Learned straight away:** a subject must name the specific thing seen on their screen. The open rate
  depends on it.

### Phase 2: getting real people, not inboxes (16–17 Nov)
- The first lists produced too many shared inboxes (hello@, support@ ...), and some were labelled
  "ready". The founder was rightly upset. After that, only named decision-makers count.
  `isRoleMailbox()` in `src/enrich/site.mjs` grew a long list, and was tightened again on 19 Nov.
- The YC list was **too polished** for Type A (nothing to redesign), which led to the **vibe check**: does
  this site actually look AI-built and unfinished?
- **The big gap:** we found plenty of AI-built apps but no founder email for most of them. What closed it:
  - **free names:** legal notices, the company site, HN profiles
  - **a Google search for LinkedIn titles** ("founder" + company), at about **$0.0045 per company**
  - email-pattern guesses, then **bounceverify** (Apify) to check them
- **Apollo-type finder databases** (pipelinelabs, microworlds) knew almost none of these tiny companies:
  1 found out of 82. Our own method beats Apollo for small and new companies. Apollo-type data is better
  for established ones (see section 7).
- About **75% of addresses come back "catch-all"**: the server accepts everything, so the address can't
  be confirmed. The founder sends those as a separate batch and watches bounces.

### Phase 3: one pipeline per type, with costs (17 Nov)
- Every run writes `funnel.md`: how many companies survived each step and what each step cost.
- Type B moved to **non-YC SaaS from several sources**: funding news (TechCrunch, Crunchbase News, Tech
  Funding News, BetaKit, GeekWire, Inc42, Startup Daily), job boards via Google, HN "Who is hiring".
- Type C: Shopify stores from Common Crawl, with store checks (theme, overlay, alt text, paid apps).
- **Companies hiring a designer** (job posts): a strong signal for B, a small top-up for C, and nothing for
  A (AI-app founders don't post jobs). The founder asked to keep job-post lists as **separate lists**,
  so a company never appears in both.
- Infra for weekly runs: `src/pipeline.mjs` presets, HTTP API, Docker, n8n workflows (`deploy/`).

### Phase 4: the first sends (17–19 Nov)
- **17 Nov: 18 emails** ("Kyre · Teardown · 17 Nov final (20)"). One interested reply: Julian at
  Athletedata.
- **19 Nov: the founder sent 33** ("Kyre · Free report · 19 Nov (33)").
- **19 Nov (afternoon IST): 25 more started** ("Kyre · Free report · 20 Nov batch (25)"). The **14 Shopify**
  emails from the same file are in "Kyre · Shopify · 20 Nov batch (14) · on hold", paused on purpose
  until the founder decides on Type C.
- The email changed over these days (the founder's own edits):
  - **17 Nov:** "teardown" plus an offer of a before/after mock, no call needed.
  - **19–20 Nov:** "free report".
    - A short **attention line above "Hi {name},"** goes in the preheader, so it shows as the preview in
      the inbox list. Example: *"Your 'Sign up' button takes new visitors to a page called login."*
    - Then one specific finding with a genuine compliment, "and I noted two more like it", and *"At Kyre,
      we find and fix issues like this. If it's helpful, I'd be happy to send you a free report…"*
    - The subject reads like *"what new developers see on {company}"*. Subject B reads like *"3 things I
      noticed on {company}"*.
  - Follow-ups: day 4 gives one more finding, day 9 is a short "last note".
- **Logged-in teardowns are the strongest emails.** Quoting the dashboard a new user sees beats anything
  on the homepage. The cost is the founder's time: someone has to sign up to each product.

### Phase 5: automation (18–19 Nov)
The founder named two problems: *"having to ask it to scrape daily"* and *"having to add it to
SalesHandy"*. What we built:
- **Scheduled Claude cloud sessions** instead of a VPS plus Anthropic API. Two scheduled tasks run Monday
  to Friday:
  - **"Kyre daily collect"**, 6:41 am IST: runs the lists, takes screenshots, Claude writes the emails,
    then puts them on the Send Desk.
  - **"Kyre daily push"**, 1:37 pm IST: sends approved emails to SalesHandy.
  - What each run does is in `deploy/DAILY-SESSION.md`. Edit that file to change their behaviour; no need
    to recreate the tasks.
- **The Kyre Send Desk** (https://claude.ai/artifact/WSfefMB9SqtLMbG9pyp5bi): a private dashboard plus
  approval inbox with a small database (details in section 5).
- **Telegram alerts** through the founder's n8n: `deploy/n8n/kyre-telegram-relay.json`. A SalesHandy
  webhook sends replies, bounces and paused sequences; `src/replies.mjs` sorts them (interested, question,
  not now, unsubscribe; out-of-office is ignored). The daily runs also send their summaries here.
  Not switched on yet: it needs the n8n domain, a bot token and a chat ID.
- **SalesHandy API** (`src/saleshandy.mjs`). The fastest way today is **one CSV, one new sequence**:
  ```bash
  node src/saleshandy-setup.mjs batch --csv <file> --title "Kyre · …" --from "Kyre · Free report · 19 Nov (33)" [--live] [--start]
  ```
  - It copies the template's steps, settings and schedule.
  - It puts the attention line in the preheader (`{{Opener}}`).
  - It sends from Kyre inboxes only.
  - It skips shared inboxes, German and Austrian domains, and anyone already anywhere in SalesHandy. That
    check caught 17 duplicates on 19 Nov.
  - Without `--live` it only prints what it would do.

### The first unattended run (19 Nov, 6:41 am)
- It worked: $0.42, 35 leads picked, **6 emails written** and put on the desk.
- It also showed what was broken:
  - Type B found 0 leads. The feeds were being "paged" with an old offset that skipped everything
    current. Fixed: feeds now read from the top each day.
  - Four shared inboxes reached the drafting step. Fixed in the filter.
  - The Shopify list scored 37 leads but produced no emails. **Not diagnosed yet.** Most likely there was
    no named person, or the stores were flagged as needing a login. Start there.

---

## 3. What worked and what didn't

| Worked | Didn't (or not yet) |
|---|---|
| Subjects and opening lines quoting the exact on-screen text | Apollo-type finder databases for tiny/new companies (1 of 82) |
| Google search for LinkedIn titles to find founder names (~$0.0045/company) | The YC list for Type A: too polished to redesign |
| Free name sources (legal notices, about pages, HN profiles) | Job posts for Type A |
| Funding-news RSS + job boards for Type B; Common Crawl for Shopify (Type C) | FinSMEs, EU-Startups, Reddit, Product Hunt (bot walls); Tech.eu blocks us in robots.txt |
| Vibe check for Type A | About 75% catch-all addresses: can't be confirmed, so they need a separate, watched batch |
| Per-step funnel with costs (`funnel.md`) | Shared inboxes kept slipping through until the filter got strict |
| Logged-in teardowns (Julian replied to that batch) | Paging news/job feeds with offsets (gave 0 Type B leads) |
| Separate lists for job-post signals | Daily Shopify list: 37 scored, 0 emails (undiagnosed) |
| Checking every prospect against all of SalesHandy before importing | SalesHandy's API gives new sequences the account's **default sender, a Vera inbox**. Caught before any send; the tools now set Kyre senders and refuse others |
| Unattended scheduled runs writing to the desk | The push used the wrong field names (the template uses Greeting / Body 1–3 / Follow Up 1A–2B). Caught before any send |
| Preheader "attention line" (founder's idea) | Cloud sessions can't keep logged-in browser sessions, so login teardowns still need the founder's machine |

Typical cost so far: **$0.40–0.60 per 50 scored leads**, about **$0.01 per named, checked email**.
Spending has never been the limit. The limits have been yield (named people at tiny companies),
catch-all addresses, and the founder's time for logins.

---

## 4. The pieces and where they live

All under `lead-scraper/` on branch `claude/quirky-dirac-6uu2xw` of `vera-ai-50l/construction`.
Data (`out/`), browser sessions (`auth/`) and tours (`tours/`) are git-ignored because they hold personal
data.

| Piece | Files | Notes |
|---|---|---|
| Lead sources | `src/sources/*` | trustmrr, showhn, commoncrawl, funding (RSS), hiring-design, design-jobs, shopify, yc, saas |
| Checks and contacts | `src/enrich/*` | site, vibe, access (login check), contacts, namesearch |
| Paid tool slots | `src/providers.mjs` | finders (pipelinelabs, microworlds, code_crafter) and verifiers (bounceverify, MillionVerifier); every call is costed in the ledger |
| Scoring and sheets | `score.mjs`, `remarks.mjs`, `confidence.mjs`, `lead-sheet.mjs` | |
| Teardowns | `src/teardown/*`, `teardown-cli.mjs`, `tour.mjs`, `login.mjs` | screenshots, measured checks, review files |
| Weekly/daily runs | `src/pipeline.mjs` (presets), `src/daily.mjs` (restore → sync → collect → teardown → finalize → push) | `config/daily.json` holds the lists, limits and the $3/day budget |
| Desk glue | `src/desk.mjs` | files ↔ desk documents |
| SalesHandy | `src/saleshandy.mjs`, `src/push.mjs`, `src/saleshandy-setup.mjs` | `config/saleshandy.json` (step IDs for the daily push, currently empty) |
| Alerts | `src/replies.mjs`, `src/notify.mjs`, `deploy/n8n/build-relay.mjs` | |
| Scheduled runs | `deploy/DAILY-SESSION.md` | |
| Tests | `test/*.test.mjs` (`npm test`, 30 passing) | |

Keys live outside the code. In cloud sessions the proxy adds them (`APIFY_TOKEN=proxy-injected`, and
`SALESHANDY_API_KEY=proxy-injected` once the key is saved as an environment network secret). The
SalesHandy key was shared in chat on 18 Nov and used from this session on 19 Nov. Rotating it and saving
the new one as a network secret for `open-api.saleshandy.com` (header `x-api-key`) is what lets the
scheduled push work.

---

## 5. The Send Desk as headquarters

### What it is today
A private claude.ai page with a small built-in database:
- **Top half:** a dashboard with five tiles (waiting, approved, in SalesHandy, sign-ups to do, money
  spent), today's funnel, today's runs with a countdown to the push, a 14-day chart and the A/B/C mix.
- **Bottom half:** an inbox. Each email shows as it will arrive (subject A/B, body, day-4 and day-9
  follow-ups), with Approve / Skip / Edit and keyboard shortcuts. A sign-up tab lists products to log in to.

Its database collections:

| Collection | What's in it | Who writes it |
|---|---|---|
| `queue` | one doc per email per day, with `status` pending / approved / skipped | morning run creates; founder approves on the page |
| `pushed` | emails that are in SalesHandy | push run and `sync` |
| `logins` | products to sign up to, with a done tick | morning run; founder ticks |
| `runs` | one summary per run per day | the runs |
| `ledger` | memory across fresh cloud sessions: everyone already emailed (`pushed-*`) and every company each list has delivered (`state-*`) | runs, `sync` |

Claude sessions read and write it with the **ArtifactData** tool; `src/desk.mjs` turns files into
documents and back. Fresh cloud sessions start empty, so the desk *is* the memory.

### Making it the HQ for everything
The idea: one place where the founder sees every lead, every send, every reply and every cost, and
decides. Ways to get there, roughly in order of effort:

1. **Replies on the desk.** The n8n relay already classifies every SalesHandy reply. Either:
   - have the daily session pull replies (SalesHandy API) into a `replies` collection, or
   - give the desk page the `mcp` capability so it reads the founder's Gmail connector live.

   Then add a "Replies" tab: interested ones on top, with next steps.
2. **Batches on the desk.** Show each SalesHandy sequence (title, size, verified/catch-all, active or
   paused, opens and replies) in a `sequences` collection that `sync` fills. The 20 Nov "on hold" Shopify
   batch would then be one tap to review.
3. **Signals on the desk.** A `signals` collection (from the signal engine, section 6): who just raised
   money, who is hiring a designer, whose site just changed. These are the reasons to email someone today.
4. **Costs on the desk.** Every run already records costs. Add a monthly view: cost per sendable email
   and per reply, by source. That's how to decide on paid data (section 7).
5. **If it outgrows a claude.ai page:** only Claude sessions and the page itself can write to the page's
   database. Nothing external (n8n, the VPS, the signal engine) can post to it directly. If that becomes
   the bottleneck, move HQ to a small hosted app (e.g. Next.js on Vercel plus Postgres) that everything
   can post to, and keep this page's design. Until then, the daily Claude session is the bridge.

---

## 6. The signal engine

The founder's Python project (shared as `signal-engine.zip`; not in this repo).
- **What it has:** a FastAPI dashboard and API (`/leads`, an f5bot ingest), YAML playbooks, sources (Exa,
  Apify, Google News, Companies House, Reed, f5bot, MahaRERA for Vera, CSV import), enrichment (site
  emails, patterns, Icypeas, MillionVerifier), scoring, dedupe, a compliance step, routing, copy, a
  SalesHandy push and a cost table (`config/costs.yaml`).
- **What was decided:** the lead-gen business inside it becomes **Kyre**, and its **Vera** playbook stays
  as it is.

How it can fit with what we built (a proposal; reshape freely):

| Job | Natural owner | Why |
|---|---|---|
| Finding Kyre companies, vibe/login/store checks, names + emails | lead-scraper (or move into the engine) | built and measured here |
| Real-time **signals** (news, hiring, mentions via f5bot/Exa) | signal engine | it's built around signals with playbooks and half-lives |
| Scoring, dedupe across Vera + Kyre, caps, stop-loss | signal engine | it sees both businesses |
| Writing the email (the teardown *is* the email) | Claude, in the daily run | needs eyes on screenshots |
| Approval | Send Desk | the founder's one screen |
| Sending | SalesHandy (via our `batch`/`push`, or the engine's push) | whichever is simpler; both work |

Integration steps sketched earlier:
- Kyre playbooks: `kyre_type_a`, `kyre_type_b`, `kyre_type_b_jobs`, `kyre_type_c`, `kyre_type_c_jobs`.
- A `kyre_leads` source and a `POST /ingest/kyre` endpoint, so our runs can hand leads over.
- `steps/copy.py` taking our written email as the copy.
- A separate low-cap catch-all step.
- "Login needed" leads go to the engine's review queue, or to the desk's sign-up tab.

**To connect it to the desk:** run the engine on the VPS and allow its host in the cloud environment's
network. Then the daily session can:
1. call the engine (`GET /leads` for signals, `POST /ingest/kyre` for our leads),
2. write what matters onto the desk,
3. tell the engine which emails were approved and pushed.

The engine stays in dry-run mode until the founder says go live.

---

## 7. Paid leads: when, which, and how to add them

### When it starts paying off
Free data has been cheap (about $0.01 per checked email) but limited in **volume** and **certainty**.
Consider paid data when one of these becomes true:
- **The message is proven.** About 300–500 delivered emails with a positive reply rate you'd be happy to
  scale (for example 1–3% interested). Before that, paid data just reaches more people with an unproven
  email.
- **Free sources can't fill the day.** You want more named, checked emails per day than the free sources
  give. For example, Type B feeds give about 10–15 new companies a day.
- **Catch-all is hurting.** If catch-all batches bounce more than ~3%, or inbox health drops, buy
  *verified-only* emails for the leads you already chose.
- **Type C.** Shopify brands with $1–25M revenue are established companies, exactly where paid databases
  are good and our free methods were weakest.

Paid data won't fix the founder's time for logins, or sending capacity. Today's five Kyre inboxes allow
about **120 emails a day** (2 × 30 + 3 × 15). Growing past that means more warmed inboxes or domains
first.

### Which tools fit which type

| Need | Options (check current prices) | Best for |
|---|---|---|
| Find a founder's email from name + domain, pay only when found | Icypeas (already in the engine's costs, ~$0.02/found), Prospeo, Findymail | A, B (after our name search) |
| People at established companies by title | Apollo (API on paid plans), the Apify Apollo-type actors already in `providers.mjs` | B, C |
| Shopify stores with revenue and app data | Store Leads, BuiltWith | C |
| Funding events | Crunchbase API, Harmonic, Dealroom (pricey), our RSS for free | B |
| Job posts by role, across boards | TheirStack, the engine's LinkedIn jobs actor (~$0.40/1k) | B, C |
| Verification at volume | MillionVerifier (already wired: `MILLIONVERIFIER_API_KEY`, `--verifier mv`) | all |
| Who visited the website | Snitcher, Dealfront (company); RB2B (US person-level) | warm signals, all types |

### How to add one
- **Finders and verifiers:** add an entry next to the existing ones in `src/providers.mjs`. Map its
  output to the shared person shape, record its cost with `addCost`, and choose it with `--finder` /
  `--verifier`. Every run's `funnel.md` then shows cost per named email for it.
- **New company sources** (Store Leads, TheirStack, Crunchbase): a file in `src/sources/` returning
  companies, plus a preset in `src/pipeline.mjs`. Feed-style sources get `feed: true` so they aren't paged.
- **Compare before switching.** Run the paid tool and the free path on the **same 50 companies** and
  compare named emails, verified share and cost per sendable email. That's how the finder question was
  settled last time.
- **Keys:** keep them out of the code. Save each as a network secret in the cloud environment (the proxy
  adds it to requests), and add the host to the environment's allowed hosts if needed.
- Then add a monthly paid budget next to `dailyBudgetUsd` in `config/daily.json` and show it on the desk.

---

## 8. What the founder has said matters (context, not commandments)

These came up along the way. They're there for good reasons, but if something seems wrong, ask him.
- Kyre and Vera stay separate: different inboxes and sequences, and Vera's things are left alone.
- Named decision-makers rather than shared inboxes.
- No cold email to German or Austrian companies (their law); LinkedIn there instead.
- Quote only what was seen or measured. No invented results, logos or numbers.
- Catch-all addresses as their own watched batch; ramp volume gradually.
- Ask before spending real money on a new paid tool or sending a batch nobody has looked at. He has been
  happy to approve quickly.
- He likes evidence: tables with counts and costs, colour-coded sheets, and short plain explanations.

---

## 9. Open threads (19 Nov evening)

1. **SalesHandy:**
   - Check that `{{Opener}}` renders in the preheader of the 25 started today. Open one prospect's
     preview; the first sends are at 9:00 am New York time.
   - Delete the six empty "Kyre A/B/C …" sequences, plus "Kyre · Free teardown · 17 Nov batch" if it's
     empty. The API can't delete sequences.
2. **Rotate the SalesHandy key** and save it as a network secret, so the scheduled push and `sync` work
   unattended.
3. **Daily push:** `config/saleshandy.json` has empty step IDs, so the 1:37 pm push holds everything.
   Either point it at current sequences, or switch the push to `batch` (one new sequence per day). The
   second matches how the founder works now.
4. **Telegram:** import the relay into n8n, add the bot and chat ID, create the SalesHandy webhook
   (`node src/saleshandy-setup.mjs webhook --url …`).
5. **Shopify:** find out why 37 scored stores gave 0 emails; decide when to un-pause the 14 on hold.
6. **Website visitor alerts:** the founder asked for a ping with IP, location and details on each visit.
   Plan:
   - a tiny script on the Kyre site posts each page view to an n8n webhook
   - n8n reads the IP, looks it up (ipinfo.io, which gives city, country and network/company), filters
     bots and sends one ping per visitor per day
   - a paid company-identification tool can come later

   Needs the site address, what it's built with and the n8n domain. Mention it in the privacy policy (IP
   addresses are personal data for UK/EU visitors).
7. **Signal engine:** build the Kyre playbooks and the ingest endpoint when the founder wants it, and
   connect it to the desk (section 6).
8. **Replies:** make sure every interested reply gets answered the same day (Julian at Athletedata first).
