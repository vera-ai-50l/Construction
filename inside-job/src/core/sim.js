// Authoritative job simulation. Runs on the RUNNER's machine (zero input lag);
// the hacker receives compact snapshots and sends commands.
import { RNG, serialCode } from './rng.js';
import { T, EYE, EYE_CROUCH, COST, DUR, FUSE_COLORS, GLYPHS, TIMELOCK_BW } from './data.js';
import { astar, cellCenter, cellAt, roomAt } from './level.js';
import { losBlocked, collide, segDist, segIntersect, walkable, angDiff } from './geom.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const GST = { patrol: 0, sus: 1, alert: 2, search: 3, inv: 4, ko: 5 };
const GST_NAMES = Object.keys(GST);

export class Sim {
  constructor(L, up = {}, { testMode = false } = {}) {
    this.L = L; this.up = up;
    this.testMode = testMode;
    this.rng = new RNG(L.codeSeed ^ 0x51ed);
    this.t = 0; this.phase = 'play'; this.endReason = '';
    const tw = L.twist;
    const sp = L.spawn;
    this.r = {
      x: sp.x, z: sp.z, a: sp.a, pitch: 0, vx: 0, vz: 0, crouch: false, sprint: false, moving: 0, flash: false,
      bag: [], bagW: 0, cap: (tw === 'tight' ? 4 : 6) + 2 * (up.bag | 0), stepAcc: 0, panel: null,
      g: { emp: 1 + (up.emp | 0), smoke: 1 + (up.smoke | 0), noise: 2 + (up.noise | 0) }, sel: 'noise',
      px: sp.x, pz: sp.z, eye: EYE, hidden: 0, lit: 0,
    };
    this.focus = null; this.hold = { key: null, p: 0 };
    this.guards = L.guards.map((g) => {
      const c = cellCenter(L, g.route[g.start].c);
      return { id: g.id, def: g, x: c.x, z: c.z, a: 0, st: GST.patrol, meter: 0, ri: g.start, wait: 0, path: null, pi: 0,
        tx: 0, tz: 0, timer: 0, radio: 0, seenT: 0, lsx: 0, lsz: 0, speed: 0, look: 0, flash: g.light, spotted: false, anim: 0, bodyFound: false, reported: false };
    });
    this.cams = L.cams.map((c) => ({ st: 0, until: 0, meter: 0, cool: 0, a: c.a0 }));
    this.lasers = L.lasers.map(() => ({ st: 0, until: 0, cool: 0 }));
    this.doors = L.doors.map((d) => ({ o: 0, want: 0, sign: 1, eopen: false, gUntil: 0, picked: d.kind !== 'entry', lastNear: -99 }));
    this.rooms = L.rooms.map((r) => ({ base: r.lightOn, cut: 0, fused: false, emp: 0 }));
    this.zones = 0; // bitmask of networked zones
    this.alarm = 0; this.police = -1; this.lockdown = 0;
    this.bwMax = 10 + 2 * (up.bw | 0) - (tw === 'jammer' ? 3 : 0);
    this.bw = this.bwMax * 0.6;
    this.regen = 0.42 * (1 + 0.25 * (up.regen | 0)) * (tw === 'jammer' ? 0.6 : 1);
    this.loot = L.loot.map(() => 0); // 0 present, 1 bag, 2 secured
    this.secured = 0; this.securedItems = [];
    this.events = []; this.eid = 0;
    this.smoke = []; this.noises = []; this.thrown = [];
    this.ping = { zone: -1, until: 0 };
    this.panels = L.panels.map((p) => this.makePanelState(p));
    this.timelock = 0; this.vaultOpen = false;
    this.hackerHold = false; this.ack = 0; this.mark = null;
    this.stats = { spotted: 0, alarms: 0, ko: 0, emp: 0, mistakes: 0, camsLooped: 0, maxAlarm: 0 };
    this.hackerSeen = new Set();
    this.reinforced = false;
    // helpers for geom
    this.doorOpen = (id) => this.doors[id].o;
    this.doorSolid = (id) => {
      const d = L.doors[id], s = this.doors[id];
      if (d.kind === 'swing') return false;
      if (d.kind === 'entry') return !s.picked;
      return s.o < 0.85;
    };
  }

  // ---------------- panels ----------------
  makePanelState(p) {
    const s = { lock: 0, mistakes: 0, done: false, entry: [] };
    if (p.kind === 'junction') s.code = serialCode(this.rng);
    if (p.kind === 'keypad' || p.kind === 'vaultpad') s.glyphs = this.newGlyphs(p.len);
    if (p.kind === 'fuse') this.newFuses(s);
    return s;
  }
  newGlyphs(n) { const g = []; while (g.length < n) { const k = this.rng.int(0, 9); if (g[g.length - 1] !== k) g.push(k); } return g; }
  newFuses(s) {
    s.fuses = [];
    for (let i = 0; i < 6; i++) s.fuses.push({ c: this.rng.int(0, FUSE_COLORS.length - 1), n: this.rng.int(1, 9), pulled: false });
    const n = 3 + (this.L.tier >= 4 ? 1 : 0);
    s.seq = this.rng.shuffle([0, 1, 2, 3, 4, 5]).slice(0, n);
    s.step = 0; s.deadline = 0;
  }
  ev(type, ...args) { this.events.push({ id: ++this.eid, t: this.t, type, args }); if (this.events.length > 40) this.events.shift(); }

  incident(reason, x, z) {
    if (this.phase !== 'play' || this.testGhost) return;
    this.alarm = Math.min(3, this.alarm + 1);
    this.stats.alarms++; this.stats.maxAlarm = Math.max(this.stats.maxAlarm, this.alarm);
    this.ev('alarm', this.alarm, reason);
    if (this.alarm >= 2) {
      this.lockdown = this.t + 25;
      for (let i = 0; i < this.L.doors.length; i++) if (this.L.doors[i].kind === 'edoor') this.doors[i].eopen = false;
      this.ev('lockdown');
      if (!this.reinforced) this.spawnReinforcement();
    }
    if (this.alarm >= 3 && this.police < 0) { this.police = 60 + 15 * (this.up.driver | 0); this.ev('police'); }
    // dispatch two nearest active guards
    if (x != null) {
      const gs = this.guards.filter((g) => g.st !== GST.ko && g.st !== GST.alert)
        .sort((a, b) => (a.x - x) ** 2 + (a.z - z) ** 2 - ((b.x - x) ** 2 + (b.z - z) ** 2)).slice(0, 2);
      for (const g of gs) this.sendGuard(g, x, z, GST.search, 8);
    }
  }

