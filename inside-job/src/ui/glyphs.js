// Ten keypad glyphs drawn as vector paths (shared by 3D panel, runner overlay and hacker cipher card).
export function drawGlyph(ctx, idx, cx, cy, s, color, lw) {
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s / 100, s / 100);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw || 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const P = () => ctx.beginPath();
  switch (idx) {
    case 0: // anchor
      P(); ctx.arc(0, -34, 9, 0, Math.PI * 2); ctx.stroke();
      P(); ctx.moveTo(0, -25); ctx.lineTo(0, 38); ctx.stroke();
      P(); ctx.moveTo(-20, -8); ctx.lineTo(20, -8); ctx.stroke();
      P(); ctx.arc(0, 8, 32, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
      P(); ctx.moveTo(-30, 18); ctx.lineTo(-24, 34); ctx.moveTo(30, 18); ctx.lineTo(24, 34); ctx.stroke();
      break;
    case 1: // crescent
      P(); ctx.arc(0, 0, 36, 0.35 * Math.PI, 1.65 * Math.PI); ctx.arc(14, 0, 28, 1.55 * Math.PI, 0.45 * Math.PI, true); ctx.closePath(); ctx.fill();
      break;
    case 2: // eye
      P(); ctx.moveTo(-42, 0); ctx.quadraticCurveTo(0, -38, 42, 0); ctx.quadraticCurveTo(0, 38, -42, 0); ctx.stroke();
      P(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      break;
    case 3: // trident
      P(); ctx.moveTo(0, 42); ctx.lineTo(0, -40); ctx.stroke();
      P(); ctx.moveTo(-26, -36); ctx.lineTo(-26, -8); ctx.quadraticCurveTo(-26, 6, 0, 6); ctx.quadraticCurveTo(26, 6, 26, -8); ctx.lineTo(26, -36); ctx.stroke();
      P(); ctx.moveTo(-34, -28); ctx.lineTo(-26, -40); ctx.lineTo(-18, -28); ctx.moveTo(-8, -32); ctx.lineTo(0, -44); ctx.lineTo(8, -32); ctx.moveTo(18, -28); ctx.lineTo(26, -40); ctx.lineTo(34, -28); ctx.stroke();
      break;
    case 4: // key
      P(); ctx.arc(-22, 0, 16, 0, Math.PI * 2); ctx.stroke();
      P(); ctx.moveTo(-6, 0); ctx.lineTo(42, 0); ctx.moveTo(30, 0); ctx.lineTo(30, 14); ctx.moveTo(40, 0); ctx.lineTo(40, 12); ctx.stroke();
      break;
    case 5: // spiral
      P(); for (let a = 0; a < Math.PI * 5.2; a += 0.15) { const r = 3 + a * 2.4; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
      break;
    case 6: // crown
      P(); ctx.moveTo(-38, 24); ctx.lineTo(-38, -18); ctx.lineTo(-18, 2); ctx.lineTo(0, -30); ctx.lineTo(18, 2); ctx.lineTo(38, -18); ctx.lineTo(38, 24); ctx.closePath(); ctx.stroke();
      P(); ctx.moveTo(-38, 36); ctx.lineTo(38, 36); ctx.stroke();
      break;
    case 7: // hourglass
      P(); ctx.moveTo(-28, -40); ctx.lineTo(28, -40); ctx.lineTo(-28, 40); ctx.lineTo(28, 40); ctx.closePath(); ctx.stroke();
      P(); ctx.moveTo(-12, 28); ctx.lineTo(12, 28); ctx.lineTo(0, 16); ctx.closePath(); ctx.fill();
      break;
    case 8: // flame
      P(); ctx.moveTo(0, 42); ctx.bezierCurveTo(-40, 40, -30, 0, -12, -16); ctx.bezierCurveTo(-8, -2, -2, 0, 0, -6); ctx.bezierCurveTo(4, -26, 10, -34, 6, -46);
      ctx.bezierCurveTo(30, -26, 40, 8, 26, 30); ctx.bezierCurveTo(20, 38, 10, 42, 0, 42); ctx.stroke();
      break;
    case 9: { // star
      P();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 17 : 42, a = -Math.PI / 2 + i * Math.PI / 5; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.closePath(); ctx.stroke();
      break;
    }
    default:
  }
  ctx.restore();
}

export function glyphCanvas(idx, size, color, bg) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size); }
  drawGlyph(ctx, idx, size / 2, size / 2, size * 0.8, color, 8);
  return c;
}
