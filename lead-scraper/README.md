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