  testCheat(action) {
    if (!this.testMode || this.phase !== 'play') return;
    const L = this.L;
    switch (action) {
      case 'ghost':
        this.testGhost = !this.testGhost;
        if (this.testGhost) {
          this.alarm = 0; this.police = -1; this.lockdown = 0;
          for (const g of this.guards) {
            g.meter = 0;
            if (g.st === GST.alert) this.returnToRoute(g);
          }
          for (const c of this.cams) c.meter = 0;
        }
        break;
      case 'network':
        for (const p of L.panels) if (p.kind === 'junction' && !this.zoneOn(p.zone)) {
          this.panels[p.id].done = true;
          this.zones |= 1 << p.zone;
          this.ev('zone', p.zone);
        }
        this.doors[0].picked = true;
        for (const d of L.doors) if (d.kind === 'edoor') this.doors[d.id].eopen = true;
        break;
      case 'vault':
        this.panels[L.vaultPad].done = true;
        this.vaultOpen = true;
        this.timelock = 1;
        this.ev('vault_open');
        break;
      case 'restock':
        this.bw = this.bwMax;
        this.r.g = { emp: 1 + (this.up.emp | 0), smoke: 1 + (this.up.smoke | 0), noise: 2 + (this.up.noise | 0) };
        break;
    }
  }

  spawnReinforcement() {
    this.reinforced = true;
    const L = this.L, d = L.doors[0];
    const src = this.guards.find((g) => g.def.zone === 0) || this.guards[0];
    if (!src) return;
    const g = { ...src, id: this.guards.length, def: src.def, x: d.x, z: d.z - 1.2, st: GST.search, meter: 0.3, path: null, ri: src.def.start, wait: 0, flash: true, spotted: false, bodyFound: false, reported: false, radio: 0 };
    this.guards.push(g);
    this.sendGuard(g, this.r.x, this.r.z, GST.search, 10);
    this.ev('reinforce');
  }

  zoneOn(z) { return (this.zones >> z) & 1; }

  lightOn(roomId) {
    const s = this.rooms[roomId]; if (!s) return 0;
    if (!s.base || s.fused || s.cut > this.t || s.emp > this.t) return 0;
    return 1;
  }

  laserOn(i) {
    const lz = this.L.lasers[i], s = this.lasers[i];
    if (s.st === 2) return false;
    if (s.until > this.t) return false;
    if (lz.kind === 'pulse') { const per = lz.on + lz.off; const ph = ((this.t / per + lz.ph) % 1 + 1) % 1; return ph < lz.on / per; }
    return true;
  }

  camAngle(i) {
    const c = this.L.cams[i], s = this.cams[i];
    if (s.st === 2) return s.a;
    return c.a0 + c.amp * Math.sin(TAU * (this.t / c.per + c.ph));
  }
  camActive(i) { const s = this.cams[i]; return s.st !== 2 && !(s.until > this.t); }

  // ---------------- hacker commands ----------------
  applyHacker(h) {
    if (!h) return;
    this.hackerHold = !!h.hold;
    if (Array.isArray(h.cmd)) for (const c of h.cmd) {
      if (!Array.isArray(c) || typeof c[0] !== 'number' || c[0] <= this.ack) continue;
      this.ack = c[0];
      try { this.cmd(c[1], c.slice(2)); } catch { /* malformed command - ignore */ }
    }
  }

  spend(cost) { if (this.bw + 1e-6 < cost) { this.ev('nobw'); return false; } this.bw -= cost; return true; }

