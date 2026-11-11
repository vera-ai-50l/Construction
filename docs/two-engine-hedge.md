# The Two-Engine Hedge: decision memo (10 Nov 2026)

Source: `The_Two-Engine_Hedge.html`, prepared for the Vera AI founders on 10 Nov 2026. This file is a complete written record of it, including the content of its interactive parts. Money in rupees at ~₹92 per US$. Figures are planning estimates; legal notes are general guidance, not legal advice.

## Verdict: Go, with a gate (confidence: medium)

Run **lead gen as Vera's second offer on one shared engine**, and decide on **9 January 2027** whether it stays.

- Why: lead gen pays in weeks while Vera's enterprise deals take months, and it trains the exact skill Vera's own outreach needs.
- It will **not** double revenue. Revenue adds, it doesn't multiply. The gain is timing.
- Sharing tools saves ~₹6.7k/month. The real limit is **founder hours**, which cap lead gen at ~4 clients while Vera keeps 60% of time.

### Three rules
1. **Vera keeps first claim.** 60% of founder hours, and every Lodha, PRS Legal and clinic meeting, outrank any lead-gen task.
2. **Separate brand and inboxes.** Lead gen gets its own name, domains and mailboxes. Nothing cold goes out from Vera's main domain.
3. **One niche, signal-led, gated.** Recruitment agencies in the UK, Ireland and US. By 9 Jan 2027: 2 paying clients or 8 held sales calls, or stop.

### Headline numbers
- ₹9.7k: lead gen's running cost per month at launch, incl. half the shared stack.
- ₹6.7k: monthly saving from sharing Saleshandy, scrapers and verification.
- ~3.8: clients servable at 25 hrs/week per founder with Vera at 60%.
- ₹68k–₹3.8L: lead-gen MRR by June 2027, conservative to base case.
- ~325 founder-hours a month is the binding limit.

### Structure
- **Shared engine:** Saleshandy (client workspaces), n8n + Apify signal scrapers, Lead Finder + verification, copy and testing playbook, the 3 founders' LinkedIn accounts.
- **Vera AI:** high ticket, months to close, own secondary domains.
- **Lead gen (new brand):** low ticket, cash in weeks, own domains + per-client domain sets.
- "Lessons flow both ways; sender reputation never does."

### Corrections to the original framing
- "2x revenue": no. Same 325 founder-hours serve two offers; the gain is lead-gen cash arriving while Vera deals are still in pilots.
- "Cost synergy": real but small (whole shared stack ~₹13.5k/month). The bigger synergy is learning: every copy and signal test informs both engines.
- "Belgium, Switzerland": quieter partly because cold email to named people there needs consent.
- A hedge needs uncorrelated risk: one shared domain or LinkedIn ban would hit both at once. Separate sending infrastructure is what makes it a hedge.

## 01 · What to share

| Asset | Share? | Buys | Risk | Rule |
|---|---|---|---|---|
| Saleshandy account | Yes | One subscription, separate client workspaces | Starter: 6,000 emails + 2,000 active prospects/month, 1 user. Planned volume for both engines ~7,600 emails | Starter (monthly) for Vera in Nov; Pro ($99) the week lead-gen domains go live |
| Signal scrapers (n8n + Apify) | Yes | Build once, two feeds | A broken scraper starves both pipelines silently | One owner, weekly health check |
| Data + verification | Yes | Pro includes 4,000 Lead Finder credits/month; verifier credits don't expire | Earlier Apollo run (₹8,000 for 4,000 credits) failed on false emails and few usable contacts | Verify every list; pause any campaign with bounce > 2% |
| Sending domains and inboxes | **No** | Nothing worth the risk | Complaints on one brand drag the other's inbox placement | Separate domains per brand and per lead-gen client |
| LinkedIn accounts | Split | Same three people, same networks | ~100 invites/week/account total | Assign each founder's invites to one engine per week |
| Founder hours | Scarce | This is the constraint | Lead-gen reply handling is daily and urgent | Hours budget in Scenarios |
| Co-founder's 2 warmed inboxes (dormant domain) | Lead gen | Skip 3–4 weeks of warmup for the offer test | Old brand shows in the from-address | Check blacklists, re-verify SPF/DKIM/DMARC, redirect old domain to lead-gen site, send 10–15/day each |

