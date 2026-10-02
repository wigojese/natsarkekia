/* =====================================================================
   WORLD DRESSING — terrain mesh, road, rivers, forest, village, the ten
   sites' props, exploration spots and ambient life (smoke, birds, ...).
   Clay-miniature look: rounded low-poly, vertex colours, flat shading.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const T = N.terrain, G = N.geom;
const { clamp, lerp, smoothstep } = N;
const SITES = N.data.SITES;
const world = { sites: {}, fires: [], smokeEmitters: [], variants: {}, devSpots: {} };
/* Devi's watch spots far away on ridges (§4.1): keep the line of sight from the site clear */
const DEVI_FAR = { 4: [95, 14], 5: [62, -70] };
const DEVI_VIEWS = [[...SITES[4].pos, ...DEVI_FAR[4]], [...SITES[5].pos, ...DEVI_FAR[5]]];
const R = N.rng(4242);
const C = (h) => new THREE.Color(h);

/* ---------------- site frames: b = travel direction, l = right-hand side ---------------- */
function siteFrame(i){
  const p = SITES[i].pos, t = T.roadT(p[0], p[1]);
  const prev = T.roadPointAt(Math.max(0, t - 12)), next = T.roadPointAt(t + 12);
  let bx = next[0] - prev[0], bz = next[1] - prev[1];
  if(i === 10){ bx = T.CAVE.bx; bz = T.CAVE.bz; }
  const L = Math.hypot(bx, bz); bx /= L; bz /= L;
  const f = { x: p[0], z: p[1], bx, bz, lx: -bz, lz: bx, yaw: Math.atan2(bx, bz) };
  f.at = (lx, lz) => [f.x + f.lx * lx + f.bx * lz, f.z + f.lz * lx + f.bz * lz];
  f.at3 = (lx, lz, dy) => { const q = f.at(lx, lz); return [q[0], T.ground(q[0], q[1]) + (dy || 0), q[1]]; };
  return f;
}
world.frames = {};
for(let i = 1; i <= 10; i++) world.frames[i] = siteFrame(i);

/* ====================================================================
   TERRAIN MESH
   ==================================================================== */
function buildTerrain(scene){
  const V = T.V, H = T.H, n = V * V;
  const pos = new Float32Array(n * 3), colr = new Float32Array(n * 3);
  const cGrass = C("#6f8a3c"), cGrass2 = C("#93a14c"), cForest = C("#4d6a2e"), cDirt = C("#9a7b4c"), cRock = C("#77726a"),
        cDark = C("#2c2826"), cSnow = C("#ece8de"), cSand = C("#b5a27c"), cVillage = C("#a08a62"), cMeadow = C("#8aa64a");
  const c = new THREE.Color(), tmp = new THREE.Color();
  const nz = T.noise;
  for(let j = 0; j < V; j++) for(let i = 0; i < V; i++){
    const k = j * V + i, x = -T.HALF + i * T.CELL, z = -T.HALF + j * T.CELL, h = H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    const s = T.slope(x, z);
    const n1 = nz.fbm(x * 0.02 + 5, z * 0.02 - 3, 3), n2 = nz.n2(x * 0.09, z * 0.09);
    c.copy(cGrass).lerp(cGrass2, smoothstep(-0.3, 0.5, n1));
    c.lerp(cForest, smoothstep(40, -200, x) * 0.45 + smoothstep(0.1, 0.5, -n1) * 0.25);
    const dm = Math.hypot(x - 110, z - 80); if(dm < 70) c.lerp(cMeadow, (1 - smoothstep(30, 70, dm)) * 0.6);
    const rd = T.roadDist(x, z);
    if(rd < 5) c.lerp(cDirt, (1 - smoothstep(1.5, 5, rd)) * 0.55);
    const dv = Math.hypot(x - T.VILLAGE.x, z - T.VILLAGE.z);
    if(dv < 34) c.lerp(cVillage, (1 - smoothstep(14, 34, dv)) * 0.7);
    const wl = T.WL[k];
    if(wl > -1e8 || T.riverDist(x, z) < 11) c.lerp(cSand, 0.55 * (1 - smoothstep(6, 11, T.riverDist(x, z))));
    if(wl > -1e8 && h < wl - 0.2) c.lerp(C("#5d5440"), 0.7);
    c.lerp(cRock, smoothstep(0.42, 0.85, s));
    const dc = Math.hypot(x + 352, z + 312);
    if(dc < 60) c.lerp(cDark, (1 - smoothstep(18, 60, dc)) * 0.85);
    if(h > 92) c.lerp(cSnow, smoothstep(92, 120, h) * (1 - smoothstep(0.9, 1.6, s) * 0.5));
    c.multiplyScalar(0.94 + n2 * 0.08);
    /* cheap baked AO from the local curvature */
    if(i > 0 && j > 0 && i < V - 1 && j < V - 1){
      const avg = (H[k - 1] + H[k + 1] + H[k - V] + H[k + V]) / 4;
      c.multiplyScalar(clamp(1 + (h - avg) * 0.18, 0.72, 1.08));
    }
    colr[k * 3] = c.r; colr[k * 3 + 1] = c.g; colr[k * 3 + 2] = c.b;
  }
  const idx = new Uint32Array(T.SEGS * T.SEGS * 6); let o = 0;
  for(let j = 0; j < T.SEGS; j++) for(let i = 0; i < T.SEGS; i++){
    const a = j * V + i, b = a + 1, cc = a + V, d = cc + 1;
    idx[o++] = a; idx[o++] = cc; idx[o++] = b; idx[o++] = b; idx[o++] = cc; idx[o++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colr, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = "varying vec3 vWP;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = "varying vec3 vWP;\nfloat th(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\nfloat tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(th(i), th(i+vec2(1,0)), f.x), mix(th(i+vec2(0,1)), th(i+vec2(1,1)), f.x), f.y); }\n" +
      sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n diffuseColor.rgb *= 0.9 + 0.13 * tn(vWP.xz * 0.45) + 0.07 * tn(vWP.xz * 2.3);");
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.name = "terrain";
  scene.add(mesh);
  world.terrainMesh = mesh;
}

/* ====================================================================
   ROAD + PATHS (vertex-alpha ribbons draped over the terrain)
   ==================================================================== */
function ribbon(pts, cols, color, color2, lift, skip){
  const v = [], col = [], ind = [];
  const cc = C(color), c2 = C(color2), tmp = new THREE.Color();
  let rows = 0;
  for(let i = 0; i < pts.length; i++){
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const px = -dz, pz = dx;
    const brk = skip && skip(pts[i][0], pts[i][1]);
    for(const [off, al, mixk] of cols){
      const x = pts[i][0] + px * off, z = pts[i][1] + pz * off;
      v.push(x, T.ground(x, z) + lift, z);
      tmp.copy(cc).lerp(c2, mixk).multiplyScalar(0.92 + 0.12 * T.noise.n2(x * 0.3, z * 0.3));
      col.push(tmp.r, tmp.g, tmp.b, brk ? 0 : al);
    }
    if(i > 0){
      const w = cols.length, r0 = (rows - 1) * w, r1 = rows * w;
      for(let k = 0; k < w - 1; k++){ ind.push(r0 + k, r1 + k, r0 + k + 1, r0 + k + 1, r1 + k, r1 + k + 1); }
    }
    rows++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(ind); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }));
  m.receiveShadow = true; m.renderOrder = 1;
  return m;
}
function buildRoads(scene){
  const cols = [[-2.3, 0, 0], [-1.4, 0.95, 0.2], [-0.7, 1, 0.55], [0, 1, 0.1], [0.7, 1, 0.55], [1.4, 0.95, 0.2], [2.3, 0, 0]];
  scene.add(ribbon(T.ROAD, cols, "#a8865a", "#7d6141", 0.07, (x, z) => T.onBridge(x, z) || T.waterDepth(x, z) > 0.3));
  for(const p of T.PATHS) scene.add(ribbon(p, [[-1.2, 0, 0], [-0.5, 0.75, 0.3], [0.5, 0.75, 0.3], [1.2, 0, 0]], "#9a7c52", "#7d6141", 0.06, (x, z) => T.waterDepth(x, z) > 0.3));
}

/* ====================================================================
   WATER
   ==================================================================== */
