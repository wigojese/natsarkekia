/* =====================================================================
   GEOMETRY HELPERS — merged vertex-coloured low-poly parts, instancing
   in spatial chunks, procedural canvas textures, sway shader patch.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _c = new THREE.Color();

function matrixFrom(pos, rot, scale){
  _e.set(rot ? rot[0] || 0 : 0, rot ? rot[1] || 0 : 0, rot ? rot[2] || 0 : 0);
  _q.setFromEuler(_e);
  if(typeof scale === "number") _s.set(scale, scale, scale); else if(scale) _s.set(scale[0], scale[1], scale[2]); else _s.set(1, 1, 1);
  _p.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

/* collects primitives (each with a colour) and merges them into one geometry */
class PartBuilder {
  constructor(){ this.parts = []; }
  add(geo, color, pos, rot, scale, opts){
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrixFrom(pos, rot, scale));
    if(opts && opts.matrix) g.applyMatrix4(opts.matrix);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    _c.set(color);
    const pos3 = g.attributes.position.array;
    const shade = opts && opts.shadeY;           // simple baked AO: darker towards the ground
    for(let i = 0; i < n; i++){
      let k = 1;
      if(shade) k = 0.72 + 0.28 * Math.min(1, Math.max(0, (pos3[i * 3 + 1] - shade[0]) / (shade[1] - shade[0])));
      col[i * 3] = _c.r * k; col[i * 3 + 1] = _c.g * k; col[i * 3 + 2] = _c.b * k;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    if(g.attributes.uv) g.deleteAttribute("uv");
    this.parts.push(g);
    return this;
  }
  box(w, h, d, color, pos, rot, o){ return this.add(new THREE.BoxGeometry(w, h, d), color, pos, rot, null, o); }
  cyl(rt, rb, h, seg, color, pos, rot, o){ return this.add(new THREE.CylinderGeometry(rt, rb, h, seg || 8), color, pos, rot, null, o); }
  cone(r, h, seg, color, pos, rot, o){ return this.add(new THREE.ConeGeometry(r, h, seg || 8), color, pos, rot, null, o); }
  sphere(r, color, pos, scale, detail, o){ return this.add(new THREE.IcosahedronGeometry(r, detail == null ? 1 : detail), color, pos, null, scale, o); }
  torus(r, t, color, pos, rot, arc, o){ return this.add(new THREE.TorusGeometry(r, t, 5, 12, arc || Math.PI * 2), color, pos, rot, null, o); }
  get empty(){ return this.parts.length === 0; }
  geometry(){ return mergeGeoms(this.parts); }
  mesh(material){
    const m = new THREE.Mesh(this.geometry(), material || N.geom.clayMat);
    m.castShadow = true; m.receiveShadow = true; return m;
  }
}

