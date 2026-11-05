// Hacker ("the van") view: live blueprint of the building drawn on a 2D canvas,
// plus the van console - bandwidth, network tools, serial console, cipher card,
// fuse sequence, timelock hold and an event log. It only ever sees compact
// snapshots from the runner's authoritative sim and sends back commands.
import { h, txt, cls, sty, money, clock, clear } from './dom.js';
import { T, COST, DUR, FUSE_COLORS, GLYPHS } from '../core/data.js';
import { E_WALL } from '../core/level.js';
import { drawGlyph } from './glyphs.js';
import { roomLabel, panelName } from './hud.js';
import { currentStep, stateFromSnap } from '../core/guide.js';
import { renderPlan } from './plan.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const GS = ['patrol', 'sus', 'alert', 'search', 'inv', 'ko'];
const ZN = (z) => 'Z' + (z + 1);

const SVG = (p) => `<svg viewBox="0 0 24 24">${p}</svg>`;
const TOOLS = [
  { id: 'door', key: '1', name: 'Doors', cost: COST.door, tip: 'Open or close a security door',
    icon: SVG('<rect x="6" y="3" width="12" height="18" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/>') },
  { id: 'laser', key: '2', name: 'Lasers', cost: COST.laser, tip: `Drop a laser grid for ${DUR.laser} s`,
    icon: SVG('<path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2"/>') },
  { id: 'light', key: '3', name: 'Lights', cost: COST.light, tip: `Kill a room's lights for ${DUR.light} s`,
    icon: SVG('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.7"/>') },
  { id: 'loop', key: '4', name: 'Loop cam', cost: COST.loop, tip: `Loop a camera feed for ${DUR.loop} s`,
    icon: SVG('<path d="M3 8h11l4-3v12l-4-3H3z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6 19c2 1.5 5 1.5 7 0" stroke="currentColor" stroke-width="1.6" fill="none"/>') },
  { id: 'ping', key: '5', name: 'Ping', cost: COST.ping, tip: `Reveal every guard in a zone for ${DUR.ping} s`,
    icon: SVG('<circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".6"/>') },
  { id: 'lure', key: '6', name: 'Lure', cost: COST.lure, tip: 'Fake a noise to pull guards into a room',
    icon: SVG('<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>') },
];
const ROOM_TOOLS = { light: 1, ping: 1, lure: 1 };

function segDist(x0, z0, x1, z1, px, pz) {
  const dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz || 1e-9;
  const t = clamp(((px - x0) * dx + (pz - z0) * dz) / l2, 0, 1);
  return Math.hypot(x0 + dx * t - px, z0 + dz * t - pz);
}

export class HackerView {
  constructor(root, L, contract = {}, opts = {}) {
    this.L = L; this.contract = contract; this.opts = opts;
    this.snap = null; this.snapAt = 0; this.simT = 0;
    this.seq = 0; this.pending = []; this.hold = false; this.holdBtn = false; this.holdKey = false;
    this.tool = null; this.hover = null; this.mouse = null;
    this.s = 10; this.ox = 0; this.oy = 0; this.follow = false; this.fitted = false;
    this.dispR = null; this.dispG = new Map(); this.ghosts = new Map();
    this.ripples = []; this.flashes = []; this.lastEv = 0; this.logN = 0;
    this.solved = new Set(); this.vaultUnlocked = false; this.now = 0;
    this.dpr = Math.min(1.25, window.devicePixelRatio || 1);
    this.buildStatic();
    this.buildDom(root);
    this.bind();
    this.resize();
  }

