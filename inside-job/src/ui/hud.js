// Runner HUD: objective, alarm, bag, gadgets, visibility, interaction prompt
// with hold ring, directional detection arcs, toasts and banners.
import { h, txt, cls, sty, money, clock } from './dom.js';
import { LOOT, ROOMS } from '../core/data.js';
import { GST } from '../core/sim.js';
import { currentStep, stateFromSim } from '../core/guide.js';

const GADGETS = [['emp', 'EMP', '1'], ['smoke', 'SMOKE', '2'], ['noise', 'NOISE', '3']];
const ICON = {
  emp: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor"/></svg>',
  smoke: '<svg viewBox="0 0 24 24"><circle cx="8" cy="14" r="5" fill="currentColor" opacity=".8"/><circle cx="15" cy="11" r="6" fill="currentColor"/><circle cx="17" cy="17" r="4" fill="currentColor" opacity=".7"/></svg>',
  noise: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7h3l1 13H4L5 7zm2 0h4V5.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5z" fill="currentColor"/></svg>',
  torch: '<svg viewBox="0 0 24 24"><path d="M3 10h9l5-4v12l-5-4H3z" fill="currentColor"/><path d="M19 8l2-1M19 12h2.5M19 16l2 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

export function roomLabel(L, id) {
  const r = L.rooms[id]; if (!r) return '';
  if (id === 0) return 'the street';
  if (r.corr) return 'the corridor';
  return ((ROOMS[r.type] && ROOMS[r.type].label) || r.type).toLowerCase();
}
export function panelName(p) {
  return p.kind === 'junction' ? 'network junction' : p.kind === 'keypad' ? 'laser keypad' : p.kind === 'vaultpad' ? 'vault keypad' : 'fuse box';
}

export class RunnerHUD {
  constructor(root, L, contract) {
    this.L = L; this.contract = contract || {};
    this.root = root;
    const el = this.el = {};
    el.objective = h('div.hud-obj-text');
    el.alarm = h('div.hud-alarm', null, h('span.lbl', { text: 'ALERT' }), ...[0, 1, 2].map(() => h('i')));
    el.police = h('div.hud-police');
    el.stepN = h('b', { text: 'STEP 1' });
    el.stepT = h('div.hud-obj-title');
    el.obj = h('div.hud-obj', null, el.stepN, h('div', null, el.stepT, el.objective));
    el.tl = h('div.hud-tl', null, h('div.hud-job', { text: (contract && contract.name) || 'Inside Job' }), el.obj, el.alarm, el.police);
    el.bagVal = h('span.v'); el.bagCap = h('div.hud-cap'); el.secured = h('div.hud-sec');
    el.tr = h('div.hud-tr', null, h('div.hud-bag', null, h('span.ic', { html: ICON.bag }), el.bagVal), el.bagCap, el.secured);
    el.cross = h('div.hud-cross');
    el.ring = h('div.hud-ring', { html: '<svg viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="27"/><circle class="fg" cx="32" cy="32" r="27"/></svg>' });
    el.pKey = h('span.key', { text: 'E' }); el.pText = h('span.t'); el.pSub = h('div.sub');
    el.prompt = h('div.hud-prompt', null, el.ring, h('div.hud-ptxt', null, h('div', null, el.pKey, el.pText), el.pSub));
    el.detect = h('canvas.hud-detect', { width: 360, height: 360 });
    el.slots = GADGETS.map(([k, n, key]) => {
      const c = h('span.n'); const s = h('div.slot', null, h('span.k', { text: key }), h('span.ic', { html: ICON[k] }), h('span.nm', { text: n }), c);
      s._n = c; s._k = k; return s;
    });
    el.torch = h('div.slot.torch', null, h('span.k', { text: 'F' }), h('span.ic', { html: ICON.torch }), h('span.nm', { text: 'LIGHT' }));
    el.gad = h('div.hud-gad', null, ...el.slots, el.torch, h('div.hint', { text: 'G use · Q takedown · C crouch' }));
    el.visFill = h('i'); el.visTxt = h('span.t');
    el.vis = h('div.hud-vis', null, h('span.ic', { html: ICON.eye }), h('div.bar', null, el.visFill), el.visTxt);
    el.stance = h('div.hud-stance');
    el.bl = h('div.hud-bl', null, el.vis, el.stance);
    el.van = h('div.hud-van');
    el.toasts = h('div.hud-toasts');
    el.banner = h('div.hud-banner');
    el.hit = h('div.hud-hit');
    this.root.append(el.hit, el.detect, el.tl, el.tr, el.cross, el.prompt, el.gad, el.bl, el.van, el.toasts, el.banner);
    this.dg = el.detect.getContext('2d');
    this.seenEv = 0; this.bannerUntil = 0; this.detectDirty = true;
  }

  setVan(text, ok) { txt(this.el.van, text); cls(this.el.van, 'ok', ok); }

  toast(text, kind = '') {
    const t = h('div.toast' + (kind ? '.' + kind : ''), { text });
    this.el.toasts.prepend(t);
    while (this.el.toasts.children.length > 5) this.el.toasts.lastChild.remove();
    setTimeout(() => t.classList.add('out'), 3800);
    setTimeout(() => t.remove(), 4400);
  }
  banner(text, kind = '', dur = 3) {
    const b = this.el.banner;
    b.textContent = text; b.className = 'hud-banner show ' + kind;
    this.bannerUntil = performance.now() + dur * 1000;
  }

  step(sim) {
    if (sim.phase !== 'play') return null;
    return currentStep(this.L, stateFromSim(this.L, sim));
  }

  promptFor(sim) {
    const f = sim.focus; if (!f) return null;
    const L = this.L;
    let t = '', sub = '';
    if (f.kind === 'loot') { const it = L.loot[f.id], d = LOOT[it.kind]; t = 'Grab ' + d.name; sub = money(it.value) + ' · weight ' + it.weight + (it.primary ? ' · TARGET' : ''); }
    else if (f.kind === 'panel') { const p = L.panels[f.id]; t = 'Open ' + panelName(p); sub = p.kind === 'junction' ? 'Zone ' + (p.zone + 1) : p.kind === 'fuse' ? (p.effect === 'cams' ? 'Cameras' : 'Lights') + ' · zone ' + (p.target + 1) : ''; }
    else if (f.kind === 'pick') { t = 'Pick the lock'; sub = 'Makes a little noise'; }
    else if (f.kind === 'wheel') { t = 'Hold the timelock wheel'; sub = sim.timelockActive ? 'Bypass running ' + Math.round(sim.timelock * 100) + '%' : 'The van must hold the bypass too'; }
    else if (f.kind === 'secure') { t = 'Stash the bag in the van'; sub = money(sim.r.bag.reduce((s, id) => s + L.loot[id].value, 0)); }
    else if (f.kind === 'leave') { t = sim.primarySecured() ? 'Drive away' : 'Bail out'; sub = sim.primarySecured() ? 'End the job' : 'Leave without the target'; }
    return { t, sub: f.ok ? sub : f.why || sub, ok: f.ok };
  }

  update(sim, view) {
    const el = this.el, L = this.L, R = sim.r;
    const st = this.step(sim);
    if (st) {
      txt(el.stepN, st.done ? 'DONE' : 'STEP ' + (st.n + 1) + '/' + st.total);
      txt(el.stepT, st.title); txt(el.objective, st.runner);
      cls(el.obj, 'alert', !!st.alert);
      if (this.lastStepN !== st.n) {
        if (this.lastStepN != null) { el.obj.classList.remove('flash'); void el.obj.offsetWidth; el.obj.classList.add('flash'); }
        this.lastStepN = st.n;
      }
    }
    // alarm
    for (let i = 0; i < 3; i++) cls(el.alarm.children[i + 1], 'on', sim.alarm > i);
    cls(el.alarm, 'hot', sim.alarm > 0);
    if (sim.police >= 0) { txt(el.police, 'POLICE ' + clock(sim.police)); cls(el.police, 'show', true); }
    else if (sim.lockdown > sim.t) { txt(el.police, 'LOCKDOWN ' + clock(sim.lockdown - sim.t)); cls(el.police, 'show', true); }
    else cls(el.police, 'show', false);
    // bag
    const bagV = R.bag.reduce((s, id) => s + L.loot[id].value, 0);
    txt(el.bagVal, money(bagV));
    const capKey = R.bagW + '/' + R.cap;
    if (el.bagCap._k !== capKey) {
      el.bagCap._k = capKey; el.bagCap.innerHTML = '';
      for (let i = 0; i < R.cap; i++) el.bagCap.append(h('i' + (i < R.bagW ? '.on' : '')));
    }
    txt(el.secured, sim.secured ? 'SECURED ' + money(sim.secured) : 'NOTHING SECURED');
    // gadgets
    for (const s of el.slots) { txt(s._n, '×' + (R.g[s._k] | 0)); cls(s, 'sel', R.sel === s._k); cls(s, 'empty', !(R.g[s._k] > 0)); }
    cls(el.torch, 'sel', R.flash);
    // visibility
    const lit = Math.min(1, R.lit / 1.1);
    const smoke = sim.smoke.some((s) => Math.hypot(s.x - R.x, s.z - R.z) < s.r * 0.85);
    sty(el.visFill, 'width', Math.round(lit * 100) + '%');
    txt(el.visTxt, smoke ? 'IN SMOKE' : lit < 0.22 ? 'HIDDEN' : lit < 0.55 ? 'DIM' : 'EXPOSED');
    cls(el.vis, 'hidden', smoke || lit < 0.22); cls(el.vis, 'exposed', !smoke && lit >= 0.55);
    txt(el.stance, R.crouch ? 'CROUCHED' : R.sprint ? 'SPRINTING' : '');
    cls(el.stance, 'loud', R.sprint);
    // prompt + hold ring
    const pr = view.panelOpen ? null : this.promptFor(sim);
    cls(el.prompt, 'show', !!pr);
    if (pr) {
      txt(el.pText, pr.t); txt(el.pSub, pr.sub); cls(el.prompt, 'bad', !pr.ok);
      const p = sim.focus.kind === 'wheel' ? sim.timelock : sim.hold.p;
      sty(el.ring.lastChild.lastChild, 'stroke-dashoffset', String(169.6 * (1 - Math.min(1, p))));
    }
    cls(el.cross, 'focus', !!pr);
    // banner timeout
    if (this.bannerUntil && performance.now() > this.bannerUntil) { this.bannerUntil = 0; el.banner.classList.remove('show'); }
    this.drawDetect(sim, view);
    this.events(sim);
  }

  drawDetect(sim, view) {
    const g = this.dg, R = sim.r;
    const items = [];
    for (const gd of sim.guards) {
      if (gd.st === GST.ko) continue;
      const m = gd.st === GST.alert ? 1 : Math.min(1, gd.meter);
      if (m < 0.03 && gd.st !== GST.search && gd.st !== GST.inv) continue;
      items.push([Math.atan2(gd.z - R.z, gd.x - R.x), Math.max(m, 0.12), gd.st === GST.alert]);
    }
    for (let i = 0; i < sim.cams.length; i++) {
      const s = sim.cams[i]; if (s.meter < 0.03) continue;
      const c = this.L.cams[i];
      items.push([Math.atan2(c.z - R.z, c.x - R.x), Math.min(1, s.meter), false, true]);
    }
    if (!items.length && !this.detectDirty) return;
    this.detectDirty = items.length > 0;
    g.clearRect(0, 0, 360, 360);
    for (const [ang, m, alert, cam] of items) {
      const rel = ang - view.yaw;
      const a = -Math.PI / 2 + rel;
      const span = 0.22 + 0.25 * m;
      const col = alert || m > 0.95 ? '255,59,48' : m > 0.5 ? '255,140,40' : '255,200,70';
      g.lineCap = 'round';
      g.strokeStyle = `rgba(0,0,0,${0.35 * Math.min(1, m * 3)})`; g.lineWidth = 9;
      g.beginPath(); g.arc(180, 180, 150, a - span, a + span); g.stroke();
      g.strokeStyle = `rgba(${col},${0.35 + 0.65 * m})`; g.lineWidth = cam ? 4 : 6;
      g.beginPath(); g.arc(180, 180, 150, a - span * m, a + span * m); g.stroke();
      if (cam) { g.fillStyle = `rgba(${col},${0.5 + 0.5 * m})`; g.beginPath(); g.arc(180 + Math.cos(a) * 166, 180 + Math.sin(a) * 166, 3.5, 0, 7); g.fill(); }
    }
    this.seenLevel = items.reduce((s, x) => Math.max(s, x[1]), 0);
  }

  events(sim) {
    const L = this.L;
    for (const e of sim.events) {
      if (e.id <= this.seenEv) continue;
      this.seenEv = e.id;
      const a = e.args;
      switch (e.type) {
        case 'zone': this.toast('Zone ' + (a[0] + 1) + ' networked - the van is in', 'good'); break;
        case 'laser': this.toast('Van: laser grid down for 8 s', 'van'); break;
        case 'light': this.toast('Van: lights cut in ' + roomLabel(L, a[0]), 'van'); break;
        case 'loop': this.toast('Van: camera on a loop', 'van'); break;
        case 'door': this.toast('Van: security door ' + (a[1] ? 'opened' : 'closed'), 'van'); break;
        case 'lure': this.toast('Van: noise lure in ' + roomLabel(L, a[0]), 'van'); break;
        case 'ping': this.toast('Van: scanning zone ' + (a[0] + 1), 'van'); break;
        case 'mark': this.toast('Van marked a spot', 'van'); break;
        case 'nobw': this.toast('Van is out of bandwidth', 'warn'); break;
        case 'alert': this.toast('You were spotted!', 'bad'); break;
        case 'cam_spot': this.toast('A camera spotted you!', 'bad'); break;
        case 'alarm': this.banner('ALERT LEVEL ' + a[0] + ' / 3', 'bad', 2.6); this.hit(); break;
        case 'lockdown': this.toast('Lockdown - security doors sealed', 'bad'); break;
        case 'lockdown_end': this.toast('Lockdown lifted', 'good'); break;
        case 'police': this.banner('POLICE EN ROUTE', 'bad', 3.5); break;
        case 'reinforce': this.toast('Backup guard entered the building', 'bad'); break;
        case 'laser_trip': this.toast('Laser tripped!', 'bad'); this.hit(); break;
        case 'wrong': this.toast(a[1] === 'serial' ? 'Van entered a wrong serial - port locked' : a[1] === 'fuse' ? 'Wrong fuse - breaker tripped' : a[1] === 'fuse_time' ? 'Too slow - breaker tripped' : 'Wrong code - keypad locked', 'bad'); break;
        case 'solved': { const p = L.panels[a[0]]; this.toast(p.kind === 'keypad' ? 'Laser grid disarmed' : p.kind === 'vaultpad' ? 'Vault seal released' : 'Bypass complete', 'good'); break; }
        case 'fuse_cams': this.toast('Cameras in zone ' + (a[0] + 1) + ' are dead', 'good'); break;
        case 'fuse_lights': this.toast('Lights in zone ' + (a[0] + 1) + ' are dead', 'good'); break;
        case 'vault_open': this.banner('VAULT OPEN', 'good', 3); break;
        case 'grab': { const it = L.loot[a[0]]; this.toast('+' + money(it.value) + '  ' + LOOT[it.kind].name, 'loot'); break; }
        case 'secure': this.toast('Stashed ' + a[0] + ' item' + (a[0] === 1 ? '' : 's') + ' · ' + money(a[1]), 'loot'); break;
        case 'ko': this.toast('Guard down - keep the body out of sight', ''); break;
        case 'body': this.toast('A guard found a body!', 'bad'); break;
        case 'radio': this.toast('A guard is radioing it in', 'warn'); break;
        case 'nogadget': this.toast('No ' + a[0] + ' left', 'warn'); break;
        case 'miss': this.toast('Sneak up behind a guard for a takedown', 'warn'); break;
        case 'picked': this.toast('Lock picked - you are in', 'good'); break;
        case 'serial_noport': this.toast('Van tried a serial - hold the junction open first', 'warn'); break;
        case 'caught': this.banner('BUSTED', 'bad', 5); break;
        default:
      }
    }
  }

  hit() { const e = this.el.hit; e.classList.remove('go'); void e.offsetWidth; e.classList.add('go'); }
  show(on) { this.root.style.display = on ? '' : 'none'; }
}