- Vera's 3 warming inboxes: if they're on Vera's **main** domain (website, proposals), keep them for warm intros, replies and low-volume cold (~15/day each). Put volume on **2 secondary domains** so cold email can never put Lodha or PRS Legal follow-ups in spam.
- Planned monthly volume (22 sending days): Vera main 3 × 15/day = 990; Vera secondary 4 × 25/day = 2,200; lead gen 8 × 25/day = 4,400. Total 7,590.
- Per-inbox volume stays 25–30/day: ramp 5–10 → 15 → 30/day, never above 30 campaign emails/inbox/day (Instantly 2026). Domains need 4–6 weeks of warmup.
- Google + Yahoo (Feb 2024) and Microsoft (May 2025) require SPF, DKIM, DMARC for bulk senders; 0.3% spam complaints is the failure line, Google recommends < 0.1%. At 30 sends/day one complaint is 3%, so scale comes from more inboxes, not more email per inbox.

## 02 · Lead-gen market

Reply rates have roughly halved since 2022. **Plan and price on 2.5% reply rate** for list-based email; signals and a niche are the reason to beat it.

2026 average reply-rate benchmarks: Smartlead 0.74% (850M emails), Boomerang 1.4%, Visionary Marketing 2.1% (median, Apr 2026), Instantly 3.43%, Saleshandy 3.7% (53M emails, Jan–Jun 2026). Instantly's top 10% of senders clear 10.7%.

| Pricing model | 2026 range | Fit |
|---|---|---|
| Pay per appointment | $150–400 | First 2 founding clients, priced low for case studies |
| SMB meeting | $150–500 | The recruitment-agency niche sits here |
| BANT-verified meeting | $400–750 | Later, once qualification is proven |
| Retainer, cold email only | $2k–8k/mo | After 2–3 case studies |
| Hybrid: base + per meeting | base + bonus | Default from month 3 (modelled ~$1,100/mo) |
| Pay per positive reply | $75/reply | The deal a placement firm offered earlier; usable anchor |
| India managed cold email | ₹80k–4L/mo | Domestic benchmark; skip for now |

Margins: an $8k retainer costs ~$500 (domains, mailboxes) + $2–3k execution (Prospeo). Under pressure because AI SDR tools cost $100–400/month. Defensible position: a **niche-specific signal feed + pay-for-results guarantee**.

| Niche | Free signal | Willingness to pay | Crowding | Verdict |
|---|---|---|---|---|
| Recruitment/staffing agencies (UK, IE, US) | Companies hiring in bulk, from job boards (you sell them the signal you use) | High; used to paying per result | Medium (one specialist lists ~$3,000/mo + setup) | **Start here** |
| IT services / dev shops | Funding, tech-stack changes, hiring engineers | Medium | High | Second |
| B2B SaaS | Many | High | Very high | Avoid early |
| Indian SMEs (domestic) | Fewer clean sources | Low in rupees | Low | Avoid; DPDP applies from May 2027 |

## 03 · Where to sell (countries)

Go where B2B cold email is lawful with an opt-out; use LinkedIn in consent countries. Under-served and open: Ireland, plus Finland and Sweden for role-relevant offers.

| Country | Status | Rule | Basis | How to work it | Verdict |
|---|---|---|---|---|---|
| US | Open | Cold B2B email allowed without prior consent | CAN-SPAM | Honest subject, sender identity, physical address, working opt-out | Open, most crowded. Volume once offer is proven |
| UK | Open | Allowed to corporate bodies (Ltd, PLC, LLP); sole traders and ordinary partnerships need consent | PECR regs 21–22 + UK GDPR | Filter out sole traders and non-LLP partnerships. Many clinics are partnerships: use intros and LinkedIn for Vera's UK doctor work | Open for companies. Primary lead-gen market |
| Ireland | Open | Allowed when address is mainly for business and email relates to that work | S.I. 336/2011 + DPC guidance | Role-relevant, opt-out in every email | Open and under-served |
| Finland | Open | Allowed if relevant to job role, or generic address with opt-out | Electronic Communication Services Act ch. 24 | Tight role targeting; English works | Good niche-country test |
| Sweden | Open | Allowed when clearly connected to professional role; check NIX register | Marketing Practices Act ss. 19, 21 | Role-relevant only; never individual traders without consent | Open for role-relevant offers |
| France | Careful | Sources disagree (role-relevant B2B vs opt-in unless generic address) | CPCE L34-5, CNIL | Generic addresses or documented legitimate interest; French copy | Not a first market |
| Netherlands | Consent | Opt-in unless previous business relationship | Telecommunications Act art. 11.7 | LinkedIn-first | LinkedIn only |
| Belgium | Consent | Opt-in unless generic address (info@) or prior business; check Do-Not-Call-Me | Code of Economic Law XII.13, VI.111–115; RD 4 Apr 2003 | LinkedIn + generic inboxes | Quiet because closed to named cold email |
| Switzerland | Consent | Opt-in unless prior relationship (double opt-in per lemlist) | UWG art. 3 | LinkedIn only; don't call numbers marked * | LinkedIn only |
| Germany | Consent | Double opt-in except existing customers, similar products | UWG §7 | Don't cold email; LinkedIn and events | Avoid for cold email |
| Australia | Careful | Consent, but inferable from conspicuously published business address if role-relevant | Spam Act 2003 (ACMA) | Only published addresses; fast opt-outs | Possible with care |
| Canada | Careful | Consent; implied if conspicuously published, no "no solicitation" note, role fit | CASL (up to CAD 10M) | Tag every record with consent basis | Possible with care; strict |
| India | Careful | Cold B2B email allowed today; **DPDP Rules bind from 13 May 2027** (named work email = personal data) | DPDP Act 2023 + Rules 2025; TRAI for calls/SMS | Record each contact's source now, one suppression list, shift Vera India to intros + inbound by spring 2027 | Open until May 2027. Mainly a Vera issue |

