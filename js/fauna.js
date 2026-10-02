/* =====================================================================
   FAUNA — clay-style animals living in the world: deer herds, rabbits,
   foxes, wild boars, bears, sheep, cows, horses, chickens, ducks,
   eagles and butterflies. Each species is one InstancedMesh; legs swing
   per animal in the vertex shader. Shy animals flee from Natsarkekia.
   (Instanced meshes move freely, so frustum culling is turned off —
   otherwise an animal far from the mesh origin would vanish.)
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const T = N.terrain, G = N.geom;
const { clamp, lerp, damp, dampAngle, smoothstep } = N;
const fauna = { species: [] };
const R = N.rng(777);

/* ---------- geometry with per-vertex leg data ---------- */
function withAttrs(geo, sign, hip){
  const n = geo.attributes.position.count;
  const ls = new Float32Array(n).fill(sign), hp = new Float32Array(n * 3);
  for(let i = 0; i < n; i++){ hp[i * 3] = hip[0]; hp[i * 3 + 1] = hip[1]; hp[i * 3 + 2] = hip[2]; }
  geo.setAttribute("legSign", new THREE.BufferAttribute(ls, 1)); geo.setAttribute("hip", new THREE.BufferAttribute(hp, 3));
  return geo;
}
function mergeWithAttrs(list){
  const base = G.mergeGeoms(list);
  let total = 0; list.forEach(g => total += g.attributes.position.count);
  const ls = new Float32Array(total), hp = new Float32Array(total * 3); let o = 0;
  for(const g of list){ ls.set(g.attributes.legSign.array, o); hp.set(g.attributes.hip.array, o * 3); o += g.attributes.position.count; }
  base.setAttribute("legSign", new THREE.BufferAttribute(ls, 1)); base.setAttribute("hip", new THREE.BufferAttribute(hp, 3));
  return base;
}
/* body: PartBuilder; legs: [x, z, hipY, len, thick, color, sign] */
function animalGeo(body, legs){
  const parts = [withAttrs(body.geometry(), 0, [0, 0, 0])];
  for(const [x, z, hy, len, th, color, sign] of legs){
    const P = new G.PartBuilder(); P.box(th, len, th, color, [x, hy - len / 2, z]);
    parts.push(withAttrs(P.geometry(), sign, [x, hy, z]));
  }
  return mergeWithAttrs(parts);
}
const lump = (r, d, s) => G.lumpy(new THREE.IcosahedronGeometry(r, d == null ? 1 : d), 0.08, s || 1);

