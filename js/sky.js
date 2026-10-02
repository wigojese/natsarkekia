/* =====================================================================
   SKY + LIGHT + TIME OF DAY — sky dome with the 2D presets' gradients
   plus atmospheric touches: sun-side horizon glow at sunrise/sunset,
   the pink "belt" opposite the sun, HDR sun disc (feeds bloom + light
   rays), phased moon with halo, Milky Way, twinkling stars, shooting
   stars, sun-lit clouds, valley mist, fog and colour tint.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const { clamp, lerp, smoothstep, easeInOut } = N;
const PRESETS = N.data.PRESETS;

const sky = {};
const col = (h) => new THREE.Color(h);

function parseTint(s){ const m = s.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/); return [+m[1], +m[2], +m[3], +m[4]]; }
const PHASE = { day: { stars: 0, clouds: 0.55, hemi: 1.0, fogNear: 120, fogFar: 680 },
                dusk: { stars: 0.35, clouds: 0.3, hemi: 0.8, fogNear: 95, fogFar: 560 },
                night: { stars: 1, clouds: 0.18, hemi: 0.62, fogNear: 55, fogFar: 360 } };
/* morning / evening valley mist per preset */
const MIST = { dawn: 0.55, morning: 0.28, midday1: 0, midday2: 0, afternoon1: 0, afternoon2: 0.12, evening: 0.25, dusk: 0.35, night: 0.4, deepnight: 0.45,
  victorydawn: 0.3, victorydamaged: 0.25, defeatashen: 0.5, catastrophe: 0.3 };

function snap(key){
  const p = PRESETS[key], ph = PHASE[p.phase];
  const s = { key, sky: p.sky.map(col), left: p.sun.left, top: p.sun.top, c1: col(p.sun.color), c2: col(p.sun.color2), glow: p.sun.glow,
    moon: p.sun.type === "moon" ? 1 : 0, stars: ph.stars, clouds: ph.clouds, hemi: ph.hemi, fogNear: ph.fogNear, fogFar: ph.fogFar,
    tint: parseTint(p.tint), phase: p.phase, mist: MIST[key] || 0 };
  if(key === "catastrophe"){ s.fogNear = 30; s.fogFar = 230; s.hemi = 0.55; s.clouds = 0.45; }
  if(key === "defeatashen"){ s.fogNear = 35; s.fogFar = 260; s.hemi = 0.5; s.clouds = 0.4; }
  return s;
}
function mix(a, b, t){
  return { key: t < 0.5 ? a.key : b.key, phase: t < 0.5 ? a.phase : b.phase,
    sky: a.sky.map((c, i) => c.clone().lerp(b.sky[i], t)), left: lerp(a.left, b.left, t), top: lerp(a.top, b.top, t),
    c1: a.c1.clone().lerp(b.c1, t), c2: a.c2.clone().lerp(b.c2, t), glow: lerp(a.glow, b.glow, t), moon: lerp(a.moon, b.moon, t),
    stars: lerp(a.stars, b.stars, t), clouds: lerp(a.clouds, b.clouds, t), hemi: lerp(a.hemi, b.hemi, t), mist: lerp(a.mist, b.mist, t),
    fogNear: lerp(a.fogNear, b.fogNear, t), fogFar: lerp(a.fogFar, b.fogFar, t), tint: a.tint.map((v, i) => lerp(v, b.tint[i], t)) };
}

/* §10: sun.left → azimuth 90°..270° (east → west), elevation = clamp((70 − top) × 1.3, −5, 85) */
function celestialDir(left, top){
  const az = (90 + left / 100 * 180) * Math.PI / 180;
  const el = clamp((70 - top) * 1.3, -5, 85) * Math.PI / 180;
  return { dir: new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)), el };
}