function waterMaterial(flow, opts){
  const uni = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uFlow: { value: flow }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: C("#fff") },
    uSky: { value: C("#9cc") }, uDeep: { value: C(opts && opts.deep || "#1d4f55") }, uShallow: { value: C(opts && opts.shallow || "#3f8a84") },
    uFoam: { value: opts && opts.foam || 0 }, uNight: { value: 0 } }]);
  uni.uTime = N.shared.uTime;
  const m = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, fog: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; varying vec3 vWP; #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition; #include <fog_vertex> }`.replace(/#include <fog_pars_vertex>/, "\n#include <fog_pars_vertex>\n").replace(/#include <fog_vertex>/, "\n#include <fog_vertex>\n"),
    fragmentShader: `uniform float uTime, uFlow, uFoam, uNight; uniform vec3 uSunDir, uSunCol, uSky, uDeep, uShallow;
      varying vec2 vUv; varying vec3 vWP;
      #include <fog_pars_fragment>
      float h1(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h1(i), h1(i+vec2(1,0)), f.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), f.x), f.y); }
      void main(){
        float across = abs(vUv.x - 0.5) * 2.0;
        vec3 c = mix(uDeep, uShallow, smoothstep(0.35, 1.0, across));
        vec2 fp = vec2(vUv.x * 4.0, vUv.y * 0.35 - uTime * uFlow);
        float st = vn(fp * vec2(1.0, 3.0)) * 0.6 + vn(fp * vec2(2.3, 7.0) + 3.1) * 0.4;
        vec3 V = normalize(cameraPosition - vWP);
        vec3 nrm = normalize(vec3((st - 0.5) * 0.35, 1.0, (vn(fp * 2.0 + 7.0) - 0.5) * 0.35));
        float fres = pow(1.0 - max(dot(V, nrm), 0.0), 3.0);
        c = mix(c, uSky, fres * 0.55);
        vec3 Hh = normalize(normalize(uSunDir) + V);
        float spec = pow(max(dot(nrm, Hh), 0.0), 90.0) * 1.6;
        c += uSunCol * spec * (1.0 - uNight * 0.6);
        c += vec3(0.9, 0.95, 1.0) * smoothstep(0.62, 0.9, st) * (0.12 + uFoam * 0.6);
        float a = mix(0.82, 0.92, smoothstep(0.0, 0.6, 1.0 - across)) ;
        a *= smoothstep(1.0, 0.86, across);
        gl_FragColor = vec4(c, max(a, uFoam * 0.9));
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`
  });
  return m;
}
function riverMesh(pts, levels, hw){
  const v = [], uv = [], ind = []; let acc = 0;
  const W = hw + 3.2, cols = 6;
  for(let i = 0; i < pts.length; i++){
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if(i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    for(let k = 0; k <= cols; k++){
      const off = (k / cols - 0.5) * 2 * W;
      v.push(pts[i][0] - dz * off, levels[i], pts[i][1] + dx * off); uv.push(k / cols, acc);
    }
    if(i > 0){ const r0 = (i - 1) * (cols + 1), r1 = i * (cols + 1); for(let k = 0; k < cols; k++) ind.push(r0 + k, r1 + k, r0 + k + 1, r0 + k + 1, r1 + k, r1 + k + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind);
  return g;
}
function buildWater(scene){
  world.waterMats = [];
  const rm = waterMaterial(0.55);
  world.waterMats.push(rm);
  for(const [pts, lv, hw] of [[T.R1, T.R1WL, 7.5], [T.R2, T.R2WL, 5.2]]){
    const m = new THREE.Mesh(riverMesh(pts, lv, hw), rm); m.renderOrder = 2; scene.add(m);
  }
  /* lake */
  const lg = new THREE.CircleGeometry(T.LAKE.r + 3, 40); lg.rotateX(-Math.PI / 2);
  const uv = lg.attributes.uv; for(let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * 0.25, uv.getY(i) * 30);
  const lm = waterMaterial(0.02, { deep: "#1a4a54", shallow: "#2f7b7a" }); world.waterMats.push(lm);
  const lake = new THREE.Mesh(lg, lm); lake.position.set(T.LAKE.x, T.LAKE_LEVEL, T.LAKE.z); lake.renderOrder = 2; scene.add(lake);
  /* waterfall cascade draped over the cliff above the lake */
  const fall = [], z0 = T.LAKE.z - T.LAKE.r - 14, z1 = T.LAKE.z - T.LAKE.r + 2;
  for(let z = z0; z <= z1; z += 1) fall.push([T.LAKE.x + Math.sin(z * 0.3) * 0.6, z]);
  const v = [], uvs = [], ind = [], cols = 4, W = 2.6;
  fall.forEach((p, i) => {
    for(let k = 0; k <= cols; k++){ const x = p[0] + (k / cols - 0.5) * 2 * W; v.push(x, Math.max(T.ground(x, p[1]) + 0.35, T.LAKE_LEVEL + 0.05), p[1]); uvs.push(k / cols, i * 0.9); }
    if(i > 0){ const r0 = (i - 1) * (cols + 1), r1 = i * (cols + 1); for(let k = 0; k < cols; k++) ind.push(r0 + k, r1 + k, r0 + k + 1, r0 + k + 1, r1 + k, r1 + k + 1); }
  });
  const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); fg.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); fg.setIndex(ind);
  const fm = waterMaterial(-2.2, { deep: "#6fa9aa", shallow: "#d6eeea", foam: 0.6 }); fm.side = THREE.DoubleSide; world.waterMats.push(fm);
  const fallMesh = new THREE.Mesh(fg, fm); fallMesh.renderOrder = 3; scene.add(fallMesh);
  world.waterfallBase = [T.LAKE.x, T.LAKE_LEVEL + 0.3, z1];
}

/* ====================================================================
   VEGETATION — trees, rocks, grass, flowers (instanced, chunked)
   ==================================================================== */
function treeGeometries(){
  const pine = new G.PartBuilder();
  pine.cyl(0.18, 0.3, 2.4, 6, "#5a3d26", [0, 1.2, 0]);
  pine.add(G.lumpy(new THREE.ConeGeometry(2.0, 3.2, 8), 0.12, 1), "#2f5631", [0, 2.8, 0], null, null, { shadeY: [1.2, 6] });
  pine.add(G.lumpy(new THREE.ConeGeometry(1.55, 2.8, 8), 0.12, 2), "#35603a", [0, 4.2, 0], null, null, { shadeY: [1.2, 6] });
  pine.add(G.lumpy(new THREE.ConeGeometry(1.05, 2.4, 7), 0.1, 3), "#3f6e3e", [0, 5.5, 0]);
  const oak = new G.PartBuilder();
  oak.cyl(0.24, 0.42, 2.8, 6, "#5f4128", [0, 1.4, 0]);
  oak.cyl(0.1, 0.16, 1.6, 5, "#5f4128", [0.5, 2.6, 0.1], [0, 0, -0.7]);
  oak.add(G.lumpy(new THREE.IcosahedronGeometry(2.0, 1), 0.14, 4), "#5d7c32", [0, 3.9, 0], null, [1, 0.85, 1], { shadeY: [2.4, 5.4] });
  oak.add(G.lumpy(new THREE.IcosahedronGeometry(1.55, 1), 0.14, 5), "#6a8a38", [1.25, 3.5, 0.5], null, null, { shadeY: [2.4, 5.4] });
  oak.add(G.lumpy(new THREE.IcosahedronGeometry(1.45, 1), 0.14, 6), "#58772f", [-1.05, 3.6, -0.55], null, null, { shadeY: [2.4, 5.4] });
  oak.add(G.lumpy(new THREE.IcosahedronGeometry(1.25, 1), 0.12, 7), "#739440", [0.2, 5.0, -0.2]);
  return { pine: pine.geometry(), oak: oak.geometry() };
}

function forestDensity(x, z){
  const e = T.superR(x, z);
  if(e > 420) return 0;
  if(T.ground(x, z) > 96) return 0;
  const rd = T.roadDist(x, z); if(rd < 5) return 0;
  const wd = T.riverDist(x, z); if(wd < 9) return 0;
  const sd = T.siteDist(x, z); if(sd < 21) return 0;
  if(Math.hypot(x - T.VILLAGE.x, z - T.VILLAGE.z) < 64) return 0;
  if(Math.hypot(x - 135, z + 145) < 16) return 0;   // chapel
  if(Math.hypot(x - 36, z - 176) < 12) return 0;    // fishing hut
  if(Math.hypot(x - 70, z - 150) < 30) return 0;    // sheep meadow
  const s = T.slope(x, z); if(s > 0.8) return 0;
  const n = T.noise.fbm(x * 0.012 + 100, z * 0.012 - 50, 3);
  let d = smoothstep(-0.12, 0.38, n) * 0.75;
  d += smoothstep(60, -260, x) * 0.28;
  d += (1 - smoothstep(22, 75, Math.hypot(x - 30, z - 10))) * 0.75;      // pine forest at Devi's trail
  d += (1 - smoothstep(22, 60, Math.hypot(x + 40, z + 70))) * 0.55;      // forest around the camp clearing
  d -= (1 - smoothstep(30, 70, Math.hypot(x - 110, z - 80))) * 0.8;      // open test meadow
  d -= (1 - smoothstep(20, 60, Math.hypot(x - 190, z - 40))) * 0.5;      // lookout hill is open
  if(e > 384) d += 0.25;
  for(const [sx, sz, dx, dz] of DEVI_VIEWS) if(T.segDist(x, z, sx, sz, dx, dz) < 13) return 0;
  d *= smoothstep(5, 12, rd);
  return clamp(d, 0, 0.95);
}
function isPine(x, z){
  const dp = Math.hypot(x - 30, z - 10);
  if(dp < 80) return true;
  return T.noise.n2(x * 0.01 + 9, z * 0.01) + smoothstep(80, -220, x) * 1.2 + smoothstep(25, 70, T.ground(x, z)) > 0.55;
}

function buildVegetation(scene){
  const geos = treeGeometries();
  const pines = [], oaks = [], rocks = [], grass = [], flowers = [];
  const step = 7.5;
  for(let x = -440; x < 440; x += step) for(let z = -440; z < 440; z += step){
    const px = x + R.range(-3, 3), pz = z + R.range(-3, 3);
    const d = forestDensity(px, pz);
    if(R() < d){
      const s = R.range(0.75, 1.45), pine = isPine(px, pz);
      const b = R.range(0.82, 1.18), tint = new THREE.Color(b * (1 + R.range(-0.12, 0.1)), b, b * (1 + R.range(-0.15, 0.05)));
      const it = { x: px, y: T.ground(px, pz) - 0.15, z: pz, ry: R() * 6.28, s: [s, s * R.range(0.9, 1.15), s], color: tint };
      (pine ? pines : oaks).push(it);
      if(T.superR(px, pz) < T.PLAY + 2) T.addCollider(px, pz, 0.42 * s, "tree");
    }
  }
  /* special broken/standing trees are added by sites; keep a list for the minimap */
  world.treeCount = pines.length + oaks.length;
  const treeMat = G.patchSway(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.012, 2.0);
  world.trees = new THREE.Group();
  world.trees.add(G.instancedChunks(geos.pine, treeMat, pines, 140, { cast: true }));
  world.trees.add(G.instancedChunks(geos.oak, treeMat, oaks, 140, { cast: true }));
  scene.add(world.trees);

  /* rocks */
  const rockGeo = G.lumpy(new THREE.IcosahedronGeometry(1, 0), 0.25, 11);
  const rg = new G.PartBuilder(); rg.add(rockGeo, "#ffffff"); const rockGeom = rg.geometry();
  for(let i = 0; i < 1500; i++){
    const x = R.range(-430, 430), z = R.range(-430, 430);
    const e = T.superR(x, z), s = T.slope(x, z), rd = T.roadDist(x, z), wd = T.riverDist(x, z);
    let p = 0.12 + smoothstep(0.35, 0.9, s) * 0.6 + (wd < 12 && wd > 4 ? 0.35 : 0) + smoothstep(370, 410, e) * 0.4 + smoothstep(0, -300, x) * 0.2;
    if(rd < 3.5 || T.siteDist(x, z) < 9 || Math.hypot(x - T.VILLAGE.x, z - T.VILLAGE.z) < 40 || T.waterDepth(x, z) > 0.5) continue;
    if(R() > p) continue;
    const sc = R.range(0.35, 1.0) * (R() < 0.15 ? 2.6 : 1) * (e > 390 ? 2.2 : 1);
    const dark = Math.hypot(x + 352, z + 312) < 80;
    const c = new THREE.Color(dark ? "#3a3532" : "#86817a").offsetHSL(0, 0, R.range(-0.08, 0.06));
    rocks.push({ x, y: T.ground(x, z) - sc * 0.25, z, ry: R() * 6.28, rx: R.range(-0.2, 0.2), s: [sc * R.range(0.9, 1.5), sc * R.range(0.6, 0.95), sc * R.range(0.9, 1.4)], color: c });
    if(sc > 1.1 && e < T.PLAY + 2) T.addCollider(x, z, sc * 0.95, "rock");
  }
  world.rocks = G.instancedChunks(rockGeom, G.clayMat, rocks, 160, { cast: true });
  scene.add(world.rocks);

  /* grass tufts: a few thin, slightly leaning blades */
  const blade = new G.PartBuilder();
  for(let k = 0; k < 6; k++){
    const g = new THREE.BufferGeometry(), a = k * 1.05 + 0.3, w = 0.045, hgt = 0.42 + (k % 3) * 0.12, lean = 0.12;
    const cx = Math.cos(a) * 0.09, cz = Math.sin(a) * 0.09, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    g.setAttribute("position", new THREE.Float32BufferAttribute([cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + Math.cos(a) * lean, hgt, cz + Math.sin(a) * lean], 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    blade.add(g, "#ffffff");
  }
  const bg = blade.geometry();
  { const p = bg.attributes.position, cc = bg.attributes.color; for(let i = 0; i < p.count; i++){ const k = 0.62 + p.getY(i) * 0.9; cc.setXYZ(i, k, k * 1.02, k * 0.9); } }
  const grassMat = G.patchSway(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0.12, 0.0);
  const flowerMat = G.patchSway(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.08, 0.0);
  const meadows = [[110, 80, 60], [150, 140, 40], [70, 150, 38], [-200, 0, 40], [220, 150, 40], [-60, 120, 35], [250, 20, 30]];
  let tries = 0;
  while(grass.length < 15000 && tries < 90000){
    tries++;
    let x, z;
    if(R() < 0.55){ const m = R.pick(meadows); const a = R() * 6.28, r = Math.sqrt(R()) * m[2]; x = m[0] + Math.cos(a) * r; z = m[1] + Math.sin(a) * r; }
    else { const t = R() * T.roadIdx.cum[T.roadIdx.cum.length - 1]; const p = T.roadPointAt(t); const a = R() * 6.28, r = R.range(2.6, 22); x = p[0] + Math.cos(a) * r; z = p[1] + Math.sin(a) * r; }
    if(T.roadDist(x, z) < 2.4 || T.waterDepth(x, z) > 0.05 || T.slope(x, z) > 0.7 || T.superR(x, z) > 395) continue;
    if(Math.hypot(x - T.VILLAGE.x, z - T.VILLAGE.z) < 16) continue;
    const c = new THREE.Color().setHSL(0.2 + R.range(-0.04, 0.05), 0.42 + R.range(-0.1, 0.1), 0.42 + R.range(-0.06, 0.08));
    const s = R.range(0.8, 1.35);
    grass.push({ x, y: T.ground(x, z) - 0.04, z, ry: R() * 6.28, s: [s, s * R.range(0.8, 1.3), s], color: c });
    if(R() < 0.16){
      const fc = R.pick(["#f4efe4", "#f2cf4a", "#b98ad6", "#d9534a", "#f0a3b8", "#ffffff"]);
      flowers.push({ x: x + R.range(-0.5, 0.5), y: T.ground(x, z) + 0.36, z: z + R.range(-0.5, 0.5), s: R.range(0.8, 1.3), color: fc });
    }
  }
  for(let i = grass.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [grass[i], grass[j]] = [grass[j], grass[i]]; }
  world.grass = G.instancedChunks(bg, grassMat, grass, 120, { cast: false });
  scene.add(world.grass);
  const fl = new G.PartBuilder(); fl.add(new THREE.IcosahedronGeometry(0.085, 0), "#ffffff"); fl.cyl(0.015, 0.015, 0.36, 3, "#4b6b2a", [0, -0.18, 0]);
  world.flowers = G.instancedChunks(fl.geometry(), flowerMat, flowers, 120, { cast: false });
  scene.add(world.flowers);
}

/* ====================================================================
   VILLAGE — houses (instanced parts with damage states), walls, gate,
   well, notice board with the village mural, fences, haystacks, crowd
   ==================================================================== */
const houses = [];
function buildVillage(scene){
  const V = T.VILLAGE;
  const rv = N.rng(99);
  /* houses on rings east, north and south of the square (west = wall + gate) */
  const towerSpots = [[343, 104], [330, 156]];
  for(const [x, z] of towerSpots) houses.push({ x, z, w: 3.6, d: 3.6, h: 15, up: 0, tower: true });
  let tries = 0;
  while(houses.length < 18 && tries < 800){
    tries++;
    const a = rv.range(-2.3, 2.3), r = rv.range(17, 37);
    const x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r;
    if(x > 345 || x < 290) continue;
    if(T.roadDist(x, z) < 6.5) continue;
    if(houses.some(h => Math.hypot(h.x - x, h.z - z) < (h.tower ? 7 : 9.5))) continue;
    houses.push({ x, z, w: rv.range(5.5, 7.5), d: rv.range(5, 6.5), h: rv.range(2.8, 3.6), up: rv() < 0.65 ? 1 : 0 });
  }
  const parts = { base: [], upper: [], roof: [], balc: [], rail: [], door: [], win: [], chim: [], pyr: [] };
  const stoneCols = ["#9b8f7c", "#8c8270", "#a39680", "#958a76"];
  for(const h of houses){
    h.ry = Math.atan2(V.x - h.x, V.z - h.z) + rv.range(-0.25, 0.25);
    h.g = T.ground(h.x, h.z);
    h.stone = C(rv.pick(stoneCols)); h.wood = C(rv.pick(["#7a5636", "#6e4b2e", "#835d3a"]));
    const top = h.h + (h.up ? 2.2 : 0);
    h.parts = [];
    const P = (type, lp, size, color) => { parts[type].push({ h, lp, size, color }); };
    P("base", [0, (h.h - 2) / 2, 0], [h.w, h.h + 2, h.d], h.stone);
    if(h.up){ P("upper", [0, h.h + 1.1, 0], [h.w * 0.94, 2.2, h.d * 0.94], h.wood);
      P("balc", [0, h.h + 0.02, h.d / 2 + 0.7], [h.w * 0.92, 0.18, 1.4], h.wood);
      P("rail", [0, h.h + 0.5, h.d / 2 + 1.36], [h.w * 0.92, 0.75, 0.1], h.wood); }
    if(h.tower) P("pyr", [0, h.h + 1.2, 0], [h.w * 1.25, 2.4, h.d * 1.25], C("#5e5a55"));
    else P("roof", [0, top + 0.18, 0], [h.w + 1.2, 0.36, h.d + 1.2], C("#5d5853"));
    P("door", [h.w * 0.18, 0.95, h.d / 2 + 0.04], [1.0, 1.9, 0.12], C("#3b2a1c"));
    if(h.tower){ P("win", [0, h.h * 0.55, h.d / 2 + 0.04], [0.5, 0.8, 0.1], C("#251c14")); P("win", [0, h.h * 0.8, h.d / 2 + 0.04], [0.5, 0.8, 0.1], C("#251c14")); }
    else { P("win", [-h.w * 0.28, h.h * 0.6, h.d / 2 + 0.04], [0.7, 0.7, 0.1], C("#251c14"));
      if(h.up) P("win", [h.w * 0.25, h.h + 1.2, h.d * 0.47 + 0.04], [0.7, 0.7, 0.1], C("#251c14"));
      P("chim", [h.w * 0.3, top + 0.9, -h.d * 0.25], [0.65, 1.5, 0.65], h.stone);
      h.chimney = [h.w * 0.3, top + 1.7, -h.d * 0.25]; }
    T.addBoxCollider(h.x, h.z, h.w + 0.4, h.d + 0.4, h.ry, "house");
    if(h.up) T.addBoxCollider(h.x + Math.sin(h.ry) * (h.d / 2 + 0.7), h.z + Math.cos(h.ry) * (h.d / 2 + 0.7), h.w * 0.9, 1.0, h.ry, "house");
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  const pyr = new THREE.ConeGeometry(0.72, 1, 4); pyr.rotateY(Math.PI / 4);
  world.houseParts = {};
  for(const type in parts){
    if(!parts[type].length) continue;
    const isWin = type === "win";
    const mat = isWin ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : G.clayMat.clone();
    if(!isWin) mat.vertexColors = false;
    const im = new THREE.InstancedMesh(type === "pyr" ? pyr : box, mat, parts[type].length);
    im.castShadow = !isWin; im.receiveShadow = true;
    world.houseParts[type] = { mesh: im, list: parts[type] };
    scene.add(im);
  }
  world.setVillageDamage("intact");

  /* chimney smoke */
  for(const h of houses) if(h.chimney){
    const c = Math.cos(h.ry), s = Math.sin(h.ry), l = h.chimney;
    h.smokePos = [h.x + l[0] * c + l[2] * s, h.g + l[1], h.z - l[0] * s + l[2] * c];
    world.smokeEmitters.push({ pos: h.smokePos, rate: 0.9, size: 1.6, rise: 2.2, life: 6, color: [0.8, 0.78, 0.75], alpha: 0.35, kind: "chimney", house: h });
  }

  /* static village props merged into one mesh */
  const B = new G.PartBuilder();
  /* dry-stone wall arc on the west side, with the gate on the road */
  const gate = [298, 110], gr = Math.hypot(gate[0] - V.x, gate[1] - V.z), ga = Math.atan2(gate[1] - V.z, gate[0] - V.x);
  for(let a = ga - 0.95; a < ga + 1.0; a += 0.16){
    if(Math.abs(a - ga) < 0.13) continue;
    const x = V.x + Math.cos(a) * gr, z = V.z + Math.sin(a) * gr, g = T.ground(x, z);
    const hh = 1.0 + rv.range(-0.15, 0.2);
    B.add(G.lumpy(new THREE.BoxGeometry(3.7, hh, 0.9, 3, 1, 1), 0.05, 21), C("#8a8172").offsetHSL(0, 0, rv.range(-0.05, 0.04)), [x, g + hh / 2 - 0.1, z], [0, -a + Math.PI / 2, 0]);
    T.addCollider(x, z, 0.75, "wall"); T.addCollider(x + Math.sin(a) * 1.2, z - Math.cos(a) * 1.2, 0.75, "wall"); T.addCollider(x - Math.sin(a) * 1.2, z + Math.cos(a) * 1.2, 0.75, "wall");
  }
  /* gate pillars + beam */
  const gd = [-Math.sin(ga), Math.cos(ga)];
  const gy = T.ground(gate[0], gate[1]);
  for(const sgn of [-1, 1]){
    const x = gate[0] + gd[0] * 2.9 * sgn, z = gate[1] + gd[1] * 2.9 * sgn;
    B.box(1.2, 3.6, 1.2, "#8f8676", [x, T.ground(x, z) + 1.7, z], [0, -ga, 0]); T.addCollider(x, z, 0.8, "gate");
  }
  B.box(0.5, 0.5, 7.4, "#6e4b2e", [gate[0], gy + 3.7, gate[1]], [0, -ga + Math.PI / 2 + Math.PI / 2, 0]);
  world.gate = { x: gate[0], z: gate[1], out: [Math.cos(ga), Math.sin(ga)] };
  /* well */
  const wx = 314.5, wz = 124.5, wg = T.ground(wx, wz);
  B.cyl(1.15, 1.25, 1.0, 10, "#8d8474", [wx, wg + 0.5, wz]); B.cyl(0.95, 0.95, 0.05, 10, "#1d2a2c", [wx, wg + 0.95, wz]);
  B.box(0.18, 2.4, 0.18, "#6e4b2e", [wx - 1.0, wg + 1.2, wz]); B.box(0.18, 2.4, 0.18, "#6e4b2e", [wx + 1.0, wg + 1.2, wz]);
  B.box(2.4, 0.1, 1.2, "#5d5853", [wx, wg + 2.55, wz - 0.42], [0.55, 0, 0]); B.box(2.4, 0.1, 1.2, "#5d5853", [wx, wg + 2.55, wz + 0.42], [-0.55, 0, 0]);
  B.cyl(0.08, 0.08, 2.0, 6, "#6e4b2e", [wx, wg + 2.0, wz], [0, 0, Math.PI / 2]); B.cyl(0.22, 0.18, 0.35, 8, "#7a5636", [wx, wg + 1.45, wz]);
  T.addCollider(wx, wz, 1.5, "well");
  /* notice board with the village painting */
  const bx = 323, bz = 113.5, bry = Math.atan2(333 - bx, 127 - bz), bg = T.ground(bx, bz);
  const bc = Math.cos(bry), bs = Math.sin(bry);
  const bl = (lx, ly, lz) => [bx + lx * bc + lz * bs, bg + ly, bz - lx * bs + lz * bc];
  B.box(0.22, 3.6, 0.22, "#5f4128", bl(-1.95, 1.8, 0), [0, bry, 0]); B.box(0.22, 3.6, 0.22, "#5f4128", bl(1.95, 1.8, 0), [0, bry, 0]);
  B.box(3.9, 2.25, 0.12, "#6e4b2e", bl(0, 2.15, -0.05), [0, bry, 0]);
  B.box(4.6, 0.12, 0.9, "#5d5853", bl(0, 3.55, 0.05), [0.25, bry, 0]);
  T.addBoxCollider(bx, bz, 4.2, 0.6, bry, "board");
  const tex = new THREE.TextureLoader().load(N.IMG.village); tex.colorSpace = THREE.SRGBColorSpace;
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6 * 572 / 1024), new THREE.MeshLambertMaterial({ map: tex }));
  mural.position.set(...bl(0, 2.15, 0.03)); mural.rotation.y = bry; mural.receiveShadow = true;
  scene.add(mural); world.mural = mural;
  /* fences and haystacks */
  const fence = (ax, az, bx2, bz2) => {
    const L = Math.hypot(bx2 - ax, bz2 - az), n = Math.ceil(L / 2.2), ry = Math.atan2(bx2 - ax, bz2 - az);
    for(let i = 0; i <= n; i++){ const x = lerp(ax, bx2, i / n), z = lerp(az, bz2, i / n); B.box(0.16, 1.2, 0.16, "#6e4b2e", [x, T.ground(x, z) + 0.55, z]); }
    for(let i = 0; i < n; i++){ const x = lerp(ax, bx2, (i + 0.5) / n), z = lerp(az, bz2, (i + 0.5) / n), g = T.ground(x, z);
      B.box(0.08, 0.1, L / n + 0.1, "#7a5636", [x, g + 0.75, z], [0, ry, 0]); B.box(0.08, 0.1, L / n + 0.1, "#7a5636", [x, g + 0.4, z], [0, ry, 0]); }
  };
  fence(300, 140, 312, 152); fence(312, 152, 324, 150); fence(296, 84, 306, 76); fence(306, 76, 318, 78); fence(258, 112, 266, 124);
  for(const [x, z] of [[303, 146], [307, 149], [301, 80], [262, 117], [270, 128]]){
    const g = T.ground(x, z); B.add(G.lumpy(new THREE.SphereGeometry(1.25, 9, 7), 0.08, 31), "#c9a352", [x, g + 0.75, z], null, [1, 1.25, 1]);
    B.cone(0.5, 0.6, 7, "#b08c40", [x, g + 2.15, z]); T.addCollider(x, z, 1.3, "hay");
  }
  /* market stall + benches in the square */
  B.box(2.8, 0.9, 1.1, "#7a5636", [329.5, T.ground(329.5, 111) + 0.45, 111]); B.box(3.2, 0.12, 1.6, "#a8432c", [329.5, T.ground(329.5, 111) + 2.1, 111], [0.15, 0, 0]);
  B.box(0.12, 2.1, 0.12, "#5f4128", [328.1, T.ground(328, 111) + 1.05, 110.3]); B.box(0.12, 2.1, 0.12, "#5f4128", [330.9, T.ground(331, 111) + 1.05, 110.3]);
  T.addBoxCollider(329.5, 111, 3, 1.3, 0, "stall");
  const vm = B.mesh(); vm.name = "village-props"; scene.add(vm);

  /* ambient crowd of simple clay villagers */
  const vgeos = [];
  for(let v = 0; v < 3; v++){
    const P = new G.PartBuilder(), cloth = ["#7c3a2a", "#3d5a6e", "#6b5a2e"][v], skin = "#d8a77d";
    P.add(G.lumpy(new THREE.CylinderGeometry(0.26, 0.4, 1.15, 8), 0.06, 40 + v), cloth, [0, 0.58, 0]);
    P.sphere(0.24, skin, [0, 1.36, 0], 1, 1);
    if(v === 0) P.add(new THREE.CylinderGeometry(0.2, 0.26, 0.22, 8), "#2a2018", [0, 1.56, 0]);
    if(v === 1) P.sphere(0.27, "#e4dccb", [0, 1.42, -0.04], [1, 0.9, 1.05], 1);
    if(v === 2) P.add(new THREE.ConeGeometry(0.28, 0.32, 8), "#4a3b28", [0, 1.62, 0]);
    P.cyl(0.07, 0.07, 0.62, 5, cloth, [0.33, 0.85, 0], [0, 0, 0.25]); P.cyl(0.07, 0.07, 0.62, 5, cloth, [-0.33, 0.85, 0], [0, 0, -0.25]);
    vgeos.push(P.geometry());
  }
  const crowd = [[], [], []];
  const spots = [];
  for(let i = 0; i < 11; i++){
    const a = rv.range(-1.2, 1.7), r = rv.range(8, 14);
    const x = 320 + Math.cos(a) * r, z = 120 + Math.sin(a) * r;
    if(Math.hypot(x - 314.5, z - 124.5) < 2.4 || Math.hypot(x - 323, z - 113.5) < 2.2 || Math.hypot(x - 329.5, z - 111) < 2.2) continue;
    spots.push([x, z]);
  }
  spots.push([300, 128], [306, 96], [334, 140], [340, 118]);
  spots.forEach(([x, z], i) => {
    const s = rv.range(0.92, 1.08);
    crowd[i % 3].push({ x, y: T.ground(x, z), z, ry: Math.atan2(321 - x, 119 - z) + rv.range(-0.5, 0.5), s: [s, s, s] });
    T.addCollider(x, z, 0.45, "villager");
  });
  const vmat = G.patchSway(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.02, 0.4);
  world.villagers = new THREE.Group();
  crowd.forEach((list, v) => world.villagers.add(G.instancedChunks(vgeos[v], vmat, list, 400, { cast: true })));
  scene.add(world.villagers);
}

/* damage states of the village for the final tableau (§11) */
world.setVillageDamage = function(level){
  const hp = world.houseParts; if(!hp) return;
  const rv = N.rng(5);
  const dmg = houses.map(() => rv());
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  const winNight = world._winGlow || 0;
  for(const type in hp){
    const { mesh, list } = hp[type];
    list.forEach((p, i) => {
      const h = p.h, k = dmg[houses.indexOf(h)];
      let hide = false, hScale = 1, burnt = 0;
      if(level === "minor"){ if(type === "roof" && k < 0.15) hide = true; }
      if(level === "heavy"){ if((type === "roof" || type === "upper" || type === "balc" || type === "rail" || type === "pyr") && k < 0.6) hide = true; if(type === "base" && k < 0.3) hScale = 0.6; burnt = 0.25; }
      if(level === "ruins" || level === "burnt"){
        if(type !== "base" && type !== "door") hide = true;
        if(type === "base") hScale = 0.35 + k * 0.3;
        if(type === "door" && k < 0.5) hide = true;
        burnt = level === "burnt" ? 0.8 : 0.45;
      }
      const lp = p.lp.slice(), size = p.size.slice();
      if(type === "base"){ const full = size[1]; size[1] = (full - 2) * hScale + 2; lp[1] = (size[1] - 4) / 2 + 0; }
      if(type === "door" && hScale < 1) lp[1] = Math.min(lp[1], 0.9);
      const c = Math.cos(h.ry), s = Math.sin(h.ry);
      ps.set(h.x + lp[0] * c + lp[2] * s, h.g + lp[1], h.z - lp[0] * s + lp[2] * c);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.ry);
      if(hide) sc.set(0.0001, 0.0001, 0.0001); else sc.set(size[0], size[1], size[2]);
      m4.compose(ps, q, sc); mesh.setMatrixAt(i, m4);
      if(type === "win") col.set(0x251c14).lerp(new THREE.Color(0xffb35a), level === "intact" || level === "minor" ? winNight : 0);
      else col.copy(p.color).lerp(new THREE.Color(0x1a1512), burnt);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true; if(mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  world.damage = level;
  /* smoke columns over damaged houses */
  world.smokeEmitters = world.smokeEmitters.filter(e => e.kind !== "ruin");
  const n = { intact: 0, minor: 1, heavy: 4, ruins: 6, burnt: 9 }[level] || 0;
  for(let i = 0; i < n; i++){
    const h = houses[(i * 5 + 2) % houses.length];
    world.smokeEmitters.push({ pos: [h.x, h.g + 2.5, h.z], rate: level === "minor" ? 1.2 : 2.4, size: level === "minor" ? 2.2 : 3.6, rise: 3.5, life: 9,
      color: level === "burnt" ? [0.18, 0.15, 0.14] : [0.45, 0.42, 0.4], alpha: level === "minor" ? 0.3 : 0.55, kind: "ruin", embers: level === "burnt" || level === "ruins" });
  }
  for(const e of world.smokeEmitters) if(e.kind === "chimney") e.off = level !== "intact" && level !== "minor";
  if(world.villagers) world.villagers.visible = level === "intact" || level === "minor";
};

/* ====================================================================
   SITES — props for each of the ten crossroads (team/solo variants)
   ==================================================================== */
function addFire(scene, pos, scale, opts){
  const g = new THREE.Group();
  const fm = new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false });
  const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.25, 7), fm); f1.position.y = 0.62;
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.9, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); f2.position.y = 0.5;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: world.glowTex, color: 0xff8a3a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(4.2, 4.2, 1); glow.position.y = 0.8;
  const B = new G.PartBuilder();
  for(let i = 0; i < 8; i++){ const a = i / 8 * 6.28; B.sphere(0.24, "#6d665e", [Math.cos(a) * 0.75, 0.08, Math.sin(a) * 0.75], [1.2, 0.7, 1], 0); }
  B.cyl(0.08, 0.1, 1.2, 5, "#4a3020", [0, 0.18, 0], [0, 0.5, Math.PI / 2 - 0.15]); B.cyl(0.08, 0.1, 1.2, 5, "#4a3020", [0, 0.2, 0], [0, -0.7, Math.PI / 2 + 0.2]);
  const base = B.mesh(); g.add(base);
  if(!(opts && opts.cold)){ g.add(f1, f2, glow); }
  g.position.set(pos[0], pos[1], pos[2]); g.scale.setScalar(scale || 1);
  scene.add(g);
  const fire = { group: g, f1, f2, glow, pos: new THREE.Vector3(pos[0], pos[1] + 0.8, pos[2]), cold: !!(opts && opts.cold), active: true };
  if(!fire.cold){ world.fires.push(fire); world.smokeEmitters.push({ pos: [pos[0], pos[1] + 1.4, pos[2]], rate: 1.6, size: 1.1, rise: 2.4, life: 4, color: [0.6, 0.58, 0.55], alpha: 0.28, kind: "fire", fire, embers: true }); }
  T.addCollider(pos[0], pos[2], 0.9 * (scale || 1), "fire");
  return fire;
}
function figure(cloth, skin, hat){
  const P = new G.PartBuilder();
  P.add(G.lumpy(new THREE.CylinderGeometry(0.3, 0.46, 1.2, 9), 0.07, 52), cloth, [0, 0.6, 0]);
  P.add(G.lumpy(new THREE.CylinderGeometry(0.2, 0.3, 0.35, 8), 0.06, 53), "#5a3b26", [0, 1.12, 0]);
  P.sphere(0.27, skin, [0, 1.48, 0], 1, 1);
  P.sphere(0.12, "#3a2a1c", [0, 1.32, 0.18], [1.4, 0.7, 0.8], 0);       // beard
  if(hat) P.add(new THREE.ConeGeometry(0.33, 0.55, 9), hat, [0, 1.82, 0]);
  P.cyl(0.08, 0.08, 0.7, 5, cloth, [0.38, 0.9, 0.08], [0.3, 0, 0.3]); P.cyl(0.08, 0.08, 0.7, 5, cloth, [-0.38, 0.9, 0.08], [0.3, 0, -0.3]);
  return P;
}

