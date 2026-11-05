// Close-up of a wall panel for the runner. Digits / fuses can be entered with
// the keyboard, or by clicking (a virtual cursor is used while the mouse is
// pointer-locked).
import { h, txt, cls } from './dom.js';
import { drawPanel, panelTitle } from './panelart.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '<', '0', 'OK'];
const keyRect = (i) => [40 + (i % 3) * 60, 150 + Math.floor(i / 3) * 24, 54, 20];
const fuseRect = (i) => [30 + i * 39 - 14, 62, 28, 120];

export class PanelView {
  constructor(root, L, act) {
    this.L = L; this.act = act; this.id = -1;
    this.title = h('div.pv-title'); this.sub = h('div.pv-sub');
    this.canvas = h('canvas.pv-canvas');
    this.info = h('div.pv-info'); this.status = h('div.pv-status');
    this.cursor = h('div.pv-cursor');
    this.hints = h('div.pv-hints');
    this.card = h('div.pv-card', null, h('div.pv-head', null, this.title, this.sub), h('div.pv-body', null, h('div.pv-screen', null, this.canvas, this.cursor), h('div.pv-side', null, this.info, this.status)), this.hints);
    this.el = h('div.pv', null, this.card);
    this.el.addEventListener('mousemove', (e) => { if (!this.locked) this.pointAt(e.clientX, e.clientY); });
    this.el.addEventListener('mousedown', (e) => { if (!this.locked && e.button === 0) { this.pointAt(e.clientX, e.clientY); this.click(); } });
    root.append(this.el);
    this.cx = 0.5; this.cy = 0.75; this.hover = -1; this.flash = { i: -1, t: 0 };
  }

  get isOpen() { return this.id >= 0; }

  open(id, locked) {
    const p = this.L.panels[id];
    this.id = id; this.p = p; this.locked = locked; this.key = ''; this.doneAt = 0;
    txt(this.title, panelTitle(p));
    txt(this.sub, p.kind === 'junction' ? 'COMMS: READ THE SERIAL' : p.kind === 'fuse' ? 'COMMS: LISTEN FOR THE ORDER' : 'COMMS: DESCRIBE THE GLYPHS');
    this.hints.innerHTML = '';
    const hint = (k, t) => this.hints.append(h('span', null, h('kbd', { text: k }), t));
    if (p.kind === 'keypad' || p.kind === 'vaultpad') { hint('0-9', 'enter digit'); hint('⌫', 'delete'); }
    if (p.kind === 'fuse') hint('1-6', 'pull fuse');
    hint('Click', p.kind === 'junction' ? 'nothing to press' : 'press');
    hint('E / Esc', 'step back');
    this.el.classList.add('show');
    this.cx = 0.5; this.cy = p.kind === 'fuse' ? 0.5 : 0.75;
    this.resize();
  }
  close() { this.id = -1; this.el.classList.remove('show'); }
  resize() {
    const css = Math.min(window.innerHeight * 0.62, window.innerWidth * 0.5, 560);
    const px = Math.min(1024, Math.round(css * Math.min(2, window.devicePixelRatio || 1)));
    this.canvas.style.width = this.canvas.style.height = css + 'px';
    if (this.canvas.width !== px) { this.canvas.width = this.canvas.height = px; this.key = ''; }
  }

  // virtual cursor from pointer-lock mouse deltas
  move(dx, dy) {
    const r = this.canvas.getBoundingClientRect();
    this.cx = Math.min(1, Math.max(0, this.cx + dx / r.width));
    this.cy = Math.min(1, Math.max(0, this.cy + dy / r.height));
  }
  pointAt(x, y) {
    const r = this.canvas.getBoundingClientRect();
    this.cx = (x - r.left) / r.width; this.cy = (y - r.top) / r.height;
  }
  hitTest() {
    const x = this.cx * 256, y = this.cy * 256, p = this.p;
    if (!p) return -1;
    if (p.kind === 'keypad' || p.kind === 'vaultpad') { for (let i = 0; i < 12; i++) { const [rx, ry, rw, rh] = keyRect(i); if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return i; } }
    if (p.kind === 'fuse') { for (let i = 0; i < 6; i++) { const [rx, ry, rw, rh] = fuseRect(i); if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return i; } }
    return -1;
  }
  click() {
    const i = this.hitTest(); if (i < 0) return;
    if (this.p.kind === 'fuse') this.press(i);
    else { const k = KEYS[i]; if (k === '<') this.digit(-1); else if (k !== 'OK') this.digit(+k); }
  }
  digit(d) {
    this.act({ type: 'key', d });
    const idx = d === -1 ? 9 : d === 0 ? 10 : d - 1;
    this.flash = { i: idx, t: performance.now() };
  }
  press(i) { this.act({ type: 'fuse', i }); this.flash = { i, t: performance.now() }; }

