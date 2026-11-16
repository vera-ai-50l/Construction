# Lead scraper

Finds companies that match our ICPs, reads their public website, and writes one row per
company with the signals we need before a teardown email: how the product can be seen,
who to contact, whether they are hiring designers, and a provisional score.

It does **not** log in, sign up, fill forms, get past CAPTCHAs or bot checks, or guess
email addresses. Dashboards behind a login still need a person (see "Teardowns" below).

## Run it

```bash
cd lead-scraper
npm install
npm run leads -- --profile type_a,type_b --limit 25 --screenshots
```

This is step 1 (finding leads). Step 2 (teardowns and emails) is below.

Output goes to `out/<date>/`: `leads.csv` (open in Sheets), `leads.json` (everything), and
`shots/<domain>/home.png | pricing.png | signup.png | demo.png` when `--screenshots` is on.

| Option | What it does |
| --- | --- |
| `--profile` | Comma list of profiles below, `all`, or `none` (seed file only). Default `type_a,type_b`. |
| `--limit` | Max companies per profile (default 30). |
| `--offset` | Take a different slice/sample of a big source. |
| `--seed file.csv` | Also enrich your own list (`name,website,icp,notes`). `seeds/report-companies.csv` holds the 25 companies from the ICP report. |
| `--screenshots` | Headless browser: screenshots public screens, checks if a "demo" really opens without login, and reads the signup page (work email required? Google/GitHub sign-in? waitlist?). |
| `--verify-emails` | Checks published emails with MillionVerifier; needs `MILLIONVERIFIER_API_KEY`. |
| `--no-browser` | Never start the browser. Client-rendered sites (most Lovable/Bolt apps) then stay unread. |
| `--skip-jobs` | Skip job-board lookups. |

Set `GITHUB_TOKEN` to raise GitHub search limits for `open_source_demo`. Pages are cached
in `out/cache` for 7 days, so re-runs are fast and polite.

## Profiles

