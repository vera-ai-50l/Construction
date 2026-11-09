// Team HQ state: plain data + pure helpers. No React here, so the API route, the page and
// scripts/hq-check.mjs (and later the Telegram bot) all share the same math.

export const TEAM = ["Aditya", "Shivam", "Rishi Raj"];

export type Deal = { id: string; name: string; value: number; stage: number; owner: string; note: string; won?: string };
export type Checkpoint = { id: string; title: string; due: string; done: boolean; owner: string };
/** The last stage is always "won": deals there count as banked revenue. */
export type Hedge = { id: string; name: string; tagline: string; stages: string[]; checkpoints: Checkpoint[]; deals: Deal[] };
/** `target` is cumulative revenue banked by `end`. */
export type Phase = { id: string; name: string; end: string; target: number; focus: string };
export type Todo = { id: string; date: string; who: string; text: string; done: boolean };
export type HQData = {
  goal: { title: string; target: number; start: string; deadline: string };
  phases: Phase[];
  hedges: Hedge[];
  todos: Todo[];
};
export type Doc = { rev: number; data: HQData };

export const uid = () => Math.random().toString(36).slice(2, 10);
const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/** YYYY-MM-DD in IST, so the team, the server and the bot agree on what "today" is. */
export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

const UNIT: Record<string, number> = { k: 1e3, l: 1e5, lac: 1e5, lakh: 1e5, lakhs: 1e5, cr: 1e7, crore: 1e7, crores: 1e7 };

/** "2.5L" → 250000, "1.2cr" → 12000000, "80k" → 80000, "₹45,000" → 45000. NaN when it isn't money. */
export function parseINR(s: string) {
  const m = s.replace(/[₹,\s]/g, "").toLowerCase().match(/^(\d*\.?\d+)([a-z]*)$/);
  if (!m || (m[2] && !UNIT[m[2]])) return NaN;
  return Math.round(parseFloat(m[1]) * (UNIT[m[2]] ?? 1));
}

/** ₹4,50,000 → "₹4.5L", ₹50,00,000 → "₹50L". */
export const lakh = (n: number) => `₹${+(n / 1e5).toFixed(2)}L`;

export const isWon = (h: Hedge, d: Deal) => d.stage === h.stages.length - 1;
export const bankedIn = (h: Hedge) => h.deals.reduce((s, d) => s + (isWon(h, d) ? d.value : 0), 0);
export const openIn = (h: Hedge) => h.deals.reduce((s, d) => s + (isWon(h, d) ? 0 : d.value), 0);

const byEnd = (phases: Phase[]) => [...phases].sort((a, b) => a.end.localeCompare(b.end));

/** The plan: a straight climb between camp targets, from ₹0 on the start date. */
export function planAt(data: HQData, iso: string) {
  let from = { end: data.goal.start, target: 0 };
  for (const p of byEnd(data.phases)) {
    if (iso <= p.end) {
      const t = clamp01(daysBetween(from.end, iso) / Math.max(1, daysBetween(from.end, p.end)));
      return from.target + (p.target - from.target) * t;
    }
    from = p;
  }
  return from.target;
}

export type CampStatus = "cleared" | "now" | "missed" | "ahead";

/** Everything the hero and the camp cards show, derived once. */
export function summary(data: HQData, now = today()) {
  const got = data.hedges.reduce((s, h) => s + bankedIn(h), 0);
  const phases = byEnd(data.phases);
  const camps = phases.map((p, i) => {
    const from = i ? phases[i - 1].target : 0;
    const start = i ? addDays(phases[i - 1].end, 1) : data.goal.start;
    const status: CampStatus =
      got >= p.target ? "cleared" : now > p.end ? "missed" : now >= start ? "now" : "ahead";
    return { ...p, from, start, status, progress: clamp01((got - from) / Math.max(1, p.target - from)) };
  });
  const daysLeft = Math.max(0, daysBetween(now, data.goal.deadline));
  const plan = planAt(data, now);
  return {
    got,
    camps,
    daysLeft,
    plan,
    gap: got - plan,
    open: data.hedges.reduce((s, h) => s + openIn(h), 0),
    perMonth: Math.max(0, data.goal.target - got) / Math.max(1, daysLeft / 30.44),
    level: clamp01(got / Math.max(1, data.goal.target)),
    current: camps.find((c) => c.status === "now") ?? camps.find((c) => c.status !== "cleared") ?? camps.at(-1),
  };
}

