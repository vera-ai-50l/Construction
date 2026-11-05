// Drawing of wall panels. The same routine draws the small texture on the 3D
// panel and the big close-up the runner sees after pressing E.
import { drawGlyph } from './glyphs.js';
import { FUSE_COLORS } from '../core/data.js';

const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif';

function hazard(g, x, y, w, h) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#e8b420'; g.fillRect(x, y, w, h);
  g.fillStyle = '#16161a';
  for (let i = -h; i < w + h; i += h * 1.4) { g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + h * 0.7, y + h); g.lineTo(x + i + h * 1.4, y); g.lineTo(x + i + h * 0.7, y); g.fill(); }
  g.restore();
}
function screw(g, x, y, r) { g.fillStyle = '#8a9096'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#4a4f55'; g.lineWidth = r * 0.35; g.beginPath(); g.moveTo(x - r * 0.6, y); g.lineTo(x + r * 0.6, y); g.stroke(); }
function plate(g, w, h, top, bottom) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = w * 0.012; g.strokeRect(w * 0.006, w * 0.006, w - w * 0.012, h - w * 0.012);
  const r = w * 0.018; screw(g, r * 2.2, r * 2.2, r); screw(g, w - r * 2.2, r * 2.2, r); screw(g, r * 2.2, h - r * 2.2, r); screw(g, w - r * 2.2, h - r * 2.2, r);
}