function buildSites(scene){
  world.glowTex = G.glowTex();
  const F = world.frames;
  const variant = (site) => { world.variants[site] = { team: new THREE.Group(), solo: new THREE.Group() }; scene.add(world.variants[site].team, world.variants[site].solo); return world.variants[site]; };

  /* ---- 2: the great oak with three fanning paths ---- */
  {
    const f = F[2], o = f.at3(1, 9), B = new G.PartBuilder();
    B.add(G.lumpy(new THREE.CylinderGeometry(0.8, 1.5, 5.5, 9), 0.1, 61), "#5a3d26", [o[0], o[1] + 2.6, o[2]]);
    for(const [a, l, y] of [[0.4, 3.6, 4.6], [2.3, 3.2, 5.0], [4.1, 3.4, 4.4], [5.4, 2.6, 5.4]])
      B.cyl(0.25, 0.5, l, 6, "#5a3d26", [o[0] + Math.cos(a) * 1.4, o[1] + y + 0.5, o[2] + Math.sin(a) * 1.4], [Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8]);
    for(const [dx, dy, dz, r, cc] of [[0, 8.2, 0, 4.2, "#56772f"], [3.2, 7.2, 1.2, 3.2, "#62843a"], [-3.0, 7.4, -1.0, 3.3, "#4f6e2c"], [0.8, 9.8, -1.5, 2.8, "#6a8e3e"], [-1.5, 7.0, 2.8, 2.8, "#5c7c34"], [1.5, 6.8, -3.0, 2.6, "#58772f"]])
      B.add(G.lumpy(new THREE.IcosahedronGeometry(r, 1), 0.13, 62 + dx), cc, [o[0] + dx, o[1] + dy, o[2] + dz], null, [1, 0.8, 1], { shadeY: [o[1] + 4, o[1] + 11] });
    for(let i = 0; i < 7; i++){ const a = i * 0.9; B.cyl(0.18, 0.35, 2.4, 5, "#5a3d26", [o[0] + Math.cos(a) * 1.6, o[1] + 0.1, o[2] + Math.sin(a) * 1.6], [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2]); }
    const oak = B.mesh(G.patchSway(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.004, o[1] + 5));
    scene.add(oak); T.addCollider(o[0], o[2], 1.7, "oak");
    world.oakPos = o;
    /* three worn paths fanning out from the oak (mountain / garden / main road) */
    for(const [ex, ez] of [[-26, 30], [24, 26], [0, 34]]){
      const pts = []; for(let k = 0; k <= 14; k++){ const t = k / 14; const p = f.at(lerp(0, ex, t) + Math.sin(t * 3) * 2, lerp(3, ez, t)); pts.push(p); }
      scene.add(ribbon(pts, [[-1.1, 0, 0], [-0.4, 0.7, 0.4], [0.4, 0.7, 0.4], [1.1, 0, 0]], "#9a7c52", "#7d6141", 0.05));
    }
    /* companions' props: bow (hunter), herb basket (elder woman), trap cart (blacksmith's boy) */
    const P = new G.PartBuilder();
    const bowP = f.at3(-5.6, 6.4);
    P.torus(0.75, 0.05, "#6e4b2e", [bowP[0], bowP[1] + 0.9, bowP[2]], [0, f.yaw, 0], Math.PI * 0.9);
    P.cyl(0.015, 0.015, 1.5, 3, "#e8dcc0", [bowP[0], bowP[1] + 0.9, bowP[2]], [0, f.yaw, 0]);
    const bk = f.at3(4.4, 7.4);
    P.cyl(0.42, 0.32, 0.45, 10, "#a8804a", [bk[0], bk[1] + 0.22, bk[2]]); P.torus(0.4, 0.04, "#8a6a3a", [bk[0], bk[1] + 0.6, bk[2]], [0, 0, 0], Math.PI);
    for(let i = 0; i < 6; i++) P.sphere(0.15, i % 2 ? "#5d8a3a" : "#7aa64a", [bk[0] + Math.cos(i) * 0.22, bk[1] + 0.5, bk[2] + Math.sin(i) * 0.22], [1, 0.7, 1], 0);
    const ct = f.at3(8.6, 4.4), cry = f.yaw + 0.5;
    P.box(1.6, 0.5, 1.0, "#7a5636", [ct[0], ct[1] + 0.65, ct[2]], [0, cry, 0]);
    P.cyl(0.42, 0.42, 0.12, 10, "#4a3020", [ct[0] + Math.cos(cry) * 0.6, ct[1] + 0.42, ct[2] - Math.sin(cry) * 0.6], [Math.PI / 2, cry, 0]);
    P.cyl(0.42, 0.42, 0.12, 10, "#4a3020", [ct[0] - Math.cos(cry) * 0.6, ct[1] + 0.42, ct[2] + Math.sin(cry) * 0.6], [Math.PI / 2, cry, 0]);
    P.torus(0.45, 0.07, "#4b4b4f", [ct[0], ct[1] + 1.1, ct[2]], [0, cry, 0], Math.PI);
    T.addCollider(ct[0], ct[2], 1.0, "cart");
    scene.add(P.mesh());
    world.oakSpots = { hunter: f.at(-4.2, 5.4), elderwoman: f.at(3.2, 6.0), blacksmith: f.at(7.0, 2.6) };
  }

  /* ---- 3: lookout hill — stone lookout + wooden rail ---- */
  {
    const f = F[3], B = new G.PartBuilder(), t = f.at3(5.5, 6);
    B.add(G.lumpy(new THREE.CylinderGeometry(2.1, 2.5, 3.6, 12, 2), 0.05, 71), "#8f8676", [t[0], t[1] + 1.6, t[2]]);
    for(let i = 0; i < 8; i++){ const a = i / 8 * 6.28; B.box(0.7, 0.6, 0.6, "#8a8172", [t[0] + Math.cos(a) * 2.0, t[1] + 3.7, t[2] + Math.sin(a) * 2.0], [0, -a, 0]); }
    T.addCollider(t[0], t[2], 2.6, "tower");
    for(let k = -7; k <= 3; k += 1.4){
      const p = f.at3(k, 10.5); B.box(0.16, 1.2, 0.16, "#6e4b2e", [p[0], p[1] + 0.55, p[2]]);
      if(k < 3){ const q = f.at3(k + 0.7, 10.5); B.box(1.5, 0.1, 0.1, "#7a5636", [q[0], q[1] + 1.05, q[2]], [0, f.yaw + Math.PI / 2, 0]); }
    }
    scene.add(B.mesh());
  }

  /* ---- 4: test meadow — half-sprung trap, torn net, scuffed grass ---- */
  {
    const f = F[4], B = new G.PartBuilder(), c = f.at3(2.5, 6.5);
    B.box(3.0, 0.2, 0.2, "#6e4b2e", [c[0], c[1] + 0.1, c[2]], [0, f.yaw, 0]);
    B.box(0.18, 2.2, 0.18, "#6e4b2e", [c[0] + f.lx * 1.4, c[1] + 1.0, c[2] + f.lz * 1.4], [0, f.yaw, 0.15]);
    B.box(0.18, 2.2, 0.18, "#6e4b2e", [c[0] - f.lx * 1.4, c[1] + 1.0, c[2] - f.lz * 1.4], [0, f.yaw, -0.15]);
    B.box(3.2, 0.18, 0.18, "#7a5636", [c[0], c[1] + 2.05, c[2]], [0, f.yaw + Math.PI / 2, 0.0]);
    B.box(3.0, 0.16, 0.16, "#7a5636", [c[0] + f.bx * 0.9, c[1] + 0.55, c[2] + f.bz * 0.9], [0, f.yaw + Math.PI / 2, 0.5]);
    B.box(0.12, 1.6, 0.12, "#5a3d26", [c[0] + f.bx * 1.3, c[1] + 0.5, c[2] + f.bz * 1.3], [0.9, f.yaw, 0]);
    B.sphere(0.25, "#b88a4a", [c[0] - f.bx * 0.4, c[1] + 0.2, c[2] - f.bz * 0.4], [1.3, 0.6, 1], 0);
    for(let i = 0; i < 6; i++){ const q = f.at3(R.range(-5, 6), R.range(2, 10)); B.add(new THREE.CylinderGeometry(1, 1, 0.04, 9), "#5e5236", [q[0], q[1] + 0.02, q[2]], null, [R.range(0.6, 1.4), 1, R.range(0.4, 0.9)]); }
    scene.add(B.mesh()); T.addCollider(c[0], c[2], 1.5, "trap");
    const net = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.2), new THREE.MeshLambertMaterial({ map: G.netTex(), alphaTest: 0.5, side: THREE.DoubleSide, transparent: false }));
    net.position.set(c[0] - f.bx * 0.6, c[1] + 1.0, c[2] - f.bz * 0.6); net.rotation.set(0, f.yaw, 0); net.rotateX(-0.35);
    net.castShadow = true; scene.add(net);
  }

  /* ---- 5: Devi's trail — giant footprints, broken trees, crossed-out plans ---- */
  {
    const f = F[5], B = new G.PartBuilder();
    for(let i = 0; i < 9; i++){
      const lx = -16 + i * 3.6, lz = 10 + i * 2.6 + (i % 2) * 1.6;
      const q = f.at3(lx, lz), ry = f.yaw + 1.1;
      B.add(new THREE.CylinderGeometry(1, 1, 0.05, 12), "#3d3324", [q[0], q[1] + 0.03, q[2]], [0, ry, 0], [0.75, 1, 1.4]);
      for(let t = 0; t < 5; t++){ const a = ry + (t - 2) * 0.3; B.add(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 7), "#3d3324", [q[0] + Math.sin(a) * 1.75, q[1] + 0.035, q[2] + Math.cos(a) * 1.75]); }
    }
    for(const [lx, lz, tilt] of [[9, 8, 1.1], [-10, 13, -1.25], [13, 16, 0.9]]){
      const q = f.at3(lx, lz);
      B.cyl(0.32, 0.38, 1.4, 7, "#5a3d26", [q[0], q[1] + 0.7, q[2]]);
      B.add(G.lumpy(new THREE.CylinderGeometry(0.22, 0.32, 5.5, 7), 0.06, 81), "#5a3d26", [q[0] + Math.sin(tilt) * 2.6, q[1] + 1.4 + Math.cos(Math.abs(tilt)) * 1.2, q[2] + Math.cos(tilt) * 0.6], [0, 0, tilt]);
      T.addCollider(q[0], q[2], 0.5, "stump");
    }
    const bp = f.at3(-4.5, 7.2);
    B.box(0.14, 1.7, 0.14, "#5f4128", [bp[0] - f.lx * 1.2, bp[1] + 0.85, bp[2] - f.lz * 1.2]); B.box(0.14, 1.7, 0.14, "#5f4128", [bp[0] + f.lx * 1.2, bp[1] + 0.85, bp[2] + f.lz * 1.2]);
    scene.add(B.mesh());
    const plan = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.7), new THREE.MeshLambertMaterial({ map: G.planTex(), side: THREE.DoubleSide }));
    plan.position.set(bp[0], bp[1] + 1.35, bp[2]); plan.rotation.y = f.yaw + Math.PI; plan.rotateX(-0.08); plan.castShadow = true; scene.add(plan);
    const p2 = plan.clone(); const bp2 = f.at3(-7.5, 9.5); p2.position.set(bp2[0], bp2[1] + 0.25, bp2[2]); p2.rotation.set(-1.35, f.yaw + 2.6, 0); scene.add(p2);
  }

  /* ---- 6: travel camp at the ford ---- */
  {
    const f = F[6], v = variant(6);
    const Bt = new G.PartBuilder();
    const ct = f.at3(-5, 6.5), cry = f.yaw + 0.3;
    Bt.box(2.4, 0.6, 1.3, "#7a5636", [ct[0], ct[1] + 0.9, ct[2]], [0, cry, 0]);
    Bt.box(2.4, 0.5, 0.1, "#6e4b2e", [ct[0] + Math.sin(cry) * 0.6, ct[1] + 1.4, ct[2] + Math.cos(cry) * 0.6], [0, cry, 0]);
    for(const s of [-1, 1]) Bt.cyl(0.55, 0.55, 0.14, 12, "#4a3020", [ct[0] + Math.cos(cry) * 0.9 * s, ct[1] + 0.55, ct[2] - Math.sin(cry) * 0.9 * s], [Math.PI / 2, cry + Math.PI / 2, 0]);
    Bt.box(0.1, 0.1, 2.0, "#5a3d26", [ct[0] + Math.sin(cry) * 1.4, ct[1] + 0.7, ct[2] + Math.cos(cry) * 1.4], [0, cry + Math.PI / 2, 0]);
    for(let i = 0; i < 5; i++) Bt.box(0.5, 0.4, 0.4, R.pick(["#b08c40", "#8a6a3a", "#9c7a4a"]), [ct[0] + R.range(-0.8, 0.8), ct[1] + 1.35, ct[2] + R.range(-0.4, 0.4)], [0, R() * 3, 0]);
    const tp = f.at3(2, 7.5);
    Bt.torus(1.1, 0.12, "#4b4b4f", [tp[0], tp[1] + 0.35, tp[2]], [Math.PI / 2 - 0.5, 0, 0], Math.PI);
    Bt.torus(1.1, 0.12, "#4b4b4f", [tp[0], tp[1] + 0.35, tp[2]], [Math.PI / 2 + 0.5, 0, 0], Math.PI);
    for(let i = 0; i < 9; i++){ const a = i / 8 * Math.PI; Bt.cone(0.09, 0.32, 4, "#6a6a6e", [tp[0] + Math.cos(a) * 1.1, tp[1] + 0.35 + Math.sin(a) * 0.5, tp[2]]); }
    Bt.box(2.6, 0.08, 0.5, "#3e3e42", [tp[0], tp[1] + 0.06, tp[2]]);
    const rc = f.at3(7, 3);
    for(let i = 0; i < 9; i++){ const a = i / 9 * 6.28; Bt.add(G.lumpy(new THREE.BoxGeometry(0.5, 1.0, 0.4), 0.1, 90 + i), "#8f8a80", [rc[0] + Math.cos(a) * 2.1, rc[1] + 0.45, rc[2] + Math.sin(a) * 2.1], [0, -a, 0]); }
    Bt.add(new THREE.CylinderGeometry(1.2, 1.2, 0.04, 14), "#3b332b", [rc[0], rc[1] + 0.02, rc[2]]);
    const mt = Bt.mesh(); v.team.add(mt);
    v.team.userData.colliders = [[ct[0], ct[2], 1.5], [tp[0], tp[2], 1.3]];
    /* solo: backpack emptied in front of a campfire */
    const Bs = new G.PartBuilder(), fp = f.at3(0, 5.2);
    const bpk = f.at3(-1.6, 6.4);
    Bs.add(G.lumpy(new THREE.BoxGeometry(0.75, 0.9, 0.45), 0.08, 95), "#7a5a34", [bpk[0], bpk[1] + 0.45, bpk[2]], [0, f.yaw, 0.2]);
    Bs.box(0.78, 0.12, 0.5, "#6a4a2a", [bpk[0], bpk[1] + 0.92, bpk[2] - 0.1], [0.4, f.yaw, 0.2]);
    const items = [["rope", -2.6, 4.4], ["axe", 1.8, 6.6], ["trap", 2.4, 4.2], ["trap", -0.6, 7.8], ["bread", -2.4, 5.6], ["amulet", 1.0, 7.4]];
    for(const [k, lx, lz] of items){
      const q = f.at3(lx, lz);
      if(k === "rope"){ Bs.torus(0.32, 0.07, "#c2a46a", [q[0], q[1] + 0.07, q[2]], [Math.PI / 2, 0, 0]); Bs.torus(0.22, 0.07, "#c2a46a", [q[0], q[1] + 0.17, q[2]], [Math.PI / 2, 0, 0]); }
      if(k === "axe"){ Bs.cyl(0.04, 0.05, 1.0, 5, "#6e4b2e", [q[0], q[1] + 0.06, q[2]], [Math.PI / 2, f.yaw, 0]); Bs.box(0.12, 0.3, 0.25, "#6a6a70", [q[0], q[1] + 0.1, q[2] + 0.45], [0, f.yaw, 0]); }
      if(k === "trap"){ Bs.torus(0.35, 0.05, "#55555a", [q[0], q[1] + 0.06, q[2]], [Math.PI / 2, 0, 0]); for(let i = 0; i < 6; i++) Bs.cone(0.04, 0.14, 4, "#6a6a6e", [q[0] + Math.cos(i) * 0.33, q[1] + 0.12, q[2] + Math.sin(i) * 0.33]); }
      if(k === "bread") Bs.sphere(0.25, "#c08a44", [q[0], q[1] + 0.12, q[2]], [1.4, 0.6, 0.9], 1);
      if(k === "amulet"){ Bs.torus(0.14, 0.025, "#d4a84a", [q[0], q[1] + 0.03, q[2]], [Math.PI / 2, 0, 0]); Bs.sphere(0.06, "#3a7ab8", [q[0], q[1] + 0.05, q[2]], 1, 0); }
    }
    v.solo.add(Bs.mesh());
    const fire6 = addFire(v.solo, fp, 1); fire6.variantOf = 6;
    world.fireSpots = world.fireSpots || {}; world.fireSpots[6] = fp;
  }

  /* ---- 7: merchant's tent by the stone bridge ---- */
  {
    const f = F[7], B = new G.PartBuilder(), tp = f.at3(-6, 7.5);
    const cone = new THREE.ConeGeometry(3.2, 4.4, 14, 1, true).toNonIndexed();
    const cc = new Float32Array(cone.attributes.position.count * 3), a1 = C("#a8432c"), a2 = C("#e9dcbc");
    for(let i = 0; i < cone.attributes.position.count; i += 3){ const s = Math.floor(i / 3) % 2 ? a1 : a2; for(let k = 0; k < 3; k++){ cc[(i + k) * 3] = s.r; cc[(i + k) * 3 + 1] = s.g; cc[(i + k) * 3 + 2] = s.b; } }
    cone.translate(tp[0], tp[1] + 2.2, tp[2]); cone.setAttribute("color", new THREE.BufferAttribute(cc, 3)); cone.computeVertexNormals();
    B.parts.push(cone);
    B.cyl(0.08, 0.08, 5.2, 5, "#5f4128", [tp[0], tp[1] + 2.6, tp[2]]); B.cone(0.25, 0.5, 6, "#d4a84a", [tp[0], tp[1] + 5.3, tp[2]]);
    B.box(1.6, 2.2, 0.05, "#3a2416", [tp[0] - f.bx * 2.7, tp[1] + 1.1, tp[2] - f.bz * 2.7], [0, f.yaw, 0]);
    T.addCollider(tp[0], tp[2], 3.2, "tent");
    const cratesAt = [[-1.4, 6.4, 0.9], [-2.6, 8.6, 1.0], [-1.2, 8.4, 0.7]];
    for(const [lx, lz, s] of cratesAt){ const q = f.at3(lx, lz); B.add(G.lumpy(new THREE.BoxGeometry(s, s * 0.8, s), 0.03, 97), "#8a6a3a", [q[0], q[1] + s * 0.4, q[2]], [0, R() * 3, 0]); T.addCollider(q[0], q[2], s * 0.7, "crate"); }
    const q0 = f.at3(-1.4, 6.4);
    world.vials = [];
    for(let i = 0; i < 5; i++){ const vc = ["#5ad1a0", "#d65ad1", "#e8c23a", "#5a8ad6", "#d6553a"][i]; B.cyl(0.07, 0.09, 0.28, 6, vc, [q0[0] + (i - 2) * 0.17, q0[1] + 0.86, q0[2] + (i % 2) * 0.15]); }
    const fig = figure("#6b2f5a", "#d8a77d", "#3a5a8a"); const mp = f.at3(-2.4, 4.6);
    const mg = fig.geometry(); const merchant = new THREE.Mesh(mg, G.patchSway(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.03, 0.3));
    merchant.position.set(mp[0], mp[1], mp[2]); merchant.rotation.y = Math.atan2(f.x - mp[0], f.z - mp[2]); merchant.castShadow = true; merchant.scale.setScalar(1.05);
    scene.add(merchant); world.merchant = merchant; T.addCollider(mp[0], mp[2], 0.55, "merchant");
    scene.add(B.mesh());
  }

  /* ---- 8: foothill camp ---- */
  {
    const f = F[8], v = variant(8), fp = f.at3(0, 6.5);
    const Bt = new G.PartBuilder();
    for(let i = 0; i < 6; i++){ const a = i / 6 * 6.28 + 0.3; const q = [fp[0] + Math.cos(a) * 2.9, 0, fp[2] + Math.sin(a) * 2.9]; Bt.cyl(0.4, 0.45, 0.5, 9, "#6e4b2e", [q[0], T.ground(q[0], q[2]) + 0.25, q[2]]); Bt.cyl(0.38, 0.38, 0.02, 9, "#c8a878", [q[0], T.ground(q[0], q[2]) + 0.51, q[2]]); }
    const fc = f.at3(6.5, 5.5), cry = f.yaw - 0.4;
    Bt.box(2.2, 0.5, 1.2, "#7a5636", [fc[0], fc[1] + 0.85, fc[2]], [0, cry, 0]);
    for(const s of [-1, 1]) Bt.cyl(0.5, 0.5, 0.14, 12, "#4a3020", [fc[0] + Math.cos(cry) * 0.8 * s, fc[1] + 0.5, fc[2] - Math.sin(cry) * 0.8 * s], [Math.PI / 2, cry + Math.PI / 2, 0]);
    Bt.box(0.7, 0.35, 0.35, "#3e3e44", [fc[0], fc[1] + 1.3, fc[2]], [0, cry, 0]); Bt.box(0.3, 0.3, 0.3, "#3e3e44", [fc[0], fc[1] + 1.12, fc[2]]);
    Bt.cyl(0.35, 0.3, 0.35, 8, "#2a2420", [fc[0] - Math.cos(cry) * 0.7, fc[1] + 1.25, fc[2] + Math.sin(cry) * 0.7]);
    v.team.add(Bt.mesh());
    v.team.userData.colliders = [[fc[0], fc[2], 1.4]];
    const coal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff6a2a }));
    coal.position.set(fc[0] - Math.cos(cry) * 0.7, fc[1] + 1.45, fc[2] + Math.sin(cry) * 0.7); v.team.add(coal);
    addFire(v.team, fp, 1.2).variantOf = 8;
    const Bs = new G.PartBuilder(); const st = f.at3(2.6, 7.8);
    Bs.cyl(0.4, 0.45, 0.5, 9, "#6e4b2e", [st[0], st[1] + 0.25, st[2]]);
    v.solo.add(Bs.mesh()); addFire(v.solo, fp, 1, { cold: true });
    world.fireSpots[8] = fp;
  }

  /* ---- 9: night campfire on the rock terrace + a lit window far below ---- */
  {
    const f = F[9], fp = f.at3(0, 4.5);
    addFire(scene, fp, 1);
    const B = new G.PartBuilder();
    for(let i = 0; i < 10; i++){ const a = i / 10 * 6.28; const q = f.at3(Math.cos(a) * 12, 3 + Math.sin(a) * 10); if(Math.abs(Math.cos(a)) < 0.5 && Math.sin(a) < 0) continue;
      const s = R.range(0.8, 1.7); B.add(G.lumpy(new THREE.IcosahedronGeometry(s, 0), 0.2, 110 + i), "#7a746c", [q[0], q[1] + s * 0.3, q[2]], null, [1.3, 0.8, 1.1]); T.addCollider(q[0], q[2], s, "rock"); }
    const lg = f.at3(-5.5, 6.2); B.cyl(0.55, 0.6, 0.45, 9, "#6e4b2e", [lg[0], lg[1] + 0.22, lg[2]]);
    scene.add(B.mesh());
    world.fireSpots[9] = fp;
    /* shepherd's hut with a lantern-lit window, down in the valley */
    const hx = -232, hz = -160, hg = T.ground(hx, hz), H = new G.PartBuilder();
    H.box(4, 2.6, 3.4, "#8f8676", [hx, hg + 1.1, hz]); H.box(4.6, 0.3, 4.0, "#5d5853", [hx, hg + 2.5, hz]);
    scene.add(H.mesh()); T.addBoxCollider(hx, hz, 4.4, 3.8, 0, "hut");
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ color: 0xffb35a }));
    win.position.set(hx + 2.02, hg + 1.4, hz); win.rotation.y = Math.PI / 2; scene.add(win);
    const wg = new THREE.Sprite(new THREE.SpriteMaterial({ map: world.glowTex, color: 0xffa040, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
    wg.scale.set(5, 5, 1); wg.position.copy(win.position); scene.add(wg);
    world.lanternWindow = { win, glow: wg };
  }

  /* ---- 10: Devi's cave — black cliffs, an alcove with the cave mouth, signal stone ---- */
  {
    const f = F[10], C = T.CAVE, B = new G.PartBuilder();
    const back = [C.backX, C.backZ], bg = T.ground(C.x, C.z);
    /* dark cave interior: a half-dome seen from inside, set into the back wall */
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 20, 10, 0, Math.PI, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x030202, side: THREE.BackSide, fog: false }));
    dome.scale.set(1, 1.55, 1.1);
    dome.position.set(back[0], bg - 0.2, back[1]); dome.rotation.y = f.yaw;
    scene.add(dome);
    for(let i = 0; i <= 12; i++){
      const a = Math.PI * i / 12, lx = -Math.cos(a) * 5.6, ly = Math.sin(a) * 7.6;
      const q = [back[0] + f.lx * lx - f.bx * 0.6, bg + ly - 0.2, back[1] + f.lz * lx - f.bz * 0.6];
      const sz = R.range(1.1, 1.9); B.add(G.lumpy(new THREE.IcosahedronGeometry(sz, 0), 0.2, 120 + i), "#2a2624", q, null, [1.1, 1, 1.2]);
    }
    for(let i = 0; i < 9; i++){ const q = f.at3(R.range(-3.5, 3.5) * (i % 2 ? 1 : -1), R.range(6, 18)); const sz = R.range(0.4, 0.9);
      if(Math.hypot(q[0] - C.x, q[2] - C.z) < 2.5) continue;
      B.add(G.lumpy(new THREE.IcosahedronGeometry(sz, 0), 0.2, 200 + i), "#35302c", [q[0], q[1] + sz * 0.3, q[2]], null, [1.2, 0.7, 1]); }
    const ss = f.at3(4.5, 3);
    B.add(G.lumpy(new THREE.BoxGeometry(1.2, 3.4, 0.8, 1, 3, 1), 0.08, 150), "#4a4440", [ss[0], ss[1] + 1.5, ss[2]], [0, f.yaw + 0.4, 0.06]);
    T.addCollider(ss[0], ss[2], 0.9, "stone");
    scene.add(B.mesh());
    const rune = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 14), new THREE.MeshBasicMaterial({ color: 0xffb35a, side: THREE.DoubleSide }));
    const ry = f.yaw + 0.4 + Math.PI;
    rune.position.set(ss[0] + Math.sin(ry) * 0.42, ss[1] + 2.0, ss[2] + Math.cos(ry) * 0.42); rune.rotation.y = ry; scene.add(rune);
    world.rune = rune;
    world.caveMouth = [C.x, bg, C.z];
    T.addCollider(back[0], back[1], 4.5, "cave");
  }

  /* Devi's watch spots (§5): ridge over site 5, ridge north of the meadow, the cave, the village (final) */
  const dz = (x, z) => [x, T.ground(x, z), z];
  world.devSpots = { 4: dz(...DEVI_FAR[4]), 5: dz(...DEVI_FAR[5]), 10: world.caveMouth, final: dz(331, 104) };
}