function mergeGeoms(list){
  let total = 0; for(const g of list) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for(const g of list){
    if(!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if(g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + g.attributes.position.count) * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/* wobble vertices a little so primitives look hand-modelled (clay) */
function lumpy(geo, amount, seed){
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, nz = N.makeNoise(seed || 3);
  for(let i = 0; i < p.count; i++){
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + nz.n2(x * 1.7 + y * 0.9, z * 1.7 - y * 0.6) * amount;
    p.setXYZ(i, x * k, y * (1 + (k - 1) * 0.5), z * k);
  }
  g.computeVertexNormals();
  return g;
}

/* ---------- materials ---------- */
function patchSway(mat, strength, base){
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = N.shared.uTime; sh.uniforms.uWind = N.shared.uWind;
    sh.vertexShader = "uniform float uTime; uniform float uWind;\n" + sh.vertexShader.replace("#include <begin_vertex>",
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         vec2 ip = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
       #else
         vec2 ip = vec2(modelMatrix[3].x, modelMatrix[3].z);
       #endif
       float hgt = max(position.y - ${base.toFixed(2)}, 0.0);
       float sw = sin(uTime * 1.3 + ip.x * 0.13 + ip.y * 0.17) + 0.4 * sin(uTime * 2.7 + ip.x * 0.3);
       transformed.x += sw * ${strength.toFixed(3)} * hgt * uWind;
       transformed.z += cos(uTime * 1.1 + ip.y * 0.21) * ${(strength * 0.6).toFixed(3)} * hgt * uWind;`);
  };
  mat.customProgramCacheKey = () => "sway" + strength + "_" + base;
  return mat;
}
const clayMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const claySmooth = new THREE.MeshLambertMaterial({ vertexColors: true });

/* ---------- instancing in spatial chunks (per-chunk frustum culling) ---------- */
function instancedChunks(geo, mat, items, chunk, opts){
  /* items: [{x,y,z, ry, s:[sx,sy,sz] or number, color}] */
  const group = new THREE.Group(), buckets = new Map();
  for(const it of items){
    const k = Math.floor(it.x / chunk) + "," + Math.floor(it.z / chunk);
    if(!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(it);
  }
  const meshes = [];
  for(const list of buckets.values()){
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => {
      const s = it.s == null ? 1 : it.s;
      im.setMatrixAt(i, matrixFrom([it.x, it.y, it.z], [it.rx || 0, it.ry || 0, it.rz || 0], s));
      if(it.color != null){ _c.set(it.color); im.setColorAt(i, _c); }
    });
    im.instanceMatrix.needsUpdate = true;
    if(im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = !!(opts && opts.cast); im.receiveShadow = opts && opts.receive === false ? false : true;
    im.userData.full = list.length;
    group.add(im); meshes.push(im);
  }
  group.userData.meshes = meshes;
  /* density control: show a fraction of every chunk (items are pre-shuffled) */
  group.userData.setDensity = (f) => meshes.forEach(m => { m.count = Math.max(0, Math.round(m.userData.full * f)); });
  return group;
}

/* ---------- canvas textures ---------- */
function canvasTex(w, h, draw, opts){
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if(opts && opts.repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
const puffTex = () => canvasTex(128, 128, (g, w, h) => {
  const r = rng => 0;
  for(let i = 0; i < 9; i++){
    const x = w * (0.25 + 0.5 * ((i * 37) % 10) / 10), y = h * (0.35 + 0.3 * ((i * 53) % 10) / 10), rr = w * (0.18 + 0.1 * ((i * 17) % 5) / 5);
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
  }
});
const glowTex = () => canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const blobTex = () => canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(0.6, "rgba(0,0,0,0.3)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const netTex = () => canvasTex(128, 128, (g, w, h) => {
  g.strokeStyle = "#cdbb8a"; g.lineWidth = 2;
  for(let i = -128; i < 256; i += 14){ g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
  g.globalCompositeOperation = "destination-out";
  g.beginPath(); g.ellipse(80, 70, 26, 18, 0.5, 0, Math.PI * 2); g.fill();      // torn hole
  g.beginPath(); g.ellipse(30, 30, 10, 14, 0.2, 0, Math.PI * 2); g.fill();
});
const planTex = () => canvasTex(128, 96, (g, w, h) => {
  g.fillStyle = "#d9c79a"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "#5a4c36"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(10, 70); g.bezierCurveTo(40, 20, 70, 80, 118, 25); g.stroke();
  g.setLineDash([4, 4]); g.beginPath(); g.moveTo(10, 30); g.lineTo(118, 70); g.stroke(); g.setLineDash([]);
  g.fillStyle = "#5a4c36"; for(const [x, y] of [[20, 60], [60, 52], [100, 34]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  g.strokeStyle = "#9c3d24"; g.lineWidth = 7; g.beginPath(); g.moveTo(14, 12); g.lineTo(114, 86); g.moveTo(114, 12); g.lineTo(14, 86); g.stroke();
});
const signTex = () => canvasTex(128, 48, (g, w, h) => {
  g.fillStyle = "#8a6440"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#6a4a2c"; for(let i = 0; i < 6; i++) g.fillRect(0, 6 + i * 7, w, 1);
  g.fillStyle = "#3a2716"; g.beginPath(); g.moveTo(20, 24); g.lineTo(84, 24 - 10); g.lineTo(84, 14 - 4); g.lineTo(108, 24); g.lineTo(84, 38 + 4); g.lineTo(84, 34); g.lineTo(20, 34); g.closePath(); g.fill();
});

N.geom = { PartBuilder, mergeGeoms, matrixFrom, lumpy, patchSway, clayMat, claySmooth, instancedChunks, canvasTex,
  puffTex, glowTex, blobTex, netTex, planTex, signTex };
})();