  // ---------------- static geometry (world-space Path2D) ----------------
  buildStatic() {
    const L = this.L, W = L.W, H = L.H;
    const walls = new Path2D();
    for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) {
      if (L.eh[y * W + x] === E_WALL) { walls.moveTo(x * T, y * T); walls.lineTo((x + 1) * T, y * T); }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x <= W; x++) {
      if (L.ev[y * (W + 1) + x] === E_WALL) { walls.moveTo(x * T, y * T); walls.lineTo(x * T, (y + 1) * T); }
    }
    this.walls = walls;
    const furn = new Path2D();
    for (const f of L.furn) if (f.type !== 'van') furn.rect(f.x - f.hx, f.z - f.hz, f.hx * 2, f.hz * 2);
    this.furn = furn;
    this.nZones = L.zones;
  }

  // ---------------- DOM ----------------
  buildDom(root) {
    const L = this.L, el = this.el = {};
    el.cv = h('canvas.hk-cv');
    el.tip = h('div.hk-tip');
    el.zoom = h('div.hk-mapctl', null,
      h('button', { title: 'Zoom in', text: '+', onclick: () => this.zoomBy(1.25) }),
      h('button', { title: 'Zoom out', text: '−', onclick: () => this.zoomBy(0.8) }),
      h('button', { title: 'Fit building', text: 'FIT', onclick: () => { this.follow = false; this.fit(); } }),
      el.followBtn = h('button', { title: 'Follow the runner (F)', text: 'FOLLOW', onclick: () => this.toggleFollow() }));
    el.legend = h('div.hk-legend', { html:
      '<span><i class="lg-runner"></i>Runner</span><span><i class="lg-guard"></i>Guard</span><span><i class="lg-cam"></i>Camera</span>' +
      '<span><i class="lg-laser"></i>Laser</span><span><i class="lg-panel"></i>Panel</span><span><i class="lg-loot"></i>Loot</span>' +
      '<span class="lg-hint">Drag to pan · wheel to zoom · right-click to mark a spot</span>' });
    el.banner = h('div.hk-banner');
    el.map = h('div.hk-map', null, el.cv, el.tip, el.zoom, el.legend, el.banner);

    // top bar
    el.zones = h('div.hk-zones');
    el.zoneChips = [];
    for (let z = 0; z < L.zones; z++) { const c = h('span.hk-zone', { text: ZN(z) }); el.zoneChips.push(c); el.zones.appendChild(c); }
    el.alarm = h('div.hk-alarm', null, h('span.lbl', { text: 'ALERT' }), ...[0, 1, 2].map(() => h('i')));
    el.police = h('div.hk-police');
    el.clock = h('div.hk-clock', { text: '0:00' });
    el.bag = h('div.hk-bagv'); el.sec = h('div.hk-secv');
    el.top = h('div.hk-top', null,
      h('div.hk-brand', null, h('span.hk-dot'), h('div', null, h('b', { text: 'THE VAN' }), h('small', { text: this.contract.name || L.name || 'Inside Job' }))),
      h('div.hk-topmid', null, h('span.hk-tlbl', { text: 'NETWORK' }), el.zones, el.alarm, el.police),
      h('div.hk-topr', null, el.clock, h('div.hk-loot', null, h('small', { text: 'IN BAG' }), el.bag), h('div.hk-loot', null, h('small', { text: 'SECURED' }), el.sec)));

    // side: bandwidth
    el.bwFill = h('i'); el.bwVal = h('span.v');
    el.bw = h('div.hk-card.hk-bw', null, h('div.hk-ch', null, h('span', { text: 'BANDWIDTH' }), el.bwVal), h('div.hk-bwbar', null, el.bwFill, h('div.hk-bwticks')));
    // tools
    el.toolBtns = {};
    const grid = h('div.hk-tools');
    for (const t of TOOLS) {
      const b = h('button.hk-tool', { title: t.tip + ' (' + t.key + ')', onclick: () => this.setTool(this.tool === t.id ? null : t.id) },
        h('span.k', { text: t.key }), h('span.ic', { html: t.icon }), h('span.n', { text: t.name }), h('span.c', { text: t.cost + ' BW' }));
      el.toolBtns[t.id] = b; grid.appendChild(b);
    }
    el.toolHint = h('div.hk-toolhint', { text: 'Click a camera, laser or security door on the map, or pick a tool.' });
    el.toolsCard = h('div.hk-card', null, h('div.hk-ch', null, h('span', { text: 'NETWORK TOOLS' })), grid, el.toolHint);
    // comms / context card
    el.ctxTitle = h('div.hk-ctxt'); el.ctxSub = h('div.hk-ctxs'); el.ctxBody = h('div.hk-ctxb');
    el.ctx = h('div.hk-card.hk-ctx', null, h('div.hk-ch', null, h('span', { text: 'COMMS' }), el.ctxState = h('span.st')), el.ctxTitle, el.ctxSub, el.ctxBody);
    // serial console (kept alive between renders so typing is not lost)
    el.serialIn = h('input.hk-serial', { maxlength: 6, placeholder: 'AB-123', spellcheck: false, autocomplete: 'off',
      oninput: (e) => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); e.target.value = v.length > 2 ? v.slice(0, 2) + '-' + v.slice(2) : v; },
      onkeydown: (e) => { if (e.key === 'Enter') this.submitSerial(); e.stopPropagation(); } });
    el.serialBtn = h('button.hk-btn', { text: 'CONNECT', onclick: () => this.submitSerial() });
    el.serial = h('div.hk-serialrow', null, el.serialIn, el.serialBtn);
    el.holdFill = h('i');
    el.holdBtn = h('button.hk-hold', { onpointerdown: (e) => { e.preventDefault(); this.holdBtn = true; }, onpointerup: () => { this.holdBtn = false; }, onpointerleave: () => { this.holdBtn = false; } },
      el.holdFill, h('span', { text: 'HOLD SPACE' }));
    // cipher card
    el.cipher = h('div.hk-cipher');
    el.cipherCells = [];
    const byDigit = [];
    for (let g = 0; g < 10; g++) byDigit.push([L.cipher[g], g]);
    byDigit.sort((a, b) => a[0] - b[0]);
    for (const [d, g] of byDigit) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      drawGlyph(c.getContext('2d'), g, 32, 32, 50, '#d9f3ff', 7);
      const cell = h('div.hk-cc', { title: GLYPHS[g] }, c, h('b', { text: String(d) }), h('small', { text: GLYPHS[g] }));
      el.cipherCells[g] = cell; el.cipher.appendChild(cell);
    }
    el.cipherCard = h('div.hk-card.hk-ciphercard', null, h('div.hk-ch', null, h('span', { text: 'CIPHER CARD' }), h('span.st', { text: 'symbol → digit' })), el.cipher);
    // log
    el.log = h('div.hk-log');
    el.logCard = h('div.hk-card.hk-logcard', null, h('div.hk-ch', null, h('span', { text: 'EVENTS' })), el.log);
    el.camState = h('span.st', { text: 'AWAITING SIGNAL' });
    el.camImage = h('img.hk-cam-image', { alt: 'Live first-person view from the Runner', hidden: true });
    el.camImage.onload = () => {
      el.camImage.hidden = false;
      txt(el.camState, 'LIVE');
      cls(el.camState, 'live', true);
    };
    el.camImage.onerror = () => this.clearBodycam('SIGNAL ERROR');
    const bodycam = h('details.hk-card.hk-bodycam', { open: true },
      h('summary.hk-ch', null, h('span', { text: 'RUNNER BODYCAM' }), el.camState),
      h('div.hk-cam-screen', null, h('span', { text: 'BODYCAM STANDBY' }), el.camImage));
    // the crew plan: the same step the runner sees, worded for the van
    el.planN = h('span.st');
    el.planNow = h('div.hk-plan-now'); el.planRun = h('div.hk-plan-run');
    el.planList = h('ol.plan');
    el.plan = h('div.hk-card.hk-plan', null, h('div.hk-ch', null, h('span', { text: 'THE PLAN' }), el.planN), el.planNow, el.planRun,
      h('details', { open: this.opts.showPlan !== false }, h('summary', { text: 'ALL STEPS' }), el.planList));
    el.side = h('div.hk-side', null, el.plan, bodycam, el.bw, el.ctx, el.toolsCard, el.cipherCard, el.logCard);

    el.root = h('div.hk', null, el.top, el.map, el.side);
    root.appendChild(el.root);
    this.g = el.cv.getContext('2d');
    this.setTool(null);
    this.ctxKey = '';
  }

  bind() {
    const cv = this.el.cv;
    let down = null;
    this.on = [];
    const add = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); this.on.push([t, ev, fn, o]); };
    add(cv, 'pointerdown', (e) => {
      if (e.button === 2) return;
      down = { x: e.clientX, y: e.clientY, ox: this.ox, oy: this.oy, moved: false, id: e.pointerId };
      try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    add(cv, 'pointermove', (e) => {
      const r = cv.getBoundingClientRect();
      this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.moved && Math.hypot(dx, dy) > 5) { down.moved = true; this.follow = false; cls(this.el.followBtn, 'on', false); }
        if (down.moved) { this.ox = down.ox + dx; this.oy = down.oy + dy; }
      }
    });
    add(cv, 'pointerup', (e) => {
      if (down && !down.moved && e.button === 0) this.click();
      down = null;
    });
    add(cv, 'pointerleave', () => { this.mouse = null; });
    add(cv, 'wheel', (e) => { e.preventDefault(); this.zoomBy(Math.exp(-e.deltaY * 0.0015), this.mouse); }, { passive: false });
    add(cv, 'contextmenu', (e) => {
      e.preventDefault();
      if (this.tool) { this.setTool(null); return; }
      const r = cv.getBoundingClientRect();
      const w = this.toWorld(e.clientX - r.left, e.clientY - r.top);
      this.send('mark', Math.round(w.x * 100) / 100, Math.round(w.z * 100) / 100);
      this.ripples.push({ x: w.x, z: w.z, r: 2.2, t0: this.now, col: '62,224,138', dur: 1.2 });
    });
    add(window, 'keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') { e.preventDefault(); this.holdKey = true; return; }
      if (e.repeat) return;
      const t = TOOLS.find((x) => 'Digit' + x.key === e.code);
      if (t) { this.setTool(this.tool === t.id ? null : t.id); return; }
      if (e.code === 'Escape') this.setTool(null);
      if (e.code === 'KeyF') this.toggleFollow();
      if (e.code === 'Equal' || e.code === 'NumpadAdd') this.zoomBy(1.25);
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.zoomBy(0.8);
      if (e.code === 'Enter' && this.ctxKey.startsWith('junction')) this.el.serialIn.focus();
    });
    add(window, 'keyup', (e) => { if (e.code === 'Space') this.holdKey = false; });
    add(window, 'blur', () => { this.holdKey = false; this.holdBtn = false; });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    if (ro) { ro.observe(this.el.map); this.ro = ro; } else add(window, 'resize', () => this.resize());
  }

  dispose() {
    this.el.camImage.onload = this.el.camImage.onerror = null;
    this.clearBodycam();
    for (const [t, ev, fn, o] of this.on) t.removeEventListener(ev, fn, o);
    if (this.ro) this.ro.disconnect();
    this.el.root.remove();
  }

  clearBodycam(status = 'AWAITING SIGNAL') {
    const { camImage, camState } = this.el;
    if (camImage.hasAttribute('src')) camImage.removeAttribute('src');
    camImage.hidden = true;
    txt(camState, status);
    cls(camState, 'live', false);
  }

  setBodycam(frame) {
    if (frame && Number.isSafeInteger(frame.n) && frame.n > (this.camSeq || 0)) {
      const jpeg = frame.jpeg || (Array.isArray(frame.chunks) && frame.chunks.join(''));
      if (typeof jpeg === 'string' && jpeg.length <= 24000 && jpeg.startsWith('/9j/')) {
        this.camSeq = frame.n;
        this.camAt = performance.now();
        this.el.camImage.src = 'data:image/jpeg;base64,' + jpeg;
      }
    }
    if (this.camAt && performance.now() - this.camAt > 2200) this.clearBodycam('SIGNAL INTERRUPTED');
  }

  resize() {
    const r = this.el.map.getBoundingClientRect();
    const w = Math.max(50, r.width | 0), hh = Math.max(50, r.height | 0);
    if (w === this.w && hh === this.h) return;
    const first = !this.w;
    const cx = this.w ? this.w / 2 : 0, cy = this.h ? this.h / 2 : 0;
    this.w = w; this.h = hh;
    this.el.cv.width = Math.round(w * this.dpr); this.el.cv.height = Math.round(hh * this.dpr);
    if (first || !this.fitted) this.fit(); else { this.ox += w / 2 - cx; this.oy += hh / 2 - cy; }
  }

  fit() {
    const L = this.L, bw = L.W * T, bh = L.H * T;
    this.s = Math.min(this.w / bw, this.h / bh) * 0.94;
    this.ox = (this.w - bw * this.s) / 2; this.oy = (this.h - bh * this.s) / 2;
    this.fitted = true;
  }
  zoomBy(f, at) {
    const p = at || { x: this.w / 2, y: this.h / 2 };
    const w = this.toWorld(p.x, p.y);
    const minS = Math.min(this.w / (this.L.W * T), this.h / (this.L.H * T)) * 0.6;
    this.s = clamp(this.s * f, minS, 70);
    this.ox = p.x - w.x * this.s; this.oy = p.y - w.z * this.s;
  }
  toggleFollow() { this.follow = !this.follow; cls(this.el.followBtn, 'on', this.follow); if (this.follow && this.s < 22) this.zoomBy(22 / this.s); }
  toWorld(x, y) { return { x: (x - this.ox) / this.s, z: (y - this.oy) / this.s }; }
  sx(x) { return this.ox + x * this.s; }
  sy(z) { return this.oy + z * this.s; }

  setTool(id) {
    this.tool = id;
    for (const t of TOOLS) cls(this.el.toolBtns[t.id], 'on', t.id === id);
    const t = TOOLS.find((x) => x.id === id);
    txt(this.el.toolHint, t ? t.tip + ' - click a target on the map. Esc or right-click to cancel.' : 'Click a camera, laser or security door on the map, or pick a tool.');
    cls(this.el.map, 'armed', !!id);
  }

  // ---------------- networking glue ----------------
  send(type, ...args) {
    this.pending.push([++this.seq, type, ...args]);
    if (this.opts.onCommand) this.opts.onCommand();
  }
  // what the transport ships to the runner: every un-acked command (dedup by seq on the runner)
  out() {
    return { cmd: this.pending, hold: this.hold };
  }

  setSnap(snap) {
    if (!snap) return;
    if (this.snap && snap.t < this.snap.t && snap.ph === this.snap.ph) return; // stale/out-of-order
    this.snap = snap; this.snapAt = this.now;
    if (snap.vp) this.vaultUnlocked = true;
    if (snap.ack) this.pending = this.pending.filter((c) => c[0] > snap.ack);
    for (const e of snap.ev) if (e[0] > this.lastEv) { this.lastEv = e[0]; this.onEvent(e[1], e.slice(2)); }
  }

  submitSerial() {
    const s = this.snap, pn = s && s.pn;
    const v = this.el.serialIn.value.replace(/[^A-Z0-9]/gi, '');
    if (!pn || pn.k !== 'junction') { this.log('No runner at a junction port', 'warn'); return; }
    if (v.length < 5) { this.shake(this.el.serial); return; }
    this.send('serial', pn.id, v);
    this.el.serialIn.value = '';
    this.log('Sent serial ' + v.slice(0, 2) + '-' + v.slice(2), 'van');
  }
  shake(e) { e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); }

  // ---------------- derived state helpers ----------------
  zoneOn(z) { return !!(this.snap && z >= 0 && (this.snap.z >> z) & 1); }
  bw() { return this.snap ? this.snap.bw / 10 : 0; }
  camState(i) {
    let v = this.snap ? this.snap.c[i] : 0;
    const emp = v >= 300; if (emp) v -= 300;
    return { st: (v / 100) | 0, meter: (v % 100) / 99, emp };
  }
  camAngle(i) { const c = this.L.cams[i]; return c.a0 + c.amp * Math.sin(TAU * (this.simT / c.per + c.ph)); }
  laserOn(i) {
    const lz = this.L.lasers[i], st = this.snap ? this.snap.l[i] : 0;
    if (st) return false;
    if (lz.kind === 'pulse') { const per = lz.on + lz.off; const ph = ((this.simT / per + lz.ph) % 1 + 1) % 1; return ph < lz.on / per; }
    return true;
  }
  doorState(i) {
    let v = this.snap ? this.snap.d[i] : 0;
    const locked = v >= 20; if (locked) v -= 20;
    const eopen = v >= 10; if (eopen) v -= 10;
    return { o: v / 9, eopen, locked };
  }
  roomAt(wx, wz) {
    const L = this.L, x = Math.floor(wx / T), y = Math.floor(wz / T);
    if (x < 0 || y < 0 || x >= L.W || y >= L.H) return -1;
    return L.cell[y * L.W + x];
  }

  // what a click at world (wx,wz) would do with the current tool
  targetAt(wx, wz) {
    const L = this.L, s = this.snap, tool = this.tool, pr = 0.55 + 7 / this.s;
    if (!s) return null;
    const bw = this.bw();
    const off = (z) => `${ZN(z)} offline - the runner has to patch its junction first`;
    const want = (t) => !tool || tool === t;
    const finish = (o) => {
      if (o.cost && o.ok && bw + 1e-6 < o.cost) { o.ok = false; o.why = 'Not enough bandwidth'; }
      return o;
    };
    // cameras
    if (want('loop')) {
      let best = -1, bd = pr + 0.2;
      for (let i = 0; i < L.cams.length; i++) { const c = L.cams[i], d = Math.hypot(c.x - wx, c.z - wz); if (d < bd) { bd = d; best = i; } }
      if (best >= 0) {
        const c = L.cams[best], cs = this.camState(best);
        const o = { kind: 'cam', id: best, x: c.x, z: c.z, act: 'loop', label: 'Loop camera', cost: COST.loop, ok: true };
        if (!this.zoneOn(c.zone)) { o.ok = false; o.why = off(c.zone); } else if (cs.st === 2) { o.ok = false; o.why = 'Camera is dead (fuse pulled)'; } else if (cs.st === 1) { o.label = 'Extend loop'; }
        return finish(o);
      }
    }
    if (want('door')) {
      let best = -1, bd = pr + 0.3;
      for (let i = 0; i < L.doors.length; i++) { const d = L.doors[i]; if (d.kind !== 'edoor') continue; const dd = Math.hypot(d.x - wx, d.z - wz); if (dd < bd) { bd = dd; best = i; } }
      if (best >= 0) {
        const d = L.doors[best], ds = this.doorState(best);
        const o = { kind: 'door', id: best, x: d.x, z: d.z, act: 'door', label: ds.eopen ? 'Close security door' : 'Open security door', cost: COST.door, ok: true };
        if (!this.zoneOn(d.ctrl)) { o.ok = false; o.why = off(d.ctrl); } else if (s.ld) { o.ok = false; o.why = 'Lockdown - doors sealed for ' + s.ld + ' s'; }
        return finish(o);
      }
    }
    if (want('laser')) {
      let best = -1, bd = pr * 0.8;
      for (let i = 0; i < L.lasers.length; i++) { const z = L.lasers[i], d = segDist(z.x1, z.z1, z.x2, z.z2, wx, wz); if (d < bd) { bd = d; best = i; } }
      if (best >= 0) {
        const lz = L.lasers[best], st = s.l[best];
        const o = { kind: 'laser', id: best, x: (lz.x1 + lz.x2) / 2, z: (lz.z1 + lz.z2) / 2, act: 'laser', label: 'Drop laser grid', cost: COST.laser, ok: true };
        if (st === 2) { o.ok = false; o.why = 'Already disarmed'; } else if (!lz.net) { o.ok = false; o.why = 'Hardwired - runner must use the keypad'; } else if (!this.zoneOn(lz.zone)) { o.ok = false; o.why = off(lz.zone); }
        return finish(o);
      }
    }
    if (!tool) {
      // info-only hovers
      for (let i = 0; i < L.panels.length; i++) { const p = L.panels[i]; if (Math.hypot(p.x - wx, p.z - wz) < pr) return { kind: 'panel', id: i, x: p.x, z: p.z, info: this.panelInfo(i) }; }
    }
    const rid = this.roomAt(wx, wz);
    if (rid < 0) return null;
    const r = L.rooms[rid];
    const name = rid === 0 ? 'Street' : roomLabel(L, rid).replace(/^the /, '');
    const cx = (r.x + r.w / 2) * T, cz = (r.y + r.h / 2) * T;
    if (!tool || !ROOM_TOOLS[tool]) return { kind: 'room', id: rid, x: cx, z: cz, info: cap(name) + (r.zone >= 0 ? ' · ' + ZN(r.zone) + (this.zoneOn(r.zone) ? ' online' : ' offline') : ''), hint: !tool && rid !== 0 ? 'Pick Lights, Ping or Lure (3 · 5 · 6)' : '' };
    const o = { kind: 'room', id: rid, x: cx, z: cz, act: tool, cost: COST[tool], ok: true };
    if (rid === 0) { o.ok = false; o.why = 'Not on the building network'; o.label = cap(name); return o; }
    if (tool === 'light') { o.label = 'Kill lights - ' + name; if (!this.zoneOn(r.zone)) { o.ok = false; o.why = off(r.zone); } else if (s.li[rid] !== '1') { o.ok = false; o.why = 'Lights already off here'; } }
    if (tool === 'lure') { o.label = 'Noise lure - ' + name; if (!this.zoneOn(r.zone)) { o.ok = false; o.why = off(r.zone); } }
    if (tool === 'ping') { o.label = 'Ping ' + ZN(r.zone) + ' for guards'; o.zone = r.zone; if (!this.zoneOn(r.zone)) { o.ok = false; o.why = off(r.zone); } }
    return finish(o);
  }

  panelInfo(i) {
    const p = this.L.panels[i], s = this.snap;
    const where = roomLabel(this.L, p.room != null ? p.room : this.roomAt(p.x, p.z));
    let st = '';
    if (p.kind === 'junction') st = this.zoneOn(p.zone) ? 'connected' : 'serial needed';
    else if (p.kind === 'keypad') st = s && s.l[p.laser] === 2 ? 'solved' : 'cipher code';
    else if (p.kind === 'vaultpad') st = this.vaultUnlocked ? 'solved' : 'cipher code';
    else st = this.solved.has(i) ? 'done' : 'fuse order';
    const extra = p.kind === 'junction' ? ' · ' + ZN(p.zone) : p.kind === 'fuse' ? ' · cuts ' + (p.effect === 'cams' ? 'cameras' : 'lights') + ' in ' + ZN(p.target) : '';
    return cap(panelName(p)) + extra + ' · ' + where + ' · ' + st;
  }

  click() {
    if (!this.mouse) return;
    const w = this.toWorld(this.mouse.x, this.mouse.y);
    const t = this.targetAt(w.x, w.z);
    if (!t || !t.act) return;
    if (!t.ok) { this.log(t.why, 'warn'); this.flashes.push({ x: t.x, z: t.z, t0: this.now, bad: true }); return; }
    if (t.act === 'loop') this.send('loop', t.id);
    else if (t.act === 'door') this.send('door', t.id);
    else if (t.act === 'laser') this.send('laser', t.id);
    else if (t.act === 'light') this.send('light', t.id);
    else if (t.act === 'lure') this.send('lure', t.id);
    else if (t.act === 'ping') this.send('ping', t.zone);
    this.flashes.push({ x: t.x, z: t.z, t0: this.now });
    if (ROOM_TOOLS[t.act] || t.act === 'laser') this.setTool(null);
  }

  // ---------------- events → log, ripples ----------------
  log(text, kind = '') {
    const s = this.snap;
    const row = h('div.hk-ev' + (kind ? '.' + kind : ''), null, h('span.t', { text: clock(s ? s.t / 100 : 0) }), h('span', { text }));
    this.el.log.insertBefore(row, this.el.log.firstChild);
    if (++this.logN > 60) { this.el.log.lastChild.remove(); this.logN--; }
  }
  bannerMsg(text, kind) {
    const b = this.el.banner; txt(b, text); b.className = 'hk-banner show ' + (kind || '');
    clearTimeout(this.bt); this.bt = setTimeout(() => { b.className = 'hk-banner'; }, 2600);
  }

  onEvent(type, a) {
    const L = this.L;
    const rl = (id) => roomLabel(L, id);
    const P = (id) => L.panels[id];
    switch (type) {
      case 'zone': this.log(ZN(a[0]) + ' networked - devices online', 'good'); this.bannerMsg(ZN(a[0]) + ' ONLINE', 'good'); break;
      case 'serial_noport': this.log('Runner has to be at the junction port first', 'warn'); break;
      case 'serial_locked': this.log('Port locked - wait for it to reset', 'warn'); break;
      case 'wrong': {
        const k = a[1];
        this.log(k === 'serial' ? 'Wrong serial - port locked 10 s' : k === 'fuse' ? 'Wrong fuse pulled - breaker tripped' : k === 'fuse_time' ? 'Fuse box timed out' : 'Wrong keypad code - locked 10 s', 'bad');
        if (a[2] === 1) this.log('One more mistake on that panel trips an alarm', 'warn');
        const p = P(a[0]); if (p) this.flashes.push({ x: p.x, z: p.z, t0: this.now, bad: true });
        break;
      }
      case 'solved': this.solved.add(a[0]); { const p = P(a[0]); this.log(p.kind === 'keypad' ? 'Keypad solved - laser grid disarmed' : p.kind === 'vaultpad' ? 'Vault keypad solved' : 'Fuse box bypassed', 'good'); } break;
      case 'fuse_cams': this.log('Cameras in ' + ZN(a[0]) + ' are dead', 'good'); break;
      case 'fuse_lights': this.log('Lights in ' + ZN(a[0]) + ' are dead', 'good'); break;
      case 'vault_unlocked': this.vaultUnlocked = true; this.log('Vault seal released - timelock next. Runner on the wheel, you hold SPACE.', 'good'); this.bannerMsg('TIMELOCK: HOLD SPACE WITH THE RUNNER', 'good'); break;
      case 'vault_open': this.log('VAULT OPEN', 'good'); this.bannerMsg('VAULT OPEN', 'good'); break;
      case 'panel_open': { const p = P(a[0]); this.log('Runner opened the ' + panelName(p) + ' in ' + rl(this.roomAt(p.x, p.z)), 'van'); break; }
      case 'alarm': this.log('ALERT LEVEL ' + a[0] + ' (' + (a[1] || 'incident') + ')', 'bad'); this.bannerMsg('ALERT LEVEL ' + a[0] + ' / 3', 'bad'); break;
      case 'lockdown': this.log('Lockdown - security doors sealed', 'bad'); break;
      case 'lockdown_end': this.log('Lockdown lifted', 'good'); break;
      case 'police': this.log('Police dispatched', 'bad'); this.bannerMsg('POLICE EN ROUTE', 'bad'); break;
      case 'reinforce': this.log('Backup guard entered through the front', 'bad'); break;
      case 'laser_trip': this.log('Runner tripped a laser', 'bad'); break;
      case 'cam_spot': this.log('Camera spotted the runner', 'bad'); { const c = L.cams[a[0]]; if (c) this.flashes.push({ x: c.x, z: c.z, t0: this.now, bad: true }); } break;
      case 'alert': this.log('A guard spotted the runner!', 'bad'); break;
      case 'sus': break;
      case 'lost': this.log('Guard lost the runner - searching', 'warn'); break;
      case 'body': this.log('A guard found a body', 'bad'); break;
      case 'radio': this.log('Guard radioed it in', 'bad'); break;
      case 'ko': this.log('Runner took down a guard', 'warn'); this.ghosts.delete(a[0]); break;
      case 'grab': this.log('Runner bagged loot', 'loot'); break;
      case 'secure': this.log('Bag dropped in the van: ' + money(a[1]), 'loot'); break;
      case 'picked': this.log('Side door picked - runner is inside', 'good'); break;
      case 'nobw': this.log('Out of bandwidth', 'warn'); this.shake(this.el.bw); break;
      case 'loop': this.log('Camera looped', 'van'); break;
      case 'loop_end': this.log('Camera loop ended', 'warn'); break;
      case 'laser': this.log('Laser grid down for ' + DUR.laser + ' s', 'van'); break;
      case 'laser_on': if (L.lasers[a[0]] && this.snap && this.snap.l[a[0]] !== 2) this.log('Laser grid back on', 'warn'); break;
      case 'light': this.log('Lights cut in ' + rl(a[0]), 'van'); break;
      case 'light_on': break;
      case 'door': this.log('Security door ' + (a[1] ? 'opened' : 'closed'), 'van'); break;
      case 'door_lockdown': this.log('Doors are sealed during lockdown', 'warn'); break;
      case 'lure': this.log('Noise lure in ' + rl(a[0]), 'van'); break;
      case 'ping': this.log('Pinging ' + ZN(a[0]), 'van'); break;
      case 'emp': this.log('Runner set off an EMP', 'van'); this.ripples.push({ x: a[0] / 10, z: a[1] / 10, r: 6, t0: this.now, col: '79,209,255', dur: 1.2 }); break;
      case 'smoke': this.log('Runner popped smoke', 'van'); break;
      case 'noise': if (a[3] !== 'step') this.ripples.push({ x: a[0] / 10, z: a[1] / 10, r: a[2], t0: this.now, col: a[3] === 'lure' || a[3] === 'decoy' ? '79,209,255' : '255,182,72', dur: 1.4 }); break;
      case 'mark': break;
      case 'end': this.log(a[0] === 'win' ? 'Crew got away clean' : 'Busted', a[0] === 'win' ? 'good' : 'bad'); break;
      default:
    }
  }

  // ---------------- per-frame ----------------
  frame(dt) {
    this.now += dt;
    const s = this.snap;
    const hold = this.holdKey || this.holdBtn;
    if (hold !== this.hold) { this.hold = hold; if (this.opts.onCommand) this.opts.onCommand(); }
    if (s) this.simT = s.t / 100 + Math.min(0.25, this.now - this.snapAt);
    if (this.domAt == null || this.now >= this.domAt) {
      this.updateDom();
      this.domAt = this.now + 1 / 32;
    }
    this.draw(dt);
  }

  updateDom() {
    const s = this.snap, el = this.el, L = this.L;
    if (!s) return;
    // top
    for (let z = 0; z < el.zoneChips.length; z++) cls(el.zoneChips[z], 'on', this.zoneOn(z));
    const pips = el.alarm.querySelectorAll('i');
    for (let i = 0; i < 3; i++) cls(pips[i], 'on', s.a > i);
    txt(el.police, s.pt >= 0 ? 'POLICE ' + clock(s.pt) : s.ld ? 'LOCKDOWN ' + s.ld + 's' : '');
    cls(el.police, 'show', s.pt >= 0 || s.ld > 0);
    txt(el.clock, clock(s.t / 100));
    txt(el.bag, money(s.bag[0]) + '  ·  ' + s.bag[1] + '/' + s.bag[2]);
    txt(el.sec, money(s.sec));
    // bandwidth
    const bw = s.bw / 10;
    sty(el.bwFill, 'width', (100 * bw / s.bm).toFixed(1) + '%');
    txt(el.bwVal, bw.toFixed(1) + ' / ' + s.bm);
    cls(el.bw, 'drain', !!s.tla);
    for (const t of TOOLS) cls(el.toolBtns[t.id], 'poor', bw + 1e-6 < t.cost);
    // crew plan
    const st = this.step = s.ph === 'play' ? currentStep(L, stateFromSnap(L, s)) : null;
    if (st) {
      txt(el.planN, st.done ? 'DONE' : 'STEP ' + (st.n + 1) + '/' + st.total);
      txt(el.planNow, st.hacker);
      if (el.planRun._t !== st.runner) { el.planRun._t = st.runner; clear(el.planRun).append(h('b', { text: 'Runner: ' }), st.runner); }
      cls(el.plan, 'alert', !!st.alert);
      renderPlan(el.planList, st);
      if (this.lastStepN !== st.n) {
        if (this.lastStepN != null) { el.plan.classList.remove('flash'); void el.plan.offsetWidth; el.plan.classList.add('flash'); }
        this.lastStepN = st.n;
      }
    }
    // context card
    const pn = s.pn;
    let key = 'idle';
    if (pn) key = pn.k + ':' + pn.id;
    else if (this.vaultUnlocked && !s.vo) key = 'timelock';
    if (key !== this.ctxKey) this.buildCtx(key);
    this.updateCtx();
  }

  buildCtx(key) {
    const el = this.el, L = this.L, s = this.snap;
    this.ctxKey = key;
    clear(el.ctxBody);
    cls(el.ctx, 'hot', key !== 'idle');
    cls(el.cipherCard, 'hot', /^(keypad|vaultpad)/.test(key));
    const pn = s.pn;
    if (key === 'idle') {
      txt(el.ctxTitle, 'Runner on the move');
      txt(el.ctxSub, 'Watch the guards they cannot see. Call out cameras, timing and routes.');
      el.ctxBody.appendChild(el.runnerLine = h('div.hk-rline'));
      return;
    }
    if (key === 'timelock') {
      txt(el.ctxTitle, 'Vault timelock');
      txt(el.ctxSub, 'Runner holds the wheel, you hold SPACE (drains bandwidth). Both together.');
      el.ctxBody.appendChild(el.holdBtn);
      return;
    }
    const p = L.panels[pn.id];
    const where = roomLabel(L, this.roomAt(p.x, p.z));
    if (pn.k === 'junction') {
      txt(el.ctxTitle, 'Network junction · ' + ZN(p.zone));
      txt(el.ctxSub, 'Runner reads the serial off the label - type it in.');
      el.ctxBody.appendChild(el.serial);
      setTimeout(() => { try { el.serialIn.focus(); } catch { /* ignore */ } }, 0);
    } else if (pn.k === 'keypad' || pn.k === 'vaultpad') {
      txt(el.ctxTitle, (pn.k === 'vaultpad' ? 'Vault keypad' : 'Laser keypad') + ' · ' + where);
      txt(el.ctxSub, 'Runner describes each symbol. Read back the digit from the cipher card.');
      el.ctxBody.appendChild(el.keyProg = h('div.hk-keyprog'));
    } else if (pn.k === 'fuse') {
      txt(el.ctxTitle, 'Fuse box · ' + where);
      txt(el.ctxSub, 'Tell the runner which fuses to pull, in this exact order:');
      el.fuseRow = h('div.hk-fuses');
      el.fuseChips = (pn.seq || []).map(([c, n], i) => {
        const chip = h('div.hk-fuse', null, h('i', { style: { background: FUSE_COLORS[c].css } }), h('b', { text: String(n) }), h('small', { text: FUSE_COLORS[c].id }));
        chip.dataset.i = i; el.fuseRow.appendChild(chip); return chip;
      });
      el.ctxBody.appendChild(el.fuseRow);
    }
    el.ctxBody.appendChild(el.lockLine = h('div.hk-lock'));
  }

  updateCtx() {
    const el = this.el, s = this.snap, pn = s.pn, key = this.ctxKey;
    if (key === 'idle' && el.runnerLine) {
      const r = s.r;
      const st = r[3] === 1 ? 'Crouched' : r[3] === 2 ? 'Sprinting' : r[6] > 3 ? 'Walking' : 'Still';
      txt(el.runnerLine, st + ' · ' + (r[5] > 45 ? 'in the light' : 'in shadow') + ' · ' + cap(roomLabel(this.L, this.roomAt(r[0] / 100, r[1] / 100)).replace(/^the /, '')));
      txt(el.ctxState, '');
      return;
    }
    if (key === 'timelock') {
      sty(el.holdFill, 'width', s.tl + '%');
      cls(el.holdBtn, 'on', this.hold);
      cls(el.holdBtn, 'live', !!s.tla);
      txt(el.ctxState, s.tla ? 'CRACKING' : this.hold ? 'WAITING FOR RUNNER' : '');
      return;
    }
    if (!pn) return;
    txt(el.ctxState, pn.lock ? 'LOCKED ' + pn.lock + 's' : 'LIVE');
    cls(el.ctxState, 'bad', !!pn.lock);
    txt(el.lockLine, pn.lock ? 'Panel locked after a mistake - resets in ' + pn.lock + ' s' : '');
    if (pn.k === 'junction') { el.serialIn.disabled = !!pn.lock; el.serialBtn.disabled = !!pn.lock; }
    if (el.keyProg && (pn.k === 'keypad' || pn.k === 'vaultpad')) {
      const n = pn.n || 0, len = pn.len || 0;
      if (el.keyProg.childNodes.length !== len) { clear(el.keyProg); for (let i = 0; i < len; i++) el.keyProg.appendChild(h('i')); }
      el.keyProg.childNodes.forEach((c, i) => cls(c, 'on', i < n));
    }
    if (pn.k === 'fuse' && el.fuseChips) {
      el.fuseChips.forEach((c, i) => { cls(c, 'done', i < pn.step); cls(c, 'next', i === pn.step); });
      if (!pn.lock) txt(el.lockLine, pn.left != null ? pn.left + ' s before the breaker trips' : '');
    }
  }

  // ---------------- drawing ----------------
  draw(dt) {
    const g = this.g, L = this.L, s = this.snap, dpr = this.dpr;
    const W = this.w, H = this.h;
    // smooth runner + guards
    if (s) {
      const k = 1 - Math.exp(-dt * 16);
      const tr = { x: s.r[0] / 100, z: s.r[1] / 100, a: s.r[2] / 100 };
      if (!this.dispR || Math.hypot(tr.x - this.dispR.x, tr.z - this.dispR.z) > 4) this.dispR = { ...tr };
      else { this.dispR.x += (tr.x - this.dispR.x) * k; this.dispR.z += (tr.z - this.dispR.z) * k; this.dispR.a += angD(tr.a, this.dispR.a) * k; }
      const seen = new Set();
      for (const gg of s.g) {
        const id = gg[0]; seen.add(id);
        const t = { x: gg[1] / 100, z: gg[2] / 100, a: gg[3] / 100 };
        let d = this.dispG.get(id);
        if (!d || Math.hypot(t.x - d.x, t.z - d.z) > 4) { d = { ...t }; this.dispG.set(id, d); }
        else { d.x += (t.x - d.x) * k; d.z += (t.z - d.z) * k; d.a += angD(t.a, d.a) * k; }
        d.st = gg[4]; d.m = gg[5] / 99; d.fl = gg[6];
        this.ghosts.delete(id);
      }
      for (const [id, d] of this.dispG) if (!seen.has(id)) { this.dispG.delete(id); if (d.st !== 5) this.ghosts.set(id, { ...d, t0: this.now }); }
      for (const [id, gh] of this.ghosts) if (this.now - gh.t0 > 10) this.ghosts.delete(id);
      if (this.follow && this.dispR) {
        const tx = W / 2 - this.dispR.x * this.s, ty = H / 2 - this.dispR.z * this.s;
        this.ox += (tx - this.ox) * (1 - Math.exp(-dt * 6)); this.oy += (ty - this.oy) * (1 - Math.exp(-dt * 6));
      }
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#060b14'; g.fillRect(0, 0, W, H);
    // blueprint grid
    const step = T * this.s;
    if (step > 7) {
      g.strokeStyle = 'rgba(80,140,210,0.06)'; g.lineWidth = 1; g.beginPath();
      for (let x = ((this.ox % step) + step) % step; x < W; x += step) { g.moveTo(x | 0, 0); g.lineTo(x | 0, H); }
      for (let y = ((this.oy % step) + step) % step; y < H; y += step) { g.moveTo(0, y | 0); g.lineTo(W, y | 0); }
      g.stroke();
    }
    if (!s) return;
    const S = this.s;
    const world = () => g.setTransform(dpr * S, 0, 0, dpr * S, dpr * this.ox, dpr * this.oy);
    const screen = () => g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const px = 1 / S; // one screen pixel in world units
    const pulse = 0.5 + 0.5 * Math.sin(this.now * 5);
    world();
    // rooms
    for (const r of L.rooms) {
      const x = r.x * T, y = r.y * T, w = r.w * T, hh = r.h * T;
      if (r.id === 0) { g.fillStyle = '#0a1018'; g.fillRect(x, y, w, hh); continue; }
      const on = this.zoneOn(r.zone);
      g.fillStyle = on ? '#0e2130' : '#0c1522'; g.fillRect(x, y, w, hh);
      const li = s.li[r.id];
      if (li === '1') { g.fillStyle = 'rgba(255,205,140,0.075)'; g.fillRect(x, y, w, hh); }
      else if (li === '2') { g.fillStyle = 'rgba(79,209,255,0.06)'; g.fillRect(x, y, w, hh); }
      else { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y, w, hh); }
      if (r.id === L.vaultRoom) { g.strokeStyle = 'rgba(233,196,106,0.35)'; g.lineWidth = 3 * px; g.strokeRect(x + 4 * px, y + 4 * px, w - 8 * px, hh - 8 * px); }
    }
    // ping highlight
    if (s.ping >= 0) {
      g.fillStyle = `rgba(79,209,255,${0.06 + 0.06 * pulse})`;
      for (const r of L.rooms) if (r.zone === s.ping && r.id) g.fillRect(r.x * T, r.y * T, r.w * T, r.h * T);
    }
    // furniture
    g.fillStyle = 'rgba(130,170,220,0.10)'; g.fill(this.furn);
    g.strokeStyle = 'rgba(130,170,220,0.22)'; g.lineWidth = px; g.stroke(this.furn);
    // van
    { const v = L.van; g.fillStyle = 'rgba(62,224,138,0.16)'; g.strokeStyle = 'rgba(62,224,138,0.7)'; g.lineWidth = 1.5 * px; rr(g, v.x - 2.75, v.z - 1.12, 5.5, 2.24, 0.4); g.fill(); g.stroke(); }
    // walls
    g.lineCap = 'square';
    g.strokeStyle = 'rgba(30,60,100,0.9)'; g.lineWidth = Math.max(0.22, 5 * px); g.stroke(this.walls);
    g.strokeStyle = '#8fb8e6'; g.lineWidth = Math.max(0.07, 1.6 * px); g.stroke(this.walls);
    // doors
    for (let i = 0; i < L.doors.length; i++) {
      const d = L.doors[i], ds = this.doorState(i);
      const hw = d.width / 2 - 0.08;
      let col = 'rgba(160,180,205,0.55)', w = 2.2;
      if (d.kind === 'edoor') { col = s.ld && this.zoneOn(d.ctrl) ? '#ff4b3e' : ds.eopen ? '#3ee08a' : this.zoneOn(d.ctrl) ? '#4fd1ff' : '#6b7a8c'; w = 4; }
      else if (d.kind === 'entry') { col = ds.locked ? '#ffb648' : '#3ee08a'; w = 3.5; }
      else if (d.kind === 'vault') { col = s.vo ? '#3ee08a' : '#e9c46a'; w = 5; }
      g.strokeStyle = col; g.lineWidth = w * px; g.globalAlpha = d.kind === 'swing' ? 1 : 1 - 0.55 * ds.o;
      g.beginPath();
      if (d.horiz) { g.moveTo(d.x - hw, d.z); g.lineTo(d.x + hw, d.z); } else { g.moveTo(d.x, d.z - hw); g.lineTo(d.x, d.z + hw); }
      if (d.kind === 'swing' && ds.o > 0.1) g.setLineDash([3 * px, 3 * px]);
      g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
    // lasers
    for (let i = 0; i < L.lasers.length; i++) {
      const lz = L.lasers[i], st = s.l[i], on = this.laserOn(i);
      g.lineCap = 'round';
      if (st === 2) { g.strokeStyle = 'rgba(120,130,145,0.35)'; g.lineWidth = 1.2 * px; g.setLineDash([2 * px, 4 * px]); }
      else if (st === 1) { g.strokeStyle = 'rgba(79,209,255,0.7)'; g.lineWidth = 1.5 * px; g.setLineDash([5 * px, 4 * px]); }
      else if (!on) { g.strokeStyle = 'rgba(255,75,62,0.25)'; g.lineWidth = 1.5 * px; g.setLineDash([2 * px, 3 * px]); }
      else {
        g.strokeStyle = 'rgba(255,60,50,0.25)'; g.lineWidth = 7 * px; g.beginPath(); g.moveTo(lz.x1, lz.z1); g.lineTo(lz.x2, lz.z2); g.stroke();
        g.strokeStyle = '#ff5a4a'; g.lineWidth = 1.8 * px;
      }
      g.beginPath(); g.moveTo(lz.x1, lz.z1); g.lineTo(lz.x2, lz.z2); g.stroke(); g.setLineDash([]);
    }
    // cameras
    for (let i = 0; i < L.cams.length; i++) {
      const c = L.cams[i], cs = this.camState(i), a = cs.st === 2 ? c.a0 : this.camAngle(i);
      if (cs.st !== 2 && !cs.emp) {
        const looped = cs.st === 1, r = c.range;
        const grd = g.createRadialGradient(c.x, c.z, 0, c.x, c.z, r);
        const col = looped ? '79,209,255' : cs.meter > 0.02 ? '255,90,60' : '255,120,90';
        const al = looped ? 0.10 : 0.12 + 0.3 * cs.meter;
        grd.addColorStop(0, `rgba(${col},${al})`); grd.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = grd; g.beginPath(); g.moveTo(c.x, c.z); g.arc(c.x, c.z, r, a - c.fov, a + c.fov); g.closePath(); g.fill();
        if (looped) { g.strokeStyle = 'rgba(79,209,255,0.5)'; g.lineWidth = px; g.setLineDash([4 * px, 4 * px]); g.stroke(); g.setLineDash([]); }
      }
      g.fillStyle = cs.st === 2 || cs.emp ? '#4b5563' : cs.st === 1 ? '#4fd1ff' : '#ff6a55';
      g.beginPath(); g.arc(c.x, c.z, Math.max(0.22, 4 * px), 0, TAU); g.fill();
      g.strokeStyle = '#06101c'; g.lineWidth = 1.2 * px; g.stroke();
      if (!this.zoneOn(c.zone) && cs.st !== 2) { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(c.x, c.z, Math.max(0.36, 6.5 * px), 0, TAU); g.stroke(); }
    }
    // panels
    const pn = s.pn;
    for (let i = 0; i < L.panels.length; i++) {
      const p = L.panels[i];
      const done = p.kind === 'junction' ? this.zoneOn(p.zone) : p.kind === 'keypad' ? s.l[p.laser] === 2 : p.kind === 'vaultpad' ? this.vaultUnlocked : this.solved.has(i);
      const col = done ? '#3ee08a' : p.kind === 'junction' ? '#4fd1ff' : p.kind === 'fuse' ? '#f0802a' : p.kind === 'vaultpad' ? '#e9c46a' : '#ff6a55';
      const r = Math.max(0.28, 6 * px);
      g.save(); g.translate(p.x, p.z); g.rotate(Math.PI / 4);
      g.fillStyle = '#06101c'; g.fillRect(-r, -r, 2 * r, 2 * r);
      g.strokeStyle = col; g.lineWidth = 1.6 * px; g.strokeRect(-r, -r, 2 * r, 2 * r);
      g.restore();
      if (pn && pn.id === i) { g.strokeStyle = `rgba(62,224,138,${0.4 + 0.5 * pulse})`; g.lineWidth = 2 * px; g.beginPath(); g.arc(p.x, p.z, r * 2 + pulse * 6 * px, 0, TAU); g.stroke(); }
    }
    // loot
    for (let i = 0; i < L.loot.length; i++) {
      if (s.lt[i] !== '0') continue;
      const it = L.loot[i], r = Math.max(0.12, (it.primary ? 4.5 : 2.6) * px);
      g.fillStyle = it.primary ? '#ffd166' : 'rgba(233,196,106,0.85)';
      g.beginPath(); g.moveTo(it.x, it.z - r); g.lineTo(it.x + r, it.z); g.lineTo(it.x, it.z + r); g.lineTo(it.x - r, it.z); g.closePath(); g.fill();
      if (it.primary) { g.strokeStyle = `rgba(255,209,102,${0.3 + 0.4 * pulse})`; g.lineWidth = 1.5 * px; g.beginPath(); g.arc(it.x, it.z, r * 2.4, 0, TAU); g.stroke(); }
    }
    // smoke
    for (const sm of s.sm) { g.fillStyle = 'rgba(180,190,200,0.22)'; g.beginPath(); g.arc(sm[0] / 100, sm[1] / 100, sm[2] / 100, 0, TAU); g.fill(); }
    // ripples
    this.ripples = this.ripples.filter((rp) => this.now - rp.t0 < rp.dur);
    for (const rp of this.ripples) {
      const k = (this.now - rp.t0) / rp.dur;
      g.strokeStyle = `rgba(${rp.col},${(1 - k) * 0.8})`; g.lineWidth = 2 * px;
      g.beginPath(); g.arc(rp.x, rp.z, rp.r * (0.15 + 0.85 * k), 0, TAU); g.stroke();
    }
    // next step of the plan: a beacon the van guides the runner to
    const tg = this.step && this.step.target;
    if (tg) {
      const k = (this.now * 0.8) % 1, rad = Math.max(0.9, 16 * px);
      g.strokeStyle = `rgba(255,182,72,${0.9 * (1 - k)})`; g.lineWidth = 2.5 * px;
      g.beginPath(); g.arc(tg.x, tg.z, rad * (0.5 + 1.3 * k), 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,182,72,0.95)'; g.lineWidth = 2 * px;
      g.beginPath(); g.arc(tg.x, tg.z, rad * 0.55, 0, TAU); g.stroke();
    }
    // ghosts (last seen guards)
    for (const gh of this.ghosts.values()) {
      const k = 1 - (this.now - gh.t0) / 10;
      g.globalAlpha = 0.5 * k;
      g.strokeStyle = '#ffb648'; g.lineWidth = 1.2 * px; g.setLineDash([3 * px, 3 * px]);
      g.beginPath(); g.arc(gh.x, gh.z, 0.36, 0, TAU); g.stroke(); g.setLineDash([]);
      g.globalAlpha = 1;
    }
    // guards
    for (const [, d] of this.dispG) {
      if (d.st === 5) {
        g.strokeStyle = '#6b7a8c'; g.lineWidth = 2 * px; const r = 0.28;
        g.beginPath(); g.moveTo(d.x - r, d.z - r); g.lineTo(d.x + r, d.z + r); g.moveTo(d.x + r, d.z - r); g.lineTo(d.x - r, d.z + r); g.stroke();
        continue;
      }
      const alert = d.st === 2, col = alert ? '255,75,62' : d.st === 1 || d.st === 3 || d.st === 4 ? '255,150,60' : '255,190,90';
      const R = d.fl ? 9.5 : 7.5;
      const grd = g.createRadialGradient(d.x, d.z, 0, d.x, d.z, R);
      grd.addColorStop(0, `rgba(${col},${0.22 + 0.25 * d.m})`); grd.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grd; g.beginPath(); g.moveTo(d.x, d.z); g.arc(d.x, d.z, R, d.a - 0.75, d.a + 0.75); g.closePath(); g.fill();
      g.fillStyle = `rgba(${col},0.05)`; g.beginPath(); g.moveTo(d.x, d.z); g.arc(d.x, d.z, R * 0.6, d.a - 1.2, d.a + 1.2); g.closePath(); g.fill();
      arrow(g, d.x, d.z, d.a, Math.max(0.42, 8 * px), `rgb(${col})`, '#1a0d06', px);
      if (d.m > 0.02) { g.strokeStyle = `rgba(${col},0.95)`; g.lineWidth = 2.2 * px; g.beginPath(); g.arc(d.x, d.z, Math.max(0.62, 11 * px), -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, d.m)); g.stroke(); }
    }
    // runner
    if (this.dispR) {
      const d = this.dispR;
      const grd = g.createRadialGradient(d.x, d.z, 0, d.x, d.z, 6);
      grd.addColorStop(0, 'rgba(62,224,138,0.18)'); grd.addColorStop(1, 'rgba(62,224,138,0)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(d.x, d.z); g.arc(d.x, d.z, 6, d.a - 0.6, d.a + 0.6); g.closePath(); g.fill();
      if (s.r[3] === 2) { g.strokeStyle = `rgba(62,224,138,${0.25 + 0.3 * pulse})`; g.lineWidth = 1.5 * px; g.beginPath(); g.arc(d.x, d.z, 1.2 + pulse * 0.6, 0, TAU); g.stroke(); }
      arrow(g, d.x, d.z, d.a, Math.max(0.42, 8.5 * px), '#3ee08a', '#04140b', px);
    }
    // marker
    if (s.mk) {
      const mx = s.mk[0] / 100, mz = s.mk[1] / 100, r = Math.max(0.3, 7 * px);
      g.strokeStyle = '#3ee08a'; g.lineWidth = 2 * px;
      g.beginPath(); g.arc(mx, mz, r + pulse * 4 * px, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(mx - r * 1.6, mz); g.lineTo(mx - r * 0.6, mz); g.moveTo(mx + r * 0.6, mz); g.lineTo(mx + r * 1.6, mz);
      g.moveTo(mx, mz - r * 1.6); g.lineTo(mx, mz - r * 0.6); g.moveTo(mx, mz + r * 0.6); g.lineTo(mx, mz + r * 1.6); g.stroke();
    }
    // click flashes
    this.flashes = this.flashes.filter((f) => this.now - f.t0 < 0.6);
    for (const f of this.flashes) {
      const k = (this.now - f.t0) / 0.6;
      g.strokeStyle = f.bad ? `rgba(255,75,62,${1 - k})` : `rgba(79,209,255,${1 - k})`; g.lineWidth = 2.5 * px;
      g.beginPath(); g.arc(f.x, f.z, (8 + 22 * k) * px, 0, TAU); g.stroke();
    }
    // hover / tool targeting
    let tipText = '', tipBad = false, tipSub = '';
    if (this.mouse) {
      const w = this.toWorld(this.mouse.x, this.mouse.y);
      const t = this.hover = this.targetAt(w.x, w.z);
      if (t) {
        if (t.kind === 'room' && (t.act || this.tool)) {
          const r = L.rooms[t.id];
          if (t.act === 'ping') { g.fillStyle = t.ok ? 'rgba(79,209,255,0.08)' : 'rgba(255,75,62,0.06)'; for (const rm of L.rooms) if (rm.zone === r.zone && rm.id) g.fillRect(rm.x * T, rm.y * T, rm.w * T, rm.h * T); }
          g.strokeStyle = t.ok ? 'rgba(79,209,255,0.8)' : 'rgba(255,75,62,0.6)'; g.lineWidth = 2 * px; g.setLineDash([6 * px, 4 * px]);
          g.strokeRect(r.x * T + 3 * px, r.y * T + 3 * px, r.w * T - 6 * px, r.h * T - 6 * px); g.setLineDash([]);
        } else if (t.kind !== 'room') {
          g.strokeStyle = t.act ? (t.ok ? '#4fd1ff' : '#ff4b3e') : 'rgba(255,255,255,0.6)'; g.lineWidth = 1.8 * px;
          g.beginPath(); g.arc(t.x, t.z, 13 * px, 0, TAU); g.stroke();
        }
        if (t.act) { tipText = t.label + (t.cost ? '  ·  ' + t.cost + ' BW' : ''); tipBad = !t.ok; tipSub = t.ok ? 'Click to send' : t.why; }
        else { tipText = t.info || ''; tipSub = t.hint || ''; }
      }
    } else this.hover = null;
    // labels (screen space)
    screen();
    if (S > 9) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const r of L.rooms) {
        if (r.corr || r.id === 0 || r.w * T * S < 60) continue;
        const cx = this.sx((r.x + r.w / 2) * T), cy = this.sy((r.y + 0.55) * T);
        g.font = '600 11px "Barlow Condensed", "Arial Narrow", sans-serif';
        g.fillStyle = r.id === L.vaultRoom ? 'rgba(233,196,106,0.85)' : 'rgba(170,200,235,0.55)';
        g.fillText(roomLabel(L, r.id).toUpperCase().split('').join(String.fromCharCode(8202)), cx, cy);
        g.font = '500 9.5px "JetBrains Mono", monospace';
        g.fillStyle = this.zoneOn(r.zone) ? 'rgba(79,209,255,0.75)' : 'rgba(120,140,165,0.55)';
        g.fillText(ZN(r.zone) + (s.li[r.id] === '2' ? ' · DARK' : ''), cx, cy + 12);
      }
      g.font = '700 10px "Barlow Condensed", sans-serif'; g.fillStyle = 'rgba(62,224,138,0.9)';
      g.fillText('VAN', this.sx(L.van.x), this.sy(L.van.z));
    }
    // next-step label, clamped to the map edges so it is never lost off-screen
    if (tg) {
      const m = 46;
      let lx = this.sx(tg.x), ly = this.sy(tg.z) - 28;
      const off = lx < m || ly < m || lx > W - m || ly > H - m;
      lx = clamp(lx, m, W - m); ly = clamp(ly, m, H - m);
      const text = (off ? '◆ ' : '') + 'NEXT · ' + tg.label;
      g.font = '700 12px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const tw = g.measureText(text).width + 14;
      g.fillStyle = 'rgba(10,16,24,0.88)'; rr(g, lx - tw / 2, ly - 10, tw, 20, 4); g.fill();
      g.strokeStyle = 'rgba(255,182,72,0.9)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#ffb648'; g.fillText(text, lx, ly + 0.5);
    }
    // tooltip
    const tip = this.el.tip;
    if (tipText && this.mouse) {
      tip.innerHTML = '';
      tip.appendChild(h('b', { text: tipText }));
      if (tipSub) tip.appendChild(h('small', { text: tipSub }));
      tip.className = 'hk-tip show' + (tipBad ? ' bad' : '');
      const tx = Math.min(this.mouse.x + 16, W - 240), ty = Math.min(this.mouse.y + 18, H - 50);
      tip.style.transform = `translate(${tx | 0}px,${ty | 0}px)`;
    } else if (tip.className !== 'hk-tip') tip.className = 'hk-tip';
  }
}

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function angD(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
function rr(g, x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function arrow(g, x, z, a, r, fill, edge, px) {
  g.save(); g.translate(x, z); g.rotate(a);
  g.beginPath(); g.moveTo(r * 1.15, 0); g.lineTo(-r * 0.75, r * 0.72); g.lineTo(-r * 0.4, 0); g.lineTo(-r * 0.75, -r * 0.72); g.closePath();
  g.fillStyle = fill; g.fill(); g.strokeStyle = edge; g.lineWidth = 1.4 * px; g.stroke();
  g.restore();
}
