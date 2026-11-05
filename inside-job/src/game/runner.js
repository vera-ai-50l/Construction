// The runner's first-person view: input, camera, flashlight, post, HUD and
// the panel close-up. The runner's machine also hosts the Sim, so input is
// applied the same frame (no network lag for the person sneaking around).
import * as THREE from 'three';
import { Post } from '../render/post.js';
import { RunnerHUD } from '../ui/hud.js';
import { PanelView } from '../ui/panelview.js';
import { renderPlan } from '../ui/plan.js';
import { h, txt } from '../ui/dom.js';
import { EYE } from '../core/data.js';
import { angDiff } from '../core/geom.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const SEL = ['emp', 'smoke', 'noise'];

export class RunnerView {
  constructor({ renderer, world, sim, L, contract, root, quality, settings, onPanelAction, onEvent }) {
    this.renderer = renderer; this.world = world; this.sim = sim; this.L = L;
    this.quality = quality; this.settings = settings || { sens: 1, invert: false, fov: 74 };
    this.onPanelAction = onPanelAction || ((a) => sim.panelAction(a));
    this.onEvent = onEvent || (() => {});
    this.root = root;
    // camera
    const cam = this.camera = new THREE.PerspectiveCamera(this.settings.fov || 74, 1, 0.05, 230);
    cam.rotation.order = 'YXZ';
    world.scene.add(cam);
    this.yaw = sim.r.a; this.pitch = 0;
    this.bob = { ph: 0, amp: 0, roll: 0, fov: 0, land: 0 };
    // flashlight (always in the scene - toggling intensity avoids shader recompiles)
    const fl = this.flash = new THREE.SpotLight(0xfff1dc, 0, 26, 0.48, 0.6, 1.4);
    fl.map = world.goboTex;
    fl.position.set(0.18, -0.16, 0.05);
    fl.target.position.set(0.02, -0.12, -5);
    if (quality === 'high') { fl.castShadow = true; fl.shadow.mapSize.set(1024, 1024); fl.shadow.bias = -0.0004; fl.shadow.camera.near = 0.15; fl.shadow.camera.far = 24; }
    cam.add(fl, fl.target);
    this.flashOn = 0;
    // post
    this.post = new Post(renderer, world.scene, cam, quality);
    this.exposure = 1.2;
    // DOM
    this.hudRoot = h('div.hud');
    this.planEl = h('ol.plan');
    this.pause = h('div.pause', null, h('div.pause-card', null, h('div.pause-t', { text: 'CLICK TO PLAY' }),
      h('div.plan-h', { text: 'THE PLAN · the van sees the same steps' }), this.planEl,
      h('div.pause-s', { text: 'WASD move · Mouse look · Shift sprint · C crouch · Hold E interact · F flashlight · G gadget · 1-3 select · Q takedown' }),
      h('div.pause-n', { text: 'The job keeps running while you are here. Press Esc any time to see this plan.' })));
    root.append(this.hudRoot, this.pause);
    this.hud = new RunnerHUD(this.hudRoot, L, contract);
    if (sim.testMode) this.addTestControls();
    this.markEl = document.createElement('div'); this.markEl.className = 'hud-mark';
    this.markEl.innerHTML = '<i></i><span></span>';
    this.hudRoot.appendChild(this.markEl); this._mv = new THREE.Vector3();
    this.panel = new PanelView(this.hudRoot, L, (a) => this.onPanelAction(a));
    this.stats = h('output.runner-stats', { hidden: !this.settings.stats });
    this.gpuStatus = h('div.pause.gpu-status', null,
      h('div.pause-card', null, h('div.pause-t', { text: 'RESTORING GRAPHICS' }),
        h('p.pause-s', { text: 'If the picture does not return, reload the game.' })));
    root.append(this.stats, this.gpuStatus);
    // input state
    this.keys = new Set(); this.edge = {}; this.crouchT = false; this.useLatch = false;
    this.locked = false; this.dragLook = false; this.mouseDown = false;
    this.mdx = 0; this.mdy = 0;
    this.bindInput();
    // adaptive resolution
    this.basePR = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' && !/mac/i.test(navigator.platform) ? 1.25 : 1);
    this.pixelBudget = quality === 'high' ? 3700000 : quality === 'medium' ? 1650000 : 950000;
    this.scale = 1; this.ft = { acc: 0, n: 0, t: 0, lastDrop: -99, clock: 0 };
    this.resize();
    this.fps = 60;
  }

