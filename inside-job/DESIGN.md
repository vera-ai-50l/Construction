# Inside Job: design and architecture

## The pitch
Two players, two different games that only work together.
- **Runner**: a first-person stealth game. You can't see the guards behind walls,
  you don't know keypad codes, and you can't open security doors.
- **Hacker**: a top-down security console. You can see cameras' views of guards,
  open doors, loop cameras and decode panels, but you can't touch anything
  physical.

Every important action needs information that only the other player has, so
the game is built around talking: "junction serial is Kilo-Delta four-four-nine",
"guard coming round the left corner in three, two…", "next symbol looks like a
crown". There's no story mode. The loop is: job board → heist → payout →
upgrades → harder board.

## Core loop
| Layer | Length | What's in it |
|---|---|---|
| Moment | seconds | sneak, hide in shadow, call out patrols, read a panel |
| Job | 5–12 min | network zones → crack the vault → grab loot → escape to the van |
| Session | 30–60 min | 3–6 jobs, streak bonuses, buying upgrades, Big Score every 5th job |
| Daily | every day | the same daily contract for every crew (compare hauls), new boards |

## Systems
- **Procedural buildings** (`core/level.js`): grid floor plan, rooms by theme
  (bank / museum / tech HQ), 2–3 security zones, guards with patrol routes,
  cameras, laser grids, loot, and panels. Seeded, so both players build the
  identical level from `{seed, theme, tier, twist}`.
- **Authoritative sim** (`core/sim.js`): runs only on the runner's machine.
  - Guard vision cones and suspicion meters, sound propagation, lights and
    shadow visibility.
  - Alarm levels, police timer, bag weight, panels, gadgets.
  - Deterministic step; no rendering code.
- **Panels** are the communication puzzles:
  - *Junction* (serial on a label → hacker types it) brings a zone online.
  - *Keypad / vault pad* (glyphs → cipher card → digits).
  - *Fuse box* (only the hacker sees the order, against a timer).
  - *Timelock* (both hold together, which drains bandwidth).
- **Hacker tools** spend bandwidth: door 1, laser 2, light 2, lure 2, loop 3,
  ping 3, plus a free waypoint marker.
- **Twists** change each job: Blackout, Double Shift, Hardwired, Silent Alarm,
  Tight Bag, All Eyes, Jammer. Each changes the pay multiplier.
- **Meta** (`core/meta.js`):
  - Crew save: wallet, upgrades, streak, history, bests.
  - Notoriety tiers, job board, daily contract, payouts and ratings.

## The crew plan
`core/guide.js` lists every step of the job for this building (get in,
network each zone, open the security door into the next zone, vault keypad,
timelock, grab, escape) and works out the current step from game state. The
Runner reads it from the sim and the Hacker from the snapshot, and a test
checks that both get the same step. Each step has a Runner line, a Hacker
line and a map target, which the Hacker sees as a flashing beacon.

## Balance notes
- The timelock uses `TIMELOCK_BW` (6) bandwidth in total. It must stay below
  the smallest bandwidth cap (Jammer: 7), or the vault cannot be opened
  without the Fat Pipe upgrade. `test/sim.test.mjs` checks every twist.
- Upgrade prices (`UPGRADE_PRICE` in `core/data.js`) are set so a crew that
  wins most jobs maxes every upgrade around job 10, not after job 4.

## Networking
Every transport exposes the same tiny "presence" model: each player owns one
JSON object, and everyone sees everyone's latest copy (`net/link.js`).
- **room**: claude.ai artifact `room` capability, one named room per crew code.
- **ws**: our own relay (`server.js`, about 120 lines, no dependencies), for
  self-hosting through a tunnel.
- **bc**: BroadcastChannel, for two tabs in one browser (testing).

Protocol (`app.js`):
- The runner publishes a compact snapshot 15 times a second, about 0.4–0.8 KB:
  - runner pose, visible guards, camera states, doors, lights, zones;
  - alarm, bag, the open panel's state, and recent events.
- The hacker publishes `{n, cmd: [[seq, type, ...args]], hold}`, re-sending
  unacknowledged commands until the snapshot's `ack` passes them.
- Everything is absolute state, so a dropped or reordered update heals
  itself on the next one.
- Crew progress syncs as "highest `rev` wins".
- A claude.ai room caps each player's presence at 4 KiB, so the crew save keeps
  only its last 8 jobs and last 3 dailies. The results replace the live
  snapshot at the end of a job (about 3.2 KB worst case), and the room link
  sheds job history if an update would still be too big.

Latency only affects what the hacker sees. The runner's movement is fully
local, so the first-person view never waits on the network.

The bodycam samples the already-rendered Runner canvas into a small JPEG.
The WebSocket and BroadcastChannel transports carry preview frames separately
from presence and drop queued video work under backpressure. The artifact
room uses a smaller preview, capped to its remaining presence budget. The
Hacker displays the latest frame beside the blueprint.

## Rendering (runner)
- **Engine**: three.js r170 on WebGL2, one esbuild bundle, Runner assets
  loaded when that role is selected.
- **Geometry**: walls, floors and trims are merged per material. Furniture,
  loot and doors are instanced.
- **Lighting**:
  - Room lights are baked into a small per-cell light texture the shaders sample.
  - The only real-time shadows come from the flashlight, and only on High.
  - An HDR environment for reflections.
- **Post-processing**: High uses HDR and bloom. Medium keeps the HDR grade
  with no multisampling or bloom. Low and browsers without a usable HDR
  framebuffer draw directly to the canvas with tone mapping.
- **Performance**:
  - The guards and frequently repeated props use small low-poly GLBs.
  - Adaptive resolution adjusts the pixel budget to frame times.
  - Auto uses a Retina-aware preset on Mac. The F2 overlay shows live FPS and
    render resolution.
- **Hacker**: a 2D canvas only; it never loads three.js assets or creates a WebGL
  context.

## Testing
- `test/levelgen.test.mjs`: 360 generated levels (every tier, theme and
  twist), checked for determinism and a junction in every zone.
- `test/sim.test.mjs`: scripted full runs (30/30 wins), a stress run, and
  snapshot size.
- Two-browser end-to-end over the relay:
  - lobby, ready-up and job start;
  - snapshot flow, command and ack flow;
  - the junction serial puzzle;
  - results and crew sync.
