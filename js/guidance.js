/* =====================================================================
   GUIDANCE — the player always knows WHERE to go (never which answer):
   beacon pillar + ground ring, compass strip, off-screen arrow,
   rotating mini-map with fog of war, big map, breadcrumb trail (A*),
   escalating idle hints, "not yet" info.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const T = N.terrain, D = N.data;
const { clamp, lerp, smoothstep, wrapAngle } = N;
const $ = (id) => document.getElementById(id);

const G = { site: null, active: false, done: new Set(), deviSeen: false, idleT: 0, bestD: 1e9, pulsed: false, hintShown: false, ringPulse: 0, notYetFlag: {} };
const MAP_R = 400, MAP_PX = 512;

/* ---------------- beacon ---------------- */
function beaconMat(color, strength){
  return new THREE.ShaderMaterial({
    uniforms: { uTime: N.shared.uTime, uCol: { value: new THREE.Color(color) }, uK: { value: strength }, uPulse: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uTime, uK, uPulse; uniform vec3 uCol; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(normalize(vN.xz), normalize(vV.xz))), 1.6);
        float fade = pow(1.0 - vUv.y, 1.3) * smoothstep(0.0, 0.02, vUv.y);
        float p = 0.75 + 0.25 * sin(uTime * 1.6) + uPulse * 0.6;
        gl_FragColor = vec4(uCol * edge * fade * uK * p, 1.0); }`
  });
}
function ringMat(){
  return new THREE.ShaderMaterial({
    uniforms: { uTime: N.shared.uTime, uK: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uK; varying vec2 vUv; void main(){ vec2 c = vUv - 0.5; float r = length(c) * 2.0;
      float ring = smoothstep(0.78, 0.86, r) * smoothstep(1.0, 0.9, r);
      float wave = smoothstep(0.08, 0.0, abs(r - fract(uTime * 0.35))) * 0.6;
      float disc = smoothstep(0.86, 0.0, r) * 0.18;
      gl_FragColor = vec4(vec3(1.0, 0.82, 0.4) * (ring + wave * smoothstep(1.0, 0.6, r) + disc) * uK, 1.0); }`
  });
}

G.init = function(scene){
  G.beacon = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 300, 24, 1, true), beaconMat("#ffcf5a", 0.55));
  outer.position.y = 150;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 300, 12, 1, true), beaconMat("#fff2c0", 0.9));
  core.position.y = 150;
  outer.frustumCulled = core.frustumCulled = false; outer.renderOrder = core.renderOrder = 8;
  G.beacon.add(outer, core);
  G.beaconMats = [outer.material, core.material];
  const rg = new THREE.PlaneGeometry(13.5, 13.5); rg.rotateX(-Math.PI / 2);
  G.ring = new THREE.Mesh(rg, ringMat()); G.ring.renderOrder = 7;
  scene.add(G.beacon, G.ring);
  G.beacon.visible = G.ring.visible = false;
  G.fadeIn = 0;

  /* hunter's pointing arrow */
  const at = N.geom.canvasTex(64, 64, (g) => { g.fillStyle = "#ffd36a"; g.beginPath(); g.moveTo(10, 24); g.lineTo(38, 24); g.lineTo(38, 12); g.lineTo(58, 32); g.lineTo(38, 52); g.lineTo(38, 40); g.lineTo(10, 40); g.closePath(); g.fill(); });
  G.arrowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: at, transparent: true, depthTest: false }));
  G.arrowSprite.scale.set(0.8, 0.8, 1); G.arrowSprite.visible = false; G.arrowSprite.renderOrder = 20; scene.add(G.arrowSprite);

  /* breadcrumb trail */
  const bg = new THREE.PlaneGeometry(0.55, 0.55); bg.rotateX(-Math.PI / 2);
  G.crumbMax = 600;
  G.crumbs = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ map: N.geom.glowTex(), color: 0xffd36a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), G.crumbMax);
  G.crumbs.count = 0; G.crumbs.frustumCulled = false; G.crumbs.renderOrder = 9;
  G.crumbs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(G.crumbMax * 3), 3);
  scene.add(G.crumbs);
  G.crumbT = 0;

  buildCompass();
  buildMapBase();
  buildNavGrid();
};

