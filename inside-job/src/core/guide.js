// The crew plan: one ordered list of steps for this building, and which one
// the crew is on now. The Runner HUD and the Hacker console both read it, so
// the two players always see the same step, each worded for their own job.
import { LOOT, TIMELOCK_BW } from './data.js';
import { roomAt } from './level.js';

export { TIMELOCK_BW };

const ZONE = (z) => 'zone ' + (z + 1);
const ZONE_UP = (z) => 'Zone ' + (z + 1);

// Security doors the hacker can open to let the runner into zone z.
export function doorsInto(L, z) {
  const out = [];
  for (const d of L.doors) {
    if (d.kind !== 'edoor' || d.ctrl !== z - 1) continue;
    const za = L.rooms[d.a].zone, zb = L.rooms[d.b].zone;
    if (za === z || zb === z) out.push(d.id);
  }
  return out;
}

// Game state the guide needs, from the authoritative sim (runner side)...
export function stateFromSim(L, sim) {
  const pi = L.loot.findIndex((l) => l.primary);
  return {
    picked: sim.doors[0].picked, zones: sim.zones,
    eopen: (i) => sim.doors[i].eopen,
    vaultPad: sim.panels[L.vaultPad].done, vaultOpen: sim.vaultOpen,
    prim: pi >= 0 ? sim.loot[pi] : 0, rx: sim.r.x, rz: sim.r.z,
    panel: sim.r.panel ? sim.r.panel.id : -1, bw: sim.bw, police: sim.police, bag: sim.r.bag.length,
  };
}

// ...or from the snapshot the hacker receives.
export function stateFromSnap(L, s) {
  const pi = L.loot.findIndex((l) => l.primary);
  return {
    picked: !(s.d[0] >= 20), zones: s.z,
    eopen: (i) => L.doors[i].kind === 'edoor' && s.d[i] >= 10,
    vaultPad: !!s.vp, vaultOpen: !!s.vo,
    prim: pi >= 0 ? +s.lt[pi] || 0 : 0, rx: s.r[0] / 100, rz: s.r[1] / 100,
    panel: s.pn ? s.pn.id : -1, bw: s.bw / 10, police: s.pt, bag: s.bag ? (s.bag[1] > 0 ? 1 : 0) : 0,
  };
}

// Every step of this job, in order. Each has a short title for the checklist.
export function planSteps(L) {
  const steps = [{ id: 'entry', title: 'Get inside' }];
  for (let z = 0; z < L.zones; z++) {
    if (z > 0 && doorsInto(L, z).length) steps.push({ id: 'door', z, title: 'Open the door to ' + ZONE(z) });
    steps.push({ id: 'junction', z, title: 'Network ' + ZONE(z) });
  }
  steps.push({ id: 'vaultpad', title: 'Crack the vault keypad' });
  steps.push({ id: 'timelock', title: 'Run the timelock together' });
  steps.push({ id: 'grab', title: 'Grab the target' });
  steps.push({ id: 'escape', title: 'Get back to the van' });
  return steps;
}

function stepDone(L, st, step) {
  switch (step.id) {
    case 'entry': return st.picked;
    case 'door': {
      if ((st.zones >> step.z) & 1) return true;
      if (doorsInto(L, step.z).some((i) => st.eopen(i))) return true;
      const r = roomAt(L, st.rx, st.rz);
      return r > 0 && L.rooms[r].zone >= step.z;
    }
    case 'junction': return !!((st.zones >> step.z) & 1);
    case 'vaultpad': return st.vaultPad || st.vaultOpen;
    case 'timelock': return st.vaultOpen;
    case 'grab': return st.prim >= 1;
    case 'escape': return st.prim === 2;
    default: return false;
  }
}

