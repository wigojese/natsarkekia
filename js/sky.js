/* =====================================================================
   SKY + LIGHT + TIME OF DAY — sky dome with the 2D presets' gradients,
   sun/moon, stars, clouds, fog, colour tint; blends between presets.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const { clamp, lerp, smoothstep, easeInOut } = N;
const PRESETS = N.data.PRESETS;

const sky = {};
const col = (h) => new THREE.Color(h);

function parseTint(s){ const m = s.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/); return [+m[1], +m[2], +m[3], +m[4]]; }
const PHASE = { day: { stars: 0, clouds: 0.5, hemi: 1.0, fogNear: 110, fogFar: 640 },
                dusk: { stars: 0.35, clouds: 0.22, hemi: 0.78, fogNear: 90, fogFar: 520 },
                night: { stars: 1, clouds: 0.08, hemi: 0.6, fogNear: 50, fogFar: 340 } };

/* numeric snapshot of a preset so presets can be blended */
function snap(key){
  const p = PRESETS[key], ph = PHASE[p.phase];
  const s = { key, sky: p.sky.map(col), left: p.sun.left, top: p.sun.top, c1: col(p.sun.color), c2: col(p.sun.color2), glow: p.sun.glow,
    moon: p.sun.type === "moon" ? 1 : 0, stars: ph.stars, clouds: ph.clouds, hemi: ph.hemi, fogNear: ph.fogNear, fogFar: ph.fogFar, tint: parseTint(p.tint), phase: p.phase };
  if(key === "catastrophe"){ s.fogNear = 30; s.fogFar = 230; s.hemi = 0.5; }
  if(key === "defeatashen"){ s.fogNear = 35; s.fogFar = 260; s.hemi = 0.45; }
  return s;
}
function mix(a, b, t){
  return { key: t < 0.5 ? a.key : b.key, phase: t < 0.5 ? a.phase : b.phase,
    sky: a.sky.map((c, i) => c.clone().lerp(b.sky[i], t)), left: lerp(a.left, b.left, t), top: lerp(a.top, b.top, t),
    c1: a.c1.clone().lerp(b.c1, t), c2: a.c2.clone().lerp(b.c2, t), glow: lerp(a.glow, b.glow, t), moon: lerp(a.moon, b.moon, t),
    stars: lerp(a.stars, b.stars, t), clouds: lerp(a.clouds, b.clouds, t), hemi: lerp(a.hemi, b.hemi, t),
    fogNear: lerp(a.fogNear, b.fogNear, t), fogFar: lerp(a.fogFar, b.fogFar, t), tint: a.tint.map((v, i) => lerp(v, b.tint[i], t)) };
}

/* §10: sun.left → azimuth 90°..270° (east → west), elevation = clamp((70 − top) × 1.3, −5, 85) */
function celestialDir(left, top){
  const az = (90 + left / 100 * 180) * Math.PI / 180;
  const el = clamp((70 - top) * 1.3, -5, 85) * Math.PI / 180;
  return { dir: new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)), el };
}

