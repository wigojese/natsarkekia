/* =====================================================================
   TERRAIN — deterministic seeded heightmap with hand-placed constraints,
   rivers, road, ground/water/slope queries and circle colliders.
   +x = east, +z = south, origin = map centre.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const { clamp, lerp, smoothstep, polyLengths, smoothPolyline } = N;
const SITES = N.data.SITES;

const SEED = 20240611;
const noise = N.makeNoise(SEED);
const HALF = 450;              // terrain spans [-450, 450]
const SEGS = 300;              // grid cells per side (3 u)
const CELL = (HALF * 2) / SEGS;
const PLAY = 384;              // playable superellipse radius
const MAX_SLOPE = Math.tan(40 * Math.PI / 180);

/* ---------- road through the ten sites (winding, never straight) ---------- */
const S = (i) => SITES[i].pos;
const ROAD_CTRL = [
  [334, 124], S(1), [298, 110], S(2), [252, 88], [222, 56], S(3), [162, 60], [136, 88], S(4),
  [86, 62], [58, 30], S(5), [6, -22], [-22, -56], S(6), [-70, -74], [-96, -52], [-112, -44], S(7),
  [-156, -64], [-186, -82], S(8), [-236, -146], [-262, -164], S(9), [-294, -226], [-314, -262], S(10)
];
const ROAD = smoothPolyline(ROAD_CTRL, 2);
/* side paths to the exploration spots (purely decorative) */
const PATHS = [
  smoothPolyline([[136, 88], [150, 20], [140, -60], [128, -142]], 2),     // to the ruined chapel ridge
  smoothPolyline([[-70, -74], [-110, -130], [-138, -200]], 2)              // up to the mountain lake
];

/* ---------- rivers (flow direction = point order) ---------- */
const R1 = smoothPolyline([[-25, -400], [-48, -260], [-30, -150], [-28, -60], [-20, 10], [-6, 80], [22, 180], [6, 280], [20, 420]], 3);
const R2 = smoothPolyline([[-150, -222], [-142, -160], [-120, -96], [-112, -46], [-100, 0], [-66, 22], [-21, 12]], 3);
const LAKE = { x: -150, z: -240, r: 22 };
const FORDS = [ { x: -30, z: -62, r: 18 }, { x: -4, z: 92, r: 11 }, { x: -136, z: -150, r: 9 } ];
const BRIDGE = { x: -112, z: -45, len: 20, width: 4.2 };   // stone bridge over R2 at site 7

/* ---------- fast nearest-segment index for polylines ---------- */
function PolyIndex(pts, cell){
  this.pts = pts; this.lens = polyLengths(pts); this.cum = [0];
  for(const L of this.lens) this.cum.push(this.cum[this.cum.length - 1] + L);
  this.cell = cell; this.map = new Map();
  for(let i = 0; i < pts.length - 1; i++){
    const x0 = Math.min(pts[i][0], pts[i + 1][0]), x1 = Math.max(pts[i][0], pts[i + 1][0]);
    const z0 = Math.min(pts[i][1], pts[i + 1][1]), z1 = Math.max(pts[i][1], pts[i + 1][1]);
    for(let cx = Math.floor(x0 / cell); cx <= Math.floor(x1 / cell); cx++)
      for(let cz = Math.floor(z0 / cell); cz <= Math.floor(z1 / cell); cz++){
        const k = cx * 10007 + cz; if(!this.map.has(k)) this.map.set(k, []); this.map.get(k).push(i);
      }
  }
}
PolyIndex.prototype.nearest = function(x, z, maxR){
  const c = this.cell, r = Math.ceil(maxR / c), cx0 = Math.floor(x / c), cz0 = Math.floor(z / c);
  let best = maxR, res = null; const seen = new Set();
  for(let cx = cx0 - r; cx <= cx0 + r; cx++) for(let cz = cz0 - r; cz <= cz0 + r; cz++){
    const list = this.map.get(cx * 10007 + cz); if(!list) continue;
    for(const i of list){
      if(seen.has(i)) continue; seen.add(i);
      const a = this.pts[i], b = this.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
      let u = L2 > 0 ? ((x - a[0]) * dx + (z - a[1]) * dz) / L2 : 0; u = clamp(u, 0, 1);
      const px = a[0] + dx * u, pz = a[1] + dz * u, d = Math.hypot(x - px, z - pz);
      if(d < best){ best = d; res = { d, x: px, z: pz, seg: i, u, t: this.cum[i] + u * this.lens[i] }; }
    }
  }
  return res;
};
const roadIdx = new PolyIndex(ROAD, 12);
const pathIdx = PATHS.map(p => new PolyIndex(p, 12));
const r1Idx = new PolyIndex(R1, 12), r2Idx = new PolyIndex(R2, 12);