/* ====================================================================
   EXPLORATION + LANDMARKS — stone bridge, chapel ruin, fishing hut,
   hidden spring, sheep, signposts
   ==================================================================== */
function buildLandmarks(scene){
  const B = new G.PartBuilder();
  /* stone bridge over the tributary at site 7 */
  const Bd = T.BRIDGE, n = 12;
  for(let i = 0; i < n; i++){
    const a0 = (i / n - 0.5) * Bd.len, a1 = ((i + 1) / n - 0.5) * Bd.len, am = (a0 + a1) / 2;
    const y0 = T.deckHeight(a0), y1 = T.deckHeight(a1), ym = (y0 + y1) / 2;
    const x = Bd.x + Bd.dir.x * am, z = Bd.z + Bd.dir.z * am;
    const ry = Math.atan2(Bd.dir.x, Bd.dir.z), pitch = Math.atan2(y1 - y0, a1 - a0);
    const seg = Bd.len / n + 0.08;
    const m = new THREE.Matrix4().makeRotationY(ry).multiply(new THREE.Matrix4().makeRotationX(-pitch));
    const place = (geo, col, lx, ly) => { const g = geo.clone(); g.applyMatrix4(m); g.translate(x - Bd.dir.z * lx, ym - 0.3 + ly, z + Bd.dir.x * lx); B.add(g, col); };
    place(new THREE.BoxGeometry(Bd.width, 0.6, seg), "#8f8676", 0, 0);
    place(new THREE.BoxGeometry(0.4, 0.75, seg), "#857c6c", Bd.width / 2 - 0.2, 0.62);
    place(new THREE.BoxGeometry(0.4, 0.75, seg), "#857c6c", -Bd.width / 2 + 0.2, 0.62);
    place(new THREE.BoxGeometry(Bd.width - 0.2, Math.max(0.6, ym - Bd.wl), seg), "#7a7264", 0, -Math.max(0.6, ym - Bd.wl) / 2 - 0.2);
  }
  /* bridge parapets act as walls: colliders along both sides (deck remains walkable) */
  for(let a = -Bd.len / 2 + 1; a <= Bd.len / 2 - 1; a += 1.4) for(const s of [-1, 1]){
    T.addCollider(Bd.x + Bd.dir.x * a - Bd.dir.z * s * (Bd.width / 2 + 0.25), Bd.z + Bd.dir.z * a + Bd.dir.x * s * (Bd.width / 2 + 0.25), 0.35, "parapet");
  }
  /* ruined chapel on the ridge */
  const cx = 135, cz = -145, cg = T.ground(cx, cz) - 0.3;
  const wall = (lx, lz, w, d, h) => { B.add(G.lumpy(new THREE.BoxGeometry(w, h, d, 2, 2, 1), 0.04, 160 + lx), "#a19682", [cx + lx, cg + h / 2, cz + lz]); T.addBoxCollider(cx + lx, cz + lz, w, d, 0, "chapel"); };
  wall(-4, 0, 0.8, 7, 4.5); wall(4, -1.8, 0.8, 3.4, 3.2); wall(-1.5, -3.5, 5, 0.8, 5.2); wall(2.5, 3.5, 3, 0.8, 2.0); wall(-3, 3.5, 1.6, 0.8, 3.6);
  B.add(new THREE.CylinderGeometry(2.2, 2.2, 3.4, 12, 1, true, 0, Math.PI), "#9a8f7c", [cx + 4.4, cg + 1.7, cz + 1.5], [0, Math.PI / 2, 0]);
  B.box(1.8, 6.5, 1.8, "#a19682", [cx - 4.6, cg + 3.25, cz - 4.4]); T.addCollider(cx - 4.6, cz - 4.4, 1.3, "chapel");
  B.box(0.3, 1.2, 0.3, "#5f4128", [cx - 4.6, cg + 7.0, cz - 4.4]); B.box(1.0, 0.3, 0.3, "#5f4128", [cx - 4.6, cg + 7.2, cz - 4.4]);
  /* fishing hut + dock by the river */
  const hx = 38, hz = 176, hg = T.ground(hx, hz);
  B.box(4.2, 2.6, 3.4, "#7a5636", [hx, hg + 1.2, hz]);
  B.box(4.8, 0.2, 2.2, "#5d4a36", [hx, hg + 2.9, hz - 0.85], [0.5, 0, 0]); B.box(4.8, 0.2, 2.2, "#5d4a36", [hx, hg + 2.9, hz + 0.85], [-0.5, 0, 0]);
  B.box(1.0, 1.7, 0.1, "#3b2a1c", [hx - 2.12, hg + 0.85, hz], [0, Math.PI / 2, 0]);
  T.addBoxCollider(hx, hz, 4.6, 3.8, 0, "hut");
  const rv = T.r1Idx.nearest(hx, hz, 60), wl = rv ? T.R1WL[rv.seg] : hg - 1;
  for(let k = 0; k < 7; k++){ const x = hx - 3 - k * 1.1, z = hz + 1; B.box(1.0, 0.12, 1.8, "#8a6a40", [x, wl + 0.45, z]); if(k % 2 === 0) B.cyl(0.1, 0.1, 2.2, 5, "#5a3d26", [x, wl - 0.4, z + 0.9]); }
  B.add(new THREE.CylinderGeometry(0.7, 0.7, 3.2, 10, 1, true, 0, Math.PI), "#6e4b2e", [hx - 8.5, wl + 0.25, hz + 4], [Math.PI / 2, 0, Math.PI]);
  /* hidden spring */
  const sx = -248, sz = -36, sg = T.ground(sx, sz);
  for(let i = 0; i < 11; i++){ const a = i / 11 * 6.28; B.add(G.lumpy(new THREE.IcosahedronGeometry(0.55, 0), 0.2, 170 + i), "#86817a", [sx + Math.cos(a) * 1.9, sg + 0.15, sz + Math.sin(a) * 1.9], null, [1.2, 0.7, 1]); }
  B.add(G.lumpy(new THREE.IcosahedronGeometry(1.4, 0), 0.2, 185), "#7a756e", [sx, sg + 0.5, sz - 2.6], null, [1.3, 1.1, 0.9]);
  T.addCollider(sx, sz, 2.2, "spring");
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.75, 18).rotateX(-Math.PI / 2), waterMaterial(0.05, { deep: "#26626a", shallow: "#4a9a96" }));
  pool.position.set(sx, sg + 0.18, sz); world.waterMats.push(pool.material); scene.add(pool);
  scene.add(B.mesh());

  /* signposts with carved arrows (icons only) */
  const posts = [[2, 1], [3, -1], [4, 1], [5, -1], [6, 1], [7, -1], [8, 1], [9, -1]];
  const arrowMat = new THREE.MeshLambertMaterial({ map: G.signTex(), side: THREE.DoubleSide });
  const boardGeo = new THREE.PlaneGeometry(1.4, 0.52);
  const signs = new THREE.InstancedMesh(boardGeo, arrowMat, posts.length + 2);
  const SB = new G.PartBuilder(); let si = 0;
  const addSign = (x, z, towards) => {
    const g = T.ground(x, z); SB.box(0.16, 2.1, 0.16, "#5f4128", [x, g + 1.05, z]);
    const yaw = Math.atan2(towards[0] - x, towards[1] - z) - Math.PI / 2;
    signs.setMatrixAt(si++, G.matrixFrom([x + Math.sin(yaw + Math.PI / 2) * 0.55, g + 1.8, z + Math.cos(yaw + Math.PI / 2) * 0.55], [0, yaw, 0]));
  };
  for(const [i, side] of posts){
    const f = world.frames[i], t = T.roadT(f.x, f.z), p = T.roadPointAt(t + 16), nx = T.roadPointAt(t + 40);
    const ox = p[0] + f.lx * 3.4 * side, oz = p[1] + f.lz * 3.4 * side;
    addSign(ox, oz, nx);
  }
  addSign(140, 84, [148, 30]); addSign(-74, -80, [-100, -120]);
  signs.count = si; signs.instanceMatrix.needsUpdate = true; signs.castShadow = true;
  scene.add(signs, SB.mesh());

  /* shepherd's flock */
  const S = new G.PartBuilder();
  S.add(G.lumpy(new THREE.IcosahedronGeometry(0.62, 1), 0.12, 190), "#eee6d4", [0, 0.82, 0], null, [1.3, 0.95, 0.9]);
  S.box(0.3, 0.32, 0.42, "#2b2522", [0, 0.98, 0.86]);
  for(const [x, z] of [[0.35, 0.4], [-0.35, 0.4], [0.35, -0.4], [-0.35, -0.4]]) S.box(0.12, 0.5, 0.12, "#2b2522", [x, 0.25, z]);
  const sheepGeo = S.geometry();
  world.sheep = new THREE.InstancedMesh(sheepGeo, G.clayMat, 10); world.sheep.castShadow = true; world.sheep.receiveShadow = true;
  world.sheepData = [];
  for(let i = 0; i < 10; i++){ const x = 70 + R.range(-12, 12), z = 150 + R.range(-10, 10); world.sheepData.push({ x, z, tx: x, tz: z, ry: R() * 6, wait: R() * 5, bob: R() * 6 }); }
  scene.add(world.sheep);
}

