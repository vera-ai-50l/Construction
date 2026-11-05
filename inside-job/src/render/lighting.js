// "Clustered" fixture lighting: every room's ceiling lights are evaluated per
// pixel in the standard PBR shader, but each pixel only looks at the <=4 lights
// of the room it is in (looked up from a tiny cell texture). Rooms can be
// switched off by the hacker at no cost: only a 1-row texture changes.
import * as THREE from 'three';
import { T, WALL_H } from '../core/data.js';

const K_LUX = 26;      // fixture intensity scale
const RADIUS = 7.6;    // fixture cutoff distance (m)

function floatTex(w, h) {
  const t = new THREE.DataTexture(new Float32Array(w * h * 4), w, h, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

export function createLighting(L) {
  const W = L.W, H = L.H, NR = L.rooms.length;
  // ---- light list (render copy, plus a street lamp next to the van)
  const lights = [];
  const roomLights = L.rooms.map(() => []);
  for (const r of L.rooms) for (const p of r.lights) { roomLights[r.id].push(lights.length); lights.push({ x: p.x, y: p.h || WALL_H - 0.16, z: p.z, room: r.id }); }
  const lamp = { x: L.van.x + (L.doors[0].x > L.van.x ? -3.6 : 3.6), y: 4.6, z: L.van.z - 0.6, room: 0, street: true };
  roomLights[0].push(lights.length); lights.push(lamp);
  const lightTex = floatTex(lights.length, 1);
  lights.forEach((l, i) => lightTex.image.data.set([l.x, l.y, l.z, l.room], i * 4));
  // ---- per cell: room + 4 nearest lights of that room
  const cellTex = floatTex(W * 2, H);
  const cd = cellTex.image.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let room = L.cell[y * W + x]; if (room < 0) room = 0;
    const cx = (x + 0.5) * T, cz = (y + 0.5) * T;
    const ids = roomLights[room].slice().sort((a, b) => ((lights[a].x - cx) ** 2 + (lights[a].z - cz) ** 2) - ((lights[b].x - cx) ** 2 + (lights[b].z - cz) ** 2)).slice(0, 4);
    while (ids.length < 4) ids.push(-1);
    const o = (y * W * 2 + x * 2) * 4;
    cd[o] = room; cd[o + 1] = 0; cd[o + 2] = ids[0]; cd[o + 3] = ids[1];
    cd[o + 4] = ids[2]; cd[o + 5] = ids[3]; cd[o + 6] = 0; cd[o + 7] = 0;
  }
  // ---- per room: colour * intensity, level
  const roomTex = floatTex(NR, 1);
  const base = L.rooms.map((r) => {
    const c = new THREE.Color(r.color); const k = (r.lux || 0.7) * K_LUX * (r.corr ? 0.9 : 1) * (r.id === 0 ? 0.75 : 1);
    return [c.r * k, c.g * k, c.b * k];
  });
  const level = new Float32Array(NR);
  const writeRoom = (i) => { const b = base[i]; roomTex.image.data.set([b[0], b[1], b[2], level[i]], i * 4); };
  for (let i = 0; i < NR; i++) writeRoom(i);
  const uniforms = {
    ijCell: { value: cellTex }, ijLight: { value: lightTex }, ijRoom: { value: roomTex },
    ijGrid: { value: new THREE.Vector2(W, H) }, ijT: { value: T }, ijRad: { value: RADIUS },
    ijAmb: { value: new THREE.Color(0.030, 0.038, 0.060) }, ijEnv: { value: 1 },
  };
  return {
    uniforms, lights, roomLights, lamp, level,
    setLevel(i, v) { if (Math.abs(level[i] - v) < 1e-3) return false; level[i] = v; writeRoom(i); roomTex.needsUpdate = true; return true; },
    roomColor(i) { return base[i]; },
    // approximate light at a world point (for sprites / dynamic tinting / audio-free logic)
    sample(x, z) {
      const cx = Math.floor(x / T), cy = Math.floor(z / T);
      let room = cx >= 0 && cy >= 0 && cx < W && cy < H ? L.cell[cy * W + cx] : 0; if (room < 0) room = 0;
      let s = 0; for (const id of roomLights[room]) { const l = lights[id]; const d2 = (l.x - x) ** 2 + (l.z - z) ** 2 + 4; s += 1 / d2; }
      return Math.min(1.5, s * 9 * level[room] * (L.rooms[room].lux || 0.7));
    },
  };
}

const VERT_HEAD = 'varying vec3 vIJW;\n';
const VERT_BODY = `
{ vec4 ijw = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  ijw = instanceMatrix * ijw;
#endif
  ijw = modelMatrix * ijw; vIJW = ijw.xyz; }
`;
const FRAG_HEAD = `
varying vec3 vIJW;
uniform sampler2D ijCell; uniform sampler2D ijLight; uniform sampler2D ijRoom;
uniform vec2 ijGrid; uniform float ijT; uniform float ijRad; uniform vec3 ijAmb; uniform float ijEnv;
`;
const FRAG_BODY = `
{
  vec3 ijN = inverseTransformDirection( geometryNormal, viewMatrix );
  vec3 ijP = vIJW + ijN * 0.12;
  ivec2 ijC = clamp( ivec2( floor( ijP.x / ijT ), floor( ijP.z / ijT ) ), ivec2( 0 ), ivec2( ijGrid ) - 1 );
  vec4 ijC0 = texelFetch( ijCell, ivec2( ijC.x * 2, ijC.y ), 0 );
  vec4 ijC1 = texelFetch( ijCell, ivec2( ijC.x * 2 + 1, ijC.y ), 0 );
  vec4 ijR = texelFetch( ijRoom, ivec2( int( ijC0.x + 0.5 ), 0 ), 0 );
  float ijLvl = ijR.a;
  vec3 ijCol = ijR.rgb * ijLvl;
  if ( ijLvl > 0.002 ) {
    float ijIds[4] = float[4]( ijC0.z, ijC0.w, ijC1.x, ijC1.y );
    for ( int i = 0; i < 4; i ++ ) {
      if ( ijIds[i] < 0.0 ) continue;
      vec4 ijL = texelFetch( ijLight, ivec2( int( ijIds[i] + 0.5 ), 0 ), 0 );
      vec3 ijV = ( viewMatrix * vec4( ijL.xyz, 1.0 ) ).xyz - geometryPosition;
      float ijD = length( ijV );
      directLight.direction = ijV / max( ijD, 1e-3 );
      // fixtures are downlights: little direct light reaches the ceiling and the top of the walls
      float ijDown = clamp( ( ijL.y - vIJW.y ) / max( distance( ijL.xyz, vIJW ), 1e-3 ), 0.0, 1.0 );
      directLight.color = ijCol * getDistanceAttenuation( ijD, ijRad, 2.0 ) * ( 0.1 + 0.9 * smoothstep( 0.0, 0.55, ijDown ) );
      directLight.visible = true;
      RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
    }
  }
  float ijAo = 0.55 + 0.45 * smoothstep( 0.0, 1.6, vIJW.y );
  // ambient + light bounced off the lit floor (strongest on downward-facing surfaces)
  irradiance += ( ijAmb * ijAo + ijCol * ( 0.004 + 0.012 * max( 0.0, -ijN.y ) ) ) * PI;
  float ijE = ijEnv * ( 0.06 + 0.55 * ijLvl );
  radiance *= ijE; iblIrradiance *= ijE * 0.6;
}
`;

// Patch a MeshStandard/MeshPhysical material so it receives fixture lighting.
const patched = new WeakSet();
export function patchMaterial(m, lighting) {
  if (!m || patched.has(m) || !(m.isMeshStandardMaterial)) return m;
  patched.add(m);
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, lighting.uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_HEAD)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + VERT_BODY);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('#include <lights_fragment_end>', FRAG_BODY + '\n#include <lights_fragment_end>');
  };
  m.customProgramCacheKey = () => 'ij2';
  return m;
}

export function patchObject(o, lighting, opts = {}) {
  o.traverse((c) => {
    if (!c.isMesh) return;
    if (Array.isArray(c.material)) c.material = c.material.map((m) => patchMaterial(opts.clone ? m.clone() : m, lighting));
    else c.material = patchMaterial(opts.clone ? c.material.clone() : c.material, lighting);
  });
  return o;
}