/* ---------- height construction ---------- */
function superR(x, z){ return Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25); }
function bump(x, z, cx, cz, h, r0, r1){ const d = Math.hypot(x - cx, z - cz); return d >= r1 ? 0 : h * (1 - smoothstep(r0, r1, d)); }
function ridge(x, z, ax, az, bx, bz, h, w){
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const u = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
  const d = Math.hypot(x - (ax + dx * u), z - (az + dz * u));
  return h * (1 - smoothstep(w * 0.25, w, d)) * (0.75 + 0.25 * Math.sin(u * Math.PI));
}

const VILLAGE = { x: 318, z: 120, r: 50 };
function segDist(x, z, ax, az, bx, bz){
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const u = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
  return Math.hypot(x - (ax + dx * u), z - (az + dz * u));
}
/* Devi's cave: an alcove cut into the black cliffs, straight ahead of site 10 along the road */
const CAVE = (() => {
  const s = SITES[10].pos, ring = [-352, -312];
  let bx = ring[0] - s[0], bz = ring[1] - s[1]; const L = Math.hypot(bx, bz); bx /= L; bz /= L;
  const at = (k) => [s[0] + bx * k, s[1] + bz * k];
  const c = at(11), a = at(3), b = at(17), back = at(21.2);
  return { bx, bz, x: c[0], z: c[1], x0: a[0], z0: a[1], x1: b[0], z1: b[1], backX: back[0], backZ: back[1] };
})();
function base(x, z){
  let h = 3 + noise.fbm(x * 0.0055 + 11.3, z * 0.0055 - 7.1, 4) * 9 + noise.fbm(x * 0.03 + 3, z * 0.03 + 9, 2) * 1.1;
  h += smoothstep(90, -330, x) * 24;                                   // foothills rise to the west
  h += smoothstep(-60, -330, z) * smoothstep(140, -160, x) * 8;        // and to the north-west
  h += smoothstep(-120, 300, z) * smoothstep(-200, 200, x) * -2;
  const e = superR(x, z);
  const ring = smoothstep(368, 452, e);
  if(ring > 0){
    const west = smoothstep(80, -420, x);
    const pk = 46 + noise.fbm(x * 0.011 + 40, z * 0.011 - 40, 5) * 44 + west * 70 + Math.abs(noise.n2(x * 0.02, z * 0.02)) * 18;
    h += ring * pk;
  }
  /* landmarks shaped into the ground */
  h += bump(x, z, 190, 40, 18, 9, 62);                                 // site 3 lookout hill
  h += ridge(x, z, 40, -58, 84, -82, 13, 26);                          // ridge where Devi watches over site 5
  h += ridge(x, z, 70, 20, 120, 8, 11, 24);                            // ridge north of the test meadow (u4)
  h += bump(x, z, -286, -196, 3, 6, 28);                               // site 9 rock terrace
  h += ridge(x, z, 110, -120, 160, -170, 22, 34);                      // chapel ridge (exploration)
  h += bump(x, z, -150, -282, 30, 14, 34);                             // waterfall cliff above the lake
  /* black cliffs around Devi's cave, with an alcove cut in for the cave mouth */
  const dc = Math.hypot(x + 352, z + 312);
  if(dc < 30){
    const cl = 46 * (1 - smoothstep(19.5, 26, dc)) + (dc < 26 ? noise.n2(x * 0.15, z * 0.15) * 3 * (1 - smoothstep(19, 26, dc)) : 0);
    h += cl * smoothstep(4.6, 8.0, segDist(x, z, CAVE.x0, CAVE.z0, CAVE.x1, CAVE.z1));
  }
  return h;
}

const VILLAGE_H = 6.2;
function villageShape(x, z, h){
  const d = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  const m = 1 - smoothstep(VILLAGE.r - 14, VILLAGE.r + 8, d);
  if(m <= 0) return h;
  const terr = VILLAGE_H + smoothstep(326, 330, x) * 1.6 + smoothstep(338, 341, x) * 1.6 + smoothstep(98, 94, z) * 0.0;
  return lerp(h, terr, m);
}

