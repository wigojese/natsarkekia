/* =====================================================================
   CHARACTERS — camera-facing (Y-locked) billboards made from the
   supplied clay-figurine cut-outs: scene-lit tint, warm rim, alpha-tested
   silhouette shadows, blob shadow, procedural walk/idle animation.
   Player controller, companions' follow AI, Devi.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const T = N.terrain;
const { clamp, lerp, damp, dampAngle, smoothstep } = N;

const chars = { list: [], byKey: {} };
const SIZES = {               // pixel sizes (Appendix E) → world height
  natsarkekia: { w: 225, h: 443, H: 1.8, face: 1 },
  hunter:      { w: 330, h: 480, H: 1.8, face: 1 },
  elderwoman:  { w: 336, h: 501, H: 1.75, face: -1 },
  blacksmith:  { w: 665, h: 620, H: 1.75, face: 1 },
  devi:        { w: 445, h: 484, H: 7.2, face: 1 }
};

let blobTex = null;
const textures = {};
function tex(key){
  if(textures[key]) return textures[key];
  const t = new THREE.TextureLoader().load(N.IMG[key]);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  return (textures[key] = t);
}

function billboardMaterial(map, sz){
  const uni = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    map: { value: null }, uLight: { value: new THREE.Color(1, 1, 1) }, uRim: { value: new THREE.Color("#ffcf8a") },
    uRimK: { value: 0.4 }, uOpacity: { value: 1 }, uTexel: { value: new THREE.Vector2(3 / sz.w, 3 / sz.h) }, uRed: { value: 0 } }]);
  uni.map.value = map;
  return new THREE.ShaderMaterial({
    uniforms: uni, fog: true, transparent: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 uLight, uRim; uniform float uRimK, uOpacity, uRed; uniform vec2 uTexel; varying vec2 vUv;
      #include <fog_pars_fragment>
      float bayer(vec2 p){ vec2 q = mod(floor(p), 4.0); int i = int(q.x) + int(q.y) * 4;
        float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (m[i] + 0.5) / 16.0; }
      void main(){
        if(uOpacity < 0.999 && bayer(gl_FragCoord.xy) > uOpacity) discard;
        vec4 t = texture2D(map, vUv);
        vec3 c;
        if(t.a < 0.5){
          float m = max(max(texture2D(map, vUv + vec2(uTexel.x, 0.0)).a, texture2D(map, vUv - vec2(uTexel.x, 0.0)).a),
                        max(texture2D(map, vUv + vec2(0.0, uTexel.y)).a, texture2D(map, vUv - vec2(0.0, uTexel.y)).a));
          if(m < 0.5 || uRimK < 0.02) discard;
          c = uRim * uRimK;
        } else {
          c = t.rgb * uLight;
          c += vec3(0.55, 0.06, 0.03) * uRed * (0.4 + 0.6 * (1.0 - vUv.y));
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`
  });
}

class Actor {
  constructor(key, scene){
    const sz = SIZES[key];
    this.key = key; this.sz = sz;
    this.H = sz.H; this.W = sz.H * sz.w / sz.h;
    const geo = new THREE.PlaneGeometry(this.W, this.H); geo.translate(0, this.H / 2, 0);
    const map = tex(key);
    this.mat = billboardMaterial(map, sz);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5, side: THREE.DoubleSide });
    this.root = new THREE.Group(); this.yawNode = new THREE.Group(); this.root.add(this.yawNode); this.yawNode.add(this.mesh);
    if(!blobTex) blobTex = N.geom.blobTex();
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    const bw = Math.min(this.W * 0.9, this.H * 0.55) * (key === "blacksmith" ? 1.3 : 1);
    this.blob.scale.set(bw, 1, bw * 0.55); this.blob.renderOrder = 3;
    scene.add(this.root); scene.add(this.blob);
    this.x = 0; this.z = 0; this.y = 0; this.vx = 0; this.vz = 0; this.speed = 0;
    this.phase = Math.random() * 6; this.idleT = Math.random() * 6; this.face = 1; this.hop = 0; this.wasMoving = false;
    this.opacity = 1; this.targetOpacity = 1; this.visible = true; this.scaleMul = 1; this.waveT = 0; this.wave = false;
    this.rimBase = 0.35; this.yOffset = 0; this.pointing = false;
    chars.list.push(this); chars.byKey[key] = chars.byKey[key] || this;
  }
  place(x, z){ this.x = x; this.z = z; this.y = T.walkHeight(x, z); this.vx = this.vz = 0; this.speed = 0; }
  show(on, instant){ this.targetOpacity = on ? 1 : 0; if(instant) this.opacity = this.targetOpacity; }
  /* camera-relative facing: flip toward the lateral movement direction */
  update(dt, t, camera, light){
    this.opacity = damp(this.opacity, this.targetOpacity, 4, dt);
    const vis = this.opacity > 0.02;
    this.root.visible = vis; this.blob.visible = vis;
    if(!vis) return;
    this.mat.uniforms.uOpacity.value = this.opacity > 0.98 ? 1 : this.opacity;
    const camYaw = Math.atan2(camera.position.x - this.x, camera.position.z - this.z);
    this.yawNode.rotation.y = camYaw;
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);              // camera-right on the ground
    const lateral = this.vx * rx + this.vz * rz;
    if(Math.abs(lateral) > 0.6) this.face = lateral > 0 ? 1 : -1;
    if(this.lookAt){ const l = (this.lookAt[0] - this.x) * rx + (this.lookAt[1] - this.z) * rz; if(Math.abs(l) > 0.3) this.face = l > 0 ? 1 : -1; }
    const moving = this.speed > 0.4;
    const red = N.settings.reducedMotion;
    let bob = 0, roll = 0, sx = 1, sy = 1;
    if(moving){
      this.phase += dt * (5.2 + this.speed * 1.25);
      const s = Math.sin(this.phase);
      bob = Math.abs(s) * 0.075 * (this.H / 1.8); roll = s * 0.045; sy = 1 - Math.abs(Math.cos(this.phase)) * 0.035; sx = 1 + Math.abs(Math.cos(this.phase)) * 0.025;
      if(this.onStep && Math.abs(s) < 0.2 && !this._stepped){ this._stepped = true; this.onStep(this); }
      if(Math.abs(s) > 0.5) this._stepped = false;
    } else {
      this.idleT += dt;
      bob = (Math.sin(this.idleT * Math.PI * 2 / 3.2) * 0.5 + 0.5) * 0.045 * (this.H / 1.8);
      sy = 1 + Math.sin(this.idleT * Math.PI * 2 / 3.2) * 0.008;
    }
    if(this.wasMoving && !moving) this.hop = 0.26;
    this.wasMoving = moving;
    if(this.hop > 0){ this.hop -= dt; bob += Math.sin((1 - this.hop / 0.26) * Math.PI) * 0.1; }
    if(this.wave){ this.waveT += dt; roll += Math.sin(this.waveT * 6) * 0.07; }
    if(red){ bob *= 0.25; roll = 0; }
    this.root.position.set(this.x, this.y + bob + this.yOffset, this.z);
    this.mesh.rotation.z = roll * -this.face;
    this.mesh.scale.set(sx * this.scaleMul * this.face * this.sz.face, sy * this.scaleMul, 1);
    this.mat.uniforms.uLight.value.copy(light);
    this.mat.uniforms.uRimK.value = this.rimBase + N.sky.nightness() * 0.55;
    /* blob shadow aligned to the ground */
    const gy = T.walkHeight(this.x, this.z);
    this.blob.position.set(this.x, gy + 0.06, this.z);
    const nrm = T.onBridge(this.x, this.z) ? new THREE.Vector3(0, 1, 0) : T.normal(this.x, this.z);
    this.blob.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm);
    this.blob.material.opacity = this.opacity * (1 - clamp((this.y + bob - gy) * 0.8, 0, 0.6));
  }
  /* move toward a point with a max speed; returns remaining distance */
  steer(dt, tx, tz, maxSp, arrive){
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    let sp = d > (arrive || 0.15) ? Math.min(maxSp, d * 2.2) : 0;
    const dvx = d > 1e-4 ? dx / d * sp : 0, dvz = d > 1e-4 ? dz / d * sp : 0;
    this.vx = damp(this.vx, dvx, 8, dt); this.vz = damp(this.vz, dvz, 8, dt);
    const [nx, nz] = T.moveCircle(this.x, this.z, this.vx * dt, this.vz * dt, 0.35, this.ghost);
    const realSp = Math.hypot(nx - this.x, nz - this.z) / Math.max(dt, 1e-4);
    this.x = nx; this.z = nz; this.speed = damp(this.speed, realSp, 10, dt);
    this.y = damp(this.y, T.walkHeight(this.x, this.z), 18, dt);
    return d;
  }
}