// The crew's current step, with the Runner's and the Hacker's instructions
// and the map target the hacker should guide the runner to.
export function currentStep(L, st) {
  const steps = planSteps(L);
  let n = steps.findIndex((s) => !stepDone(L, st, s));
  const pi = L.loot.findIndex((l) => l.primary);
  const tname = pi >= 0 ? LOOT[L.loot[pi].kind].name : 'the target';
  const P = st.panel >= 0 ? L.panels[st.panel] : null;
  const out = { steps, n, total: steps.length, done: n < 0 };
  if (n < 0) {
    out.n = steps.length;
    out.title = 'Target secured';
    out.runner = 'Grab more loot if you dare, or hold E at the van to drive away.';
    out.hacker = 'Target secured. More loot pays more, but every trip is a risk. Decide together, then the runner drives away from the van.';
    out.target = { kind: 'van', x: L.van.x, z: L.van.z, label: 'VAN' };
    return out;
  }
  const s = steps[n];
  out.title = s.title;
  switch (s.id) {
    case 'entry': {
      const d = L.doors[0];
      out.runner = 'Go to the side entrance and hold E to pick the lock.';
      out.hacker = 'Call out guards and cameras near the side entrance. Your tools come online once the runner networks zone 1.';
      out.target = { kind: 'door', id: 0, x: d.x, z: d.z, label: 'SIDE ENTRANCE' };
      break;
    }
    case 'door': {
      const ids = doorsInto(L, s.z);
      const j = L.panels[L.junction[s.z]];
      let best = ids[0], bd = 1e9;
      for (const i of ids) { const d = L.doors[i], dd = (d.x - j.x) ** 2 + (d.z - j.z) ** 2; if (dd < bd) { bd = dd; best = i; } }
      const d = L.doors[best];
      out.runner = ZONE_UP(s.z) + ' is behind a security door. Go to the door the van names, then ask them to open it.';
      out.hacker = 'Click the flashing security door into ' + ZONE(s.z) + ' to open it (1 BW). Tell the runner which door it is.';
      out.target = d ? { kind: 'door', id: d.id, x: d.x, z: d.z, label: 'DOOR TO ZONE ' + (s.z + 1) } : null;
      break;
    }
    case 'junction': {
      const p = L.panels[L.junction[s.z]];
      if (P && P.id === p.id) {
        out.runner = 'Read the serial on the label out loud to the van, for example "Kilo-Delta, four-four-nine".';
        out.hacker = 'Type the serial the runner reads into the box under COMMS and press Enter. A wrong code locks the port for 10 seconds.';
      } else {
        out.runner = 'Find the ' + ZONE(s.z) + ' junction box, a grey box on a wall. The van can see it on the map. Hold E to open it.';
        out.hacker = 'Guide the runner to the flashing junction box for ' + ZONE(s.z) + '. When they open it, type the serial they read.';
      }
      out.target = { kind: 'panel', id: p.id, x: p.x, z: p.z, label: 'JUNCTION · ZONE ' + (s.z + 1) };
      break;
    }
    case 'vaultpad': {
      const p = L.panels[L.vaultPad];
      if (P && P.id === p.id) {
        out.runner = 'Describe each symbol to the van, one at a time, and press the digit they read back.';
        out.hacker = 'Find each symbol the runner describes on the CIPHER CARD and read back its digit. Two mistakes raise the alarm.';
      } else {
        out.runner = 'Find the vault keypad on the wall beside the vault door and hold E to open it.';
        out.hacker = 'Guide the runner to the vault keypad. You will read the code off your cipher card.';
      }
      out.target = { kind: 'panel', id: p.id, x: p.x, z: p.z, label: 'VAULT KEYPAD' };
      break;
    }
    case 'timelock': {
      const d = L.doors[L.vaultDoor];
      const short = st.bw < TIMELOCK_BW - 0.05;
      out.runner = 'Hold E on the vault door wheel and keep holding. The van holds Space at the same time.';
      out.hacker = (short ? 'Save up first: the timelock uses about ' + TIMELOCK_BW + ' BW and you have ' + st.bw.toFixed(1) + '. ' : '') +
        'When the runner holds the wheel, hold SPACE until the vault opens.';
      out.target = { kind: 'door', id: d.id, x: d.x, z: d.z, label: 'VAULT DOOR' };
      break;
    }
    case 'grab': {
      const it = L.loot[pi];
      out.runner = 'The vault is open. Grab the ' + tname + ' (hold E).';
      out.hacker = 'Vault open. Watch for guards coming back while the runner grabs the ' + tname + '.';
      out.target = it ? { kind: 'loot', id: pi, x: it.x, z: it.z, label: 'TARGET' } : null;
      break;
    }
    case 'escape': {
      out.runner = 'Carry the ' + tname + ' back to the van and hold E to stash it.';
      out.hacker = 'Guide the runner back to the van on the quietest route. Doors and loops help.';
      out.target = { kind: 'van', x: L.van.x, z: L.van.z, label: 'VAN' };
      break;
    }
    default:
  }
  if (P && P.kind === 'keypad') {
    out.runner = 'Laser keypad: describe each symbol to the van and press the digit they read back. It shuts this laser off for good.';
    out.hacker = 'Laser keypad: find each symbol on the CIPHER CARD and read back its digit.';
  } else if (P && P.kind === 'fuse') {
    out.runner = 'Fuse box: pull the fuses in the order the van reads out, before the timer runs out.';
    out.hacker = 'Fuse box: read out the fuses in order (colour and number) from the COMMS card.';
  }
  if (st.police >= 0) {
    out.runner = 'POLICE ARE COMING. Get back to the van and drive away before the timer runs out.';
    out.hacker = 'Police are coming. Guide the runner straight back to the van.';
    out.alert = true;
  }
  return out;
}