  cmd(type, a) {
    const L = this.L;
    if (this.phase !== 'play') return;
    switch (type) {
      case 'serial': {
        const id = a[0] | 0, code = String(a[1] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const p = L.panels[id], s = this.panels[id];
        if (!p || p.kind !== 'junction' || s.done) return;
        if (!this.r.panel || this.r.panel.id !== id) { this.ev('serial_noport', id); return; }
        if (s.lock > this.t) { this.ev('serial_locked', id); return; }
        if (code === s.code.replace('-', '')) {
          s.done = true; this.zones |= 1 << p.zone; this.ev('zone', p.zone);
        } else this.mistake(id, 'serial');
        return;
      }
      case 'door': {
        const id = a[0] | 0, d = L.doors[id];
        if (!d || d.kind !== 'edoor' || !this.zoneOn(d.ctrl)) return;
        if (this.lockdown > this.t) { this.ev('door_lockdown', id); return; }
        if (!this.spend(COST.door)) return;
        this.doors[id].eopen = !this.doors[id].eopen; this.ev('door', id, this.doors[id].eopen ? 1 : 0);
        return;
      }
      case 'laser': {
        const id = a[0] | 0, lz = L.lasers[id];
        if (!lz || !lz.net || !this.zoneOn(lz.zone) || this.lasers[id].st === 2) return;
        if (!this.spend(COST.laser)) return;
        this.lasers[id].until = this.t + DUR.laser; this.ev('laser', id);
        return;
      }
      case 'light': {
        const id = a[0] | 0, r = L.rooms[id];
        if (!r || id === 0 || !this.zoneOn(r.zone) || !this.rooms[id].base) return;
        if (!this.spend(COST.light)) return;
        this.rooms[id].cut = this.t + DUR.light; this.ev('light', id);
        for (const g of this.guards) if (g.st === GST.patrol && roomAt(L, g.x, g.z) === id) { g.st = GST.sus; g.timer = 2.5; g.meter = Math.max(g.meter, 0.2); g.tx = g.x; g.tz = g.z; }
        return;
      }
      case 'loop': {
        const id = a[0] | 0, c = L.cams[id];
        if (!c || !this.zoneOn(c.zone) || this.cams[id].st === 2) return;
        if (!this.spend(COST.loop)) return;
        this.cams[id].until = this.t + DUR.loop + 4 * (this.up.loop | 0); this.cams[id].st = 1; this.cams[id].meter = 0;
        this.stats.camsLooped++; this.ev('loop', id);
        return;
      }
      case 'ping': {
        const z = a[0] | 0;
        if (!this.zoneOn(z)) return;
        if (!this.spend(COST.ping)) return;
        this.ping = { zone: z, until: this.t + DUR.ping }; this.ev('ping', z);
        return;
      }
      case 'lure': {
        const id = a[0] | 0, r = L.rooms[id];
        if (!r || id === 0 || !this.zoneOn(r.zone)) return;
        if (!this.spend(COST.lure)) return;
        const x = (r.x + r.w / 2) * T, z = (r.y + r.h / 2) * T;
        this.noise(x, z, 13, 'lure'); this.ev('lure', id);
        return;
      }
      case 'mark': {
        const x = +a[0], z = +a[1];
        if (!isFinite(x) || !isFinite(z)) return;
        this.mark = { x: clamp(x, 0, L.W * T), z: clamp(z, 0, L.H * T), t: this.t };
        this.ev('mark', Math.round(this.mark.x * 10), Math.round(this.mark.z * 10));
        return;
      }
      default:
    }
  }

  mistake(id, kind) {
    const s = this.panels[id];
    s.mistakes++; this.stats.mistakes++;
    s.lock = this.t + 10; s.entry = [];
    const p = this.L.panels[id];
    if (p.kind === 'junction') s.code = serialCode(this.rng);
    if (s.glyphs) s.glyphs = this.newGlyphs(p.len);
    if (p.kind === 'fuse') this.newFuses(s);
    this.ev('wrong', id, kind, s.mistakes);
    this.noise(p.x, p.z, 9, 'panel');
    if (s.mistakes >= 2) { s.mistakes = 0; this.incident('tamper', p.x, p.z); }
  }

  // runner panel UI actions
  panelAction(act) {
    const P = this.r.panel; if (!P || this.phase !== 'play') return;
    const p = this.L.panels[P.id], s = this.panels[P.id];
    if (act.type === 'close') { this.r.panel = null; this.ev('panel_close', P.id); return; }
    if (s.lock > this.t || s.done) return;
    if ((p.kind === 'keypad' || p.kind === 'vaultpad') && act.type === 'key') {
      if (act.d === -1) { s.entry.pop(); return; }
      s.entry.push(act.d | 0);
      this.ev('key', P.id, s.entry.length);
      if (s.entry.length >= s.glyphs.length) {
        const ok = s.glyphs.every((g, i) => this.L.cipher[g] === s.entry[i]);
        if (ok) {
          s.done = true; this.ev('solved', P.id);
          if (p.kind === 'keypad') { this.lasers[p.laser].st = 2; this.ev('laser_off', p.laser); }
          else this.ev('vault_unlocked');
          this.r.panel = null;
        } else this.mistake(P.id, 'glyph');
      }
    }
    if (p.kind === 'fuse' && act.type === 'fuse') {
      const i = act.i | 0; if (i < 0 || i > 5 || s.fuses[i].pulled) return;
      if (s.seq[s.step] === i) {
        s.fuses[i].pulled = true; s.step++; this.ev('fuse_ok', P.id, s.step);
        if (s.step >= s.seq.length) {
          s.done = true; this.ev('solved', P.id);
          if (p.effect === 'cams') { for (let k = 0; k < this.L.cams.length; k++) if (this.L.cams[k].zone === p.target) { this.cams[k].st = 2; this.cams[k].a = this.camAngle(k); } this.ev('fuse_cams', p.target); }
          else { for (let k = 0; k < this.L.rooms.length; k++) if (this.L.rooms[k].zone === p.target && this.L.rooms[k].type !== 'vault') this.rooms[k].fused = true; this.ev('fuse_lights', p.target); }
          this.r.panel = null;
        }
      } else this.mistake(P.id, 'fuse');
    }
  }

  openPanel(id) {
    const s = this.panels[id], p = this.L.panels[id];
    this.r.panel = { id, t: this.t };
    if (p.kind === 'fuse' && !s.done) { s.deadline = this.t + 16; s.step = 0; for (const f of s.fuses) f.pulled = false; }
    this.ev('panel_open', id);
  }

  // ---------------- noise ----------------
  noise(x, z, rad, kind) {
    this.noises.push({ x, z, rad, kind });
    if (kind !== 'step') this.ev('noise', Math.round(x * 10), Math.round(z * 10), Math.round(rad), kind);
  }

  // ---------------- runner ----------------
  // inp: {mx, mz, a, pitch, sprint, crouch, use, take, gadget, sel, flash, throwTo}
  stepRunner(dt, inp) {
    const L = this.L, R = this.r;
    R.a = inp.a; R.pitch = inp.pitch;
    if (inp.sel && R.g[inp.sel] != null) R.sel = inp.sel;
    if (inp.flash) { R.flash = !R.flash; this.ev('flash', R.flash ? 1 : 0); }
    const inPanel = !!R.panel;
    R.crouch = !!inp.crouch;
    let mx = inPanel ? 0 : inp.mx || 0, mz = inPanel ? 0 : inp.mz || 0;
    const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    R.sprint = !!inp.sprint && !R.crouch && mz > 0.3 && ml > 0.1;
    const bagF = 1 - 0.28 * (R.bagW / R.cap);
    const speed = (R.crouch ? 1.75 : R.sprint ? 5.4 : 3.1) * bagF;
    // forward is (cos a, sin a)
    const fx = Math.cos(R.a), fz = Math.sin(R.a), rx = -fz, rz = fx;
    const wx = (fx * mz + rx * mx) * speed, wz = (fz * mz + rz * mx) * speed;
    const acc = 1 - Math.exp(-dt * 14);
    R.vx += (wx - R.vx) * acc; R.vz += (wz - R.vz) * acc;
    R.px = R.x; R.pz = R.z;
    const p = { x: R.x + R.vx * dt, z: R.z + R.vz * dt };
    collide(L, this, p, 0.3);
    const moved = Math.hypot(p.x - R.x, p.z - R.z);
    R.x = p.x; R.z = p.z; R.moving = moved / Math.max(dt, 1e-4);
    R.eye += ((R.crouch ? EYE_CROUCH : EYE) - R.eye) * (1 - Math.exp(-dt * 10));
    // footsteps
    R.stepAcc += moved;
    const stride = R.sprint ? 0.78 : R.crouch ? 0.5 : 0.62;
    if (R.stepAcc > stride) {
      R.stepAcc -= stride;
      const shoe = 1 - 0.17 * (this.up.shoes | 0);
      const rad = (R.sprint ? 7.5 : R.crouch ? 0.7 : 2.4) * shoe * (1 + 0.25 * R.bagW / R.cap);
      this.noise(R.x, R.z, rad, 'step');
      this.lastStep = { t: this.t, sprint: R.sprint, crouch: R.crouch };
    }
    // lasers crossing
    for (let i = 0; i < L.lasers.length; i++) {
      const lz = L.lasers[i], s = this.lasers[i];
      if (this.testGhost || s.cool > this.t || !this.laserOn(i)) continue;
      if (segIntersect(R.px, R.pz, R.x, R.z, lz.x1, lz.z1, lz.x2, lz.z2) || segDist(lz.x1, lz.z1, lz.x2, lz.z2, R.x, R.z) < 0.16) {
        s.cool = this.t + 4; this.ev('laser_trip', i); this.incident('laser', R.x, R.z);
      }
    }
    // gadgets
    if (inp.gadget && !inPanel) this.useGadget(inp);
    // takedown
    if (inp.take && !inPanel) this.tryTakedown();
    // interaction
    this.updateFocus();
    if (inPanel) { this.hold.key = null; this.hold.p = 0; }
    else if (inp.use && this.focus && this.focus.ok) {
      const key = this.focus.kind + ':' + this.focus.id;
      if (this.hold.key !== key) { this.hold.key = key; this.hold.p = 0; }
      if (this.focus.kind === 'wheel') {
        // timelock handled in update via hold flags
      } else {
        this.hold.p += dt / this.focus.dur;
        if (this.hold.p >= 1) { this.hold.p = 0; this.hold.key = null; this.complete(this.focus); }
      }
    } else { this.hold.key = null; this.hold.p = 0; }
    this.runnerUse = !!inp.use;
    // fuse timer
    if (R.panel) {
      const P = L.panels[R.panel.id], s = this.panels[R.panel.id];
      if (P.kind === 'fuse' && !s.done && s.lock <= this.t && s.deadline > 0 && this.t > s.deadline) { this.mistake(R.panel.id, 'fuse_time'); s.deadline = this.t + 16; }
      if (P.kind === 'fuse' && s.lock > this.t) s.deadline = s.lock + 16;
    }
    // escaping police: at van with police timer — handled by 'leave'
  }

  updateFocus() {
    const L = this.L, R = this.r;
    const fx = Math.cos(R.a), fz = Math.sin(R.a);
    let best = null, bestS = -1;
    const consider = (kind, id, x, z, y, reach, label, dur, ok, why) => {
      const dx = x - R.x, dz = z - R.z, d = Math.hypot(dx, dz);
      if (d > reach) return;
      const dot = d > 0.05 ? (dx * fx + dz * fz) / d : 1;
      // vertical check against pitch
      const ey = R.eye, vy = y - ey;
      const vp = Math.atan2(vy, Math.max(d, 0.2));
      if (Math.abs(vp - R.pitch) > 0.75 && d > 0.6) return;
      if (dot < 0.72 && d > 0.5) return;
      if (losBlocked(L, this, R.x, R.z, x - dx * 0.08, z - dz * 0.08, { noFurn: true })) return;
      const sc = dot * 2 - d * 0.4;
      if (sc > bestS) { bestS = sc; best = { kind, id, label, dur, ok, why }; }
    };
    const hands = 1 - 0.2 * (this.up.hands | 0);
    // loot
    for (let i = 0; i < L.loot.length; i++) {
      if (this.loot[i]) continue;
      const it = L.loot[i];
      const full = R.bagW + it.weight > R.cap;
      consider('loot', i, it.x, it.z, it.y + 0.15, it.kind === 'painting' ? 1.7 : 1.75, it.kind, it.t * hands, !full, full ? 'Bag full - secure loot at the van' : '');
    }
    // panels
    for (let i = 0; i < L.panels.length; i++) {
      const p = L.panels[i], s = this.panels[i];
      const ok = !s.done && !(s.lock > this.t);
      const why = s.done ? 'Done' : s.lock > this.t ? 'Locked out ' + Math.ceil(s.lock - this.t) + 's' : '';
      consider('panel', i, p.x, p.z, p.y, 1.6, p.kind, 0.8, ok, why);
    }
    // doors
    const ed = L.doors[0];
    if (!this.doors[0].picked) consider('pick', 0, ed.x, ed.z, 1.1, 1.6, 'entry', 3 * hands, true, '');
    const vd = L.doors[L.vaultDoor], vp = L.panels[L.vaultPad];
    if (!this.vaultOpen) {
      const unlocked = this.panels[vp.id].done;
      const networked = this.zoneOn(vd.ctrl);
      consider('wheel', L.vaultDoor, vd.x, vd.z, 1.2, 1.9, 'timelock', 1, unlocked && networked,
        !unlocked ? 'Sealed - crack the keypad first' : !networked ? 'Timelock offline - network this zone' : '');
    }
    // van
    const v = L.van;
    const dv = Math.hypot(v.x - R.x, v.z - R.z);
    if (dv < 3.6) {
      if (R.bag.length) best = bestS > 1.5 ? best : { kind: 'secure', id: 0, label: 'secure', dur: 0.7, ok: true };
      else if (this.t > 3) best = bestS > 1.5 ? best : { kind: 'leave', id: 0, label: 'leave', dur: 1.4, ok: true };
    }
    if (this.r.panel) best = null;
    this.focus = best;
  }

  complete(f) {
    const L = this.L, R = this.r;
    if (f.kind === 'loot') {
      const it = L.loot[f.id]; if (this.loot[f.id]) return;
      this.loot[f.id] = 1; R.bag.push(f.id); R.bagW += it.weight;
      this.ev('grab', f.id);
      this.noise(R.x, R.z, it.kind === 'painting' ? 3 : 1.5, 'grab');
    } else if (f.kind === 'panel') this.openPanel(f.id);
    else if (f.kind === 'pick') { this.doors[0].picked = true; this.ev('picked'); this.noise(R.x, R.z, 2, 'pick'); }
    else if (f.kind === 'secure') {
      for (const id of R.bag) { this.loot[id] = 2; this.secured += L.loot[id].value; this.securedItems.push(id); }
      this.ev('secure', R.bag.length, R.bag.reduce((s, id) => s + L.loot[id].value, 0));
      R.bag = []; R.bagW = 0;
    } else if (f.kind === 'leave') this.end(this.primarySecured() ? 'won' : 'bail', 'escaped');
  }

  primarySecured() { const i = this.L.loot.findIndex((l) => l.primary); return i >= 0 && this.loot[i] === 2; }

  useGadget(inp) {
    const R = this.r, L = this.L, k = R.sel;
    if (!(R.g[k] > 0)) { this.ev('nogadget', k); return; }
    R.g[k]--;
    if (k === 'emp') {
      const rad = 8.5;
      for (let i = 0; i < L.cams.length; i++) { const c = L.cams[i]; if (Math.hypot(c.x - R.x, c.z - R.z) < rad && this.cams[i].st !== 2) { this.cams[i].until = Math.max(this.cams[i].until, this.t + 8); this.cams[i].meter = 0; } }
      for (let i = 0; i < L.lasers.length; i++) { const l = L.lasers[i]; if (segDist(l.x1, l.z1, l.x2, l.z2, R.x, R.z) < rad) this.lasers[i].until = Math.max(this.lasers[i].until, this.t + 8); }
      for (let i = 1; i < L.rooms.length; i++) if (L.rooms[i].lights.some((p) => Math.hypot(p.x - R.x, p.z - R.z) < rad)) this.rooms[i].emp = this.t + 8;
      for (const g of this.guards) if (Math.hypot(g.x - R.x, g.z - R.z) < rad) g.empUntil = this.t + 8;
      this.stats.emp++; this.ev('emp', Math.round(R.x * 10), Math.round(R.z * 10));
    } else if (k === 'smoke') {
      this.smoke.push({ x: R.x, z: R.z, r: 3.2, until: this.t + 11, t0: this.t });
      this.ev('smoke', Math.round(R.x * 10), Math.round(R.z * 10));
      this.noise(R.x, R.z, 3, 'smoke');
    } else if (k === 'noise') {
      // throw along view direction until a wall
      const fx = Math.cos(R.a), fz = Math.sin(R.a);
      let d = 1;
      for (; d < 14; d += 0.4) if (losBlocked(L, this, R.x, R.z, R.x + fx * d, R.z + fz * d, { noFurn: true })) break;
      d = Math.max(1, d - 0.6);
      const x = R.x + fx * d, z = R.z + fz * d;
      this.thrown.push({ x, z, at: this.t + 1.1, x0: R.x, z0: R.z, t0: this.t });
      this.ev('throw', Math.round(x * 10), Math.round(z * 10));
    }
  }

  tryTakedown() {
    const R = this.r;
    let best = null;
    for (const g of this.guards) {
      if (g.st === GST.ko || g.st === GST.alert) continue;
      const dx = R.x - g.x, dz = R.z - g.z, d = Math.hypot(dx, dz);
      if (d > 1.65) continue;
      const toR = Math.atan2(dz, dx);
      const behind = Math.abs(angDiff(toR, g.a)) > 1.75;
      const facing = Math.abs(angDiff(Math.atan2(g.z - R.z, g.x - R.x), R.a)) < 0.9;
      if (behind && facing && (!best || d < best.d)) best = { g, d };
    }
    if (!best) { this.ev('miss'); return; }
    const g = best.g;
    g.st = GST.ko; g.meter = 0; g.koT = this.t; g.path = null;
    this.stats.ko++;
    this.ev('ko', g.id);
    this.noise(R.x, R.z, 3.2, 'ko');
  }

  // ---------------- guards ----------------
  sendGuard(g, x, z, st, look) {
    const L = this.L;
    const from = cellAt(L, g.x, g.z), to = cellAt(L, x, z);
    if (from < 0 || to < 0) return;
    let target = to;
    if (L.blk[target]) { // nearest unblocked neighbour
      const W = L.W, tx = to % W, ty = (to / W) | 0;
      let bestN = -1, bd = 1e9;
      for (let yy = ty - 2; yy <= ty + 2; yy++) for (let xx = tx - 2; xx <= tx + 2; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= L.H) continue;
        const c = yy * W + xx; if (L.blk[c] || L.cell[c] <= 0) continue;
        const dd = (xx - tx) ** 2 + (yy - ty) ** 2; if (dd < bd) { bd = dd; bestN = c; }
      }
      if (bestN < 0) return; target = bestN;
    }
    const path = astar(L, from, target, (d) => d.kind !== 'entry' || this.doors[d.id].picked, L.blk);
    if (!path) return;
    g.path = path; g.pi = 0; g.st = st; g.tx = x; g.tz = z; g.timer = look; g.look = 0;
  }

