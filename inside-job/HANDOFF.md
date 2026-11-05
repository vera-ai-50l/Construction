# Inside Job: handoff

You're picking up a working, published browser game. This doc tells you what
it is, what state it's in, how the code fits together, and what you must not
break. Read it fully before changing anything. Then read `README.md` (how to
play) and `DESIGN.md` (design and architecture summary).

## 1. What it is
Inside Job is a two-player co-op heist game that runs in the browser.
- **The Runner** plays a first-person 3D stealth game (three.js). They can't
  see guards behind walls, don't know codes, and can't open security doors.
- **The Hacker** ("the van") plays a 2D top-down security console. They see
  guards on camera, open doors, loop cameras and decode panels, but can't
  touch anything physical.
- **The core mechanic is talking.** The runner reads something physical (a
  serial on a junction box, glyphs on a keypad) and says it out loud. The van
  types or decodes it while watching for guards.
- **It's endless:** job board → heist (5–12 min) → payout → shared upgrades →
  harder board. There's a daily contract, a Big Score every 5th job, and no
  story mode.

**Who plays it:** two people on a voice call in different cities, one on a
Windows laptop and one on a MacBook (model unknown; assume Apple Silicon). The
hard targets are 45+ FPS on her Mac and a "studio-produced" look.

## 2. Current state (as of 2026-11-05)
**Live:** published as a private claude.ai artifact at
https://claude.ai/artifact/CGgFz4Xt9HJQ3NxbBJAQ74 . Only Claude (via the
Artifact tool in Claude Code) can republish to that URL; see section 9.

**Verified working:**
- Unit tests:
  - `test/levelgen.test.mjs`: 360 levels across every theme, tier and twist.
    Checks determinism and a junction in every zone.
  - `test/sim.test.mjs`: 30/30 scripted full heists won, a stress run, and
    snapshots of at most about 700 bytes.
- Two-browser end-to-end over the WebSocket relay (`test/e2e-two-player.mjs`).
  All 13 checks pass:
  - both players land in the same job and contract;
  - the van receives the runner's snapshots;
  - a van marker reaches the runner's sim, and the ack prunes the command;
  - the runner reads the junction serial and the van types it, which brings
    the zone online;
  - both players see the results, and both presence objects are under 4 KiB;
  - the crew save syncs, and the next job board is identical on both sides.
- Screens checked visually (headless Chromium, SwiftShader):
  - title, safehouse, upgrades, settings, results;
  - the van view, and the runner view with its HUD and markers;
  - phone-width layouts.

