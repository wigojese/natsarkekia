/* =====================================================================
   CORE — namespace, math helpers, seeded noise, settings, shared uniforms
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS = window.NATS || {};

/* ---------- math ---------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const wrapAngle = (a) => { while(a > Math.PI) a -= Math.PI * 2; while(a < -Math.PI) a += Math.PI * 2; return a; };
const dampAngle = (a, b, lambda, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/* ---------- seeded RNG (mulberry32) ---------- */
function rng(seed){
  let a = seed >>> 0;
  const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

/* ---------- 2D gradient noise (seeded permutation) ---------- */
function makeNoise(seed){
  const r = rng(seed), p = new Uint8Array(512), gx = new Float32Array(256), gy = new Float32Array(256);
  const perm = [...Array(256).keys()];
  for(let i = 255; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for(let i = 0; i < 512; i++) p[i] = perm[i & 255];
  for(let i = 0; i < 256; i++){ const a = r() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  function n2(x, y){
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const h00 = p[p[X] + Y], h10 = p[p[X + 1] + Y], h01 = p[p[X] + Y + 1], h11 = p[p[X + 1] + Y + 1];
    const d00 = gx[h00] * xf + gy[h00] * yf, d10 = gx[h10] * (xf - 1) + gy[h10] * yf;
    const d01 = gx[h01] * xf + gy[h01] * (yf - 1), d11 = gx[h11] * (xf - 1) + gy[h11] * (yf - 1);
    const u = fade(xf), v = fade(yf);
    return lerp(lerp(d00, d10, u), lerp(d01, d11, u), v) * 1.41;
  }
  function fbm(x, y, oct){
    let s = 0, a = 1, f = 1, n = 0;
    for(let i = 0; i < (oct || 4); i++){ s += n2(x * f, y * f) * a; n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  }
  return { n2, fbm };
}

/* ---------- polyline helpers ---------- */
/* returns { d, t, x, z, seg } — distance to polyline, arc-length position t */
function polyNearest(pts, x, z, lens){
  let best = 1e9, bt = 0, bx = 0, bz = 0, bs = 0, acc = 0;
  for(let i = 0; i < pts.length - 1; i++){
    const ax = pts[i][0], az = pts[i][1], bxx = pts[i + 1][0], bzz = pts[i + 1][1];
    const dx = bxx - ax, dz = bzz - az, L2 = dx * dx + dz * dz;
    let u = L2 > 0 ? ((x - ax) * dx + (z - az) * dz) / L2 : 0; u = clamp(u, 0, 1);
    const px = ax + dx * u, pz = az + dz * u, d = Math.hypot(x - px, z - pz);
    const L = lens ? lens[i] : Math.sqrt(L2);
    if(d < best){ best = d; bt = acc + u * L; bx = px; bz = pz; bs = i; }
    acc += L;
  }
  return { d: best, t: bt, x: bx, z: bz, seg: bs };
}
function polyLengths(pts){ const l = []; for(let i = 0; i < pts.length - 1; i++) l.push(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])); return l; }
/* Catmull-Rom resample so roads/rivers are smooth curves */
function smoothPolyline(pts, step){
  const out = [];
  for(let i = 0; i < pts.length - 1; i++){
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(L / step));
    for(let k = 0; k < n; k++){
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

/* ---------- settings (per-viewer conveniences only) ---------- */
const SETTINGS_KEY = "natsarkekia3d.settings";
const settings = { hints: true, sound: true, quality: null, reducedMotion: false, tutorialSeen: false };
try{
  const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  Object.assign(settings, s);
}catch(e){}
try{ if(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches && !("reducedMotionSet" in settings)) settings.reducedMotion = true; }catch(e){}
function saveSettings(){ try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }catch(e){} }

/* ---------- shared shader uniforms ---------- */
const shared = { uTime: { value: 0 }, uWind: { value: 1 } };

/* ---------- small event bus ---------- */
const listeners = {};
const on = (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn);
const emit = (ev, a, b) => (listeners[ev] || []).forEach(fn => fn(a, b));

const isTouch = (("ontouchstart" in window) || navigator.maxTouchPoints > 0) && matchMedia("(pointer: coarse)").matches;

Object.assign(N, { clamp, lerp, smoothstep, damp, dampAngle, wrapAngle, easeInOut, dist2, rng, makeNoise,
  polyNearest, polyLengths, smoothPolyline, settings, saveSettings, shared, on, emit, isTouch });
})();