const SITE_FLAT = { 1: [22, 30], 2: [14, 24], 3: [10, 18], 4: [16, 28], 5: [12, 22], 6: [12, 20], 7: [12, 20], 8: [13, 22], 9: [10, 28], 10: [6, 11] };
const siteH = {};
function shapedNoSites(x, z){ return villageShape(x, z, base(x, z)); }
for(let i = 1; i <= 10; i++){ const p = SITES[i].pos; siteH[i] = shapedNoSites(p[0], p[1]); }
function shaped(x, z){
  let h = shapedNoSites(x, z);
  const ca = segDist(x, z, CAVE.x0, CAVE.z0, CAVE.x1, CAVE.z1);
  if(ca < 7.5) h = lerp(h, siteH[10] + 0.1, 1 - smoothstep(4.0, 7.2, ca));
  for(let i = 1; i <= 10; i++){
    const p = SITES[i].pos, f = SITE_FLAT[i], d = Math.hypot(x - p[0], z - p[1]);
    if(d < f[1]) h = lerp(h, siteH[i], 1 - smoothstep(f[0], f[1], d));
  }
  return h;
}
function roadShaped(x, z){
  let h = shaped(x, z);
  const r = roadIdx.nearest(x, z, 6);
  if(r){ const hc = shaped(r.x, r.z); h = lerp(h, hc - 0.1, 1 - smoothstep(2.4, 6, r.d)); }
  for(const pi of pathIdx){
    const p = pi.nearest(x, z, 4);
    if(p){ const hc = shaped(p.x, p.z); h = lerp(h, hc - 0.05, 1 - smoothstep(1.4, 4, p.d)); }
  }
  return h;
}

/* water surface along each river: below the banks, monotonic downstream */
function riverLevels(pts){
  const wl = new Float32Array(pts.length); let prev = 1e9;
  for(let i = 0; i < pts.length; i++){
    let w = roadShaped(pts[i][0], pts[i][1]) - 1.3;
    for(let k = -2; k <= 2; k++){ const j = clamp(i + k, 0, pts.length - 1); w = Math.min(w, roadShaped(pts[j][0], pts[j][1]) - 1.3); }
    w = Math.min(w, prev - 0.01); wl[i] = w; prev = w;
  }
  return wl;
}
const LAKE_LEVEL = shaped(LAKE.x, LAKE.z + 18) - 1.6;
const R1WL = riverLevels(R1);
const R2WL = (() => { const w = riverLevels(R2); const d = w[0] - (LAKE_LEVEL - 0.15); if(d > 0) for(let i = 0; i < w.length; i++) w[i] -= d * Math.max(0, 1 - i / 12); return w; })();
function fordFactor(x, z){ let f = 0; for(const fd of FORDS) f = Math.max(f, 1 - smoothstep(fd.r * 0.5, fd.r, Math.hypot(x - fd.x, z - fd.z))); return f; }

/* returns { h, wl } — final ground height and water surface (or -1e9) */
function evalPoint(x, z){
  let h = roadShaped(x, z), wl = -1e9;
  const rivers = [[r1Idx, R1WL, 7.5], [r2Idx, R2WL, 5.2]];
  for(const [idx, levels, hw] of rivers){
    const r = idx.nearest(x, z, hw + 9);
    if(!r) continue;
    const w = lerp(levels[r.seg], levels[r.seg + 1], r.u);
    const ford = fordFactor(x, z);
    const depth = lerp(2.4, 0.42, ford);
    if(r.d < hw){ h = Math.min(h, w - depth * (1 - Math.pow(r.d / hw, 2)) - 0.05); }
    else { h = Math.min(h, lerp(w + 0.25, h, smoothstep(hw, hw + 8, r.d))); }
    if(r.d < hw + 2.5) wl = Math.max(wl, w);
  }
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  if(dl < LAKE.r + 12){
    if(dl < LAKE.r) h = Math.min(h, LAKE_LEVEL - 3.2 * (1 - Math.pow(dl / LAKE.r, 2)) - 0.1);
    else h = Math.min(h, lerp(LAKE_LEVEL + 0.25, h, smoothstep(LAKE.r, LAKE.r + 12, dl)));
    if(dl < LAKE.r + 3) wl = Math.max(wl, LAKE_LEVEL);
  }
  return { h, wl };
}

/* ---------- build grid ---------- */
const V = SEGS + 1;
const H = new Float32Array(V * V);
const WL = new Float32Array(V * V);
const t0 = performance.now();
for(let j = 0; j < V; j++) for(let i = 0; i < V; i++){
  const x = -HALF + i * CELL, z = -HALF + j * CELL;
  const r = evalPoint(x, z);
  H[j * V + i] = r.h; WL[j * V + i] = r.wl;
}
N.terrainBuildMs = performance.now() - t0;

