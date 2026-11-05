// The game shell: title -> crew -> safehouse (roles, job board, upgrades) ->
// job (runner hosts the Sim, hacker drives the van) -> results -> safehouse.
//
// Sync protocol: every player owns one presence object on the crew's link.
//   who  {v, name, role, ready, pick:{id,k}}   lobby state
//   crew {..., rev}                           shared progression, highest rev wins
//   job  {n, c, roles}                        runner: a job is live (null after)
//   s, sn                                     runner: latest snapshot for job n
//   h    {n, cmd, hold}                       hacker: un-acked commands + timelock hold
//   res  {n, c, sum, pay}                     runner: results of job n
import { getRenderer, guessQuality } from './render/gfx.js';
import { loadAssets } from './render/assets.js';
import { generateLevel } from './core/level.js';
import { Sim } from './core/sim.js';
import { World } from './render/world.js';
import { RunnerView } from './game/runner.js';
import { BodycamCapture } from './game/bodycam.js';
import { HackerView } from './ui/hacker.js';
import { openLink } from './net/link.js';
import { newCrew, tierOf, notoriety, makeBoard, dailyContract, todayStr, upgradeList, buyUpgrade, payout, applyResult } from './core/meta.js';
import { THEMES, TWISTS, LOOT, RATINGS } from './core/data.js';
import { RNG, crewCode } from './core/rng.js';
import { h, txt, cls, money, clock, clear } from './ui/dom.js';
import { sfx, eventSound } from './audio/sfx.js';