  returnToRoute(g) {
    const L = this.L, route = g.def.route;
    let bi = 0, bd = 1e9;
    for (let i = 0; i < route.length; i++) { const c = cellCenter(L, route[i].c); const d = (c.x - g.x) ** 2 + (c.z - g.z) ** 2; if (d < bd) { bd = d; bi = i; } }
    g.ri = bi; g.st = GST.patrol; g.path = null; g.wait = 0;
    const c = cellCenter(L, route[bi].c);
    if (bd > 2.5) { this.sendGuard(g, c.x, c.z, GST.patrol, 0); g.st = GST.patrol; g.returning = true; }
  }

  moveGuard(g, tx, tz, speed, dt) {
    const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
    if (d < 1e-4) return true;
    const want = Math.atan2(dz, dx);
    g.a += angDiff(want, g.a) * Math.min(1, dt * 7);
    const step = Math.min(d, speed * dt);
    g.x += (dx / d) * step; g.z += (dz / d) * step;
    g.speed = speed;
    return d - step < 0.12;
  }

  followPath(g, speed, dt) {
    const L = this.L;
    if (!g.path || g.pi >= g.path.length) return true;
    // string-pull: skip ahead while visible
    while (g.pi < g.path.length - 1) {
      const n = cellCenter(L, g.path[g.pi + 1]);
      if (walkable(L, this, g.x, g.z, n.x, n.z)) g.pi++; else break;
    }
    const isLast = g.pi >= g.path.length - 1;
    const c = isLast && g.st !== GST.patrol ? { x: g.tx, z: g.tz } : cellCenter(L, g.path[g.pi]);
    if (isLast && g.st !== GST.patrol) { // clamp target to walkable
      const cc = cellCenter(L, g.path[g.pi]);
      if (!walkable(L, this, g.x, g.z, c.x, c.z)) { c.x = cc.x; c.z = cc.z; }
    }
    if (this.moveGuard(g, c.x, c.z, speed, dt)) { g.pi++; if (g.pi >= g.path.length) return true; }
    return false;
  }

