# Inside Job

A two-player co-op heist game for the browser. One of you goes **inside** in
first person. The other stays **in the van** on a live blueprint. Neither of you
can finish a job alone. It's endless: every job deals a fresh building, the board
re-deals after every job, and there's a new daily contract each day.

Built for one Windows laptop and one Mac on a voice call, in different cities.

## Run this separate build

Unzip the archive, open a terminal in the extracted `inside-job` folder, and
run `npm start` with Node 18 or newer. Open http://localhost:8080 in a browser.
The ZIP includes the built game. To rebuild after changing the source, run
`npm ci` followed by `npm run build`.
The included `HANDOFF.md` describes the original Claude build.

For remote co-op, share one running server with both players using the tunnel
instructions below. Use the same crew code. The Hacker's **Runner Bodycam**
panel shows the Runner's live first-person game view alongside the blueprint.
The relay sends up to eight preview frames per second. The artifact room
transport uses smaller previews when there is space in the room's presence
budget.

---

## Playing together

### Option A: an independently published claude.ai artifact
1. Open the game link. Enter your name and press **Start a new crew**.
2. Press **Copy** next to the crew code and send the 5-letter code to your partner.
3. Your partner opens the **same link**, types the code and presses **Join**.
4. Each of you picks a role (Runner or Hacker). Either of you picks a job. Both press **READY**.

Your partner needs access to the artifact: share it with them from the artifact's
share menu. Both of you must be signed in to claude.ai.

Talk on a voice call (WhatsApp, Discord, Meet) the whole time. The game is built
around talking.

### Option B: your own server (use this for the ZIP)

```bash
npm start
```

That serves the packaged build at http://localhost:8080 with a built-in
WebSocket relay. To let someone in another city join, open a free Cloudflare
quick tunnel in a second terminal (install `cloudflared` first):

```bash
cloudflared tunnel --url http://localhost:8080
```

Send them the `https://….trycloudflare.com` address it prints. Both of you open
that address and use the same crew code.

### Option C: your VPS (permanent address, progress sticks)

Vercel can't host co-op because the relay needs a long-running process. Run the
included `Dockerfile` on a VPS behind Caddy instead. See
[deploy/README.md](deploy/README.md) for the steps. The game picks the best connection
on its own: claude.ai room first, then the relay, then (for testing) two tabs
in one browser.

---

## Controls

**Runner (keyboard + mouse)**

| Key | Action |
|---|---|
| WASD | Move |
| Mouse | Look (click the game to lock the mouse; Esc to release) |
| Shift | Sprint (loud) |
| C | Crouch (quiet, harder to see) |
| Hold E | Interact: pick locks, grab loot, open panels |
| F | Flashlight |
| 1 / 2 / 3, G | Select and use a gadget (EMP, smoke, noisemaker) |
| Q | Takedown (from behind, costs you the Clean rating) |

**Hacker (mouse)**

| Input | Action |
|---|---|
| Click | Act on what's under the cursor: open a door, loop a camera, kill a laser |
| 1–6 | Pick a tool: Doors, Lasers, Lights, Loop cam, Ping, Lure |
| Right-click | Drop a waypoint marker the runner sees in their view |
| Drag / wheel | Pan / zoom the blueprint. F follows the runner |
| Hold Space | Hold the vault timelock together with the runner |

## How a job works
The **How to play** tab in the safehouse walks through this. During a job both
players see the current step: the Runner at the top left (press Esc for the
whole plan), the Hacker in **THE PLAN** card, with the next spot flashing on the map.

1. **Get in.** The runner picks the side entrance. The hacker watches the
   cameras and calls out guards.
2. **Network the building.** The hacker can only touch a zone's doors, cameras and
   lasers once it's online. The runner finds the zone's **junction box** and
   reads the serial off the label ("Bravo-Kilo, four-one-seven"). The hacker
   types it in. Get it wrong and the port locks for 10 seconds.
3. **Panels that need both of you.**
   - *Keypads*: the runner describes each symbol ("looks like an anchor"). The
     hacker reads back the digit from the cipher card.
   - *Fuse boxes*: the hacker sees the order. The runner pulls the fuses as
     told, against a timer.
   - *Vault timelock*: the runner holds the wheel while the hacker holds Space.
     It uses about 6 bandwidth, so the hacker saves up first.
4. **Grab the target** (and anything else that fits in the bag) and get back to the van.

Bandwidth is the hacker's currency: doors 1, lasers 2, lights 2, lure 2,
camera loop 3, ping 3. It regenerates slowly.

**Ratings:** Ghost (never spotted, +25%), Clean (no alarms or takedowns, +15%),
Fast (beat par, +10%), Full Haul (+20%), and Switch-Up (+10% for swapping roles
since the last job). Streaks add up to +50%. Getting busted costs a lawyer fee.

**Between jobs:** spend the crew wallet on shared upgrades. Notoriety rises as
you win, which means tougher buildings that pay more. Every fifth job is a Big Score.

---

## Performance
**Graphics: Auto** uses a Retina-aware pixel budget on Mac and adjusts
resolution based on frame times. Press **F2** in the Runner view to see FPS
and the effective render resolution. **Low** uses the direct WebGL render
path and skips the HDR post-processing passes.

## Testing cheats

- For solo Runner practice, open http://localhost:8080/?dev and press **F3**
  during a job to show the test controls.
- For two-player testing, add `?cheats` to the Runner's URL before joining
  the crew. When using other URL options, append `&cheats`.
- The Runner can toggle **Ghost mode**, open security doors and network zones,
  open the vault, or restock gadgets and the Hacker's bandwidth. Test jobs
  award zero payout and skip crew progression.

## Developing

```bash
npm run build
```

`dist/index.html` is the claude.ai artifact page and `dist/play.html` the
standalone page; `dist/assets/` holds the models and textures.

Dev shortcuts: `?dev` drops straight into a job (`?dev&role=hacker` for the van);
`?net=bc` forces two-tabs-in-one-browser mode; `?crew=ABCDE&name=Ann&role=runner`
skips the menus.

Tests:

```bash
node test/levelgen.test.mjs
```

```bash
node test/sim.test.mjs
```

See [DESIGN.md](DESIGN.md) for how it's built and [CREDITS.md](CREDITS.md) for the 3D assets.
