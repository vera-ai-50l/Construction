// Endless meta: crew save, job board, daily contract, payouts, upgrades.
import { RNG, hashStr } from './rng.js';
import { THEMES, TWISTS, UPGRADES, upgradeCost, RATINGS, NOTORIETY, LOOT } from './data.js';

export function newCrew(code) {
  return {
    v: 1, code, rev: 0, wallet: 0, up: {}, jobs: 0, wins: 0, busts: 0, streak: 0, total: 0,
    best: { haul: 0, streak: 0, time: 0 }, lastRoles: null, dailyDone: {}, history: [],
  };
}

export function tierOf(crew) { return Math.min(10, 1 + Math.floor(crew.wins / 2)); }
export function notoriety(crew) { return NOTORIETY[tierOf(crew) - 1]; }

const THEME_IDS = ['bank', 'museum', 'tech'];
const TWIST_IDS = Object.keys(TWISTS).filter((t) => t !== 'none');

export function makeBoard(crew) {
  const rng = new RNG(hashStr(crew.code + ':' + crew.jobs));
  const tier = tierOf(crew);
  const nextIsBig = (crew.jobs + 1) % 5 === 0;
  const themes = rng.shuffle(THEME_IDS.slice());
  const out = [];
  for (let i = 0; i < 3; i++) {
    const theme = themes[i];
    const big = nextIsBig && i === 0;
    let twist = 'none';
    if (crew.jobs >= 2 && (i > 0 || big) && rng.chance(0.75)) twist = rng.pick(TWIST_IDS);
    if (crew.jobs < 2) twist = 'none';
    const t = Math.max(1, Math.min(10, tier + (big ? 1 : 0) + (i === 2 && crew.jobs >= 2 ? 1 : 0)));
    out.push(contract({ seed: crew.code + '-' + crew.jobs + '-' + i, theme, tier: t, twist, big, rng }));
  }
  return out;
}

export function todayStr(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function dailyContract(date = todayStr()) {
  const rng = new RNG(hashStr('daily:' + date));
  const theme = rng.pick(THEME_IDS), twist = rng.pick(TWIST_IDS);
  const c = contract({ seed: 'daily-' + date, theme, tier: 4, twist, big: false, rng });
  c.daily = date; c.name = 'Daily: ' + c.name;
  return c;
}

function contract({ seed, theme, tier, twist, big, rng }) {
  const th = THEMES[theme];
  const target = rng.pick(th.target);
  const est = Math.round((LOOT[target].value * 2.5 + 30000 + tier * 9000) * (big ? 1.6 : 1) * TWISTS[twist].pay / 1000) * 1000;
  return { id: seed, seed, theme, tier, twist, big, target, name: (big ? 'BIG SCORE: ' : '') + rng.pick(th.names), est };
}

export function upgradeList(crew) {
  return UPGRADES.map((u) => {
    const lvl = crew.up[u.id] | 0;
    return { ...u, lvl, cost: lvl >= u.max ? null : upgradeCost(u, lvl) };
  });
}

export function buyUpgrade(crew, id) {
  const u = UPGRADES.find((x) => x.id === id); if (!u) return false;
  const lvl = crew.up[id] | 0; if (lvl >= u.max) return false;
  const cost = upgradeCost(u, lvl); if (crew.wallet < cost) return false;
  crew.wallet -= cost; crew.up[id] = lvl + 1; crew.rev++;
  return true;
}

// roles: {runner: name, hacker: name}
export function payout(crew, c, sum, roles) {
  const lines = [];
  const base = Math.round(sum.secured * TWISTS[c.twist].pay * (c.big ? 1.35 : 1));
  lines.push({ label: 'Secured loot', amt: sum.secured });
  if (base !== sum.secured) lines.push({ label: (c.big ? 'Big Score' : TWISTS[c.twist].name) + ' bonus', amt: base - sum.secured });
  let pct = 0;
  const ratings = [];
  if (sum.result === 'won') {
    for (const k of ['ghost', 'clean', 'fast', 'full']) if (sum[k]) { ratings.push(k); pct += RATINGS[k].bonus; }
    const sw = crew.lastRoles && crew.lastRoles.runner && roles.runner && crew.lastRoles.runner !== roles.runner;
    if (sw) { ratings.push('switch'); pct += 0.1; }
    const st = Math.min(0.5, 0.05 * crew.streak);
    if (st > 0) lines.push({ label: 'Streak x' + crew.streak, amt: Math.round(base * st) });
  }
  for (const k of ratings) lines.push({ label: k === 'switch' ? 'Switch-Up (swapped roles)' : RATINGS[k].name + ' - ' + RATINGS[k].desc, amt: Math.round(base * (k === 'switch' ? 0.1 : RATINGS[k].bonus)) });
  let total = lines.reduce((s, l) => s + l.amt, 0);
  if (sum.result === 'bust') {
    const fee = Math.round(total * (0.3 - 0.1 * (crew.up.lawyer | 0)));
    lines.push({ label: 'Lawyer & bail', amt: -fee });
    total -= fee;
  }
  return { lines, total: Math.max(0, total), ratings };
}

export function applyResult(crew, c, sum, pay, roles) {
  crew.jobs++; crew.rev++;
  crew.wallet += pay.total; crew.total += pay.total;
  if (sum.result === 'won') { crew.wins++; crew.streak++; }
  else if (sum.result === 'bust') { crew.busts++; crew.streak = (crew.up.lawyer | 0) > 0 ? Math.floor(crew.streak / 2) : 0; }
  crew.best.haul = Math.max(crew.best.haul, pay.total);
  crew.best.streak = Math.max(crew.best.streak, crew.streak);
  if (sum.result === 'won' && (!crew.best.time || sum.time < crew.best.time)) crew.best.time = Math.round(sum.time);
  if (c.daily) crew.dailyDone[c.daily] = Math.max(crew.dailyDone[c.daily] || 0, pay.total);
  crew.lastRoles = roles;
  crew.history.unshift({ name: c.name, result: sum.result, pay: pay.total, time: Math.round(sum.time), ratings: pay.ratings, at: Date.now() });
  trimCrew(crew);
}

// The crew save rides in each player's room presence (4 KiB in all), so keep
// it bounded: the last 8 jobs, and only the most recent daily contracts.
export function trimCrew(crew) {
  if (crew.history.length > 8) crew.history = crew.history.slice(0, 8);
  const days = Object.keys(crew.dailyDone).sort();
  if (days.length > 3) for (const d of days.slice(0, days.length - 3)) delete crew.dailyDone[d];
  return crew;
}
