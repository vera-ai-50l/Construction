# vera-leads

Finds construction firms in MMR and Pune that have a reason to talk to Vera **this month**, and turns them into a Saleshandy upload with a first line about their own project.

Strategy and email copy: [`docs/vera-outreach.md`](../docs/vera-outreach.md).

## What it looks for

| Signal | Where | What it means | Opening line it writes |
|---|---|---|---|
| New MahaRERA registration | MahaRERA project search | A project is about to start | "Saw *Sai Shraddha Heights* come up on MahaRERA in Thane." |
| Completion date extended | MahaRERA (Extension Certificate on the project) | The project is late | "Saw the MahaRERA completion date for *Green Acres II* has moved to a later date." |
| Completion near or past | MahaRERA (completion within 6 months) | Pressure on progress and cost | "*Raj Residency* is due for completion on MahaRERA by February 2027." |
| Hiring site, planning, billing, QS or stores staff | Naukri / LinkedIn Jobs via Apify | More sites than the team can report on | "Saw *Raj Constructions* is hiring for 3 site roles in Mumbai, including a site engineer." |

Left out automatically: Lodha/Macrotech (warm intro only), large developers and EPC firms (too big for Vera today, see `config.mjs`), recruitment agencies posting on others' behalf, non-construction employers, posts older than 45 days.

Each firm gets a score: signal strength, halved every 45 days, plus points for being in MMR/Pune, having 2+ MahaRERA projects, hiring 3+ site roles, or showing both kinds of signal.

## Setup (once)

Needs Node 20+ and, for MahaRERA, Playwright (below).

```bash
export APIFY_TOKEN=...           # Apify Console > Settings > API & Integrations
export MILLIONVERIFIER_KEY=...   # MillionVerifier > API
```

Put these in a `.env` you `source`, never in git.

**MahaRERA needs a browser.** Its results page is built with JavaScript, so install Playwright once:

```bash
npm i playwright
npx playwright install chromium
```

**First run: a quick check.** One page per district:

```bash
node vera-leads.mjs maharera --pages 1 --debug
```

It prints a line per district (Thane, Mumbai Suburban, Mumbai City, Raigarh, Palghar, Pune) with how many projects are listed and how many are due in the next 6 months. If a line looks wrong, send `data/debug/` to whoever maintains this.

How it reads MahaRERA (the list shows no dates except "Last Modified"):
- **New projects:** results are listed oldest first, so it reads each district's last 5 pages. The first run is a baseline (only projects modified in the last 60 days count as new); after that, anything on those pages that wasn't there last week is new.
- **Due soon:** the search's own completion-date filter, today to 6 months out, up to 30 pages per district.
- **Extended:** any project card with an Extension Certificate. Dated by "Last Modified", so old extensions score close to zero.

## Every Monday (about 45 minutes)

```bash
node vera-leads.mjs weekly
```

That runs MahaRERA, hiring, website emails, verification and the export. Then:

1. **`out/<date>/needs-contacts.csv`**: top firms with no verified email. For each, find the MD/owner in Saleshandy Lead Finder (4,000 credits a month on Pro) or on LinkedIn (links are in the file). Export from Lead Finder as CSV, then:
   ```bash
   node vera-leads.mjs contacts leadfinder-export.csv
   node vera-leads.mjs verify
   node vera-leads.mjs export
   ```
2. **`saleshandy.csv`**: upload to the Vera *cold* sequence (secondary-domain inboxes). Map `Signal Line`, `Angle` and `Project` to custom fields of the same name. Nothing in it is unverified.
   **`saleshandy-list.csv`**: people from your own Lead Finder lists (below). Same columns; upload to a separate sequence so you can compare replies.
3. **`linkedin.csv`**: day-1 connection requests for the founder whose week it is.
4. **`catch-all.csv`**: the verifier could not confirm these. Skip, or send at most 10 a day from the main-domain inboxes.
5. Opt-outs and bounces from Saleshandy, every week:
   ```bash
   node vera-leads.mjs suppress unsubscribes.csv
   ```
   Share `data/suppression.txt` with the Kyre side; the memo asks for one list across both.

### Lead Finder lists (firms without a signal)

Build a list in Lead Finder (construction, MMR/Pune, MD/Director/Owner), export it, then:

```bash
node vera-leads.mjs contacts leadfinder-list.csv --list
node vera-leads.mjs verify
node vera-leads.mjs export
```

Each firm gets a `list` signal so it can be exported, with a neutral first line ("Came across X while looking at construction firms in Thane."). If the firm also has a real signal, the signal wins. The weekly cap (150, sized for 3 inboxes at 30 a day on a 3-email sequence) goes to signal firms first; lists fill the rest. List firms with no verified email are dropped, not added to `needs-contacts.csv`.

Exported people are logged, so nobody is emailed again within 90 days, and a firm already in a sequence is skipped.

## Commands

```
maharera [--pages N] [--file a.html ...] [--debug]
hiring   [--board naukri|linkedin] [--file dataset.json ...]
contacts <file.csv> [--list]  import people; --list exports them even without a signal
enrich   [--limit 50]     public emails and phones from company websites
verify   [--limit 500]    MillionVerifier; refuses to run if DNS is broken
top      [--n 25]         best firms and why
export   [--dry-run] [--min 30] [--limit 150]
suppress <email | @domain | file.csv>
weekly   [--dry-run]
status
```

`hiring --file` takes any Apify jobs dataset exported as JSON, so you can run an actor by hand in the Apify console and import it here.

## Tuning

All in `config.mjs`: regions, keywords, job boards and actors, the do-not-contact lists, signal weights, the export score (30), weekly cap of new people (150), and the 90-day re-contact rule.

Apify cost: 8 keywords × 4 cities = 32 small runs a week, roughly 3,000 job posts, about $1–3 a week on most Naukri actors. Cut keywords or cities in `config.mjs` if needed.

## Data and privacy

- Everything lives in `data/` (firms, contacts, signals, what was exported, opt-outs) and `out/`. Both are git-ignored: they hold personal data and must never be committed.
- Every signal keeps its source URL and the date it was seen, and every contact keeps where it came from. This is the record India's DPDP Rules will expect from **13 May 2027**.
- Be gentle with MahaRERA: one page every 3 seconds, about 200 pages a week across the six districts, and it stops reading a district's newest pages once it reaches last week's projects.

## Tests

```bash
node test/run.mjs
```

Offline, on sample pages in `test/fixtures/` (fictional firms): both MahaRERA layouts (cards and table), job filtering, contact matching, scoring, first lines, the export rules.

## Run it on a schedule (optional)

On the n8n VPS, every Monday at 07:00:

```
0 7 * * 1  cd /opt/vera/Construction/vera-leads && . ./.env && node vera-leads.mjs weekly >> data/weekly.log 2>&1
```