## 04 · Stakeholders

The people who lose most if this goes wrong are **Vera's live prospects (Lodha, PRS Legal, clinics)**.

| Stakeholder | Wants | Effect | Mitigation |
|---|---|---|---|
| Three co-founders | Cash sooner, skills, fair split | Two businesses on one calendar; unclear lead-gen owner | Hours, ownership and revenue split in writing this week. One owner per engine |
| Vera's live prospects | Fast, credible follow-through | Slower replies; brand confusion | Vera meetings outrank everything; separate brand; same-day replies on Vera threads |
| Lead-gen clients | Held, qualified meetings; brand safety | You send in their name | Define "qualified" and "held" in contract; send from their lookalike domains, never main; weekly report |
| Prospects emailed | Relevance or silence | Irrelevant email → complaints | Signal-only lists, < 80 words, clear opt-out, suppression list shared across both engines |
| Gmail/Outlook/Yahoo | Authenticated, low-complaint mail | Inbox placement | SPF/DKIM/DMARC everywhere; complaints < 0.1%; bounce < 2% |
| LinkedIn | Human-looking activity | Restricts aggressive automation | Manual first; < 100 invites/week; no browser-extension bots |
| Saleshandy | Plans used within limits | Agency workspaces support this | Plan sized to volume; client association is permanent once a sequence starts |
| Co-founder with dormant domain | Old brand not misused | Old name in from-address | Get his explicit OK; redirect domain to lead-gen site |
| Regulators | Consent where required | Rules differ by country | Country gate at list build; India DPDP from 13 May 2027 |

## 05 · Signals and intent

Signals roughly double replies; treat bigger vendor claims as a ceiling. Why they lift close rates: (1) timing, (2) relevance, (3) deliverability (fewer, fresher contacts), (4) position (before the vendor shortlist). Instantly: **58% of replies come from step one**, so the signal goes in email 1.

Evidence: Instantly 4–8% signal vs 1–3% generic (medium trust); Unify/Quo 2.5x (vendor case); primer claiming 33–41% win rate and 18–28% reply (ceiling only).

**Planning assumption:** reply 2.5% → 5%; positive share 25% → 30%; sales-call close +5 points. Prove it on the first 600 contacts.

### Lead-gen signal library
| Signal | Source | Window | Angle |
|---|---|---|---|
| Company posts SDR/BDR/business-development roles | LinkedIn Jobs, Indeed, career pages via Apify | Act within 3 weeks; drop posts older than ~60 days | "Meetings while you hire, or instead of hiring." |
| Sales role open 75+ days or reposted | Same scrape, compare dates | While open | They can't hire their way out; offer to cover the gap |
| New Head of Sales / VP Sales / Head of Growth | Sales Navigator alerts (upgrade) or LinkedIn job-change search | First 90 days | "Pipeline in your first quarter." |
| Recruiter niche: their target companies hiring in bulk | Job boards grouped by company and role | Weekly | The freebie itself: "12 companies hiring X this week." |
| Weak email setup (no DMARC/SPF) | Free DNS lookup in n8n | Any time | Their outbound likely lands in spam; your audit shows it |
| Recently funded | News, free funding alerts | 0–60 days | Growth targets just got set |