/* ---------------- player ---------------- */
const player = {
  actor: null, heading: 0, locked: false, wading: false, lastSafe: null, splashT: 0,
  update(dt, input, camYaw){
    const a = this.actor;
    let ix = input.x, iy = input.y;
    if(this.locked){ ix = 0; iy = 0; }
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let dx = fx * iy + rx * ix, dz = fz * iy + rz * ix;
    const mag = Math.min(1, Math.hypot(dx, dz));
    if(mag > 1e-3){ const L = Math.hypot(dx, dz); dx /= L; dz /= L; }
    const depth = T.waterDepth(a.x, a.z);
    this.wading = depth > 0.15 && !T.onBridge(a.x, a.z);
    const sp = (input.run ? 7.5 : 4.5) * mag * (this.wading ? 0.55 : 1);
    a.vx = damp(a.vx, dx * sp, 9, dt); a.vz = damp(a.vz, dz * sp, 9, dt);
    const [nx, nz] = T.moveCircle(a.x, a.z, a.vx * dt, a.vz * dt, 0.4);
    const real = Math.hypot(nx - a.x, nz - a.z) / Math.max(dt, 1e-4);
    a.x = nx; a.z = nz; a.speed = damp(a.speed, real, 12, dt);
    a.y = damp(a.y, T.walkHeight(a.x, a.z) - (this.wading ? Math.min(depth, 0.5) * 0.5 : 0), 20, dt);
    if(a.speed > 0.5) this.heading = dampAngle(this.heading, Math.atan2(a.vx, a.vz), 6, dt);
    if(this.wading && a.speed > 0.8){ this.splashT -= dt; if(this.splashT <= 0){ this.splashT = 0.12; N.world.splash && N.world.splash(a.x, T.waterLevel(a.x, a.z), a.z); } }
    /* remember a safe point (walkable, not wading, not steep) */
    if(!this.wading && T.slope(a.x, a.z) < 0.5) this.lastSafe = [a.x, a.z];
    if(!isFinite(a.x) || !isFinite(a.z)){ const s = this.lastSafe || [320, 125]; a.place(s[0], s[1]); }
  }
};

