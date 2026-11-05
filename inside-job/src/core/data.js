// Static game data: dimensions, themes, loot, furniture, upgrades, twists.
export const T = 1.6;        // cell size (m)
export const WALL_H = 3.2;   // wall height (m)
export const EYE = 1.62, EYE_CROUCH = 1.02;

// Ten glyphs used on keypads. The hacker's cipher card maps them to digits each job.
export const GLYPHS = ['anchor', 'crescent', 'eye', 'trident', 'key', 'spiral', 'crown', 'hourglass', 'flame', 'star'];

export const FUSE_COLORS = [
  { id: 'red', css: '#e5484d' }, { id: 'blue', css: '#3e8ef7' }, { id: 'green', css: '#30c46c' },
  { id: 'yellow', css: '#f5c518' }, { id: 'white', css: '#e8e8e8' }, { id: 'orange', css: '#f0802a' },
];

// Loot. value in $, weight in bag units, t = seconds to grab.
export const LOOT = {
  cash:     { name: 'Cash Bundle',        value: 2500,  weight: 1, t: 0.6, model: null },
  gold:     { name: 'Gold Bar',           value: 9000,  weight: 3, t: 0.9, model: null },
  watch:    { name: 'Chronograph',        value: 14000, weight: 1, t: 0.8, model: 'watch', size: 0.32 },
  amber:    { name: 'Mosquito in Amber',  value: 26000, weight: 1, t: 1.0, model: 'amber', size: 0.22 },
  skull:    { name: 'Jade Skull',         value: 21000, weight: 2, t: 1.2, model: 'skull', size: 0.3 },
  camera:   { name: 'Antique Camera',     value: 11000, weight: 2, t: 1.0, model: 'camera_antique', size: 0.36 },
  vase:     { name: 'Murano Vase',        value: 16000, weight: 2, t: 1.2, model: 'vase', size: 0.5 },
  corset:   { name: 'Couture Corset',     value: 12000, weight: 2, t: 1.2, model: 'corset', size: 0.55 },
  dragon:   { name: 'Glass Dragon',       value: 32000, weight: 2, t: 1.4, model: 'dragon', size: 0.42 },
  censer:   { name: 'Bronze Censer',      value: 9000,  weight: 2, t: 1.0, model: 'pot', size: 0.36 },
  lantern:  { name: 'Ming Lantern',       value: 8000,  weight: 2, t: 1.0, model: 'lantern', size: 0.4 },
  painting: { name: 'Caravaggio Study',   value: 45000, weight: 3, t: 2.4, model: null, wall: true },
  drive:    { name: 'Encrypted Drive',    value: 7000,  weight: 1, t: 0.7, model: null },
  proto:    { name: 'Prototype Chip',     value: 19000, weight: 1, t: 1.0, model: null },
  bonds:    { name: 'Bearer Bonds',       value: 6000,  weight: 1, t: 0.7, model: null },
};