### Vera signal library
| Signal | Source | Window | Angle |
|---|---|---|---|
| New MahaRERA project registration (MMR, Pune) | MahaRERA register; 2,491 new registrations Apr–Oct 2026 | Before ground-breaking | Site reporting and inventory set up right from day one |
| MahaRERA deadline extension approved | MahaRERA; 2,053 extensions Apr–Oct 2026 | Within weeks of approval | Project is late by definition; lead with tracking and reporting |
| Hiring site, planning or QS engineers, storekeepers | Naukri, LinkedIn via Apify | While live | Capacity strain: **cut the 2–3 day site report to under a day** |
| Law firm hiring recovery/DRT associates or paralegals | LinkedIn, Naukri | While live | Volume rising; show the Recovery Desk demo |
| Clinic reviews mentioning phones or booking | Google Maps reviews via Apify | Complaint in last 90 days | A booking front end that answers at 10 pm |
| New clinic registered abroad (e.g. UK CQC) | Public regulator registers | Opening window | Booking set up before patients arrive |

## 06 · Freebies

Cheapest proof inside email 1, next one offered in email 2, expensive ones unasked only to top accounts.

**Lead gen**
| Freebie | Touch | Cost | Why | Watch out |
|---|---|---|---|---|
| Three live signals in the email ("3 firms hiring SDRs in your niche this week") | Email 1 | Minutes, automated | Proves the engine before any ask | Must be real and current |
| Domain health check (SPF/DKIM/DMARC) inline | Email 2 | Free, n8n | Verifiable problem in 30 s | Factual; never shame |
| 25-lead sample sheet to their ICP | Offer in email 2; deliver unasked in email 3 to top accounts | ~30 min/account | Reciprocity; first deliverable of a paid engagement | Cap at 20% of accounts |
| 90-second Loom teardown of their outbound or careers page | Email 3, top 20% only | ~10 min each | Personal; teardowns report 5–7% reply | Thumbnail, not bare link |
| "First 3 held meetings free" / pay only for held meetings | On the call | Your time | Removes risk for a new agency | Define "held" and "qualified" in writing |

**Vera**
| Freebie | Touch | Cost | Why | Watch out |
|---|---|---|---|---|
| 2-hour site-report test: "send one site's photos, get the compiled report back" | Email 2 / after the Lodha intro | ~1 h | **Directly answers the 2–3 days vs under-a-day pain Lodha named** | Agree client data handling |
| RERA delay snapshot from public filings | Email 1 or 2 | ~20 min | Shows you understand their exposure | Public data; neutral tone |
| Recovery Desk demo on one anonymised matter (law firms) | After first reply | ~1 h | They see their own workflow running | No client-identifying data |
| Mock booking page in the clinic's branding + after-hours missed-call log | Email 2 | ~45 min | Makes lost-patient problem visible | UK partnerships need intros |
| Paid pilot priced at cost for 30 days | On the call | Margin | Converts interest into a dated decision | Set success metrics first |

**First-email rules:** under 80 words (situation, value, ask); no attachments, at most one link, no calendar link in touch one; proof in the email; plain text, real founder as sender, clear opt-out. Video/Loom asks 3–5% reply, specific teardowns 5–7% (Salesforge); record only for top 20%, < 90 s, embed a thumbnail.

## 07 · Multichannel outbound

Email + LinkedIn over 14 days. Email alone 3–5% reply in 2026; coordinated email + LinkedIn 7–12%. Never email and message the same day; a reply on any channel stops every other touch.

**Lead gen (UK, IE, US)**
- Day 1 LinkedIn: view profile, connect without a note (notes on invites now get ~2% replies).
- Day 2 Email 1: signal + 3 live examples, < 80 words, no link.
- Day 4 LinkedIn DM if accepted: one line on the same signal.
- Day 6 Email 2: their domain check result inline; offer the 25-lead sample.
- Day 9 LinkedIn: comment on a post or 30-second voice note.
- Day 11 Email 3: deliver the 25-lead sample (top accounts) or a short case.
- Day 14 Email 4: break-up, "should I close the file?"

**Vera (India)**
- Day 1 LinkedIn: connect with founder, MD or project head.
- Day 2 Email 1: their RERA event + the site-report claim, < 80 words.
- Day 4 LinkedIn DM if accepted, references their project.
- Day 6 Email 2: offer the 2-hour site-report test.
- Day 8 Call, only if they replied, accepted or came via intro.
- Day 10 WhatsApp the sample report, only after they engaged.
- Day 14 Email 3: break-up, ask for a referral.