G.setObjective = function(site){
  G.site = site; G.active = !!site;
  G.idleT = 0; G.bestD = 1e9; G.pulsed = false; G.hintShown = false; N.ui.hintLine(null);
  G.fadeIn = 0;
  if(site){ const p = D.SITES[site].pos; G.beacon.position.set(p[0], T.ground(p[0], p[1]), p[1]); G.ring.position.set(p[0], T.ground(p[0], p[1]) + 0.12, p[1]); }
  G.beacon.visible = !!site; G.crumbs.count = 0;
};
G.setDone = function(steps){ G.done = new Set(steps); };
G.hide = function(){ G.beacon.visible = false; G.ring.visible = false; G.crumbs.count = 0; $("edge-arrow").classList.remove("on"); G.arrowSprite.visible = false; N.ui.hintLine(null); };

/* ---------------- compass ---------------- */
function buildCompass(){
  const strip = $("compass-strip"); let html = "";
  for(let a = 0; a < 360; a += 15) html += a === 0 ? `<span class="cn" data-a="0">◆</span>` : `<span class="ct${a % 90 === 0 ? " major" : ""}" data-a="${a}"></span>`;
  html += `<span class="cstar" id="c-star">★</span><span class="cdevi" id="c-devi"></span>`;
  strip.innerHTML = html;
  G.compassEls = Array.from(strip.querySelectorAll("[data-a]")).map(el => ({ el, a: +el.dataset.a * Math.PI / 180 }));
}
const bearing = (dx, dz) => Math.atan2(dx, -dz);          // clockwise from north (−z)
function placeOnStrip(el, rel, w){
  if(Math.abs(rel) > Math.PI * 0.6){ el.style.display = "none"; return; }
  el.style.display = ""; el.style.left = (w / 2 + rel / (Math.PI / 2) * (w / 2)) + "px";
}