**Not verified yet (couldn't be tested from a headless cloud box):**
- The claude.ai `room` transport between two real people. Its code follows the
  platform's typed contract, but it has never run live.
- Real-GPU FPS on a Mac. Headless tests ran on a software renderer.
- Gamepad, touch and Safari specifics. The game targets desktop
  keyboard/mouse; phones get the menus, but the runner isn't designed for
  touch.

**Known issues and loose ends:**
- No single-player mode. Solo testing means two browser *windows* side by
  side. Not tabs: a hidden tab pauses the runner's requestAnimationFrame loop.
- About 600–670k triangles at spawn on Low, mostly from instanced furniture.
  There are no LODs. Fine for Apple Silicon, but the first thing to cut if FPS
  is bad.
- There may be faint diagonal streaks near the skyline at grazing angles.
  This was seen once and never isolated.
- `assets/models/bottle.glb` and `assets/env/hall.exr` are unused.
- The project is **not a git repo**. The zip you were given is the only copy.
  Put it under version control first.

## 3. Run, build, test
Needs Node 18+. The only dependencies are `three@0.170.0` and `esbuild@0.24.0`.

```bash
npm install
npm run build      # tools/build.mjs -> dist/
npm run dev        # build + node server.js on http://localhost:8080 (static files + WebSocket relay at /ws)
node test/levelgen.test.mjs
node test/sim.test.mjs
node test/e2e-two-player.mjs ws   # needs `npm run dev` running and Playwright + Chromium installed
```

To play over the internet without claude.ai, run `npm run dev` on one machine
and then run `cloudflared tunnel --url http://localhost:8080`. Both players open
the printed `https://….trycloudflare.com` URL and use the same crew code.

**Dev URL parameters** (they work on the self-hosted `play.html`; the claude.ai
wrapper may not pass query strings through):

| Parameter | What it does |
|---|---|
| `?dev` | Single-player dev boot straight into a job, no networking. `&role=hacker` for the van view; `&seed= &theme= &tier= &twist= &q=low/medium/high`; `&nolock` for drag-to-look instead of pointer lock |
| `?crew=ABCDE&name=Ann&role=runner` | Skips the menus |
| `&auto` | Auto-readies and picks a job (used by the e2e test) |
| `&manual` | Stops the rAF loop so tests can step frames via `IJ.app.manualStep(dt)` |
| `?net=ws`, `room` or `bc` | Forces a transport. `bc` is BroadcastChannel, for tabs in one browser |

`window.IJ` is the debugging handle:
- normally it exposes `app`;
- during a job it adds `sim`, `view` and `L` (the level) on the runner, or
  `hk` and `L` on the van;
- in `?dev` mode it also exposes `world`, `renderer` and `tick(n)`.

## 4. Repo map
About 7,200 lines of plain ES modules, no framework.

| Path | Lines | Responsibility |
|---|---|---|
| `src/main.js` | 85 | Entry. Boots `App`, or the `?dev` single-player harness |
| `src/app.js` | 588 | The whole app shell: title → crew lobby ("safehouse") → job → results. Owns networking glue, crew save, ready-up, job start, per-frame loops for both roles |
| `src/core/data.js` | 136 | **All tuning tables**: cell size, loot, furniture, room types, themes, twists, upgrades, hacker costs and durations, ratings, notoriety names |
| `src/core/level.js` | 710 | Seeded procedural building: grid floor plan, rooms, doors (`entry`, `swing`, `edoor` security doors, `vault`), zones, cameras, lasers, guards and patrol routes, loot, panels, spawn and van. Also A*, grid helpers |
| `src/core/sim.js` | 838 | **Authoritative game simulation** (runner's machine only): runner movement and visibility, guard AI with vision cones and suspicion, cameras, lasers, doors, panels, alarm and police timer, gadgets, hacker commands, events, `snapshot()`, `summary()` |
| `src/core/meta.js` | 116 | Crew save, job board, daily contract, payout and ratings, upgrades, `trimCrew()` |
| `src/core/rng.js`, `geom.js` | 173 | Seeded RNG and string hash; geometry helpers |
| `src/net/link.js` | 171 | Transports behind one presence API: `RoomLink` (claude.ai), `WsLink` (our relay), `BcLink` (BroadcastChannel). `openLink(code)` tries room → ws → bc |
| `server.js` | ~120 | Zero-dependency static server plus WebSocket relay (rooms keyed by crew code) |
| `src/game/runner.js` | 272 | `RunnerView`: first-person camera, input, head bob, adaptive resolution, waypoint marker, glue between sim, world and HUD |
| `src/render/world.js` | 692 | `World`: builds the three.js scene from the level (merged static geometry, instanced props, guards with animation) and syncs dynamic state from the sim each frame |
| `src/render/architecture.js`, `geo.js`, `props.js`, `materials.js`, `lighting.js` | ~960 | Walls, floors, trims, procedural props, PBR materials, baked per-cell light texture |
| `src/render/post.js` | 82 | HDR target → half-res bloom → one final pass (ACES, grade, vignette, grain, chromatic aberration, alarm tint) |
| `src/render/assets.js` | 98 | Loads GLB models, textures and the HDR env map (see the base64 note in §7) |
| `src/render/gfx.js` | 31 | One shared `WebGLRenderer`; `guessQuality()` from the GPU name |
| `src/ui/hacker.js` | 822 | `HackerView`: the van's 2D canvas blueprint, tools, serial input, cipher card, events log. **Never loads three.js or WebGL** |
| `src/ui/hud.js`, `panelview.js`, `panelart.js`, `glyphs.js` | ~535 | Runner HUD, panel close-up overlays (junction label, keypad, fuse box, timelock), glyph art |
| `src/ui/style.css`, `shell.html`, `dom.js` | ~520 | All styling (dark only), page shell, tiny DOM helper `h()` |
| `src/audio/sfx.js` | 158 | Fully synthesized WebAudio sound effects (no audio files) |
| `tools/build.mjs` | ~60 | esbuild bundle (one IIFE, inlined) → `dist/index.html` (claude.ai fragment) + `dist/play.html` (standalone). Copies `assets/` and writes `*.b64.txt` copies of binary assets |
| `assets/` | 6.6 MB | 19 GLB models (meshopt + WebP), 12 WebP textures, 2 EXR environments. Licences in `CREDITS.md` (several are CC BY 4.0: keep the credits) |

## 5. How a frame flows
```
RUNNER'S MACHINE                                   HACKER'S MACHINE
input → RunnerView → Sim.step(dt, input, hackerCmds)
                       │                            HackerView (2D canvas)
                       ├─ World.sync → three.js        ▲         │ clicks / typing
                       ├─ HUD, PanelView               │         ▼
                       └─ snapshot() ──15 Hz──► presence.s ──► setSnap()
   Sim.applyHacker(h) ◄── presence.h {n, cmd:[[seq,type,...args]], hold} ◄─┘
```
- The sim runs **only** on the runner's machine. The hacker only renders
  snapshots and sends commands.
- Both machines build the identical level locally from
  `{seed, theme, tier, twist}`, so the level is never sent over the network.
- Runner movement is fully local, so network latency only affects what the
  van sees.

## 6. Network protocol (`src/app.js`, `src/net/link.js`)
Every transport exposes the same "presence" model. Each player owns one JSON
object; everyone sees everyone's latest copy. Everything is **absolute state**,
so a dropped or reordered update heals on the next one. Never send deltas.

**Presence fields (per player):**

| Field | Shape and meaning |
|---|---|
| `who` | `{v, name, role, ready, pick:{id,k}}` (`v` is the protocol version, `PROTO = 1`) |
| `crew` | The full crew save. **Highest `rev` wins**: the other side adopts it |
| `job` | `{n, c, roles}`. Set by the runner when both are ready (`maybeStart`); `n` is the unique job id, `c` the contract |
| `s`, `sn` | Runner snapshot (see below) and the job id it belongs to, 15 times a second |
| `h` | Hacker → runner: `{n, cmd, hold}`, where `cmd` is the last 24 `[seq, type, ...args]` entries and `hold` means Space is held for the timelock. Re-sent until the snapshot's `ack` passes the seq |
| `res` | `{n, c, sum, pay}` at job end. **Replaces** `s`, which is set to `null` |

**Hacker command types:** `serial`, `door`, `laser`, `light`, `loop`, `ping`,
`lure`, `mark`. They're handled in `Sim.cmd()`.

**Bandwidth costs** (`COST` in `data.js`): door 1, laser 2, light 2, lure 2,
loop 3, ping 3. The marker is free.

**Snapshot keys** (`Sim.snapshot()`): `t, ph, er` (time, phase, end reason),
`r` (runner pose and state), `g` (guards the van can see), `c` (cameras),
`l` (lasers), `d` (doors), `li` (room lights as a string), `z` (zone
bitmask), `a` (alarm), `pt` (police timer), `ld` (lockdown), `bw, bm`
(bandwidth), `lt` (loot taken), `bag`, `sec`, `ev` (recent events
`[id, type, ...args]`), `pn` (open panel), `tl, tla, vo` (timelock and vault),
`sm` (smoke), `ping`, `ack`, `cs, mm` (camera seeing, max suspicion meter),
`gd` (gadgets), `mk` (marker). Numbers are scaled ×100 integers to keep the
snapshot small.

## 7. Hard constraints: do not break these
1. **Presence must stay under 4 KiB per player.** The claude.ai room rejects a
   larger merged presence outright, which would freeze the van's feed. Keep
   these in place:
   - `trimCrew()` in `meta.js` (last 8 jobs, last 3 dailies);
   - results replace the snapshot at the end of a job;
   - the `PRESENCE_SOFT_MAX` guard in `RoomLink.set`.

   The worst case today is about 3.2 KB. Other room limits: strings at most
   1 KiB each, nesting at most 8 deep, about 40 updates a second. If you add
   anything to presence, measure it.
2. **Level generation must be deterministic.** Only use the seeded `RNG` in
   `level.js`, never `Math.random`. Both players must build byte-identical
   levels. `test/levelgen.test.mjs` checks this.
3. **The sim stays render-free and runner-only.** No DOM or three.js imports in
   `src/core/`. The `test/` scripts run it in plain Node.
4. **The hacker never loads three.js assets or creates a WebGL context.** The
   van must run on anything.
5. **Binary assets ship as base64 text.** The claude.ai artifact host only
   serves web media types (`.glb` and `.exr` are refused). So the build writes
   `assets/**/X.glb.b64.txt`, and `fetchBin()` in `src/render/assets.js`
   decodes it. To add a model:
   - drop the GLB in `assets/models/`;
   - add its name to `MODEL_NAMES`;
   - rebuild.
6. **Claude.ai artifact page contract** (for `dist/index.html`):
   - It's a fragment with no doctype, html, head or body tags, and
     `<title>` comes first.
   - Scripts must be inline (we bundle everything), and stylesheets can only
     come from Google Fonts.
   - Keep the `claude:viewport-fit-sides` meta tag out.
   - Pointer lock is only requested from a click, and its rejection is handled.
7. **Audio:** an `AudioContext` may only be created from a user gesture
   (`sfx.unlock()`).
8. **Performance budget:**
   - About 100–140 draw calls a frame.
   - Static geometry is merged per material, and furniture, loot and doors
     are instanced.
   - Real-time shadows come only from the flashlight, and only on High.
   - Adaptive resolution (`runner.js`) scales between 0.55 and 1.0 to hold
     about 47+ FPS.

   Don't add per-room real-time lights. Room lighting is baked into a per-cell
   light texture (`lighting.js`).

## 8. How to make common changes
- **Tune difficulty or economy:** `src/core/data.js` (twists, upgrades and
  costs, loot values, ratings), `meta.js` (`payout`, `makeBoard`, tiers) and
  the guard and camera constants in `sim.js`.
- **New twist:**
  1. Add it to `TWISTS` in `data.js`.
  2. Branch on `c.twist` in `level.js` (layout) and/or `sim.js` (rules).
  3. Run both unit tests.
- **New hacker tool:**
  1. Add the cost to `COST` and a `case` in `Sim.cmd()`.
  2. Add the button and keybind in `hacker.js`.
  3. Add a sound mapping in `eventSound()` in `sfx.js`.
- **New panel type:**
  1. Place it in `level.js`.
  2. Add its state in `Sim.makePanelState` and its actions in
     `Sim.panelAction`.
  3. Add the close-up art in `panelview.js` and `panelart.js`.
  4. Mirror whatever the van needs in `snapshot().pn` and `hacker.js`.
- **Visual quality:** the low/medium/high preset is chosen in
  Settings → Graphics (Auto uses `guessQuality()`). It's applied in three
  places:
  - `world.js`: shadows, number of spotlights;
  - `runner.js`: pixel-ratio cap, flashlight shadow;
  - `post.js`.

  Materials are in `materials.js`.

## 9. Deploying
- **Claude.ai artifact (the main way they play):** only Claude can publish or
  update it.
  1. Bring the updated project back to Claude Code.
  2. Ask it to rebuild and republish `dist/index.html` to
     https://claude.ai/artifact/CGgFz4Xt9HJQ3NxbBJAQ74 with:
     - the `room` capability;
     - every `dist/assets/**` file that's `.webp` or `.b64.txt`.

  The partner needs the artifact shared with her (Share menu), and both must
  be signed in to claude.ai.
- **Self-hosting:** `server.js` runs anywhere Node does, such as a laptop with
  cloudflared, Render, Fly.io or Railway. Outside claude.ai the game falls
  back to the WebSocket relay automatically.

## 10. Suggested next steps (in priority order)
1. **Get real-world feedback first:** a live two-person session over claude.ai,
   plus FPS numbers on her Mac. There's no in-game FPS counter yet: add a
   small toggle that shows `RunnerView.fps` and `scale`, or use Chrome
   DevTools → Rendering → Frame rendering stats.
2. Version control: `git init`, then push to a private GitHub repo.
3. Add a solo practice mode: runner-only with an AI "van" that auto-reads
   serials, or a hacker tutorial against a recorded run.
4. Add LODs or distance culling for instanced furniture if the Mac struggles.
5. Polish the onboarding: a first-job tutorial overlay with call-out prompts
   ("tell your partner the serial").
6. Add more content: a theme beyond bank, museum and tech HQ, more panel
   types, guard variety.