**Safe limits:** email per inbox 5–10 → 15 → 30/day; 4–7 steps; bounce < 2%; complaints < 0.1%; LinkedIn invites < 100/week/account; LinkedIn messages 20–30/day/account; founders' combined invites ~300/week.

**India calls and WhatsApp:** since TRAI's Feb 2025 amendment, promotional calls belong on registered 140-series numbers; five complaints in ten days can bar every number a sender holds for 15 days (a founder's own phone is at risk). In the Vera sequence, call/WhatsApp only people who replied, accepted on LinkedIn, or came through an intro.

## 08 · Funnels (monthly, defaults)

Result: cold signals add ~1 Vera client and 1–2 lead-gen clients a month.

**A · Vera acquisition from cold signals** (alongside warm intros: ask every Lodha and PRS meeting for two introductions)
650 MahaRERA signal events/month (2,491 new + 2,053 extensions over 7 months) → ICP fit 25% → decision-maker reached 70% → replies 8% → positive 45% → discovery calls held 75% → free pilot (2-hour report test) 50% → paid 50% ≈ **0.8 paid clients/month**.

**B · Lead-gen agency winning its own clients** (UK/IE/US recruitment agencies; 2 warmed inboxes first, then 6 new)
900 signal-matched agencies → verified decision-maker 66.7% → replies 6% → positive 35% → calls booked 60% → held 80% → won 25% ≈ **1.5 new clients/month**.

**C · Delivery per lead-gen client** (3 domains, 9 inboxes × 25/day × 22 days ÷ 5 steps ≈ 990 prospects/month)
Signal-sourced: replies 5% → positive 30% → booked 50% → held 80% ≈ **5.9 held meetings/month**. Static list: 2.5% → 25% → 50% → 80% ≈ 2.5.

## 09 · Costs

Lean stack costs lead gen ₹9.7k/month; every upgrade fits under the **₹40k ceiling** except Clay. Shared lines split 50/50.

