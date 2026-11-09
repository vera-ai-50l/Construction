// Expected results for each workflow on its sample file. `node n8n/vera-demo.mjs check`
// fails if the logic drifts. 01 and 02 use the figures from the original demo
// (display rounding, as the page shows them). 03 is filled in once its sample data is added.

const lakh = (n) => Math.round(n / 10000) / 10 // ₹ -> lakh, one decimal
const crore = (n) => Math.round(n / 100000) / 100 // ₹ -> crore, two decimals
const t = (label, ok, got) => [label, !!ok, got]

export const expectations = {
  veraDemoLeakChk1: (o) => [
    t('₹16.1 L leaking', lakh(o.total) === 16.1, lakh(o.total)),
    t('₹7.5 L recoverable', lakh(o.recoverable) === 7.5, lakh(o.recoverable)),
    t('₹8.6 L stoppable', lakh(o.stoppable) === 8.6, lakh(o.stoppable)),
    t('6.3% of bought', o.pct === 6.3, o.pct),
    t('₹2.57 Cr bought', crore(o.bought) === 2.57, crore(o.bought)),
    t('duplicates ₹4.9 L', lakh(o.supplier.find((g) => g.kind === 'duplicate')?.amount || 0) === 4.9, o.supplier.map((g) => [g.kind, g.amount])),
    t('short supply ₹2.2 L', lakh(o.supplier.find((g) => g.kind === 'short')?.amount || 0) === 2.2, o.supplier.map((g) => [g.kind, g.amount])),
    t('above-PO rate ₹48k', Math.round((o.supplier.find((g) => g.kind === 'rate')?.amount || 0) / 1000) === 48, o.supplier.map((g) => [g.kind, g.amount])),
  ],
  veraDemoSiteDsk1: (o) => [
    t('13/15 messages understood', o.stats.understood === 13 && o.stats.messages === 15, o.stats),
    t('3/4 sites reported', o.stats.reported === 3 && o.stats.sites === 4, o.stats),
    t('102 people', o.stats.labour === 102, o.stats.labour),
    t('₹63.8 L at risk', lakh(o.riskTotal) === 63.8, o.riskTotal),
    t('brief and Tally CSV present', o.brief.length > 0 && o.tally.startsWith('Date,'), null),
  ],
  // Filled in when freeissue-sample.json arrives: headline net, split by confidence,
  // the already-recovered amount, and one line per planted anomaly.
  veraDemoFreeIss1: (o) => [
    t('returns headline and lines', o.headline && Array.isArray(o.lines), Object.keys(o)),
    t('net = recoverable − already recovered', Math.round((o.headline.recoverable - o.headline.alreadyRecovered) * 100) === Math.round(o.headline.net * 100), o.headline),
    t('confidence split adds up to net', Math.round(Object.values(o.headline.byConfidence).reduce((a, b) => a + b, 0) * 100) === Math.round(o.headline.net * 100) + Math.round(o.contractors.reduce((a, c) => a + c.unallocatedRecovered, 0) * 100), o.headline),
  ],
  // IPC Compliance Kit on lib/ipc-sample.json (6 fictional homes, October 2026).
  veraHealthIpcKit1: (o) => [
    t('23 of 24 audits returned, Hollyfield environment missing', o.stats.returns === 23 && o.missing.length === 1 && o.missing[0].home === 'HF', o.missing),
    t('21 actions, 5 red', o.actions.length === 21 && o.actions.filter((a) => a.rag === 'red').length === 5, o.actions.length),
    t('Millbrook commodes red at 66.7%', o.scores.find((s) => s.home === 'MB' && s.type === 'commode')?.pct === 66.7, o.scores.filter((s) => s.home === 'MB')),
    t('one outbreak: Rosewood, 3 cases in 32 h', o.outbreaks.length === 1 && o.outbreaks[0].home === 'RW' && o.outbreaks[0].cases === 3 && o.outbreaks[0].spanH === 32, o.outbreaks),
    t('Elm Court cases 5 days apart are not an outbreak', !o.outbreaks.some((x) => x.home === 'EC'), o.watch),
    t('32 staff to chase for training', o.chase.length === 32, o.chase.length),
    t('37.21 h a month back for the homes', o.value.month.homeSaved === 37.21, o.value.month),
    t('10.5 h a month back for the adviser', o.value.month.adviserSaved === 10.5, o.value.month),
    t('£2,107.61 a month, £25,291 a year', o.value.month.pounds === 2107.61 && o.value.year.pounds === 25291, o.value.year),
  ],
}