const BUILD = {
  deer(){ const B = new G.PartBuilder(), c = "#9a6236";
    B.add(lump(0.5, 1, 301), c, [0, 1.05, 0], null, [0.62, 0.62, 1.15]);
    B.sphere(0.2, "#efe6d4", [0, 1.02, -0.55], [1, 1, 0.6], 0);
    B.cyl(0.12, 0.17, 0.7, 6, c, [0, 1.42, 0.52], [0.6, 0, 0]);
    B.add(lump(0.18, 1, 302), c, [0, 1.75, 0.78], null, [0.9, 0.9, 1.45]);
    B.sphere(0.06, "#2a1d14", [0, 1.7, 1.0], 1, 0);
    for(const s of [-1, 1]){ B.cone(0.07, 0.22, 5, c, [s * 0.14, 1.94, 0.66], [0, 0, s * 0.7]);
      B.cyl(0.02, 0.025, 0.45, 4, "#d8c8a0", [s * 0.1, 2.08, 0.66], [0, 0, s * 0.5]); B.cyl(0.018, 0.02, 0.22, 4, "#d8c8a0", [s * 0.2, 2.22, 0.74], [0.8, 0, s * 0.4]); }
    return animalGeo(B, [[0.2, 0.42, 0.95, 0.92, 0.09, "#6e4426", 1], [-0.2, 0.42, 0.95, 0.92, 0.09, "#6e4426", -1], [0.2, -0.42, 0.95, 0.92, 0.1, "#6e4426", -1], [-0.2, -0.42, 0.95, 0.92, 0.1, "#6e4426", 1]]); },
  rabbit(){ const B = new G.PartBuilder(), c = "#a08a72";
    B.add(lump(0.2, 1, 311), c, [0, 0.22, 0], null, [0.85, 0.85, 1.15]);
    B.sphere(0.12, c, [0, 0.36, 0.2], 1, 1); B.sphere(0.07, "#f4efe6", [0, 0.24, -0.24], 1, 0);
    for(const s of [-1, 1]) B.add(new THREE.CapsuleGeometry(0.035, 0.2, 2, 6), c, [s * 0.05, 0.56, 0.16], [0.2, 0, s * 0.15]);
    return animalGeo(B, []); },
  fox(){ const B = new G.PartBuilder(), c = "#c8642a";
    B.add(lump(0.3, 1, 321), c, [0, 0.52, 0], null, [0.6, 0.6, 1.35]);
    B.add(lump(0.17, 1, 322), c, [0, 0.72, 0.5], null, [1, 0.9, 1.1]); B.cone(0.08, 0.22, 6, "#efe6d4", [0, 0.68, 0.68], [Math.PI / 2, 0, 0]);
    for(const s of [-1, 1]) B.cone(0.06, 0.16, 4, "#3a2216", [s * 0.09, 0.9, 0.46]);
    B.add(new THREE.CapsuleGeometry(0.11, 0.42, 3, 6), c, [0, 0.52, -0.62], [-1.0, 0, 0]); B.sphere(0.09, "#f4efe6", [0, 0.4, -0.86], 1, 0);
    return animalGeo(B, [[0.1, 0.25, 0.42, 0.42, 0.06, "#2a1a12", 1], [-0.1, 0.25, 0.42, 0.42, 0.06, "#2a1a12", -1], [0.1, -0.25, 0.42, 0.42, 0.06, "#2a1a12", -1], [-0.1, -0.25, 0.42, 0.42, 0.06, "#2a1a12", 1]]); },
  boar(){ const B = new G.PartBuilder(), c = "#4a3628";
    B.add(lump(0.5, 1, 331), c, [0, 0.62, 0], null, [0.75, 0.75, 1.25]);
    B.add(lump(0.3, 1, 332), c, [0, 0.66, 0.6], null, [0.95, 0.9, 1.1]); B.cyl(0.12, 0.12, 0.18, 8, "#6a4a38", [0, 0.6, 0.9], [Math.PI / 2, 0, 0]);
    for(const s of [-1, 1]){ B.cone(0.03, 0.18, 4, "#efe6d4", [s * 0.11, 0.62, 0.86], [-0.6, 0, s * 0.3]); B.cone(0.07, 0.16, 4, c, [s * 0.15, 0.92, 0.52]); }
    B.box(0.1, 0.18, 0.7, "#2a2018", [0, 0.98, 0]);
    return animalGeo(B, [[0.18, 0.32, 0.45, 0.45, 0.11, "#2a2018", 1], [-0.18, 0.32, 0.45, 0.45, 0.11, "#2a2018", -1], [0.18, -0.32, 0.45, 0.45, 0.11, "#2a2018", -1], [-0.18, -0.32, 0.45, 0.45, 0.11, "#2a2018", 1]]); },
  bear(){ const B = new G.PartBuilder(), c = "#5a3e2a";
    B.add(lump(0.85, 1, 341), c, [0, 1.15, 0], null, [0.8, 0.75, 1.2]);
    B.add(lump(0.42, 1, 342), c, [0, 1.35, 0.95], null, [1, 0.95, 1]); B.sphere(0.17, "#7a5a40", [0, 1.25, 1.3], [1, 0.8, 1], 1); B.sphere(0.06, "#1a120c", [0, 1.3, 1.45], 1, 0);
    for(const s of [-1, 1]) B.sphere(0.12, c, [s * 0.28, 1.72, 0.9], 1, 0);
    return animalGeo(B, [[0.32, 0.55, 0.8, 0.8, 0.26, "#4a3220", 1], [-0.32, 0.55, 0.8, 0.8, 0.26, "#4a3220", -1], [0.32, -0.55, 0.8, 0.8, 0.28, "#4a3220", -1], [-0.32, -0.55, 0.8, 0.8, 0.28, "#4a3220", 1]]); },
  sheep(){ const B = new G.PartBuilder();
    B.add(lump(0.62, 1, 190), "#eee6d4", [0, 0.82, 0], null, [1.3 / 1.3, 0.95, 1.3]);
    B.box(0.3, 0.32, 0.42, "#2b2522", [0, 0.98, 0.86]); for(const s of [-1, 1]) B.box(0.16, 0.08, 0.1, "#2b2522", [s * 0.2, 1.06, 0.8]);
    return animalGeo(B, [[0.3, 0.4, 0.5, 0.5, 0.12, "#2b2522", 1], [-0.3, 0.4, 0.5, 0.5, 0.12, "#2b2522", -1], [0.3, -0.4, 0.5, 0.5, 0.12, "#2b2522", -1], [-0.3, -0.4, 0.5, 0.5, 0.12, "#2b2522", 1]]); },
  cow(){ const B = new G.PartBuilder(), c = "#8a5a3a";
    B.add(lump(0.7, 1, 351), c, [0, 1.2, 0], null, [0.75, 0.72, 1.35]);
    B.sphere(0.32, "#f0e8dc", [0.25, 1.35, -0.2], [0.6, 0.6, 1], 0);
    B.add(lump(0.3, 1, 352), c, [0, 1.35, 1.0], null, [0.9, 0.95, 1.2]); B.box(0.36, 0.22, 0.2, "#e8c8b0", [0, 1.22, 1.3]);
    for(const s of [-1, 1]) B.cone(0.04, 0.22, 4, "#efe6d4", [s * 0.2, 1.62, 0.98], [0, 0, -s * 1.1]);
    return animalGeo(B, [[0.26, 0.5, 0.9, 0.9, 0.14, c, 1], [-0.26, 0.5, 0.9, 0.9, 0.14, c, -1], [0.26, -0.5, 0.9, 0.9, 0.15, c, -1], [-0.26, -0.5, 0.9, 0.9, 0.15, c, 1]]); },
  horse(){ const B = new G.PartBuilder(), c = "#6a4228";
    B.add(lump(0.62, 1, 361), c, [0, 1.45, 0], null, [0.7, 0.72, 1.4]);
    B.cyl(0.18, 0.26, 0.95, 7, c, [0, 1.95, 0.72], [0.65, 0, 0]);
    B.add(lump(0.22, 1, 362), c, [0, 2.32, 1.05], null, [0.9, 0.9, 1.7]);
    B.box(0.08, 0.6, 0.5, "#2a1a10", [0, 2.15, 0.6], [0.65, 0, 0]); B.add(new THREE.CapsuleGeometry(0.08, 0.6, 2, 6), "#2a1a10", [0, 1.3, -0.95], [-0.5, 0, 0]);
    for(const s of [-1, 1]) B.cone(0.05, 0.15, 4, c, [s * 0.09, 2.52, 0.92]);
    return animalGeo(B, [[0.22, 0.55, 1.1, 1.1, 0.12, "#4a2e1a", 1], [-0.22, 0.55, 1.1, 1.1, 0.12, "#4a2e1a", -1], [0.22, -0.55, 1.1, 1.1, 0.13, "#4a2e1a", -1], [-0.22, -0.55, 1.1, 1.1, 0.13, "#4a2e1a", 1]]); },
  chicken(){ const B = new G.PartBuilder();
    B.add(lump(0.17, 1, 371), "#f2ece0", [0, 0.3, 0], null, [0.9, 0.95, 1.2]); B.sphere(0.09, "#f2ece0", [0, 0.48, 0.14], 1, 1);
    B.box(0.03, 0.08, 0.1, "#d0402a", [0, 0.58, 0.14]); B.cone(0.03, 0.08, 4, "#e8a83a", [0, 0.47, 0.25], [Math.PI / 2, 0, 0]);
    B.cone(0.08, 0.16, 5, "#e8e0d0", [0, 0.38, -0.2], [-1.2, 0, 0]);
    return animalGeo(B, [[0.06, 0, 0.16, 0.16, 0.025, "#e8a83a", 1], [-0.06, 0, 0.16, 0.16, 0.025, "#e8a83a", -1]]); },
  duck(){ const B = new G.PartBuilder();
    B.add(lump(0.22, 1, 381), "#8a7458", [0, 0.1, 0], null, [0.85, 0.6, 1.3]); B.sphere(0.12, "#2e6a3a", [0, 0.32, 0.22], 1, 1);
    B.box(0.08, 0.04, 0.12, "#e8a83a", [0, 0.3, 0.35]); B.box(0.18, 0.04, 0.03, "#f2ece0", [0, 0.24, 0.17]);
    return animalGeo(B, []); }
};

