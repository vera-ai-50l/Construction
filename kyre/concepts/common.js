// Shared helpers for the Kyre concept pages: scroll progress through the pinned stage,
// hero fade-out, caption switching and progress bars.
(function () {
  const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
  const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
  const ease = (x) => { const t = clamp(x, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const bump = (x, a, b, c, d) => smooth((x - a) / (b - a)) * (1 - smooth((x - c) / (d - c)));
  window.K = { clamp, smooth, ease, bump };

  // Story(stages) → { reduce, update(dt) → { cs, heroW } }. cs runs 0 (hero) … stages.
  window.Story = function (stages) {
    const story = document.getElementById("cstory");
    const hero = document.getElementById("chero");
    const cap = document.getElementById("ccap");
    const caps = [...cap.querySelectorAll(".cap")];
    const segs = [...cap.querySelectorAll(".seg i")];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cs = 0, active = -1;
    return {
      reduce,
      update(dt) {
        const r = story.getBoundingClientRect();
        const total = story.offsetHeight - innerHeight;
        const p = clamp(-r.top / total, 0, 1);
        const target = clamp(p * (stages + 0.7) - 0.35, 0, stages);
        cs = reduce ? target : cs + (target - cs) * (1 - Math.exp(-dt * 7));
        const heroW = 1 - smooth(cs / 0.6);
        hero.style.opacity = heroW.toFixed(3);
        hero.style.transform = `translate3d(0, ${(-(1 - heroW) * 40).toFixed(1)}px, 0)`;
        hero.classList.toggle("gone", heroW < 0.05);
        cap.style.opacity = smooth((cs - 0.45) / 0.4).toFixed(3);
        const s = clamp(Math.round(cs), 1, stages);
        if (s !== active) { active = s; caps.forEach((c, k) => c.classList.toggle("on", k === s - 1)); }
        segs.forEach((el, k) => el.style.setProperty("--f", clamp(cs - k, 0, 1).toFixed(3)));
        return { cs, heroW };
      },
    };
  };

  // Run fn(dt, now) every frame while the story is on screen.
  window.loop = function (fn) {
    let last = performance.now(), on = true;
    new IntersectionObserver((es) => (on = es[0].isIntersecting)).observe(document.getElementById("cstory"));
    const f = (now) => {
      requestAnimationFrame(f);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (on) fn(dt, now);
    };
    requestAnimationFrame(f);
  };
})();
