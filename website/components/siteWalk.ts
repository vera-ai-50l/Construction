// The demo site walk: shared by the 3D scene (camera, anchors, build stage) and the DOM overlay (captions, labels).

export type V3 = [number, number, number];

export const FLOORS = 11;
export const W = 4.2;
export const D = 3;
export const H = 0.62;
export const TOP = FLOORS * H;

export const YARD: V3 = [-4.7, 0, -2.3];
export const OFFICE: V3 = [-5.2, 0, 2.7];
export const TRUCK: V3 = [5.6, 0, -3.4];
export const MEASURE: V3 = [W / 2 + 0.42, 0, D / 2 + 0.42];
export const CRANE: V3 = [W / 2 + 1.8, 0, -0.5];
export const CRANE_H = TOP + 2.6;

export type Step = {
  tag: string;
  /** What the building site is doing during this step. */
  phase: string;
  title: string;
  body: string;
  anchor: V3;
  cam: { pos: V3; look: V3 };
  /** How complete the building is by the end of this step (0 = empty plot, 1 = handed over). */
  build: number;
};

export const STEPS: Step[] = [
  {
    tag: "Learns your site",
    phase: "Foundation",
    title: "Vera starts by reading every register",
    body: "Three months of POs, challans, issue slips and the BOQ, matched line by line. Nobody on site changes how they work.",
    anchor: [OFFICE[0], 1.05, OFFICE[2]],
    cam: { pos: [17, 11, 19], look: [-0.8, 2.4, 0] },
    build: 0.16,
  },
  {
    tag: "Supervisors just talk",
    phase: "Floors 1 to 4",
    title: "A voice note in. The record out.",
    body: "Hindi, Marathi or Gujarati, on the WhatsApp they already use. Progress, labour, materials and hindrances, logged before evening.",
    anchor: [1.25, 4 * H + 0.5, 1.05],
    cam: { pos: [11.5, 6.2, 10.5], look: [0.3, 2.9, 0.2] },
    build: 0.4,
  },
  {
    tag: "Finds the leak",
    phase: "Floors 5 to 7",
    title: "It finds where material walks off",
    body: "Every bag and bar traced from PO to challan to issue to the BOQ. The gaps light up, with a rupee figure on each.",
    anchor: [YARD[0], 0.75, YARD[2]],
    cam: { pos: [-14.5, 6.6, -4.4], look: [-4.4, 0.6, -2.2] },
    build: 0.58,
  },
  {
    tag: "8 AM summary",
    phase: "Floors 8 to 11",
    title: "One page before your first chai",
    body: "Every site on one WhatsApp page at 8 AM: who reported, what moved, which rupees are at risk.",
    anchor: [0, TOP + 0.6, 0],
    cam: { pos: [8, 21, 15], look: [0, 5.8, 0] },
    build: 0.8,
  },
  {
    tag: "Bill-to-cash",
    phase: "Walls and glazing",
    title: "Every bill leaves complete",
    body: "Running bills built from the record, with measurements, photos and test certificates, then followed up until the money lands.",
    anchor: [MEASURE[0], 4 * H, MEASURE[2]],
    cam: { pos: [13.5, 5.5, 13], look: [1.4, 2.8, 0.8] },
    build: 0.93,
  },
  {
    tag: "Project control",
    phase: "Handover",
    title: "The whole project, 13 weeks ahead",
    body: "Plan vs actual, cost to finish and a cash forecast every week, so the last floor finishes on time and on budget.",
    anchor: [CRANE[0], CRANE_H + 1.5, CRANE[2]],
    cam: { pos: [-17, 4.2, 18], look: [0.8, 5, 0] },
    build: 1,
  },
];

/** Screens of the demo: one to bring the building to centre stage, then one per step. */
export const SCREENS = STEPS.length + 1;

/** Demo progress (0 to 1) → intro blend and step position. */
export function stage(p: number) {
  const s = p * SCREENS;
  return { intro: Math.min(Math.max(s, 0), 1), c: s - 1 };
}

export function stepAt(p: number) {
  const { c } = stage(p);
  return c < 0 ? -1 : Math.min(Math.floor(c), STEPS.length - 1);
}

/** DOM label nodes, positioned every frame by the scene's projector. */
export const labels: { dot: HTMLElement | null; card: HTMLElement | null }[] = STEPS.map(() => ({
  dot: null,
  card: null,
}));
