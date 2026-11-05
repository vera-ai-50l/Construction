// Checklist of the crew plan (core/guide.js), shared by the Runner's pause
// screen and the Hacker's PLAN card. Only rebuilds when the step changes.
import { h } from './dom.js';

export function renderPlan(ol, step) {
  if (!ol || !step) return;
  const key = step.n + ':' + step.total + ':' + (step.alert ? 1 : 0);
  if (ol._k === key) return;
  ol._k = key;
  ol.textContent = '';
  step.steps.forEach((s, i) => {
    const state = i < step.n ? 'done' : i === step.n ? 'now' : 'todo';
    ol.appendChild(h('li.' + state, null, h('span.pi', { text: state === 'done' ? '✓' : String(i + 1) }), h('span', { text: s.title })));
  });
}