/* ---------------- mini-map ---------------- */
const w2m = (x) => (x + MAP_R) / (2 * MAP_R) * MAP_PX;
function buildMapBase(){
  const c = document.createElement("canvas"); c.width = c.height = MAP_PX;
  const g = c.getContext("2d"), img = g.createImageData(MAP_PX, MAP_PX);
  for(let j = 0; j < MAP_PX; j++) for(let i = 0; i < MAP_PX; i++){
    const x = i / MAP_PX * 2 * MAP_R - MAP_R, z = j / MAP_PX * 2 * MAP_R - MAP_R;
    const h = T.ground(x, z), gr = T.gradient(x, z), shade = clamp(0.85 + (-gr[0] * 0.7 - gr[1] * 0.5) * 0.6, 0.45, 1.25);
    let r = 110, gg = 128, b = 70;
    if(h > 40){ const k = clamp((h - 40) / 60, 0, 1); r = lerp(r, 130, k); gg = lerp(gg, 122, k); b = lerp(b, 110, k); }
    if(h > 92){ r = 225; gg = 222; b = 214; }
    const wd = T.waterDepth(x, z);
    if(wd > 0.05){ r = 46; gg = 104; b = 116; }
    if(T.superR(x, z) > T.PLAY){ r *= 0.7; gg *= 0.7; b *= 0.72; }
    const k = (j * MAP_PX + i) * 4;
    img.data[k] = r * shade; img.data[k + 1] = gg * shade; img.data[k + 2] = b * shade; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  /* village blob */
  g.fillStyle = "rgba(160,138,98,0.85)"; g.beginPath(); g.arc(w2m(T.VILLAGE.x), w2m(T.VILLAGE.z), 30 / (2 * MAP_R) * MAP_PX, 0, 7); g.fill();
  /* road: faint dotted line */
  g.strokeStyle = "rgba(240,215,160,0.85)"; g.lineWidth = 2; g.setLineDash([3, 3]);
  g.beginPath(); T.ROAD.forEach((p, i) => i ? g.lineTo(w2m(p[0]), w2m(p[1])) : g.moveTo(w2m(p[0]), w2m(p[1]))); g.stroke();
  g.strokeStyle = "rgba(240,215,160,0.45)"; g.lineWidth = 1.2;
  for(const path of T.PATHS){ g.beginPath(); path.forEach((p, i) => i ? g.lineTo(w2m(p[0]), w2m(p[1])) : g.moveTo(w2m(p[0]), w2m(p[1]))); g.stroke(); }
  g.setLineDash([]);
  G.mapBase = c;
  /* fog of war mask */
  const f = document.createElement("canvas"); f.width = f.height = 256;
  const fg = f.getContext("2d"); fg.fillStyle = "#000"; fg.fillRect(0, 0, 256, 256);
  G.fog = f; G.fogG = fg;
  G.mini = $("minimap").getContext("2d");
  G.big = $("bigmap-canvas").getContext("2d");
  G.revealT = 0;
}
function reveal(x, z){
  const g = G.fogG; g.globalCompositeOperation = "destination-out";
  const px = (x + MAP_R) / (2 * MAP_R) * 256, pz = (z + MAP_R) / (2 * MAP_R) * 256, r = 55 / (2 * MAP_R) * 256;
  const gr = g.createRadialGradient(px, pz, r * 0.5, px, pz, r); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(px, pz, r, 0, 7); g.fill(); g.globalCompositeOperation = "source-over";
}
G.resetFog = function(){ G.fogG.globalCompositeOperation = "source-over"; G.fogG.fillStyle = "#000"; G.fogG.fillRect(0, 0, 256, 256); G.deviSeen = false; };

function drawMarkers(g, toPx, scale, rot, ctx){
  /* completed sites: ticks; active: star; Devi's mountain: red mark (once seen) */
  for(let i = 1; i <= 10; i++){
    const p = D.SITES[i].pos, q = toPx(p[0], p[1]);
    if(G.done.has(i)){ g.strokeStyle = "#dcae4f"; g.lineWidth = 2; g.beginPath(); g.moveTo(q[0] - 4, q[1]); g.lineTo(q[0] - 1, q[1] + 3); g.lineTo(q[0] + 5, q[1] - 4); g.stroke(); }
  }
  if(G.deviSeen){ const q = toPx(-334, -298); g.fillStyle = "#d23a22"; g.beginPath(); g.moveTo(q[0], q[1] - 7); g.lineTo(q[0] + 6, q[1] + 5); g.lineTo(q[0] - 6, q[1] + 5); g.closePath(); g.fill(); }
  for(const k of ctx.companions){ const q = toPx(k.x, k.z); g.fillStyle = "#f0e6cc"; g.beginPath(); g.arc(q[0], q[1], 3, 0, 7); g.fill(); }
}
function star(g, x, y, r, col){
  g.fillStyle = col; g.beginPath();
  for(let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill(); g.strokeStyle = "rgba(0,0,0,0.6)"; g.lineWidth = 1; g.stroke();
}
function drawMini(ctx){
  const g = G.mini, W = 220, cx = W / 2, R = 110, view = 120;    // radius in world units
  const p = ctx.player, heading = ctx.camHeading;               // camera bearing
  g.clearRect(0, 0, W, W);
  g.save(); g.beginPath(); g.arc(cx, cx, R, 0, 7); g.clip();
  g.fillStyle = "#1a1510"; g.fillRect(0, 0, W, W);
  g.translate(cx, cx); g.rotate(-heading);
  const s = R / view, mpp = (2 * MAP_R) / MAP_PX;
  g.scale(s, s);
  g.drawImage(G.mapBase, -(p.x + MAP_R), -(p.z + MAP_R), 2 * MAP_R, 2 * MAP_R);
  g.globalAlpha = 0.92; g.drawImage(G.fog, -(p.x + MAP_R), -(p.z + MAP_R), 2 * MAP_R, 2 * MAP_R); g.globalAlpha = 1;
  g.restore();
  const toPx = (x, z) => { const dx = x - p.x, dz = z - p.z, c = Math.cos(-heading), sn = Math.sin(-heading); return [cx + (dx * c - dz * sn) * s, cx + (dx * sn + dz * c) * s]; };
  drawMarkers(g, toPx, s, heading, ctx);
  if(G.site){
    const sp = D.SITES[G.site].pos; let q = toPx(sp[0], sp[1]);
    const dx = q[0] - cx, dy = q[1] - cx, d = Math.hypot(dx, dy);
    if(d > R - 10){ q = [cx + dx / d * (R - 10), cx + dy / d * (R - 10)]; }
    star(g, q[0], q[1], 8, "#ffd36a");
  }
  /* player arrow: camera-forward is up */
  const fa = Math.atan2(ctx.playerVX, -ctx.playerVZ) - heading;
  g.save(); g.translate(cx, cx); g.rotate(ctx.moving ? fa : 0);
  g.fillStyle = "#9c3d24"; g.strokeStyle = "#ece0c4"; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
  /* north marker on the rim */
  const na = -heading; g.fillStyle = "#dcae4f"; g.beginPath(); g.arc(cx + Math.sin(na) * (R - 7), cx - Math.cos(na) * (R - 7), 3.5, 0, 7); g.fill();
}
function drawBig(ctx){
  const g = G.big, W = 900;
  g.clearRect(0, 0, W, W); g.fillStyle = "#1a1510"; g.fillRect(0, 0, W, W);
  g.drawImage(G.mapBase, 0, 0, W, W);
  g.globalAlpha = 0.9; g.drawImage(G.fog, 0, 0, W, W); g.globalAlpha = 1;
  const toPx = (x, z) => [(x + MAP_R) / (2 * MAP_R) * W, (z + MAP_R) / (2 * MAP_R) * W];
  drawMarkers(g, toPx, 1, 0, ctx);
  if(G.site){ const q = toPx(...D.SITES[G.site].pos); star(g, q[0], q[1], 13, "#ffd36a"); }
  const q = toPx(ctx.player.x, ctx.player.z);
  g.fillStyle = "#9c3d24"; g.strokeStyle = "#ece0c4"; g.lineWidth = 2; g.beginPath(); g.arc(q[0], q[1], 7, 0, 7); g.fill(); g.stroke();
}

/* ---------------- navigation grid + A* (breadcrumb) ---------------- */
const NC = 5, NW = Math.ceil(2 * MAP_R / NC);
function buildNavGrid(){
  G.nav = new Float32Array(NW * NW);
  for(let j = 0; j < NW; j++) for(let i = 0; i < NW; i++){
    const x = -MAP_R + (i + 0.5) * NC, z = -MAP_R + (j + 0.5) * NC;
    let c = 1;
    if(!T.walkable(x, z) || T.slope(x, z) > T.MAX_SLOPE * 0.95) c = 0;
    else {
      if(T.roadDist(x, z) < 3) c = 0.45;
      if(T.waterDepth(x, z) > 0.1) c *= 2.2;
      for(const cc of T.collidersAround(x, z, 3)) if((cc.tag === "house" || cc.tag === "wall" || cc.tag === "tower" || cc.tag === "tent" || cc.tag === "chapel") && Math.hypot(cc.x - x, cc.z - z) < cc.r + 1.5){ c = 0; break; }
    }
    G.nav[j * NW + i] = c;
  }
}
function astar(sx, sz, tx, tz){
  const toC = (x) => clamp(Math.floor((x + MAP_R) / NC), 0, NW - 1);
  const s = toC(sz) * NW + toC(sx), t = toC(tz) * NW + toC(tx);
  const gS = new Float32Array(NW * NW).fill(Infinity), from = new Int32Array(NW * NW).fill(-1), closed = new Uint8Array(NW * NW);
  const heap = [];
  const push = (n, f) => { heap.push([f, n]); let i = heap.length - 1; while(i > 0){ const p = (i - 1) >> 1; if(heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if(heap.length){ heap[0] = last; let i = 0; for(;;){ const l = i * 2 + 1, r = l + 1; let m = i; if(l < heap.length && heap[l][0] < heap[m][0]) m = l; if(r < heap.length && heap[r][0] < heap[m][0]) m = r; if(m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const tx0 = t % NW, tz0 = (t / NW) | 0;
  const hfn = (n) => Math.hypot((n % NW) - tx0, ((n / NW) | 0) - tz0) * 0.45;
  gS[s] = 0; push(s, hfn(s));
  let it = 0;
  while(heap.length && it++ < 60000){
    const [, n] = pop(); if(closed[n]) continue; closed[n] = 1;
    if(n === t) break;
    const x = n % NW, z = (n / NW) | 0;
    for(let dz = -1; dz <= 1; dz++) for(let dx = -1; dx <= 1; dx++){
      if(!dx && !dz) continue;
      const nx = x + dx, nz = z + dz; if(nx < 0 || nz < 0 || nx >= NW || nz >= NW) continue;
      const m = nz * NW + nx, c = G.nav[m]; if(c <= 0 && m !== t) continue;
      const ng = gS[n] + (dx && dz ? 1.414 : 1) * Math.max(c, 0.45);
      if(ng < gS[m]){ gS[m] = ng; from[m] = n; push(m, ng + hfn(m)); }
    }
  }
  if(from[t] < 0 && s !== t) return null;
  const path = []; let n = t;
  while(n >= 0){ path.push([-MAP_R + (n % NW + 0.5) * NC, -MAP_R + (((n / NW) | 0) + 0.5) * NC]); if(n === s) break; n = from[n]; }
  path.reverse(); path[0] = [sx, sz]; path[path.length - 1] = [tx, tz];
  return path;
}
G.breadcrumb = function(px, pz){
  if(!G.site) return;
  const sp = D.SITES[G.site].pos;
  let path = astar(px, pz, sp[0], sp[1]);
  if(!path) path = [[px, pz], [sp[0], sp[1]]];
  /* smooth (Chaikin) then resample */
  for(let k = 0; k < 2; k++){ const out = [path[0]]; for(let i = 0; i < path.length - 1; i++){ const a = path[i], b = path[i + 1]; out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } out.push(path[path.length - 1]); path = out; }
  const pts = []; let carry = 0;
  for(let i = 0; i < path.length - 1 && pts.length < G.crumbMax; i++){
    const a = path[i], b = path[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for(let d = carry; d < L && pts.length < G.crumbMax; d += 1.6){ const u = d / L; pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
    carry = (carry + Math.ceil((L - carry) / 1.6) * 1.6) - L;
  }
  const m = new THREE.Matrix4();
  pts.forEach((p, i) => { m.makeTranslation(p[0], T.walkHeight(p[0], p[1]) + 0.25, p[1]); G.crumbs.setMatrixAt(i, m); });
  G.crumbs.count = pts.length; G.crumbs.instanceMatrix.needsUpdate = true;
  G.crumbPts = pts.length; G.crumbT = 8;
  return pts.length;
};

/* ---------------- per-frame ---------------- */
const _v = new THREE.Vector3();
G.update = function(dt, t, ctx){
  const p = ctx.player, cam = ctx.camera, W = window.innerWidth, H = window.innerHeight;
  G.revealT -= dt; if(G.revealT <= 0){ G.revealT = 0.25; reveal(p.x, p.z); }
  if(N.chars.devi.actor.opacity > 0.5 && Math.hypot(N.chars.devi.actor.x - p.x, N.chars.devi.actor.z - p.z) < 260) G.deviSeen = true;
  const heading = bearing(-Math.sin(ctx.camYaw), -Math.cos(ctx.camYaw));
  ctx.camHeading = heading;
  if(ctx.hudVisible){
    if(!G._miniSkip){ drawMini(ctx); } G._miniSkip = !G._miniSkip;
    if(N.ui.bigmapOpen()) drawBig(ctx);
    /* compass */
    const cw = $("compass").clientWidth;
    for(const c of G.compassEls) placeOnStrip(c.el, wrapAngle(c.a - heading), cw);
    const cs = $("c-star"), cd = $("c-devi");
    if(G.site){ const sp = D.SITES[G.site].pos; placeOnStrip(cs, wrapAngle(bearing(sp[0] - p.x, sp[1] - p.z) - heading), cw); } else cs.style.display = "none";
    if(G.deviSeen){ placeOnStrip(cd, wrapAngle(bearing(-334 - p.x, -298 - p.z) - heading), cw); } else cd.style.display = "none";
  }
  const arrow = $("edge-arrow");
  if(!G.active || !G.site || !ctx.exploring){ G.beacon.visible = false; G.ring.visible = false; arrow.classList.remove("on"); G.arrowSprite.visible = false; return; }
  const sp = D.SITES[G.site].pos, d = Math.hypot(sp[0] - p.x, sp[1] - p.z);
  G.beacon.visible = true;
  G.fadeIn = Math.min(1, G.fadeIn + dt * 0.6);
  const near = smoothstep(4, 14, d);           // beacon softens when you're inside it
  G.beaconMats[0].uniforms.uK.value = 0.55 * G.fadeIn * (0.25 + 0.75 * near);
  G.beaconMats[1].uniforms.uK.value = 0.9 * G.fadeIn * (0.25 + 0.75 * near);
  G.ringPulse = Math.max(0, G.ringPulse - dt);
  G.beaconMats.forEach(m => m.uniforms.uPulse.value = G.ringPulse > 0 ? 0.5 + 0.5 * Math.sin(t * 8) : 0);
  G.ring.visible = d < 40 || G.ringPulse > 0;
  G.ring.material.uniforms.uK.value = (d < D.TRIGGER_RADIUS ? 0.95 : 0.5 * (1 - smoothstep(20, 40, d))) + (G.ringPulse > 0 ? 0.5 : 0);
  /* off-screen arrow */
  _v.set(sp[0], T.ground(sp[0], sp[1]) + 3, sp[1]).project(cam);
  const behind = _v.z > 1;
  let sx = _v.x, sy = _v.y; if(behind){ sx = -sx; sy = -sy; }
  const off = behind || Math.abs(sx) > 0.95 || Math.abs(sy) > 0.9;
  if(off && d > 12){
    const a = Math.atan2(-sy, sx), m = Math.max(Math.abs(Math.cos(a)) / 0.9, Math.abs(Math.sin(a)) / 0.8);
    const ex = W / 2 + Math.cos(a) / m * W / 2 * 0.92, ey = H / 2 + Math.sin(a) / m * H / 2 * 0.92;
    arrow.style.left = (ex - 11) + "px"; arrow.style.top = (ey - 13) + "px"; arrow.style.transform = `rotate(${a}rad)`;
    arrow.classList.add("on");
  } else arrow.classList.remove("on");
  /* breadcrumb animation */
  if(G.crumbT > 0){
    G.crumbT -= dt;
    const fade = Math.min(1, G.crumbT / 1.2), col = new THREE.Color();
    for(let i = 0; i < G.crumbs.count; i++){ const w = 0.35 + 0.65 * Math.max(0, Math.sin(i * 0.35 - t * 6)); col.setRGB(w * fade, w * fade * 0.82, w * fade * 0.42); G.crumbs.setColorAt(i, col); }
    G.crumbs.instanceColor.needsUpdate = true;
    if(G.crumbT <= 0) G.crumbs.count = 0;
  }
  /* escalating idle hints (only with hints ON) */
  if(d < G.bestD - 2){ G.bestD = d; G.idleT = 0; if(G.hintShown){ G.hintShown = false; N.ui.hintLine(null); } }
  else G.idleT += dt;
  if(N.settings.hints && d > D.TRIGGER_RADIUS){
    if(G.idleT > 25 && !G.pulsed){ G.pulsed = true; G.ringPulse = 3; N.ui.pulseObjective(); }
    if(G.idleT > 60 && !G.hintShown){ G.hintShown = true; N.ui.hintLine(D.TEXT.idleHint); }
  }
  /* the hunter points toward the beacon */
  const hunter = N.chars.byKey.hunter;
  if(G.hintShown && N.chars.following("hunter") && hunter.opacity > 0.5){
    hunter.lookAt = sp;
    _v.set(hunter.x, hunter.y + hunter.H + 0.5, hunter.z);
    G.arrowSprite.position.copy(_v);
    const a = _v.clone().project(cam), b = new THREE.Vector3(sp[0], hunter.y + hunter.H + 0.5, sp[1]).project(cam);
    let ang = Math.atan2((b.y - a.y) * H, (b.x - a.x) * W); if(b.z > 1) ang += Math.PI;
    G.arrowSprite.material.rotation = ang; G.arrowSprite.visible = true;
  } else G.arrowSprite.visible = false;
};

N.guide = G;
})();