  // ---------------------------------------------------------------- input
  addTestControls() {
    const title = h('div.pause-n', { text: 'TEST JOB · F3 CHEATS · F2 FPS' });
    const controls = h('div.test-controls', { onmousedown: (e) => e.stopPropagation() });
    for (const [action, label] of [['ghost', 'Ghost mode'], ['network', 'Open security'], ['vault', 'Open vault'], ['restock', 'Restock gear + BW']]) {
      const button = h('button', { type: 'button', onclick: () => {
        this.sim.testCheat(action);
        if (action === 'ghost') button.setAttribute('aria-pressed', String(!!this.sim.testGhost));
        this.hud.toast(action === 'ghost' ? 'Ghost mode ' + (this.sim.testGhost ? 'on' : 'off') : label + ' applied', 'good');
      } }, label);
      if (action === 'ghost') button.setAttribute('aria-pressed', 'false');
      controls.appendChild(button);
    }
    this.pause.firstChild.append(title, controls);
  }

  bindInput() {
    this.h = {
      kd: (e) => this.keydown(e), ku: (e) => this.keyup(e),
      mm: (e) => this.mousemove(e),
      md: (e) => this.mousedown(e), mu: (e) => { if (e.button === 0) this.mouseDown = false; },
      wh: (e) => { if (!this.active()) return; e.preventDefault(); const i = SEL.indexOf(this.sim.r.sel); this.edge.sel = SEL[(i + (e.deltaY > 0 ? 1 : 2)) % 3]; },
      plc: () => this.lockChange(), ple: () => { this.dragLook = true; this.pause.classList.remove('show'); },
      rs: () => this.resize(), blur: () => { this.keys.clear(); this.mouseDown = false; },
      ctx: (e) => { if (this.active()) e.preventDefault(); },
      lost: (e) => {
        e.preventDefault();
        this.contextLost = true;
        this.keys.clear();
        if (document.pointerLockElement === this.root) document.exitPointerLock?.();
        this.gpuStatus.classList.add('show');
      },
      restored: () => {
        this.contextLost = false;
        this.gpuStatus.classList.remove('show');
      },
    };
    window.addEventListener('keydown', this.h.kd); window.addEventListener('keyup', this.h.ku);
    window.addEventListener('mousemove', this.h.mm); window.addEventListener('mouseup', this.h.mu);
    this.root.addEventListener('mousedown', this.h.md);
    this.root.addEventListener('wheel', this.h.wh, { passive: false });
    this.root.addEventListener('contextmenu', this.h.ctx);
    document.addEventListener('pointerlockchange', this.h.plc); document.addEventListener('pointerlockerror', this.h.ple);
    window.addEventListener('resize', this.h.rs); window.addEventListener('blur', this.h.blur);
    this.renderer.domElement.addEventListener('webglcontextlost', this.h.lost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.h.restored);
    this.pause.classList.add('show');
  }
  unbindInput() {
    window.removeEventListener('keydown', this.h.kd); window.removeEventListener('keyup', this.h.ku);
    window.removeEventListener('mousemove', this.h.mm); window.removeEventListener('mouseup', this.h.mu);
    this.root.removeEventListener('mousedown', this.h.md); this.root.removeEventListener('wheel', this.h.wh);
    this.root.removeEventListener('contextmenu', this.h.ctx);
    document.removeEventListener('pointerlockchange', this.h.plc); document.removeEventListener('pointerlockerror', this.h.ple);
    window.removeEventListener('resize', this.h.rs); window.removeEventListener('blur', this.h.blur);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.h.lost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.h.restored);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  active() { return this.locked || this.dragLook; }
  get panelOpen() { return this.panel.isOpen; }

