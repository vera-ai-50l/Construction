// Concept: The Live Inbox. A real-looking reply inbox runs by itself. Kyre tags each reply:
// noise collapses into the "handled" counter, interested replies fly into Your leads and the bill ticks up.
// Hover the inbox to pause it. Scrolling zooms out to the nine warmed mailboxes, then to your leads.
(function () {
  const S = Story(3);
  const scene = document.getElementById("ibScene"), app = document.getElementById("ibApp");
  const list = document.getElementById("ibList"), leads = document.getElementById("ibLeads");
  const handledEl = document.getElementById("ibHandled"), billedEl = document.getElementById("ibBilled");
  const boxes = [...scene.querySelectorAll(".ib-box")];
  const stream = scene.querySelector(".ib-stream");
  const SW = 640, SH = 480;

  const REPLIES = [
    ["Sarah Kim", "Northwind Logistics", "Yes, send me two profiles for the Leeds role.", 1],
    ["Auto-reply", "Brightpath Care", "I'm out of the office until Monday the 18th.", "Out of office"],
    ["James Okafor", "Halden Foods", "Not hiring for that until Q1, try me then.", "Not now"],
    ["Leah Morris", "Corvel Energy", "Interesting. Free for a call Thursday?", 1],
    ["Priya Nair", "Stackwise", "Please remove me from your list.", "Unsubscribed"],
    ["Tom Reid", "Fernhill Homes", "What would the fee look like for 3 hires?", 1],
    ["Auto-reply", "Meridian Health", "Thanks for your email. I'm on leave.", "Out of office"],
    ["Mark Ellis", "Quanta Retail", "I've moved on, try Hannah in HR.", "Wrong person"],
    ["Amira Haddad", "Lumen Labs", "Can you send a quote for two engineers?", 1],
    ["Chris Dale", "Oakridge Group", "We've got this covered for now, thanks.", "Not now"],
    ["Dan Walsh", "Kestrel Systems", "Sounds good, what's the salary range?", 1],
    ["Auto-reply", "Pinecrest Hotels", "Your message has been received.", "Out of office"],
  ];
  const MAIL = [
    ["jamie@acmetalent.co", 24, 21], ["jamie@acme-talent.com", 25, 28], ["j.lee@acmetalent.co", 19, 17],
    ["hello@acmetalent.io", 22, 24], ["jamie@getacmetalent.com", 25, 26], ["team@acme-talent.com", 21, 19],
    ["j.lee@acme-talent.io", 23, 22], ["talent@acmetalent.co", 25, 27],
  ];
  boxes.forEach((b, k) => {
    const [m, sent, days] = MAIL[k];
    b.innerHTML = `<i class="ok"></i><b>${m}</b><div class="w"><span>Warmed</span><span>${days} days</span></div><div class="bar"><i style="--w:${Math.min(100, days / 28 * 100)}%"></i></div><div class="sent"><span>${sent - 6}</span><small> / 25 sent today</small></div>`;
    b.dataset.sent = sent - 6;
  });

  let handled = 36, billed = 12, k = 0, clock = 0, next = 0.6, paused = false;
  scene.addEventListener("pointerenter", () => { paused = true; scene.classList.add("paused"); });
  scene.addEventListener("pointerleave", () => { paused = false; scene.classList.remove("paused"); });

  const initials = (n) => n === "Auto-reply" ? "↺" : n.split(" ").map((w) => w[0]).join("");
  const timers = []; // [time, fn] on the virtual clock, so hover pauses everything
  const at = (dt, fn) => timers.push([clock + dt, fn]);

  function scaleOf() { return app.getBoundingClientRect().width / SW || 1; }
  function localRect(el) {
    const a = app.getBoundingClientRect(), r = el.getBoundingClientRect(), s = scaleOf();
    return { x: (r.left - a.left) / s, y: (r.top - a.top) / s, w: r.width / s, h: r.height / s };
  }

  function arrive() {
    const [name, co, text, kind] = REPLIES[k++ % REPLIES.length];
    const yes = kind === 1;
    const row = document.createElement("div");
    row.className = "ib-row";
    row.innerHTML = `<span class="ib-av">${initials(name)}</span><b>${name} · ${co}</b><p>${text}</p><span class="ib-tag">Reading</span>`;
    list.prepend(row);
    trim();
    const tag = row.querySelector(".ib-tag");
    at(0.5, () => tag.classList.add("reading"));
    at(1.3, () => {
      tag.textContent = yes ? "Interested" : kind;
      tag.classList.add("on");
      if (yes) { tag.classList.add("yes"); row.classList.add("yes"); }
    });
    at(2.6, () => {
      if (!row.isConnected) return;
      if (yes) fly(row, name, co, text); else handle(row);
    });
  }

  // keep the list full: older rows stay (dimmed) until there are too many, then the oldest folds away
  function trim() {
    const rows = [...list.children].filter((r) => !r.classList.contains("gone"));
    rows.slice(6).forEach(collapse);
  }
  function handle(row, quiet) {
    row.classList.add("done");
    row.querySelector(".ib-tag").textContent = "Handled";
    if (quiet) return;
    handledEl.textContent = ++handled;
    const h = handledEl.parentElement; h.classList.remove("tick"); void h.offsetWidth; h.classList.add("tick");
  }

  function collapse(row) {
    row.style.height = row.offsetHeight + "px";
    requestAnimationFrame(() => { row.classList.add("gone"); row.style.height = "0px"; });
    setTimeout(() => row.remove(), 500);
  }

  function fly(row, name, co, text) {
    const from = localRect(row), to = localRect(leads);
    const f = document.createElement("div");
    f.className = "ib-fly"; f.textContent = `${name} · Interested`;
    app.appendChild(f);
    const dur = S.reduce ? 10 : 700;
    f.animate([
      { transform: `translate(${from.x + 40}px, ${from.y + 8}px) scale(1)`, opacity: 1 },
      { transform: `translate(${(from.x + to.x) / 2 + 40}px, ${Math.min(from.y, to.y) - 30}px) scale(1.05)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${to.x + 10}px, ${to.y + 4}px) scale(.9)`, opacity: 0.2 },
    ], { duration: dur, easing: "cubic-bezier(.5,0,.2,1)" }).onfinish = () => {
      f.remove();
      const c = document.createElement("div");
      c.className = "ib-lead"; c.innerHTML = `<b>${name}</b><span>${co}</span><span>"${text}"</span>`;
      leads.prepend(c);
      while (leads.children.length > 4) leads.lastChild.remove();
      billedEl.textContent = ++billed;
      const b = billedEl.closest(".ib-billed"); b.classList.remove("tick"); void b.offsetWidth; b.classList.add("tick");
    };
    row.classList.add("sent");
    const tg = row.querySelector(".ib-tag"); tg.textContent = "Sent to you";
  }

  // seed the stream with replies Kyre already sorted
  [["Auto-reply", "Harbour Freight", "Out until the 21st, back after.", "Handled"], ["Nina Shah", "Elmford Engineering", "Not this quarter, sorry.", "Handled"],
   ["Ravi Patel", "Granite Build", "Yes, happy to look at profiles.", "Sent to you"], ["Auto-reply", "Silver Clinics", "This inbox is not monitored.", "Handled"]]
    .forEach(([n, c, t, tag]) => {
      const r = document.createElement("div");
      r.className = "ib-row " + (tag === "Handled" ? "done" : "yes sent");
      r.innerHTML = `<span class="ib-av">${initials(n)}</span><b>${n} · ${c}</b><p>${t}</p><span class="ib-tag on${tag === "Handled" ? "" : " yes"}">${tag}</span>`;
      list.append(r);
    });

  // seed the leads panel
  [["Leah Morris", "Corvel Energy", "Free for a call Thursday?"], ["Tom Reid", "Fernhill Homes", "What would the fee look like?"]]
    .forEach(([n, c, t]) => { const d = document.createElement("div"); d.className = "ib-lead"; d.innerHTML = `<b>${n}</b><span>${c}</span><span>"${t}"</span>`; leads.append(d); });

  let sentAcc = 0;
  function layout(cs) {
    const W = innerWidth, H = innerHeight, wide = W > 960;
    const copyRight = Math.max(24, (W - 1160) / 2 + 24) + 540;
    let sc, x, y;
    if (wide) {
      sc = Math.min(1, (W - copyRight - 48) / SW, (H - 160) / SH);
      x = W - 48 - SW * sc - Math.max(0, (W - copyRight - 48 - SW * sc) / 2);
      y = 69 + (H - 69 - SH * sc) / 2;
    } else {
      sc = Math.min((W - 24) / SW, (H * 0.46) / SH);
      x = (W - SW * sc) / 2; y = 80;
    }
    // stage 2: zoom out so the app is one of nine mailboxes
    const z = K.bump(cs, 1.4, 2, 2.6, 3.1);
    scene.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${sc.toFixed(4)})`;
    app.style.transform = `scale(${(1 - z * 0.67).toFixed(4)})`;
    app.style.borderColor = z > 0.5 ? "var(--accent)" : "";
    boxes.forEach((b) => {
      const i = +b.dataset.i, gx = (i % 3) - 1, gy = Math.floor(i / 3) - 1;
      const bx = SW / 2 - 100 + gx * 214, by = SH / 2 - 75 + gy * 162;
      const d = (Math.abs(gx) + Math.abs(gy)) * 0.08;
      const zz = K.smooth((z - d) / (1 - d));
      b.style.opacity = zz.toFixed(3);
      b.style.transform = `translate(${(SW / 2 - 100 + (bx - SW / 2 + 100) * (0.6 + 0.4 * zz)).toFixed(1)}px, ${(SH / 2 - 75 + (by - SH / 2 + 75) * (0.6 + 0.4 * zz)).toFixed(1)}px) scale(${(0.85 + 0.15 * zz).toFixed(3)})`;
    });
    // stage 3: focus on the leads column
    const f = K.smooth((cs - 2.5) / 0.5);
    stream.style.opacity = (1 - f * 0.65).toFixed(3);
    return z;
  }

  loop((dt) => {
    const { cs } = S.update(dt);
    const z = layout(cs);
    if (!paused) {
      clock += dt;
      if (clock >= next) { arrive(); next = clock + (S.reduce ? 3 : 1.7); }
      for (let i = timers.length - 1; i >= 0; i--) if (timers[i][0] <= clock) { const fn = timers[i][1]; timers.splice(i, 1); fn(); }
    }
    if (z > 0.2) {
      sentAcc += dt;
      if (sentAcc > 0.5) {
        sentAcc = 0;
        const b = boxes[(Math.random() * boxes.length) | 0], n = +b.dataset.sent;
        if (n < 25) { b.dataset.sent = n + 1; b.querySelector(".sent span").textContent = n + 1; }
      }
    }
  });
})();
