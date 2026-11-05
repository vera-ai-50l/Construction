import { generateLevel, E_WALL, E_DOOR, hIdx, vIdx } from '../src/core/level.js';
const themes = ['bank', 'museum', 'tech'];
let fails = 0, att = 0, n = 0; const t0 = Date.now();
const stats = { rooms: 0, cams: 0, lasers: 0, panels: 0, loot: 0, guards: 0, furn: 0 };
for (let tier = 1; tier <= 10; tier++) for (const th of themes) for (let s = 0; s < 12; s++) {
  try {
    const L = generateLevel({ seed: 'test' + s + th + tier, theme: th, tier, big: s % 5 === 4, twist: ['none', 'blackout', 'double', 'hardwired', 'eyes'][s % 5] });
    n++; att += L.attempt;
    stats.rooms += L.rooms.length; stats.cams += L.cams.length; stats.lasers += L.lasers.length; stats.panels += L.panels.length; stats.loot += L.loot.length; stats.guards += L.guards.length; stats.furn += L.furn.length;
    // determinism
    const L2 = generateLevel({ seed: 'test' + s + th + tier, theme: th, tier, big: s % 5 === 4, twist: ['none', 'blackout', 'double', 'hardwired', 'eyes'][s % 5] });
    if (JSON.stringify([L.cams, L.loot, L.panels, L.guards.map(g => g.route.length)]) !== JSON.stringify([L2.cams, L2.loot, L2.panels, L2.guards.map(g => g.route.length)])) throw new Error('nondeterministic');
    if (!L.junction.every((j) => j != null)) throw new Error('missing junction');
  } catch (e) { fails++; console.log('FAIL', tier, th, s, e.message); }
}
console.log({ n, fails, avgAttempts: (att / n).toFixed(2), ms: Date.now() - t0 });
for (const k in stats) stats[k] = (stats[k] / n).toFixed(1); console.log('avg per level', stats);

// ASCII map
const L = generateLevel({ seed: 'demo', theme: 'bank', tier: 3 });
const W = L.W, H = L.H, out = [];
for (let y = 0; y <= H; y++) {
  let top = '', mid = '';
  for (let x = 0; x <= W; x++) {
    top += '+';
    if (x < W) { const e = L.eh[hIdx(L, x, y)]; top += e === E_WALL ? '--' : e === E_DOOR ? (L.doors[L.ehD[hIdx(L, x, y)]].kind[0].repeat(2)) : '  '; }
    if (y < H) {
      const e = L.ev[vIdx(L, x, y)]; mid += e === E_WALL ? '|' : e === E_DOOR ? L.doors[L.evD[vIdx(L, x, y)]].kind[0] : ' ';
      if (x < W) {
        const c = y * W + x, r = L.cell[c];
        let ch = r < 0 ? '##' : L.blk[c] ? '[]' : '  ';
        const pn = L.panels.find((p) => p.cx === x && p.cy === y); if (pn) ch = pn.kind.slice(0, 2).toUpperCase();
        if (L.rooms[r] && L.rooms[r].type === 'vault' && ch === '  ') ch = '$$';
        mid += ch;
      }
    }
  }
  out.push(top); if (y < H) out.push(mid);
}
console.log(out.join('\n'));
console.log('rooms', L.rooms.map((r) => `${r.id}:${r.type}/z${r.zone}/d${r.depth}`).join(' '));
console.log('doors', L.doors.map((d) => d.kind + (d.ctrl >= 0 ? d.ctrl : '')).join(' '));
console.log('cams', L.cams.length, 'lasers', L.lasers.map((l) => l.kind).join(','), 'guards', L.guards.length, 'loot', L.loot.map((l) => l.kind + (l.primary ? '*' : '')).join(','), 'par', L.par);