  requestLock() {
    if (this.dragLook || this.contextLost) return;
    const el = this.root;
    const fallback = () => { this.dragLook = true; this.pause.classList.remove('show'); };
    if (!el.requestPointerLock) { fallback(); return; }
    try {
      const p = el.requestPointerLock();
      if (p && p.catch) p.catch(fallback);
    } catch { fallback(); }
  }
  lockChange() {
    this.locked = document.pointerLockElement === this.root;
    this.panel.locked = this.locked;
    if (!this.locked && !this.dragLook) {
      this.keys.clear();
      if (this.panel.isOpen) this.onPanelAction({ type: 'close' });
      if (this.sim.phase === 'play') this.pause.classList.add('show');
    } else this.pause.classList.remove('show');
  }
  mousedown(e) {
    if (this.sim.phase !== 'play' || this.contextLost) return;
    if (this.dragLook && this.pause.classList.contains('show')) {
      this.pause.classList.remove('show');
      return;
    }
    if (!this.active()) { if (e.button === 0) this.requestLock(); return; }
    if (this.panel.isOpen) {
      if (e.button === 0) { if (this.locked) this.panel.click(); }
      else if (e.button === 2) this.onPanelAction({ type: 'close' });
      return;
    }
    if (e.button === 0) this.mouseDown = true;
  }
  mousemove(e) {
    if (!this.active()) return;
    if (this.dragLook && !this.mouseDown && !this.panel.isOpen) return;
    if (this.panel.isOpen) { if (this.locked) this.panel.move(e.movementX || 0, e.movementY || 0); return; }
    this.mdx += e.movementX || 0; this.mdy += e.movementY || 0;
  }
  keydown(e) {
    if (e.code === 'F2' && !e.repeat) {
      e.preventDefault();
      this.stats.hidden = !this.stats.hidden;
      return;
    }
    if (e.code === 'F3' && !e.repeat && this.sim.testMode && this.sim.phase === 'play') {
      e.preventDefault();
      this.keys.clear();
      this.mouseDown = false;
      if (this.locked) document.exitPointerLock?.();
      else this.pause.classList.toggle('show', !this.dragLook || !this.pause.classList.contains('show'));
      return;
    }
    if (!this.active() || this.contextLost || this.pause.classList.contains('show') || this.sim.phase !== 'play') return;
    if (e.code === 'Tab' || e.code === 'Space' || e.code === 'Backspace') e.preventDefault();
    if (this.panel.isOpen) {
      if (this.panel.keydown(e)) { e.preventDefault(); return; }
      if (!e.repeat && (e.code === 'KeyE' || e.code === 'Tab')) { this.onPanelAction({ type: 'close' }); this.useLatch = true; }
      return;
    }
    if (e.repeat) { this.keys.add(e.code); return; }
    this.keys.add(e.code);
    switch (e.code) {
      case 'KeyF': this.edge.flash = true; break;
      case 'KeyG': this.edge.gadget = true; break;
      case 'KeyQ': this.edge.take = true; break;
      case 'KeyC': this.crouchT = !this.crouchT; break;
      case 'Digit1': this.edge.sel = 'emp'; break;
      case 'Digit2': this.edge.sel = 'smoke'; break;
      case 'Digit3': this.edge.sel = 'noise'; break;
      default:
    }
  }
  keyup(e) { this.keys.delete(e.code); if (e.code === 'KeyE') this.useLatch = false; }

  // build this frame's Sim input
  input(dt) {
    const k = this.keys, s = this.settings;
    const sens = 0.0022 * (s.sens || 1);
    this.yaw += this.mdx * sens;
    this.pitch = clamp(this.pitch - this.mdy * sens * (s.invert ? -1 : 1), -1.35, 1.35);
    this.mdx = this.mdy = 0;
    const ax = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const az = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const inp = {
      mx: ax, mz: az, a: this.yaw, pitch: this.pitch,
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      crouch: this.crouchT || k.has('ControlLeft'),
      use: k.has('KeyE') && !this.useLatch,
      take: !!this.edge.take, gadget: !!this.edge.gadget, flash: !!this.edge.flash, sel: this.edge.sel || null,
    };
    if (inp.sprint && this.crouchT && az > 0) { this.crouchT = false; inp.crouch = k.has('ControlLeft'); }
    this.edge = {};
    void dt;
    return inp;
  }