Launch stack (lead gen's share): Saleshandy Pro monthly $99 (half); Apify Starter $29 (half); MillionVerifier ~5,000 checks ($37 per 10k, quarter); Lead Finder 4,000 credits included; 4 domains (3 sending + 1 website, $14/yr each); 6 new Google Workspace inboxes (₹270 + GST each); 2 warmed inboxes on the dormant domain; n8n, Cal.com, Loom free tiers.

Upgrades, in buying order:
1. Pre-warmed client bench (3 domains, 9 inboxes, ~₹3.2k/mo): first client sends the week they sign.
2. Sales Navigator Core ($119.99/mo): leadership-change and hiring alerts; raises signal-sourced share.
3. Waalaxy Pro (~€39) **or** HeyReach Growth ($79): LinkedIn automation; pick one. (LinkedIn removed HeyReach's company page in March 2026.)
4. Saleshandy Pro annual ($76/mo): saving; only after the 9 Jan gate.
5. Clay Launch ($185/mo): wait until lead gen passes ~₹2L MRR; n8n + Apify covers it for now.

## 10 · Unit economics and scenarios (lead gen, Dec 2026 – Nov 2027)

Model: new clients per month (from Feb), churn, capacity cap. Per-client cost ₹4,189 (own domains, inboxes, data). Capacity = (3 founders × hours/week × 4.33 × lead-gen share − 35 h/month for winning clients) ÷ 25 h per client.

| Scenario | New clients/mo | Revenue/client/mo | Churn | Hrs/founder/wk | Vera share |
|---|---|---|---|---|---|
| Conservative | 0.5 | $450 | 25% | 25 | 60% |
| Base | 1 | $1,100 | 15% | 25 | 60% |
| Upside | 1.5 | $1,600 | 10% | 30 | 50% |

Lead gen covers its costs from the first client; hours, not money, cap it.

## 11 · 90-day plan and gates

Test the offer on the warmed inboxes from 17 Nov; Vera cold sequences start ~1 Dec when its inboxes finish warmup.

**Gates**
- **1 Dec · Deliverability:** bounce < 2%, no blacklist hits, test emails in Primary. Else fix before volume.
- **25 Dec · Offer:** ≥ 1% positive replies on 600+ contacts in one segment. Else change offer or niche once.
- **9 Jan · Go or stop:** 2 paying clients or 8 held sales calls. Else stop lead gen and point the engine at Vera.
- **8 Feb · Scale:** ₹1.5L+ lead-gen MRR and Vera pipeline not starved. Then buy Sales Navigator and LinkedIn automation.

Timeline: Infra (domains, DNS, warmup 11–14 Nov; signal scrapers 17–30 Nov; client bench warming 1–28 Dec). Vera sales (Lodha + PRS follow-ups, ask for intros 16–30 Nov; cold sequences ramping 1 Dec – 8 Feb). Lead gen (offer test on 2 warmed inboxes 17 Nov – 7 Dec; full campaigns 8 Dec – 8 Feb; founding clients delivered 1 Jan – 8 Feb).

Pre-warmed bench: each lead-gen client needs 3 domains + 9 inboxes and 3–4 weeks of warmup. Buy and warm one set (~₹3.2k/mo) in early December.

**Checklist**
- Week of 11 Nov: pick the lead-gen brand name and buy 3 sending + 1 website domain (Infra); SPF/DKIM/DMARC everywhere and start warmup on 6 new inboxes (Infra); dormant domain: blacklist check, re-verify DNS, redirect to the lead-gen site, get the co-founder's OK (Infra); check whether Vera's 3 warming inboxes are on the main domain, and if yes buy 2 secondary domains (Vera); write down hours split, lead-gen ownership and revenue split (All); write the one-line offer and founding-client terms, pay per held meeting (Lead gen).
- Week of 17 Nov: start the offer test, 2 warmed inboxes, 10–15/day each, ~200 UK/IE recruitment agencies (Lead gen); n8n + Apify job-post scraper, MahaRERA watcher, DMARC checker (Infra); post-Diwali Lodha and PRS follow-ups, ask each for two introductions (Vera).
- Week of 24 Nov: one-page site live with offer, process, guarantee, booking link (Lead gen); freebie templates: domain check, 25-lead sample, Loom script (Lead gen); buy Saleshandy Starter (monthly), a workspace per brand (Infra).
- Weeks of 1 and 8 Dec: Vera cold sequences start at 5–10/day per inbox (Vera); weekly deliverability check (Infra); new inboxes go live, move to Saleshandy Pro (Lead gen); buy and warm one client bench (Infra); LinkedIn 15–20 invites/day per founder, each on an assigned engine (All).
- Late Dec to Feb: 25 Dec offer gate, 9 Jan go/stop, 8 Feb scale (All); founding clients onboarded onto the bench, weekly reports (Lead gen); plan for DPDP: source records and one suppression list before May 2027 (Vera).

## 12 · Risks and kill criteria

Two kill triggers end the experiment immediately, however lead gen is doing:
- **Vera loses momentum:** a Vera reply waits > 24 h, or a meeting moves for lead-gen work. Freeze new lead-gen sales for two weeks; if it repeats, stop.
- **Vera domain reputation hit:** Vera emails in spam or a blacklist listing. Stop all cold from that domain; audit what was shared.

Other risks: Apollo-style data failure (bounce > 2% → pause, re-verify, switch source; high); client churn over no-shows (show rate < 70% → contract defines "held", replace no-shows, confirm day before; high); LinkedIn restriction (warnings/captchas → manual only 2 weeks, 10 invites/day; medium); wrong-country sends (DE, CH, NL, BE on an email list → country filter, LinkedIn only; medium); AI SDR price pressure ("we'll do it ourselves" → lead with niche signal feed and pay-for-held-meetings; medium); India DPDP from 13 May 2027 (record sources, one suppression list, move Vera India to intros and inbound; planned).

## 13 · Sources (checked 10 Nov 2026)

Instantly 2026 benchmark; Saleshandy 53M emails; Smartlead State of Cold Email 2026; Boomerang; Visionary Marketing; LeadHaste (Saleshandy plans); Prospeo (appointment-setting pricing, CASL); Cleverly (agency costs, staffing agencies); Modern Inbound (India agencies); Dealfront/Leadfeeder (EU laws, Sep 2026); lemlist (GDPR by country); Australia Spam Act; eChai (DPDP and TRAI); Salesforge (multichannel, soft CTAs, LinkedIn limits); FirstSales (Loom, Outlook rules); Unify; ProductQuant; Tomba; LeadMagic; Free Press Journal (MahaRERA Apr–Oct 2026); HeyReach; Valley (HeyReach pricing, Gmail/Outlook limits); Overloop; Sales Navigator pricing; Landbase (Clay); Apify; MillionVerifier; Google Workspace India pricing; USD–INR rate.
