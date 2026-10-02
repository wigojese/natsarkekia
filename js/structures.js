/* =====================================================================
   STRUCTURES IN THE FOREST — woodcutter's cabin, hunter's lodge,
   watermill (turning wheel), ruined watchtower, Georgian stone cross,
   apiary, charcoal kiln, small Georgian church, old ruin, and cairns
   with benches on the viewpoint hills. Decoration only (no text, no
   effect on the game rules). Each building is one merged clay mesh.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const T = N.terrain, G = N.geom;
const st = { wheels: [], bells: [] };
const R = N.rng(909);

const WOOD = "#6e4b2e", WOOD2 = "#7a5636", LOG = "#835d3a", DARK = "#3b2a1c", STONE = "#958a76", STONE2 = "#a39680", SLATE = "#5d5853", TILE = "#9c4a2c";

/* place a locally built PartBuilder at (x, z) with yaw ry; returns the mesh */
function place(scene, B, x, z, ry, mat){
  const geo = B.geometry();
  geo.applyMatrix4(new THREE.Matrix4().makeRotationY(ry));
  geo.translate(x, T.ground(x, z), z);
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat || G.clayMat); m.castShadow = true; m.receiveShadow = true;
  scene.add(m); return m;
}
const toWorld = (x, z, ry, lx, ly, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), T.ground(x, z) + ly, z - lx * Math.sin(ry) + lz * Math.cos(ry)];

function logWalls(B, w, d, h, color){
  const n = Math.round(h / 0.32);
  for(let i = 0; i < n; i++){
    const y = 0.16 + i * 0.32, off = i % 2 ? 0.12 : 0;
    B.cyl(0.17, 0.17, w + 0.5, 7, color, [0, y, d / 2 - off * 0], [0, 0, Math.PI / 2]);
    B.cyl(0.17, 0.17, w + 0.5, 7, color, [0, y, -d / 2], [0, 0, Math.PI / 2]);
    B.cyl(0.17, 0.17, d + 0.5, 7, color, [w / 2, y + 0.16, 0], [Math.PI / 2, 0, 0]);
    B.cyl(0.17, 0.17, d + 0.5, 7, color, [-w / 2, y + 0.16, 0], [Math.PI / 2, 0, 0]);
  }
  B.box(w - 0.1, h, d - 0.1, color, [0, h / 2, 0]);
}
function gable(B, w, d, h, color, over){
  const o = over || 0.6, run = w / 2 + o, rise = h, L = Math.hypot(run, rise), a = Math.atan2(rise, run);
  B.box(L, 0.18, d + o * 2, color, [-run / 2, rise / 2, 0], [0, 0, a]);
  B.box(L, 0.18, d + o * 2, color, [run / 2, rise / 2, 0], [0, 0, -a]);
  /* gable ends */
  const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, rise - 0.15); tri.closePath();
  const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false });
  B.add(tg, WOOD2, [0, 0, d / 2 - 0.12]); B.add(tg.clone(), WOOD2, [0, 0, -d / 2]);
}
function cabin(B, w, d, h){
  logWalls(B, w, d, h, LOG);
  const top = new G.PartBuilder(); gable(top, w, d, 1.7, "#5d4a36", 0.7);
  top.parts.forEach(g => { g.translate(0, h, 0); B.parts.push(g); });
  B.box(1.0, 1.9, 0.12, DARK, [w * 0.15, 0.95, d / 2 + 0.12]);
  B.box(0.75, 0.7, 0.12, "#251c14", [-w * 0.25, h * 0.6, d / 2 + 0.12]);
  B.box(0.65, 2.2, 0.65, STONE, [w / 2 - 0.6, h + 0.8, -d / 4]);
}

