// Run-wide counters and costs, so every run can report its funnel: how many companies
// survived each step, with which tool, at what cost.
const costs = new Map(); // tool -> { units, usd, unit }
const counts = new Map(); // key -> number

export function addCost(tool, { units = 0, usd = 0, unit = 'call' } = {}) {
  const c = costs.get(tool) || { units: 0, usd: 0, unit };
  c.units += units;
  c.usd += usd;
  costs.set(tool, c);
}

export function count(key, n = 1) {
  counts.set(key, (counts.get(key) || 0) + n);
}

export const getCount = (key) => counts.get(key) || 0;

export function snapshot() {
  return {
    costs: Object.fromEntries([...costs].map(([k, v]) => [k, { ...v, usd: +v.usd.toFixed(4) }])),
    counts: Object.fromEntries(counts),
    total_usd: +[...costs.values()].reduce((s, c) => s + c.usd, 0).toFixed(4),
  };
}
