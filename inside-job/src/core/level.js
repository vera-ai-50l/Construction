// Deterministic procedural level generator.
// Grid of cells (T metres). Walls live on cell EDGES (thin walls), so the
// blueprint reads like a real floor plan. Both players run this with the same
// seed and get an identical building; only integer/IEEE-exact math drives
// any decision (no trig), so Windows Chrome and Mac Safari agree.
import { RNG } from './rng.js';
import { T, THEMES, ROOMS, FURN, LOOT } from './data.js';

export const E_OPEN = 0, E_WALL = 1, E_DOOR = 2;
const YH = 4; // yard depth in cells

export function generateLevel(c) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const rng = new RNG(String(c.seed) + '#' + attempt);
    const L = tryGen(rng, c);
    if (L) { L.attempt = attempt; return L; }
  }
  throw new Error('level generation failed for seed ' + c.seed);
}

// ---------- grid helpers (also used by sim/render) ----------
export function hIdx(L, x, y) { return y * L.W + x; }          // edge on top of cell (x,y)
export function vIdx(L, x, y) { return y * (L.W + 1) + x; }    // edge left of cell (x,y)
// edge crossed when stepping from cell (x,y) in dir d (0 N,1 E,2 S,3 W)
export function edgeOf(L, x, y, d) {
  if (d === 0) return { h: 1, i: hIdx(L, x, y) };
  if (d === 2) return { h: 1, i: hIdx(L, x, y + 1) };
  if (d === 3) return { h: 0, i: vIdx(L, x, y) };
  return { h: 0, i: vIdx(L, x + 1, y) };
}
export const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
export function edgeVal(L, e) { return e.h ? L.eh[e.i] : L.ev[e.i]; }
export function edgeDoor(L, e) { return e.h ? L.ehD[e.i] : L.evD[e.i]; }
export function cellAt(L, wx, wz) {
  const x = Math.floor(wx / T), y = Math.floor(wz / T);
  if (x < 0 || y < 0 || x >= L.W || y >= L.H) return -1;
  return y * L.W + x;
}
export function roomAt(L, wx, wz) { const c = cellAt(L, wx, wz); return c < 0 ? -1 : L.cell[c]; }

// Neighbour step allowed for navigation. doorOk(door) decides doors.
export function canStep(L, x, y, d, doorOk) {
  const nx = x + DX[d], ny = y + DY[d];
  if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) return false;
  if (L.cell[ny * L.W + nx] < 0) return false;
  const e = edgeOf(L, x, y, d);
  const v = edgeVal(L, e);
  if (v === E_WALL) return false;
  if (v === E_DOOR) return doorOk ? doorOk(L.doors[edgeDoor(L, e)]) : true;
  return true;
}

// A* on cells (4-neighbour). Returns array of cell indices or null.
export function astar(L, from, to, doorOk, blocked) {
  const W = L.W, N = W * L.H;
  if (from === to) return [from];
  const g = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const open = [from]; g[from] = 0;
  const tx = to % W, ty = (to / W) | 0;
  const hfun = (c) => Math.abs((c % W) - tx) + Math.abs(((c / W) | 0) - ty);
  const f = new Float32Array(N).fill(1e9); f[from] = hfun(from);
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (cur === to) { const path = [cur]; let c = cur; while (came[c] >= 0) { c = came[c]; path.push(c); } return path.reverse(); }
    if (closed[cur]) continue; closed[cur] = 1;
    const x = cur % W, y = (cur / W) | 0;
    for (let d = 0; d < 4; d++) {
      if (!canStep(L, x, y, d, doorOk)) continue;
      const n = (y + DY[d]) * W + x + DX[d];
      if (closed[n] || (blocked && blocked[n] && n !== to)) continue;
      const ng = g[cur] + 1;
      if (ng < g[n]) { g[n] = ng; came[n] = cur; f[n] = ng + hfun(n); open.push(n); }
    }
  }
  return null;
}

export function cellCenter(L, c) { return { x: ((c % L.W) + 0.5) * T, z: (((c / L.W) | 0) + 0.5) * T }; }

// ---------- generation ----------
function bsp(rng, x, y, w, h, depth, out) {
  if (depth < 2) {
    const canV = w >= 13, canH = h >= 13;
    if (canV || canH) {
      const vert = canV && (!canH || w >= h);
      if (vert) {
        const s = x + rng.int(5, w - 7);
        out.push({ x: s, y, w: 2, h, corr: true });
        bsp(rng, x, y, s - x, h, depth + 1, out);
        bsp(rng, s + 2, y, x + w - s - 2, h, depth + 1, out);
      } else {
        const s = y + rng.int(5, h - 7);
        out.push({ x, y: s, w, h: 2, corr: true });
        bsp(rng, x, y, w, s - y, depth + 1, out);
        bsp(rng, x, s + 2, w, y + h - s - 2, depth + 1, out);
      }
      return;
    }
  }
  const area = w * h;
  const splitV = w > 7, splitH = h > 7;
  const optional = !splitV && !splitH && area > 30 && Math.max(w, h) >= 6 && rng.chance(0.4);
  if (splitV || splitH || optional) {
    let vert;
    if (splitV && splitH) vert = w >= h; else if (splitV) vert = true; else if (splitH) vert = false; else vert = w >= h;
    if (vert && w >= 6) { const s = x + rng.int(3, w - 3); bsp(rng, x, y, s - x, h, 9, out); bsp(rng, s, y, x + w - s, h, 9, out); return; }
    if (!vert && h >= 6) { const s = y + rng.int(3, h - 3); bsp(rng, x, y, w, s - y, 9, out); bsp(rng, x, s, w, y + h - s, 9, out); return; }
  }
  out.push({ x, y, w, h, corr: false });
}

