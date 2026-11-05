// Transports. Every backend exposes the same tiny "presence" model: each peer
// owns one JSON object that it keeps current with set(patch); everyone sees
// everyone's latest object. That is all the game needs - the runner's object
// carries the live snapshot, the hacker's carries un-acked commands, and both
// carry crew/lobby state. Absolute state, so dropped updates self-heal.
//
//   room - claude.ai artifact `room` capability (named room per crew code)
//   ws   - our own relay (server.js /ws), e.g. through a Cloudflare tunnel
//   bc   - BroadcastChannel: two tabs in one browser (testing)
const rid = () => Math.random().toString(36).slice(2, 10);
const MAX_JPEG = 24000;

class Link {
  constructor(kind) {
    this.kind = kind; this.me = rid(); this.mine = {}; this.others = new Map(); // id -> {p, at}
    this.fns = new Set(); this.state = 'connecting'; this.err = '';
  }
  onChange(fn) { this.fns.add(fn); return () => this.fns.delete(fn); }
  emitChange() { for (const f of this.fns) try { f(this); } catch (e) { console.error(e); } }
  peers() { return [...this.others.entries()].map(([id, o]) => ({ id, p: o.p, at: o.at })); }
  merge(target, patch) { for (const k in patch) { if (patch[k] === null) delete target[k]; else target[k] = patch[k]; } return target; }
  setState(s, err) { if (this.state !== s || err) { this.state = s; this.err = err || ''; this.emitChange(); } }
  canSendBodycam() { return this.state === 'online'; }
  bodycamBudget() { return MAX_JPEG; }
  bodycam(id) { return this.others.get(id)?.cam; }
  receiveBodycam(id, cam) {
    const o = this.others.get(id);
    if (o?.p.job?.n && o.p.job.n === cam?.job && Number.isSafeInteger(cam.n) &&
        typeof cam.jpeg === 'string' && cam.jpeg.length <= MAX_JPEG && cam.jpeg.startsWith('/9j/')) o.cam = cam;
  }
}

// ---------------- claude.ai room ----------------
const PRESENCE_SOFT_MAX = 3800; // bytes; the platform limit is 4096
const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
function presenceBytes(o) { const j = JSON.stringify(o); return enc ? enc.encode(j).length : j.length * 2; }
class RoomLink extends Link {
  constructor(roomNs, name) { super('room'); this.ns = roomNs; this.name = name; }
  async open() {
    this.r = await this.ns.join(this.name);
    const sync = () => {
      const next = new Map();
      for (const p of this.r.peers()) {
        if (p.sameTab) { this.me = p.peer; continue; }
        if (p.kind !== 'viewer') continue;
        next.set(p.peer, { p: p.presence || {}, at: p.updatedAt || Date.now() });
      }
      this.others = next; this.emitChange();
    };
    this.unsub = [
      this.r.onPeers(sync, (e) => this.setState('offline', e.code)),
      this.r.onConnection((c) => this.setState(c ? 'online' : 'connecting'), (e) => this.setState('offline', e.code)),
    ];
    this.setState(this.r.connected() ? 'online' : 'connecting');
    if (Object.keys(this.mine).length) this.r.presence(this.mine).catch(() => {});
    return this;
  }
  set(patch) {
    this.merge(this.mine, patch);
    // The room caps a player's whole presence at 4 KiB, and an oversized patch is
    // dropped outright (which would freeze the van's feed). If we ever get close,
    // shed the crew's job history from what we publish - it's cosmetic.
    const crew = this.mine.crew;
    // A preview is expendable. Preserve the snapshots and crew history first.
    if (this.mine.cam && presenceBytes(this.mine) > PRESENCE_SOFT_MAX) {
      delete this.mine.cam;
      patch = { ...patch, cam: null };
    }
    if (crew && crew.history && crew.history.length && presenceBytes(this.mine) > PRESENCE_SOFT_MAX) {
      const lite = { ...crew, history: crew.history.slice() };
      this.mine.crew = lite;
      while (lite.history.length && presenceBytes(this.mine) > PRESENCE_SOFT_MAX) lite.history.pop();
      patch = { ...patch, crew: lite };
    }
    if (this.r) this.r.presence(patch).catch((e) => { if (e && e.code === 'invalid_argument') console.warn('presence too large', e.message); });
  }
  bodycamBudget() {
    const { cam, ...game } = this.mine;
    return Math.min(2160, PRESENCE_SOFT_MAX - presenceBytes(game) - 100);
  }
  sendBodycam({ job, n, jpeg }) {
    if (!this.canSendBodycam() || this.mine.job?.n !== job || jpeg.length > this.bodycamBudget()) return;
    this.set({ cam: { job, n, chunks: jpeg.match(/.{1,900}/g) } });
  }
  bodycam(id) { return this.others.get(id)?.p.cam; }
  close() { if (this.unsub) this.unsub.forEach((u) => u()); if (this.r) this.r.leave().catch(() => {}); }
}

