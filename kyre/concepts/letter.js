// Concept: The Letter. One personal email is written live in front of you. Every blue word comes from a
// real hiring signal; wires show where. Every few seconds a new signal arrives and the letter rewrites itself.
// Hover a blue word to see its source. Scroll: the letter is sealed and sent, a reply comes back, it becomes a lead.
(function () {
  const S = Story(4);
  const scene = document.getElementById("ltScene"), sig = document.getElementById("ltSignal"), letter = document.getElementById("ltLetter");
  const wires = document.getElementById("ltWires"), thread = document.getElementById("ltThread"), lead = document.getElementById("ltLead");
  const typing = document.getElementById("ltTyping"), reply = document.getElementById("ltReply"), sent = document.getElementById("ltSent");
  const flap = letter.querySelector(".lt-flap"), stack = scene.querySelector(".lt-stack");
  const SW = 640, SH = 520;
  const tokens = [...scene.querySelectorAll("t")];
  const SETS = [
    { contact: "Sarah Kim, Head of Talent", first: "Sarah", company: "Northwind Logistics", signal: "posted 4 warehouse supervisor roles", place: "Leeds", offer: "three who could start this month", email: "sarah@northwind.co", subject: "4 supervisor roles in Leeds", when: "2 hours ago" },
    { contact: "Leah Morris, Talent Partner", first: "Leah", company: "Corvel Energy", signal: "opened a second site", place: "Aberdeen", offer: "two site engineers ready to talk", email: "leah@corvel.energy", subject: "new Aberdeen site", when: "Yesterday" },
    { contact: "Tom Reid, Founder", first: "Tom", company: "Fernhill Homes", signal: "hired a new Head of Sales", place: "Bristol", offer: "a shortlist of field sales reps", email: "tom@fernhillhomes.com", subject: "sales team in Bristol", when: "3 days ago" },
    { contact: "Amira Haddad, HR Manager", first: "Amira", company: "Lumen Labs", signal: "raised a Series A", place: "London", offer: "two backend engineers looking now", email: "amira@lumenlabs.io", subject: "hiring after the raise", when: "This week" },
    { contact: "Dan Walsh, Ops Director", first: "Dan", company: "Kestrel Systems", signal: "posted 6 technician roles", place: "Manchester", offer: "four technicians already vetted", email: "dan@kestrel.systems", subject: "6 technician roles", when: "5 hours ago" },
  ];
  // which signal field feeds which token
  const SRC = { first: "first", company: "company", signal: "signal", place: "place", email: "first", subject: "signal", offer: null };
  let set = 0, typed = {}, queue = [], tcl = 0, hold = 0;
  const fields = { first: "lsContact", company: "lsCompany", signal: "lsSignal", place: "lsPlace" };

  function loadSet(i, instant) {
    const d = SETS[i];
    document.getElementById("lsContact").textContent = d.contact;
    document.getElementById("lsCompany").textContent = d.company;
    document.getElementById("lsSignal").textContent = d.signal.replace(/^./, (c) => c.toUpperCase());
    document.getElementById("lsPlace").textContent = d.place;
    document.getElementById("ltWhen").textContent = d.when;
    sig.classList.remove("swap"); void sig.offsetWidth; sig.classList.add("swap");
    queue = tokens.map((t) => [t, d[t.dataset.k], false]);
    if (instant) { queue.forEach(([t, v]) => (t.textContent = v)); queue = []; }
  }
  loadSet(0, S.reduce);

  // hover a token or a field: light up the link between them
  function hot(k, on) {
    tokens.forEach((t) => t.classList.toggle("hot", on && SRC[t.dataset.k] === k));
    sig.querySelectorAll("dl div").forEach((d) => d.classList.toggle("hot", on && d.dataset.k === k));
    wires.querySelectorAll("path").forEach((p) => p.classList.toggle("hot", on && p.dataset.k === k));
  }
  let hovering = false;
  tokens.forEach((t) => {
    t.addEventListener("pointerenter", () => { hovering = true; hot(SRC[t.dataset.k], true); });
    t.addEventListener("pointerleave", () => { hovering = false; hot(null, false); });
  });
  sig.querySelectorAll("dl div").forEach((d) => {
    d.addEventListener("pointerenter", () => { hovering = true; hot(d.dataset.k, true); });
    d.addEventListener("pointerleave", () => { hovering = false; hot(null, false); });
  });

  function local(el) {
    const a = scene.getBoundingClientRect(), r = el.getBoundingClientRect(), s = a.width / SW || 1;
    return { x: (r.left - a.left) / s, y: (r.top - a.top) / s, w: r.width / s, h: r.height / s };
  }
  function drawWires(alpha) {
    let out = "";
    if (alpha > 0.02) {
      for (const t of tokens) {
        const k = SRC[t.dataset.k];
        if (!k || !t.textContent) continue;
        if (t.dataset.k === "email" || t.dataset.k === "subject") continue;
        const f = local(sig.querySelector(`[data-k="${k}"]`)), b = local(t);
        const x1 = f.x + f.w, y1 = f.y + f.h / 2, x2 = b.x + Math.min(b.w, 24) / 2, y2 = b.y + 2;
        out += `<path data-k="${k}" d="M${x1.toFixed(1)},${y1.toFixed(1)} C${(x1 + 70).toFixed(1)},${y1.toFixed(1)} ${(x2 - 50).toFixed(1)},${(y2 - 40).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="2.5"/>`;
      }
    }
    wires.innerHTML = out;
    wires.style.opacity = alpha.toFixed(3);
  }

  function layout() {
    const W = innerWidth, H = innerHeight;
    let sc, x, y;
    if (W > 960) {
      const copyRight = Math.max(24, (W - 1160) / 2 + 24) + 540;
      sc = Math.min(1, (W - copyRight - 40) / SW, (H - 120) / SH);
      x = W - 40 - SW * sc - Math.max(0, (W - copyRight - 40 - SW * sc) / 2);
      y = 69 + (H - 69 - SH * sc) / 2;
    } else {
      // phones: the letter alone, full width
      sc = Math.min((W - 24) / 370, (H * 0.48) / 400);
      x = (W - 370 * sc) / 2 - 270 * sc; y = 76;
    }
    scene.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${sc.toFixed(4)})`;
  }
  addEventListener("resize", layout);
  layout();

  let replied = false, wireT = 0;
  loop((dt) => {
    const { cs } = S.update(dt);
    // typing: a few characters per frame, then hold, then the next signal
    if (cs < 1.5 && !hovering) {
      if (queue.length) {
        tcl += dt * 55;
        while (tcl >= 1 && queue.length) {
          tcl--;
          const [t, v, started] = queue[0];
          if (!started) { queue[0][2] = true; t.textContent = ""; tcl -= 6; } // brief pause before each word
          tokens.forEach((x) => x.classList.remove("typing"));
          t.classList.add("typing");
          if (t.textContent.length < v.length) t.textContent = v.slice(0, t.textContent.length + 1);
          else queue.shift();
        }
        if (!queue.length) { tokens.forEach((x) => x.classList.remove("typing")); hold = 0; }
      } else if ((hold += dt) > 3.4) { set = (set + 1) % SETS.length; loadSet(set, S.reduce); }
    }
    // the reply and lead always use the first letter (Sarah), so settle on it once the story starts
    if (cs > 1.2 && set !== 0) { set = 0; loadSet(0, true); }
    if (cs > 1.2 && queue.length) { queue.forEach(([t, v]) => (t.textContent = v)); queue = []; tokens.forEach((x) => x.classList.remove("typing")); }

    // stage 2: seal and send
    const seal = K.smooth((cs - 1.3) / 0.5), go = K.smooth((cs - 1.85) / 0.45);
    const sigA = 1 - K.smooth((cs - 1.4) / 0.4);
    sig.style.opacity = sigA.toFixed(3); stack.style.opacity = sigA.toFixed(3);
    sig.style.transform = `translate(${(-40 * (1 - sigA)).toFixed(1)}px, 0)`;
    letter.style.transform = `translate(${(go * 200 - seal * 120).toFixed(1)}px, ${(-go * 200 + seal * 40).toFixed(1)}px) scale(${(1 - seal * 0.35 - go * 0.25).toFixed(3)}) rotate(${(go * -8).toFixed(2)}deg)`;
    letter.style.opacity = (1 - K.smooth((cs - 2.15) / 0.2)).toFixed(3);
    flap.style.opacity = seal.toFixed(3);
    flap.style.transform = `scaleY(${(-1 + seal * 2).toFixed(3)})`;
    letter.style.background = seal > 0.5 ? "#f3f1ec" : "";
    letter.querySelector(".lt-body").style.opacity = (1 - seal * 0.8).toFixed(3);
    sent.style.opacity = K.bump(cs, 1.5, 1.8, 2.0, 2.15).toFixed(3);
    wireT += dt;
    drawWires((1 - seal) * Math.min(1, wireT * 2));

    // stage 3: the reply
    const th = K.bump(cs, 2.2, 2.5, 3.3, 3.6);
    thread.style.opacity = th.toFixed(3);
    thread.style.transform = `translateY(${((1 - K.smooth((cs - 2.2) / 0.3)) * 20).toFixed(1)}px)`;
    const nowReplied = cs > 2.65;
    if (nowReplied !== replied) { replied = nowReplied; reply.classList.toggle("on", replied); }
    typing.style.opacity = cs > 2.3 && !replied ? "1" : "0";

    // stage 4: the lead
    const ld = K.smooth((cs - 3.35) / 0.4);
    lead.style.opacity = ld.toFixed(3);
    lead.style.transform = `translateY(${((1 - ld) * 24).toFixed(1)}px) scale(${(0.96 + ld * 0.04).toFixed(3)})`;
  });
})();