  guardSees(g, tx, tz, ty) {
    // returns visibility factor 0..1 (angle, periphery)
    const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
    const ang = Math.abs(angDiff(Math.atan2(dz, dx), g.a + (g.lookOff || 0)));
    let per = ang < 0.75 ? 1 : ang < 1.2 ? 0.4 : 0;
    if (d < 1.4 && ang < 2.2) per = Math.max(per, 0.8); // you can't stand next to someone unnoticed
    return { d, per, ang };
  }

  runnerLight() {
    const R = this.r, L = this.L;
    const room = roomAt(L, R.x, R.z);
    let lit = room >= 0 ? this.lightOn(room) * (L.rooms[room].lux || 0.7) : 0.2;
    if (room === 0) lit = 0.55;
    // guard flashlights
    for (const g of this.guards) {
      if (g.st === GST.ko || !this.guardFlashOn(g)) continue;
      const dx = R.x - g.x, dz = R.z - g.z, d = Math.hypot(dx, dz);
      if (d < 11 && Math.abs(angDiff(Math.atan2(dz, dx), g.a + (g.lookOff || 0))) < 0.36) lit = Math.max(lit, 1.1 - d / 22);
    }
    if (R.flash) lit = Math.max(lit, 1.15);
    for (const s of this.smoke) if (Math.hypot(s.x - R.x, s.z - R.z) < s.r * 0.85) lit *= 0.15;
    return lit;
  }

