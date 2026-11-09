# Vera AI: Lodha handoff and build brief

This file is for the AI assistant on the **new account** (new Vercel, new VPS). It has three parts:

1. **Context:** what Vera is, who it's for, and what the Lodha meeting is about.
2. **What's already built:** the demo, how it's wired, and the data each workflow sends and returns.
3. **Your task:** the prompt at the end. Rebuild the demo on the new VPS, add a Lodha-focused workflow, and generate all the sample files.

No passwords, keys or server addresses for the new setup are in this file. Ask the user for access.

---

## 1. Context

### What Vera is
AI back-office for **mid-size Indian construction contractors and developers** (roughly ₹50–500 Cr revenue). The buyer is the MD (Managing Director)/owner, who usually also acts as project manager. Site teams already report on WhatsApp: voice notes in Hindi or Marathi, Hinglish texts, photos of challans (delivery slips). Vera turns that into records and finds money leaking.

### The offers
| # | Offer | What it does | Pricing idea |
|---|---|---|---|
| 01 | **Material Leak Check** (one-time, one site) | Matches PO (Purchase Order) → delivery challan → gate/weighbridge receipt → stores issue → BOQ (Bill of Quantities) work done. Finds duplicate challans, short supply, rates above PO, deliveries with no PO, overuse beyond norms, extra stock. 1-page ₹ summary. | Fixed fee (₹50,000) + a % of **client-confirmed** recoverable findings. Undisputed lines count as confirmed after 15 days. |
| 02 | **Site Record Desk** (monthly) | Reads the day's WhatsApp messages from all sites. Produces the daily progress record, labour by contractor, materials received, a hindrance register with photos, "money at risk", an 8 AM WhatsApp brief for the owner, and a Tally import CSV. | Monthly subscription |
| Later | Recovery pack, Bill Check (checks bills before they're paid), plant and diesel tracking, owner Q&A on WhatsApp | | |

### The Lodha meeting
- **Who:** a senior engineer at Lodha Group (large listed Mumbai developer). He's a relative of the co-founder. Whatever he sees in the demo, he'll **forward to other departments** inside Lodha.
- **Reality:** Vera can't serve Lodha as a client yet: long procurement, IT/security review, SAP (Systems, Applications and Products) integration. Don't pitch Lodha as a buyer.
- **The angle:** Lodha builds through **contractors**, many of them mid-size, which is Vera's target market. Possible Lodha pains to test (hypotheses, not facts):
  1. **Free-issue material:** Lodha supplies cement and steel to contractors. Reconciling it against work done, and recovering the excess from the contractor's RA (Running Account) bill, is slow and incomplete.
  2. **Contractor DPRs (Daily Progress Reports)** arrive late, in different formats, or from memory.
  3. **Disputes** over measurement, billing and delays, without a dated record of who caused what.
- **Meeting order:** give, then learn, then ask.
  - **Give:** the demo, plus a **free one-package check**. "Pick one contractor package where Lodha supplies cement or steel. Share 3 months of issue records, measurement book and RA bills under an NDA (Non-Disclosure Agreement). In one week we show, free, how much material went beyond what the work needed, line by line."
  - **Learn:** how Lodha reconciles free-issue material, the contract wastage limits, how excess is recovered, how contractors report progress, and what SAP still misses.
  - **Ask:** 2–3 introductions to mid-size contractors on Lodha sites, who the demo goes to (names), and a monthly check-in.
- **What he gets:** a ₹ result on his own package (credit with his boss), being the person who brings in useful tools, and a say in what gets built. A formal advisor role later, if he gets involved.
- **Rules:**
  - Don't use Lodha's name, logo or branding in any marketing or public page.
  - Sample data must use **fictional** contractor and project names and be clearly labelled as sample data.
  - Don't ask for real project data without an NDA.
  - The "Prepared for <firm>" line on the demo page is fine; it's a private link for them.

---

## 2. What's already built (old account, still running)

### How it's wired
```
Browser (Next.js page /demo/<firm-slug>)
   │  POST JSON (fetch, CORS)
   ▼
n8n webhook  ──►  Code nodes (plain JavaScript, no AI)  ──►  Respond to Webhook (JSON)
   ▲
   └─ The page animates one "chip" per node while waiting, then renders the JSON.
```
- **Old n8n:** self-hosted n8n 2.x in Docker behind Caddy (HTTPS) on a Google Cloud VM. Webhook base: `https://n8n.trykyre.com/webhook/`.
- **Old site:** Next.js 16 (App Router, `cacheComponents: true`) + Tailwind v4 on Vercel: `https://vera-ai-orpin.vercel.app/demo/<firm-slug>`.
- **No database yet.** Each run calculates from the request body and returns.
- **No AI model is used yet.** Message reading is keyword/alias matching (Hindi, Marathi, Hinglish, Devanagari digits).

### Repo files that matter (copy these if you have the repo)
| File | What it is |
|---|---|
| `n8n/vera-demo.mjs` | **Source of truth for both workflows.** Builds the n8n workflow JSON from plain JS functions. `node n8n/vera-demo.mjs check` runs local asserts; `deploy` pushes to the old VM. |
| `n8n/leak-sample.json` | Sample data for workflow 01 |
| `n8n/desk-sample.json` | Sample data for workflow 02 (15 messages) |
| `components/DemoKit.tsx` | `N8N` base URL constant, `useFlow` (POST + node animation), `Pipeline` chips, "Open canvas" link |
| `components/DemoLeak.tsx` | Section 01 UI |
| `components/DemoDesk.tsx` | Section 02 UI |
| `app/demo/[[...firm]]/page.tsx` | The page; the slug becomes "Prepared for <Firm>" |
| `.vercelignore` | Keeps `/app/hq` and `/app/api/hq` (a private team tracker) **off** the public site. Keep it that way. |

**To point the site at the new n8n:** change `N8N` in `components/DemoKit.tsx`, plus the workflow IDs if you want "Open canvas" to work.

### n8n building conventions (these worked)
- Webhook node v2: `httpMethod: POST`, `responseMode: "responseNode"`, `options.allowedOrigins: "*"`, a fixed `webhookId` UUID.
- Code node v2, mode "Run Once for All Items", `jsCode`. One node per logical step, chained.
- Respond to Webhook v1.1: `respondWith: "firstIncomingItem"`.
- A sticky note on the canvas explains the workflow in plain words.
- `settings.executionOrder: "v1"`.
- **Deploy:** `n8n import:workflow --input=file.json`, then `n8n publish:workflow --id=<id>`, then **restart the n8n container**. Webhooks only register on startup.
- Keep **money maths in code**, never in an AI model.

### Workflow 01: Material Leak Check
- **ID:** `veraDemoLeakChk1`. **Path:** `POST /webhook/vera/leak-check`.
- **Request body** = `leak-sample.json`:
  ```
  { site, period:{label,...},
    pos:[{po,date,supplier,material,qty,unit,rate}],
    challans:[{challan,date,supplier,po,material,qty,received,unit,rate,wing?}],
    issues:[{slip,date,material,qty,unit,activity,wing,supervisor}],
    boq:[{item,wing,unit,done,next8w,norms:{<material>: qty per unit of work}}] }
  ```
  Materials: `cement` (bags), `steel` (MT, metric tonnes), `rmc` (Ready Mix Concrete, cum), `aac` (Autoclaved Aerated Concrete blocks, nos).
- **Nodes:**
  1. **Read registers:** validates and cleans. Allowed wastage: cement 2%, steel 3%, RMC 1.5%, AAC 3%. RMC is "direct": what arrived at a wing counts as used.
  2. **PO → challan → gate:** duplicate challans, short supply (billed > received beyond a 0.5% tolerance), rate above PO, no-PO deliveries, PO quantity exceeded.
  3. **Issue → BOQ:**
     - needed = Σ(work done × norm) per material per wing
     - allowed = needed × (1 + wastage)
     - excess = used − allowed
     - stock: book stock vs next 8 weeks' need, giving surplus or shortage
  4. **1-page summary:** totals and groupings.
- **Response:**
  ```
  { site, period:{label}, total, recoverable, stoppable, bought, pct, annualised,
    supplier:[{kind,label,count,amount,suppliers[],rows:[{kind,material,supplier,ref,date?,qty,amount,note?}]}],
    overuse:[{material,wing,supervisor,boq,allowed,used,excess,amount}],
    supervisors:[{supervisor,wing,amount,materials[]}],
    extraStock:[{material,name,unit,qty,value}], shortStock:[{material,name,unit,qty,book}],
    gaps:[Row], fee:{fixed,low,high} }
  ```
- **Sample result:**
  - ₹16.1 L leaking: ₹7.5 L recoverable, ₹8.6 L stoppable.
  - 6.3% of ₹2.57 Cr bought.
  - Duplicates ₹4.9 L, short supply ₹2.2 L, above-PO rate ₹48k.

### Workflow 02: Site Record Desk
- **ID:** `veraDemoSiteDsk1`. **Path:** `POST /webhook/vera/site-desk`.
- **Request body:** `{ date: "YYYY-MM-DD", messages: [{id, site, time, kind: voice|text|photo|challan, text, en?, dur?}] }`.
- **Sites:**
  - kharadi: slab work; contractors Ramesh (masons) and Sai (steel)
  - hinjewadi: PEB (Pre-Engineered Building) frames; contractor Patil
  - nashik: PCC (Plain Cement Concrete) flooring; contractor Ganesh
  - baner: sends nothing, to show the "no report" alert
- **Nodes:**
  1. **Site master:** sites, contractors and aliases, planned activities, material rates and aliases, hindrance causes, supplier challan prefixes, labour day rate ₹750, unpaid/returned RA bills, open items.
  2. **Read messages:** extracts labour, progress, received material, stock, hindrances and tags per message. Unreadable messages are marked "noted", not guessed.
  3. **Daily site reports:** one record per site.
  4. **Money at risk:** idle labour × hours × day rate, client delays (claimable), unpaid or returned RA bills, no-PO deliveries, short stock, silent sites.
  5. **8 AM brief + Tally:** WhatsApp text with `*bold*`, and a Tally CSV.
- **Response:**
  ```
  { date, briefDate, stats:{messages,understood,sites,reported,labour},
    sites:[{id,name,place,supervisor,reported,messages,first,last,labour[],labourTotal,progress[],received[],stock[],hindrances[]}],
    tags:{<msgId>:[string]}, risks:[{site,short,kind,title,amount,action}], riskTotal, brief, tally }
  ```
- **Sample result:** 13/15 messages understood, 3/4 sites reported, 102 people, ₹63.8 L at risk.

---

## 3. Your task (prompt for the new account's AI)

> You're working for Vera AI, a small Indian startup selling AI back-office automation to mid-size construction firms. Read sections 1 and 2 of this file first. You have access to a **new VPS** and a **new Vercel account**; ask the user for SSH/n8n access and do not write secrets into any file. Work in small verified steps and keep the code plain and readable.
>
> **A. Set up n8n on the new VPS**
> 1. If n8n isn't running yet: Docker Compose with n8n (pinned version) + Caddy or another HTTPS reverse proxy on the user's domain. Persistent volume. Enough disk; the old VM filled a 10 GB disk.
> 2. Confirm HTTPS works and that a test webhook answers with CORS headers (`OPTIONS` → 204).
>
> **B. Rebuild the two existing demo workflows**
> 1. If you have the repo, reuse `n8n/vera-demo.mjs`: change the deploy target to the new VPS and keep the workflow IDs, paths and response shapes **exactly** as in section 2, so the existing frontend works unchanged.
> 2. If you don't have the repo, rebuild them from section 2, matching the request and response shapes.
> 3. Run the local check, deploy (import → publish → restart), and call both webhooks with the sample JSON to confirm the results match the sample numbers above.
>
> **C. Build workflow 03: Free-Issue Material Reconciliation (developer ↔ contractor)**
> This is the Lodha-focused demo: the developer supplies cement and steel to a contractor and wants to know what to recover in the next RA bill.
> - **ID** `veraDemoFreeIss1`, **path** `POST /webhook/vera/free-issue`, the same node conventions as 01/02, and a sticky note explaining it.
> - **Nodes**, each a Code node:
>   1. **Read contract & registers:** validate inputs and load contract terms (allowed wastage per material, recovery rate multiplier, which materials are free-issue).
>   2. **Issued vs returned vs in stock:** for each contractor, material and RA period: consumed = issued − returned to store − closing stock with the contractor.
>   3. **Work done → theoretical need:** from the measurement book × consumption norms. Steel should come from the BBS (Bar Bending Schedule) quantity where given, otherwise the norm. Then allowed = theoretical × (1 + contract wastage).
>   4. **Steel scrap check:** expected scrap = consumed − theoretical; compare with scrap returned (weighed). Missing scrap is recoverable.
>   5. **Recovery calculation:** excess = consumed − allowed, × issue rate × contract recovery multiplier, minus anything already recovered in earlier RA bills (**never double-count**).
>   6. **Confidence labels:** rule-based, never asked of an AI. Each finding gets High / Medium / Check:
>      - **High:** slip acknowledged by the contractor, plus measured quantities certified.
>      - **Medium:** closing stock estimated or missing for a month, or norm-based instead of BBS.
>      - **Check:** unsigned issue slip, a measurement certified beyond the BOQ quantity, or any data gap.
>   7. **Recovery pack:**
>      - per-contractor summary
>      - a draft **RA bill deduction / debit note** (text + CSV lines) with the evidence references (slip numbers, MB (measurement book) entries, RA numbers)
>      - a contractor comparison: wastage % by material
>      - a ₹ headline: recoverable now / already recovered / net, split by confidence
>   8. **Respond:** return JSON (define the shape clearly and document it in the repo).
> - Plain JavaScript only, no AI model. Rupee maths must be exact and rounded only for display. Counted units (bags, nos) are whole numbers; MT and cum get one decimal.
>
> **D. Sample data: do NOT generate it yourself**
> All sample documents and data payloads are being produced separately (by ChatGPT), as a ZIP with four datasets: `A_leak_riverview`, `B_leak_greenacres`, `C_site_desk`, `D_free_issue_skyline`. Each has `/data` JSON payloads in the exact input shapes below, plus an `ANSWER_KEY.md` with expected ₹ results.
> - Build and test the workflows against the input shapes in this file. Until the ZIP arrives, use the existing `leak-sample.json` / `desk-sample.json` for 01/02, and a tiny hand-made payload (3–4 rows) for 03 purely as a smoke test.
> - **When you reach the point where you need real sample data, stop and ask the user for the ZIP.** Don't invent a full dataset.
> - When it arrives: copy each dataset's `/data/*.json` into `n8n/`, load its `site_master.json` into workflow 02's Site master node, and rewrite the self-checks so they assert the `ANSWER_KEY.md` figures. If a figure doesn't match, tell the user which document and number disagree; don't silently change the logic or the data.
>
> **Input shape for workflow 03** (agreed with the document generator; keep it exactly):
> ```
> { project, developer, period:{label, from, to},
>   contractors:[{ id, name, package, tower,
>     terms:{ cement:{ wastagePct, issueRate, recoveryMultiplier }, steel:{ wastagePct, issueRate, recoveryMultiplier } } }],
>   issues:[{ slip, date, contractor, tower, floor, material, qty, unit, rate, acknowledgedBy, acknowledged }],
>   returns:[{ ref, date, contractor, material, qty, unit, type }],          // type: "return" | "scrap"
>   closingStock:[{ contractor, ra, date, material, qty, unit, verified }],  // a missing month = no row
>   measurements:[{ ra, mb, contractor, boqCode, item, floor, unit, qty }],
>   boq:[{ boqCode, item, unit, boqQty, norms:{ cement?, steel? } }],      // per unit of work
>   bbs:[{ contractor, tower, floor, steelMT }],
>   raBills:[{ ra, contractor, from, to, gross, materialRecovery, retention, tds, net }] }
> ```
> Dates are ISO `YYYY-MM-DD`; `contractor` fields reference `contractors[].id`; materials are `cement` (bags) and `steel` (MT).
>
> **E. Frontend (if you have the repo)**
> 1. Point `N8N` in `components/DemoKit.tsx` at the new n8n.
> 2. Add section 03 "Free-issue reconciliation" to `/demo/[[...firm]]` in the same style as `DemoLeak.tsx`: register tiles, Pipeline chips, Run button, results with confidence labels, the draft deduction, and a contractor comparison.
> 3. Add an audience switch, e.g. `?for=developer`. It hides the ₹50,000 fee box and shows "Pilot: one contractor package, free" instead.
> 4. Add a one-line "sample data from a typical project" note at the top and a contact line ("Want this on one of your sites? WhatsApp / email us"). Ask the user for the contact details.
> 5. Keep `.vercelignore` excluding `/app/hq` and `/app/api/hq`. Deploy to the new Vercel account and check that `/demo`, `/demo/<slug>` and `?for=developer` all work and all three Run buttons return results.
>
> **Definition of done:** all three webhooks answer over HTTPS with CORS; local self-checks pass against the ChatGPT answer keys; the deployed demo runs all three sections end to end with the ChatGPT datasets; nothing secret is committed. Report the live links, workflow IDs, and anything you assumed.
