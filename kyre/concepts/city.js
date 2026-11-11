// Concept: Signal City. Your market as a small isometric city of companies, with Kyre's tower in the middle.
// Hover any building to see who it is. Scroll: a scan finds who's hiring, paper planes fly out to them,
// blue planes come back from the ones who reply, and the interested companies rise with their lead cards.
(function () {
  const S = Story(4);
  const cv = document.getElementById("city"), ctx = cv.getContext("2d");
  const tip = document.getElementById("ctTip"), cards = [...document.querySelectorAll(".ct-card")];
  const N = 15, HQ = 7;
  const BLUE = "#2f4cff";
  let W = 0, H = 0, dpr = 1, s = 20, ox = 0, oy = 0, wide = true;

  // deterministic random
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const A = ["North", "Corvel", "Fern", "Lumen", "Kestrel", "Halden", "Bright", "Oak", "Quanta", "Pine", "Meridian", "Stack", "Harbour", "Silver", "Ash", "Elm", "Granite", "Blue", "Copper", "Wren"];
  const B = ["wind Logistics", " Energy", "hill Homes", " Labs", " Systems", " Foods", "path Care", "ridge Group", " Retail", "crest Hotels", " Health", "wise", " Freight", "line Staffing", "ford Engineering", " Partners", " Build", " Talent", " Clinics", " Motors"];
  const ROLES = ["Posted 4 supervisor roles", "Hiring 2 engineers", "New Head of Sales", "Opened a new site", "Posted 6 technician roles", "Raised a Series A", "Hiring 3 nurses", "Growing the ops team"];
  const bs = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const d = Math.hypot(i - HQ, j - HQ);
    if (d > 7.6) continue;
    const hq = i === HQ && j === HQ;
    if (!hq && rnd() < 0.12) continue; // a few empty plots
    const b = {
      i, j, hq, h: hq ? 9 : 0.6 + rnd() * rnd() * 3.6 + (d < 3 ? 0.8 : 0),
      name: hq ? "Kyre" : A[(rnd() * A.length) | 0] + B[(rnd() * B.length) | 0],
      hiring: false, replied: false, interested: false, scan: 0, lift: 0, glow: 0,
    };
    if (!hq && rnd() < 0.2) { b.hiring = true; b.role = ROLES[(rnd() * ROLES.length) | 0]; }
    bs.push(b);
  }
  const hiring = bs.filter((b) => b.hiring);
  hiring.forEach((b, k) => { b.order = k / hiring.length; b.replied = k % 4 === 1; });
  const replied = hiring.filter((b) => b.replied);
  // three interested, spread around the city
  const byAngle = replied.slice().sort((a, b) => Math.atan2(a.j - HQ, a.i - HQ) - Math.atan2(b.j - HQ, b.i - HQ));
  const lucky = [byAngle[0], byAngle[Math.floor(byAngle.length / 3)], byAngle[Math.floor((2 * byAngle.length) / 3)]];
  lucky.forEach((b) => (b.interested = true));
  bs.sort((a, b) => a.i + a.j - (b.i + b.j) || a.i - b.i);
  const hq = bs.find((b) => b.hq);

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
    wide = W > 960;
    if (wide) { s = Math.min(W * 0.56, H * 1.25, 980) / (2 * N) * 1.12; ox = W * 0.68; oy = H * 0.58 - N * s * 0.5 + 30; }
    else { s = (W * 1.2) / (2 * N); ox = W / 2; oy = H * 0.1 + 40; }
  }
  addEventListener("resize", resize);
  resize();

  const U = () => s * 0.62; // height unit
  const P = (i, j, z) => [ox + (i - j) * s, oy + (i + j) * s * 0.5 - z * U()];

  const pointer = { x: -1e4, y: -1e4 };
  addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; }, { passive: true });
  document.addEventListener("pointerleave", () => { pointer.x = pointer.y = -1e4; });

  function poly(pts, fill, stroke) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  function building(b, h, top, left, right) {
    const m = 0.14, i0 = b.i + m, i1 = b.i + 1 - m, j0 = b.j + m, j1 = b.j + 1 - m;
    const t = [P(i0, j0, h), P(i1, j0, h), P(i1, j1, h), P(i0, j1, h)];
    const g1 = P(i0, j1, 0), g2 = P(i1, j1, 0), g3 = P(i1, j0, 0);
    const line = "rgba(18,19,21,.10)";
    poly([t[3], t[2], g2, g1], left, line);
    poly([t[2], t[1], g3, g2], right, line);
    poly(t, top, line);
    return P(b.i + 0.5, b.j + 0.5, h);
  }

  // paper plane at (x,y) heading angle a
  function plane(x, y, a, fill, sz) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.8, -sz * 0.6); ctx.lineTo(-sz * 0.4, 0); ctx.lineTo(-sz * 0.8, sz * 0.6); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = fill === "#ffffff" ? BLUE : "#fff"; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  function arc(a, b, t, lift) {
    const mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - lift;
    const u = 1 - t;
    const x = u * u * a[0] + 2 * u * t * mx + t * t * b[0], y = u * u * a[1] + 2 * u * t * my + t * t * b[1];
    const dx = 2 * u * (mx - a[0]) + 2 * t * (b[0] - mx), dy = 2 * u * (my - a[1]) + 2 * t * (b[1] - my);
    return [x, y, Math.atan2(dy, dx)];
  }

  let hover = null, time = 0;
  loop((dt, now) => {
    const { cs } = S.update(dt);
    time += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // ground plate
    const R = 7.9;
    ctx.beginPath();
    for (let a = 0; a <= 64; a++) { const th = (a / 64) * Math.PI * 2; const p = P(HQ + 0.5 + Math.cos(th) * R, HQ + 0.5 + Math.sin(th) * R, 0); a ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.fillStyle = "rgba(18,19,21,.035)"; ctx.fill();

    const scanPos = K.clamp((cs - 0.55) / 0.8, 0, 1.2) * 2.2 - 0.1; // 0..1 across the diagonal
    const scanLine = (cs > 0.5 && cs < 1.6) ? scanPos : -1;
    const roofs = new Map();
    let best = null, bestD = 1e9;

    for (const b of bs) {
      const diag = (b.i + b.j) / (2 * N);
      if (b.hiring && scanPos > diag * 2) b.scan = Math.min(1, b.scan + dt * 3);
      if (cs < 0.5) b.scan = Math.max(0, b.scan - dt * 2);
      const rise = b.interested ? K.smooth((cs - 3.3) / 0.5) * 3 : 0;
      b.lift += ((hover === b ? 0.5 : 0) - b.lift) * Math.min(1, dt * 10);
      const h = b.h + rise + b.lift + (b.hq ? Math.sin(time * 1.5) * 0.08 : 0);
      let top = "#ffffff", left = "#e6e3dc", right = "#d6d2c9";
      if (b.hq) { top = "#6f84ff"; left = BLUE; right = "#1f37d1"; }
      else if (b.interested && cs > 3.2) {
        const k = K.smooth((cs - 3.2) / 0.4);
        top = k > 0.5 ? "#6f84ff" : "#ffffff"; left = k > 0.5 ? BLUE : left; right = k > 0.5 ? "#1f37d1" : right;
      } else if (cs > 3.2) { top = "#f4f3ef"; left = "#ebe8e2"; right = "#e0ddd6"; }
      // scan band brightens what it passes
      if (scanLine >= 0 && Math.abs(diag * 2 - scanLine) < 0.06 && !b.hq) { top = "#eef1ff"; }
      if (hover === b && !b.hq && !(b.interested && cs > 3.4)) { left = "#dfe4ff"; right = "#cdd5ff"; top = "#f3f5ff"; }
      const roof = building(b, h, top, left, right);
      roofs.set(b, roof);
      // pick for hover: roof centre close to pointer, frontmost wins (later in draw order)
      const d = Math.hypot(roof[0] - pointer.x, roof[1] + s * 0.2 - pointer.y);
      if (d < s * 0.9 && d <= bestD + s * 0.4) { best = b; bestD = d; }
      // beacon on hiring buildings
      if (b.scan > 0 && cs < 3.25) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 4 + b.i);
        ctx.globalAlpha = b.scan;
        ctx.fillStyle = BLUE;
        ctx.beginPath(); ctx.arc(roof[0], roof[1] - 6, 3, 0, 7); ctx.fill();
        ctx.globalAlpha = b.scan * (0.25 + pulse * 0.25);
        ctx.beginPath(); ctx.arc(roof[0], roof[1] - 6, 6 + pulse * 4, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (b.interested && cs > 3.3) {
        const k = K.smooth((cs - 3.3) / 0.5);
        const g = ctx.createRadialGradient(roof[0], roof[1], 0, roof[0], roof[1], s * 2.4);
        g.addColorStop(0, `rgba(47,76,255,${0.35 * k})`); g.addColorStop(1, "rgba(47,76,255,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(roof[0], roof[1], s * 2.4, 0, 7); ctx.fill();
      }
    }
    hover = cs < 3.2 ? best : null;

    // planes out (stage 2) and back (stage 3)
    const top = roofs.get(hq);
    const out = (cs - 1.3) / 0.9;
    if (out > 0 && cs < 2.9) {
      for (const b of hiring) {
        const t = K.clamp((out - b.order * 0.6) / 0.4, 0, 1);
        if (t <= 0) continue;
        const r = roofs.get(b);
        if (t < 1) { const [x, y, a] = arc(top, r, K.ease(t), s * 3); plane(x, y, a, "#ffffff", s * 0.32); }
        ctx.globalAlpha = 0.18 * (1 - K.smooth((cs - 2.4) / 0.4));
        ctx.strokeStyle = BLUE; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.quadraticCurveTo((top[0] + r[0]) / 2, Math.min(top[1], r[1]) - s * 3, r[0], r[1]); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    const back = (cs - 2.3) / 0.8;
    if (back > 0 && cs < 3.6) {
      replied.forEach((b, k) => {
        const t = K.clamp((back - (k / replied.length) * 0.5) / 0.5, 0, 1);
        if (t <= 0 || t >= 1) return;
        const [x, y, a] = arc(roofs.get(b), top, K.ease(t), s * 2.5);
        plane(x, y, a, BLUE, s * 0.36);
      });
    }

    // tooltip
    if (hover && pointer.x > -1e3) {
      tip.style.opacity = "1";
      tip.querySelector("b").textContent = hover.name;
      tip.querySelector("span").textContent = hover.hq ? "Sends from mailboxes in your name" : hover.hiring ? hover.role : "Not hiring right now";
      tip.classList.toggle("hiring", hover.hiring || hover.hq);
      const r = roofs.get(hover);
      tip.style.transform = `translate3d(${(r[0] + 14).toFixed(0)}px, ${(r[1] - 46).toFixed(0)}px, 0)`;
    } else tip.style.opacity = "0";

    // lead cards in a row above the city, each tied to its building by a leader line
    const order = lucky.map((b, k) => [roofs.get(b)[0], k]).sort((a, b) => a[0] - b[0]);
    const cw = cards[0].offsetWidth, gap = 14;
    const rowW = cw * 3 + gap * 2;
    const left = K.clamp(ox - rowW / 2, wide ? Math.min(W * 0.4, W - rowW - 16) : 8, W - rowW - 8);
    order.forEach(([, k], slot) => {
      const c = cards[k], r = roofs.get(lucky[k]);
      const a = K.smooth((cs - 3.45 - slot * 0.08) / 0.35);
      c.style.opacity = a.toFixed(3);
      let x, y;
      if (wide) { x = left + slot * (cw + gap); y = Math.max(124, oy - s * 9.5) - (1 - a) * 10; }
      else { x = 8 + slot * ((W - 16 - cw) / 2); y = oy - s * 6 + slot * 56 - (1 - a) * 10; }
      c.style.transform = `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, 0)`;
      if (a > 0.01 && wide) {
        ctx.globalAlpha = a * 0.7; ctx.strokeStyle = BLUE; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(x + cw / 2, y + c.offsetHeight); ctx.lineTo(r[0], r[1] - 4); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(r[0], r[1] - 4, 3, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
  });
})();
