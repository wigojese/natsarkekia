/* =====================================================================
   POST EFFECTS — light rays from the sun/moon (screen-space radial blur
   of bright pixels, so trees and hills cut real shafts), a soft lens
   flare that vanishes when the sun is hidden, and bloom on the sun,
   fires, windows, the beacon and Devi's glow. Off on Low quality.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const A = window.THREE_ADDONS;
const { clamp, smoothstep, lerp } = N;

const RaysShader = {
  uniforms: { tDiffuse: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.8) }, uI: { value: 0 }, uFlare: { value: 0 },
    uTint: { value: new THREE.Color(1, 0.85, 0.6) }, uAspect: { value: 1.6 }, uThresh: { value: 1.05 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uI, uFlare, uAspect, uThresh; uniform vec3 uTint; varying vec2 vUv;
    #ifndef SAMPLES
    #define SAMPLES 32
    #endif
    float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main(){
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec3 acc = vec3(0.0);
      if(uI > 0.001){
        vec2 delta = (vUv - uSun) * 0.92 / float(SAMPLES);
        vec2 p = vUv; float decay = 1.0;
        for(int i = 0; i < SAMPLES; i++){
          p -= delta;
          vec3 s = texture2D(tDiffuse, clamp(p, 0.001, 0.999)).rgb;
          acc += s * max(lum(s) - uThresh, 0.0) * decay;
          decay *= 0.955;
        }
        acc *= uI / float(SAMPLES) * 2.4;
      }
      vec3 fl = vec3(0.0);
      if(uFlare > 0.001){
        vec2 toC = vec2(0.5) - uSun;
        for(int k = 1; k <= 4; k++){
          float f = float(k) * 0.55;
          vec2 g = uSun + toC * f * 1.2;
          vec2 dd = (vUv - g) * vec2(uAspect, 1.0);
          float r = 0.02 + 0.025 * float(k);
          float disc = smoothstep(r, r * 0.55, length(dd));
          fl += disc * mix(vec3(1.0, 0.6, 0.3), vec3(0.45, 0.7, 1.0), float(k) / 4.0) * 0.07;
        }
        vec2 sd = (vUv - uSun) * vec2(uAspect, 1.0);
        fl += vec3(1.0, 0.85, 0.65) * exp(-abs(sd.y) * 260.0) * exp(-abs(sd.x) * 3.5) * 0.25;   // anamorphic streak
        fl *= uFlare;
      }
      gl_FragColor = vec4(base + acc * uTint + fl, 1.0);
    }`
};

const post = { enabled: false };
post.init = function(renderer, scene, camera){
  post.renderer = renderer; post.scene = scene; post.camera = camera;
  if(!A){ return; }
  const size = renderer.getSize(new THREE.Vector2());
  post.composer = new A.EffectComposer(renderer);
  post.composer.addPass(new A.RenderPass(scene, camera));
  post.rays = new A.ShaderPass(RaysShader);
  post.composer.addPass(post.rays);
  post.bloom = new A.UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.45, 0.55, 0.92);
  post.composer.addPass(post.bloom);
  post.composer.addPass(new A.OutputPass());
};
post.setQuality = function(q){
  post.enabled = !!post.composer && q !== "low";
  if(!post.composer) return;
  const samples = q === "high" ? 48 : 24;
  if(post.rays.material.defines.SAMPLES !== samples){ post.rays.material.defines.SAMPLES = samples; post.rays.material.needsUpdate = true; }
  post.bloom.enabled = true;
  post.q = q;
};
post.setSize = function(w, h){
  if(!post.composer) return;
  post.composer.setPixelRatio(post.renderer.getPixelRatio());
  post.composer.setSize(w, h);
};

const _p = new THREE.Vector3();
post.render = function(){
  if(!post.enabled){ post.renderer.render(post.scene, post.camera); return; }
  const sky = N.sky, cam = post.camera;
  /* where the sun (or moon) is on screen */
  _p.copy(cam.position).addScaledVector(sky.sunDir, 900).project(cam);
  const inFront = _p.z < 1;
  const sx = _p.x * 0.5 + 0.5, sy = _p.y * 0.5 + 0.5;
  const off = Math.max(Math.abs(_p.x), Math.abs(_p.y));
  const vis = inFront ? 1 - smoothstep(1.0, 1.6, off) : 0;
  const moon = sky.cur.moon > 0.5;
  const above = smoothstep(-0.03, 0.04, sky.sunDir.y);
  const base = moon ? 0.28 : 0.45 + sky.low * 0.75;
  const u = post.rays.uniforms;
  u.uSun.value.set(sx, sy);
  u.uI.value = base * vis * above * (1 - sky.moonCover);
  u.uThresh.value = moon ? 0.9 : 1.05;
  u.uTint.value.copy(sky.sun.color).lerp(new THREE.Color(1, 1, 1), 0.35);
  u.uAspect.value = cam.aspect;
  /* lens flare only when the sun disc itself is on screen and not hidden (checked one frame late via the previous image is costly → use a cheap ground test) */
  const onScreen = inFront && off < 0.95;
  u.uFlare.value = moon ? 0 : (onScreen ? (0.6 + sky.low * 0.6) * above * (1 - sky.moonCover) * (post.sunVisible ? 1 : 0) : 0);
  /* bloom: stronger at night (fires, windows, moon), softer at noon */
  const night = sky.nightness();
  post.bloom.strength = lerp(0.32, 0.8, night) + sky.low * 0.15;
  post.bloom.threshold = lerp(0.95, 0.78, night);
  post.composer.render();
};
/* is the sun disc blocked by terrain from the camera? (march the ray a bit) */
post.updateSunVisibility = function(){
  const cam = post.camera, d = N.sky.sunDir, T = N.terrain;
  let vis = d.y > -0.02;
  for(let s = 4; vis && s < 500; s *= 1.25){
    const x = cam.position.x + d.x * s, y = cam.position.y + d.y * s, z = cam.position.z + d.z * s;
    if(Math.abs(x) > T.HALF || Math.abs(z) > T.HALF) break;
    if(T.ground(x, z) > y) vis = false;
  }
  post.sunVisible = vis;
};

N.post = post;
})();
