// Kyre's story: one month of outreach, told by 2,600 dots.
// Hero: a globe of companies you can steer, with a "signal lens" under the pointer.
// Scrolling the pinned stage morphs the same dots through five steps:
// market → signals → outreach → replies → interested leads handed over.
// Source for kyre/story.js (bundled and minified with esbuild; see kyre/README.md).

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";

const story = document.getElementById("story");
const canvas = document.getElementById("world");
if (story && canvas) main();

function main() {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    document.documentElement.classList.add("no-gl");
    return;
  }
  renderer.setClearColor(0x000000, 0);

  // ---------- the market ----------
  const COLS = 65, ROWS = 40, N = COLS * ROWS; // 2,600 companies
  const STAGES = 5;
  const rnd = mulberry32(11);
  const order = shuffle([...Array(N).keys()], rnd);
  const SIG = order.slice(0, 208); // ~8% hiring right now
  const REP = SIG.slice(0, 52); // ~25% of those reply
  const LEAD = REP.slice(0, 6); // the interested few
  const role = new Uint8Array(N); // 0 market, 1 signal, 2 replied, 3 lead
  SIG.forEach((i) => (role[i] = 1));
  REP.forEach((i) => (role[i] = 2));
  LEAD.forEach((i) => (role[i] = 3));
  const sigSlot = new Int16Array(N).fill(-1);
  SIG.forEach((i, k) => (sigSlot[i] = k));
  const leadSlot = new Int16Array(N).fill(-1);
  LEAD.forEach((i, k) => (leadSlot[i] = k));
  const seed = new Float32Array(N).map(() => rnd() * Math.PI * 2);

  // Unit sphere (Fibonacci) for the hero globe.
  const SPH = new Float32Array(N * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - ((i + 0.5) / N) * 2;
    const r = Math.sqrt(1 - y * y);
    SPH[i * 3] = Math.cos(i * golden) * r;
    SPH[i * 3 + 1] = y;
    SPH[i * 3 + 2] = Math.sin(i * golden) * r;
  }

  // ---------- scene ----------
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const vert = /* glsl */ `
    attribute float aSize;
    attribute vec4 aColor;
    uniform float uPx;
    varying vec4 vColor;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPx * (9.0 / -mv.z);
      vColor = aColor;
    }`;
  const frag = /* glsl */ `
    varying vec4 vColor;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = vColor.a * smoothstep(0.5, 0.36, d);
      if (a < 0.01) discard;
      gl_FragColor = vec4(vColor.rgb, a);
    }`;
  const mat = new ShaderMaterial({
    uniforms: { uPx: { value: 1 } },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
  });

  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 4);
  const size = new Float32Array(N);
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new BufferAttribute(col, 4));
  geo.setAttribute("aSize", new BufferAttribute(size, 1));
  scene.add(new Points(geo, mat));

  // Email packets (out to signals, back from replies) plus the Kyre core at the centre.
  const P = 140;
  const pk = new Float32Array((P + 1) * 3);
  const pkCol = new Float32Array((P + 1) * 4);
  const pkSize = new Float32Array(P + 1);
  const pkGeo = new BufferGeometry();
  pkGeo.setAttribute("position", new BufferAttribute(pk, 3));
  pkGeo.setAttribute("aColor", new BufferAttribute(pkCol, 4));
  pkGeo.setAttribute("aSize", new BufferAttribute(pkSize, 1));
  const packets = new Points(pkGeo, mat);
  scene.add(packets);
  const pkTarget = new Int32Array(P);
  const pkOff = new Float32Array(P);
  const pkBack = new Uint8Array(P);
  for (let p = 0; p < P; p++) {
    pkBack[p] = p % 3 === 0 ? 1 : 0;
    pkTarget[p] = pkBack[p] ? REP[Math.floor(rnd() * REP.length)] : SIG[Math.floor(rnd() * SIG.length)];
    pkOff[p] = rnd();
  }

  // Faint lines from the core to every signal company while emails go out.
  const linePos = new Float32Array(SIG.length * 6);
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute("position", new BufferAttribute(linePos, 3));
  const lineMat = new LineBasicMaterial({ color: 0x2f4cff, transparent: true, opacity: 0, depthWrite: false });
  scene.add(new LineSegments(lineGeo, lineMat));

  const INK = new Color("#121315");
  const BLUE = new Color("#2f4cff");
  const GREY = new Color("#9a9ca3");

  // ---------- layouts (rebuilt on resize) ----------
  const L = [null, new Float32Array(N * 3), new Float32Array(N * 3), new Float32Array(N * 3), new Float32Array(N * 3), new Float32Array(N * 3)];
  let halfW = 4, halfH = 3, wide = true, R = 2.4;
  const heroOff = new Vector3();
  const leadX = { v: 2 };

  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    mat.uniforms.uPx.value = renderer.getPixelRatio() * Math.min(1, Math.max(0.65, h / 900));
    halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    halfW = halfH * camera.aspect;
    wide = camera.aspect > 1.05;
    R = wide ? Math.min(2.45, halfW * 0.31) : Math.min(1.7, halfW * 0.6);
    heroOff.set(wide ? halfW * 0.5 : 0, wide ? -0.1 : halfH * 0.5, 0);

    // 1 · the market: a field, gently tilted
    const fw = Math.min(halfW * 0.92, 6.2), fh = Math.min(halfH * 0.78, 3.0);
    const tilt = -0.55, ct = Math.cos(tilt), st = Math.sin(tilt);
    const ox = wide ? halfW * 0.12 : 0;
    for (let i = 0; i < N; i++) {
      const cx = i % COLS, cy = Math.floor(i / COLS);
      const x = ((cx - (COLS - 1) / 2) / ((COLS - 1) / 2)) * fw + ox;
      const yy = ((cy - (ROWS - 1) / 2) / ((ROWS - 1) / 2)) * fh;
      const zz = Math.sin(seed[i]) * 0.08;
      const y = yy * ct - zz * st, z = yy * st + zz * ct;
      set(L[1], i, x, y, z);
      // 2 · signals lift towards you
      set(L[2], i, x, y + (role[i] ? 0.12 : 0), z + (role[i] ? 0.9 : -0.2));
    }

    // 3 · outreach: signal companies form a ring around Kyre
    const ringR = wide ? Math.min(2.6, halfH * 0.72) : Math.min(halfW * 0.72, 2.1);
    const ringX = wide ? halfW * 0.22 : 0, ringY = wide ? 0 : halfH * 0.3;
    for (let i = 0; i < N; i++) {
      const k = sigSlot[i];
      if (k >= 0) {
        // spread around the ring so replies and leads don't bunch on one side
        const a = (((k * 37) % SIG.length) / SIG.length) * Math.PI * 2 + 0.3;
        const rr = ringR * (1 + Math.sin(seed[i] * 3) * 0.05);
        set(L[3], i, ringX + Math.cos(a) * rr, ringY + Math.sin(a) * rr, Math.sin(seed[i]) * 0.3);
        // 4 · replies pull in a little
        const pull = role[i] >= 2 ? 0.78 : 1.06;
        set(L[4], i, ringX + Math.cos(a) * rr * pull, ringY + Math.sin(a) * rr * pull, Math.sin(seed[i]) * 0.3);
      } else {
        // the rest of the market recedes
        const j = i * 3;
        set(L[3], i, L[1][j] * 1.25, L[1][j + 1] * 1.25, L[1][j + 2] - 7);
        set(L[4], i, L[1][j] * 1.3, L[1][j + 1] * 1.3, L[1][j + 2] - 9);
      }
    }
    core.set(ringX, ringY, 0);

    // 5 · interested: a neat column of leads; everything else drifts back
    leadX.v = wide ? halfW * 0.08 : -halfW * 0.78;
    const top = wide ? halfH * 0.52 : halfH * 0.66, step = wide ? halfH * 0.205 : halfH * 0.13;
    for (let i = 0; i < N; i++) {
      const k = leadSlot[i];
      if (k >= 0) set(L[5], i, leadX.v, top - k * step, 0.6);
      else {
        const j = i * 3;
        const s = role[i] ? 0.55 : 1.4;
        set(L[5], i, L[4][j] * s + (role[i] ? ringX * 0.4 : 0), L[4][j + 1] * s, L[4][j + 2] - (role[i] ? 2.5 : 4));
      }
    }
  }
  const core = new Vector3();

  // ---------- styles per stage: [r, g, b, alpha, size] ----------
  const tmpA = [0, 0, 0, 0, 0], tmpB = [0, 0, 0, 0, 0];
  function style(k, i, t, out) {
    const r = role[i];
    const pulse = reduce ? 1 : 1 + 0.22 * Math.sin(t * 3 + seed[i] * 4);
    switch (k) {
      case 0:
        return r ? put(out, BLUE, 0.95, 5.2 * pulse) : put(out, INK, 0.34, 3.1);
      case 1:
        return put(out, INK, 0.42, 2.9);
      case 2:
        return r ? put(out, BLUE, 0.95, 5 * pulse) : put(out, INK, 0.1, 2.4);
      case 3:
        return r ? put(out, BLUE, 0.9, 4.4) : put(out, INK, 0.05, 2.2);
      case 4:
        return r >= 2 ? put(out, BLUE, 1, 6 * pulse) : r ? put(out, GREY, 0.45, 3.6) : put(out, INK, 0.03, 2);
      default:
        return r === 3 ? put(out, BLUE, 1, 11) : r === 2 ? put(out, GREY, 0.35, 3.4) : r ? put(out, GREY, 0.14, 3) : put(out, INK, 0.0, 2);
    }
  }

  // ---------- DOM: hero, captions, lead cards, signal tooltip ----------
  const heroLayer = document.getElementById("heroLayer");
  const capLayer = document.getElementById("capLayer");
  const caps = [...document.querySelectorAll("#capLayer .cap")];
  const segs = [...document.querySelectorAll("#capLayer .seg i")];
  const hint = document.getElementById("scrollHint");
  const cards = [...document.querySelectorAll("#leads .lead")];
  const more = document.getElementById("leadsMore");
  const tip = document.getElementById("sigTip");
  const tipName = tip.querySelector("b"), tipWhat = tip.querySelector(".w"), tipWhen = tip.querySelector(".s");
  const SIGNALS = [
    ["Northwind Logistics", "Hiring 12 warehouse leads", "Posted 2 days ago"],
    ["Brightwave Health", "New Head of Talent", "Started this month"],
    ["Halden Software", "Raised a Series A", "9 engineering roles open"],
    ["Mapleford Care", "Hiring 40 care assistants", "Posted yesterday"],
    ["Arden & Lowe", "Sales team doubling", "4 SDR roles open"],
    ["Cobalt Freight", "Recruiter role open 74 days", "Reposted this week"],
    ["Fernhill Foods", "Opening a new plant", "60 roles to fill"],
    ["Quarry Lane Legal", "New Head of Growth", "Started 3 weeks ago"],
  ];

  let activeCap = -1;
  function showCap(s) {
    if (s === activeCap) return;
    activeCap = s;
    caps.forEach((c, k) => c.classList.toggle("on", k === s - 1));
  }

  // ---------- input ----------
  const pointer = { x: -9999, y: -9999, nx: 0, ny: 0, inside: false, moved: 0 };
  let rot = 0.6, vel = 0, dragging = false, lastX = 0;
  window.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.inside = pointer.y >= 0 && pointer.y <= r.height;
    pointer.nx = (pointer.x / r.width) * 2 - 1;
    pointer.ny = (pointer.y / r.height) * 2 - 1;
    pointer.moved = performance.now();
    if (dragging) {
      vel = (e.clientX - lastX) * 0.004;
      lastX = e.clientX;
    }
  }, { passive: true });
  story.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.target.closest("a,button")) return;
    dragging = true;
    lastX = e.clientX;
    story.classList.add("grabbing");
  });
  window.addEventListener("pointerup", () => {
    dragging = false;
    story.classList.remove("grabbing");
  });

  // ---------- loop ----------
  let running = true;
  new IntersectionObserver((es) => (running = es[0].isIntersecting)).observe(story);
  window.addEventListener("resize", layout);
  layout();

  const proj = new Vector3();
  const cur = new Float32Array(N * 3);
  let cs = 0, last = performance.now(), camX = 0, camY = 0;
  let tipIdx = -1, autoAt = 0, autoIdx = -1, autoSig = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!running) return;
    const t = now / 1000;

    // scroll → stage
    const rect = story.getBoundingClientRect();
    const total = story.offsetHeight - innerHeight;
    const p = Math.min(Math.max(-rect.top / total, 0), 1);
    const target = Math.min(Math.max(p * 5.7 - 0.35, 0), STAGES);
    cs = reduce ? target : cs + (target - cs) * (1 - Math.exp(-dt * 7));
    const k0 = Math.min(Math.floor(cs), STAGES - 1), f = ease(cs - k0), k1 = k0 + 1;
    const heroW = 1 - smooth(cs / 0.6);

    // globe spin, with drag and inertia
    if (!dragging) vel *= Math.pow(0.04, dt);
    rot += vel + (reduce ? 0 : dt * 0.09);
    const cr = Math.cos(rot), sr = Math.sin(rot), tiltX = 0.32, cx = Math.cos(tiltX), sx = Math.sin(tiltX);

    // camera parallax
    camX += (pointer.nx * 0.45 - camX) * (1 - Math.exp(-dt * 3));
    camY += (-pointer.ny * 0.3 - camY) * (1 - Math.exp(-dt * 3));
    camera.position.set(camX, camY, 9);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const W = canvas.clientWidth, H = canvas.clientHeight;
    const lensR = 150, lensOn = heroW > 0.02 && pointer.inside && now - pointer.moved < 4000;
    let near = -1, nearD = 36;

    for (let i = 0; i < N; i++) {
      const j = i * 3;
      // stage 0 position: rotated globe
      const sx0 = SPH[j], sy0 = SPH[j + 1], sz0 = SPH[j + 2];
      let x = sx0 * cr + sz0 * sr, z = -sx0 * sr + sz0 * cr, y = sy0;
      const y2 = y * cx - z * sx, z2 = y * sx + z * cx;
      const gx = x * R + heroOff.x, gy = y2 * R + heroOff.y, gz = z2 * R;
      const depth = (z2 + 1) / 2; // 0 back, 1 front

      const LA = L[k0], LB = L[k1];
      const ax = k0 === 0 ? gx : LA[j], ay = k0 === 0 ? gy : LA[j + 1], az = k0 === 0 ? gz : LA[j + 2];
      const wob = reduce ? 0 : 0.025;
      const px = ax + (LB[j] - ax) * f + Math.sin(t * 0.7 + seed[i]) * wob;
      const py = ay + (LB[j + 1] - ay) * f + Math.cos(t * 0.6 + seed[i] * 1.3) * wob;
      const pz = az + (LB[j + 2] - az) * f;
      pos[j] = px; pos[j + 1] = py; pos[j + 2] = pz;
      cur[j] = px; cur[j + 1] = py; cur[j + 2] = pz;

      style(k0, i, t, tmpA);
      style(k1, i, t, tmpB);
      let r = tmpA[0] + (tmpB[0] - tmpA[0]) * f, g = tmpA[1] + (tmpB[1] - tmpA[1]) * f, b = tmpA[2] + (tmpB[2] - tmpA[2]) * f;
      let a = tmpA[3] + (tmpB[3] - tmpA[3]) * f, s = tmpA[4] + (tmpB[4] - tmpA[4]) * f;
      if (k0 === 0) a *= 1 - (1 - f) * (1 - (0.28 + depth * 0.72)); // the far side of the globe is dimmer

      if (lensOn) {
        proj.set(px, py, pz).project(camera);
        const sxp = (proj.x * 0.5 + 0.5) * W, syp = (-proj.y * 0.5 + 0.5) * H;
        const d = Math.hypot(sxp - pointer.x, syp - pointer.y);
        if (d < lensR) {
          const q = Math.pow(1 - d / lensR, 2) * heroW;
          a = Math.min(1, a + q * 0.55);
          s *= 1 + q * 1.1;
          r += (BLUE.r - r) * q * 0.55; g += (BLUE.g - g) * q * 0.55; b += (BLUE.b - b) * q * 0.55;
        }
        if (role[i] && depth > 0.5 && d < nearD) { nearD = d; near = i; }
      }
      const c4 = i * 4;
      col[c4] = r; col[c4 + 1] = g; col[c4 + 2] = b; col[c4 + 3] = a;
      size[i] = s;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;

    // emails out (stage 3) and replies back (stage 4)
    const wOut = bump(cs, 2.3, 2.95, 3.85, 4.3), wBack = bump(cs, 3.45, 3.95, 4.6, 5.0), wCore = bump(cs, 2.2, 2.85, 4.5, 4.95);
    for (let q = 0; q < P; q++) {
      const ti = pkTarget[q] * 3, back = pkBack[q];
      const u = reduce ? 0.5 : (t * (back ? 0.32 : 0.42) + pkOff[q]) % 1;
      const from = back ? [cur[ti], cur[ti + 1], cur[ti + 2]] : [core.x, core.y, core.z];
      const to = back ? [core.x, core.y, core.z] : [cur[ti], cur[ti + 1], cur[ti + 2]];
      pk[q * 3] = from[0] + (to[0] - from[0]) * u;
      pk[q * 3 + 1] = from[1] + (to[1] - from[1]) * u;
      pk[q * 3 + 2] = from[2] + (to[2] - from[2]) * u;
      const w = (back ? wBack : wOut) * Math.sin(u * Math.PI) * (reduce ? 0 : 1);
      pkCol[q * 4] = BLUE.r; pkCol[q * 4 + 1] = BLUE.g; pkCol[q * 4 + 2] = BLUE.b; pkCol[q * 4 + 3] = w * 0.9;
      pkSize[q] = back ? 4.2 : 3.4;
    }
    pk[P * 3] = core.x; pk[P * 3 + 1] = core.y; pk[P * 3 + 2] = core.z;
    pkCol[P * 4] = BLUE.r; pkCol[P * 4 + 1] = BLUE.g; pkCol[P * 4 + 2] = BLUE.b;
    pkCol[P * 4 + 3] = wCore;
    pkSize[P] = 16 * (reduce ? 1 : 1 + 0.08 * Math.sin(t * 4));
    pkGeo.attributes.position.needsUpdate = true;
    pkGeo.attributes.aColor.needsUpdate = true;
    pkGeo.attributes.aSize.needsUpdate = true;

    SIG.forEach((i, k) => {
      linePos.set([core.x, core.y, core.z, cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]], k * 6);
    });
    lineGeo.attributes.position.needsUpdate = true;
    lineMat.opacity = wOut * 0.16 + wBack * 0.06;

    renderer.render(scene, camera);

    // ---- DOM overlays ----
    heroLayer.style.opacity = heroW.toFixed(3);
    heroLayer.style.transform = `translate3d(0, ${(-(1 - heroW) * 40).toFixed(1)}px, 0)`;
    heroLayer.classList.toggle("gone", heroW < 0.05);
    if (hint) hint.style.opacity = (heroW * 0.9).toFixed(3);
    const capW = smooth((cs - 0.45) / 0.4);
    capLayer.style.opacity = capW.toFixed(3);
    showCap(Math.max(1, Math.min(STAGES, Math.round(cs))));
    segs.forEach((el, k) => el.style.setProperty("--f", Math.min(Math.max(cs - k, 0), 1).toFixed(3)));

    // lead cards ride on their dots in the last stage
    const leadW = smooth((cs - 4.35) / 0.5);
    cards.forEach((card, k) => {
      const i = LEAD[k] * 3;
      proj.set(cur[i], cur[i + 1], cur[i + 2]).project(camera);
      const sxp = (proj.x * 0.5 + 0.5) * W, syp = (-proj.y * 0.5 + 0.5) * H;
      card.style.opacity = (leadW * Math.min(1, Math.max(0, (cs - 4.35 - k * 0.05) / 0.4))).toFixed(3);
      card.style.transform = `translate3d(${(sxp + 22).toFixed(1)}px, ${(syp).toFixed(1)}px, 0) translateY(-50%)`;
    });
    if (more) {
      const i = LEAD[LEAD.length - 1] * 3;
      proj.set(cur[i], cur[i + 1], cur[i + 2]).project(camera);
      more.style.opacity = leadW.toFixed(3);
      more.style.transform = `translate3d(${((proj.x * 0.5 + 0.5) * W + 22).toFixed(1)}px, ${((-proj.y * 0.5 + 0.5) * H + 44).toFixed(1)}px, 0)`;
    }

    // signal tooltip: under the pointer, or a gentle tour when the pointer is still
    let show = -1;
    if (heroW > 0.5 && wide) {
      if (near >= 0) show = near;
      else if (now - pointer.moved > 2500) {
        if (now > autoAt) {
          autoAt = now + 2600;
          autoIdx = pickFront(cr, sr, sx, cx);
          autoSig = (autoSig + 1) % SIGNALS.length;
        }
        show = autoIdx;
      }
    }
    if (show >= 0) {
      const i = show * 3;
      proj.set(cur[i], cur[i + 1], cur[i + 2]).project(camera);
      const sxp = (proj.x * 0.5 + 0.5) * W, syp = (-proj.y * 0.5 + 0.5) * H;
      if (show !== tipIdx) {
        const sgl = SIGNALS[near >= 0 ? sigSlot[show] % SIGNALS.length : autoSig];
        tipName.textContent = sgl[0];
        tipWhat.textContent = sgl[1];
        tipWhen.textContent = sgl[2];
        tipIdx = show;
      }
      tip.style.transform = `translate3d(${Math.min(sxp + 16, W - 250).toFixed(1)}px, ${(syp - 16).toFixed(1)}px, 0) translateY(-100%)`;
      tip.classList.add("on");
    } else {
      tip.classList.remove("on");
      tipIdx = -1;
    }
  }
  requestAnimationFrame(frame);

  // a signal dot on the front of the globe, for the idle tour
  function pickFront(cr, sr, sx, cx) {
    for (let tries = 0; tries < 40; tries++) {
      const i = SIG[Math.floor(Math.random() * SIG.length)];
      const j = i * 3;
      const z = -SPH[j] * sr + SPH[j + 2] * cr;
      const z2 = SPH[j + 1] * sx + z * cx;
      if (z2 > 0.45) return i;
    }
    return SIG[0];
  }
}

// ---------- helpers ----------
function set(a, i, x, y, z) {
  a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
}
function put(out, c, a, s) {
  out[0] = c.r; out[1] = c.g; out[2] = c.b; out[3] = a; out[4] = s;
  return out;
}
function smooth(x) {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
}
function ease(x) {
  const t = Math.min(Math.max(x, 0), 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function bump(x, a, b, c, d) {
  return smooth((x - a) / (b - a)) * (1 - smooth((x - c) / (d - c)));
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