// Furniture footprints (m), class: low blocks only crouched targets, tall blocks all LOS.
export const FURN = {
  sofa_v:   { model: 'sofa_velvet', w: 2.15, d: 0.95, h: 0.8, cls: 'low', cw: 2, ch: 1 },
  sofa_l:   { model: 'sofa_leather', w: 2.5, d: 0.95, h: 0.85, cls: 'low', cw: 2, ch: 1 },
  chair_d:  { model: 'chair_damask', w: 0.8, d: 0.7, h: 0.75, cls: 'low', cw: 1, ch: 1 },
  chair_s:  { model: 'chair_sheen', w: 0.75, d: 0.75, h: 0.8, cls: 'low', cw: 1, ch: 1 },
  pouf:     { model: 'pouf', w: 0.75, d: 0.75, h: 0.45, cls: 'none', cw: 1, ch: 1 },
  plant:    { model: 'plant', w: 0.7, d: 0.7, h: 1.4, cls: 'low', cw: 1, ch: 1, scale: 1.65 },
  desk:     { proc: 'desk', w: 1.5, d: 0.75, h: 0.76, cls: 'low', cw: 1, ch: 1, loot: true },
  table:    { proc: 'table', w: 1.4, d: 1.0, h: 0.78, cls: 'low', cw: 1, ch: 1, loot: true },
  shelf:    { proc: 'shelf', w: 1.5, d: 0.5, h: 2.2, cls: 'tall', cw: 1, ch: 1, loot: true },
  cabinet:  { proc: 'cabinet', w: 0.9, d: 0.6, h: 1.35, cls: 'low', cw: 1, ch: 1 },
  rack:     { proc: 'rack', w: 0.75, d: 1.1, h: 2.1, cls: 'tall', cw: 1, ch: 1 },
  counter:  { proc: 'counter', w: 3.0, d: 0.8, h: 1.1, cls: 'low', cw: 2, ch: 1, loot: true },
  pedestal: { proc: 'pedestal', w: 0.6, d: 0.6, h: 1.05, cls: 'low', cw: 1, ch: 1, loot: true, glass: true },
  case:     { proc: 'case', w: 1.2, d: 0.7, h: 1.0, cls: 'low', cw: 1, ch: 1, loot: true, glass: true },
  crate:    { proc: 'crate', w: 1.1, d: 1.1, h: 1.1, cls: 'low', cw: 1, ch: 1 },
  crates:   { proc: 'crates', w: 1.3, d: 1.2, h: 2.0, cls: 'tall', cw: 1, ch: 1 },
  monitors: { proc: 'monitors', w: 1.6, d: 0.8, h: 0.8, cls: 'low', cw: 1, ch: 1 },
  pallet:   { proc: 'pallet', w: 1.2, d: 1.0, h: 0.55, cls: 'low', cw: 1, ch: 1, loot: true },
  lockers:  { proc: 'lockers', w: 1.5, d: 0.5, h: 2.0, cls: 'tall', cw: 1, ch: 1 },
  cone:     { model: 'cone', w: 0.4, d: 0.4, h: 0.7, cls: 'none', cw: 1, ch: 1, scale: 1 },
  bench:    { proc: 'bench', w: 1.6, d: 0.5, h: 0.45, cls: 'none', cw: 1, ch: 1 },
  van:      { proc: 'van', w: 5.5, d: 2.24, h: 2.5, cls: 'tall', cw: 0, ch: 0 },
};