  // ---------------------------------------------------------------- frame
  resize() {
    const w = Math.max(1, this.root.clientWidth || window.innerWidth);
    const hgt = Math.max(1, this.root.clientHeight || window.innerHeight);
    const pr = Math.min(this.basePR, Math.sqrt(this.pixelBudget / (w * hgt))) * this.scale;
    if (w === this.w && hgt === this.h2 && pr === this.pr) return;
    this.renderer.setDrawingBufferSize(w, hgt, pr);
    this.post.setSize(this.renderer.domElement.width, this.renderer.domElement.height);
    this.camera.aspect = w / hgt; this.camera.updateProjectionMatrix();
    this.panel.resize();
    this.w = w; this.h2 = hgt; this.pr = pr;
  }

  adapt(dt) {
    const f = this.ft;
    f.clock += dt; f.acc += dt; f.n++;
    if (f.acc < 1.2) return;
    const avg = f.acc / f.n; f.acc = 0; f.n = 0;
    this.fps = 1 / avg;
    if (avg > 1 / 47 && this.scale > 0.55) { this.scale = Math.max(0.55, this.scale - (avg > 1 / 35 ? 0.15 : 0.08)); f.lastDrop = f.clock; this.resize(); }
    else if (avg < 1 / 54 && this.scale < 1 && f.clock - f.lastDrop > 8) { this.scale = Math.min(1, this.scale + 0.05); this.resize(); }
  }

