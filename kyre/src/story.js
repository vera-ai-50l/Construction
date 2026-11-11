// Kyre's story: one month of outreach, told by the companies in your market.
// Hero: a globe of companies you can steer, with a "signal lens" under the pointer.
// Scrolling the pinned stage morphs the same companies through five steps:
// market → signals → outreach → replies → interested leads, which grow into the lead cards.
//
// Five looks for "a company", picked with ?style= (tiles is the default):
//   tiles      tiny company cards (avatar + two lines); hiring ones turn solid blue
//   network    a wireframe globe of glowing nodes; outreach and replies travel along arcs
//   names      a globe of company names; hiring ones turn blue and read "· hiring"
//   people     contact avatars with initials
//   envelopes  simple dots, with envelopes going out and chat bubbles coming back
// Add ?compare (or any ?style=) to show a switcher bar.
// Source for kyre/story.js (bundled and minified with esbuild; see kyre/README.md).

import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

const STYLES = ["tiles", "network", "names", "people", "envelopes"];
const LABELS = { tiles: "Company tiles", network: "Network globe", names: "Company names", people: "People", envelopes: "Envelopes" };
const params = new URLSearchParams(location.search);
const STYLE = STYLES.includes(params.get("style")) ? params.get("style") : "tiles";

const story = document.getElementById("story");
const canvas = document.getElementById("world");
if (story && canvas) main();
if (params.has("style") || params.has("compare")) switcher();

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

  // Per-look settings: grid size, a size multiplier for every stage, the lead size, plain alpha, lens growth.
  const CFG = {
    tiles: { cols: 40, rows: 30, mult: 1, lead: 34, plainA: 1, lens: 0.7 },
    network: { cols: 40, rows: 30, mult: 0.42, lead: 14, plainA: 1, lens: 0.9 },
    names: { cols: 20, rows: 15, mult: 7.2, lead: 120, plainA: 0.6, lens: 0.22 },
    people: { cols: 30, rows: 20, mult: 1.6, lead: 42, plainA: 1, lens: 0.6 },
    envelopes: { cols: 65, rows: 40, mult: 0.3, lead: 11, plainA: 1, lens: 1.1 },
  }[STYLE];

  // ---------- the market ----------
  const COLS = CFG.cols, ROWS = CFG.rows, N = COLS * ROWS;
  const STAGES = 5;
  const rnd = mulberry32(11);
  const order = shuffle([...Array(N).keys()], rnd);
  const nSig = Math.round(N * 0.08);
  const SIG = order.slice(0, nSig); // ~8% hiring right now
  const REP = SIG.slice(0, Math.max(6, Math.round(nSig * 0.25))); // ~25% of those reply
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

  const SD = /* glsl */ `
    float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }`;
  const vert = /* glsl */ `
    attribute float aSize;
    attribute vec4 aColor;
    attribute float aTag;
    attribute vec2 aCell;
    uniform float uPx;
    varying vec4 vColor;
    varying float vTag;
    varying float vPx;
    varying vec2 vCell;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPx * (9.0 / -mv.z);
      vPx = gl_PointSize;
      vColor = aColor;
      vTag = aTag;
      vCell = aCell;
    }`;
  const HEAD = /* glsl */ `
    varying vec4 vColor;
    varying float vTag;
    varying float vPx;
    varying vec2 vCell;
    uniform sampler2D uAtlas;
    uniform vec2 uGrid;
    ${SD}
    // Alpha of atlas cell c at cell-local coords q (0..1, y down).
    float cellA(float c, vec2 q) {
      float cx = mod(c, uGrid.x), cy = floor(c / uGrid.x);
      return texture2D(uAtlas, vec2((cx + q.x) / uGrid.x, 1.0 - (cy + q.y) / uGrid.y)).a;
    }`;

  const FRAG = {
    // A company tile: white card with an avatar and two text lines; vTag fills it with the accent.
    tiles: /* glsl */ `${HEAD}
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float aa = 1.4 / max(vPx, 1.0);
        float d = sdBox(p, vec2(0.46, 0.31), 0.1);
        float a = vColor.a * (1.0 - smoothstep(-aa, aa, d));
        if (a < 0.02) discard;
        vec3 accent = vColor.rgb;
        vec3 fill = mix(vec3(1.0), accent, vTag);
        vec3 ink = mix(accent, vec3(1.0), vTag);
        float detail = smoothstep(6.0, 13.0, vPx);
        float av = 1.0 - smoothstep(0.085, 0.085 + aa, length(p - vec2(-0.24, 0.0)));
        float l1 = (1.0 - smoothstep(0.032, 0.032 + aa, abs(p.y + 0.075))) * step(-0.1, p.x) * step(p.x, 0.32);
        float l2 = (1.0 - smoothstep(0.032, 0.032 + aa, abs(p.y - 0.075))) * step(-0.1, p.x) * step(p.x, 0.17);
        vec3 col = mix(fill, ink, max(av, max(l1 * 0.75, l2 * 0.5)) * mix(0.35, 0.85, vTag) * detail);
        col = mix(col, accent, smoothstep(-0.06, -0.06 + aa * 1.5, d) * (0.5 * (1.0 - vTag)));
        gl_FragColor = vec4(col, a);
      }`,
    // A node: a crisp core with a soft halo that grows when it lights up.
    network: /* glsl */ `${HEAD}
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float core = 1.0 - smoothstep(0.17, 0.21, d);
        float halo = exp(-d * d * 22.0) * 0.45 * vTag;
        float a = vColor.a * clamp(core + halo, 0.0, 1.0);
        if (a < 0.02) discard;
        gl_FragColor = vec4(vColor.rgb, a);
      }`,
    // A company name from the atlas; hiring ones blend to their "· hiring" label.
    names: /* glsl */ `${HEAD}
      void main() {
        vec2 pc = gl_PointCoord;
        float y = (pc.y - 0.5) * 8.0 + 0.5;
        if (y < 0.0 || y > 1.0) discard;
        vec2 q = vec2(pc.x, y);
        float m1 = cellA(vCell.x, q);
        float m2 = vCell.y >= 0.0 ? cellA(vCell.y, q) : m1;
        float a = vColor.a * mix(m1, m2, vTag);
        if (a < 0.02) discard;
        gl_FragColor = vec4(vColor.rgb, a);
      }`,
    // A contact avatar: a disc with initials from the atlas.
    people: /* glsl */ `${HEAD}
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float aa = 1.4 / max(vPx, 1.0);
        float d = length(p);
        float a = vColor.a * (1.0 - smoothstep(0.46 - aa, 0.46 + aa, d));
        if (a < 0.02) discard;
        vec3 accent = vColor.rgb;
        vec3 fill = mix(vec3(0.93, 0.925, 0.91), accent, vTag);
        vec3 ink = mix(vec3(0.07, 0.075, 0.085), vec3(1.0), vTag);
        float g = cellA(vCell.x, gl_PointCoord) * smoothstep(7.0, 14.0, vPx);
        vec3 col = mix(fill, ink, g);
        col = mix(col, accent, smoothstep(0.4, 0.44, d) * 0.5 * (1.0 - vTag));
        gl_FragColor = vec4(col, a);
      }`,
    // A plain dot.
    envelopes: /* glsl */ `${HEAD}
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = vColor.a * smoothstep(0.5, 0.36, d);
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor.rgb, a);
      }`,
  };

  // Things in flight. aTag: 0 envelope (white), 1 envelope (blue), 2 Kyre core, 3 glowing dot, 4 chat bubble.
  const pkFrag = /* glsl */ `${HEAD}
    void main() {
      vec2 p = gl_PointCoord - 0.5;
      float aa = 1.4 / max(vPx, 1.0);
      vec3 accent = vColor.rgb;
      if (vTag > 3.5) {
        float d = min(sdBox(p - vec2(0.0, -0.05), vec2(0.42, 0.27), 0.12), sdSeg(p, vec2(-0.22, 0.18), vec2(-0.3, 0.38)) - 0.05);
        float body = 1.0 - smoothstep(-aa, aa, d);
        if (body * vColor.a < 0.02) discard;
        float dots = 0.0;
        for (int k = -1; k <= 1; k++) dots = max(dots, 1.0 - smoothstep(0.05, 0.05 + aa, length(p - vec2(float(k) * 0.16, -0.05))));
        gl_FragColor = vec4(mix(accent, vec3(1.0), dots), vColor.a * body);
        return;
      }
      if (vTag > 2.5) {
        float d = length(p);
        float a = vColor.a * clamp(1.0 - smoothstep(0.16, 0.22, d) + exp(-d * d * 18.0) * 0.5, 0.0, 1.0);
        if (a < 0.02) discard;
        gl_FragColor = vec4(accent, a);
        return;
      }
      if (vTag > 1.5) {
        float d = sdBox(p, vec2(0.42), 0.13);
        float body = 1.0 - smoothstep(-aa, aa, d);
        if (body * vColor.a < 0.02) discard;
        float k = min(sdSeg(p, vec2(-0.14, -0.22), vec2(-0.14, 0.22)), min(sdSeg(p, vec2(-0.12, 0.05), vec2(0.14, -0.12)), sdSeg(p, vec2(-0.05, -0.01), vec2(0.15, 0.22))));
        float glyph = 1.0 - smoothstep(0.045, 0.045 + aa, k);
        gl_FragColor = vec4(mix(accent, vec3(1.0), glyph), vColor.a * body);
        return;
      }
      float d = sdBox(p, vec2(0.44, 0.3), 0.06);
      float body = 1.0 - smoothstep(-aa, aa, d);
      if (body * vColor.a < 0.02) discard;
      float flap = min(sdSeg(p, vec2(-0.42, -0.27), vec2(0.0, 0.04)), sdSeg(p, vec2(0.42, -0.27), vec2(0.0, 0.04)));
      float line = max(1.0 - smoothstep(0.035, 0.035 + aa, flap), smoothstep(-0.06, -0.06 + aa, d));
      vec3 fill = mix(vec3(1.0), accent, vTag);
      vec3 ink = mix(accent, vec3(1.0), vTag);
      gl_FragColor = vec4(mix(fill, ink, line), vColor.a * body);
    }`;

  // ---------- atlas (names and people) ----------
  const atlas = buildAtlas(STYLE, N, role, rnd);
  const uniforms = {
    uPx: { value: 1 },
    uAtlas: { value: atlas ? atlas.texture : null },
    uGrid: { value: atlas ? new Vector2(atlas.cols, atlas.rows) : new Vector2(1, 1) },
  };
  const mat = new ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: FRAG[STYLE],
    transparent: true,
    depthWrite: STYLE === "tiles" || STYLE === "people",
  });
  const pkMat = new ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: pkFrag, transparent: true, depthWrite: false });

  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 4);
  const size = new Float32Array(N);
  const tag = new Float32Array(N);
  const cell = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    cell[i * 2] = atlas ? atlas.cellOf[i] : 0;
    cell[i * 2 + 1] = atlas ? atlas.cell2Of[i] : -1;
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new BufferAttribute(col, 4));
  geo.setAttribute("aSize", new BufferAttribute(size, 1));
  geo.setAttribute("aTag", new BufferAttribute(tag, 1));
  geo.setAttribute("aCell", new BufferAttribute(cell, 2));
  scene.add(new Points(geo, mat));

  // Packets (out to signals, back from replies) plus the Kyre core at the centre.
  const P = STYLE === "envelopes" ? 140 : 90;
  const pk = new Float32Array((P + 1) * 3);
  const pkCol = new Float32Array((P + 1) * 4);
  const pkSize = new Float32Array(P + 1);
  const pkTag = new Float32Array(P + 1);
  const pkGeo = new BufferGeometry();
  pkGeo.setAttribute("position", new BufferAttribute(pk, 3));
  pkGeo.setAttribute("aColor", new BufferAttribute(pkCol, 4));
  pkGeo.setAttribute("aSize", new BufferAttribute(pkSize, 1));
  pkGeo.setAttribute("aTag", new BufferAttribute(pkTag, 1));
  pkGeo.setAttribute("aCell", new BufferAttribute(new Float32Array((P + 1) * 2), 2));
  const packets = new Points(pkGeo, pkMat);
  packets.renderOrder = 2;
  scene.add(packets);
  const pkTarget = new Int32Array(P);
  const pkOff = new Float32Array(P);
  const pkBack = new Uint8Array(P);
  for (let p = 0; p < P; p++) {
    pkBack[p] = p % 3 === 0 ? 1 : 0;
    pkTarget[p] = pkBack[p] ? REP[Math.floor(rnd() * REP.length)] : SIG[Math.floor(rnd() * SIG.length)];
    pkOff[p] = rnd();
  }
  const PK = {
    tiles: { out: [0, 13], back: [1, 15] },
    network: { out: [3, 7], back: [3, 9] },
    names: { out: [0, 14], back: [1, 16] },
    people: { out: [0, 14], back: [1, 16] },
    envelopes: { out: [0, 15], back: [4, 18] },
  }[STYLE];

  // Lines from the core to every signal company while emails go out (arcs for the network look).
  const SEGS = STYLE === "network" ? 12 : 1;
  const linePos = new Float32Array(SIG.length * SEGS * 6);
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute("position", new BufferAttribute(linePos, 3));
  const lineMat = new LineBasicMaterial({ color: 0x2f4cff, transparent: true, opacity: 0, depthWrite: false });
  scene.add(new LineSegments(lineGeo, lineMat));

  // Network look: each node joined to its two nearest neighbours on the globe.
  let edges = null, edgePos = null, edgeGeo = null, edgeMat = null;
  if (STYLE === "network") {
    const set2 = new Set();
    const list = [];
    for (let i = 0; i < N; i++) {
      let b1 = -1, b2 = -1, d1 = 9, d2 = 9;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const dx = SPH[i * 3] - SPH[j * 3], dy = SPH[i * 3 + 1] - SPH[j * 3 + 1], dz = SPH[i * 3 + 2] - SPH[j * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = j; } else if (d < d2) { d2 = d; b2 = j; }
      }
      for (const j of [b1, b2]) {
        const k = i < j ? i * N + j : j * N + i;
        if (!set2.has(k)) { set2.add(k); list.push(i, j); }
      }
    }
    edges = new Int32Array(list);
    edgePos = new Float32Array(edges.length * 3);
    edgeGeo = new BufferGeometry();
    edgeGeo.setAttribute("position", new BufferAttribute(edgePos, 3));
    edgeMat = new LineBasicMaterial({ color: 0x121315, transparent: true, opacity: 0, depthWrite: false });
    scene.add(new LineSegments(edgeGeo, edgeMat));
  }

  const INK = new Color("#121315");
  const BLUE = new Color("#2f4cff");
  const GREY = new Color("#9a9ca3");

  // ---------- layouts (rebuilt on resize) ----------
  const L = [null, new Float32Array(N * 3), new Float32Array(N * 3), new Float32Array(N * 3), new Float32Array(N * 3), new Float32Array(N * 3)];
  let halfW = 4, halfH = 3, wide = true, R = 2.4;
  const heroOff = new Vector3();
  const core = new Vector3();

  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uPx.value = renderer.getPixelRatio() * Math.min(1, Math.max(0.65, h / 900));
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
    const leadX = wide ? halfW * 0.3 : 0;
    const top = wide ? halfH * 0.52 : halfH * 0.66, step = wide ? halfH * 0.205 : halfH * 0.148;
    for (let i = 0; i < N; i++) {
      const k = leadSlot[i];
      if (k >= 0) set(L[5], i, leadX, top - k * step, 0.6);
      else {
        const j = i * 3;
        const s = role[i] ? 0.55 : 1.4;
        set(L[5], i, L[4][j] * s + (role[i] ? ringX * 0.4 : 0), L[4][j + 1] * s, L[4][j + 2] - (role[i] ? 2.5 : 4));
      }
    }
  }

  // ---------- styles per stage: [r, g, b, alpha, size, tag] ----------
  const M = CFG.mult, PA = CFG.plainA;
  const tmpA = [0, 0, 0, 0, 0, 0], tmpB = [0, 0, 0, 0, 0, 0];
  function style(k, i, t, out) {
    const r = role[i];
    const pulse = reduce ? 1 : 1 + 0.12 * Math.sin(t * 3 + seed[i] * 4);
    switch (k) {
      case 0:
        return r ? put(out, BLUE, 1, 12.5 * M * pulse, 1) : put(out, INK, 0.85 * PA, 10.5 * M, 0);
      case 1:
        return put(out, INK, 0.95 * PA, 11 * M, 0);
      case 2:
        return r ? put(out, BLUE, 1, 15 * M * pulse, 1) : put(out, INK, 0.28 * PA, 10 * M, 0);
      case 3:
        return r ? put(out, BLUE, 1, 13 * M, 1) : put(out, INK, 0.08 * PA, 9 * M, 0);
      case 4:
        return r >= 2 ? put(out, BLUE, 1, 16 * M * pulse, 1) : r ? put(out, GREY, 0.75, 11 * M, 0) : put(out, INK, 0.04, 8 * M, 0);
      default:
        return r === 3 ? put(out, BLUE, 1, CFG.lead, 1) : r === 2 ? put(out, GREY, 0.45, 10 * M, 0) : r ? put(out, GREY, 0.2, 9 * M, 0) : put(out, INK, 0, 8 * M, 0);
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

  // Point on the arc (or straight line) between the core and a company.
  const arcOut = [0, 0, 0];
  function along(tx, ty, tz, u, out) {
    if (SEGS === 1) {
      out[0] = core.x + (tx - core.x) * u; out[1] = core.y + (ty - core.y) * u; out[2] = core.z + (tz - core.z) * u;
      return out;
    }
    const mx = (core.x + tx) / 2, my = (core.y + ty) / 2, dx = tx - core.x, dy = ty - core.y;
    const cx = mx - dy * 0.28, cy = my + dx * 0.28, cz = (core.z + tz) / 2 + 1.2;
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    out[0] = a * core.x + b * cx + c * tx; out[1] = a * core.y + b * cy + c * ty; out[2] = a * core.z + b * cz + c * tz;
    return out;
  }

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
    let near = -1, nearD = STYLE === "names" ? 26 : 36;

    for (let i = 0; i < N; i++) {
      const j = i * 3;
      // stage 0 position: rotated globe
      const sx0 = SPH[j], sy0 = SPH[j + 1], sz0 = SPH[j + 2];
      const x = sx0 * cr + sz0 * sr, z = -sx0 * sr + sz0 * cr, y = sy0;
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
      let tg = tmpA[5] + (tmpB[5] - tmpA[5]) * f;
      if (k0 === 0) a *= 1 - (1 - f) * (1 - (0.28 + depth * 0.72)); // the far side of the globe is dimmer
      if (leadSlot[i] >= 0) a *= 1 - smooth((cs - 4.55 - leadSlot[i] * 0.04) / 0.35); // the company hands over to its card

      if (lensOn) {
        proj.set(px, py, pz).project(camera);
        const sxp = (proj.x * 0.5 + 0.5) * W, syp = (-proj.y * 0.5 + 0.5) * H;
        const d = Math.hypot(sxp - pointer.x, syp - pointer.y);
        if (d < lensR) {
          const q = Math.pow(1 - d / lensR, 2) * heroW;
          a = Math.min(1, a + q * 0.4);
          s *= 1 + q * CFG.lens;
          r += (BLUE.r - r) * q; g += (BLUE.g - g) * q; b += (BLUE.b - b) * q;
          if (STYLE !== "names") tg = Math.max(tg, q * 0.35);
        }
        if (role[i] && depth > 0.5 && d < nearD) { nearD = d; near = i; }
      }
      const c4 = i * 4;
      col[c4] = r; col[c4 + 1] = g; col[c4 + 2] = b; col[c4 + 3] = a;
      size[i] = s;
      tag[i] = tg;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aTag.needsUpdate = true;

    if (edges) {
      for (let e = 0; e < edges.length; e++) edgePos.set([cur[edges[e] * 3], cur[edges[e] * 3 + 1], cur[edges[e] * 3 + 2]], e * 3);
      edgeGeo.attributes.position.needsUpdate = true;
      edgeMat.opacity = 0.2 * (1 - smooth(cs / 0.9));
    }

    // emails out (stage 3) and replies back (stage 4)
    const wOut = bump(cs, 2.3, 2.95, 3.85, 4.3), wBack = bump(cs, 3.45, 3.95, 4.6, 5.0), wCore = bump(cs, 2.2, 2.85, 4.5, 4.95);
    for (let q = 0; q < P; q++) {
      const ti = pkTarget[q] * 3, back = pkBack[q];
      const u = reduce ? 0.5 : (t * (back ? 0.32 : 0.42) + pkOff[q]) % 1;
      along(cur[ti], cur[ti + 1], cur[ti + 2], back ? 1 - u : u, arcOut);
      pk[q * 3] = arcOut[0]; pk[q * 3 + 1] = arcOut[1]; pk[q * 3 + 2] = arcOut[2];
      const w = (back ? wBack : wOut) * Math.min(1, Math.sin(u * Math.PI) * 2.5) * (reduce ? 0 : 1);
      pkCol[q * 4] = BLUE.r; pkCol[q * 4 + 1] = BLUE.g; pkCol[q * 4 + 2] = BLUE.b; pkCol[q * 4 + 3] = w;
      const kind = back ? PK.back : PK.out;
      pkTag[q] = kind[0];
      pkSize[q] = kind[1];
    }
    pk[P * 3] = core.x; pk[P * 3 + 1] = core.y; pk[P * 3 + 2] = core.z;
    pkCol[P * 4] = BLUE.r; pkCol[P * 4 + 1] = BLUE.g; pkCol[P * 4 + 2] = BLUE.b;
    pkCol[P * 4 + 3] = wCore;
    pkSize[P] = 46 * (reduce ? 1 : 1 + 0.04 * Math.sin(t * 3));
    pkTag[P] = 2;
    pkGeo.attributes.position.needsUpdate = true;
    pkGeo.attributes.aColor.needsUpdate = true;
    pkGeo.attributes.aSize.needsUpdate = true;
    pkGeo.attributes.aTag.needsUpdate = true;

    for (let k = 0; k < SIG.length; k++) {
      const i = SIG[k] * 3;
      for (let sgi = 0; sgi < SEGS; sgi++) {
        const o = (k * SEGS + sgi) * 6;
        along(cur[i], cur[i + 1], cur[i + 2], sgi / SEGS, arcOut);
        linePos[o] = arcOut[0]; linePos[o + 1] = arcOut[1]; linePos[o + 2] = arcOut[2];
        along(cur[i], cur[i + 1], cur[i + 2], (sgi + 1) / SEGS, arcOut);
        linePos[o + 3] = arcOut[0]; linePos[o + 4] = arcOut[1]; linePos[o + 5] = arcOut[2];
      }
    }
    lineGeo.attributes.position.needsUpdate = true;
    lineMat.opacity = (wOut * 0.1 + wBack * 0.04) * (SEGS > 1 ? 1.8 : 1);

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

    // the interested companies grow into the lead cards
    cards.forEach((card, k) => {
      const i = LEAD[k] * 3;
      proj.set(cur[i], cur[i + 1], cur[i + 2]).project(camera);
      const sxp = (proj.x * 0.5 + 0.5) * W, syp = (-proj.y * 0.5 + 0.5) * H;
      const g = smooth((cs - 4.55 - k * 0.04) / 0.35);
      card.style.opacity = g.toFixed(3);
      card.style.transform = `translate3d(${sxp.toFixed(1)}px, ${syp.toFixed(1)}px, 0) translate(-50%, -50%) scale(${(0.18 + 0.82 * g).toFixed(3)})`;
    });
    if (more) {
      const i = LEAD[LEAD.length - 1] * 3;
      proj.set(cur[i], cur[i + 1], cur[i + 2]).project(camera);
      more.style.opacity = smooth((cs - 4.75) / 0.25).toFixed(3);
      more.style.transform = `translate3d(${((proj.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-proj.y * 0.5 + 0.5) * H + 46).toFixed(1)}px, 0) translateX(-50%)`;
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
        tipName.textContent = atlas && atlas.names ? atlas.names[show] : sgl[0];
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

  // a signal company on the front of the globe, for the idle tour
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

// ---------- atlases ----------
// names: one cell per company name, plus a "· hiring" cell for each hiring company.
// people: 64 initials in white, drawn over a coloured disc by the shader.
function buildAtlas(style, N, role, rnd) {
  if (style !== "names" && style !== "people") return null;
  const cvs = document.createElement("canvas");
  const ctx = cvs.getContext("2d");
  const cellOf = new Float32Array(N), cell2Of = new Float32Array(N).fill(-1);
  let cols, rows, names = null;
  const font = '"Inter Tight", "Helvetica Neue", Arial, sans-serif';

  if (style === "names") {
    const A = ["Northwind", "Brightwave", "Halden", "Mapleford", "Arden", "Cobalt", "Fernhill", "Quarry Lane", "Kestrel", "Ashby", "Lumen", "Harbor", "Silverline", "Oakridge", "Redfern", "Bluestone", "Westbrook", "Pinecrest", "Larkspur", "Granite", "Elmwood", "Summit", "Riverside", "Copperleaf"];
    const B = ["Logistics", "Health", "Software", "Care", "Foods", "Freight", "Legal", "Staffing", "Talent", "Group", "Partners", "Labs", "Retail", "Energy", "Build"];
    names = [];
    for (let i = 0; i < N; i++) names.push(`${A[Math.floor(rnd() * A.length)]} ${B[Math.floor(rnd() * B.length)]}`);
    const extra = [];
    for (let i = 0; i < N; i++) if (role[i]) extra.push(i);
    const total = N + extra.length;
    const cw = 384, ch = 48;
    cols = 5;
    rows = Math.ceil(total / cols);
    cvs.width = cw * cols;
    cvs.height = ch * rows;
    const draw = () => {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const put = (c, text, weight, size) => {
        ctx.font = `${weight} ${size}px ${font}`;
        ctx.fillText(text, (c % cols) * cw + cw / 2, Math.floor(c / cols) * ch + ch / 2, cw - 8);
      };
      for (let i = 0; i < N; i++) put(i, names[i], 500, 24);
      extra.forEach((i, k) => put(N + k, `${names[i]} · hiring`, 600, 24));
    };
    draw();
    for (let i = 0; i < N; i++) cellOf[i] = i;
    extra.forEach((i, k) => (cell2Of[i] = N + k));
    if (document.fonts) document.fonts.ready.then(() => { draw(); texture.needsUpdate = true; });
  } else {
    const L = "ABCDEFGHJKLMNPRSTW";
    const c = 64;
    cols = 8;
    rows = 8;
    cvs.width = c * cols;
    cvs.height = c * rows;
    const inits = [];
    for (let k = 0; k < 64; k++) inits.push(L[Math.floor(rnd() * L.length)] + L[Math.floor(rnd() * L.length)]);
    const draw = () => {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 24px ${font}`;
      inits.forEach((s, k) => ctx.fillText(s, (k % cols) * c + c / 2, Math.floor(k / cols) * c + c / 2 + 1));
    };
    draw();
    for (let i = 0; i < N; i++) cellOf[i] = Math.floor(rnd() * 64);
    if (document.fonts) document.fonts.ready.then(() => { draw(); texture.needsUpdate = true; });
  }
  const texture = new CanvasTexture(cvs);
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return { texture, cols, rows, cellOf, cell2Of, names };
}

// ---------- the look switcher (?compare or ?style=) ----------
function switcher() {
  const bar = document.createElement("nav");
  bar.className = "look-switch";
  bar.setAttribute("aria-label", "Compare looks");
  bar.innerHTML = `<span>Look</span>` + STYLES.map((s) => {
    const u = new URL(location.href);
    u.searchParams.set("style", s);
    u.searchParams.delete("compare");
    return `<a href="${u.pathname}${u.search}"${s === STYLE ? ' aria-current="true"' : ""}>${LABELS[s]}</a>`;
  }).join("");
  document.body.appendChild(bar);
}

// ---------- helpers ----------
function set(a, i, x, y, z) {
  a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
}
function put(out, c, a, s, tg) {
  out[0] = c.r; out[1] = c.g; out[2] = c.b; out[3] = a; out[4] = s; out[5] = tg;
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
