# vera-leads

Finds construction firms in MMR and Pune that have a reason to talk to Vera **this month**, and turns them into a Saleshandy upload with a first line about their own project.

Strategy and email copy: [`docs/vera-outreach.md`](../docs/vera-outreach.md).

## What it looks for

| Signal | Where | What it means | Opening line it writes |
|---|---|---|---|
| New MahaRERA registration | MahaRERA project search | A project is about to start | "Saw *Sai Shraddha Heights* come up on MahaRERA in Thane." |
| Completion date extended | MahaRERA (Extension Certificate on the project) | The project is late | "Saw the MahaRERA completion date for *Green Acres II* has moved to a later date." |
| Nearly complete (off: MahaRERA's filter is broken) | MahaRERA (75–100% built, via the completion-percentage search) | The last stretch: pressure on progress and cost | "Saw *Raj Residency* is past 75% complete on MahaRERA." |
| Hiring site, planning, billing, QS or stores staff | Naukri / LinkedIn Jobs via Apify | More sites than the team can report on | "Saw *Raj Constructions* is hiring for 3 site roles in Mumbai, including a site engineer." |

Left out automatically: Lodha/Macrotech (warm intro only), large developers and EPC firms (too big for Vera today, see `config.mjs`), recruitment agencies posting on others' behalf, non-construction employers, posts older than 45 days.

Each firm gets a score: signal strength, halved every 45 days, plus points for being in MMR/Pune, having 2+ MahaRERA projects, hiring 3+ site roles, or showing both kinds of signal.

## Setup (once)

Needs Node 20+ and, for MahaRERA, Playwright (below).

Put the keys in `vera-leads/.env` (git-ignored, read automatically on every run, also on Windows):

```
APIFY_TOKEN=...           # Apify Console > Settings > API & Integrations
MILLIONVERIFIER_KEY=...   # MillionVerifier > API
```

Never commit it or paste the keys anywhere else.

**MahaRERA needs a browser.** Its results page is built with JavaScript, so install Playwright once:

```bash
npm i playwright
npx playwright install chromium
```

**First run: a quick check.** One page per district:

```bash
node vera-leads.mjs maharera --pages 1 --debug
```

It prints a line per district (Thane, Mumbai Suburban, Mumbai City, Raigarh, Pune, Palghar) with how many projects are listed. If a line looks wrong, send `data/debug/` to whoever maintains this.

How it reads MahaRERA (the list shows no dates except "Last Modified"):
- **New projects:** results are listed oldest first, so it reads each district's last 5 pages. The first run is a baseline (only projects modified in the last 60 days count as new); after that, anything on those pages that wasn't there last week is new. If the last page is empty (the site's page count is sometimes one too high, as with Raigarh), it reads the page before it instead.
- **Extended:** any project card with an Extension Certificate. Dated by "Last Modified", so old extensions score close to zero.
- **Nearly complete: off.** Checked on 13 Nov 2026 through MahaRERA's own search form: the completion-percentage filter (every band) and the completion-date filter both return "No Records Found" for all of Maharashtra, and both are ignored when passed in the address. The code is kept behind `nearlyDoneSearch` in `config.mjs` in case the site fixes it. The signal below is listed for that case only.

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

Apify cost: 8 keywords × 4 cities = 32 small runs a week, up to 3,200 job posts. The default Naukri actor (`valig/naukri-jobs-scraper`) charges about $0.0004 a job, so roughly $1.30 a week. Check the price before swapping actors: some charge 25× that. Cut keywords or cities in `config.mjs` if needed.

## Data and privacy

- Everything lives in `data/` (firms, contacts, signals, what was exported, opt-outs) and `out/`. Both are git-ignored: they hold personal data and must never be committed.
- Every signal keeps its source URL and the date it was seen, and every contact keeps where it came from. This is the record India's DPDP Rules will expect from **13 May 2027**.
- Be gentle with MahaRERA: one page every 3 seconds, about 200 pages a week across the six districts, and it stops reading a district's newest pages once it reaches last week's projects.

## Tests

```bash
node test/run.mjs
```

Offline, on sample pages in `test/fixtures/` (fictional firms): both MahaRERA layouts (cards and table), job filtering, contact matching, scoring, first lines, the export rules.

## Every Monday on n8n, with a Google Sheet

The workflow in `n8n/weekly-sheet.mjs` runs `weekly` on the n8n VPS at 07:00 IST and fills one Google Sheet:

| Tab | What |
|---|---|
| `2026-11-16` (new each week) | The Lead Finder to-do list, best firm first, with a Status column for you |
| `Ready to email` | Verified people exported that week (one row each, with the week) |
| `Summary` | One row a week: new projects, hiring firms, emails verified, credits left |

n8n runs in Docker without a browser, so it SSHes into the VPS and runs vera-leads there. If the run isn't finished after 75 minutes it checks every 20 minutes, and fails the execution after about 4 hours.

**Deploy once** (from this folder, on a machine that can `ssh` to the VPS):

```bash
VERA_SSH=user@vps-ip VERA_SHEET_URL='https://docs.google.com/spreadsheets/d/...' node n8n/weekly-sheet.mjs deploy --env --data
```

This copies the committed code to `/opt/vera/Construction/vera-leads`, installs it and Chromium, runs the tests, copies `.env` and `data/` if the VPS has none, makes an SSH key for n8n on the VPS (it never leaves the server), and imports the workflow switched off. Then in n8n: pick your Google credential in the three Google Sheets nodes, create the tabs `Summary` and `Ready to email` in the sheet, and switch the workflow on. Later deploys: the same command without `--env --data`.

The sheet holds names and emails: keep it shared only with the people who send.

Without n8n, a plain cron line on the VPS does the run (no sheet):

```
0 7 * * 1  cd /opt/vera/Construction/vera-leads && node vera-leads.mjs weekly >> data/weekly.log 2>&1
```