  // returns true if the key was used
  keydown(e) {
    if (!this.isOpen) return false;
    const k = this.p.kind;
    if ((k === 'keypad' || k === 'vaultpad')) {
      if (/^[0-9]$/.test(e.key)) { this.digit(+e.key); return true; }
      if (e.key === 'Backspace' || e.key === 'Delete') { this.digit(-1); return true; }
    }
    if (k === 'fuse' && /^[1-6]$/.test(e.key)) { this.press(+e.key - 1); return true; }
    return false;
  }

  update(sim) {
    if (!this.isOpen) return;
    const p = this.p, s = sim.panels[this.id];
    const lock = s.lock > sim.t ? Math.ceil(s.lock - sim.t) : 0;
    this.hover = this.hitTest();
    const fl = performance.now() - this.flash.t < 140 ? this.flash.i : -1;
    const left = p.kind === 'fuse' && s.deadline > 0 && !s.done && !lock ? Math.max(0, Math.ceil(s.deadline - sim.t)) : -1;
    const zone = p.kind === 'junction' && sim.zoneOn(p.zone);
    const key = [(s.entry || []).length, s.fuses ? s.fuses.map((f) => (f.pulled ? 1 : 0)).join('') : '', s.done ? 1 : 0, lock, zone ? 1 : 0, this.hover, fl, s.code, (s.glyphs || []).join(''), this.canvas.width].join('|');
    if (key !== this.key) {
      this.key = key;
      const c = this.canvas, g = c.getContext('2d'), W = c.width;
      g.clearRect(0, 0, W, W);
      drawPanel(g, W, W, p, s, { now: sim.t, zoneOn: zone });
      const u = W / 256;
      const hl = (r, a) => { g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(r[0] * u, r[1] * u, r[2] * u, r[3] * u); };
      if (!s.done && !lock) {
        if (p.kind === 'fuse') { if (this.hover >= 0) hl(fuseRect(this.hover), 0.12); if (fl >= 0) hl(fuseRect(fl), 0.35); }
        else if (p.kind !== 'junction') { if (this.hover >= 0) hl(keyRect(this.hover), 0.14); if (fl >= 0) hl(keyRect(fl), 0.4); }
      }
    }
    this.cursor.style.left = (this.cx * 100) + '%'; this.cursor.style.top = (this.cy * 100) + '%';
    cls(this.cursor, 'show', this.locked && p.kind !== 'junction');
    // side info
    let info, status = '', st = '';
    if (p.kind === 'junction') {
      info = 'Read the serial number on the sticker to the van. They type it into the uplink. Hold here until it links - the port drops if you walk away.';
      if (zone || s.done) { status = 'UPLINK ACTIVE · ZONE ' + (p.zone + 1); st = 'good'; }
      else if (lock) { status = 'TAMPER LOCK ' + lock + ' s'; st = 'bad'; }
      else { status = 'WAITING FOR THE VAN'; st = 'wait'; }
    } else if (p.kind === 'fuse') {
      info = 'The van can see the pull order on their screen. Pull each fuse as they call out its colour and number. Wrong fuse or too slow trips the breaker.';
      if (s.done) { status = 'BYPASS COMPLETE'; st = 'good'; }
      else if (lock) { status = 'BREAKER TRIPPED ' + lock + ' s'; st = 'bad'; }
      else { status = (s.step || 0) + ' / ' + s.seq.length + ' PULLED' + (left >= 0 ? ' · ' + left + ' s' : ''); st = left >= 0 && left <= 5 ? 'bad' : 'wait'; }
    } else {
      info = 'Describe each glyph to the van - they hold the cipher card that turns glyphs into digits. Type the digits they read back, in order.';
      if (s.done) { status = p.kind === 'vaultpad' ? 'SEAL RELEASED' : 'GRID DISARMED'; st = 'good'; }
      else if (lock) { status = 'LOCKED ' + lock + ' s'; st = 'bad'; }
      else { status = (s.entry || []).length + ' / ' + s.glyphs.length + ' ENTERED'; st = 'wait'; }
    }
    txt(this.info, info); txt(this.status, status); this.status.className = 'pv-status ' + st;
    // junction: step back automatically shortly after it links
    if (p.kind === 'junction' && (zone || s.done)) { if (!this.doneAt) this.doneAt = performance.now(); else if (performance.now() - this.doneAt > 1600) this.act({ type: 'close' }); }
  }
}