sky.init = function(scene){
  sky.scene = scene;
  /* ---- dome ---- */
  const uni = { uTop: { value: col("#3f6f9e") }, uMid: { value: col("#8fc1e3") }, uHor: { value: col("#e9f4f7") },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSun1: { value: col("#fff") }, uSun2: { value: col("#fff") },
    uGlow: { value: 30 }, uMoon: { value: 0 }, uCover: { value: 0 }, uTime: N.shared.uTime };
  sky.uni = uni;
  const domeMat = new THREE.ShaderMaterial({
    uniforms: uni, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uTop, uMid, uHor, uSunDir, uSun1, uSun2; uniform float uGlow, uMoon, uCover, uTime;
      varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        vec3 c;
        if(y >= 0.0){ c = y < 0.3 ? mix(uHor, uMid, smoothstep(0.0, 0.3, y)) : mix(uMid, uTop, smoothstep(0.3, 0.92, y)); }
        else c = mix(uHor, uHor * 0.62, smoothstep(0.0, -0.3, y));
        float ca = clamp(dot(d, normalize(uSunDir)), -1.0, 1.0);
        float ang = acos(ca);
        float rad = mix(0.042, 0.034, uMoon);
        float disc = 1.0 - smoothstep(rad, rad + 0.006, ang);
        float g = uGlow / 30.0;
        float halo = exp(-ang * 26.0 / g) * 0.75 + exp(-ang * 4.0) * 0.22 * g;
        halo *= mix(1.0, 0.35, uMoon);
        vec3 dc = mix(uSun1, uSun2, smoothstep(0.0, rad, ang));
        if(uMoon > 0.5){
          vec2 q = vec2(d.x - normalize(uSunDir).x, d.y - normalize(uSunDir).y) * 90.0;
          float cr = smoothstep(0.55, 0.9, hash(floor(q * 0.9))) * 0.18;
          dc = uSun1 * (1.0 - cr);
        }
        float vis = 1.0 - uCover;
        c += uSun2 * halo * vis * (y > -0.05 ? 1.0 : 0.3);
        c = mix(c, dc * 1.15, disc * vis * smoothstep(-0.06, 0.0, y + 0.03));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`
  });
  sky.dome = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 20), domeMat);
  sky.dome.renderOrder = -10; sky.dome.frustumCulled = false;
  scene.add(sky.dome);

  /* ---- stars ---- */
  const r = N.rng(77), n = 1400, sp = new Float32Array(n * 3), ss = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const u = r(), v = r() * 0.95 + 0.03, th = u * Math.PI * 2, y = v;
    const k = Math.sqrt(1 - y * y);
    sp[i * 3] = Math.cos(th) * k * 1000; sp[i * 3 + 1] = y * 1000; sp[i * 3 + 2] = Math.sin(th) * k * 1000; ss[i] = r();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); sg.setAttribute("seed", new THREE.BufferAttribute(ss, 1));
  sky.starUni = { uOpacity: { value: 0 }, uTime: N.shared.uTime, uPR: { value: 1 } };
  sky.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: sky.starUni, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float seed; uniform float uTime, uPR; varying float vA;
      void main(){ vA = 0.55 + 0.45 * sin(uTime * (1.0 + seed * 2.0) + seed * 40.0);
        gl_PointSize = (1.0 + seed * 1.8) * uPR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uOpacity; varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(c)); gl_FragColor = vec4(vec3(1.0, 0.97, 0.9), a * vA * uOpacity); }`
  }));
  sky.stars.renderOrder = -9; sky.stars.frustumCulled = false;
  scene.add(sky.stars);

  /* ---- clouds ---- */
  const puff = N.geom.puffTex();
  sky.clouds = [];
  for(let i = 0; i < 26; i++){
    const m = new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, fog: false, opacity: 0.5 });
    const s = new THREE.Sprite(m);
    const w = 160 + r() * 220; s.scale.set(w, w * (0.32 + r() * 0.15), 1);
    s.userData = { a: r() * Math.PI * 2, d: 420 + r() * 380, h: 150 + r() * 140, sp: (0.002 + r() * 0.003) * (r() < 0.5 ? 1 : 1) };
    s.renderOrder = -8;
    sky.clouds.push(s); scene.add(s);
  }

  /* ---- lights ---- */
  sky.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a4a32, 1.0);
  scene.add(sky.hemi);
  sky.sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sky.sun.castShadow = true;
  const sc = sky.sun.shadow.camera; sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 10; sc.far = 500;
  sky.sun.shadow.bias = -0.0006; sky.sun.shadow.normalBias = 0.05;
  scene.add(sky.sun); scene.add(sky.sun.target);
  /* player lantern (warm, mostly at night) */
  sky.lantern = new THREE.PointLight(0xffb36b, 0, 16, 1.6);
  scene.add(sky.lantern);

  scene.fog = new THREE.Fog(0xcccccc, 100, 600);
  sky.cur = snap("dawn"); sky.from = sky.cur; sky.to = sky.cur; sky.t = 1; sky.dur = 1; sky.key = "dawn";
  sky.moonCover = 0; sky.redFog = 0; sky.extraDark = 0;
  sky.charLight = new THREE.Color(1, 1, 1);
  sky.tintEl = document.getElementById("tint");
};

sky.setPreset = function(key, duration){
  if(!PRESETS[key]) return;
  sky.key = key;
  sky.from = sky.cur; sky.to = snap(key);
  sky.dur = duration == null ? 5 : duration; sky.t = sky.dur <= 0 ? 1 : 0;
  if(sky.dur <= 0) sky.cur = sky.to;
};

