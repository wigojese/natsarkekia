/* =====================================================================
   BOOT + MAIN LOOP — renderer, quality levels + automatic governor,
   event wiring, title fly-over, debug/test API (window.__NATS__).
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const D = N.data, T = N.terrain, TX = D.TEXT;
const ui = N.ui, game = N.game;

function webglOK(){
  try{ const c = document.createElement("canvas"); return !!(window.WebGL2RenderingContext && c.getContext("webgl2")); }catch(e){ return false; }
}

let renderer, scene, camera, clock, fpsHist = [], lowFpsT = 0, frames = 0, fpsVal = 60, fpsAcc = 0;
const QUALITY = {
  low:    { pr: 1, shadow: 0, grass: true },
  medium: { pr: 1.5, shadow: 1024 },
  high:   { pr: 2, shadow: 2048 }
};
function applyQuality(q){
  if(!QUALITY[q]) return;
  N.settings.quality = q;
  const Q = QUALITY[q];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr, 2));
  const sun = N.sky.sun;
  if(Q.shadow){
    renderer.shadowMap.enabled = true; sun.castShadow = true;
    if(sun.shadow.mapSize.x !== Q.shadow){ sun.shadow.mapSize.set(Q.shadow, Q.shadow); if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; } }
  } else { sun.castShadow = false; }
  N.world.setQuality(q);
  document.body.classList.remove("q-low", "q-medium", "q-high"); document.body.classList.add("q-" + q);
  scene.traverse(o => { if(o.material && o.material.needsUpdate !== undefined && o.isMesh) o.material.needsUpdate = true; });
  N.saveSettings();
}
function resize(){
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 62 : 50;
  camera.updateProjectionMatrix();
  N.sky.starUni.uPR.value = renderer.getPixelRatio();
}

/* ---------------- pause menu ---------------- */
function openPause(){
  if(game.mode === "TITLE" || game.mode === "CINEMATIC" || ui.pauseOpen()) return;
  if(ui.bigmapOpen()){ ui.setBigmap(false); return; }
  game.paused = true; N.controls.releasePointer(); N.controls.clear();
  const render = () => ui.showPause({
    canBack: game.NAV.length > 0 && game.mode !== "TITLE", canUnstick: game.mode === "EXPLORE",
    onAction: (a) => {
      N.audio.click();
      if(a === "resume"){ closePause(); }
      else if(a === "back"){ closePause(); game.goBack(); }
      else if(a === "unstick"){ closePause(); game.unstick(); }
      else if(a === "restart"){ closePause(); game.restart(); }
      else if(a === "hints"){ N.settings.hints = !N.settings.hints; N.saveSettings(); if(!N.settings.hints) ui.hintLine(null); render(); }
      else if(a === "sound"){ toggleSound(); render(); }
      else if(a === "gfx"){ const order = ["low", "medium", "high"]; applyQuality(order[(order.indexOf(N.settings.quality) + 1) % 3]); game.autoQualityOff = true; render(); }
      else if(a === "motion"){ N.settings.reducedMotion = !N.settings.reducedMotion; N.settings.reducedMotionSet = true; N.saveSettings(); document.body.classList.toggle("reduced", N.settings.reducedMotion); render(); }
    }
  });
  render();
}
function closePause(){ ui.hidePause(); game.paused = false; }
function toggleSound(){ N.settings.sound = !N.settings.sound; N.saveSettings(); N.audio.resume(); N.audio.setMuted(!N.settings.sound); ui.updateSoundBtn(); }

