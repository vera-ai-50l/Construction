// node scripts/hq-check.mjs — asserts on the HQ math (money parsing, plan curve, camp status).
import assert from "node:assert/strict";
import { addDays, doneBy, lakh, parseINR, planAt, seed, summary } from "../components/hqData.ts";

assert.equal(parseINR("2.5L"), 2_50_000);
assert.equal(parseINR("₹45,000"), 45_000);
assert.equal(parseINR("1.2 Cr"), 1_20_00_000);
assert.equal(parseINR("80k"), 80_000);
assert.ok(Number.isNaN(parseINR("abc")));
assert.ok(Number.isNaN(parseINR("5x")));
assert.equal(lakh(50_00_000), "₹50L");
assert.equal(lakh(45_000), "₹0.45L");
assert.equal(addDays("2026-12-31", 1), "2027-01-01");

const d = seed();
d.hedges.forEach((h) => (h.deals = []));
d.hedges[0].deals.push({ id: "a", name: "x", value: 5_00_000, stage: d.hedges[0].stages.length - 1, owner: "Aditya", note: "" });
d.hedges[1].deals.push({ id: "b", name: "y", value: 9_99_999, stage: 0, owner: "Shivam", note: "" });

assert.equal(planAt(d, "2026-11-01"), 0);
assert.equal(planAt(d, "2026-12-31"), 4_00_000);
assert.equal(planAt(d, "2027-06-30"), 50_00_000);
assert.equal(planAt(d, "2030-01-01"), 50_00_000);

const s = summary(d, "2027-01-10");
assert.equal(s.got, 5_00_000);
assert.equal(s.open, 9_99_999);
assert.deepEqual(s.camps.map((c) => c.status), ["cleared", "now", "ahead", "ahead"]);
assert.equal(s.current.name, "Repeat");
assert.equal(s.camps[1].progress, 0.1); // ₹1L into the ₹10L stretch from ₹4L to ₹14L
assert.equal(summary(d, "2027-03-05").camps[1].status, "missed");

d.todos = [
  { id: "1", date: "2026-11-02", who: "Shivam", text: "a", done: true },
  { id: "2", date: "2026-11-02", who: "Shivam", text: "b", done: false },
  { id: "3", date: "2026-10-20", who: "Aditya", text: "c", done: true },
];
assert.deepEqual(doneBy(d.todos, "2026-10-27", "2026-11-02"), { Aditya: 0, Shivam: 1, "Rishi Raj": 0 });

console.log("hq-check: ok");