// ---------------- WebSocket relay ----------------
class WsLink extends Link {
  constructor(url, name) { super('ws'); this.url = url; this.name = name; this.tries = 0; this.closed = false; }
  open() {
    return new Promise((resolve, reject) => {
      let first = true;
      const go = () => {
        if (this.closed) return;
        let ws;
        try { ws = new WebSocket(this.url); } catch (e) { if (first) { first = false; reject(e); } return; }
        this.ws = ws;
        const failT = setTimeout(() => { try { ws.close(); } catch { /* ignore */ } }, 6000);
        ws.onopen = () => {
          clearTimeout(failT); this.tries = 0;
          ws.send(JSON.stringify({ t: 'join', room: this.name }));
          if (Object.keys(this.mine).length) ws.send(JSON.stringify({ t: 'p', p: this.mine }));
          this.setState('online');
          if (first) { first = false; resolve(this); }
        };
        ws.onmessage = (ev) => {
          let m; try { m = JSON.parse(ev.data); } catch { return; }
          if (m.t === 'hello') { this.me = m.id; this.others = new Map(m.peers.map((o) => [o.id, { p: o.p || {}, at: Date.now() }])); this.emitChange(); }
          else if (m.t === 'join') { this.others.set(m.id, { p: {}, at: Date.now() }); ws.send(JSON.stringify({ t: 'p', p: this.mine })); this.emitChange(); }
          else if (m.t === 'p') { const o = this.others.get(m.id) || { p: {}, at: 0 }; this.merge(o.p, m.p); o.at = Date.now(); this.others.set(m.id, o); this.emitChange(); }
          else if (m.t === 'cam') this.receiveBodycam(m.id, m.cam);
          else if (m.t === 'l') { this.others.delete(m.id); this.emitChange(); }
          else if (m.t === 'full') this.setState('offline', 'room full');
        };
        ws.onclose = () => {
          clearTimeout(failT);
          if (first) { first = false; reject(new Error('relay unreachable')); return; }
          if (this.closed) return;
          this.others.clear(); this.setState('connecting');
          const wait = Math.min(8000, 500 * 2 ** this.tries++);
          setTimeout(go, wait);
        };
        ws.onerror = () => {};
      };
      go();
    });
  }
  set(patch) {
    this.merge(this.mine, patch);
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'p', p: patch }));
  }
  canSendBodycam() { return super.canSendBodycam() && this.ws?.readyState === 1 && this.ws.bufferedAmount === 0; }
  sendBodycam(cam) { if (this.canSendBodycam()) this.ws.send(JSON.stringify({ t: 'cam', cam })); }
  close() { this.closed = true; try { this.ws.close(); } catch { /* ignore */ } }
}

// ---------------- BroadcastChannel (same browser) ----------------
class BcLink extends Link {
  constructor(name) { super('bc'); this.name = name; }
  open() {
    const bc = this.bc = new BroadcastChannel(this.name);
    bc.onmessage = (ev) => {
      const m = ev.data; if (!m || m.id === this.me) return;
      if (m.t === 'hi') { bc.postMessage({ t: 'p', id: this.me, p: this.mine, whole: true }); }
      if (m.t === 'hi' || m.t === 'p') {
        const o = this.others.get(m.id) || { p: {}, at: 0 };
        if (m.whole) o.p = {};
        if (m.p) this.merge(o.p, m.p);
        o.at = Date.now(); this.others.set(m.id, o); this.emitChange();
      } else if (m.t === 'l') { this.others.delete(m.id); this.emitChange(); }
      else if (m.t === 'cam') this.receiveBodycam(m.id, m.cam);
    };
    bc.postMessage({ t: 'hi', id: this.me, p: this.mine });
    this.beat = setInterval(() => {
      bc.postMessage({ t: 'p', id: this.me, p: this.mine, whole: true });
      const now = Date.now(); let ch = false;
      for (const [id, o] of this.others) if (now - o.at > 5000) { this.others.delete(id); ch = true; }
      if (ch) this.emitChange();
    }, 1000);
    this.unload = () => bc.postMessage({ t: 'l', id: this.me });
    addEventListener('pagehide', this.unload);
    this.setState('online');
    return Promise.resolve(this);
  }
  set(patch) { this.merge(this.mine, patch); this.bc.postMessage({ t: 'p', id: this.me, p: patch }); }
  sendBodycam(cam) { this.bc.postMessage({ t: 'cam', id: this.me, cam }); }
  close() { clearInterval(this.beat); removeEventListener('pagehide', this.unload); try { this.unload(); this.bc.close(); } catch { /* ignore */ } }
}

let roomNs; // memoized claude.use('room') result
async function roomCapability() {
  if (roomNs !== undefined) return roomNs;
  const c = typeof window !== 'undefined' && window.claude;
  if (!c || typeof c.use !== 'function') return (roomNs = null);
  try { roomNs = await Promise.race([c.use('room'), new Promise((r) => setTimeout(() => r(null), 10000))]); } catch { roomNs = null; }
  return roomNs;
}
export async function hasRoom() { return !!(await roomCapability()); }

// Pick the best transport for this page. `force` = 'room' | 'ws' | 'bc'.
export async function openLink(code, force) {
  const name = 'ij-' + String(code).toLowerCase().replace(/[^a-z0-9]/g, '');
  const order = force ? [force] : ['room', 'ws', 'bc'];
  let lastErr = null;
  for (const kind of order) {
    try {
      if (kind === 'room') { const ns = await roomCapability(); if (!ns) continue; return await new RoomLink(ns, name).open(); }
      if (kind === 'ws') {
        if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol) || typeof WebSocket === 'undefined') continue;
        const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
        return await new WsLink(url, name).open();
      }
      if (kind === 'bc' && typeof BroadcastChannel !== 'undefined') return await new BcLink(name).open();
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('no transport available');
}