/* ---------------- boot ---------------- */
function boot(){
  if(!webglOK()){ ui.error(TX.webglError); return; }
  try{
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  }catch(e){ ui.error(TX.webglError); return; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("view").appendChild(renderer.domElement);
  renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); ui.error(TX.webglError); });

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2400);
  N.sky.init(scene);
  N.world.build(scene);
  N.chars.init(scene);
  N.rig.init(camera);
  N.guide.init(scene);
  N.controls.init(renderer.domElement);
  ui.init();
  N.three = { renderer, scene, camera };

  /* footsteps tied to the walk bob and the ground under the feet */
  N.chars.player.actor.onStep = (a) => { if(game.mode === "EXPLORE") N.audio.step(N.chars.player.wading ? "water" : T.surfaceType(a.x, a.z)); };
  N.world.splash = (x, y, z) => { const e = { pos: [x, y + 0.1, z], life: 0.9, rise: 0.6, size: 0.6, alpha: 0.5, color: [0.92, 0.96, 1.0] }; N.world._emit ? N.world._emit(e) : null; };

  /* events */
  N.on("interact", () => { N.audio.resume(); if(ui.pauseOpen()) return; game.interact(); });
  N.on("choose", (i) => { if(game.mode === "DIALOGUE" && !game.paused) game.choose(i); });
  N.on("hint", () => { if(game.mode === "EXPLORE" && !game.paused){ N.guide.breadcrumb(N.chars.player.actor.x, N.chars.player.actor.z); N.audio.click(); } });
  N.on("map", () => { if(game.mode === "EXPLORE" && !game.paused){ ui.setBigmap(!ui.bigmapOpen()); N.audio.click(); } else if(ui.bigmapOpen()) ui.setBigmap(false); });
  N.on("unstick", () => { if(game.mode === "EXPLORE" && !game.paused) game.unstick(); });
  N.on("pause", () => { if(ui.pauseOpen()) closePause(); else openPause(); });
  N.on("togglesound", toggleSound);
  N.on("anyinput", () => N.audio.resume());
  document.addEventListener("pointerdown", () => N.audio.resume(), { once: false });

  document.body.classList.toggle("reduced", !!N.settings.reducedMotion);
  const q = N.settings.quality || (N.isTouch ? "low" : "medium");
  applyQuality(q);
  window.addEventListener("resize", () => { resize(); setTimeout(() => game.reframe(), 50); }); resize();
  document.getElementById("game").addEventListener("scroll", (e) => { e.target.scrollTop = 0; e.target.scrollLeft = 0; });

  /* title: slow fly-over of the village at dawn */
  N.sky.setPreset("dawn", 0);
  N.chars.player.actor.place(334, 126);
  for(const k of ["hunter", "elderwoman", "blacksmith"]){ const o = N.world.oakSpots[k], a = N.chars.byKey[k]; a.place(o[0], o[1]); a.show(true, true); }
  camera.position.set(250, 40, 160); N.rig.target.set(318, 8, 118);
  N.rig.startOrbit(new THREE.Vector3(312, 10, 116), 70, 26, 0.03);

  clock = new THREE.Clock();
  renderer.setAnimationLoop(loop);
  setTimeout(() => {
    ui.loaded();
    ui.showTitle(() => { N.audio.resume(); N.audio.click(); game.start(); });
  }, 120);
}