const _hc = new THREE.Color(), _fc = new THREE.Color(), _tmp = new THREE.Color();
sky.update = function(dt, camera, focus){
  if(sky.t < 1){ sky.t = Math.min(1, sky.t + dt / sky.dur); sky.cur = mix(sky.from, sky.to, easeInOut(sky.t)); }
  const c = sky.cur, u = sky.uni;
  u.uTop.value.copy(c.sky[0]); u.uMid.value.copy(c.sky[1]); u.uHor.value.copy(c.sky[2]);
  const cd = celestialDir(c.left, c.top);
  u.uSunDir.value.copy(cd.dir); u.uSun1.value.copy(c.c1); u.uSun2.value.copy(c.c2);
  u.uGlow.value = c.glow; u.uMoon.value = c.moon; u.uCover.value = sky.moonCover;
  sky.dome.position.copy(camera.position); sky.stars.position.copy(camera.position);
  sky.starUni.uOpacity.value = c.stars * (1 - sky.moonCover * 0.3);

  /* clouds circle slowly around the camera */
  const cloudCol = _tmp.copy(c.sky[2]).lerp(c.c1, 0.25).multiplyScalar(0.55 + 0.45 * (1 - c.stars));
  for(const s of sky.clouds){
    const d = s.userData; d.a += d.sp * dt;
    s.position.set(camera.position.x + Math.cos(d.a) * d.d, d.h, camera.position.z + Math.sin(d.a) * d.d);
    s.material.opacity = c.clouds * 1.2 + sky.moonCover * 0.5; s.material.color.copy(cloudCol);
  }

  /* lights */
  const elev = cd.el, lit = Math.max(elev, 0.12);
  const ldir = new THREE.Vector3(cd.dir.x, Math.sin(lit), cd.dir.z).normalize();
  const fx = focus ? focus.x : 0, fz = focus ? focus.z : 0, fy = focus ? focus.y : 0;
  sky.sun.position.set(fx + ldir.x * 220, fy + ldir.y * 220, fz + ldir.z * 220);
  sky.sun.target.position.set(fx, fy, fz);
  let sunI;
  if(c.moon > 0.5) sunI = 0.85 * (1 - sky.moonCover * 0.7);
  else sunI = (0.35 + 2.3 * Math.pow(clamp(Math.sin(elev), 0, 1), 0.55)) * smoothstep(-0.09, 0.08, elev) + 0.1;
  sunI *= (1 - sky.extraDark * 0.6);
  sky.sun.intensity = sunI;
  sky.sun.color.copy(c.c1).lerp(c.c2, 0.35);
  sky.hemi.color.copy(c.sky[1]).lerp(c.sky[2], 0.35);
  _hc.set(0x5a4a32).lerp(c.sky[2], 0.25); sky.hemi.groundColor.copy(_hc);
  sky.hemi.intensity = c.hemi * 1.25 * (1 - sky.extraDark * 0.4);
  sky.lantern.intensity = c.stars * 10;
  if(focus) sky.lantern.position.set(fx, fy + 2.4, fz);

  /* fog: horizon colour, tinted; dark red near Devi at night */
  _fc.copy(c.sky[2]).lerp(c.sky[1], 0.35);
  const t = c.tint; _tmp.setRGB(t[0] / 255, t[1] / 255, t[2] / 255, THREE.SRGBColorSpace);
  _fc.lerp(_fc.clone().multiply(_tmp), t[3]);
  if(sky.redFog > 0) _fc.lerp(_tmp.set("#3a0c0a"), sky.redFog * 0.8);
  sky.scene.fog.color.copy(_fc);
  sky.scene.fog.near = c.fogNear * (1 - sky.redFog * 0.35); sky.scene.fog.far = c.fogFar * (1 - sky.redFog * 0.3);

  /* colour-grade overlay (multiply) */
  if(sky.tintEl) sky.tintEl.style.backgroundColor = `rgba(${t[0] | 0},${t[1] | 0},${t[2] | 0},${t[3].toFixed(3)})`;

  /* light that billboards (characters) receive */
  const L = sky.charLight;
  L.copy(sky.hemi.color).multiplyScalar(sky.hemi.intensity * 0.62);
  _tmp.copy(sky.hemi.groundColor).multiplyScalar(sky.hemi.intensity * 0.15); L.add(_tmp);
  _tmp.copy(sky.sun.color).multiplyScalar(sunI * 0.33); L.add(_tmp);
  _tmp.set(0xffb36b).multiplyScalar(c.stars * 0.3); L.add(_tmp);
  const m = Math.max(L.r, L.g, L.b); if(m > 1.05) L.multiplyScalar(1.05 / m);
  if(m < 0.38) L.multiplyScalar(0.38 / Math.max(m, 0.01));
};
sky.nightness = () => sky.cur.stars;
sky.phase = () => sky.cur.phase;

N.sky = sky;
})();