/* ====================================================================
   AMBIENT LIFE — smoke, embers, birds, fireflies
   ==================================================================== */
function buildAmbient(scene){
  /* smoke puffs: one Points cloud reused by all emitters */
  const MAX = 700;
  const g = new THREE.BufferGeometry();
  world.smoke = { n: MAX, pos: new Float32Array(MAX * 3), size: new Float32Array(MAX), alpha: new Float32Array(MAX), col: new Float32Array(MAX * 3), age: new Float32Array(MAX).fill(1e9), life: new Float32Array(MAX), vel: new Float32Array(MAX * 3), grow: new Float32Array(MAX), a0: new Float32Array(MAX), next: 0 };
  g.setAttribute("position", new THREE.BufferAttribute(world.smoke.pos, 3));
  g.setAttribute("size", new THREE.BufferAttribute(world.smoke.size, 1));
  g.setAttribute("alpha", new THREE.BufferAttribute(world.smoke.alpha, 1));
  g.setAttribute("color", new THREE.BufferAttribute(world.smoke.col, 3));
  const puff = G.puffTex();
  world.smokeUni = { uMap: { value: puff }, uScale: { value: 400 }, uLight: { value: new THREE.Color(1, 1, 1) } };
  const pm = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, world.smokeUni]), transparent: true, depthWrite: false, fog: true,
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float uScale;
      #include <fog_pars_vertex>
      void main(){ vA = alpha; vC = color; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(-mvPosition.z, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uLight; varying float vA; varying vec3 vC;
      #include <fog_pars_fragment>
      void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC * uLight, t.a * vA * 1.6);
      #include <colorspace_fragment>
      #include <fog_fragment>
      }` });
  pm.uniforms.uMap.value = puff;
  world.smokePoints = new THREE.Points(g, pm); world.smokePoints.frustumCulled = false; world.smokePoints.renderOrder = 5;
  scene.add(world.smokePoints);
  world.smokeMat = pm;

  /* embers (additive sparks) */
  const EM = 260, eg = new THREE.BufferGeometry();
  world.embers = { n: EM, pos: new Float32Array(EM * 3), vel: new Float32Array(EM * 3), age: new Float32Array(EM).fill(1e9), life: new Float32Array(EM), alpha: new Float32Array(EM), next: 0 };
  eg.setAttribute("position", new THREE.BufferAttribute(world.embers.pos, 3)); eg.setAttribute("alpha", new THREE.BufferAttribute(world.embers.alpha, 1));
  const emat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 400 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float alpha; varying float vA; uniform float uScale; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 0.18 * uScale / max(-mv.z, 1.0) + 1.0; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(1.0, 0.55, 0.2, vA * smoothstep(0.5, 0.0, d)); }` });
  world.emberPoints = new THREE.Points(eg, emat); world.emberPoints.frustumCulled = false; scene.add(world.emberPoints);
  world.emberMat = emat;

  /* birds (instanced V shapes, day only) */
  const bg = new THREE.BufferGeometry();
  bg.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.3, -0.9, 0.25, -0.1, 0, 0, -0.2, 0, 0, 0.3, 0, 0, -0.2, 0.9, 0.25, -0.1], 3)); bg.computeVertexNormals();
  world.birds = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0x2a2420, side: THREE.DoubleSide }), 24);
  world.birdData = [];
  const flocks = [[200, 80], [-20, -20], [-200, -120]];
  for(let i = 0; i < 24; i++){ const fl = flocks[i % 3]; world.birdData.push({ cx: fl[0], cz: fl[1], r: 30 + R() * 25, h: 45 + R() * 20, a: R() * 6.28, sp: 0.15 + R() * 0.1, ph: R() * 6 }); }
  world.birds.frustumCulled = false; scene.add(world.birds);

  /* fireflies around the player at night */
  const FF = 70, fg = new THREE.BufferGeometry(), fp = new Float32Array(FF * 3);
  world.ffData = []; for(let i = 0; i < FF; i++) world.ffData.push({ ox: R.range(-22, 22), oz: R.range(-22, 22), oy: R.range(0.4, 2.4), ph: R() * 6.28, sp: R.range(0.3, 0.9) });
  fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
  world.ffUni = { uOp: { value: 0 }, uTime: N.shared.uTime, uScale: { value: 400 } };
  world.fireflies = new THREE.Points(fg, new THREE.ShaderMaterial({ uniforms: world.ffUni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime, uScale; varying float vA; void main(){ vA = 0.5 + 0.5 * sin(uTime * 3.0 + position.x * 3.1 + position.z * 1.7); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 0.22 * uScale / max(-mv.z, 1.0) + 1.5; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOp; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.85, 1.0, 0.45, uOp * vA * smoothstep(0.5, 0.0, d)); }` }));
  world.fireflies.frustumCulled = false; scene.add(world.fireflies);
}

function emitSmoke(e){
  const S = world.smoke, i = S.next; S.next = (S.next + 1) % S.n;
  S.age[i] = 0; S.life[i] = e.life * (0.8 + Math.random() * 0.4);
  S.pos[i * 3] = e.pos[0] + (Math.random() - 0.5) * 0.4; S.pos[i * 3 + 1] = e.pos[1]; S.pos[i * 3 + 2] = e.pos[2] + (Math.random() - 0.5) * 0.4;
  S.vel[i * 3] = 0.25 + (Math.random() - 0.5) * 0.3; S.vel[i * 3 + 1] = e.rise * (0.7 + Math.random() * 0.5) / e.life * 3; S.vel[i * 3 + 2] = -0.15 + (Math.random() - 0.5) * 0.3;
  S.grow[i] = e.size; S.a0[i] = e.alpha;
  S.col[i * 3] = e.color[0]; S.col[i * 3 + 1] = e.color[1]; S.col[i * 3 + 2] = e.color[2];
  if(e.embers && Math.random() < 0.6){
    const E = world.embers, j = E.next; E.next = (E.next + 1) % E.n;
    E.age[j] = 0; E.life[j] = 1.5 + Math.random() * 2;
    E.pos[j * 3] = e.pos[0] + (Math.random() - 0.5); E.pos[j * 3 + 1] = e.pos[1] - 0.6; E.pos[j * 3 + 2] = e.pos[2] + (Math.random() - 0.5);
    E.vel[j * 3] = (Math.random() - 0.5) * 0.8; E.vel[j * 3 + 1] = 1.2 + Math.random() * 1.6; E.vel[j * 3 + 2] = (Math.random() - 0.5) * 0.8;
  }
}

/* ====================================================================
   PUBLIC
   ==================================================================== */
world.build = function(scene){
  N.IMG = window.NATS_IMAGES;
  buildTerrain(scene);
  buildRoads(scene);
  buildWater(scene);
  buildVegetation(scene);
  buildVillage(scene);
  buildSites(scene);
  buildLandmarks(scene);
  buildAmbient(scene);
  world.setVariant(6, "team"); world.setVariant(8, "team");
};

world.setVariant = function(site, which){
  const v = world.variants[site]; if(!v) return;
  v.team.visible = which === "team"; v.solo.visible = which === "solo";
  world.fires.forEach(f => { if(f.variantOf === site) f.active = (which === "solo" && f.group.parent === v.solo) || (which === "team" && f.group.parent === v.team); });
  /* variant colliders */
  v.coll = v.coll || [];
  v.coll.forEach(c => { c.r = 0; }); v.coll = [];
  const list = v[which] && v[which].userData.colliders;
  if(list) list.forEach(([x, z, r]) => v.coll.push(T.addCollider(x, z, r, "variant")));
};

world.setQuality = function(q){
  const d = { low: 0.25, medium: 0.6, high: 1 }[q];
  world.grass.userData.setDensity(d); world.flowers.userData.setDensity(d);
  const castTrees = q !== "low";
  world.trees.children.forEach(g => g.userData.meshes.forEach(m => m.castShadow = castTrees));
};

const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _v = new THREE.Vector3(), _s3 = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0);
let emitAcc = new Map();
world.update = function(dt, t, ctx){
  const night = N.sky.nightness(), cam = ctx.camera, px = ctx.focus.x, pz = ctx.focus.z;
  /* water uniforms */
  for(const m of world.waterMats){
    m.uniforms.uSunDir.value.copy(N.sky.uni.uSunDir.value); m.uniforms.uSunCol.value.copy(N.sky.sun.color).multiplyScalar(Math.min(1.5, N.sky.sun.intensity * 0.6));
    m.uniforms.uSky.value.copy(N.sky.uni.uMid.value).lerp(N.sky.uni.uHor.value, 0.5); m.uniforms.uNight.value = night;
  }
  /* windows glow at night */
  const wg = night > 0.3 ? 0.85 : night * 1.5;
  if(Math.abs((world._winGlow || 0) - wg) > 0.04){ world._winGlow = wg; world.setVillageDamage(world.damage); }
  if(world.lanternWindow){ world.lanternWindow.glow.material.opacity = night * 0.9; world.lanternWindow.win.material.color.setRGB(0.25 + night * 0.75, 0.18 + night * 0.52, 0.1 + night * 0.25); }
  if(world.rune) world.rune.material.color.setRGB(1, 0.55 + 0.25 * Math.sin(t * 2), 0.2);

  /* fires flicker */
  for(const f of world.fires){
    if(!f.group.visible || !f.active) continue;
    const k = 1 + Math.sin(t * 13 + f.pos.x) * 0.08 + Math.sin(t * 23.7) * 0.06;
    f.f1.scale.set(k, 1 + Math.sin(t * 9) * 0.12, k); f.f2.scale.set(1, k * 1.05, 1);
    f.glow.material.opacity = 0.45 + night * 0.4 + Math.sin(t * 17) * 0.05;
  }
  /* smoke emitters */
  const S = world.smoke;
  for(const e of world.smokeEmitters){
    if(e.off) continue;
    if(e.fire && (!e.fire.active || !isVisible(e.fire.group))) continue;
    const d = Math.hypot(e.pos[0] - px, e.pos[2] - pz); if(d > 260) continue;
    let acc = (emitAcc.get(e) || 0) + dt * e.rate;
    while(acc >= 1){ emitSmoke(e); acc -= 1; }
    emitAcc.set(e, acc);
  }
  const wind = 1;
  for(let i = 0; i < S.n; i++){
    if(S.age[i] > S.life[i]){ S.alpha[i] = 0; continue; }
    S.age[i] += dt; const k = S.age[i] / S.life[i];
    S.pos[i * 3] += S.vel[i * 3] * dt * wind; S.pos[i * 3 + 1] += S.vel[i * 3 + 1] * dt; S.pos[i * 3 + 2] += S.vel[i * 3 + 2] * dt * wind;
    S.size[i] = S.grow[i] * (0.4 + k * 1.6); S.alpha[i] = S.a0[i] * Math.sin(Math.min(1, k) * Math.PI) * (1 - k * 0.3);
  }
  const ga = world.smokePoints.geometry.attributes;
  ga.position.needsUpdate = ga.size.needsUpdate = ga.alpha.needsUpdate = ga.color.needsUpdate = true;
  world.smokeUni.uLight.value.copy(N.sky.charLight);
  world.smokeMat.uniforms.uLight.value.copy(N.sky.charLight);
  const E = world.embers;
  for(let i = 0; i < E.n; i++){
    if(E.age[i] > E.life[i]){ E.alpha[i] = 0; continue; }
    E.age[i] += dt; const k = E.age[i] / E.life[i];
    E.pos[i * 3] += E.vel[i * 3] * dt + Math.sin(t * 3 + i) * 0.01; E.pos[i * 3 + 1] += E.vel[i * 3 + 1] * dt; E.pos[i * 3 + 2] += E.vel[i * 3 + 2] * dt;
    E.alpha[i] = (1 - k) * (0.6 + 0.4 * Math.sin(t * 20 + i));
  }
  world.emberPoints.geometry.attributes.position.needsUpdate = true; world.emberPoints.geometry.attributes.alpha.needsUpdate = true;
  const scale = ctx.renderer.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360));
  world.smokeMat.uniforms.uScale.value = scale; world.emberMat.uniforms.uScale.value = scale; world.ffUni.uScale.value = scale;

  /* birds circle by day */
  const day = 1 - night;
  world.birds.visible = day > 0.4;
  if(world.birds.visible){
    world.birdData.forEach((b, i) => {
      b.a += b.sp * dt * 0.3;
      const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r, y = b.h + Math.sin(t * 0.5 + b.ph) * 3;
      const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 7 + b.ph));
      _q4.setFromAxisAngle(_up, -b.a); _s3.set(1.4, flap * 1.4, 1.4); _v.set(x, y, z);
      _m4.compose(_v, _q4, _s3); world.birds.setMatrixAt(i, _m4);
    });
    world.birds.instanceMatrix.needsUpdate = true;
  }
  /* fireflies */
  world.ffUni.uOp.value = smoothstep(0.4, 1, night);
  if(night > 0.4){
    const fpos = world.fireflies.geometry.attributes.position;
    world.ffData.forEach((f, i) => {
      const x = px + f.ox + Math.sin(t * f.sp + f.ph) * 2, z = pz + f.oz + Math.cos(t * f.sp * 0.8 + f.ph) * 2;
      fpos.setXYZ(i, x, T.ground(x, z) + f.oy + Math.sin(t * 1.3 + f.ph) * 0.4, z);
    });
    fpos.needsUpdate = true;
  }
  /* sheep wander slowly */
  if(Math.hypot(px - 70, pz - 150) < 200){
    world.sheepData.forEach((s, i) => {
      s.wait -= dt;
      if(s.wait <= 0){ s.tx = 70 + (Math.random() - 0.5) * 30; s.tz = 150 + (Math.random() - 0.5) * 24; s.wait = 4 + Math.random() * 8; }
      const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz);
      if(d > 0.3){ const sp = Math.min(0.6 * dt, d); s.x += dx / d * sp; s.z += dz / d * sp; s.ry = N.dampAngle(s.ry, Math.atan2(dx, dz), 3, dt); s.bob += dt * 8; }
      _q4.setFromAxisAngle(_up, s.ry); _v.set(s.x, T.ground(s.x, s.z) + Math.abs(Math.sin(s.bob)) * 0.05, s.z); _s3.set(1, 1, 1);
      _m4.compose(_v, _q4, _s3); world.sheep.setMatrixAt(i, _m4);
    });
    world.sheep.instanceMatrix.needsUpdate = true;
  }
};
function isVisible(o){ while(o){ if(!o.visible) return false; o = o.parent; } return true; }

/* nearest active fire (for the shared fire light + crackle audio) */
world.nearestFire = function(x, z){
  let best = null, bd = 1e9;
  for(const f of world.fires){ if(!f.active || !isVisible(f.group)) continue; const d = Math.hypot(f.pos.x - x, f.pos.z - z); if(d < bd){ bd = d; best = f; } }
  return best ? { fire: best, d: bd } : null;
};

world._emit = emitSmoke;
N.world = world;
})();
