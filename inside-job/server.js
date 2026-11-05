// Inside Job - self-hosted backup server. Zero dependencies (Node 18+).
//   node server.js            -> http://localhost:8080
// Serves dist/ and runs a tiny WebSocket relay at /ws so two browsers
// (anywhere, e.g. through a Cloudflare quick tunnel) can play together.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = Number(process.env.PORT || 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.exr': 'application/octet-stream', '.json': 'application/json', '.md': 'text/markdown', '.txt': 'text/plain; charset=utf-8' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p === '/index.html') p = '/play.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'content-length': st.size,
      'cache-control': p.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
});

// ---------------- minimal WebSocket (RFC 6455) ----------------
const rooms = new Map(); // room -> Map(id -> client)
let nextId = 1;

function frame(str) {
  const data = Buffer.from(str);
  const len = data.length;
  let head;
  if (len < 126) head = Buffer.from([0x81, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, data]);
}

function send(c, obj) { if (!c.dead) try { c.sock.write(frame(JSON.stringify(obj))); } catch { /* ignore */ } }

function broadcast(c, obj) {
  const r = rooms.get(c.room); if (!r) return;
  for (const o of r.values()) if (o !== c) send(o, obj);
}

function onMessage(c, text) {
  let m; try { m = JSON.parse(text); } catch { return; }
  if (m.t === 'join' && typeof m.room === 'string' && m.room.length < 64 && !c.room) {
    c.room = m.room;
    if (!rooms.has(c.room)) rooms.set(c.room, new Map());
    const r = rooms.get(c.room);
    if (r.size >= 6) { send(c, { t: 'full' }); c.sock.end(); return; }
    send(c, { t: 'hello', id: c.id, peers: [...r.values()].map((o) => ({ id: o.id, p: o.p })) });
    r.set(c.id, c);
    broadcast(c, { t: 'join', id: c.id });
  } else if (m.t === 'p' && c.room && m.p && typeof m.p === 'object') {
    for (const k in m.p) { if (m.p[k] === null) delete c.p[k]; else c.p[k] = m.p[k]; }
    broadcast(c, { t: 'p', id: c.id, p: m.p });
  } else if (m.t === 'cam' && c.room && c.p.who?.role === 'runner' && c.p.job?.n) {
    const cam = m.cam, now = Date.now();
    if (cam?.job !== c.p.job.n || !Number.isSafeInteger(cam.n) || now - (c.lastCam || 0) < 100 ||
        typeof cam.jpeg !== 'string' || cam.jpeg.length > 24000 || !cam.jpeg.startsWith('/9j/')) return;
    c.lastCam = now;
    for (const o of rooms.get(c.room).values()) {
      if (o.p.who?.role === 'hacker' && o.sock.writableLength === 0) send(o, { t: 'cam', id: c.id, cam });
    }
  } else if (m.t === 'ping') send(c, { t: 'pong', ts: m.ts });
}

function drop(c) {
  if (c.dead) return; c.dead = true;
  const r = rooms.get(c.room);
  if (r) { r.delete(c.id); broadcast(c, { t: 'l', id: c.id }); if (!r.size) rooms.delete(c.room); }
  try { c.sock.destroy(); } catch { /* ignore */ }
}

server.on('upgrade', (req, sock) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws' || !req.headers['sec-websocket-key']) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const c = { id: 'w' + (nextId++), sock, room: null, p: {}, buf: Buffer.alloc(0), frags: [], dead: false, alive: true };
  sock.on('data', (chunk) => {
    c.buf = Buffer.concat([c.buf, chunk]);
    for (;;) {
      if (c.buf.length < 2) return;
      const b0 = c.buf[0], b1 = c.buf[1];
      const op = b0 & 15, fin = b0 & 128, masked = b1 & 128;
      let len = b1 & 127, off = 2;
      if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) { drop(c); return; }
      const need = off + (masked ? 4 : 0) + len;
      if (c.buf.length < need) return;
      let payload = c.buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const mk = c.buf.subarray(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= mk[i & 3]; }
      c.buf = c.buf.subarray(need);
      c.alive = true;
      if (op === 8) { drop(c); return; }
      if (op === 9) { try { sock.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); } catch { /* ignore */ } continue; }
      if (op === 10) continue;
      if (op === 1 || op === 0) {
        c.frags.push(payload);
        if (fin) { const text = Buffer.concat(c.frags).toString('utf8'); c.frags = []; onMessage(c, text); }
      }
    }
  });
  sock.on('close', () => drop(c));
  sock.on('error', () => drop(c));
});

setInterval(() => {
  for (const r of rooms.values()) for (const c of r.values()) {
    if (!c.alive) { drop(c); continue; }
    c.alive = false;
    try { c.sock.write(Buffer.from([0x89, 0])); } catch { drop(c); }
  }
}, 15000);

server.listen(PORT, () => {
  console.log(`Inside Job running at http://localhost:${PORT}`);
  console.log('Share it with your partner:  npx cloudflared tunnel --url http://localhost:' + PORT);
});