  guardFlashOn(g) {
    if (g.st === GST.ko || g.empUntil > this.t) return false;
    if (g.flash) return true;
    const room = roomAt(this.L, g.x, g.z);
    return room > 0 && !this.lightOn(room);
  }

  stepGuards(dt) {
    const L = this.L, R = this.r;
    const lit = this.runnerLight();
    R.lit = lit;
    const alarmF = 1 + 0.4 * this.alarm;
    const stance = R.crouch ? 0.5 : R.sprint ? 1.45 : 1;
    const inSmoke = this.smoke.some((s) => Math.hypot(s.x - R.x, s.z - R.z) < s.r * 0.85);
    const panelF = R.panel ? 1.5 : 1;
    let maxMeter = 0;
    // noise intake
    const noises = this.noises; this.noises = [];
    for (const g of this.guards) {
      g.speed = 0; // set again by moveGuard when the guard actually moves this step
      if (g.st === GST.ko) continue;
      g.anim += dt;
      // ---- vision on runner
      const v = this.guardSees(g, R.x, R.z, R.eye);
      const range = 15 * (0.4 + 0.6 * Math.min(1, lit));
      let seeing = false;
      if (!this.testGhost && v.per > 0 && v.d < range && !inSmoke) {
        if (!losBlocked(L, this, g.x, g.z, R.x, R.z, { low: R.crouch })) {
          seeing = true;
          const df = clamp(1.7 - (v.d / range) * 1.5, 0.2, 1.7);
          const lf = 0.35 + 0.65 * Math.min(1, lit);
          const rate = 0.95 * df * lf * stance * v.per * alarmF * panelF * (g.st === GST.alert ? 3 : 1);
          g.meter = Math.min(1.3, g.meter + rate * dt);
          g.lsx = R.x; g.lsz = R.z; g.seenT = this.t;
        }
      }
      if (!seeing) g.meter = Math.max(0, g.meter - dt * (g.st === GST.alert ? 0.12 : g.st === GST.sus ? 0.16 : 0.24));
      maxMeter = Math.max(maxMeter, Math.min(1, g.meter));
      // ---- bodies
      for (const o of this.guards) {
        if (o === g || o.st !== GST.ko || o.bodyFound) continue;
        const bv = this.guardSees(g, o.x, o.z, 0.3);
        if (bv.per > 0 && bv.d < 12 && !losBlocked(L, this, g.x, g.z, o.x, o.z, { low: true })) {
          o.bodyFound = true; this.ev('body', g.id, o.id); this.incident('body', o.x, o.z);
          this.sendGuard(g, o.x, o.z, GST.search, 8);
        }
      }
      // ---- hearing
      if (g.st !== GST.alert) for (const n of noises) {
        const d = Math.hypot(n.x - g.x, n.z - g.z);
        const walls = losBlocked(L, this, g.x, g.z, n.x, n.z, { noFurn: true });
        const rad = n.rad * (walls ? 0.55 : 1);
        if (d < rad) {
          if (n.kind === 'step' && d > rad * 0.6 && g.st === GST.patrol) { g.st = GST.sus; g.timer = 2; g.tx = n.x; g.tz = n.z; g.meter = Math.max(g.meter, 0.25); this.ev('hear', g.id); }
          else if (g.st === GST.patrol || g.st === GST.sus || g.st === GST.search || g.st === GST.inv) {
            if ((g.st === GST.inv || g.st === GST.search) && this.t - (g.heardT || 0) < 1.2) continue;
            if (g.st !== GST.search || n.kind !== 'step') { const was = g.st; this.sendGuard(g, n.x, n.z, GST.inv, 5); g.heardT = this.t; if (was !== GST.inv) this.ev('hear', g.id); }
          }
        }
      }
      // ---- state machine
      const prevSt = g.st;
      if (g.meter >= 1 && g.st !== GST.alert) { g.st = GST.alert; g.radio = this.t + 2.2; g.reported = false; this.stats.spotted++; g.spotted = true; this.ev('alert', g.id); }
      else if (g.meter > 0.32 && (g.st === GST.patrol || g.st === GST.inv || g.st === GST.search) && seeing) { g.st = GST.sus; g.timer = 3; g.tx = R.x; g.tz = R.z; this.ev('sus', g.id); }
      g.lookOff = 0;
      switch (g.st) {
        case GST.patrol: {
          const route = g.def.route;
          if (g.returning && g.path) { if (this.followPath(g, 1.4, dt)) { g.returning = false; g.path = null; } break; }
          if (g.wait > 0) { g.wait -= dt; g.lookOff = Math.sin(this.t * 1.3 + g.id) * 0.8; g.speed = 0; break; }
          const c = cellCenter(L, route[g.ri].c);
          const sp = 1.35 + 0.2 * this.alarm;
          if (this.moveGuard(g, c.x, c.z, sp, dt)) { g.ri = (g.ri + 1) % route.length; g.wait = route[g.ri].wait; }
          break;
        }
        case GST.sus: {
          g.speed = 0;
          const want = Math.atan2(g.tz - g.z, g.tx - g.x);
          g.a += angDiff(want, g.a) * Math.min(1, dt * 4);
          if (seeing) { g.tx = R.x; g.tz = R.z; g.timer = 3; }
          g.timer -= dt;
          if (g.timer <= 0 && g.meter < 0.3) { this.sendGuard(g, g.tx, g.tz, GST.search, 4); if (g.st !== GST.search) this.returnToRoute(g); }
          break;
        }
        case GST.alert: {
          const d = Math.hypot(R.x - g.x, R.z - g.z);
          if (seeing) {
            g.path = null;
            const dir = Math.atan2(R.z - g.z, R.x - g.x);
            g.a += angDiff(dir, g.a) * Math.min(1, dt * 9);
            if (walkable(L, this, g.x, g.z, R.x, R.z)) this.moveGuard(g, R.x, R.z, 4.3, dt);
            else { if (!g.path || g.repath < this.t) { this.sendGuard(g, R.x, R.z, GST.alert, 0); g.repath = this.t + 0.5; } this.followPath(g, 4.3, dt); }
          } else {
            if (!g.path || g.repath < this.t) { this.sendGuard(g, g.lsx, g.lsz, GST.alert, 0); g.repath = this.t + 0.6; }
            const done = this.followPath(g, 4.0, dt);
            if (done || this.t - g.seenT > 4) { g.meter = 0.6; this.sendGuard(g, g.lsx, g.lsz, GST.search, 7); this.ev('lost', g.id); }
          }
          if (!g.reported && this.t > g.radio && g.empUntil <= this.t) { g.reported = true; this.ev('radio', g.id); this.incident('radio', R.x, R.z); }
          if (d < 0.95 && seeing && this.phase === 'play') { this.ev('caught', g.id); this.end('bust', 'caught'); }
          break;
        }
        case GST.search: case GST.inv: {
          const arrived = this.followPath(g, g.st === GST.search ? 2.3 : 1.9, dt);
          if (arrived) {
            g.speed = 0; g.look += dt;
            g.lookOff = Math.sin(g.look * 1.7) * 1.2;
            g.timer -= dt;
            if (g.timer <= 0) this.returnToRoute(g);
          }
          break;
        }
        default:
      }
      if (prevSt !== g.st && g.st === GST.patrol) g.meter = Math.min(g.meter, 0.2);
      // open e-doors for guards
      for (let i = 0; i < L.doors.length; i++) {
        const d = L.doors[i];
        if (d.kind !== 'edoor') continue;
        if (Math.hypot(d.x - g.x, d.z - g.z) < 1.6) this.doors[i].gUntil = this.t + 1.5;
      }
    }
    this.maxMeter = maxMeter;
  }