const BUILD = {
  cabin(scene, p){
    const B = new G.PartBuilder(), ry = 0.6;
    cabin(B, 5.5, 4.4, 2.6);
    for(let r = 0; r < 3; r++) for(let i = 0; i < 4 - r; i++) B.cyl(0.22, 0.22, 2.4, 7, i % 2 ? LOG : "#a07a4c", [-5 + i * 0.46 + r * 0.23, 0.22 + r * 0.4, 3.2], [Math.PI / 2, 0, 0]);
    B.cyl(0.38, 0.42, 0.6, 9, "#8a6a40", [3.6, 0.3, 3.6]); B.cyl(0.36, 0.36, 0.02, 9, "#c8a878", [3.6, 0.61, 3.6]);
    B.cyl(0.03, 0.04, 0.8, 4, WOOD, [3.6, 0.85, 3.6], [0.5, 0, 0.2]); B.box(0.08, 0.25, 0.3, "#6a6a70", [3.6, 1.15, 3.85], [0.5, 0, 0.2]);
    for(const s of [-1, 1]) B.box(0.1, 0.9, 0.1, WOOD, [5.2 + s * 0.5, 0.45, 1.5], [0, 0, s * 0.35]);
    B.cyl(0.18, 0.18, 1.8, 7, "#a07a4c", [5.2, 0.95, 1.5], [Math.PI / 2, 0, 0]);
    place(scene, B, p.x, p.z, ry);
    T.addBoxCollider(p.x, p.z, 6.2, 5.2, ry, "house");
    const c = toWorld(p.x, p.z, ry, 2.15, 4.9, -1.1); N.world.smokeEmitters.push({ pos: c, rate: 0.8, size: 1.5, rise: 2.2, life: 6, color: [0.8, 0.78, 0.75], alpha: 0.32, kind: "chimney2" });
    const lp = toWorld(p.x, p.z, ry, -4.3, 0, 3.2); T.addCollider(lp[0], lp[2], 1.4, "logs");
  },
  lodge(scene, p){
    const B = new G.PartBuilder(), ry = -0.9;
    cabin(B, 4.6, 4.0, 2.4);
    /* antlers over the door */
    for(const s of [-1, 1]){ B.cyl(0.03, 0.04, 0.6, 4, "#d8c8a0", [0.7 + s * 0.22, 2.25, 2.25], [0, 0, s * 0.6]); B.cyl(0.025, 0.03, 0.3, 4, "#d8c8a0", [0.7 + s * 0.38, 2.45, 2.25], [0, 0, s * 0.1]); }
    /* drying rack with pelts */
    for(const s of [-1, 1]) B.box(0.12, 2.0, 0.12, WOOD, [4.0 + s * 1.3, 1.0, 1.2]);
    B.box(2.8, 0.1, 0.1, WOOD, [4.0, 1.9, 1.2]);
    B.box(0.9, 1.1, 0.06, "#7a5a3a", [3.5, 1.3, 1.2], [0, 0, 0.05]); B.box(0.7, 0.9, 0.06, "#5a4030", [4.5, 1.4, 1.2], [0, 0, -0.05]);
    B.cyl(0.35, 0.4, 0.5, 9, "#8a6a40", [-3.4, 0.25, 2.2]);
    place(scene, B, p.x, p.z, ry);
    T.addBoxCollider(p.x, p.z, 5.2, 4.8, ry, "house");
    const c = toWorld(p.x, p.z, ry, 1.7, 4.6, -1.0); N.world.smokeEmitters.push({ pos: c, rate: 0.7, size: 1.4, rise: 2, life: 6, color: [0.8, 0.78, 0.75], alpha: 0.3, kind: "chimney2" });
  },
  mill(scene, p){
    /* face the river: the wheel turns in the current */
    const rv = T.r1Idx.nearest(p.x, p.z, 60), ry = Math.atan2(rv.x - p.x, rv.z - p.z) - Math.PI / 2;
    const B = new G.PartBuilder();
    B.add(G.lumpy(new THREE.BoxGeometry(5.2, 3.6, 5.0, 3, 2, 3), 0.03, 401), STONE, [0, 1.6, 0]);
    B.box(5.0, 2.0, 4.8, WOOD2, [0, 4.4, 0]);
    const top = new G.PartBuilder(); gable(top, 5.2, 5.0, 2.0, "#5d4a36", 0.6); top.parts.forEach(g => { g.translate(0, 5.4, 0); B.parts.push(g); });
    B.box(1.1, 2.0, 0.12, DARK, [-1.2, 1.0, -2.55]); B.box(0.7, 0.7, 0.12, "#251c14", [1.2, 4.3, -2.45]);
    B.cyl(0.9, 0.9, 0.3, 14, "#8f8a80", [-3.4, 0.15, -2.2]);
    for(let i = 0; i < 4; i++) B.sphere(0.32, "#d8c8a0", [-3.2 + i * 0.5, 0.3, -3.4], [1, 1.2, 0.8], 0);
    B.box(0.5, 0.5, 4.4, WOOD, [0, 0.0, 4.4]);                         // axle housing
    place(scene, B, p.x, p.z, ry);
    T.addBoxCollider(p.x, p.z, 5.8, 5.6, ry, "house");
    /* water wheel */
    const W = new G.PartBuilder();
    W.torus(2.4, 0.12, WOOD, [0, 0, 0.45], [0, 0, 0]); W.torus(2.4, 0.12, WOOD, [0, 0, -0.45], [0, 0, 0]);
    for(let i = 0; i < 12; i++){ const a = i / 12 * Math.PI * 2; W.box(0.12, 4.8, 0.12, WOOD2, [0, 0, 0], [0, 0, a]); W.box(0.7, 0.1, 1.0, LOG, [Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0], [0, 0, a]); }
    W.cyl(0.25, 0.25, 1.4, 8, DARK, [0, 0, 0], [Math.PI / 2, 0, 0]);
    const wheel = new THREE.Mesh(W.geometry(), G.clayMat); wheel.castShadow = true;
    const wp = toWorld(p.x, p.z, ry, 0, 0, 0);
    const wx = p.x + (rv.x - p.x) * 0.62, wz = p.z + (rv.z - p.z) * 0.62;
    const lvl = T.R1WL[rv.seg];
    wheel.position.set(wx, Math.max(lvl + 1.6, T.ground(wx, wz) + 1.2), wz); wheel.rotation.y = ry + Math.PI / 2;
    scene.add(wheel); st.wheels.push({ mesh: wheel, sp: -0.7 });
    T.addCollider(wx, wz, 1.6, "wheel");
  },
  tower(scene, p){
    /* a broken Svan-style watchtower on its hill */
    const B = new G.PartBuilder();
    B.add(G.lumpy(new THREE.BoxGeometry(4.2, 9.5, 4.2, 2, 4, 2), 0.04, 411), STONE2, [0, 4.6, 0]);
    for(let i = 0; i < 7; i++){ const h = R.range(0.5, 2.6); B.box(R.range(0.8, 1.6), h, R.range(0.8, 1.2), STONE2, [R.range(-1.6, 1.6), 9.4 + h / 2, (i % 2 ? 1.6 : -1.6)]); }
    for(const y of [3, 6, 8.4]) B.box(0.45, 0.8, 0.1, "#1e1712", [0, y, 2.12]);
    B.box(0.9, 1.7, 0.1, "#1e1712", [0, 0.85, 2.12]);
    for(let i = 0; i < 12; i++){ const a = R() * 6.28, r = R.range(3, 6); B.add(G.lumpy(new THREE.BoxGeometry(0.7, 0.45, 0.6), 0.1, 420 + i), STONE2, [Math.cos(a) * r, 0.15, Math.sin(a) * r], [R(), R() * 3, R()]); }
    place(scene, B, p.x, p.z - 5, 0.3);
    T.addBoxCollider(p.x, p.z - 5, 4.6, 4.6, 0.3, "tower");
  },
  shrine(scene, p){
    /* Georgian stone cross on a stepped base, with a small bell frame */
    const B = new G.PartBuilder();
    B.box(2.4, 0.4, 2.4, STONE, [0, 0.2, 0]); B.box(1.7, 0.4, 1.7, STONE2, [0, 0.6, 0]); B.box(1.1, 0.5, 1.1, STONE, [0, 1.05, 0]);
    B.box(0.42, 3.2, 0.36, "#b0a48e", [0, 2.9, 0]); B.box(1.7, 0.4, 0.36, "#b0a48e", [0, 3.7, 0]);
    for(const [x, y] of [[0, 4.5], [0.85, 3.7], [-0.85, 3.7]]) B.box(0.55, 0.2, 0.38, "#b0a48e", [x, y, 0], [0, 0, 0]);
    for(const s of [-1, 1]) B.box(0.14, 2.6, 0.14, WOOD, [3 + s * 0.7, 1.3, -1]);
    B.box(1.7, 0.14, 0.14, WOOD, [3, 2.6, -1]); B.cone(0.28, 0.42, 9, "#8a6a2a", [3, 2.25, -1]);
    place(scene, B, p.x, p.z + 3, 0.2);
    T.addCollider(p.x, p.z + 3, 1.5, "shrine");
  },
  bees(scene, p){
    const B = new G.PartBuilder();
    for(let i = 0; i < 7; i++){
      const a = i / 7 * Math.PI * 1.3 - 0.6, x = Math.cos(a) * 5.5, z = Math.sin(a) * 5.5;
      B.box(0.9, 0.5, 0.9, WOOD, [x, 0.25, z]); B.cyl(0.42, 0.45, 0.9, 10, "#a8804a", [x, 0.95, z]);
      B.cyl(0.55, 0.5, 0.12, 10, "#5d4a36", [x, 1.45, z]); B.box(0.18, 0.06, 0.06, "#2a1d14", [x + 0.4, 0.75, z]);
      T.addCollider(p.x + x, p.z + z, 0.7, "hive");
    }
    /* beekeeper's hut */
    B.box(3.2, 2.2, 2.6, WOOD2, [-4.8, 1.1, -3]);
    const top = new G.PartBuilder(); gable(top, 3.2, 2.6, 1.2, "#5d4a36", 0.4); top.parts.forEach(g => { g.translate(-4.8, 2.2, -3); B.parts.push(g); });
    B.box(0.8, 1.6, 0.1, DARK, [-4.8, 0.8, -1.65]);
    place(scene, B, p.x, p.z, 0);
    T.addBoxCollider(p.x - 4.8, p.z - 3, 3.6, 3, 0, "house");
    st.beeSpot = [p.x, T.ground(p.x, p.z) + 1.2, p.z];
  },
  kiln(scene, p){
    const B = new G.PartBuilder();
    B.add(G.lumpy(new THREE.SphereGeometry(2.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0.08, 431), "#3a302a", [0, -0.2, 0], null, [1, 0.8, 1]);
    B.cyl(0.25, 0.3, 0.4, 7, "#2a2420", [0, 1.95, 0]);
    for(let r = 0; r < 4; r++) for(let i = 0; i < 6 - r; i++) B.cyl(0.16, 0.16, 1.6, 6, i % 2 ? LOG : "#a07a4c", [4.2 + i * 0.33 + r * 0.16, 0.16 + r * 0.29, -1.5], [Math.PI / 2, 0, 0]);
    B.cyl(0.03, 0.03, 1.5, 4, WOOD, [3.3, 0.7, 1.5], [0, 0, 0.6]); B.box(0.3, 0.05, 0.4, "#6a6a70", [3.75, 0.08, 1.5]);
    place(scene, B, p.x, p.z, 0.4);
    T.addCollider(p.x, p.z, 2.8, "kiln");
    N.world.smokeEmitters.push({ pos: [p.x, T.ground(p.x, p.z) + 2.3, p.z], rate: 1.6, size: 2.2, rise: 3, life: 8, color: [0.55, 0.53, 0.5], alpha: 0.4, kind: "kiln" });
  },
  chapel(scene, p){
    /* small Georgian church: stone nave, gable roof, drum with a conical roof, bell frame */
    const B = new G.PartBuilder(), w = 5.6, d = 9, h = 4.2;
    B.add(G.lumpy(new THREE.BoxGeometry(w, h, d, 3, 2, 4), 0.025, 441), "#b8a888", [0, h / 2, 0]);
    const top = new G.PartBuilder(); gable(top, w, d, 1.9, TILE, 0.35); top.parts.forEach(g => { g.translate(0, h, 0); B.parts.push(g); });
    B.cyl(1.5, 1.5, 2.2, 10, "#b8a888", [0, h + 2.1, 0.8]); B.cone(1.75, 2.1, 10, TILE, [0, h + 4.25, 0.8]);
    for(let i = 0; i < 5; i++){ const a = i / 5 * Math.PI * 2; B.box(0.22, 0.7, 0.1, "#2a2018", [Math.cos(a) * 1.52, h + 2.2, 0.8 + Math.sin(a) * 1.52], [0, -a + Math.PI / 2, 0]); }
    B.box(1.3, 2.4, 0.15, "#4a3424", [0, 1.2, d / 2 + 0.02]);
    B.cyl(0.65, 0.65, 0.15, 12, "#4a3424", [0, 2.4, d / 2 + 0.02], [Math.PI / 2, 0, 0]);
    for(const z of [-2.5, 0.5]) B.box(0.1, 1.0, 0.35, "#2a2018", [w / 2 + 0.02, 2.6, z]);
    B.cyl(0.5, 0.5, 0.15, 12, "#c8b898", [0, 4.4, -d / 2 - 0.02], [Math.PI / 2, 0, 0]);
    /* stone fence */
    for(let a = 0; a < Math.PI * 2; a += 0.28){ if(Math.abs(a - Math.PI / 2) < 0.25) continue; const rr = 9.5; B.add(G.lumpy(new THREE.BoxGeometry(1.4, 0.7, 0.6), 0.08, 450 + a), STONE, [Math.cos(a) * rr * 0.75, 0.3, Math.sin(a) * rr], [0, -a, 0]); }
    place(scene, B, p.x, p.z, 0.15);
    T.addBoxCollider(p.x, p.z, w + 0.4, d + 0.4, 0.15, "chapel");
  },
  ruin(scene, p){
    const B = new G.PartBuilder();
    const wall = (x, z, w, dd, h) => B.add(G.lumpy(new THREE.BoxGeometry(w, h, dd, 2, 2, 1), 0.06, 460 + x * 3 + z), "#8f8676", [x, h / 2, z]);
    wall(-3, 0, 0.7, 6, 2.6); wall(3, -1.5, 0.7, 3, 1.4); wall(0, -3, 6.6, 0.7, 3.2); wall(1.5, 3, 3, 0.7, 1.0);
    B.box(5, 0.25, 0.3, WOOD, [0, 1.4, 0.5], [0.2, 0.3, 0.45]); B.box(4, 0.25, 0.3, WOOD, [0.5, 0.6, -1], [0, -0.4, 0.15]);
    for(let i = 0; i < 9; i++) B.add(G.lumpy(new THREE.BoxGeometry(0.6, 0.4, 0.5), 0.1, 480 + i), "#8f8676", [R.range(-4, 4), 0.15, R.range(-4, 4)], [R(), R() * 3, R()]);
    for(let i = 0; i < 6; i++) B.sphere(0.5, "#4f6e2c", [R.range(-3, 3), 0.25, R.range(-3, 3)], [1.3, 0.6, 1.1], 1);
    place(scene, B, p.x, p.z, 0.9);
    for(const [x, z, w, dd] of [[-3, 0, 0.9, 6], [0, -3, 6.6, 0.9]]){ const q = toWorld(p.x, p.z, 0.9, x, 0, z); T.addBoxCollider(q[0], q[2], w, dd, 0.9, "chapel"); }
  }
};

function cairn(scene, v){
  const B = new G.PartBuilder();
  let y = 0;
  for(let i = 0; i < 6; i++){ const r = 0.75 - i * 0.1, h = 0.28; B.add(G.lumpy(new THREE.CylinderGeometry(r, r * 1.08, h, 8), 0.12, 500 + i), i % 2 ? "#8a857c" : "#9a948a", [R.range(-0.05, 0.05), y + h / 2, R.range(-0.05, 0.05)], [0, R() * 3, R.range(-0.08, 0.08)]); y += h; }
  B.box(2.0, 0.12, 0.5, WOOD2, [2.2, 0.5, 0.6]); for(const s of [-1, 1]) B.box(0.14, 0.5, 0.4, WOOD, [2.2 + s * 0.8, 0.25, 0.6]);
  B.cyl(0.04, 0.05, 2.6, 5, WOOD, [-1.2, 1.3, -0.4]);
  place(scene, B, v.x, v.z, R() * 6);
  T.addCollider(v.x, v.z, 0.9, "cairn");
  /* a little pennant that flutters */
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5, 6, 1), new THREE.MeshLambertMaterial({ color: 0x9c3d24, side: THREE.DoubleSide }));
  const q = toWorld(v.x, v.z, 0, -1.2, 2.35, -0.4);
  flag.position.set(q[0] + 0.45, q[1], q[2]); flag.castShadow = true; scene.add(flag);
  st.flags = st.flags || []; st.flags.push(flag);
}