// Room recipes: floor material, light colour, furniture list (weighted), loot pool.
export const ROOMS = {
  corridor:    { floor: 'tile',    light: 0xdfe6f0, lux: 0.55 },
  lobby:       { floor: 'marble',  light: 0xffe1b8, lux: 1.0, furn: ['sofa_v', 'sofa_l', 'plant', 'plant', 'pouf', 'chair_d'], label: 'LOBBY' },
  teller:      { floor: 'marble',  light: 0xffe7c4, lux: 0.9, furn: ['counter', 'counter', 'plant', 'chair_s'], loot: ['cash', 'cash', 'bonds'], label: 'TELLERS' },
  office:      { floor: 'carpet',  light: 0xffd9a8, lux: 0.8, furn: ['desk', 'desk', 'chair_s', 'cabinet', 'plant', 'shelf'], loot: ['cash', 'watch', 'drive', 'bonds'], label: 'OFFICE' },
  exec:        { floor: 'wood',    light: 0xffcf96, lux: 0.85, furn: ['desk', 'sofa_l', 'chair_d', 'plant', 'shelf', 'pouf'], loot: ['watch', 'amber', 'cash', 'bonds', 'camera'], label: 'EXECUTIVE' },
  records:     { floor: 'carpet',  light: 0xeaf0ff, lux: 0.7, furn: ['shelf', 'shelf', 'cabinet', 'cabinet', 'table'], loot: ['bonds', 'drive'], label: 'RECORDS' },
  security:    { floor: 'tile',    light: 0xcfe0ff, lux: 0.75, furn: ['monitors', 'lockers', 'chair_s', 'cabinet'], loot: ['cash'], label: 'SECURITY' },
  lounge:      { floor: 'wood',    light: 0xffd2a0, lux: 0.8, furn: ['sofa_v', 'sofa_l', 'pouf', 'pouf', 'plant', 'chair_d', 'table'], loot: ['watch', 'cash'], label: 'LOUNGE' },
  gallery:     { floor: 'wood',    light: 0xfff0dc, lux: 1.05, furn: ['pedestal', 'pedestal', 'case', 'bench', 'pedestal', 'plant'], loot: ['amber', 'skull', 'vase', 'censer', 'lantern', 'camera', 'corset', 'dragon'], label: 'GALLERY', paintings: true },
  hall:        { floor: 'marble',  light: 0xfff0dc, lux: 1.0, furn: ['pedestal', 'bench', 'plant', 'case'], loot: ['vase', 'censer', 'lantern', 'skull'], label: 'GRAND HALL', paintings: true },
  storage:     { floor: 'concrete', light: 0xe8eef8, lux: 0.6, furn: ['crates', 'crate', 'crate', 'shelf', 'cone', 'crates'], loot: ['lantern', 'censer', 'drive'], label: 'STORAGE' },
  restoration: { floor: 'concrete', light: 0xf4f6ff, lux: 0.9, furn: ['table', 'table', 'shelf', 'chair_s', 'case'], loot: ['corset', 'camera', 'vase'], label: 'RESTORATION' },
  openoffice:  { floor: 'carpet',  light: 0xeef3ff, lux: 0.9, furn: ['desk', 'desk', 'desk', 'chair_s', 'chair_s', 'plant', 'cabinet'], loot: ['drive', 'cash', 'watch'], label: 'OPEN OFFICE' },
  lab:         { floor: 'tile',    light: 0xe6f6ff, lux: 1.0, furn: ['table', 'table', 'case', 'shelf', 'rack'], loot: ['proto', 'drive', 'proto'], label: 'R&D LAB' },
  server:      { floor: 'tile',    light: 0x9fc8ff, lux: 0.55, furn: ['rack', 'rack', 'rack', 'rack', 'cabinet'], loot: ['drive', 'drive', 'proto'], label: 'SERVERS' },
  vault:       { floor: 'steel',   light: 0xfff2d6, lux: 1.0, furn: ['pallet', 'pallet', 'shelf', 'pallet', 'case'], loot: ['gold', 'gold', 'cash', 'gold', 'bonds'], label: 'VAULT' },
};

export const THEMES = {
  bank: {
    name: 'Bank', names: ['First Meridian Trust', 'Halvorsen & Pike Savings', 'Crown Harbour Bank', 'Aurelius Private Bank', 'Northgate Federal', 'Sterling & Vane'],
    entry: 'lobby', big: ['lobby', 'teller'], mid: ['office', 'exec', 'records', 'lounge', 'office'], small: ['records', 'office', 'storage'],
    wall: 0xd9cdb8, trim: 0x3a2c22, target: ['gold', 'bonds', 'watch'], vaultLabel: 'VAULT',
  },
  museum: {
    name: 'Museum', names: ['Ashgrove Museum', 'The Delacroix Collection', 'Marlowe Institute of Art', 'Halcyon Antiquities', 'Museum of the Old Coast'],
    entry: 'hall', big: ['gallery', 'hall'], mid: ['gallery', 'restoration', 'office', 'gallery'], small: ['storage', 'office', 'restoration'],
    wall: 0xe4ddd0, trim: 0x2b2b30, target: ['amber', 'dragon', 'painting', 'skull'], vaultLabel: 'ARCHIVE VAULT',
  },
  tech: {
    name: 'Tech HQ', names: ['Nimbus Dynamics', 'Arclight Systems', 'Kestrel Labs', 'Parallax Robotics', 'Helio Quantum'],
    entry: 'lounge', big: ['openoffice', 'lab'], mid: ['office', 'lab', 'server', 'lounge', 'exec'], small: ['server', 'storage', 'office'],
    wall: 0xd7dde3, trim: 0x22262c, target: ['proto', 'drive', 'watch'], vaultLabel: 'DATA VAULT',
  },
};