/** Done tasks per person between two dates, inclusive. */
export function doneBy(todos: Todo[], from: string, to: string) {
  const out: Record<string, number> = Object.fromEntries(TEAM.map((p) => [p, 0]));
  for (const t of todos) if (t.done && t.date >= from && t.date <= to) out[t.who] = (out[t.who] ?? 0) + 1;
  return out;
}

const cp = (title: string, due: string, owner: string): Checkpoint => ({ id: uid(), title, due, owner, done: false });
const deal = (name: string, value: number, stage: number, owner: string, note = "", won?: string): Deal => ({
  id: uid(), name, value, stage, owner, note, won,
});

/** First-run data. Deals marked "Sample" are placeholders: delete them once the real pipeline is in. */
export function seed(): HQData {
  const t = today();
  return {
    goal: { title: "₹50L revenue", target: 50_00_000, start: "2026-11-01", deadline: "2027-06-30" },
    phases: [
      { id: uid(), name: "Proof", end: "2026-12-31", target: 4_00_000, focus: "3 paying clients across both hedges. Two case studies with real rupee numbers." },
      { id: uid(), name: "Repeat", end: "2027-02-28", target: 14_00_000, focus: "One offer per hedge that closes on its own. A channel that books 10 calls a month." },
      { id: uid(), name: "Scale", end: "2027-04-30", target: 30_00_000, focus: "Retainers over one-offs. Delivery runs without a founder on every call." },
      { id: uid(), name: "Summit", end: "2027-06-30", target: 50_00_000, focus: "Annual contracts and upsells. Close the gap, no new experiments." },
    ],
    hedges: [
      {
        id: "leadgen",
        name: "Lead Gen",
        tagline: "Booked calls for one niche · domain TBD",
        stages: ["Lead", "Audit sent", "Call booked", "Proposal", "Won"],
        checkpoints: [
          cp("Pick the niche and the offer", "2026-11-15", "Aditya"),
          cp("Outbound list of 500 + first campaign live", "2026-11-30", "Shivam"),
          cp("First paid pilot: 20 booked calls", "2026-12-31", "Rishi Raj"),
          cp("Case study: cost per booked call", "2027-02-15", "Aditya"),
          cp("3 clients on monthly retainer", "2027-03-15", "Shivam"),
        ],
        deals: [
          deal("Sample · Pilot client A", 45_000, 4, "Aditya", "Pilot paid", "2026-11-01"),
          deal("Sample · Retainer prospect B", 1_80_000, 3, "Shivam", "Wants 40 calls a month"),
          deal("Sample · Prospect C", 1_20_000, 2, "Aditya"),
          deal("Sample · Prospect D", 90_000, 1, "Rishi Raj"),
          deal("Sample · Prospect E", 60_000, 0, "Shivam"),
        ],
      },
      {
        id: "vera",
        name: "Vera",
        tagline: "The true record of every construction site",
        stages: ["Lead", "Leak check booked", "Leak check done", "Proposal", "Won"],
        checkpoints: [
          cp("3 free Material Leak Checks done", "2026-11-30", "Rishi Raj"),
          cp("First paid Site Record Desk", "2026-12-31", "Shivam"),
          cp("₹1 Cr of leaks found across clients", "2027-02-28", "Aditya"),
          cp("5 contractors on the Growth plan", "2027-04-30", "Shivam"),
        ],
        deals: [
          deal("Sample · Pune contractor, ₹120 Cr/yr", 2_40_000, 2, "Rishi Raj", "Leak check found ₹38L"),
          deal("Sample · Nagpur road EPC", 3_00_000, 1, "Shivam"),
          deal("Sample · Indore builder", 1_50_000, 0, "Aditya"),
        ],
      },
    ],
    todos: [
      { id: uid(), date: t, who: "Aditya", text: "Swap the sample deals for the real pipeline", done: false },
      { id: uid(), date: t, who: "Shivam", text: "Shortlist 3 niches for Lead Gen", done: false },
      { id: uid(), date: t, who: "Rishi Raj", text: "Log today's calls here", done: false },
    ],
  };
}