/* exact triangle interpolation (same triangulation as the mesh: (a,c,b),(b,c,d)) */
function ground(x, z){
  const fx = clamp((x + HALF) / CELL, 0, SEGS - 1e-4), fz = clamp((z + HALF) / CELL, 0, SEGS - 1e-4);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const a = H[j * V + i], b = H[j * V + i + 1], c = H[(j + 1) * V + i], d = H[(j + 1) * V + i + 1];
  if(u + v <= 1) return a + (b - a) * u + (c - a) * v;
  return d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
function waterLevel(x, z){
  const i = Math.round(clamp((x + HALF) / CELL, 0, SEGS)), j = Math.round(clamp((z + HALF) / CELL, 0, SEGS));
  return WL[j * V + i];
}
function waterDepth(x, z){ const w = waterLevel(x, z); return w < -1e8 ? 0 : Math.max(0, w - ground(x, z)); }
function gradient(x, z){ const e = 0.8; return [(ground(x + e, z) - ground(x - e, z)) / (2 * e), (ground(x, z + e) - ground(x, z - e)) / (2 * e)]; }
function slope(x, z){ const g = gradient(x, z); return Math.hypot(g[0], g[1]); }
function normal(x, z){ const g = gradient(x, z); const n = new THREE.Vector3(-g[0], 1, -g[1]); return n.normalize(); }

/* ---------- bridge deck ---------- */
const bridgeDir = (() => {
  const r = r2Idx.nearest(BRIDGE.x, BRIDGE.z, 20); const a = R2[r.seg], b = R2[r.seg + 1];
  const fx = b[0] - a[0], fz = b[1] - a[1], L = Math.hypot(fx, fz);
  BRIDGE.x = r.x; BRIDGE.z = r.z; BRIDGE.wl = lerp(R2WL[r.seg], R2WL[r.seg + 1], r.u);
  return { x: -fz / L, z: fx / L };      // across the flow
})();
BRIDGE.dir = bridgeDir;
BRIDGE.endH = [ground(BRIDGE.x + bridgeDir.x * BRIDGE.len / 2, BRIDGE.z + bridgeDir.z * BRIDGE.len / 2),
               ground(BRIDGE.x - bridgeDir.x * BRIDGE.len / 2, BRIDGE.z - bridgeDir.z * BRIDGE.len / 2)];
function bridgeLocal(x, z){
  const dx = x - BRIDGE.x, dz = z - BRIDGE.z;
  return { a: dx * bridgeDir.x + dz * bridgeDir.z, b: -dx * bridgeDir.z + dz * bridgeDir.x };
}
function deckHeight(a){
  const t = clamp(a / BRIDGE.len + 0.5, 0, 1);
  const ends = lerp(BRIDGE.endH[1], BRIDGE.endH[0], t);
  return Math.max(ends, BRIDGE.wl + 1.2) + Math.sin(t * Math.PI) * 1.4 + 0.25;
}
function onBridge(x, z){ const l = bridgeLocal(x, z); return Math.abs(l.a) < BRIDGE.len / 2 && Math.abs(l.b) < BRIDGE.width / 2; }

/* ground for walking: terrain or the bridge deck */
function walkHeight(x, z){
  const g = ground(x, z);
  if(onBridge(x, z)){ const l = bridgeLocal(x, z); return Math.max(g, deckHeight(l.a)); }
  return g;
}

/* ---------- colliders (circles; boxes are approximated by a few circles) ---------- */
const COLL_CELL = 8;
const colliders = new Map();
function addCollider(x, z, r, tag){
  const c = { x, z, r, tag: tag || "" };
  const x0 = Math.floor((x - r) / COLL_CELL), x1 = Math.floor((x + r) / COLL_CELL);
  const z0 = Math.floor((z - r) / COLL_CELL), z1 = Math.floor((z + r) / COLL_CELL);
  for(let cx = x0; cx <= x1; cx++) for(let cz = z0; cz <= z1; cz++){
    const k = cx * 10007 + cz; if(!colliders.has(k)) colliders.set(k, []); colliders.get(k).push(c);
  }
  return c;
}
function addBoxCollider(x, z, w, d, rot, tag){
  /* fill an oriented box with overlapping circles */
  const r = Math.min(w, d) / 2, along = w >= d, len = Math.max(w, d), n = Math.max(1, Math.ceil(len / (r * 1.2)));
  const ax = along ? Math.cos(rot) : -Math.sin(rot), az = along ? -Math.sin(rot) : -Math.cos(rot);
  for(let k = 0; k < n; k++){
    const o = n === 1 ? 0 : (k / (n - 1) - 0.5) * (len - r * 2);
    addCollider(x + ax * o, z + az * o, r * 1.05, tag);
  }
}
function nearbyColliders(x, z){
  const k = Math.floor(x / COLL_CELL) * 10007 + Math.floor(z / COLL_CELL);
  return colliders.get(k) || [];
}
function collidersAround(x, z, rad){
  const out = new Set();
  for(let cx = Math.floor((x - rad) / COLL_CELL); cx <= Math.floor((x + rad) / COLL_CELL); cx++)
    for(let cz = Math.floor((z - rad) / COLL_CELL); cz <= Math.floor((z + rad) / COLL_CELL); cz++){
      const l = colliders.get(cx * 10007 + cz); if(l) l.forEach(c => out.add(c));
    }
  return out;
}

/* is a position walkable? (ignores colliders) */
function walkable(x, z){
  if(superR(x, z) > PLAY) return false;
  if(onBridge(x, z)) return true;
  if(waterDepth(x, z) > 0.9) return false;
  return true;
}

/* ---------- movement resolution: slopes, water, bounds, colliders ---------- */
function moveCircle(px, pz, dx, dz, radius, ignoreColliders){
  let nx = px + dx, nz = pz + dz;
  const tryPos = (x, z) => {
    if(!walkable(x, z)) return false;
    if(!onBridge(x, z)){
      const g = gradient(x, z), s = Math.hypot(g[0], g[1]);
      if(s > MAX_SLOPE){
        const mv = (x - px) * g[0] + (z - pz) * g[1];
        if(mv > 0) return false;                     // only uphill is blocked
      }
    }
    return true;
  };
  if(!tryPos(nx, nz)){
    if(tryPos(px + dx, pz)){ nx = px + dx; nz = pz; }
    else if(tryPos(px, pz + dz)){ nx = px; nz = pz + dz; }
    else { nx = px; nz = pz; }
  }
  if(!ignoreColliders){
    for(let it = 0; it < 2; it++){
      for(const c of collidersAround(nx, nz, radius + 4)){
        const ddx = nx - c.x, ddz = nz - c.z, d = Math.hypot(ddx, ddz), min = c.r + radius;
        if(d < min && d > 1e-5){ const push = (min - d); const qx = nx + ddx / d * push, qz = nz + ddz / d * push; if(walkable(qx, qz)){ nx = qx; nz = qz; } }
      }
    }
  }
  return [nx, nz];
}

/* ---------- biome helpers (used by world dressing and footsteps) ---------- */
function roadDist(x, z){ const r = roadIdx.nearest(x, z, 30); return r ? r.d : 30; }
function riverDist(x, z){
  const a = r1Idx.nearest(x, z, 40), b = r2Idx.nearest(x, z, 40);
  let d = Math.min(a ? a.d : 40, b ? b.d : 40); d = Math.min(d, Math.max(0, Math.hypot(x - LAKE.x, z - LAKE.z) - LAKE.r)); return d;
}
function siteDist(x, z){ let d = 1e9; for(let i = 1; i <= 10; i++){ const p = SITES[i].pos; d = Math.min(d, Math.hypot(x - p[0], z - p[1])); } return d; }
function surfaceType(x, z){
  if(onBridge(x, z)) return "stone";
  if(waterDepth(x, z) > 0.05) return "water";
  if(roadDist(x, z) < 2.6 || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 30) return "stone";
  if(slope(x, z) > 0.6) return "stone";
  return "grass";
}
function roadPointAt(t){
  /* point at arc-length t along the road */
  let acc = 0;
  for(let i = 0; i < roadIdx.lens.length; i++){
    const L = roadIdx.lens[i];
    if(acc + L >= t){ const u = (t - acc) / L; return [lerp(ROAD[i][0], ROAD[i + 1][0], u), lerp(ROAD[i][1], ROAD[i + 1][1], u)]; }
    acc += L;
  }
  return ROAD[ROAD.length - 1].slice();
}
function roadT(x, z){ const r = roadIdx.nearest(x, z, 400); return r ? r.t : 0; }

N.terrain = {
  HALF, SEGS, CELL, V, H, WL, PLAY, MAX_SLOPE, noise, ROAD, PATHS, R1, R2, R1WL, R2WL, LAKE, LAKE_LEVEL, FORDS, BRIDGE, VILLAGE, VILLAGE_H,
  roadIdx, r1Idx, r2Idx, ground, walkHeight, waterLevel, waterDepth, gradient, slope, normal, onBridge, bridgeLocal, deckHeight,
  addCollider, addBoxCollider, nearbyColliders, collidersAround, walkable, moveCircle, superR,
  roadDist, riverDist, siteDist, surfaceType, roadPointAt, roadT, siteH, CAVE, segDist
};
})();
