// Concept: The Sieve. Company chips pour into a sorting machine and fall through three gates:
// hiring now? → replied? → interested? Rejected chips slide off into the gutter; leads land in your tray.
// The pointer pushes the stream around. Scrolling travels down the machine.
(function () {
  const S = Story(4);
  const cv = document.getElementById("sieve");
  const ctx = cv.getContext("2d");
  const tray = document.getElementById("svTray"), list = document.getElementById("svList"), countEl = document.getElementById("svCount");
  const hint = document.getElementById("svHint");
  const BLUE = "#2f4cff", INK = "18,19,21";
  let W = 0, H = 0, dpr = 1, wide = true, cx = 0, cw = 200;
  const GATES = [
    { label: "Hiring right now?", pass: 0, out: 0 },
    { label: "Replied?", pass: 0, out: 0 },
    { label: "Interested?", pass: 0, out: 0 },
  ];
  const gateY = (g) => H * (g + 1) + H * 0.55; // gate g = 0..2
  const trayY = () => H * 4 + H * 0.45;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    wide = W > 960;
    cx = wide ? W * 0.68 : W * 0.5;
    cw = Math.min(wide ? 230 : W * 0.42, 260);
  }
  addEventListener("resize", resize);
  resize();

  // funnel walls of the hopper, in world coordinates
  const walls = () => [
    [cx - cw, H * 0.2, cx - 34, H * 0.78],
    [cx + cw, H * 0.2, cx + 34, H * 0.78],
  ];

  const parts = [];
  const LEADS = [
    ["Sarah K.", "Head of Talent · \"Send me two profiles\""],
    ["James O.", "Ops Director · \"Free for a call Thursday?\""],
    ["Leah M.", "Talent Partner · \"Yes, interested\""],
    ["Dan W.", "Senior Engineer · \"What's the salary range?\""],
    ["Amira H.", "HR Manager · \"Can you send a quote?\""],
    ["Tom R.", "Founder · \"Let's talk next week\""],
  ];
  let leadCount = 0, spawnAcc = 0;
  const pointer = { x: -999, y: -999, t: 0 };
  addEventListener("pointermove", (e) => {
    const r = cv.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.t = performance.now();
  }, { passive: true });

  function spawn() {
    const r = Math.random();
    const fate = r < 0.04 ? 3 : r < 0.12 ? 2 : r < 0.28 ? 1 : 0;
    parts.push({ x: cx + (Math.random() * 2 - 1) * cw * 0.85, y: -20 - Math.random() * 40, vx: (Math.random() - 0.5) * 40, vy: 60, fate, level: 0, roll: -1, dying: 0, a: 1, rot: 0 });
  }

  function collideSeg(p, s) {
    const [x1, y1, x2, y2] = s;
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / len2));
    const qx = x1 + dx * t, qy = y1 + dy * t;
    const ex = p.x - qx, ey = p.y - qy, d = Math.hypot(ex, ey), R = 8;
    if (d < R && d > 0.001) {
      const nx = ex / d, ny = ey / d;
      p.x = qx + nx * R; p.y = qy + ny * R;
      const vn = p.vx * nx + p.vy * ny;
      if (vn < 0) { p.vx -= 1.3 * vn * nx; p.vy -= 1.3 * vn * ny; }
    }
  }

  function addLead() {
    const [n, q] = LEADS[leadCount % LEADS.length];
    leadCount++;
    if (countEl) countEl.textContent = leadCount;
    const el = document.createElement("div");
    el.className = "sv-item";
    el.innerHTML = `<b>${n}</b><span>${q}</span><em>Interested</em>`;
    list.prepend(el);
    while (list.children.length > 4) list.lastChild.remove();
  }

  function step(dt, viewTop, heroW) {
    spawnAcc += dt * (S.reduce ? 20 : 70);
    while (spawnAcc > 1 && parts.length < 1400) { spawn(); spawnAcc--; }
    const ws = walls();
    const pushOn = performance.now() - pointer.t < 3000;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      const py = p.y;
      if (p.roll < 0) p.vy += 900 * dt;
      // the pointer pushes chips away
      if (pushOn) {
        const dx = p.x - pointer.x, dy = p.y - viewTop - pointer.y, d = Math.hypot(dx, dy);
        if (d < 90 && d > 1) { const f = (1 - d / 90) * 2600 * dt; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
      }
      p.vx *= 0.996;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vx * dt * 0.02;
      const cap = p.y < H * 0.85 ? 240 : 560;
      if (p.vy > cap) p.vy = cap;
      if (p.y < H * 0.8) for (const s of ws) collideSeg(p, s);
      // column walls below the hopper
      if (p.y > H * 0.8 && p.roll < 0 && !p.dying) {
        if (p.x < cx - cw + 6) { p.x = cx - cw + 6; p.vx = Math.abs(p.vx) * 0.4; }
        if (p.x > cx + cw - 6) { p.x = cx + cw - 6; p.vx = -Math.abs(p.vx) * 0.4; }
      }
      // gates
      for (let g = 0; g < 3; g++) {
        const gy = gateY(g);
        if (p.level === g && p.roll < 0 && !p.dying && py < gy && p.y >= gy) {
          if (p.fate > g) { p.level = g + 1; GATES[g].pass++; p.vy *= 0.6; p.vx += (cx - p.x) * 0.8; }
          else { GATES[g].out++; p.roll = g; p.y = gy - 5; p.vy = 0; p.vx = (p.x < cx ? -1 : 1) * (140 + Math.random() * 140); }
        }
      }
      if (p.roll >= 0) {
        p.y = gateY(p.roll) - 5;
        if (Math.abs(p.x - cx) > cw) { p.roll = -1; p.dying = 1; }
      }
      if (p.dying) { p.a -= dt * 0.9; p.vy += 900 * dt * 0; }
      if (p.level === 3 && p.y >= trayY() - 20) { addLead(); parts.splice(i, 1); continue; }
      if (p.a <= 0 || p.y > H * 5.2) parts.splice(i, 1);
    }
  }

  function chip(x, y, rot, w, h, fill, stroke, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 2.5);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.restore();
  }

  function draw(viewTop, now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(0, -viewTop);
    ctx.font = "600 12px 'Inter Tight', Arial, sans-serif";
    // hopper
    ctx.strokeStyle = `rgba(${INK},.25)`; ctx.lineWidth = 1.5;
    for (const [x1, y1, x2, y2] of walls()) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    // column rails
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.moveTo(cx - cw, H * 0.8); ctx.lineTo(cx - cw, trayY() - 40);
    ctx.moveTo(cx + cw, H * 0.8); ctx.lineTo(cx + cw, trayY() - 40);
    ctx.stroke();
    ctx.setLineDash([]);
    // gates
    GATES.forEach((g, k) => {
      const y = gateY(k);
      const glow = 0.5 + 0.5 * Math.sin(now / 300 + k);
      ctx.strokeStyle = BLUE; ctx.globalAlpha = 0.35 + glow * 0.3; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - cw, y); ctx.lineTo(cx + cw, y); ctx.stroke();
      ctx.globalAlpha = 1;
      // label pill
      const label = `Gate ${k + 1} · ${g.label}`;
      const tw = ctx.measureText(label).width + 20;
      ctx.fillStyle = BLUE; ctx.beginPath(); ctx.roundRect(cx - cw, y - 34, tw, 24, 12); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(label, cx - cw + 10, y - 18);
      ctx.fillStyle = `rgba(${INK},.55)`;
      const stat = `✓ ${g.pass.toLocaleString("en-US")} through   ✕ ${g.out.toLocaleString("en-US")} set aside`;
      ctx.fillText(stat, cx + cw - ctx.measureText(stat).width, y - 18);
    });
    // gutters
    ctx.fillStyle = `rgba(${INK},.35)`;
    ctx.fillText("set aside", cx - cw - 66, gateY(0) + 20);
    // chips
    for (const p of parts) {
      if (p.y < viewTop - 20 || p.y > viewTop + H + 20) continue;
      const a = Math.max(0, p.a);
      if (p.dying) chip(p.x, p.y, p.rot, 15, 10, "#e9e7e2", "rgba(18,19,21,.2)", a * 0.8);
      else if (p.level === 0) chip(p.x, p.y, p.rot, 15, 10, "#ffffff", "rgba(18,19,21,.45)", a);
      else if (p.level === 1) chip(p.x, p.y, p.rot, 16, 11, BLUE, null, a);
      else if (p.level === 2) {
        chip(p.x, p.y, p.rot, 17, 12, BLUE, null, a);
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, 7); ctx.fill();
      } else {
        ctx.save(); ctx.shadowColor = "rgba(47,76,255,.6)"; ctx.shadowBlur = 12;
        chip(p.x, p.y, p.rot, 22, 15, BLUE, "#fff", a);
        ctx.restore();
      }
    }
    // tray
    const ty = trayY();
    ctx.strokeStyle = BLUE; ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(cx - 90, ty - 30); ctx.lineTo(cx - 70, ty); ctx.lineTo(cx + 70, ty); ctx.lineTo(cx + 90, ty - 30); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // fill the machine before the first frame so every gate already has traffic
  for (let k = 0; k < 420; k++) step(1 / 30, 0, 1);
  list.innerHTML = ""; leadCount = 0;
  for (const k of [0, 1, 2]) addLead();

  loop((dt, now) => {
    const { cs, heroW } = S.update(dt);
    const viewTop = (cs / 4) * (H * 4);
    step(dt, viewTop, heroW);
    draw(viewTop, now);
    // tray card sits beside the tray
    const ty = trayY() - viewTop;
    tray.style.opacity = K.smooth((cs - 3.3) / 0.5).toFixed(3);
    tray.style.transform = `translate3d(${(wide ? cx + 110 : cx - 125).toFixed(0)}px, ${(wide ? ty - 150 : ty - 290).toFixed(0)}px, 0)`;
    hint.style.opacity = (heroW * 0.9).toFixed(2);
    hint.style.transform = `translate3d(${cx.toFixed(0)}px, ${(H * 0.86).toFixed(0)}px, 0) translateX(-50%)`;
  });
})();