/* ---------------- companions ---------------- */
const SLOTS = { hunter: [1.7, 2.3], elderwoman: [-1.7, 2.7], blacksmith: [0.3, 3.6] };
const companions = {
  following: new Set(),
  update(dt){
    const p = player.actor, h = player.heading, ch = Math.cos(h), sh = Math.sin(h);
    const solo1 = this.following.size === 1;
    let i = 0;
    for(const key of this.following){
      const a = chars.byKey[key];
      if(a.scripted) continue;
      const sl = solo1 ? [1.5, 2.4] : SLOTS[key];
      /* slot in the player's frame: lateral * right + back * (-forward) */
      const tx = p.x + ch * sl[0] - sh * sl[1], tz = p.z - sh * sl[0] - ch * sl[1];
      const d = Math.hypot(a.x - p.x, a.z - p.z);
      if(d > 40){ const s = safeNear(tx, tz, p); a.place(s[0], s[1]); continue; }
      const dist = Math.hypot(tx - a.x, tz - a.z);
      const pSp = Math.max(p.speed, 0.1);
      const maxSp = dist > 6 ? 9 : dist > 2.5 ? Math.max(pSp * 1.25, 5) : Math.max(pSp, 1.5);
      a.steer(dt, tx, tz, maxSp, p.speed > 0.4 ? 0.3 : 0.7);
      if(a.speed < 0.3) a.lookAt = [p.x, p.z]; else a.lookAt = null;
      i++;
    }
  }
};
function safeNear(x, z, p){
  for(let r = 0; r < 6; r += 1.2) for(let k = 0; k < 8; k++){
    const qx = x + Math.cos(k * 0.785) * r, qz = z + Math.sin(k * 0.785) * r;
    if(T.walkable(qx, qz) && T.waterDepth(qx, qz) < 0.3 && ![...T.collidersAround(qx, qz, 2)].some(c => Math.hypot(c.x - qx, c.z - qz) < c.r + 0.4)) return [qx, qz];
  }
  return [p.x + 0.8, p.z + 0.8];
}