| Profile | Customer type | Where companies come from |
| --- | --- | --- |
| `type_a` | Brief type A: AI-built apps with paying users ("AI App Glow-Up") | [TrustMRR](https://trustmrr.com) startups with verified revenue of $1,000+ in the last 30 days, B2C excluded. Tagged `ai_built` when the site or listed stack shows Lovable, Bolt, v0, Replit or Base44. |
| `type_b` | Brief type B: funded AI SaaS with data-heavy dashboards ("Dashboard Sprint") | Active YC companies since 2023, B2B, 2–80 people, describing analytics, monitoring, evals, agents or data tooling ([yc-oss dataset](https://github.com/yc-oss/api), refreshed daily). |
| `published_demo` | Report ICP 1: B2B SaaS that publishes its product demo | [Storylane's customer showcase](https://www.storylane.io/customer-showcase). Starts with big enterprises; they are flagged and score lower. |
| `voice_ai` | Report ICP 2: voice-AI and agent-builder platforms | YC companies describing voice agents, AI phone/call products or agent builders. |
| `open_source_demo` | Report ICP 3: open-source B2B with a company behind it | Organisation-owned GitHub repos with 1,500+ stars and a company homepage. |

Add a source by writing a function that returns `{ name, website, source, source_url, description }`
rows and listing it in `src/profiles.mjs`.

## What each row tells you

- **Access level** (report scale): `A` live product with no login (confirmed by `--screenshots`),
  `A?` a demo link not yet confirmed, `B` an interactive demo embed (Storylane, Navattic, Arcade…),
  `B?` an interactive-demo button, `C` demo credentials mentioned, `D` self-serve signup,
  `D?` only an app/login link, `E` sales-only.
- **Contacts**: only emails the company published on its own pages (`role` = hello@/sales@…,
  `personal` = a named mailbox), people named with a title on the home/about page, founders
  listed on TrustMRR, the company LinkedIn page and X handle. Verify people are still in role.
- **Hiring**: open jobs and open design roles with days open, from public Ashby, Greenhouse
  and Lever boards (linked from the site, or guessed from the company name on Ashby).
- **Score** (out of 100, report model): access 25, redesign 25, commercial 20, reach 15,
  timing 10, fit 5. **Redesign is a placeholder** (12, or 15 for AI-built apps) until someone
  looks at the product; replace it after the teardown. Priority 1 = 85+, 2 = 70–84, 3 = 55–69.
- **Flags**: unreachable or bot-blocked sites, client-rendered pages that were not read,
  public/very large companies.

## Teardowns: what is public and what needs a person

| Screen | Type A (AI-built apps) | Type B (funded AI SaaS) |
| --- | --- | --- |
| Landing / marketing page | Public (screenshot taken) | Public (screenshot taken) |
| Pricing | Public when it exists | Public when it exists |
| Sign-up page | Public (screenshot + work-email check) | Public; often work email only |
| Onboarding, main dashboard | Needs an account | Needs an account, often a work email |
| Interactive or live demo | Rare | Sometimes (`A`/`B` rows) |

So for Type A a teardown of three of the five "screens that matter" (landing, sign-up,
pricing) can be written from public screenshots. Onboarding and the dashboard need a
person to sign up with a company email, which the `signup_url` and `work_email_to_sign_up`
columns tell you how to do. Do not use fake identities or other people's details.

## Step 2: teardowns and the email sheet

```bash
npm run teardown -- --leads out/<run>/leads.json
```

For every lead this opens the public screens (homepage on desktop and phone, pricing,
sign-up, any public demo), screenshots them into `out/<run>/teardowns/<domain>/`, measures
them, and writes the email. Output in `out/<run>/`:

| File | What it is |
| --- | --- |
| `teardowns.xlsx` | Sheets: **Ready to send**, **Needs manual login**, **Needs an email**, **Review (thin teardown)**, **All findings** |
| `saleshandy.csv` | Ready-to-send prospects only: `Email, First Name, Last Name, Company, Website, subject, email_body, followup_body, finding_1..3` |
| `teardowns.json` | Everything, including every measurement |

**Measured checks** (each finding quotes its number): largest-content load time (Google's
4 s "poor" line), page weight, sideways scrolling on a 390 px phone, touch targets under
24 px (WCAG 2.2), text under 12 px, no sign-up/demo button in the first screen, competing
calls to action, WCAG 2 AA errors (axe-core), typeface count, broken images, JavaScript
errors, missing meta description, sign-up form length, work-email-only sign-up, no
self-serve access, hidden pricing, and on dashboards: very wide tables, empty cells, tiny
text, crowded navigation.

**Reviewed findings** (what a person notices: vague headline, no product shown, overlapping
elements, placeholder text, generic AI look) come from a review file per lead at
`out/<run>/reviews/<domain>.json`, written either:

- by hand (or by Claude in a session, as for the first batch), or
- automatically with `--ai-review` (Claude Opus 5.5 looks at the screenshots; needs
  `ANTHROPIC_API_KEY`; roughly $0.05 per lead; server-side refusal fallback is on).

**Subject lines and the first sentence** are written from the single most specific finding,
because that is what decides the open: a few lowercase words that only make sense for that
company ("the 'asdasd' error in middleware's hero", "metropolix took 8.4s to load"), and the
same observation as the email's first sentence, which inboxes show as the preview.
`subject_alt` uses a buying signal when there is one ("while pointone hires a brand
designer") or the strongest measured number, so you can A/B test the two in SalesHandy.
Reviews carry their own `subject` and `hook`; measured findings have templates in
`src/teardown/findings.mjs`.

A file that exists is never overwritten. The email leads with up to two reviewed findings,
backs them with measured ones, opens with one genuine strength, and offers a free
before/after with no call. Use `--reuse` to rebuild emails from saved screenshots after
adding reviews.

The emails describe what was observed and its likely effect. They do not claim to know a
company's churn or bounce rate: nobody can measure that from outside.

### Getting the founder's email (do this before sending)

Shared inboxes (hello@, info@, team@) rarely reach the person who buys, so only rows
addressed to a named person count as **ready**; the rest land on **Shared inbox only
(find founder)**. To fix them:

1. Name the decision-maker: the YC company page ("Active Founders"), the TrustMRR founder,
   the company's About page, or LinkedIn (company > People > "founder"). Under ~50 staff
   pick the CEO; above that, the head of product or design.
2. Find the address with one finder tool (Hunter, Apollo, Snov, Prospeo, or SalesHandy's
   own lead finder if your plan has it), or try the usual startup patterns: `first@`,
   `first.last@`, `flast@`.
3. Verify every address (MillionVerifier, NeverBounce, ZeroBounce or SalesHandy's
   verifier). Send to `valid` only; `catch-all` only when a finder also returned it;
   never to `invalid` or `unknown`. Bounces above ~2% hurt every later email.
4. Put the verified ones in a CSV (`domain,email,first_name,last_name,title`) and rebuild:
   `npm run teardown -- --leads out/<run>/leads.json --reuse --contacts contacts.csv`.
   The email, the greeting and the SalesHandy file update together.
5. Check the law where the company is: US (CAN-SPAM) needs a real sender and an opt-out;
   EU B2B email relies on legitimate interest (relevant offer, clear opt-out); Germany
   generally needs prior consent even for B2B, so reach German companies on LinkedIn.

### Dashboards behind a login

Leads whose dashboard is not public are listed on **Needs manual login** with the sign-up
URL, whether a work email is required, and a command to run **on your own computer**:

```bash
npm run login -- https://app.example.com example.com
```

A browser opens; sign up or log in yourself, open the main dashboard, press Enter. Your
session is saved to `auth/<domain>.json` (git-ignored; it holds your cookies, keep it
private). The next `npm run teardown` screenshots and audits that dashboard with your
session and adds dashboard findings. Use only accounts you created yourself, with your
real details, and respect each product's terms.

### Sending with SalesHandy

1. Import `saleshandy.csv` as prospects; map `Email`, `First Name`, `Last Name`, `Company`,
   `Website`, and create custom fields for `subject`, `email_body` and `followup_body`.
2. In the sequence, step 1 subject = the `subject` merge tag (add a variant with `subject_alt`
   to A/B test), body = the `email_body` merge
   tag; step 2 (3 days later) body = `followup_body`. Check SalesHandy's exact merge-tag
   syntax when you map the fields.
3. Read every email before it goes out, use a separate sending domain with warmed inboxes,
   add your signature and an opt-out line.

## Being a good citizen

- Honest user agent, robots.txt respected, at least 1.2 s between requests to one host.
- Only public pages and documented public APIs; nothing behind a login.
- Before emailing anyone: follow CAN-SPAM (US), GDPR/PECR (EU/UK) and CASL (Canada) rules
  for B2B cold email: a real sender, a clear opt-out, and a legitimate-interest note for EU
  contacts. Personal names and emails in `out/` are personal data: keep that folder private
  (it is git-ignored) and delete leads you will not contact.

## Tests

```bash
npm test
```