function tryGen(rng, c) {
  const tier = Math.max(1, c.tier | 0), big = !!c.big, twist = c.twist || 'none';
  const themeId = THEMES[c.theme] ? c.theme : 'bank';
  const theme = THEMES[themeId];
  const W = Math.min(48, 26 + tier * 2 + (big ? 8 : 0));
  const BH = Math.min(30, 16 + tier + (big ? 5 : 0));
  const H = BH + YH + 2;
  const L = {
    seed: String(c.seed), W, H, T, theme: themeId, tier, big, twist,
    rooms: [], doors: [], cams: [], lasers: [], panels: [], furn: [], loot: [], guards: [],
  };
  const cell = (L.cell = new Int16Array(W * H).fill(-1));
  L.rooms.push({ id: 0, x: 1, y: 1 + BH, w: W - 2, h: YH, type: 'yard', corr: false, zone: -1, depth: -1 });
  const rects = [];
  bsp(rng, 1, 1, W - 2, BH, 0, rects);
  for (const r of rects) { r.id = L.rooms.length; L.rooms.push(r); }
  for (const r of L.rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cell[y * W + x] = r.id;
  const N = L.rooms.length;
  if (N < 8) return null;

  // edges
  const eh = (L.eh = new Uint8Array(W * (H + 1))), ev = (L.ev = new Uint8Array((W + 1) * H));
  L.ehD = new Int16Array(W * (H + 1)).fill(-1); L.evD = new Int16Array((W + 1) * H).fill(-1);
  const conns = new Map();
  const addConn = (a, b, e) => {
    const k = a < b ? a * 1000 + b : b * 1000 + a;
    let cn = conns.get(k);
    if (!cn) { cn = { a: Math.min(a, b), b: Math.max(a, b), edges: [], k }; conns.set(k, cn); }
    cn.edges.push(e);
  };
  for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) {
    const a = y > 0 ? cell[(y - 1) * W + x] : -1, b = y < H ? cell[y * W + x] : -1;
    const i = y * W + x;
    eh[i] = a === b ? E_OPEN : E_WALL;
    if (a >= 0 && b >= 0 && a !== b) addConn(a, b, { h: 1, i, x, y });
  }
  for (let y = 0; y < H; y++) for (let x = 0; x <= W; x++) {
    const a = x > 0 ? cell[y * W + x - 1] : -1, b = x < W ? cell[y * W + x] : -1;
    const i = y * (W + 1) + x;
    ev[i] = a === b ? E_OPEN : E_WALL;
    if (a >= 0 && b >= 0 && a !== b) addConn(a, b, { h: 0, i, x, y });
  }
  const connList = [...conns.values()].sort((p, q) => p.k - q.k);
  const R = L.rooms;
  const area = (r) => r.w * r.h;

  // entrance room: corridor touching the yard if possible
  const yardConns = connList.filter((cn) => cn.a === 0);
  if (!yardConns.length) return null;
  let entryConn = null;
  const corrY = yardConns.filter((cn) => R[cn.b].corr);
  if (corrY.length) entryConn = corrY[rng.int(0, corrY.length - 1)];
  else { yardConns.sort((p, q) => area(R[q.b]) - area(R[p.b]) || p.k - q.k); entryConn = yardConns[0]; }
  const entry = entryConn.b;
  L.entryRoom = entry;

  // spanning tree (randomised Prim, corridors preferred)
  const inner = connList.filter((cn) => cn.a !== 0);
  for (const cn of inner) {
    const ca = R[cn.a].corr, cb = R[cn.b].corr;
    cn.w = (ca && cb ? 0 : ca || cb ? 1 : 2.2) + rng.next() * 0.9;
  }
  const inT = new Uint8Array(N); inT[entry] = 1; inT[0] = 1;
  const treeSet = new Set();
  const adjT = Array.from({ length: N }, () => []);
  for (let added = 1; added < N - 1; added++) {
    let best = null;
    for (const cn of inner) if (inT[cn.a] !== inT[cn.b] && (!best || cn.w < best.w)) best = cn;
    if (!best) return null;
    inT[best.a] = inT[best.b] = 1; treeSet.add(best.k);
    adjT[best.a].push(best.b); adjT[best.b].push(best.a);
  }
  // depth on tree
  for (const r of R) r.depth = -1;
  R[entry].depth = 0;
  const q = [entry];
  while (q.length) { const a = q.shift(); for (const b of adjT[a]) if (R[b].depth < 0) { R[b].depth = R[a].depth + 1; q.push(b); } }
  R[0].depth = -1;

  // vault: deepest non-corridor leaf
  let vault = -1;
  for (const r of R) {
    if (r.id === 0 || r.corr || r.id === entry || adjT[r.id].length !== 1 || r.w < 3 || r.h < 3 || area(r) < 12) continue;
    if (vault < 0 || r.depth > R[vault].depth || (r.depth === R[vault].depth && area(r) > area(R[vault]))) vault = r.id;
  }
  if (vault < 0 || R[vault].depth < 3) return null;
  L.vaultRoom = vault;

  // zones by rank of depth
  const Z = big || tier >= 3 ? 3 : 2;
  L.zones = Z;
  const order = R.filter((r) => r.id !== 0).sort((p, q2) => p.depth - q2.depth || p.id - q2.id);
  order.forEach((r, i) => { r.zone = Math.floor((i * Z) / order.length); });
  R[vault].zone = Z - 1;
  for (let z = 0; z < Z; z++) if (!R.some((r) => r.zone === z && r.id !== vault && r.id !== 0)) return null;

  // loops
  const loopsWanted = 1 + Math.floor(N / 6);
  const cand = rng.shuffle(inner.filter((cn) => !treeSet.has(cn.k) && cn.a !== vault && cn.b !== vault && !(R[cn.a].corr && R[cn.b].corr)));
  const loopSet = new Set();
  for (const cn of cand) {
    if (loopSet.size >= loopsWanted) break;
    if (R[cn.a].zone !== R[cn.b].zone && !rng.chance(0.3)) continue;
    loopSet.add(cn.k);
  }

  // doors
  const sortEdges = (es) => es.slice().sort((p, q2) => (p.h - q2.h) || (p.y - q2.y) || (p.x - q2.x));
  const mkDoor = (kind, a, b, edges) => {
    const d = { id: L.doors.length, kind, a, b, edges, ctrl: -1 };
    let sx = 0, sz = 0;
    for (const e of edges) {
      if (e.h) { eh[e.i] = E_DOOR; L.ehD[e.i] = d.id; sx += (e.x + 0.5) * T; sz += e.y * T; }
      else { ev[e.i] = E_DOOR; L.evD[e.i] = d.id; sx += e.x * T; sz += (e.y + 0.5) * T; }
    }
    d.x = sx / edges.length; d.z = sz / edges.length;
    d.horiz = !!edges[0].h; // door lies along X (normal along Z)
    d.width = edges.length * T;
    L.doors.push(d);
    return d;
  };
  const chooseEdge = (cn) => {
    const es = sortEdges(cn.edges);
    // edges in a single straight run; skip ends
    const i = es.length >= 3 ? rng.int(1, es.length - 2) : rng.int(0, es.length - 1);
    return [es[i]];
  };
  mkDoor('entry', 0, entry, chooseEdge(entryConn));
  for (const cn of inner) {
    const inTree = treeSet.has(cn.k), isLoop = loopSet.has(cn.k);
    const bothCorr = R[cn.a].corr && R[cn.b].corr;
    if (!inTree && !isLoop && !bothCorr) continue;
    const za = R[cn.a].zone, zb = R[cn.b].zone;
    if (bothCorr) {
      let es = sortEdges(cn.edges);
      if (es.length > 3) { const m = (es.length >> 1) - 1; es = es.slice(m, m + 2); }
      if (za === zb) { for (const e of cn.edges) if (es.includes(e)) { if (e.h) eh[e.i] = E_OPEN; else ev[e.i] = E_OPEN; } continue; }
      const d = mkDoor('edoor', cn.a, cn.b, es); d.ctrl = Math.max(za, zb) - 1; continue;
    }
    if (cn.a === vault || cn.b === vault) { const d = mkDoor('vault', cn.a, cn.b, chooseEdge(cn)); d.ctrl = Z - 1; L.vaultDoor = d.id; continue; }
    if (za !== zb) { const d = mkDoor('edoor', cn.a, cn.b, chooseEdge(cn)); d.ctrl = Math.max(za, zb) - 1; continue; }
    mkDoor('swing', cn.a, cn.b, chooseEdge(cn));
  }
  for (const d of L.doors) d.tree = d.kind === 'entry' || treeSet.has(d.a < d.b ? d.a * 1000 + d.b : d.b * 1000 + d.a);
  if (L.vaultDoor == null) return null;

  // room types
  const vr = R[vault];
  vr.type = 'vault';
  for (const r of R) if (r.corr) r.type = 'corridor';
  if (!R[entry].corr) R[entry].type = theme.entry;
  const free = R.filter((r) => !r.type);
  const secC = free.filter((r) => area(r) >= 9 && area(r) <= 30 && r.zone <= 1);
  if (secC.length) rng.pick(secC).type = 'security';
  for (const r of R) {
    if (r.type) continue;
    const a = area(r);
    r.type = a >= 30 ? rng.pick(theme.big) : a >= 15 ? rng.pick(theme.mid) : rng.pick(theme.small);
  }
  for (const r of R) r.label = r.type === 'vault' ? theme.vaultLabel : (ROOMS[r.type] && ROOMS[r.type].label) || '';

  // reserved cells (keep doorways clear) and blocked cells (furniture)
  const rsv = (L.rsv = new Uint8Array(W * H));
  const blk = (L.blk = new Uint8Array(W * H));
  for (const d of L.doors) for (const e of d.edges) {
    const cs = e.h ? [[e.x, e.y - 1, 0], [e.x, e.y, 2]] : [[e.x - 1, e.y, 3], [e.x, e.y, 1]];
    for (const [x, y, away] of cs) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      rsv[y * W + x] = 1;
      const x2 = x + DX[away], y2 = y + DY[away];
      if (x2 >= 0 && y2 >= 0 && x2 < W && y2 < H && cell[y2 * W + x2] === cell[y * W + x]) rsv[y2 * W + x2] = 1;
    }
  }

  // ---------- wall slots for panels / paintings ----------
  const usedSlot = new Set();
  const isDoorEdge = (e) => edgeVal(L, e) === E_DOOR;
  const wallSlots = (r, allowRsv) => {
    const out = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const ci = y * W + x;
      if (!allowRsv && rsv[ci]) continue;
      if (blk[ci]) continue;
      for (let s = 0; s < 4; s++) {
        const e = edgeOf(L, x, y, s);
        if (edgeVal(L, e) !== E_WALL) continue;
        // other side must not be another cell of this room
        const ox = x + DX[s], oy = y + DY[s];
        if (ox >= 0 && oy >= 0 && ox < W && oy < H && cell[oy * W + ox] === r.id) continue;
        // neighbouring edges along the wall should not be doors
        const along = s === 0 || s === 2 ? [1, 3] : [0, 2];
        let near = false;
        for (const a of along) {
          const nx = x + DX[a], ny = y + DY[a];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (isDoorEdge(edgeOf(L, nx, ny, s))) near = true;
        }
        if (near) continue;
        const key = ci * 4 + s;
        if (usedSlot.has(key)) continue;
        out.push({ x, y, s, key });
      }
    }
    return out;
  };
  const NRM = [[0, 1], [-1, 0], [0, -1], [1, 0]]; // inward normal for wall on side s
  const slotWorld = (sl, inset = 0.06) => {
    const cx = (sl.x + 0.5) * T, cz = (sl.y + 0.5) * T;
    const [nx, nz] = NRM[sl.s];
    return { x: cx - nx * (T / 2 - inset), z: cz - nz * (T / 2 - inset), nx, nz };
  };
  const addPanel = (kind, r, sl, extra) => {
    usedSlot.add(sl.key);
    rsv[sl.y * W + sl.x] = 1;
    const p = slotWorld(sl, 0.07);
    const pn = Object.assign({ id: L.panels.length, kind, room: r.id, zone: r.zone, cx: sl.x, cy: sl.y, side: sl.s, x: p.x, y: 1.35, z: p.z, nx: p.nx, nz: p.nz }, extra || {});
    L.panels.push(pn);
    return pn;
  };
  const nearestSlot = (r, wx, wz, k) => {
    const sl = wallSlots(r, false);
    if (!sl.length) return null;
    sl.sort((p, q2) => {
      const a = slotWorld(p), b = slotWorld(q2);
      return ((a.x - wx) ** 2 + (a.z - wz) ** 2) - ((b.x - wx) ** 2 + (b.z - wz) ** 2) || p.key - q2.key;
    });
    return sl[rng.int(0, Math.min(k, sl.length) - 1)];
  };

  // ---------- lasers ----------
  // hardwired lasers across doorways into valuable rooms; keypad on the near side
  const valuable = new Set(['exec', 'gallery', 'lab', 'server', 'records', 'teller', 'hall', 'restoration']);
  let nHard = (tier >= 2 ? 1 + Math.floor(tier / 3) : 0) + (twist === 'hardwired' ? 2 : 0) + (big ? 1 : 0);
  const hardC = rng.shuffle(L.doors.filter((d) => d.kind === 'swing' && d.tree));
  for (const d of hardC) {
    if (nHard <= 0) break;
    const [near, far] = R[d.a].depth <= R[d.b].depth ? [R[d.a], R[d.b]] : [R[d.b], R[d.a]];
    if (!valuable.has(far.type) || far.corr) continue;
    const sl = nearestSlot(near, d.x, d.z, 3);
    if (!sl) continue;
    // laser plane 0.35 m inside the far room
    const e = d.edges[0];
    let x1, z1, x2, z2;
    if (e.h) { const sgn = far.y >= e.y ? 1 : -1; z1 = z2 = e.y * T + sgn * 0.35; x1 = e.x * T + 0.08; x2 = (e.x + 1) * T - 0.08; }
    else { const sgn = far.x >= e.x ? 1 : -1; x1 = x2 = e.x * T + sgn * 0.35; z1 = e.y * T + 0.08; z2 = (e.y + 1) * T - 0.08; }
    const lz = { id: L.lasers.length, kind: 'hard', room: far.id, zone: far.zone, door: d.id, x1, z1, x2, z2, net: false };
    L.lasers.push(lz);
    const pn = addPanel('keypad', near, sl, { laser: lz.id, len: 4 });
    lz.panel = pn.id;
    nHard--;
  }
  // pulse lasers across corridors
  let nPulse = Math.min(4, 1 + Math.floor(tier / 2) + (big ? 1 : 0));
  const corrs = rng.shuffle(R.filter((r) => r.corr && r.depth >= 0));
  for (const r of corrs) {
    if (nPulse <= 0) break;
    const vertical = r.h > r.w;
    const len = vertical ? r.h : r.w;
    if (len < 8) continue;
    const ed = L.doors[0];
    let placed = false;
    for (let tries = 0; tries < 6 && !placed; tries++) {
      const k = rng.int(2, len - 2);
      let x1, z1, x2, z2;
      if (vertical) { z1 = z2 = (r.y + k) * T; x1 = r.x * T + 0.05; x2 = (r.x + r.w) * T - 0.05; }
      else { x1 = x2 = (r.x + k) * T; z1 = r.y * T + 0.05; z2 = (r.y + r.h) * T - 0.05; }
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
      if ((mx - ed.x) ** 2 + (mz - ed.z) ** 2 < 8 * 8) continue;
      let clash = false;
      for (const d of L.doors) if ((d.x - mx) ** 2 + (d.z - mz) ** 2 < 1.7 * 1.7) clash = true;
      for (const o of L.lasers) if (((o.x1 + o.x2) / 2 - mx) ** 2 + ((o.z1 + o.z2) / 2 - mz) ** 2 < 6 * 6) clash = true;
      if (clash) continue;
      L.lasers.push({ id: L.lasers.length, kind: 'pulse', room: r.id, zone: r.zone, x1, z1, x2, z2, net: twist !== 'hardwired',
        on: 2.4 + rng.int(0, 10) / 10, off: 1.5 + rng.int(0, 6) / 10, ph: rng.int(0, 99) / 100 });
      placed = true; nPulse--;
    }
  }

  // ---------- panels ----------
  L.junction = [];
  for (let z = 0; z < Z; z++) {
    let rs = R.filter((r) => r.zone === z && r.id !== vault && r.id !== 0);
    const nonCorr = rs.filter((r) => !r.corr);
    if (nonCorr.length && rng.chance(0.75)) rs = nonCorr;
    rs = rng.shuffle(rs.slice());
    let pn = null;
    for (const r of rs) {
      const sl = wallSlots(r, false); if (!sl.length) continue;
      pn = addPanel('junction', r, sl[rng.int(0, sl.length - 1)], { zone: z });
      break;
    }
    if (!pn) return null;
    L.junction[z] = pn.id;
  }
  // vault keypad beside the vault door (near side)
  {
    const d = L.doors[L.vaultDoor];
    const near = R[d.a === vault ? d.b : d.a];
    const sl = nearestSlot(near, d.x, d.z, 1);
    if (!sl) return null;
    const pn = addPanel('vaultpad', near, sl, { len: tier >= 4 ? 6 : 5 });
    L.vaultPad = pn.id;
  }
  // fuse boxes
  const nFuse = big ? 2 : 1;
  for (let i = 0; i < nFuse; i++) {
    let rs = R.filter((r) => r.zone <= Math.min(1, Z - 1) && r.id !== vault && r.id !== 0);
    const pref = rs.filter((r) => ['storage', 'security', 'records', 'server', 'corridor'].includes(r.type));
    if (pref.length) rs = pref;
    rs = rng.shuffle(rs.slice());
    for (const r of rs) {
      const sl = wallSlots(r, false); if (!sl.length) continue;
      const target = rng.int(r.zone, Z - 1);
      addPanel('fuse', r, sl[rng.int(0, sl.length - 1)], { effect: rng.chance(0.55) ? 'cams' : 'lights', target });
      break;
    }
  }

  // ---------- cameras ----------
  let nCam = Math.round((N - 1) * (0.2 + tier * 0.026)) + (twist === 'eyes' ? 4 : 0) + (big ? 2 : 0);
  const camRooms = [vr, ...rng.shuffle(R.filter((r) => r.id !== 0 && r.id !== vault && (r.corr ? Math.max(r.w, r.h) >= 6 : area(r) >= 9)))];
  const rangeMul = twist === 'eyes' ? 1.2 : 1;
  for (const r of camRooms) {
    if (nCam <= 0) break;
    const cx = (r.x + r.w / 2) * T, cz = (r.y + r.h / 2) * T;
    let mount = null;
    if (r.corr) {
      const vertical = r.h > r.w;
      const ends = vertical ? [[cx, r.y * T + 0.22, 0], [cx, (r.y + r.h) * T - 0.22, 2]] : [[r.x * T + 0.22, cz, 3], [(r.x + r.w) * T - 0.22, cz, 1]];
      const good = ends.filter(([, , s]) => {
        const sx = s === 1 ? r.x + r.w - 1 : r.x, sy = s === 2 ? r.y + r.h - 1 : r.y;
        for (let k = 0; k < (vertical ? r.w : r.h); k++) {
          const e = edgeOf(L, vertical ? r.x + k : sx, vertical ? sy : r.y + k, s);
          if (edgeVal(L, e) !== E_WALL) return false;
        }
        return true;
      });
      if (!good.length) continue;
      const m = good[rng.int(0, good.length - 1)];
      mount = { x: m[0], z: m[1], tx: m[0] + (vertical ? 0 : (m[2] === 3 ? 10 : -10)), tz: m[1] + (vertical ? (m[2] === 0 ? 10 : -10) : 0), amp: 0.32 };
    } else {
      const corners = [[r.x, r.y, 0, 3], [r.x + r.w - 1, r.y, 0, 1], [r.x, r.y + r.h - 1, 2, 3], [r.x + r.w - 1, r.y + r.h - 1, 2, 1]];
      const ok = corners.filter(([x, y, s1, s2]) => edgeVal(L, edgeOf(L, x, y, s1)) === E_WALL && edgeVal(L, edgeOf(L, x, y, s2)) === E_WALL);
      if (!ok.length) continue;
      const [x, y, s1, s2] = ok[rng.int(0, ok.length - 1)];
      const wx = (s2 === 3 ? x * T + 0.2 : (x + 1) * T - 0.2), wz = (s1 === 0 ? y * T + 0.2 : (y + 1) * T - 0.2);
      mount = { x: wx, z: wz, tx: cx, tz: cz, amp: 0.5 };
    }
    L.cams.push({ id: L.cams.length, room: r.id, zone: r.zone, x: mount.x, z: mount.z, h: 2.82,
      a0: Math.atan2(mount.tz - mount.z, mount.tx - mount.x), amp: mount.amp, per: 7 + rng.int(0, 40) / 10, ph: rng.int(0, 99) / 100,
      fov: 0.5, range: 11.5 * rangeMul });
    nCam--;
  }

  // ---------- lights ----------
  for (const r of R) {
    const lux = r.id === 0 ? 0.6 : (ROOMS[r.type] ? ROOMS[r.type].lux : 0.7);
    r.lights = [];
    if (r.id === 0) {
      r.lights.push({ x: (L.doors[0].x), z: (r.y + 0.7) * T, h: 3.0 });
    } else if (r.corr) {
      const vertical = r.h > r.w, len = vertical ? r.h : r.w;
      const n = Math.max(1, Math.round(len / 2.6));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        r.lights.push(vertical ? { x: (r.x + r.w / 2) * T, z: (r.y + t * r.h) * T } : { x: (r.x + t * r.w) * T, z: (r.y + r.h / 2) * T });
      }
    } else {
      const nx = Math.max(1, Math.round(r.w / 3)), nz = Math.max(1, Math.round(r.h / 3));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) r.lights.push({ x: (r.x + (i + 0.5) * r.w / nx) * T, z: (r.y + (j + 0.5) * r.h / nz) * T });
    }
    r.lux = lux;
    const always = r.type === 'vault' || r.type === 'security' || r.id === 0;
    if (twist === 'blackout') r.lightOn = always ? 1 : r.corr ? (rng.chance(0.25) ? 1 : 0) : (rng.chance(0.12) ? 1 : 0);
    else r.lightOn = always || r.corr ? 1 : rng.chance(0.62) ? 1 : 0;
    r.color = ROOMS[r.type] ? ROOMS[r.type].light : 0xffe8cc;
  }

  // ---------- spawn / van ----------
  const yard = R[0];
  const ed = L.doors[0];
  const vanX = Math.min(Math.max(ed.x + (ed.x > W * T / 2 ? -4.2 : 4.2), 4), W * T - 4);
  L.van = { x: vanX, z: (yard.y + yard.h - 1.35) * T, a: 0 };
  L.spawn = { x: vanX + (ed.x > vanX ? 2.1 : -2.1), z: L.van.z - 1.6, a: -Math.PI / 2 };
  // open on the side entrance at an angle, so the first shot shows the door and the wall running away
  L.spawn.a = Math.atan2(ed.z - L.spawn.z, ed.x - L.spawn.x);
  const spawnCell = Math.floor(L.spawn.z / T) * W + Math.floor(L.spawn.x / T);
  {
    const v = { id: L.furn.length, type: 'van', room: 0, x: L.van.x, z: L.van.z, hx: 2.75, hz: 1.12, h: 2.5, cls: 'tall', rot: 0, cells: [] };
    for (let y = yard.y; y < yard.y + yard.h; y++) for (let x = yard.x; x < yard.x + yard.w; x++) {
      const cx = (x + 0.5) * T, cz = (y + 0.5) * T;
      if (Math.abs(cx - v.x) < v.hx && Math.abs(cz - v.z) < v.hz) { blk[y * W + x] = 1; v.cells.push(y * W + x); }
    }
    L.furn.push(v);
  }

  // ---------- furniture ----------
  const reachAll = () => {
    const seen = new Uint8Array(W * H); const st = [spawnCell]; seen[spawnCell] = 1; let n = 0;
    while (st.length) {
      const c0 = st.pop(); n++;
      const x = c0 % W, y = (c0 / W) | 0;
      for (let d = 0; d < 4; d++) {
        if (!canStep(L, x, y, d)) continue;
        const nc = (y + DY[d]) * W + x + DX[d];
        if (seen[nc] || blk[nc]) continue;
        seen[nc] = 1; st.push(nc);
      }
    }
    let total = 0; for (let i = 0; i < W * H; i++) if (cell[i] >= 0 && !blk[i]) total++;
    return n === total;
  };
  const WALLY = new Set(['sofa_v', 'sofa_l', 'desk', 'shelf', 'cabinet', 'counter', 'crates', 'monitors', 'lockers', 'plant', 'crate', 'cone']);
  const placePiece = (r, type, forceCenter) => {
    const f = FURN[type];
    for (let tries = 0; tries < 14; tries++) {
      let x, y, s, cw = f.cw;
      const wallPiece = WALLY.has(type) && !forceCenter;
      if (wallPiece) {
        const sl = wallSlots(r, false);
        if (!sl.length) return null;
        const p = sl[rng.int(0, sl.length - 1)];
        x = p.x; y = p.y; s = p.s;
      } else {
        if (r.w < 3 || r.h < 3) return null;
        x = rng.int(r.x + 1, r.x + r.w - 2); y = rng.int(r.y + 1, r.y + r.h - 2); s = rng.int(0, 3);
        if (r.w >= 5 && r.h >= 5 && rng.chance(0.5)) { x = rng.int(r.x + 1, r.x + r.w - 2); y = rng.int(r.y + 1, r.y + r.h - 2); }
      }
      const along = s === 0 || s === 2 ? 0 : 1; // 0: extends along x, 1: along y
      const cells = [];
      let ok = true;
      for (let k = 0; k < cw; k++) {
        const cx2 = x + (along === 0 ? k : 0), cy2 = y + (along === 1 ? k : 0);
        if (cx2 >= r.x + r.w || cy2 >= r.y + r.h) { ok = false; break; }
        const ci = cy2 * W + cx2;
        if (cell[ci] !== r.id || rsv[ci] || blk[ci]) { ok = false; break; }
        if (wallPiece && edgeVal(L, edgeOf(L, cx2, cy2, s)) !== E_WALL) { ok = false; break; }
        cells.push(ci);
      }
      if (!ok) continue;
      for (const ci of cells) blk[ci] = 1;
      if (!reachAll()) { for (const ci of cells) blk[ci] = 0; continue; }
      // footprint
      const [nx, nz] = NRM[s];
      const rx = (x + (along === 0 ? cw / 2 : 0.5)) * T, rz = (y + (along === 1 ? cw / 2 : 0.5)) * T;
      const push = wallPiece ? (T - f.d) / 2 - 0.05 : 0;
      const fx = rx - nx * push, fz = rz - nz * push;
      const hx = (along === 0 ? f.w : f.d) / 2, hz = (along === 0 ? f.d : f.w) / 2;
      const item = { id: L.furn.length, type, room: r.id, x: fx, z: fz, hx, hz, h: f.h, cls: f.cls, rot: s, cells };
      L.furn.push(item);
      return item;
    }
    return null;
  };
  for (const r of R) {
    if (r.id === 0 || r.corr) continue;
    const rc = ROOMS[r.type];
    if (!rc || !rc.furn) continue;
    const list = rng.shuffle(rc.furn.slice());
    const n = Math.min(10, Math.max(2, Math.round(area(r) / 5.6)));
    if (r.type === 'vault') {
      // vault: pallets in a grid + target case
      const target = placePiece(r, 'case', true);
      if (target) r.targetFurn = target.id;
      for (let i = 0; i < n; i++) placePiece(r, i % 3 === 2 ? 'shelf' : 'pallet', false);
      continue;
    }
    for (let i = 0; i < n; i++) placePiece(r, list[i % list.length], false);
  }
  // yard dressing
  for (let i = 0; i < 3; i++) placePiece(yard, 'cone', false);
  if (!R[vault].targetFurn && R[vault].targetFurn !== 0) return null;

  // ---------- loot ----------
  const targetKind = c.target && LOOT[c.target] ? c.target : rng.pick(theme.target);
  L.targetKind = targetKind;
  const addLoot = (kind, x, y, z, extra) => {
    const def = LOOT[kind];
    const it = Object.assign({ id: L.loot.length, kind, x, y, z, value: def.value, weight: def.weight, t: def.t }, extra || {});
    L.loot.push(it);
    return it;
  };
  const valueMul = 1 + (tier - 1) * 0.12 + (twist === 'tight' ? 0.3 : 0);
  // primary target
  if (targetKind === 'painting') {
    const sl = wallSlots(vr, true);
    if (!sl.length) return null;
    const p = sl[rng.int(0, sl.length - 1)]; usedSlot.add(p.key);
    const w = slotWorld(p, 0.05);
    addLoot('painting', w.x, 1.6, w.z, { primary: true, nx: w.nx, nz: w.nz, value: Math.round(LOOT.painting.value * 2.5 * valueMul) });
  } else {
    const f = L.furn[R[vault].targetFurn];
    addLoot(targetKind, f.x, f.h, f.z, { primary: true, furn: f.id, value: Math.round(LOOT[targetKind].value * 2.5 * valueMul) });
  }
  const regular = [];
  for (const f of L.furn) {
    const def = FURN[f.type];
    if (!def.loot || f.id === R[vault].targetFurn) continue;
    const r = R[f.room], rc = ROOMS[r.type];
    if (!rc.loot) continue;
    const p = r.type === 'vault' ? 0.95 : f.type === 'pedestal' || f.type === 'case' ? 0.9 : 0.4;
    if (!rng.chance(p)) continue;
    let kind = rng.pick(rc.loot);
    if (LOOT[kind].wall) continue;
    const y = f.type === 'shelf' ? 1.12 : def.h;
    regular.push({ kind, x: f.x, y, z: f.z, furn: f.id, vault: r.type === 'vault' });
  }
  // paintings on gallery walls
  for (const r of R) {
    const rc = ROOMS[r.type];
    if (!rc || !rc.paintings) continue;
    const sl = rng.shuffle(wallSlots(r, false));
    for (let i = 0; i < Math.min(2, sl.length); i++) {
      if (!rng.chance(0.7)) continue;
      usedSlot.add(sl[i].key); rsv[sl[i].y * W + sl[i].x] = 1;
      const w = slotWorld(sl[i], 0.05);
      regular.push({ kind: 'painting', x: w.x, y: 1.6, z: w.z, nx: w.nx, nz: w.nz, wall: true });
    }
  }
  const maxRegular = 6 + Math.round(tier * 1.5) + (big ? 6 : 0);
  const vaultItems = regular.filter((it) => it.vault);
  const others = rng.shuffle(regular.filter((it) => !it.vault)).slice(0, Math.max(0, maxRegular - vaultItems.length));
  for (const it of [...vaultItems, ...others]) {
    const extra = { furn: it.furn, value: Math.round(LOOT[it.kind].value * valueMul * (0.85 + rng.int(0, 30) / 100)) };
    if (it.wall) { extra.nx = it.nx; extra.nz = it.nz; }
    addLoot(it.kind, it.x, it.y, it.z, extra);
  }
  // decorative paintings: remaining gallery slots get frames (not loot) - renderer only
  L.decor = [];
  for (const r of R) {
    if (r.id === 0 || r.corr || r.type === 'vault') continue;
    const sl = rng.shuffle(wallSlots(r, false));
    const n = Math.min(sl.length, r.type === 'gallery' || r.type === 'hall' ? 3 : r.type === 'exec' || r.type === 'lobby' || r.type === 'lounge' ? 1 : 0);
    for (let i = 0; i < n; i++) { usedSlot.add(sl[i].key); const w = slotWorld(sl[i], 0.04); L.decor.push({ kind: 'frame', x: w.x, z: w.z, nx: w.nx, nz: w.nz, v: rng.int(0, 5) }); }
  }

  // ---------- guards ----------
  let ng = 2 + Math.floor(tier / 2) + (big ? 2 : 0) + (twist === 'double' ? 2 : 0);
  ng = Math.min(ng, 9);
  const guardDoor = (d) => d.kind !== 'entry' && d.kind !== 'vault';
  const freeCellIn = (r) => {
    for (let t = 0; t < 30; t++) {
      const x = rng.int(r.x, r.x + r.w - 1), y = rng.int(r.y, r.y + r.h - 1), ci = y * W + x;
      if (!blk[ci]) return ci;
    }
    return -1;
  };
  const sec = R.find((r) => r.type === 'security');
  for (let g = 0; g < ng; g++) {
    const z = g === 0 ? Z - 1 : (g - 1) % Z;
    let pool = R.filter((r) => r.zone === z && r.id !== vault && r.id !== 0);
    if (g === 1 && sec) pool = [sec, ...R.filter((r) => r.corr && r.zone === sec.zone)];
    if (!pool.length) continue;
    const nWp = Math.min(pool.length, 3 + (g % 2));
    const rooms = rng.shuffle(pool.slice()).slice(0, nWp);
    if (rooms.length < 2) rooms.push(rooms[0]);
    const wps = rooms.map(freeCellIn).filter((ci) => ci >= 0);
    if (wps.length < 2) continue;
    const route = [];
    let fail = false;
    for (let i = 0; i < wps.length; i++) {
      const p = astar(L, wps[i], wps[(i + 1) % wps.length], guardDoor, blk);
      if (!p) { fail = true; break; }
      for (let k = 0; k < p.length - 1; k++) route.push({ c: p[k], wait: k === 0 ? 2 + rng.int(0, 20) / 10 : 0 });
    }
    if (fail || route.length < 4) continue;
    // start point away from the spawn
    let start = -1;
    for (let t = 0; t < 30; t++) {
      const k = rng.int(0, route.length - 1), cc = cellCenter(L, route[k].c);
      if ((cc.x - L.spawn.x) ** 2 + (cc.z - L.spawn.z) ** 2 > 14 * 14 && cell[route[k].c] !== entry) { start = k; break; }
    }
    if (start < 0) continue;
    L.guards.push({ id: L.guards.length, zone: z, route, start, light: twist === 'blackout' || rng.chance(0.5) });
  }
  if (L.guards.length < Math.min(2, ng)) return null;

  // ---------- cipher card ----------
  const digits = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  L.cipher = digits; // cipher[glyph] = digit
  L.codeSeed = rng.u32();

  // par time estimate
  const pv = astar(L, spawnCell, Math.floor(L.doors[L.vaultDoor].z / T) * W + Math.floor(L.doors[L.vaultDoor].x / T), null, blk);
  L.par = Math.round(90 + (pv ? pv.length * T * 2 / 2.2 : 120) + L.panels.length * 22);

  // spatial index of furniture by cell
  L.cellFurn = Array.from({ length: W * H }, () => null);
  for (const f of L.furn) {
    const x0 = Math.floor((f.x - f.hx) / T), x1 = Math.floor((f.x + f.hx) / T), z0 = Math.floor((f.z - f.hz) / T), z1 = Math.floor((f.z + f.hz) / T);
    for (let y = z0; y <= z1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const ci = y * W + x;
      (L.cellFurn[ci] || (L.cellFurn[ci] = [])).push(f.id);
    }
  }
  return L;
}