function cloudTex(seed){
  return N.geom.canvasTex(256, 128, (g, w, h) => {
    const r = N.rng(seed);
    for(let i = 0; i < 22; i++){
      const x = w * (0.18 + 0.64 * r()), y = h * (0.42 + 0.28 * r()) - Math.abs(x - w / 2) * 0.12, rr = h * (0.16 + 0.22 * r());
      const gr = g.createRadialGradient(x, y - rr * 0.2, rr * 0.1, x, y, rr);
      gr.addColorStop(0, "rgba(255,255,255,0.75)"); gr.addColorStop(0.55, "rgba(245,245,250,0.45)"); gr.addColorStop(1, "rgba(235,235,245,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    }
    /* flatter, slightly darker base */
    g.globalCompositeOperation = "source-atop";
    const lg = g.createLinearGradient(0, h * 0.35, 0, h); lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(1, "rgba(120,125,145,0.55)");
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
  });
}

sky.init = function(scene){
  sky.scene = scene;
  const uni = { uTop: { value: col("#3f6f9e") }, uMid: { value: col("#8fc1e3") }, uHor: { value: col("#e9f4f7") },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSun1: { value: col("#fff") }, uSun2: { value: col("#fff") },
    uGlow: { value: 30 }, uMoon: { value: 0 }, uCover: { value: 0 }, uTime: N.shared.uTime, uStars: { value: 0 }, uLow: { value: 0 }, uRed: { value: 0 } };
  sky.uni = uni;
  const domeMat = new THREE.ShaderMaterial({
    uniforms: uni, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uTop, uMid, uHor, uSunDir, uSun1, uSun2; uniform float uGlow, uMoon, uCover, uTime, uStars, uLow, uRed;
      varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm3(vec3 p){ return vn3(p) * 0.5 + vn3(p * 2.1) * 0.27 + vn3(p * 4.3) * 0.15 + vn3(p * 8.7) * 0.08; }
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        vec3 sd = normalize(uSunDir);
        vec3 c;
        if(y >= 0.0){ c = y < 0.3 ? mix(uHor, uMid, smoothstep(0.0, 0.3, y)) : mix(uMid, uTop, smoothstep(0.3, 0.92, y)); }
        else c = mix(uHor, uHor * 0.55, smoothstep(0.0, -0.3, y));
        /* atmosphere at golden hours: warm glow along the horizon on the sun's side, pink belt opposite */
        vec2 dh = normalize(d.xz + 1e-5), sh = normalize(sd.xz + 1e-5);
        float az = dot(dh, sh);
        float horizon = pow(1.0 - clamp(abs(y), 0.0, 1.0), 5.0);
        vec3 warm = mix(uSun2, vec3(1.0, 0.42, 0.16), 0.45);
        float day = 1.0 - uMoon;
        c += warm * horizon * pow(max(az, 0.0), 2.5) * uLow * 0.85 * day;
        c += warm * 0.25 * horizon * uLow * day;
        float belt = exp(-pow((y - 0.07) / 0.06, 2.0)) * pow(max(-az, 0.0), 1.5) * uLow * day;
        c = mix(c, vec3(0.86, 0.58, 0.66) * (0.6 + 0.4 * dot(c, vec3(0.33))), belt * 0.4);
        /* Milky Way and faint star haze at night */
        vec3 mwN = normalize(vec3(0.35, 0.55, 0.75));
        float band = exp(-pow(dot(d, mwN) / 0.2, 2.0));
        float neb = fbm3(d * 7.0 + 3.0);
        c += vec3(0.62, 0.66, 0.95) * band * smoothstep(0.35, 0.85, neb) * 0.22 * uStars * smoothstep(-0.02, 0.25, y) * (1.0 - uCover * 0.7);
        c += vec3(0.75, 0.55, 0.9) * band * smoothstep(0.55, 0.95, fbm3(d * 13.0)) * 0.08 * uStars * smoothstep(0.0, 0.25, y);
        /* sun / moon */
        float ca = clamp(dot(d, sd), -1.0, 1.0), ang = acos(ca);
        float rad = mix(0.04, 0.032, uMoon);
        float disc = 1.0 - smoothstep(rad, rad + 0.004, ang);
        float g = uGlow / 30.0, vis = 1.0 - uCover;
        float halo = exp(-ang * 24.0 / g) * 0.9 + exp(-ang * 5.0) * 0.25 * g + exp(-ang * 1.6) * 0.12 * uLow;
        halo *= mix(1.0, 0.32, uMoon);
        vec3 dc;
        if(uMoon > 0.5){
          /* moon: phase-lit disc with soft craters */
          vec3 up = abs(sd.y) > 0.95 ? vec3(1,0,0) : vec3(0,1,0);
          vec3 ux = normalize(cross(up, sd)), uy = cross(sd, ux);
          vec2 q = vec2(dot(d - sd, ux), dot(d - sd, uy)) / rad;
          float zz = sqrt(max(0.0, 1.0 - dot(q, q)));
          vec3 nrm = vec3(q, zz);
          float lit = smoothstep(-0.15, 0.25, dot(nrm, normalize(vec3(0.75, 0.35, 0.55))));
          float cr = fbm3(vec3(q * 3.0, 1.7));
          dc = uSun1 * (0.18 + 0.95 * lit) * (0.82 + 0.3 * cr) * 1.6;
          halo += smoothstep(0.17, 0.13, ang) * smoothstep(0.10, 0.13, ang) * 0.05;     // faint lunar ring
        } else {
          float limb = 1.0 - pow(clamp(ang / rad, 0.0, 1.0), 2.0) * 0.35;
          dc = mix(uSun1, uSun2, smoothstep(0.0, rad, ang) * 0.6) * 4.0 * limb;       // HDR: blooms and casts light rays
        }
        float above = smoothstep(-0.06, 0.01, y + 0.02);
        c += uSun2 * halo * vis * (y > -0.05 ? 1.0 : 0.3);
        c = mix(c, dc, disc * vis * above);
        c = mix(c, c * vec3(1.0, 0.45, 0.4), uRed * 0.5);
        c += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 160.0;     // dithering against banding
        gl_FragColor = vec4(max(c, 0.0), 1.0);
        #include <colorspace_fragment>
      }`
  });
  sky.dome = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), domeMat);
  sky.dome.renderOrder = -10; sky.dome.frustumCulled = false;
  scene.add(sky.dome);

  /* ---- stars ---- */
  const r = N.rng(77), n = 2400, sp = new Float32Array(n * 3), ss = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const u = r(), y = Math.pow(r(), 0.8) * 0.97 + 0.02, th = u * Math.PI * 2;
    const k = Math.sqrt(1 - y * y);
    sp[i * 3] = Math.cos(th) * k * 1000; sp[i * 3 + 1] = y * 1000; sp[i * 3 + 2] = Math.sin(th) * k * 1000; ss[i] = r();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); sg.setAttribute("seed", new THREE.BufferAttribute(ss, 1));
  sky.starUni = { uOpacity: { value: 0 }, uTime: N.shared.uTime, uPR: { value: 1 } };
  sky.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: sky.starUni, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `attribute float seed; uniform float uTime, uPR; varying float vA; varying vec3 vC;
      void main(){ vA = 0.55 + 0.45 * sin(uTime * (1.0 + seed * 2.5) + seed * 40.0);
        vC = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.65), fract(seed * 7.3));
        float big = step(0.985, seed);
        gl_PointSize = (1.0 + seed * 1.6 + big * 2.2) * uPR; vA *= 0.6 + big * 0.9;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uOpacity; varying float vA; varying vec3 vC;
      void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.05, length(c)); gl_FragColor = vec4(vC * 1.4, a * vA * uOpacity); }`
  }));
  sky.stars.renderOrder = -9; sky.stars.frustumCulled = false;
  scene.add(sky.stars);

  /* ---- shooting stars: a short fading streak ---- */
  const mg = new THREE.BufferGeometry();
  mg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
  mg.setAttribute("color", new THREE.BufferAttribute(new Float32Array([1, 0.95, 0.85, 1, 1, 0.95, 0.85, 0]), 4));
  sky.meteor = new THREE.Line(mg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  sky.meteor.frustumCulled = false; sky.meteor.renderOrder = -8; sky.meteor.visible = false;
  scene.add(sky.meteor);
  sky.meteorT = 6;

  /* ---- clouds (lit by the sun: warm edges at sunrise and sunset) ---- */
  const texs = [cloudTex(11), cloudTex(23), cloudTex(37)];
  sky.clouds = [];
  for(let i = 0; i < 34; i++){
    const m = new THREE.SpriteMaterial({ map: texs[i % 3], transparent: true, depthWrite: false, fog: false, opacity: 0.5, toneMapped: false });
    const s = new THREE.Sprite(m);
    const low = i < 10;                                           // a band of low clouds near the horizon
    const w = (low ? 300 : 170) + r() * 230; s.scale.set(w, w * (0.36 + r() * 0.14), 1);
    s.userData = { a: r() * Math.PI * 2, d: low ? 760 + r() * 120 : 380 + r() * 420, h: low ? 70 + r() * 60 : 150 + r() * 170, sp: 0.0015 + r() * 0.003 };
    s.renderOrder = -8;
    sky.clouds.push(s); scene.add(s);
  }

  /* ---- lights ---- */
  sky.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a4a32, 1.0);
  scene.add(sky.hemi);
  sky.sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sky.sun.castShadow = true;
  const sc = sky.sun.shadow.camera; sc.left = -52; sc.right = 52; sc.top = 52; sc.bottom = -52; sc.near = 10; sc.far = 520;
  sky.sun.shadow.bias = -0.0006; sky.sun.shadow.normalBias = 0.05;
  scene.add(sky.sun); scene.add(sky.sun.target);
  sky.lantern = new THREE.PointLight(0xffb36b, 0, 18, 1.6);
  scene.add(sky.lantern);

  scene.fog = new THREE.Fog(0xcccccc, 100, 600);
  sky.cur = snap("dawn"); sky.from = sky.cur; sky.to = sky.cur; sky.t = 1; sky.dur = 1; sky.key = "dawn";
  sky.moonCover = 0; sky.redFog = 0; sky.extraDark = 0;
  sky.charLight = new THREE.Color(1, 1, 1);
  sky.sunDir = new THREE.Vector3(0, 1, 0);
  sky.low = 0;
  sky.tintEl = document.getElementById("tint");
};

sky.setPreset = function(key, duration){
  if(!PRESETS[key]) return;
  sky.key = key;
  sky.from = sky.cur; sky.to = snap(key);
  sky.dur = duration == null ? 5 : duration; sky.t = sky.dur <= 0 ? 1 : 0;
  if(sky.dur <= 0) sky.cur = sky.to;
};

const _hc = new THREE.Color(), _fc = new THREE.Color(), _tmp = new THREE.Color(), _v = new THREE.Vector3();
sky.update = function(dt, camera, focus){
  if(sky.t < 1){ sky.t = Math.min(1, sky.t + dt / sky.dur); sky.cur = mix(sky.from, sky.to, easeInOut(sky.t)); }
  const c = sky.cur, u = sky.uni;
  u.uTop.value.copy(c.sky[0]); u.uMid.value.copy(c.sky[1]); u.uHor.value.copy(c.sky[2]);
  const cd = celestialDir(c.left, c.top);
  sky.sunDir.copy(cd.dir);
  /* how "golden-hour" the sun is: 1 at the horizon, 0 high up */
  sky.low = c.moon > 0.5 ? 0 : (1 - smoothstep(0.08, 0.5, Math.sin(cd.el))) * (1 - c.moon);
  u.uSunDir.value.copy(cd.dir); u.uSun1.value.copy(c.c1); u.uSun2.value.copy(c.c2);
  u.uGlow.value = c.glow; u.uMoon.value = c.moon; u.uCover.value = sky.moonCover; u.uStars.value = c.stars; u.uLow.value = sky.low; u.uRed.value = sky.redFog;
  sky.dome.position.copy(camera.position); sky.stars.position.copy(camera.position);
  sky.starUni.uOpacity.value = c.stars * (1 - sky.moonCover * 0.3);

  /* shooting stars */
  sky.meteorT -= dt;
  if(c.stars > 0.6 && sky.meteorT <= 0 && !sky.meteor.visible){
    const a = Math.random() * Math.PI * 2, el = 0.45 + Math.random() * 0.4;
    sky.meteor.userData = { p: new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).multiplyScalar(900),
      v: new THREE.Vector3(-Math.sin(a), -0.35, Math.cos(a)).normalize().multiplyScalar(520), t: 0 };
    sky.meteor.visible = true;
  }
  if(sky.meteor.visible){
    const m = sky.meteor.userData; m.t += dt;
    const head = _v.copy(m.p).addScaledVector(m.v, m.t), pa = sky.meteor.geometry.attributes.position;
    const tail = head.clone().addScaledVector(m.v, -0.16);
    pa.setXYZ(0, head.x + camera.position.x, head.y + camera.position.y, head.z + camera.position.z);
    pa.setXYZ(1, tail.x + camera.position.x, tail.y + camera.position.y, tail.z + camera.position.z); pa.needsUpdate = true;
    sky.meteor.material.opacity = Math.sin(Math.min(1, m.t / 0.8) * Math.PI) * c.stars;
    if(m.t > 0.8){ sky.meteor.visible = false; sky.meteorT = 5 + Math.random() * 12; }
  }

  /* clouds: drift around the camera; the side facing the sun glows warm at golden hours */
  const day = 1 - c.stars * 0.85;
  for(const s of sky.clouds){
    const d = s.userData; d.a += d.sp * dt;
    s.position.set(camera.position.x + Math.cos(d.a) * d.d, d.h, camera.position.z + Math.sin(d.a) * d.d);
    _v.set(Math.cos(d.a), 0.15, Math.sin(d.a)).normalize();
    const facing = Math.max(0, _v.dot(cd.dir)), f2 = Math.pow(facing, 2);
    const base = _tmp.copy(c.sky[2]).lerp(c.sky[1], 0.3).multiplyScalar(0.55 + 0.6 * day);
    s.material.color.copy(base).lerp(_hc.copy(c.c2).multiplyScalar(1.25), sky.low * (0.2 + 0.8 * f2));
    if(sky.low > 0) s.material.color.lerp(_hc.copy(c.sky[0]).lerp(c.sky[1], 0.5), sky.low * (1 - facing) * 0.6);
    if(c.moon > 0.5) s.material.color.lerp(_hc.set(0x1a1d33), 0.55);
    s.material.opacity = c.clouds * (0.75 + 0.45 * f2 * sky.low) + sky.moonCover * 0.5;
  }

  /* lights: long warm light at golden hours, cool moonlight at night */
  const elev = cd.el, lit = Math.max(elev, 0.1);
  const ldir = _v.set(cd.dir.x, Math.sin(lit), cd.dir.z).normalize();
  const fx = focus ? focus.x : 0, fz = focus ? focus.z : 0, fy = focus ? focus.y : 0;
  sky.sun.position.set(fx + ldir.x * 240, fy + ldir.y * 240, fz + ldir.z * 240);
  sky.sun.target.position.set(fx, fy, fz);
  let sunI;
  if(c.moon > 0.5) sunI = 0.95 * (1 - sky.moonCover * 0.7);
  else sunI = (0.55 + 2.2 * Math.pow(clamp(Math.sin(elev), 0, 1), 0.5)) * smoothstep(-0.09, 0.06, elev) + 0.12;
  sunI *= (1 - sky.extraDark * 0.6);
  sky.sun.intensity = sunI;
  sky.sun.color.copy(c.c1).lerp(c.c2, 0.35 + sky.low * 0.4);
  if(sky.low > 0) sky.sun.color.lerp(_tmp.set(0xff9a50), sky.low * 0.35);
  sky.hemi.color.copy(c.sky[1]).lerp(c.sky[2], 0.35);
  _hc.set(0x5a4a32).lerp(c.sky[2], 0.25); if(sky.low > 0) _hc.lerp(_tmp.set(0x8a5a3a), sky.low * 0.3);
  sky.hemi.groundColor.copy(_hc);
  sky.hemi.intensity = c.hemi * (1.2 - sky.low * 0.15) * (1 - sky.extraDark * 0.4);
  sky.lantern.intensity = c.stars * 10;
  if(focus) sky.lantern.position.set(fx, fy + 2.4, fz);

  /* fog: horizon colour (warmer at golden hours), tinted; dark red near Devi at night */
  _fc.copy(c.sky[2]).lerp(c.sky[1], 0.35);
  if(sky.low > 0) _fc.lerp(_tmp.copy(c.c2), sky.low * 0.22);
  const t = c.tint; _tmp.setRGB(t[0] / 255, t[1] / 255, t[2] / 255, THREE.SRGBColorSpace);
  _fc.lerp(_fc.clone().multiply(_tmp), t[3]);
  if(sky.redFog > 0) _fc.lerp(_tmp.set("#3a0c0a"), sky.redFog * 0.8);
  sky.scene.fog.color.copy(_fc);
  sky.scene.fog.near = c.fogNear * (1 - sky.redFog * 0.35); sky.scene.fog.far = c.fogFar * (1 - sky.redFog * 0.3);
  sky.fogColor = _fc;

  if(sky.tintEl) sky.tintEl.style.backgroundColor = `rgba(${t[0] | 0},${t[1] | 0},${t[2] | 0},${t[3].toFixed(3)})`;

  /* light that billboards (characters) receive */
  const L = sky.charLight;
  L.copy(sky.hemi.color).multiplyScalar(sky.hemi.intensity * 0.62);
  _tmp.copy(sky.hemi.groundColor).multiplyScalar(sky.hemi.intensity * 0.15); L.add(_tmp);
  _tmp.copy(sky.sun.color).multiplyScalar(sunI * 0.33); L.add(_tmp);
  _tmp.set(0xffb36b).multiplyScalar(c.stars * 0.3); L.add(_tmp);
  const m = Math.max(L.r, L.g, L.b); if(m > 1.05) L.multiplyScalar(1.05 / m);
  if(m < 0.4) L.multiplyScalar(0.4 / Math.max(m, 0.01));
};
sky.nightness = () => sky.cur.stars;
sky.mist = () => sky.cur.mist;
sky.phase = () => sky.cur.phase;

N.sky = sky;
})();