/* ---------------- Devi ---------------- */
const devi = {
  actor: null, glow: null, spot: null, rise: 1,
  init(scene){
    const a = this.actor = new Actor("devi", scene);
    a.ghost = true; a.rimBase = 0.15; a.mat.uniforms.uRim.value.set("#ff3a20");
    a.show(false, true);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: N.geom.glowTex(), color: 0xff2a14, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.glow.scale.set(14, 14, 1); scene.add(this.glow);
    this.light = new THREE.PointLight(0xff3020, 0, 40, 1.5); scene.add(this.light);
  },
  setSpot(spot, instant){
    this.spot = spot;
    if(spot){ this.actor.place(spot[0], spot[2]); this.actor.y = spot[1]; }
  },
  update(dt, t){
    const a = this.actor;
    a.speed = 0;
    if(this.spot){ a.x = this.spot[0]; a.z = this.spot[2]; a.y = this.spot[1] - (1 - this.rise) * a.H * 0.9; }
    a.mat.uniforms.uRed.value = 0.25 + 0.2 * Math.sin(t * Math.PI * 2 / 3.6);
    const vis = a.opacity;
    this.glow.position.set(a.x, a.y + a.H * 0.62, a.z);
    this.glow.material.opacity = vis * (0.35 + 0.2 * Math.sin(t * Math.PI * 2 / 3.6)) * (0.4 + N.sky.nightness() * 0.6);
    this.light.position.set(a.x, a.y + a.H * 0.6, a.z);
    this.light.intensity = vis * (8 + 4 * Math.sin(t * 1.7)) * (0.3 + N.sky.nightness());
  }
};

chars.init = function(scene){
  player.actor = new Actor("natsarkekia", scene);
  player.actor.rimBase = 0.35;
  for(const k of ["hunter", "elderwoman", "blacksmith"]){ const a = new Actor(k, scene); a.show(false, true); a.home = null; }
  devi.init(scene);
};

chars.update = function(dt, t, camera, input, camYaw, light){
  player.update(dt, input, camYaw);
  companions.update(dt);
  /* scripted walkers (cinematics / elder woman) */
  for(const a of chars.list){
    if(a.walkTo){ const d = a.steer(dt, a.walkTo[0], a.walkTo[1], a.walkSpeed || 3.2, 0.25); if(d < 0.3 && a.speed < 0.3){ const cb = a.onArrive; a.walkTo = null; a.onArrive = null; if(cb) cb(); } }
    else if(a !== player.actor && !chars.following(a.key) && a !== devi.actor){ a.speed = damp(a.speed, 0, 6, dt); a.vx = damp(a.vx, 0, 6, dt); a.vz = damp(a.vz, 0, 6, dt); }
  }
  devi.update(dt, t);
  for(const a of chars.list) a.update(dt, t, camera, light);
};
chars.following = (k) => companions.following.has(k);

N.chars = Object.assign(chars, { Actor, player, companions, devi, SIZES, safeNear });
})();