/* ---------------- loop ---------------- */
let simT = 0;
function loop(){
  const rawDt = Math.min(clock.getDelta(), 0.1);
  const dt = game.paused ? 0 : rawDt;
  simT += dt;
  N.shared.uTime.value = simT;
  N.controls.update();
  const look = N.controls.consumeLook();
  const P = N.chars.player.actor;
  const camYaw = N.rig.mode === "follow" ? N.rig.yaw : N.rig.groundYaw();
  const exploring = game.mode === "EXPLORE" && !game.paused;
  N.chars.update(dt, simT, camera, exploring ? N.controls.input : { x: 0, y: 0, run: false }, camYaw, N.sky.charLight);
  if(exploring && N.controls.input.active) ui.closeTutorial();
  N.rig.update(rawDt, game.paused ? [0, 0, 0] : look, { x: P.x, y: P.y, z: P.z });
  N.cine.update(dt);
  game.update(dt);
  /* red fog close to Devi's cave at night */
  const dc = Math.hypot(P.x + 334, P.z + 298);
  N.sky.redFog = (1 - N.smoothstep(40, 140, dc)) * N.sky.nightness() + (game.mode === "FINAL" && game.result && game.result.catastrophe ? 0.5 : 0);
  N.sky.update(rawDt, camera, P);
  const fire = N.world.nearestFire(P.x, P.z);
  N.world.update(dt, simT, { camera, focus: P, renderer });
  N.guide.update(rawDt, simT, { player: P, camera, camYaw, exploring, hudVisible: !document.getElementById("hud").hidden,
    companions: [...N.chars.companions.following].map(k => N.chars.byKey[k]), playerVX: P.vx, playerVZ: P.vz, moving: P.speed > 0.4 });
  const dv = N.chars.devi.actor;
  N.audio.update(rawDt, { night: N.sky.nightness(), paused: game.paused, fire: fire ? Math.max(0, 1 - fire.d / 18) : 0,
    devi: dv.opacity * Math.max(0, 1 - Math.hypot(dv.x - P.x, dv.z - P.z) / 140) });
  renderer.render(scene, camera);
  /* fps + automatic quality governor (drops a level if < 40 fps for 3 s) */
  frames++; fpsAcc += rawDt;
  if(fpsAcc >= 0.5){ fpsVal = frames / fpsAcc; frames = 0; fpsAcc = 0;
    if(!game.autoQualityOff && game.mode !== "TITLE" && document.visibilityState === "visible"){
      if(fpsVal < 40) lowFpsT += 0.5; else lowFpsT = 0;
      if(lowFpsT >= 3){ lowFpsT = 0; const order = ["low", "medium", "high"], i = order.indexOf(N.settings.quality); if(i > 0) applyQuality(order[i - 1]); }
    }
  }
}

/* ---------------- debug / test API ---------------- */
window.__NATS__ = {
  getState(){
    const P = N.chars.player.actor;
    return { mode: game.mode, paused: game.paused, objective: game.objective, current: game.current, preset: game.preset, skyKey: N.sky.key,
      S: JSON.parse(JSON.stringify(game.S)), nav: game.NAV.length, player: { x: P.x, y: P.y, z: P.z },
      following: [...N.chars.companions.following], visible: N.chars.list.filter(a => a.targetOpacity > 0.5).map(a => a.key),
      devi: N.chars.devi.actor.targetOpacity > 0.5, dialogueOpen: !document.getElementById("dialogue").hidden,
      bridgeOpen: !document.getElementById("bridge").hidden, finalOpen: !document.getElementById("final").hidden,
      result: game.result, damage: N.world.damage, prompt: document.getElementById("prompt").classList.contains("on") || document.getElementById("btn-talk").classList.contains("on") };
  },
  getObjective(){ return game.objectiveInfo(); },
  teleportToSite(stageId){
    const step = D.STAGES[stageId] ? D.STAGES[stageId].step : +stageId; if(!step) return false;
    const f = N.world.frames[step], p = f.at(0, -2.5), s = N.chars.safeNear(p[0], p[1], { x: f.x, z: f.z });
    N.chars.player.actor.place(s[0], s[1]);
    N.rig.target.set(s[0], T.walkHeight(s[0], s[1]) + 1.5, s[1]); N.rig.yaw = Math.atan2(-f.bx, -f.bz);
    [...N.chars.companions.following].forEach((k, i) => { const a = N.chars.byKey[k], lat = (i - 1) * 2.2, q = N.chars.safeNear(s[0] - f.bx * 2.2 - f.bz * lat, s[1] - f.bz * 2.2 + f.bx * lat, { x: s[0], z: s[1] }); a.place(q[0], q[1]); });
    return true;
  },
  interact(){ return game.interact(); },
  answer(i){ return game.choose(i); },
  back(){ return game.goBack(); },
  skipCinematic(){ return N.cine.skip(); },
  continue(){ return game.continueBridge(); },
  start(){ return game.start(); },
  setQuality(level){ applyQuality(level); game.autoQualityOff = true; return N.settings.quality; },
  fps(){ return Math.round(fpsVal * 10) / 10; },
  hint(){ return N.guide.breadcrumb(N.chars.player.actor.x, N.chars.player.actor.z); },
  drawCalls(){ return renderer.info.render.calls; },
  info(){ return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, terrainMs: N.terrainBuildMs }; }
};

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(() => setTimeout(boot, 30)));
else requestAnimationFrame(() => setTimeout(boot, 30));
})();
