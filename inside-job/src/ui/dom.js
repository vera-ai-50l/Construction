// Tiny DOM helpers.
export function h(tag, attrs, ...kids) {
  const [t, ...cls] = tag.split('.');
  const el = document.createElement(t || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
// set text only when it changed (cheap per-frame HUD updates)
export function txt(el, v) { v = String(v); if (el._t !== v) { el._t = v; el.textContent = v; } }
export function cls(el, name, on) { on = !!on; if (!el._c) el._c = {}; if (el._c[name] !== on) { el._c[name] = on; el.classList.toggle(name, on); } }
export function sty(el, k, v) { if (!el._s) el._s = {}; if (el._s[k] !== v) { el._s[k] = v; el.style.setProperty(k, v); } }
export const money = (v) => '$' + Math.round(v).toLocaleString('en-US');
export const clock = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