  stepCameras(dt) {
    const L = this.L, R = this.r;
    const lit = R.lit;
    const ghost = 1 - 0.2 * (this.up.ghost | 0);
    const inSmoke = this.smoke.some((s) => Math.hypot(s.x - R.x, s.z - R.z) < s.r * 0.85);
    this.camSeeing = -1;
    for (let i = 0; i < L.cams.length; i++) {
      const c = L.cams[i], s = this.cams[i];
      if (s.st === 1 && s.until <= this.t) { s.st = 0; this.ev('loop_end', i); }
      s.a = this.camAngle(i);
      if (!this.camActive(i) || s.cool > this.t) { s.meter = Math.max(0, s.meter - dt); continue; }
      const dx = R.x - c.x, dz = R.z - c.z, d = Math.hypot(dx, dz);
      const range = c.range * (0.55 + 0.45 * Math.min(1, lit));
      let sees = false;
      if (!this.testGhost && d < range && !inSmoke && Math.abs(angDiff(Math.atan2(dz, dx), s.a)) < c.fov) {
        sees = !losBlocked(L, this, c.x, c.z, R.x, R.z, { low: R.crouch, lowDist: 0.6 });
      }
      if (sees) {
        s.meter += dt * 0.6 * clamp(1.5 - d / range, 0.35, 1.5) * (R.crouch ? 0.75 : 1) * ghost * (0.6 + 0.4 * Math.min(1, lit));
        this.camSeeing = i;
        if (s.meter >= 1) { s.meter = 0; s.cool = this.t + 9; this.ev('cam_spot', i); this.stats.spotted++; this.incident('camera', R.x, R.z); }
      } else s.meter = Math.max(0, s.meter - dt * 0.35);
    }
  }

  stepDoors(dt) {
    const L = this.L, R = this.r;
    const lock = this.lockdown > this.t;
    for (let i = 0; i < L.doors.length; i++) {
      const d = L.doors[i], s = this.doors[i];
      let want = 0;
      if (d.kind === 'swing' || (d.kind === 'entry' && s.picked)) {
        const near = (x, z) => Math.hypot(d.x - x, d.z - z) < 1.35;
        let who = null;
        if (near(R.x, R.z)) who = R;
        if (!who) for (const g of this.guards) if (g.st !== GST.ko && near(g.x, g.z)) { who = g; break; }
        if (who) {
          s.lastNear = this.t;
          if (s.o < 0.05) s.sign = d.horiz ? (who.z < d.z ? 1 : -1) : (who.x < d.x ? 1 : -1);
        }
        want = this.t - s.lastNear < 1.6 ? 1 : 0;
      } else if (d.kind === 'edoor') {
        want = (s.eopen && !lock) || s.gUntil > this.t ? 1 : 0;
      } else if (d.kind === 'vault') want = this.vaultOpen ? 1 : 0;
      const sp = d.kind === 'vault' ? 0.25 : d.kind === 'edoor' ? 2.2 : 2.6;
      s.o += clamp(want - s.o, -sp * dt, sp * dt);
    }
  }

  step(dt, inp, hacker) {
    if (this.phase !== 'play') return;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    this.applyHacker(hacker);
    this.stepRunner(dt, inp || {});
    this.stepDoors(dt);
    // timers
    if (this.lockdown && this.lockdown <= this.t) { this.lockdown = 0; this.ev('lockdown_end'); }
    for (let i = 0; i < this.lasers.length; i++) { const s = this.lasers[i]; if (s.until && s.until <= this.t) { s.until = 0; this.ev('laser_on', i); } }
    for (let i = 0; i < this.rooms.length; i++) { const s = this.rooms[i]; if (s.cut && s.cut <= this.t) { s.cut = 0; this.ev('light_on', i); } }
    this.smoke = this.smoke.filter((s) => s.until > this.t);
    for (const th of this.thrown) if (th.at <= this.t && !th.done) { th.done = true; this.noise(th.x, th.z, 11, 'decoy'); }
    this.thrown = this.thrown.filter((th) => !th.done || this.t - th.at < 2);
    this.stepGuards(dt);
    this.stepCameras(dt);
    // bandwidth + timelock
    const vd = this.L.doors[this.L.vaultDoor];
    const wheel = this.focus && this.focus.kind === 'wheel' && this.focus.ok && this.runnerUse;
    this.timelockActive = wheel && this.hackerHold && this.bw > 0.05;
    if (!this.vaultOpen) {
      if (this.timelockActive) { this.timelock += dt / 8; this.bw = Math.max(0, this.bw - dt * TIMELOCK_BW / 8); }
      else this.timelock = Math.max(0, this.timelock - dt * 0.04);
      if (this.timelock >= 1) {
        this.vaultOpen = true; this.timelock = 1; this.ev('vault_open'); this.noise(vd.x, vd.z, 6, 'vault');
        if (!this.testGhost && this.L.twist === 'silent' && this.police < 0) { this.police = 90 + 15 * (this.up.driver | 0); this.alarm = Math.max(this.alarm, 1); this.ev('police'); }
      }
    }
    if (!this.timelockActive) this.bw = Math.min(this.bwMax, this.bw + this.regen * dt);
    // police
    if (this.police >= 0) {
      this.police -= dt;
      if (this.police <= 0) { this.police = 0; this.end('bust', 'police'); }
    }
    if (this.ping.until && this.ping.until <= this.t) this.ping = { zone: -1, until: 0 };
  }

