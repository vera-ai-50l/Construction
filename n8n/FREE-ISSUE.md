# 03 Free-Issue Material Reconciliation

Workflow `veraDemoFreeIss1`, `POST /webhook/vera/free-issue`. Seven Code nodes and Respond to Webhook. All money maths is in code. No AI model is involved.

## Input

Send JSON in the shape below, or build it from CSVs with `buildFreeIssueSample(dir)` in `free-issue-csv.mjs`. That function reads `contract_terms.json` plus the CSVs listed further down.

| key | rows |
|---|---|
| `project`, `deduct_in` | project name; the RA bill the deduction goes into |
| `periods` | `ra, from, to, label` |
| `contractors` | `id, name, package, tower, work_order, free_issue[], wastage_pct{}, recovery_multiplier, issue_rates{}, scrap_recovery_rate` |
| `issues` | `slip, date, contractor, tower, floor, material, qty, unit, issue_rate, acknowledged_by, acknowledged` |
| `returns` | `ref, date, contractor, material, type (return/scrap), qty, unit, weighbridge_ref` |
| `closing_stock` | `ra, contractor, material, qty, unit, counted_on` |
| `measurements` | `ra, mb_ref, contractor, boq_code, item, floor, unit, qty` |
| `boq` | `contractor, boq_code, item, unit, boq_qty, cement_bags_per_unit, steel_mt_per_unit, bbs_ref` |
| `bbs` | `contractor, tower, floor, bbs_ref, steel_mt` |
| `ra_bills` | `ra, contractor, gross, material_recovery, recovery_material, recovery_for_ra, net` |

CSV files: `free_issue_register.csv`, `material_returns.csv`, `closing_stock.csv`, `measurement_book.csv`, `boq_and_norms.csv`, `bbs_summary.csv`, `ra_bills.csv`.

## Rules

- Quantities are kept in whole base units (bags, kg). Money is kept in paise and rounded once per line. Excess is rounded down, in the contractor's favour.
- consumed = opening + issued − returned − closing yard count.
- If a yard count is missing, the periods on either side are merged into one span, marked Medium. If the latest period has no count, the line is marked Check.
- need = certified work × norm. For steel, the BBS for the floor is used where there is one, counted once per floor. Otherwise the norm is used, marked Medium.
- allowed = need × (100 + wastage %) / 100.
- excess recovery = (consumed − allowed) × issue rate × multiplier.
- Scrap check: the cutting loss between need and min(consumed, allowed) should come back as weighed scrap. Any shortfall is charged at the scrap rate. Excess is already charged in full, so it is never counted twice.
- Earlier deductions: an RA-bill recovery tagged `recovery_material` + `recovery_for_ra` is netted off that line. Untagged recoveries are netted at contractor level.
- Confidence:
  - **Check**: an unsigned slip, work certified beyond the BOQ, a data gap, a missing latest count, an over-recovery, or excess scrap.
  - **Medium**: a merged span, or steel from norms.
  - **High**: everything else.

## Output

`headline {recoverable, alreadyRecovered, net, byConfidence, recoverableByConfidence, deductIn}`, `contractors[]`, `lines[]`, `comparison[]`, `floors[]`, `debitNotes[{contractor, name, ref, deductIn, total, text, csv}]`, `checks[]`, `counts`.

`node n8n/vera-demo.mjs check` runs the workflow locally against `n8n/freeissue-sample.json` once that file has been added.