/* ---------- species setup ---------- */
const SPECIES = [
  { k: "deer", walk: 1.6, run: 8, flee: 18, stride: 5, homes: [[60, -100], [-150, -70], [-60, 160], [230, -20], [-250, 10], [120, -170]], per: 3, roam: 26 },
  { k: "rabbit", walk: 1.4, run: 6.5, flee: 9, stride: 0, hop: true, homes: [[110, 80], [150, 140], [70, 150], [-200, 0], [220, 150], [250, 20], [160, 60]], per: 3, roam: 22, scale: [0.9, 1.15] },
  { k: "fox", walk: 1.8, run: 7, flee: 14, stride: 7, homes: [[20, 60], [-100, -120], [180, -120], [-200, -160], [-30, 230]], per: 1, roam: 40 },
  { k: "boar", walk: 1.2, run: 5, flee: 7, stride: 7, homes: [[-20, -130], [100, -200], [-140, 40], [200, -150]], per: 2, roam: 24 },
  { k: "bear", walk: 1.0, run: 3, flee: 0, stride: 3.5, homes: [[-280, -60], [-200, -260], [-60, -290]], per: 1, roam: 34 },
  { k: "sheep", walk: 0.7, run: 3.2, flee: 4, stride: 6, homes: [[70, 150], [-165, 118]], per: [10, 7], roam: 15 },
  { k: "cow", walk: 0.6, run: 0, flee: 0, stride: 3.5, homes: [[272, 150]], per: 3, roam: 12 },
  { k: "horse", walk: 0.9, run: 0, flee: 0, stride: 3.2, homes: [[286, 70]], per: 2, roam: 10 },
  { k: "chicken", walk: 0.8, run: 2.8, flee: 3, stride: 14, homes: [[306, 136], [334, 104]], per: 4, roam: 7 },
  { k: "duck", walk: 0.5, run: 1.6, flee: 6, stride: 0, swim: true, homes: [[-150, -240], [-8, 95]], per: [6, 3], roam: 14 }
];