  end(result, reason) {
    if (this.phase !== 'play') return;
    this.phase = result; this.endReason = reason; this.r.panel = null;
    this.ev('end', result, reason);
  }

  // ---------------- snapshot for the hacker ----------------
  hackerVisibleGuards() {
    const L = this.L, R = this.r, out = [];
    for (const g of this.guards) {
      let vis = false;
      if (Math.hypot(g.x - R.x, g.z - R.z) < 4) vis = true;
      if (!vis && this.ping.until > this.t) { const rm = roomAt(L, g.x, g.z); if (rm > 0 && L.rooms[rm].zone === this.ping.zone) vis = true; }
      if (!vis) { // runner's view
        const dx = g.x - R.x, dz = g.z - R.z, d = Math.hypot(dx, dz);
        if (d < 26 && Math.abs(angDiff(Math.atan2(dz, dx), R.a)) < 0.9 && !losBlocked(L, this, R.x, R.z, g.x, g.z)) vis = true;
      }
      if (!vis) for (let i = 0; i < L.cams.length; i++) {
        const c = L.cams[i];
        if (!this.zoneOn(c.zone) || this.cams[i].st === 2 || this.cams[i].until > this.t && this.cams[i].st !== 1) continue;
        const dx = g.x - c.x, dz = g.z - c.z, d = Math.hypot(dx, dz);
        if (d < c.range && Math.abs(angDiff(Math.atan2(dz, dx), this.cams[i].a)) < c.fov && !losBlocked(L, this, c.x, c.z, g.x, g.z)) { vis = true; break; }
      }
      if (vis) out.push(g);
    }
    return out;
  }

  snapshot() {
    const R = this.r, L = this.L;
    const q = (v) => Math.round(v * 100);
    const P = R.panel ? L.panels[R.panel.id] : null;
    let pn = null;
    if (P) {
      const s = this.panels[P.id];
      pn = { id: P.id, k: P.kind, lock: s.lock > this.t ? Math.ceil(s.lock - this.t) : 0 };
      if (P.kind === 'fuse') { pn.seq = s.seq.map((i) => [s.fuses[i].c, s.fuses[i].n]); pn.step = s.step; pn.left = Math.max(0, Math.ceil(s.deadline - this.t)); }
      if (s.entry) pn.n = s.entry.length;
      if (s.glyphs) pn.len = s.glyphs.length;
    }
    return {
      t: Math.round(this.t * 100), ph: this.phase, er: this.endReason,
      r: [q(R.x), q(R.z), q(R.a), R.crouch ? 1 : R.sprint ? 2 : 0, R.flash ? 1 : 0, q(Math.min(R.lit, 1.5)), Math.round(R.moving * 10)],
      g: this.hackerVisibleGuards().map((g) => [g.id, q(g.x), q(g.z), q(g.a + (g.lookOff || 0)), g.st, Math.round(Math.min(1, g.meter) * 99), this.guardFlashOn(g) ? 1 : 0]),
      c: this.cams.map((s) => s.st * 100 + Math.round(Math.min(1, s.meter) * 99) + (s.until > this.t && s.st !== 1 ? 300 : 0)),
      l: this.lasers.map((s) => (s.st === 2 ? 2 : s.until > this.t ? 1 : 0)),
      d: this.doors.map((s, i) => Math.round(s.o * 9) + (L.doors[i].kind === 'edoor' ? (s.eopen ? 10 : 0) : 0) + (L.doors[i].kind === 'entry' && !s.picked ? 20 : 0)),
      li: this.rooms.map((s, i) => (s.fused ? 3 : s.cut > this.t ? 2 : this.lightOn(i) ? 1 : 0)).join(''),
      z: this.zones, a: this.alarm, pt: this.police >= 0 ? Math.ceil(this.police) : -1, ld: this.lockdown > this.t ? Math.ceil(this.lockdown - this.t) : 0,
      bw: Math.round(this.bw * 10), bm: this.bwMax,
      lt: this.loot.join(''), bag: [R.bag.reduce((s, id) => s + L.loot[id].value, 0), R.bagW, R.cap], sec: this.secured,
      ev: this.events.filter((e) => this.t - e.t < 5).slice(-12).map((e) => [e.id, e.type, ...e.args]),
      pn, tl: Math.round(this.timelock * 100), tla: this.timelockActive ? 1 : 0, vo: this.vaultOpen ? 1 : 0, vp: this.panels[L.vaultPad].done ? 1 : 0,
      sm: this.smoke.map((s) => [q(s.x), q(s.z), q(s.r)]),
      ping: this.ping.until > this.t ? this.ping.zone : -1,
      ack: this.ack,
      cs: this.camSeeing, mm: Math.round((this.maxMeter || 0) * 99),
      gd: [R.g.emp, R.g.smoke, R.g.noise],
      mk: this.mark && this.t - this.mark.t < 20 ? [q(this.mark.x), q(this.mark.z)] : null,
    };
  }

  summary() {
    const L = this.L;
    const taken = this.securedItems.map((id) => L.loot[id]);
    const allTaken = this.loot.every((v) => v === 2);
    return {
      result: this.phase, reason: this.endReason, time: this.t, secured: this.secured,
      items: taken.map((it) => ({ kind: it.kind, value: it.value, primary: !!it.primary })),
      primary: this.primarySecured(), par: L.par,
      ghost: this.stats.spotted === 0 && this.stats.alarms === 0,
      clean: this.stats.alarms === 0 && this.stats.ko === 0,
      fast: this.t <= L.par, full: allTaken, stats: { ...this.stats },
    };
  }
}

export { GST_NAMES, GLYPHS };