const PROTO = 1;
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams((typeof location !== 'undefined' && location.search) || '');
const store = {
  get(k, d) { try { const v = localStorage.getItem('ij.copy.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ij.copy.' + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};
const DEFAULT_SETTINGS = { sens: 1, invert: false, fov: 74, quality: 'auto', vol: 0.8, stats: false };
const ROLE = {
  runner: { name: 'Runner', tag: 'Goes inside', desc: 'First-person. Sneak past guards, read the panels out loud, grab the loot and get back to the van.',
    icon: '<svg viewBox="0 0 24 24"><circle cx="14" cy="4.5" r="2.2" fill="currentColor"/><path d="M9 21l2.5-6.5L14 17v4M7 12l3-4 4 1 2 4 3 1M11.5 14.5L13 9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  hacker: { name: 'Hacker', tag: 'Stays in the van', desc: 'Live blueprint. Watch the guards, loop cameras, open doors, decode keypads and talk the runner through.',
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M8 20h8M12 16v4M7 8l2.5 2L7 12M12 12h4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
};
// The How to play tab: the job flow both players follow, then what each role does.
const HOW_STEPS = [
  ['Get inside', 'The Runner picks the lock on the side entrance (hold E). The Hacker calls out guards and cameras.'],
  ['Network each zone', 'The building has 2 or 3 zones. In each one the Runner finds the grey junction box, opens it and reads the serial out loud ("Kilo-Delta, four-four-nine"). The Hacker types it in. That zone\'s doors, cameras and lasers are now the Hacker\'s.'],
  ['Open the next security door', 'Zones are sealed by security doors. After a zone is networked, the Hacker clicks the door into the next zone (1 BW) so the Runner can go and find that zone\'s junction.'],
  ['Crack the vault keypad', 'Beside the vault door. The Runner describes each symbol ("looks like an anchor"). The Hacker finds it on the cipher card and reads back the digit.'],
  ['Run the timelock together', 'The Runner holds E on the vault wheel while the Hacker holds Space. It uses about 6 bandwidth, so the Hacker saves up first.'],
  ['Grab the target and get out', 'Take the target from the vault, carry it back to the van and hold E to stash it. Grab more loot if you dare, then hold E at the van to drive away.'],
];
function howToPlay() {
  const card = (role, title, items) => h('div.how-role', null, h('div.how-rh', null, h('span.role-ic', { html: ROLE[role].icon }), h('b', { text: title })),
    h('ul', null, ...items.map(([k, v]) => h('li', null, h('b', { text: k }), ' ', v))));
  return h('div.how', null,
    h('p.how-lead', { text: 'Every job follows the same plan. Both of you see the current step during the job: the Runner at the top left, the Hacker in THE PLAN card, with the next spot flashing on the map. Press Esc in the Runner view to see every step.' }),
    h('ol.how-steps', null, ...HOW_STEPS.map(([t, d], i) => h('li', null, h('span.how-n', { text: String(i + 1) }), h('div', null, h('b', { text: t }), h('p', { text: d }))))),
    h('div.how-roles', null,
      card('runner', 'Runner (goes inside)', [
        ['WASD', 'move, mouse to look. Click the game to lock the mouse.'],
        ['Hold E', 'to interact: locks, panels, loot, the van.'],
        ['C', 'crouch (quiet and harder to see). Shift sprints, which is loud.'],
        ['Stay dark.', 'The eye meter at the bottom left shows how visible you are. Red arcs show who is noticing you.'],
        ['1/2/3 + G', 'gadgets: EMP, smoke, noisemaker. F flashlight. Q takedown from behind (costs the Clean bonus).'],
      ]),
      card('hacker', 'Hacker (stays in the van)', [
        ['You see', 'the whole building, the cameras and any guard the Runner or a camera can see. The Runner cannot.'],
        ['Click', 'a camera to loop it (3 BW), a laser to drop it (2 BW), a security door to open it (1 BW). Only in networked zones.'],
        ['1–6', 'pick a tool. Lights, Ping and Lure work on rooms.'],
        ['Right-click', 'to drop a marker the Runner sees in their view.'],
        ['Bandwidth', 'refills slowly. Keep about 6 for the vault timelock.'],
      ])),
    h('p.hint', { text: 'Three alerts and the police come. Getting spotted by a guard or a camera, tripping a laser, or two wrong codes on a panel each raise the alert level. Optional panels: laser keypads shut a laser off for good, fuse boxes kill a zone\'s cameras or lights.' }));
}

const THEME_ICON = {
  bank: '<svg viewBox="0 0 24 24"><path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  museum: '<svg viewBox="0 0 24 24"><path d="M12 3l3 6H9zM6 21V11h12v10M10 21v-5h4v5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg>',
  tech: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" stroke="currentColor" stroke-width="1.6"/><rect x="9.5" y="9.5" width="5" height="5" fill="currentColor"/></svg>',
};

export class App {
  constructor() {
    this.screens = $('#screens');
    this.settings = { ...DEFAULT_SETTINGS, ...store.get('settings', {}) };
    sfx.setVolume(this.settings.vol);
    this.name = params.get('name') || store.get('name', '');
    this.me = { v: PROTO, name: this.name, role: null, ready: false, pick: null };
    this.crew = null; this.link = null; this.partner = null;
    this.job = null; this.lastJobN = null; this.mode = 'title';
    this.renderer = null; this.assets = null; this.assetP = null;
    window.IJ = { app: this };
    addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
    addEventListener('keydown', () => sfx.unlock(), { capture: true });
    this.hideLoading();
    const crew = params.get('crew');
    if (crew && this.name) this.enterCrew(crew.toUpperCase());
    else this.showTitle();
  }

  // ------------------------------------------------------------ helpers
  progress(p, text) {
    const l = $('#loading'); l.classList.add('show');
    l.querySelector('.ld-bar i').style.width = Math.round(p * 100) + '%';
    if (text != null) l.querySelector('.ld-txt').textContent = text;
  }
  hideLoading() { $('#loading').classList.remove('show'); }
  show(el, mode) { clear(this.screens); if (el) this.screens.appendChild(el); this.mode = mode; }
  toast(text, kind = '') {
    const root = $('#toast-root');
    const t = h('div.app-toast' + (kind ? '.' + kind : ''), { text });
    root.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
  }
  btn(label, cl, on, attrs = {}) {
    return h('button.btn' + (cl ? '.' + cl : ''), { ...attrs, onclick: (e) => { sfx.play('click'); on(e); }, onmouseenter: () => sfx.play('hover') }, label);
  }
  saveCrew() {
    if (!this.crew) return;
    store.set('crew.' + this.crew.code, this.crew);
    const list = store.get('crews', []).filter((c) => c.code !== this.crew.code);
    list.unshift({ code: this.crew.code, at: Date.now() }); store.set('crews', list.slice(0, 6));
  }

  // ------------------------------------------------------------ title
  showTitle() {
    if (this.link) { this.link.close(); this.link = null; }
    const nameIn = h('input.field', { value: this.name, maxlength: 16, placeholder: 'Your name', spellcheck: false, autocomplete: 'off' });
    const codeIn = h('input.field.code', { maxlength: 5, placeholder: 'CODE', spellcheck: false, autocomplete: 'off',
      oninput: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); } });
    const needName = () => {
      const n = nameIn.value.trim().slice(0, 16);
      if (!n) { nameIn.focus(); nameIn.classList.remove('shake'); void nameIn.offsetWidth; nameIn.classList.add('shake'); return null; }
      this.name = n; this.me.name = n; store.set('name', n); return n;
    };
    const recent = store.get('crews', []);
    const el = h('div.scr.title', null,
      h('div.title-bg'),
      h('div.title-main', null,
        h('div.title-kicker', { text: 'A TWO-PLAYER CO-OP HEIST' }),
        h('h1.title-logo', null, h('span', { text: 'INSIDE' }), h('span.b', { text: 'JOB' })),
        h('p.title-tag', { text: 'One of you goes in. One of you stays in the van. Neither of you can do it alone.' }),
        h('div.title-form', null,
          h('label.lbl', { text: 'YOUR NAME' }), nameIn,
          h('div.title-actions', null,
            this.btn('Start a new crew', 'primary', () => { if (!needName()) return; this.enterCrew(crewCode(new RNG(String(Math.random())))); }),
            h('div.join', null, codeIn, this.btn('Join', '', () => { if (!needName()) return; const c = codeIn.value; if (c.length !== 5) { codeIn.focus(); return; } this.enterCrew(c); }))),
          recent.length ? h('div.title-recent', null, h('span.lbl', { text: 'YOUR CREWS' }),
            ...recent.slice(0, 4).map((r) => {
              const c = store.get('crew.' + r.code, null);
              return this.btn(h('span', null, h('b', { text: r.code }), h('small', { text: c ? money(c.wallet) + ' · ' + notoriety(c) : '' })), 'ghost.crew', () => { if (!needName()) return; this.enterCrew(r.code); });
            })) : null),
        h('div.title-foot', null,
          this.btn('Settings', 'ghost.sm', () => this.openSettings()),
          h('span', { text: 'Best on a voice call. Runner: mouse + keyboard. Hacker: mouse.' }))));
    this.show(el, 'title');
    setTimeout(() => (this.name ? codeIn : nameIn).focus(), 50);
  }

  // ------------------------------------------------------------ crew / link
  async enterCrew(code) {
    code = code.toUpperCase();
    this.crew = store.get('crew.' + code, null) || newCrew(code);
    this.saveCrew();
    this.me = { v: PROTO, name: this.name, role: params.get('role') || store.get('role.' + code, null), ready: false, pick: null };
    this.progress(0.5, 'Connecting to crew ' + code + '…');
    try {
      this.link = await openLink(code, params.get('net'));
    } catch (e) {
      this.hideLoading();
      this.toast('Could not connect: ' + (e && e.message), 'bad');
      this.showTitle(); return;
    }
    this.hideLoading();
    this.link.set({ who: this.me, crew: this.crew, job: null, res: null, s: null, h: null, jobError: null, cam: null });
    this.link.onChange(() => this.netDirty());
    if (this.me.role === 'runner') this.preloadRunner();
    this.showSafehouse();
    if (params.has('auto')) this.autoPilot();
  }
  // coalesce bursts of peer updates; setTimeout (not rAF) so a hidden tab still reacts
  netDirty() { if (!this.netQ) { this.netQ = true; setTimeout(() => { this.netQ = false; this.onNet(); }, 30); } }

  findPartner() {
    let best = null;
    for (const p of this.link.peers()) {
      const w = p.p && p.p.who;
      if (!w || w.v !== PROTO) continue;
      if (!best || p.at > best.at) best = p;
    }
    return best;
  }

  onNet() {
    if (!this.link) return;
    const prev = this.partner;
    this.partner = this.findPartner();
    const P = this.partner && this.partner.p;
    if (!!prev !== !!this.partner && this.mode === 'safehouse') this.toast(this.partner ? (P.who.name || 'Partner') + ' joined the crew' : 'Partner left', this.partner ? 'good' : 'warn');
    // crew sync: highest rev wins
    if (P && P.crew && P.crew.code === this.crew.code && (P.crew.rev > this.crew.rev || (P.crew.rev === this.crew.rev && P.crew.total > this.crew.total))) {
      this.crew = JSON.parse(JSON.stringify(P.crew)); this.saveCrew(); this.link.set({ crew: this.crew });
      if (this.mode === 'safehouse') this.renderTab();
    }
    // a job started by the runner
    if (P && P.job && P.job.n !== this.lastJobN && P.who.role === 'runner' && this.mode !== 'job') {
      this.lastJobN = P.job.n; this.startJob(P.job, 'hacker');
    }
    // results from the runner
    if (this.mode === 'job' && this.role === 'hacker' && P && P.res && P.res.n === this.job.n) this.finishJob(P.res);
    if (this.mode === 'job' && this.role === 'hacker' && P?.jobError === this.job.n) {
      this.job = null;
      this.showSafehouse();
      this.toast('Runner graphics could not start. Try another graphics preset.', 'bad');
    }
    if (this.mode === 'safehouse') { this.updateSafehouse(); this.maybeStart(); }
  }

  setMe(patch) {
    Object.assign(this.me, patch);
    if (this.link) this.link.set({ who: { ...this.me } });
    if (this.mode === 'safehouse') this.netDirty(); // my own change can complete the start condition
  }

  // ------------------------------------------------------------ safehouse
  contracts() {
    const daily = dailyContract(todayStr());
    return [daily, ...makeBoard(this.crew)];
  }
  effectivePick() {
    const a = this.me.pick, b = this.partner && this.partner.p.who.pick;
    if (!a) return b || null; if (!b) return a;
    return b.k > a.k || (b.k === a.k && this.partner.id < this.link.me) ? b : a;
  }
  pick(id) {
    const b = this.partner && this.partner.p.who.pick;
    const k = Math.max(this.me.pick ? this.me.pick.k : 0, b ? b.k : 0) + 1;
    this.setMe({ pick: { id, k }, ready: false });
    this.updateSafehouse();
  }

  showSafehouse() {
    if (this.view || this.hk) this.teardownJob();
    sfx.stopAll();
    const el = this.sh = {};
    el.partner = h('div.crew-card.partner');
    el.mecard = h('div.crew-card.me');
    el.roles = {};
    const roleRow = h('div.roles');
    for (const r of ['runner', 'hacker']) {
      const R = ROLE[r];
      el.roles[r] = h('button.role', { onclick: () => { sfx.play('click'); this.chooseRole(r); }, onmouseenter: () => sfx.play('hover') },
        h('span.role-ic', { html: R.icon }), h('span.role-t', null, h('b', { text: R.name }), h('small', { text: R.tag })), h('span.role-d', { text: R.desc }), h('span.role-who'));
      roleRow.appendChild(el.roles[r]);
    }
    el.tabs = {};
    const tabBar = h('div.tabs');
    for (const [id, label] of [['how', 'How to play'], ['jobs', 'Job board'], ['up', 'Upgrades'], ['hist', 'History']]) {
      el.tabs[id] = this.btn(label, 'tab', () => { this.tab = id; this.renderTab(); });
      tabBar.appendChild(el.tabs[id]);
    }
    this.tab = this.tab || (this.crew.jobs ? 'jobs' : 'how');
    el.body = h('div.tab-body');
    el.ready = this.btn('READY', 'primary.big', () => this.setMe({ ready: !this.me.ready }) || this.updateSafehouse());
    el.status = h('div.sh-status');
    el.net = h('span.netpill');
    el.stats = h('div.sh-stats');
    el.root = h('div.scr.safehouse', null,
      h('div.sh-top', null,
        h('div.sh-brand', null, h('span.mk'), h('b', { text: 'SAFEHOUSE' })),
        h('div.sh-code', null, h('small', { text: 'CREW CODE' }), h('b', { text: this.crew.code }),
          this.btn('Copy', 'ghost.sm', () => this.copyCode())),
        el.stats,
        h('div.sh-tr', null, el.net, this.btn('Settings', 'ghost.sm', () => this.openSettings()), this.btn('Leave', 'ghost.sm', () => this.showTitle()))),
      h('div.sh-main', null,
        h('div.sh-left', null,
          h('div.sec-t', { text: 'THE CREW' }), el.mecard, el.partner,
          h('div.sec-t', { text: 'PICK YOUR ROLE' }), roleRow),
        h('div.sh-right', null, tabBar, el.body)),
      h('div.sh-bottom', null, el.status, el.ready));
    this.show(el.root, 'safehouse');
    this.renderTab();
    this.onNet();
  }
  copyCode() {
    const code = this.crew.code;
    const done = () => this.toast('Crew code ' + code + ' copied - send it to your partner', 'good');
    try { navigator.clipboard.writeText(code).then(done, () => this.toast('Your crew code is ' + code)); } catch { this.toast('Your crew code is ' + code); }
  }
  chooseRole(r) {
    this.setMe({ role: r, ready: false });
    store.set('role.' + this.crew.code, r);
    if (r === 'runner') this.preloadRunner();
    this.updateSafehouse();
  }

  renderTab() {
    const el = this.sh; if (!el) return;
    for (const k in el.tabs) cls(el.tabs[k], 'on', k === this.tab);
    clear(el.body);
    const crew = this.crew;
    if (this.tab === 'how') {
      el.body.appendChild(howToPlay());
    } else if (this.tab === 'jobs') {
      const list = this.contracts();
      el.cards = {};
      const grid = h('div.jobs');
      for (const c of list) {
        const th = THEMES[c.theme], tw = TWISTS[c.twist];
        const done = c.daily && crew.dailyDone[c.daily];
        const card = h('button.job' + (c.daily ? '.daily' : '') + (c.big ? '.big' : ''), { onclick: () => { sfx.play('click'); this.pick(c.id); }, onmouseenter: () => sfx.play('hover') },
          h('div.job-h', null, h('span.job-ic', { html: THEME_ICON[c.theme] }), h('span.job-kind', { text: c.daily ? 'DAILY CONTRACT' : c.big ? 'BIG SCORE' : th.name.toUpperCase() }),
            h('span.job-tier', null, ...Array.from({ length: 10 }, (_, i) => h('i' + (i < c.tier ? '.on' : ''))))),
          h('div.job-name', { text: c.name.replace(/^(BIG SCORE|Daily): /, '') }),
          h('div.job-target', null, h('small', { text: 'TARGET' }), h('span', { text: LOOT[c.target].name })),
          h('div.job-twist' + (c.twist !== 'none' ? '.on' : ''), null, h('b', { text: tw.name }), h('span', { text: tw.desc })),
          h('div.job-f', null, h('span', { text: 'EST. TAKE' }), h('b', { text: money(c.est) })),
          done ? h('div.job-done', { text: 'Done today · best ' + money(done) }) : null,
          h('div.job-picks'));
        el.cards[c.id] = card; grid.appendChild(card);
      }
      el.body.appendChild(grid);
      el.body.appendChild(h('p.hint', { text: 'Either of you can pick the job. A new board deals after every job; the daily contract is the same for every crew today.' }));
    } else if (this.tab === 'up') {
      const grid = h('div.ups');
      for (const u of upgradeList(crew)) {
        const can = u.cost != null && crew.wallet >= u.cost;
        grid.appendChild(h('div.up' + (u.cost == null ? '.max' : ''), null,
          h('div.up-h', null, h('span.up-who', { text: u.who.toUpperCase() }), h('span.up-lv', null, ...Array.from({ length: u.max }, (_, i) => h('i' + (i < u.lvl ? '.on' : ''))))),
          h('b', { text: u.name }), h('p', { text: u.desc }),
          u.cost == null ? h('div.up-buy.max', { text: 'MAXED' }) :
            this.btn(money(u.cost), 'up-buy' + (can ? '' : '.no'), () => {
              if (!can) { sfx.play('bad'); return; }
              if (buyUpgrade(this.crew, u.id)) { sfx.play('secure'); this.saveCrew(); this.link.set({ crew: this.crew }); this.toast(u.name + ' upgraded', 'good'); this.renderTab(); this.updateSafehouse(); }
            })));
      }
      el.body.appendChild(h('p.hint', { text: 'Upgrades are shared by the crew. Either of you can buy them with the crew wallet.' }));
      el.body.appendChild(grid);
    } else {
      if (!crew.history.length) el.body.appendChild(h('div.empty', { text: 'No jobs yet. Your first score is waiting on the board.' }));
      const list = h('div.hist');
      for (const j of crew.history) {
        list.appendChild(h('div.hrow.' + j.result, null, h('span.res', { text: j.result === 'won' ? 'CLEAN' : j.result === 'bust' ? 'BUSTED' : 'BAILED' }),
          h('span.nm', { text: j.name }), h('span.tm', { text: clock(j.time) }), h('span.rt', { text: (j.ratings || []).map((r) => (RATINGS[r] ? RATINGS[r].name : 'SWITCH')).join(' · ') }), h('b', { text: money(j.pay) })));
      }
      el.body.appendChild(list);
      const b = crew.best;
      el.body.appendChild(h('div.bests', null,
        h('div', null, h('small', { text: 'BEST HAUL' }), h('b', { text: money(b.haul) })),
        h('div', null, h('small', { text: 'BEST STREAK' }), h('b', { text: String(b.streak) })),
        h('div', null, h('small', { text: 'FASTEST CLEAN JOB' }), h('b', { text: b.time ? clock(b.time) : '-' })),
        h('div', null, h('small', { text: 'LIFETIME TAKE' }), h('b', { text: money(crew.total) }))));
    }
    this.updateSafehouse();
  }

  updateSafehouse() {
    const el = this.sh; if (!el || this.mode !== 'safehouse') return;
    const crew = this.crew, P = this.partner && this.partner.p.who;
    const tier = tierOf(crew);
    clear(el.stats).append(
      h('div', null, h('small', { text: 'WALLET' }), h('b.gold', { text: money(crew.wallet) })),
      h('div', null, h('small', { text: 'NOTORIETY' }), h('b', { text: notoriety(crew) + ' · ' + tier })),
      h('div', null, h('small', { text: 'STREAK' }), h('b', { text: String(crew.streak) })),
      h('div', null, h('small', { text: 'JOBS' }), h('b', { text: crew.wins + ' / ' + crew.jobs })));
    const linkName = { room: 'claude.ai room', ws: 'relay server', bc: 'this browser' }[this.link.kind] || this.link.kind;
    txt(el.net, (this.link.state === 'online' ? '● ' : '○ ') + linkName);
    cls(el.net, 'on', this.link.state === 'online');
    const card = (who, me) => [h('div.cc-av', { text: (who && who.name ? who.name[0] : '?').toUpperCase() }),
      h('div.cc-t', null, h('b', { text: who ? who.name + (me ? ' (you)' : '') : 'Waiting for partner…' }),
        h('small', { text: who ? (who.role ? ROLE[who.role].name : 'No role yet') : 'Send them the crew code ' + crew.code })),
      h('span.cc-r' + (who && who.ready ? '.on' : ''), { text: who ? (who.ready ? 'READY' : 'NOT READY') : '' })];
    clear(el.mecard).append(...card(this.me, true));
    clear(el.partner).append(...card(P, false));
    cls(el.partner, 'empty', !P);
    for (const r of ['runner', 'hacker']) {
      cls(el.roles[r], 'on', this.me.role === r);
      cls(el.roles[r], 'taken', !!P && P.role === r);
      const who = [this.me.role === r ? 'You' : null, P && P.role === r ? P.name : null].filter(Boolean).join(' + ');
      txt(el.roles[r].querySelector('.role-who'), who);
    }
    const pick = this.effectivePick();
    if (el.cards) for (const id in el.cards) {
      const on = pick && pick.id === id;
      cls(el.cards[id], 'on', on);
      const tags = [];
      if (this.me.pick && this.me.pick.id === id) tags.push('You');
      if (P && P.pick && P.pick.id === id) tags.push(P.name);
      txt(el.cards[id].querySelector('.job-picks'), on ? 'SELECTED' + (tags.length ? ' · ' + tags.join(' + ') : '') : '');
    }
    // status line
    let s = '', ok = false;
    const c = pick && this.contracts().find((x) => x.id === pick.id);
    if (!this.me.role) s = 'Pick a role: Runner goes in, Hacker runs the van.';
    else if (!P) s = 'Waiting for your partner to join with code ' + crew.code + '.';
    else if (P.role === this.me.role) s = 'You both picked ' + ROLE[P.role].name + ' - one of you has to switch.';
    else if (!P.role) s = (P.name || 'Partner') + ' still has to pick a role.';
    else if (!c) s = 'Pick a job from the board.';
    else { ok = true; s = this.me.ready && P.ready ? 'Both ready - rolling out…' : this.me.ready ? 'Waiting for ' + (P.name || 'partner') + ' to ready up.' : 'Job: ' + c.name.replace(/^(BIG SCORE|Daily): /, '') + ' - ready up when you are set.'; }
    if (params.has('cheats') && this.me.role === 'runner') s += ' Test jobs do not count toward crew progress.';
    txt(el.status, s);
    cls(el.ready, 'on', this.me.ready);
    txt(el.ready, this.me.ready ? 'READY ✓' : 'READY');
    el.ready.disabled = !ok && !this.me.ready;
  }

  maybeStart() {
    const P = this.partner && this.partner.p.who;
    if (!P || !this.me.ready || !P.ready || this.me.role !== 'runner' || P.role !== 'hacker') return;
    const pick = this.effectivePick(); if (!pick) return;
    const c = this.contracts().find((x) => x.id === pick.id); if (!c) return;
    if (this.partner.p.crew && this.partner.p.crew.rev !== this.crew.rev) return; // wait for crew sync
    const n = this.crew.code + '-' + this.crew.jobs + '-' + Math.random().toString(36).slice(2, 7);
    const job = { n, c, roles: { runner: this.me.name, hacker: P.name }, test: params.has('cheats') };
    this.lastJobN = n;
    this.link.set({ job, res: null, jobError: null });
    this.startJob(job, 'runner');
  }

  // ------------------------------------------------------------ settings
  openSettings() {
    const s = this.settings;
    const row = (label, input, val) => h('label.set-row', null, h('span', { text: label }), input, val || null);
    const v = (x) => h('b.set-v', { text: x });
    const sensV = v(s.sens.toFixed(2)), fovV = v(String(s.fov)), volV = v(Math.round(s.vol * 100) + '%');
    const apply = () => { store.set('settings', s); sfx.setVolume(s.vol); if (this.view) { this.view.settings = s; } };
    const close = () => { modal.remove(); apply(); };
    const modal = h('div.modal', { onmousedown: (e) => e.stopPropagation(), onclick: (e) => { if (e.target === modal) close(); } },
      h('div.modal-card', null,
        h('div.modal-t', { text: 'SETTINGS' }),
        row('Mouse sensitivity', h('input', { type: 'range', min: 0.3, max: 2.5, step: 0.05, value: s.sens, oninput: (e) => { s.sens = +e.target.value; txt(sensV, s.sens.toFixed(2)); apply(); } }), sensV),
        row('Invert mouse Y', h('input', { type: 'checkbox', checked: s.invert, onchange: (e) => { s.invert = e.target.checked; apply(); } })),
        row('Field of view', h('input', { type: 'range', min: 60, max: 95, step: 1, value: s.fov, oninput: (e) => { s.fov = +e.target.value; txt(fovV, String(s.fov)); apply(); } }), fovV),
        row('Volume', h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.vol, oninput: (e) => { s.vol = +e.target.value; txt(volV, Math.round(s.vol * 100) + '%'); apply(); sfx.play('click'); } }), volV),
        row('Graphics', h('select', { onchange: (e) => { s.quality = e.target.value; apply(); this.toast('Graphics change applies on the next job'); } },
          ...['auto', 'high', 'medium', 'low'].map((q) => h('option', { value: q, selected: s.quality === q, text: q === 'auto' ? 'Auto (recommended)' : q[0].toUpperCase() + q.slice(1) })))),
        row('Show FPS', h('input', { type: 'checkbox', checked: s.stats, onchange: (e) => {
          s.stats = e.target.checked; if (this.view) this.view.stats.hidden = !s.stats; apply();
        } })),
        h('p.hint', { text: 'Auto lowers resolution when needed and uses a Retina-friendly preset on Mac.' }),
        this.btn('Done', 'primary', close)));
    document.getElementById('app').appendChild(modal);
  }

  // ------------------------------------------------------------ jobs
  preloadRunner() {
    if (this.assetP) return this.assetP;
    this.assetP = Promise.resolve().then(() => {
      this.renderer = getRenderer($('#stage'));
      this.renderer.domElement.style.display = 'none';
      return loadAssets(this.renderer, (p) => { this.assetProg = p; });
    }).then((a) => (this.assets = a));
    this.assetP.catch(() => { this.assetP = null; });
    return this.assetP;
  }

  async startJob(job, role) {
    this.mode = 'job'; this.job = job; this.role = role; this.sh = null;
    this.setMe({ ready: false });
    this.lastEv = 0;
    const c = job.c;
    const brief = c.name.replace(/^(BIG SCORE|Daily): /, '') + ' · ' + THEMES[c.theme].name + (c.twist !== 'none' ? ' · ' + TWISTS[c.twist].name : '');
    clear(this.screens);
    if (role === 'runner') {
      this.progress(0.05, 'Casing ' + brief + '…');
      const iv = setInterval(() => this.progress(0.05 + 0.8 * (this.assetProg || 0)), 100);
      try {
        await this.preloadRunner();
      } catch (e) {
        this.runnerFailed(job, e);
        return;
      } finally { clearInterval(iv); }
      if (this.job !== job) return;
      this.progress(0.9, 'Rolling up to ' + brief + '…');
      await new Promise((r) => setTimeout(r, 30));
      if (this.job !== job) return;
      let L, sim, view;
      try {
        const quality = this.settings.quality === 'auto' ? guessQuality(this.renderer) : this.settings.quality;
        L = this.L = generateLevel(c);
        sim = this.sim = new Sim(L, this.crew.up, { testMode: job.test });
        this.world = new World(L, this.assets, { quality });
        view = this.view = new RunnerView({ renderer: this.renderer, world: this.world, sim, L, contract: c, root: $('#stage'), quality, settings: this.settings });
        view.manual = params.has('manual');
        this.addPauseMenu(view);
        view.render(1 / 60);
        if (this.renderer.getContext().isContextLost()) throw new Error('WebGL context lost during startup');
        this.renderer.domElement.style.display = '';
      } catch (e) {
        this.runnerFailed(job, e);
        return;
      }
      this.bodycam = new BodycamCapture(this.link, job.n);
      this.hideLoading();
      sfx.ambience(true);
      window.IJ.sim = sim; window.IJ.view = view; window.IJ.L = L;
      this.netT = 0; this.lastStepT = -1; this.heartT = 0; this.endT = null; this.hackerSeen = 0;
      this.loop((dt) => this.runnerFrame(dt));
    } else {
      if (this.renderer) this.renderer.domElement.style.display = 'none';
      const L = this.L = generateLevel(c);
      const host = h('div.hk-host');
      this.screens.appendChild(host);
      this.hk = new HackerView(host, L, c, { showPlan: !this.crew || this.crew.jobs < 2, onCommand: () => { this.hkDirty = true; } });
      window.IJ.hk = this.hk; window.IJ.L = L;
      this.hkNetT = 0; this.waitT = 0;
      if (job.test) this.toast('Test job · Crew progress is disabled', 'warn');
      this.hkWait = h('div.hk-wait', null, h('b', { text: 'Waiting for the runner…' }), h('span', { text: 'They are loading into the building.' }));
      host.appendChild(this.hkWait);
      this.loop((dt) => this.hackerFrame(dt));
    }
  }

  runnerFailed(job, error) {
    if (this.job !== job) return;
    console.error('Runner startup failed', error);
    this.teardownJob();
    this.job = null;
    this.link.set({ job: null, jobError: job.n });
    this.hideLoading();
    this.showSafehouse();
    this.toast(this.renderer ? 'Runner graphics failed. Open Settings and try Low.' : 'WebGL 2 is unavailable. Check browser graphics acceleration.', 'bad');
  }

  loop(fn) {
    let last = performance.now();
    const id = this.loopId = Math.random();
    const step = (now) => {
      if (this.loopId !== id) return;
      const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000)); last = now;
      try { fn(dt); } catch (e) { console.error(e); }
      requestAnimationFrame(step);
    };
    if (params.has('manual')) { this.manualStep = fn; return; }
    requestAnimationFrame(step);
  }

  addPauseMenu(view) {
    const card = view.pause.firstChild;
    const stop = (e) => e.stopPropagation();
    card.appendChild(h('div.pause-btns', { onmousedown: stop },
      this.btn('Settings', 'ghost.sm', () => this.openSettings()),
      this.btn('Abort job', 'ghost.sm.bad', () => { if (this.sim && this.sim.phase === 'play') { this.sim.end('bail', 'abort'); } })));
  }

  runnerFrame(dt) {
    const sim = this.sim, view = this.view, P = this.partner && this.partner.p;
    const ho = P && P.h && P.h.n === this.job.n ? P.h : null;
    if (ho) this.hackerSeen = performance.now();
    if (!view.contextLost) {
      const inp = view.input(dt);
      sim.step(dt, inp, ho);
      view.render(dt);
      if (this.partner && sim.phase === 'play') this.bodycam.sample(this.renderer.domElement);
    }
    // sound
    for (const e of sim.events) {
      if (e.id <= this.lastEv) continue; this.lastEv = e.id;
      const s = eventSound(e.type, e.args, 'runner'); if (s) sfx.play(s);
    }
    if (sim.lastStep && sim.lastStep.t !== this.lastStepT) { this.lastStepT = sim.lastStep.t; sfx.play('step', { v: sim.lastStep.sprint ? 1 : sim.lastStep.crouch ? 0.15 : 0.5 }); }
    const seen = view.hud.seenLevel || 0;
    this.heartT -= dt;
    if (seen > 0.35 && this.heartT <= 0) { sfx.play('heart', { v: Math.min(1, seen) }); this.heartT = 1.1 - 0.5 * Math.min(1, seen); }
    sfx.alarm(sim.police >= 0 ? 3 : sim.lockdown > sim.t ? 2 : 0);
    // network
    this.netT -= dt;
    if (this.netT <= 0 && this.link) {
      this.netT = 1 / 15;
      this.link.set({ s: sim.snapshot(), sn: this.job.n });
    }
    if (!this.hkLost && this.hackerSeen && performance.now() - this.hackerSeen > 6000 && !this.partner) { this.hkLost = true; view.hud.toast('The van lost connection', 'bad'); }
    if (this.hkLost && this.partner) { this.hkLost = false; view.hud.toast('The van is back online', 'good'); }
    // end of job
    if (sim.phase !== 'play') {
      if (this.endT == null) this.endT = 0;
      this.endT += dt;
      if (this.endT > 2.2) {
        const sum = sim.summary(), c = this.job.c, roles = this.job.roles;
        const test = this.job.test;
        const pay = test ? { lines: [{ label: 'Test job · Crew progress is disabled', amt: 0 }], total: 0, ratings: [] } : payout(this.crew, c, sum, roles);
        if (!test) {
          applyResult(this.crew, c, sum, pay, roles);
          this.saveCrew();
        }
        const res = { n: this.job.n, c, sum, pay };
        this.link.set({ s: null, cam: null, res, job: null, crew: this.crew }); // results replace the live snapshot (presence is capped at 4 KiB)
        this.finishJob(res);
      }
    }
  }

  hackerFrame(dt) {
    const P = this.partner && this.partner.p, hk = this.hk;
    const frame = this.partner && this.link.bodycam(this.partner.id);
    hk.setBodycam(frame?.job === this.job.n ? frame : null);
    if (P && P.s && P.sn === this.job.n) {
      if (P.s !== this.lastSnap) {
        this.lastSnap = P.s; hk.setSnap(P.s);
        for (const e of P.s.ev) { if (e[0] <= this.lastEv) continue; this.lastEv = e[0]; const s = eventSound(e[1], e.slice(2), 'hacker'); if (s) sfx.play(s); }
        sfx.alarm(P.s.pt >= 0 ? 3 : P.s.ld ? 2 : 0);
      }
      if (this.hkWait) { this.hkWait.remove(); this.hkWait = null; sfx.ambience(true); }
      this.waitT = 0;
    } else if (!this.hkWait) {
      this.waitT += dt;
      if (this.waitT > 4) {
        this.hkWait = h('div.hk-wait', null, h('b', { text: 'Lost the runner' }), h('span', { text: 'Waiting for them to reconnect…' }), this.btn('Back to safehouse', 'ghost.sm', () => { this.job = null; this.showSafehouse(); }));
        this.screens.querySelector('.hk-host').appendChild(this.hkWait);
      }
    }
    hk.frame(dt);
    this.hkNetT -= dt;
    if (this.link && (this.hkDirty || this.hkNetT <= 0)) {
      this.hkDirty = false; this.hkNetT = 0.25;
      const o = hk.out();
      this.link.set({ h: { n: this.job.n, cmd: o.cmd.slice(-24), hold: o.hold } });
    }
  }

  teardownJob() {
    this.loopId = null; this.manualStep = null;
    sfx.stopAll();
    if (this.bodycam) { this.bodycam.dispose(); this.bodycam = null; }
    if (this.view) { this.view.dispose(); this.view = null; }
    if (this.world) { this.world.dispose(); this.world = null; }
    if (this.hk) { this.hk.dispose(); this.hk = null; }
    if (this.renderer) this.renderer.domElement.style.display = 'none';
    this.sim = null;
    if (this.link) this.link.set({ s: null, h: null, cam: null });
  }

  finishJob(res) {
    if (this.mode !== 'job') return;
    const role = this.role;
    this.teardownJob();
    this.mode = 'results';
    sfx.play(res.sum.result === 'won' ? 'win' : res.sum.result === 'bust' ? 'bust' : 'ok');
    const { sum, pay, c } = res;
    const title = sum.result === 'won' ? 'CLEAN GETAWAY' : sum.result === 'bust' ? 'BUSTED' : 'BAILED OUT';
    const sub = sum.result === 'won' ? 'You got the ' + LOOT[c.target].name + ' out.' : sum.result === 'bust' ? (sum.reason === 'police' ? 'The police got there first.' : 'A guard put the runner on the floor.') : 'You left without the target.';
    const lines = h('div.res-lines');
    pay.lines.forEach((l, i) => {
      const row = h('div.res-line' + (l.amt < 0 ? '.neg' : ''), { style: { animationDelay: (0.25 + i * 0.12) + 's' } }, h('span', { text: l.label }), h('b', { text: (l.amt < 0 ? '−' : '+') + money(Math.abs(l.amt)) }));
      lines.appendChild(row);
    });
    const ratings = h('div.res-ratings', null, ...['ghost', 'clean', 'fast', 'full'].map((k) => h('div.rt' + (pay.ratings.includes(k) ? '.on' : ''), null, h('b', { text: RATINGS[k].name }), h('small', { text: RATINGS[k].desc }))));
    const st = sum.stats;
    const el = h('div.scr.results.' + sum.result, null,
      h('div.res-card', null,
        h('div.res-kicker', { text: c.name.replace(/^(BIG SCORE|Daily): /, '') + ' · ' + clock(sum.time) }),
        h('h2.res-title', { text: title }), h('p.res-sub', { text: sub }),
        ratings, lines,
        h('div.res-total', null, h('span', { text: 'CREW TAKE' }), h('b', { text: money(pay.total) })),
        h('div.res-stats', null,
          h('span', { text: 'Spotted ' + st.spotted }), h('span', { text: 'Alarms ' + st.alarms }), h('span', { text: 'Takedowns ' + st.ko }),
          h('span', { text: 'Cams looped ' + st.camsLooped }), h('span', { text: 'Panel mistakes ' + st.mistakes })),
        h('div.res-foot', null, h('span', { text: 'You played ' + (role === 'runner' ? 'Runner' : 'Hacker') + '. Swap roles next job for a +10% Switch-Up bonus.' }),
          this.btn('Back to safehouse', 'primary', () => { this.job = null; this.showSafehouse(); }))));
    this.show(el, 'results');
  }

  // automated two-tab test: ?auto picks the first job and readies up
  autoPilot() {
    const t = setInterval(() => {
      if (this.mode !== 'safehouse') return;
      if (!this.me.pick && this.me.role === 'runner') this.pick(this.contracts()[1].id);
      if (!this.me.ready && this.partner && this.effectivePick()) this.setMe({ ready: true });
    }, 300);
    this.autoT = t;
  }
}