function okSpot(x, z, swim){
  if(swim) return T.waterDepth(x, z) > 0.25 && !T.onBridge(x, z);
  if(!T.walkable(x, z) || T.waterDepth(x, z) > 0.1 || T.slope(x, z) > 0.6 || T.superR(x, z) > T.PLAY - 4) return false;
  if(T.siteDist(x, z) < 16) return false;
  for(const c of T.collidersAround(x, z, 3)) if(Math.hypot(c.x - x, c.z - z) < c.r + 0.8) return false;
  return true;
}
function pickNear(hx, hz, roam, swim){
  for(let i = 0; i < 30; i++){ const a = R() * 6.283, r = Math.sqrt(R()) * roam, x = hx + Math.cos(a) * r, z = hz + Math.sin(a) * r; if(okSpot(x, z, swim)) return [x, z]; }
  return null;
}

function faunaMaterial(){
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = "attribute float legSign; attribute vec3 hip; attribute vec2 aAnim;\n" + sh.vertexShader.replace("#include <begin_vertex>",
      `#include <begin_vertex>
       if(legSign != 0.0){ float a = sin(aAnim.x) * aAnim.y * legSign; vec3 q = transformed - hip; float c = cos(a), s = sin(a);
         q = vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c); transformed = q + hip; }`);
  };
  m.customProgramCacheKey = () => "fauna";
  return m;
}