st.build = function(scene){
  for(const p of T.PADS) if(BUILD[p.id]) BUILD[p.id](scene, p);
  for(const v of T.VIEWPOINTS) if(!(Math.hypot(v.x - 131, v.z + 138) < 3)) cairn(scene, v);
  /* bees buzzing around the apiary (tiny dark points) */
  if(st.beeSpot){
    const n = 40, g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    st.bees = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x2a2010, size: 0.09 })); st.bees.frustumCulled = false; scene.add(st.bees);
  }
};
st.update = function(dt, t, player){
  for(const w of st.wheels) w.mesh.rotateZ(w.sp * dt);
  if(st.flags) for(const f of st.flags){ const p = f.geometry.attributes.position; for(let i = 0; i < p.count; i++){ const x = p.getX(i); p.setZ(i, Math.sin(t * 6 + x * 6) * 0.08 * (x + 0.45)); } p.needsUpdate = true; }
  if(st.bees && Math.hypot(player.x - st.beeSpot[0], player.z - st.beeSpot[2]) < 60){
    const p = st.bees.geometry.attributes.position;
    for(let i = 0; i < p.count; i++){ const a = t * (1 + (i % 5) * 0.3) + i, r = 1.5 + (i % 7) * 0.8; p.setXYZ(i, st.beeSpot[0] + Math.cos(a) * r, st.beeSpot[1] + Math.sin(a * 1.7) * 0.6, st.beeSpot[2] + Math.sin(a * 0.9) * r); }
    p.needsUpdate = true; st.bees.visible = N.sky.nightness() < 0.5;
  }
};

N.structures = st;
})();