export const TWISTS = {
  none:      { name: 'Standard', desc: 'A regular night shift.', pay: 1 },
  blackout:  { name: 'Blackout', desc: 'Most lights are off. Guards carry flashlights.', pay: 1.1 },
  double:    { name: 'Double Shift', desc: 'Two extra guards on patrol.', pay: 1.3 },
  hardwired: { name: 'Hardwired', desc: 'Laser grids cannot be hacked. More keypads.', pay: 1.2 },
  silent:    { name: 'Silent Alarm', desc: 'Opening the vault calls the police.', pay: 1.25 },
  tight:     { name: 'Tight Bag', desc: 'Bag holds less, but every item is worth 30% more.', pay: 1.0 },
  eyes:      { name: 'All Eyes', desc: 'Extra cameras with longer range.', pay: 1.25 },
  jammer:    { name: 'Jammer', desc: 'The van gets less bandwidth.', pay: 1.2 },
};

// Shared crew upgrades. cost(level) for buying level+1.
export const UPGRADES = [
  { id: 'shoes', who: 'Runner', name: 'Soft Soles', desc: 'Quieter footsteps.', max: 3, base: 6000 },
  { id: 'bag', who: 'Runner', name: 'Duffel+', desc: '+2 bag capacity per level.', max: 3, base: 8000 },
  { id: 'hands', who: 'Runner', name: 'Quick Hands', desc: 'Grab loot and pick locks 20% faster.', max: 3, base: 7000 },
  { id: 'emp', who: 'Runner', name: 'EMP Charge', desc: '+1 EMP per job. Kills nearby cameras, lasers and lights for 8 s.', max: 2, base: 9000 },
  { id: 'smoke', who: 'Runner', name: 'Smoke Bomb', desc: '+1 smoke per job. Blocks sight for 10 s.', max: 2, base: 6000 },
  { id: 'noise', who: 'Runner', name: 'Noisemaker', desc: '+1 noisemaker per job. Lures guards.', max: 2, base: 4000 },
  { id: 'bw', who: 'Hacker', name: 'Fat Pipe', desc: '+2 max bandwidth per level.', max: 3, base: 8000 },
  { id: 'regen', who: 'Hacker', name: 'Overclock', desc: 'Bandwidth regenerates 25% faster per level.', max: 3, base: 8000 },
  { id: 'loop', who: 'Hacker', name: 'Loop Mastery', desc: 'Camera loops last 4 s longer per level.', max: 2, base: 7000 },
  { id: 'ghost', who: 'Hacker', name: 'Ghost Protocol', desc: 'Cameras take 20% longer to spot the runner.', max: 2, base: 10000 },
  { id: 'driver', who: 'Crew', name: 'Getaway Driver', desc: '+15 s before the police arrive.', max: 2, base: 9000 },
  { id: 'lawyer', who: 'Crew', name: 'Good Lawyer', desc: 'Getting busted costs less and keeps half your streak.', max: 2, base: 12000 },
];
// Prices are set so a crew that wins most jobs maxes everything around job 10
// to 12 (tier 6), not after the first few jobs: payouts grow fast with tier.
export const UPGRADE_PRICE = 6;
export const upgradeCost = (u, lvl) => Math.round(u.base * UPGRADE_PRICE * Math.pow(2, lvl) / 1000) * 1000;

// Hacker action costs (bandwidth).
export const COST = { door: 1, laser: 2, light: 2, lure: 2, loop: 3, ping: 3 };
export const DUR = { laser: 8, light: 15, loop: 10, ping: 3 };
// The vault timelock takes 8 s of both players holding and uses this much
// bandwidth in all. Keep it below the smallest bandwidth cap (Jammer: 7).
export const TIMELOCK_BW = 6;

export const RATINGS = {
  ghost: { name: 'GHOST', desc: 'Never spotted', bonus: 0.25 },
  clean: { name: 'CLEAN', desc: 'No alarms, no takedowns', bonus: 0.15 },
  fast:  { name: 'FAST', desc: 'Beat the par time', bonus: 0.1 },
  full:  { name: 'FULL HAUL', desc: 'Took every item', bonus: 0.2 },
};

export const NOTORIETY = ['Nobody', 'Small Timer', 'Prowler', 'Second-Story', 'Box Man', 'Ghost Crew', 'Phantom', 'Legend', 'Myth', 'Untouchable'];