fauna.build = function(scene){
  const mat = faunaMaterial();
  for(const sp of SPECIES){
    const geo = BUILD[sp.k]();
    const list = [];
    sp.homes.forEach((h, hi) => {
      const n = Array.isArray(sp.per) ? sp.per[hi] : sp.per;
      for(let i = 0; i < n; i++){
        const p = pickNear(h[0], h[1], sp.roam * 0.6, sp.swim); if(!p) continue;
        const sc = sp.scale ? R.range(sp.scale[0], sp.scale[1]) : R.range(0.9, 1.1);
        list.push({ x: p[0], z: p[1], hx: h[0], hz: h[1], ry: R() * 6.28, tx: p[0], tz: p[1], wait: R() * 6, sp: 0, phase: R() * 6, flee: 0, s: sc, hopT: 0, y: 0 });
      }
    });
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    im.count = list.length;
    im.geometry.setAttribute("aAnim", new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, list.length) * 2), 2));
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    scene.add(im);
    fauna.species.push({ def: sp, mesh: im, list });
  }
  /* eagles circling over the mountains */
  const eg = new THREE.BufferGeometry();
  eg.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.9, -2.4, 0.5, -0.2, 0, 0, -0.6, 0, 0, 0.9, 0, 0, -0.6, 2.4, 0.5, -0.2, 0, 0.05, 0.9, 0, 0.05, -1.3, 0, -0.12, 0.2], 3)); eg.computeVertexNormals();
  fauna.eagles = new THREE.InstancedMesh(eg, new THREE.MeshLambertMaterial({ color: 0x3a2a1c, side: THREE.DoubleSide }), 4);
  fauna.eagles.frustumCulled = false; scene.add(fauna.eagles);
  fauna.eagleData = [[-300, -280, 110], [-150, -300, 95], [200, -260, 90], [-330, 60, 100]].map(([x, z, h]) => ({ cx: x, cz: z, h, r: 40 + R() * 30, a: R() * 6.28, sp: 0.12 + R() * 0.05, ph: R() * 6 }));
  /* butterflies by day around the player in grassy places */
  const bg = new THREE.BufferGeometry();
  bg.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.06, -0.14, 0.02, 0.1, 0, 0, -0.06, 0, 0, 0.06, 0, 0, -0.06, 0.14, 0.02, 0.1], 3)); bg.computeVertexNormals();
  fauna.butterflies = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 36);
  fauna.butterflies.frustumCulled = false;
  const cols = ["#f2cf4a", "#ffffff", "#e8884a", "#8ab8f0", "#f0a3c8"];
  fauna.bfData = [];
  for(let i = 0; i < 36; i++){ fauna.butterflies.setColorAt(i, new THREE.Color(cols[i % cols.length])); fauna.bfData.push({ ox: R.range(-26, 26), oz: R.range(-26, 26), ph: R() * 6.28, sp: R.range(0.4, 1.0), h: R.range(0.5, 1.6) }); }
  scene.add(fauna.butterflies);
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
fauna.update = function(dt, t, player){
  const px = player.x, pz = player.z;
  for(const S of fauna.species){
    const d = S.def, aAnim = S.mesh.geometry.attributes.aAnim;
    let dirty = false;
    S.list.forEach((a, i) => {
      const dist = Math.hypot(a.x - px, a.z - pz);
      if(dist > 260 && a._placed){ return; }
      /* decide */
      if(d.flee && dist < d.flee && player.speed > 0.2 || (d.flee && dist < d.flee * 0.5)){
        const ax = a.x - px, az = a.z - pz, L = Math.hypot(ax, az) || 1;
        a.tx = a.x + ax / L * 14; a.tz = a.z + az / L * 14; a.flee = 2.5; a.wait = 0;
      }
      a.wait -= dt; a.flee = Math.max(0, a.flee - dt);
      if(a.wait <= 0 && !a.flee){
        const p = pickNear(a.hx, a.hz, d.roam, d.swim);
        if(p){ a.tx = p[0]; a.tz = p[1]; }
        a.wait = R.range(4, 14);
      }
      /* move */
      const dx = a.tx - a.x, dz = a.tz - a.z, L = Math.hypot(dx, dz);
      const want = L > 0.4 ? (a.flee > 0 && d.run ? d.run : d.walk) : 0;
      a.sp = damp(a.sp, want, 4, dt);
      if(a.sp > 0.05 && L > 0.05){
        let mx = dx / L * a.sp * dt, mz = dz / L * a.sp * dt;
        if(d.swim){ const nx = a.x + mx, nz = a.z + mz; if(T.waterDepth(nx, nz) > 0.2){ a.x = nx; a.z = nz; } else { a.tx = a.x; a.tz = a.z; } }
        else { const r = T.moveCircle(a.x, a.z, mx, mz, 0.4, false); if(Math.hypot(r[0] - a.x, r[1] - a.z) < 1e-4){ a.tx = a.x; a.tz = a.z; } a.x = r[0]; a.z = r[1]; }
        a.ry = N.dampAngle(a.ry, Math.atan2(dx, dz), 5, dt);
      }
      const moving = a.sp > 0.1;
      a.phase += dt * (d.stride ? d.stride * a.sp / Math.max(d.walk, 0.5) * 0.6 + (moving ? 2 : 0) : 6) ;
      let y = d.swim ? T.waterLevel(a.x, a.z) - 0.05 + Math.sin(t * 2 + i) * 0.02 : T.ground(a.x, a.z);
      if(d.hop && moving) y += Math.abs(Math.sin(a.phase * 1.6)) * 0.28;
      else if(!d.swim && moving) y += Math.abs(Math.sin(a.phase)) * 0.04;
      if(d.k === "chicken" && !moving) y += Math.max(0, Math.sin(t * 5 + i * 2)) * 0.03;
      const pitch = (!d.swim && !d.hop) ? clamp(-((T.ground(a.x + Math.sin(a.ry), a.z + Math.cos(a.ry)) - T.ground(a.x - Math.sin(a.ry), a.z - Math.cos(a.ry))) / 2), -0.4, 0.4) : 0;
      _e.set(pitch, a.ry, 0, "YXZ"); _q.setFromEuler(_e); _p.set(a.x, y, a.z); _s.set(a.s, a.s, a.s);
      _m.compose(_p, _q, _s); S.mesh.setMatrixAt(i, _m);
      aAnim.setXY(i, a.phase, moving ? clamp(a.sp / Math.max(d.walk, 0.3), 0, 1.6) * 0.45 : 0);
      a._placed = true; dirty = true;
    });
    if(dirty){ S.mesh.instanceMatrix.needsUpdate = true; aAnim.needsUpdate = true; }
  }
  /* eagles */
  const day = 1 - N.sky.nightness();
  fauna.eagles.visible = day > 0.3;
  fauna.eagleData.forEach((e, i) => {
    e.a += e.sp * dt;
    const flap = Math.sin(t * 2.2 + e.ph) > 0.6 ? 0.6 + 0.4 * Math.abs(Math.sin(t * 9 + e.ph)) : 1;
    _q.setFromEuler(_e.set(0, -e.a + Math.PI, -0.25)); _p.set(e.cx + Math.cos(e.a) * e.r, e.h + Math.sin(t * 0.3 + e.ph) * 6, e.cz + Math.sin(e.a) * e.r); _s.set(1, flap, 1);
    _m.compose(_p, _q, _s); fauna.eagles.setMatrixAt(i, _m);
  });
  fauna.eagles.instanceMatrix.needsUpdate = true;
  /* butterflies */
  fauna.butterflies.visible = day > 0.6;
  if(fauna.butterflies.visible){
    fauna.bfData.forEach((b, i) => {
      let x = px + b.ox + Math.sin(t * b.sp + b.ph) * 3, z = pz + b.oz + Math.cos(t * b.sp * 0.7 + b.ph) * 3;
      const hide = T.waterDepth(x, z) > 0.05 || T.roadDist(x, z) < 2;
      _q.setFromEuler(_e.set(0, t * b.sp + b.ph, 0)); _p.set(x, T.ground(x, z) + b.h + Math.sin(t * 3 + b.ph) * 0.25, z);
      const f = Math.abs(Math.sin(t * 14 + b.ph)); _s.set(hide ? 0.0001 : 1.2 * (0.3 + f), 1.2, 1.2);
      _m.compose(_p, _q, _s); fauna.butterflies.setMatrixAt(i, _m);
    });
    fauna.butterflies.instanceMatrix.needsUpdate = true;
  }
};
fauna.count = () => fauna.species.reduce((a, s) => a + s.list.length, 0);

N.fauna = fauna;
})();
