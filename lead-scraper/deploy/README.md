# Running the lead pipeline on the VPS

The pipeline runs every week, up to scoring (no teardowns), and puts the scored leads,
with remarks, into a Google Sheet. Two ways to run it; pick one.

```
n8n (Schedule) ──POST /runs──> leads API (this folder) ──> pipeline: discover → enrich →
   ▲                                  │                   login check → contacts → verify →
   │                                  │                   score → remarks → leads-scored.*
   └──── GET /runs/:id/leads.json ◄───┘
          └─> Google Sheet tab "Type A leads" (rows updated by domain)
```

## What a run does (Type A preset)

| Step | Tool | Cost |
| --- | --- | --- |
| Find apps | TrustMRR (verified revenue), Show HN, Common Crawl (Lovable/Base44 hosts), 60 per source | free |
| Read sites, vibe check, paid-product check | own code + headless Chromium | free |
| Login check | opens each sign-up / app page: public demo, self-serve, work email, waitlist, sales-gated | free |
| Names | TrustMRR founders, team pages, legal notices, HN profiles, the company site behind a Lovable app | free |
| Names still missing | one Google search per company (LinkedIn result titles; LinkedIn is not visited) | ~$0.0045 / company |
| Emails | up to 5 patterns per person, verified in rounds | MillionVerifier (your plan) or bounceverify ~$0.0009 / check |
| Score + remarks | fit score 0-100, email confidence, remarks ("Login required: work email only", "catch-all: send separately"...) | free |

Each run writes `out/runs/<id>/`: `leads-scored.xlsx` (colour-coded), `.csv`, `.json`,
`funnel.md` (count and cost at every step) and `run.log`. Companies already delivered
are never delivered again, and the next run starts further into each source
(`out/state/<preset>.json`). Expect about $0.30-0.60 per weekly Type A run.

## Option 1: n8n (recommended; uses the n8n server in `infra/`)

1. On the VPS, with the n8n stack from `infra/` already running:
   ```bash
   cd /opt/leads/lead-scraper/deploy      # wherever you copied the repo
   cp .env.example .env                    # fill in APIFY_TOKEN, LEADS_API_TOKEN, optional MillionVerifier
   docker network ls                       # find the n8n network, e.g. vera_default; put it in .env
   docker compose up -d --build
   docker compose exec leads wget -qO- --header "Authorization: Bearer $LEADS_API_TOKEN" http://localhost:8787/health
   ```
2. Build the workflows (on any machine with the repo): `node deploy/n8n/build.mjs`.
3. In n8n: **Workflows → Import from file** → `deploy/n8n/type-a-leads.json` (B and C files too if you want them weekly).
4. In the imported workflow:
   - Create a **Header Auth** credential called "Leads API": name `Authorization`, value `Bearer <LEADS_API_TOKEN>`; pick it in *Start run*, *Check run* and *Get scored leads*.
   - In **Google Sheet**, connect your Google account and paste the sheet URL. Make a tab named `Type A leads`.
5. Click **Run now** once (takes 20-40 minutes), check the sheet, then **Activate**. It runs Mondays 07:17 IST.

The API is only on the Docker network (not published to the internet) and also checks the token.

## Option 2: cron, no n8n

```bash
cd /opt/leads/lead-scraper && npm ci && cp deploy/.env.example deploy/.env   # fill it in
crontab -e
17 7 * * 1  /opt/leads/lead-scraper/deploy/cron-type-a.sh >> /var/log/leads-type-a.log 2>&1
```
Results land in `out/runs/`. Chromium must be installed for Playwright (`npx playwright install --with-deps chromium`), or run the Docker image with `docker compose run --rm leads node src/pipeline.mjs --preset type_a`.

## API

| Call | Does |
| --- | --- |
| `POST /runs` `{"preset":"type_a","limit":60}` | queues a run (one at a time), returns `{id}` |
| `GET /runs/:id` | status (`queued`, `running`, `done`, `failed`), lead counts, cost, funnel |
| `GET /runs/:id/leads.json` / `leads.csv` / `leads.xlsx` / `funnel.md` / `log` | results |
| `GET /runs` | all runs |
| `GET /health` | up, busy, presets |

Presets (`src/pipeline.mjs`): `type_a` (AI-built apps), `type_b` (funded AI SaaS with
dashboards: YC, finder database, login check), `type_c` (US/EU Shopify brands).