  render(dt, extra = {}) {
    if (this.contextLost) return;
    const sim = this.sim, R = sim.r, cam = this.camera;
    if (!this.manual) this.adapt(dt);
    // panel overlay follows the sim
    if (R.panel && !this.panel.isOpen) this.panel.open(R.panel.id, this.locked);
    if (!R.panel && this.panel.isOpen) this.panel.close();
    this.panel.update(sim);
    // head bob / sway
    const b = this.bob;
    const sp = R.moving;
    const target = sp > 0.3 ? clamp(sp / 3.1, 0, 1.7) * (R.crouch ? 0.022 : R.sprint ? 0.048 : 0.032) : 0;
    b.amp += (target - b.amp) * (1 - Math.exp(-dt * 8));
    if (sp > 0.3) b.ph += dt * (R.sprint ? 12.2 : R.crouch ? 6.4 : 9.0);
    const strafe = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    b.roll += ((-strafe * 0.018) - b.roll) * (1 - Math.exp(-dt * 6));
    const fovT = (this.settings.fov || 74) + (R.sprint ? 6 : 0) - (R.crouch ? 2 : 0) - (R.panel ? 10 : 0);
    b.fov += (fovT - (b.fov || fovT)) * (1 - Math.exp(-dt * 6)) || fovT;
    if (Math.abs(cam.fov - b.fov) > 0.01) { cam.fov = b.fov; cam.updateProjectionMatrix(); }
    const bx = Math.cos(b.ph) * b.amp * 0.6, by = Math.abs(Math.sin(b.ph)) * b.amp - b.amp * 0.5;
    const fx = Math.cos(this.yaw), fz = Math.sin(this.yaw);
    cam.position.set(R.x - fz * bx, R.eye + by, R.z + fx * bx);
    // turn to face the panel while it is open
    if (R.panel) {
      const p = this.L.panels[R.panel.id];
      const ty = Math.atan2(p.z - R.z, p.x - R.x), tp = Math.atan2(p.y - R.eye, Math.max(0.3, Math.hypot(p.x - R.x, p.z - R.z)));
      const k = 1 - Math.exp(-dt * 7);
      this.yaw += angDiff(ty, this.yaw) * k; this.pitch += (tp - this.pitch) * k;
    }
    const yaw = this.yaw, pitch = this.pitch;
    cam.rotation.set(pitch + Math.sin(b.ph * 2) * b.amp * 0.08, Math.atan2(-Math.cos(yaw), -Math.sin(yaw)), b.roll + Math.cos(b.ph) * b.amp * 0.12);
    // flashlight
    this.flashOn += ((R.flash ? 1 : 0) - this.flashOn) * (1 - Math.exp(-dt * 25));
    this.flash.intensity = this.flashOn * 9;
    // auto exposure (eye adaptation) from the light around the runner
    const lit = this.world.lighting.sample(R.x, R.z) + this.flashOn * 0.35;
    const expT = clamp(0.95 / (0.22 + lit * 0.9), 0.9, 2.6);
    this.exposure += (expT - this.exposure) * (this.snapExposure ? 1 : 1 - Math.exp(-dt * 0.9));
    this.snapExposure = false;
    const u = this.post.u;
    u.uExposure.value = this.exposure;
    this.world.update(sim, dt, cam, extra);
    // HUD
    this.yawView = yaw;
    this.hud.update(sim, { yaw, panelOpen: this.panel.isOpen });
    this.updateMark(sim, cam);
    const seen = this.hud.seenLevel || 0;
    u.uSeen.value += (seen * 0.8 - u.uSeen.value) * (1 - Math.exp(-dt * 4));
    u.uAlarm.value = sim.alarm > 0 ? (sim.alarm >= 2 ? 0.35 : 0.18) * (0.6 + 0.4 * Math.sin(this.ft.clock * 4)) : 0;
    this.post.render(dt);
    if (!this.stats.hidden) {
      txt(this.stats, `${Math.round(this.fps)} FPS · ${Math.round(this.pr * 100)}% DPR · ${this.quality.toUpperCase()}`);
    }
    if (sim.phase !== 'play') this.pause.classList.remove('show');
    else if (this.pause.classList.contains('show')) renderPlan(this.planEl, this.hud.step(sim));
  }

  // van's waypoint marker, projected into the runner's view (clamped to screen edges)
  updateMark(sim, cam) {
    const m = sim.mark, el = this.markEl;
    if (!m || sim.t - m.t > 20) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
    // camera space first: a point beside/behind the camera has no sane projection
    cam.updateMatrixWorld();
    const p = this._mv.set(m.x, 1.0, m.z).applyMatrix4(cam.matrixWorldInverse);
    let x, y, off;
    if (p.z < -0.2) { p.applyMatrix4(cam.projectionMatrix); x = p.x; y = p.y; off = Math.abs(x) > 0.92 || Math.abs(y) > 0.86; }
    else { x = p.x; y = p.y; off = true; if (Math.abs(x) + Math.abs(y) < 1e-4) y = -1; }
    if (off) { const k = Math.min(0.92 / Math.max(Math.abs(x), 1e-6), 0.86 / Math.max(Math.abs(y), 1e-6)); x *= k; y *= k; }
    const W = this.hudRoot.clientWidth, H = this.hudRoot.clientHeight;
    el.style.display = 'block';
    el.style.transform = `translate(${((x + 1) / 2 * W) | 0}px,${((1 - y) / 2 * H) | 0}px)`;
    el.classList.toggle('edge', off);
    const d = Math.hypot(m.x - sim.r.x, m.z - sim.r.z);
    const t = d.toFixed(0) + ' m';
    if (el._t !== t) { el._t = t; el.lastChild.textContent = t; }
    el.classList.toggle('fresh', sim.t - m.t < 1.5);
  }
  dispose() {
    this.unbindInput();
    this.hudRoot.remove(); this.pause.remove();
    this.stats.remove(); this.gpuStatus.remove();
    this.post.dispose();
    if (this.flash.shadow && this.flash.shadow.map) this.flash.shadow.map.dispose();
  }
}
export { EYE };