// p: level panel; s: sim panel state (or decoded); st: {zoneOn, now}
export function drawPanel(g, w, h, p, s, st = {}) {
  const u = w / 256;
  g.save();
  g.textBaseline = 'middle'; g.textAlign = 'center';
  const locked = s.lock > (st.now || 0) ? Math.ceil(s.lock - st.now) : 0;
  if (p.kind === 'junction') {
    plate(g, w, h, '#a7adb3', '#7d848b');
    hazard(g, 14 * u, 14 * u, w - 28 * u, 16 * u);
    g.fillStyle = '#1b1d21'; g.font = `700 ${17 * u}px ${COND}`; g.fillText('NETWORK JUNCTION', w / 2, 46 * u);
    g.font = `600 ${12 * u}px ${COND}`; g.fillStyle = '#34383d'; g.fillText('SECURITY ZONE ' + (p.zone + 1) + '  ·  AUTHORISED ACCESS ONLY', w / 2, 63 * u);
    // serial sticker
    g.fillStyle = '#f2efe6'; g.fillRect(30 * u, 84 * u, w - 60 * u, 92 * u);
    g.strokeStyle = '#c9c3b2'; g.lineWidth = 2 * u; g.strokeRect(30 * u, 84 * u, w - 60 * u, 92 * u);
    g.fillStyle = '#55524a'; g.font = `600 ${11 * u}px ${MONO}`; g.textAlign = 'left'; g.fillText('S/N  (UPLINK KEY)', 40 * u, 98 * u);
    g.textAlign = 'center'; g.fillStyle = '#111'; g.font = `600 ${38 * u}px ${MONO}`;
    g.fillText(s.done ? 'LINKED' : s.code || '--', w / 2, 136 * u);
    // barcode
    let bx = 44 * u; for (let i = 0; i < 46; i++) { const bw = ((i * 7 + (s.code || '').charCodeAt(i % 6) | 0) % 3 + 1) * u; g.fillStyle = '#222'; g.fillRect(bx, 160 * u, bw, 10 * u); bx += bw + 1.6 * u; if (bx > w - 44 * u) break; }
    // ports + LED
    for (let i = 0; i < 4; i++) { g.fillStyle = '#222428'; g.fillRect((44 + i * 44) * u, 196 * u, 30 * u, 20 * u); g.fillStyle = '#c8a24a'; g.fillRect((48 + i * 44) * u, 204 * u, 22 * u, 4 * u); }
    const led = s.done || st.zoneOn ? '#3cff7a' : locked ? '#ff3b30' : '#ffb020';
    g.fillStyle = led; g.shadowColor = led; g.shadowBlur = 12 * u; g.beginPath(); g.arc(w - 40 * u, 232 * u, 6 * u, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    g.fillStyle = '#1b1d21'; g.font = `600 ${11 * u}px ${MONO}`; g.textAlign = 'left';
    g.fillText(locked ? 'TAMPER LOCK ' + locked + 's' : s.done || st.zoneOn ? 'UPLINK ACTIVE' : 'AWAITING UPLINK', 30 * u, 232 * u);
  } else if (p.kind === 'keypad' || p.kind === 'vaultpad') {
    const vault = p.kind === 'vaultpad';
    plate(g, w, h, vault ? '#3b3f45' : '#2a2d32', vault ? '#202327' : '#17191c');
    g.fillStyle = vault ? '#d9b46a' : '#9aa3ad'; g.font = `700 ${16 * u}px ${COND}`;
    g.fillText(vault ? 'VAULT SEAL · CIPHER LOCK' : 'LASER GRID · CIPHER LOCK', w / 2, 26 * u);
    // screen with glyphs
    const sx = 18 * u, sy = 40 * u, sw = w - 36 * u, sh = 96 * u;
    g.fillStyle = '#071410'; g.fillRect(sx, sy, sw, sh);
    const n = (s.glyphs || []).length;
    const col = s.done ? '#3cff7a' : locked ? '#ff4a3a' : '#7dffc4';
    if (s.done) { g.fillStyle = col; g.font = `700 ${30 * u}px ${COND}`; g.fillText(vault ? 'SEAL RELEASED' : 'GRID DISARMED', w / 2, sy + sh / 2); }
    else if (locked) { g.fillStyle = col; g.font = `700 ${26 * u}px ${COND}`; g.fillText('LOCKED ' + locked + 's', w / 2, sy + sh / 2); }
    else {
      const gs = Math.min(44 * u, (sw - 16 * u) / n);
      for (let i = 0; i < n; i++) {
        const cx = sx + sw / 2 + (i - (n - 1) / 2) * gs;
        drawGlyph(g, s.glyphs[i], cx, sy + 38 * u, gs * 0.72, i < (s.entry ? s.entry.length : 0) ? '#2f6e55' : col, 9);
        g.fillStyle = i < (s.entry ? s.entry.length : 0) ? col : '#1e3a30';
        g.fillRect(cx - gs * 0.3, sy + 74 * u, gs * 0.6, 6 * u);
      }
    }
    // scanlines
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = sy; y < sy + sh; y += 3 * u) g.fillRect(sx, y, sw, u);
    // keys
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '<', '0', 'OK'];
    for (let i = 0; i < 12; i++) {
      const kx = 40 * u + (i % 3) * 60 * u, ky = 150 * u + Math.floor(i / 3) * 24 * u;
      g.fillStyle = '#4a4f57'; g.fillRect(kx, ky, 54 * u, 20 * u);
      g.fillStyle = '#d8dde2'; g.font = `600 ${12 * u}px ${MONO}`; g.fillText(keys[i], kx + 27 * u, ky + 10.5 * u);
    }
  } else if (p.kind === 'fuse') {
    plate(g, w, h, '#5f6b55', '#3e4738');
    g.fillStyle = '#e9ecef'; g.font = `700 ${16 * u}px ${COND}`;
    g.fillText('POWER DISTRIBUTION · ' + (p.effect === 'cams' ? 'CCTV' : 'LIGHTING') + ' · ZONE ' + (p.target + 1), w / 2, 24 * u);
    hazard(g, 14 * u, 36 * u, w - 28 * u, 8 * u);
    const fs = s.fuses || [];
    for (let i = 0; i < 6; i++) {
      const f = fs[i] || { c: 4, n: 0 };
      const cx = 30 * u + i * 39 * u;
      g.fillStyle = '#1b1e22'; g.fillRect(cx - 14 * u, 62 * u, 28 * u, 120 * u);
      g.fillStyle = '#bfc4c9'; g.font = `600 ${12 * u}px ${MONO}`; g.fillText(String(i + 1), cx, 196 * u);
      if (!f.pulled) {
        g.fillStyle = FUSE_COLORS[f.c].css; g.fillRect(cx - 11 * u, 70 * u, 22 * u, 104 * u);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(cx - 9 * u, 72 * u, 5 * u, 100 * u);
        g.fillStyle = '#111'; g.font = `700 ${20 * u}px ${COND}`; g.fillText(String(f.n), cx, 122 * u);
      } else { g.fillStyle = '#0b0c0e'; g.fillRect(cx - 11 * u, 70 * u, 22 * u, 104 * u); }
    }
    const msg = s.done ? 'BYPASS COMPLETE' : locked ? 'BREAKER TRIPPED ' + locked + 's' : 'PULL IN SEQUENCE';
    g.fillStyle = s.done ? '#3cff7a' : locked ? '#ff4a3a' : '#f5c518'; g.font = `700 ${15 * u}px ${COND}`; g.fillText(msg, w / 2, 230 * u);
  }
  g.restore();
}

export function panelTitle(p) {
  return p.kind === 'junction' ? 'Network junction · Zone ' + (p.zone + 1)
    : p.kind === 'keypad' ? 'Laser grid keypad' : p.kind === 'vaultpad' ? 'Vault seal keypad'
      : 'Fuse box · ' + (p.effect === 'cams' ? 'cameras' : 'lights') + ' zone ' + (p.target + 1);
}
