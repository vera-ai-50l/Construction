# vera-leads

Finds construction firms in MMR and Pune that have a reason to talk to Vera **this month**, and turns them into a Saleshandy upload with a first line about their own project.

Strategy and email copy: [`docs/vera-outreach.md`](../docs/vera-outreach.md).

## What it looks for

| Signal | Where | What it means | Opening line it writes |
|---|---|---|---|
| New MahaRERA registration | MahaRERA project search | A project is about to start | "Saw *Sai Shraddha Heights* come up on MahaRERA in Thane." |
| Completion date extended | MahaRERA (revised completion date) | The project is late | "Saw the MahaRERA completion date for *Green Acres II* has moved to March 2027." |
| Completion near or past | MahaRERA (completion within 6 months) | Pressure on progress and cost | "*Raj Residency* is due for completion on MahaRERA by February 2027." |
| Hiring site, planning, billing, QS or stores staff | Naukri / LinkedIn Jobs via Apify | More sites than the team can report on | "Saw *Raj Constructions* is hiring for 3 site roles in Mumbai, including a site engineer." |

Left out automatically: Lodha/Macrotech (warm intro only), large developers and EPC firms (too big for Vera today, see `config.mjs`), recruitment agencies posting on others' behalf, non-construction employers, posts older than 45 days.

Each firm gets a score: signal strength, halved every 45 days, plus points for being in MMR/Pune, having 2+ MahaRERA projects, hiring 3+ site roles, or showing both kinds of signal.

## Setup (once)

Needs Node 20+. No `npm install` needed unless you use `--browser` (then `npm i playwright`).

```bash
export APIFY_TOKEN=...           # Apify Console > Settings > API & Integrations
export MILLIONVERIFIER_KEY=...   # MillionVerifier > API
```

Put these in a `.env` you `source`, never in git.

**First run: check MahaRERA once.** This was built without access to the live site, so check the parser on page 1:

```bash
node vera-leads.mjs maharera --pages 1 --debug
```

- Projects found: good, run it in full.
- `0 projects`: try `--browser` (renders the page in Chromium).
- Still 0: open MahaRERA in your browser, search, save each results page (Ctrl+S), then `node vera-leads.mjs maharera --file page1.html page2.html`. Send `data/debug/maharera-page1.html` to whoever maintains this and the parser can be adjusted in minutes.
- If MahaRERA's search address has changed, set `MAHARERA_URL` (with `{page}` where the page number goes).

The first MahaRERA run is a baseline: projects with a registration date in the last 60 days count as new; the rest are remembered so next week's new ones stand out.

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
3. **`linkedin.csv`**: day-1 connection requests for the founder whose week it is.
4. **`catch-all.csv`**: the verifier could not confirm these. Skip, or send at most 10 a day from the main-domain inboxes.
5. Opt-outs and bounces from Saleshandy, every week:
   ```bash
   node vera-leads.mjs suppress unsubscribes.csv
   ```
   Share `data/suppression.txt` with the Kyre side; the memo asks for one list across both.

Exported people are logged, so nobody is emailed again within 90 days, and a firm already in a sequence is skipped.

## Commands

```
maharera [--pages N] [--browser] [--file a.html ...] [--debug]
hiring   [--board naukri|linkedin] [--file dataset.json ...]
contacts <file.csv>       import people (Lead Finder, Apollo, LinkedIn sheet)
enrich   [--limit 50]     public emails and phones from company websites
verify   [--limit 500]    MillionVerifier; refuses to run if DNS is broken
top      [--n 25]         best firms and why
export   [--dry-run] [--min 30] [--limit 150]
suppress <email | @domain | file.csv>
weekly   [--browser] [--dry-run]
status
```

`hiring --file` takes any Apify jobs dataset exported as JSON, so you can run an actor by hand in the Apify console and import it here.

## Tuning

All in `config.mjs`: regions, keywords, job boards and actors, the do-not-contact lists, signal weights, the export score (30), batch cap (150), and the 90-day re-contact rule.

Apify cost: 8 keywords × 4 cities = 32 small runs a week, roughly 3,000 job posts, about $1–3 a week on most Naukri actors. Cut keywords or cities in `config.mjs` if needed.

## Data and privacy

- Everything lives in `data/` (firms, contacts, signals, what was exported, opt-outs) and `out/`. Both are git-ignored: they hold personal data and must never be committed.
- Every signal keeps its source URL and the date it was seen, and every contact keeps where it came from. This is the record India's DPDP Rules will expect from **13 May 2027**.
- Be gentle with MahaRERA: one page every 3 seconds, stops after 3 pages with nothing new.

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
