/* =====================================================================
   CINEMATICS — the five bridges as short in-engine scenes (letterbox,
   camera moves, a parchment card) and the final tableau.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const D = N.data, SC = N.scoring, T = N.terrain;
const { clamp, lerp, smoothstep, easeInOut } = N;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const COMP = ["hunter", "elderwoman", "blacksmith"];
const actor = (k) => k === "natsarkekia" ? N.chars.player.actor : k === "devi" ? N.chars.devi.actor : N.chars.byKey[k];
const cine = { active: null };

function around(P, look, i, n){
  /* gather spots in a loose arc in front of / beside Natsarkekia */
  const right = { x: -look.z, z: look.x }, lat = [-1.9, 1.9, 0.2][i] * (n === 1 ? 0.8 : 1), dep = [0.8, 0.9, 1.9][i];
  return [P.x + right.x * lat - look.x * dep, P.z + right.z * lat - look.z * dep];
}

const SCRIPTS = {
  "bridge-team-full": (c) => {
    const P = actor("natsarkekia"), f = N.world.frames[2], look = { x: f.bx, z: f.bz };
    COMP.forEach((k, i) => { const a = actor(k); a.scripted = true; a.ghost = true; a.walkTo = around(P, look, i, 3); a.walkSpeed = 2.6; a.wave = false; });
    const center = V3(P.x, P.y + 1.2, P.z);
    N.rig.camera.position.set(P.x - look.x * 9 + 2, P.y + 3.2, P.z - look.z * 9);
    N.rig.target.copy(center); N.rig.startOrbit(center, 9, 3.0, 0.13);
    return { cardAt: 2.2 };
  },
  "bridge-team-weak": (c) => {
    const P = actor("natsarkekia"), f = N.world.frames[2], look = { x: f.bx, z: f.bz };
    const h = actor("hunter"); h.scripted = true; h.ghost = true; h.walkTo = around(P, look, 1, 1); h.walkSpeed = 2.6;
    for(const k of ["elderwoman", "blacksmith"]){ const a = actor(k); a.wave = true; a.lookAt = [P.x, P.z]; }
    const o = N.world.oakPos;
    const mx = (P.x + o[0]) / 2, mz = (P.z + o[2]) / 2;
    N.rig.shotTo(V3(mx - look.x * 8 - look.z * 3, P.y + 2.6, mz - look.z * 8 + look.x * 3), V3(mx, P.y + 1.2, mz), 0.9);
    c.later(1.0, () => N.rig.shotTo(V3(mx - look.x * 20 - look.z * 8, P.y + 9, mz - look.z * 20 + look.x * 8), V3(mx, P.y + 1, mz), 7));
    return { cardAt: 2.4 };
  },
  "bridge-solo": (c) => {
    const g = N.world.gate, P = actor("natsarkekia");
    const out = { x: g.out[0], z: g.out[1] };              // pointing from the village centre out through the gate
    c.fadeSwap(() => {
      P.place(g.x + out.x * 1.5, g.z + out.z * 1.5);
      N.chars.player.heading = Math.atan2(out.x, out.z);
      P.lookAt = [g.x + out.x * 30, g.z + out.z * 30];
      N.rig.mode = "shot";
      const back = V3(P.x - out.x * 4, P.y + 2.0, P.z - out.z * 4);
      N.rig.camera.position.copy(back); N.rig.target.set(P.x + out.x * 4, P.y + 1.3, P.z + out.z * 4);
      N.rig.shotTo(back, N.rig.target.clone(), 0.01);
      c.later(0.2, () => N.rig.shotTo(V3(P.x - out.x * 13, P.y + 10, P.z - out.z * 13), V3(P.x + out.x * 14, P.y, P.z + out.z * 14), 8));
    });
    return { cardAt: 2.0 };
  },
  "bridge-delayed": (c) => {
    const g = N.world.gate, P = actor("natsarkekia"), out = { x: g.out[0], z: g.out[1] };
    c.fadeSwap(() => {
      P.place(g.x - out.x * 2, g.z - out.z * 2); P.lookAt = null;
      const look = { x: out.x, z: out.z };
      COMP.forEach((k, i) => {
        const a = actor(k); const from = [g.x - out.x * (12 + i * 2) + out.z * (i - 1) * 3, g.z - out.z * (12 + i * 2) - out.x * (i - 1) * 3];
        a.place(from[0], from[1]); a.show(true, true); a.scripted = true; a.ghost = true; a.walkTo = around(P, { x: -look.x, z: -look.z }, i, 3); a.walkSpeed = 2.2;
      });
      const center = V3(P.x, P.y + 1.2, P.z);
      N.rig.camera.position.set(P.x + out.x * 9, P.y + 3, P.z + out.z * 9); N.rig.target.copy(center);
      N.rig.startOrbit(center, 9.5, 3.2, 0.1);
    });
    return { cardAt: 2.4 };
  },
  "bridge-battle": (c) => {
    const f = N.world.frames[10], P = actor("natsarkekia"), dv = N.chars.devi;
    dv.setSpot(N.world.devSpots[10]); dv.rise = 0.12; dv.actor.show(true, false);
    const look = { x: f.bx, z: f.bz };
    const cm = N.world.caveMouth;
    N.rig.shotTo(V3(P.x - look.x * 7 - look.z * 2, P.y + 1.4, P.z - look.z * 7 + look.x * 2), V3(cm[0], cm[1] + 4.5, cm[2]), 1.2);
    c.update = (t, dt) => {
      N.sky.moonCover = smoothstep(0.2, 2.6, t);
      N.sky.extraDark = smoothstep(0.2, 2.6, t) * 0.6;
      dv.rise = lerp(0.12, 1, easeInOut(smoothstep(1.0, 3.6, t)));
      if(t > 1.0 && !c._r){ c._r = true; N.audio.rumble(); N.rig.shake = 1.3; }
    };
    return { cardAt: 3.4, skip: () => { N.sky.moonCover = 1; N.sky.extraDark = 0.6; dv.rise = 1; } };
  }
};

cine.playBridge = function(id){
  const g = N.game;
  g.mode = "CINEMATIC"; g.current = id; g.busy = false; g.busy2 = false;
  document.body.classList.remove("exploring");
  SC.addBridgeStory(g.S, id);
  N.ui.hud(false); N.ui.letterbox(true); N.guide.hide(); N.ui.prompt(false);
  N.sky.setPreset(D.BRIDGE_PRESET[id], 3); g.preset = D.BRIDGE_PRESET[id]; N.audio.setChord(g.preset);
  N.world.setVariant(6, g.S.path === "solo" ? "solo" : "team"); N.world.setVariant(8, g.S.path === "solo" ? "solo" : "team");
  N.ui.setRoster(g.S.roster);
  const c = { t: 0, id, timers: [], cardShown: false,
    later(at, fn){ this.timers.push({ at, fn }); },
    fadeSwap(fn){ this.timers.push({ at: 0, fn: async () => { await N.ui.fade(true, 300); fn(); await N.ui.fade(false, 500); } }); } };
  const s = SCRIPTS[id](c);
  c.cardAt = s.cardAt; c.skipFn = s.skip;
  cine.active = c;
};
cine.showCard = function(){
  const c = cine.active; if(!c || c.cardShown) return;
  c.cardShown = true;
  N.ui.showBridge(c.id, () => N.game.continueBridge(), () => N.game.goBack());
};
cine.skip = function(){
  if(cine.skipShot()) return true;
  const c = cine.active; if(!c) return false;
  for(const tm of c.timers) if(!tm.done){ tm.done = true; tm.fn(); }
  if(c.skipFn) c.skipFn();
  c.t = Math.max(c.t, c.cardAt);
  cine.showCard();
  return true;
};
cine.update = function(dt){
  cine.updateShot(dt);
  const c = cine.active; if(!c) return;
  c.t += dt;
  for(const tm of c.timers) if(!tm.done && c.t >= tm.at){ tm.done = true; tm.fn(); }
  if(c.update) c.update(c.t, dt);
  if(c.t >= c.cardAt) cine.showCard();
};
/* leaving a bridge: hand control back (bridge-delayed resumes at Devi's trail, §9) */
cine.finishBridge = async function(id){
  const c = cine.active;
  if(c && c.skipFn) c.skipFn();
  cine.active = null;
  for(const k of COMP){ const a = actor(k); a.scripted = false; a.walkTo = null; a.ghost = false; a.wave = false; }
  actor("natsarkekia").lookAt = null;
  N.sky.moonCover = 0; N.sky.extraDark = 0;
  if(id === "bridge-delayed"){
    await N.ui.fade(true, 450);
    const f5 = N.world.frames[5], t = T.roadT(f5.x, f5.z), p = T.roadPointAt(t - 34);
    const s = N.chars.safeNear(p[0], p[1], { x: p[0], z: p[1] });
    actor("natsarkekia").place(s[0], s[1]);
    N.chars.player.heading = Math.atan2(f5.x - s[0], f5.z - s[1]);
    N.rig.mode = "follow"; N.rig.yaw = Math.atan2(s[0] - f5.x, s[1] - f5.z); N.rig.pitch = 0.3; N.rig.wantDist = N.rig.curDist = 7.5;
    N.rig.target.set(s[0], T.walkHeight(s[0], s[1]) + 1.5, s[1]);
    COMP.forEach(k => actor(k).show(false, true));     // re-placed around him by syncCompanions
    setTimeout(() => N.ui.fade(false, 600), 80);
  }
};
/* =====================================================================
   SHORT CINEMATIC SHOTS during exploration (skippable with any key/tap):
   intro sunrise, establishing flyover to the next site, the stage-3
   observation of Devi from the lookout, and hill-top panoramas.
   ===================================================================== */
cine.shot = null;
const lb = (on) => N.ui.letterbox(on);
function beginShot(kind, dur, update, onEnd, opts){
  endShot(true);
  cine.shot = { kind, t: 0, dur, update, onEnd, opts: opts || {} };
  N.chars.player.locked = true; N.controls.clear(); N.controls.releasePointer();
  lb(true);
  if(!(opts && opts.keepHud)) N.ui.hud(false);
}
function endShot(silent){
  const sh = cine.shot; if(!sh) return;
  cine.shot = null;
  N.rig.path = null; if(N.rig.mode === "path" || N.rig.mode === "manual") N.rig.mode = "shot";
  lb(false);
  N.rig.fovTarget = null;
  if(sh.opts.restore !== false && N.game.mode === "EXPLORE"){ N.ui.hud(true); N.chars.player.locked = false; N.rig.follow(); N.rig.pitch = Math.min(N.rig.pitch, 0.45); N.rig.wantDist = N.rig.curDist = Math.min(N.rig.wantDist, 8); }
  if(!silent && sh.onEnd) sh.onEnd();
  else if(silent && sh.opts.always && sh.onEnd) sh.onEnd();
}
cine.flying = () => !!cine.shot && cine.shot.kind !== "observe";
cine.endFly = () => { if(cine.shot && cine.shot.kind !== "observe") endShot(false); };
cine.skipShot = () => { if(cine.shot){ if(cine.shot.kind === "observe") cine.shot.t = Math.max(cine.shot.t, cine.shot.dur - 0.01); else endShot(false); return true; } return false; };
["keydown", "pointerdown", "touchstart"].forEach(ev => window.addEventListener(ev, (e) => {
  if(!cine.shot || cine.shot.t < 0.4) return;
  if(e.type === "keydown" && (e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD" || e.code.startsWith("Arrow") || e.code === "KeyE" || e.code === "Enter" || e.code === "Space" || e.code === "Escape")) cine.skipShot();
  else if(e.type !== "keydown") cine.skipShot();
}, { passive: true }));

function followKey(P, towardX, towardZ){
  const dx = towardX - P.x, dz = towardZ - P.z, L = Math.hypot(dx, dz) || 1;
  const yaw = Math.atan2(-dx / L, -dz / L), pitch = 0.3, d = 7.5;
  N.rig.yaw = yaw; N.rig.pitch = pitch; N.rig.wantDist = N.rig.curDist = d;
  return { p: V3(P.x + Math.sin(yaw) * Math.cos(pitch) * d, P.y + 1.5 + Math.sin(pitch) * d, P.z + Math.cos(yaw) * Math.cos(pitch) * d), l: V3(P.x, P.y + 1.5, P.z) };
}
const gy = (x, z, up) => T.ground(x, z) + (up || 0);

/* establishing flyover: from Natsarkekia over the land to the next site, and back */
cine.flyover = function(step){
  if(!step || N.settings.reducedMotion || N.game.mode !== "EXPLORE") return;
  const P = actor("natsarkekia"), S = D.SITES[step].pos;
  const dx = S[0] - P.x, dz = S[1] - P.z, dist = Math.hypot(dx, dz) || 1, ux = dx / dist, uz = dz / dist, lx = -uz, lz = ux;
  const mx = P.x + dx * 0.5, mz = P.z + dz * 0.5, sy = gy(S[0], S[1]);
  const keys = [
    { p: V3(P.x - ux * 7, P.y + 5, P.z - uz * 7), l: V3(P.x + ux * 12, P.y + 2, P.z + uz * 12) },
    { p: V3(mx + lx * 20, Math.max(gy(mx, mz), P.y, sy) + 20 + dist * 0.08, mz + lz * 20), l: V3(P.x + dx * 0.75, sy + 3, P.z + dz * 0.75) },
    { p: V3(S[0] - ux * 26 + lx * 11, Math.max(gy(S[0] - ux * 26, S[1] - uz * 26), sy) + 9, S[1] - uz * 26 + lz * 11), l: V3(S[0], sy + 3.5, S[1]) },
    { p: V3(S[0] - ux * 18 - lx * 6, Math.max(gy(S[0] - ux * 18, S[1] - uz * 18), sy) + 6, S[1] - uz * 18 - lz * 6), l: V3(S[0], sy + 3, S[1]) },
    followKey(P, S[0], S[1])
  ];
  beginShot("fly", 7.2 + Math.min(dist / 70, 2.2), null, null);
  N.rig.playPath(keys, cine.shot.dur, () => endShot(false));
};

/* sunrise over the village when the journey starts */
cine.intro = function(onEnd){
  if(N.settings.reducedMotion){ if(onEnd) onEnd(); return; }
  const P = actor("natsarkekia"), V = T.VILLAGE, sd = N.sky.sunDir, sl = Math.hypot(sd.x, sd.z) || 1, sx = sd.x / sl, sz = sd.z / sl;
  N.rig.camera.position.set(V.x - sx * 80, gy(V.x, V.z) + 26, V.z - sz * 80);
  N.rig.target.set(V.x + sx * 20, gy(V.x, V.z) + 8, V.z + sz * 20);
  const keys = [
    { p: V3(V.x - sx * 60 - sz * 20, gy(V.x, V.z) + 16, V.z - sz * 60 + sx * 20), l: V3(V.x + sx * 25, gy(V.x, V.z) + 7, V.z + sz * 25) },
    { p: V3(V.x - sx * 30 - sz * 26, gy(V.x, V.z) + 9, V.z - sz * 30 + sx * 26), l: V3(V.x, gy(V.x, V.z) + 4, V.z) },
    { p: V3(P.x - 9, P.y + 4, P.z + 6), l: V3(P.x, P.y + 1.4, P.z) },
    followKey(P, D.SITES[1].pos[0], D.SITES[1].pos[1])
  ];
  beginShot("intro", 9, null, onEnd, { always: true });
  N.rig.playPath(keys, 9, () => endShot(false));
};

/* hill-top panorama */
cine.panorama = function(v){
  const P = actor("natsarkekia");
  const cam = N.rig.camera, a0 = Math.atan2(P.x - cam.position.x, P.z - cam.position.z);
  const keys = [];
  for(let i = 0; i <= 6; i++){
    const a = a0 + i / 6 * 2.4, fx = Math.sin(a), fz = Math.cos(a);
    keys.push({ p: V3(P.x - fx * 6, P.y + 3.4, P.z - fz * 6), l: V3(P.x + fx * 90, P.y - 6, P.z + fz * 90) });
  }
  keys.push(followKey(P, P.x + Math.sin(a0 + 2.4), P.z + Math.cos(a0 + 2.4)));
  beginShot("pano", 11, null, null);
  N.rig.playPath(keys, 11, () => endShot(false));
  N.audio.chime();
};

/* stage 3: from the lookout, watch Devi walk through the valley below */
cine.observe = function(id, onDone){
  const P = actor("natsarkekia"), dv = N.chars.devi, path = N.world.deviObs;
  const a = path[0], b = path[1], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  const dx = mx - P.x, dz = mz - P.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, rx = -uz, rz = ux;
  dv.setSpot([a[0], T.ground(a[0], a[1]), a[1]]); dv.rise = 1; dv.actor.show(true, false);
  dv.walk(a[0], a[1], b[0], b[1], 6.2, false);
  dv.onStep = (d, x, z) => { const dd = Math.hypot(x - P.x, z - P.z); if(dd < 140){ N.audio.thud && N.audio.thud(1 - dd / 140); N.rig.shake = Math.max(N.rig.shake, 0.18 * (1 - dd / 140)); } };
  const look = [mx, mz];
  /* everyone lines up at the edge of the lookout, looking down into the valley */
  N.game.S.roster.forEach((k, i) => { const ac = actor(k), lat = [-2.0, 2.0, 3.8][i], back = [0.8, 0.6, 1.4][i];
    ac.scripted = true; ac.ghost = true; ac.walkTo = [P.x + rx * lat - ux * back, P.z + rz * lat - uz * back]; ac.walkSpeed = 3; });
  for(const k of ["natsarkekia", ...N.game.S.roster]){ const ac = actor(k); ac.lookAt = look; }
  /* crane shot: from behind the group, rising over their heads so the valley below the hill's shoulder opens up */
  const c0 = V3(P.x - ux * 9 + rx * 1.5, P.y + 3.4, P.z - uz * 9 + rz * 1.5), c1 = V3(P.x - ux * 3 - rx * 3, P.y + 11, P.z - uz * 3 - rz * 3);
  N.rig.mode = "manual";
  N.rig.fovTarget = 30;
  const dur = 9.5;
  beginShot("observe", dur, (t, dt) => {
    const k = N.smoothstep(0, 3.2, t);
    N.rig.camera.position.lerpVectors(c0, c1, k);
    N.rig.camera.position.addScaledVector(V3(rx, 0, rz), -Math.min(1, t / dur) * 4);   // slow lateral drift
    const d = dv.actor, tgt = V3(d.x, d.y + 3.5, d.z).lerp(V3(P.x + ux * 20, P.y, P.z + uz * 20), t < 2 ? 0.55 : 0.12);
    N.rig.target.lerp(tgt, t < 0.05 ? 1 : Math.min(1, dt * 3)); N.rig.camera.lookAt(N.rig.target);
    if(t > dur - 1.4) d.show(false);
  }, () => { dv.onStep = null; dv.route = null; dv.actor.show(false);
    for(const k of ["natsarkekia", ...N.game.S.roster]){ const ac = actor(k); ac.lookAt = null; ac.walkTo = null; ac.ghost = false; ac.scripted = false; }
    onDone(); }, { restore: false, keepHud: false });
  N.rig.target.set(a[0], T.ground(a[0], a[1]) + 4, a[1]);
};

cine.updateShot = function(dt){
  const sh = cine.shot; if(!sh) return;
  sh.t += dt;
  if(sh.update) sh.update(sh.t, dt);
  if(sh.kind === "observe" && sh.t >= sh.dur){ cine.shot = null; lb(false); N.ui.hud(true); N.rig.fovTarget = null; N.rig.mode = "shot"; N.rig.shot = { p0: N.rig.camera.position.clone(), l0: N.rig.target.clone(), p1: N.rig.camera.position.clone(), l1: N.rig.target.clone(), t: 1, dur: 1 }; sh.onEnd(); }
};

cine.stop = function(){
  N.rig.fovTarget = null;
  if(cine.shot){ const sh = cine.shot; cine.shot = null; lb(false); if(sh.kind === "observe"){ N.chars.devi.onStep = null; N.chars.devi.route = null; } }
  if(N.rig.mode === "path" || N.rig.mode === "manual") N.rig.mode = "shot";
  cine.active = null;
  for(const k of COMP){ const a = actor(k); a.wave = false; a.scripted = false; a.walkTo = null; a.ghost = false; }
  N.sky.moonCover = 0; N.sky.extraDark = 0; N.chars.devi.rise = 1;
};

/* ---------------- final tableau ---------------- */
cine.finalTableau = function(result){
  /* on the meadow south-west of the village, looking at its fate (§11) */
  const P = actor("natsarkekia"), S = N.game.S;
  const cx = 270, cz = 142, vx = N.terrain.VILLAGE.x - cx, vz = N.terrain.VILLAGE.z - cz, L = Math.hypot(vx, vz);
  const look = { x: vx / L, z: vz / L }, right = { x: -look.z, z: look.x };
  P.place(cx, cz); P.lookAt = null; N.chars.player.locked = true;
  N.chars.companions.following = new Set();
  S.roster.forEach((k, i) => { const a = actor(k), lat = [-1.9, 1.7, 0.2][i], dep = [0.9, 1.1, -1.4][i];
    a.scripted = true; a.walkTo = null; a.place(cx + right.x * lat + look.x * dep, cz + right.z * lat + look.z * dep); a.show(true, true); a.lookAt = null; });
  for(const k of COMP) if(!S.roster.includes(k)) actor(k).show(false, true);
  const gy = T.ground(cx, cz);
  const wide = window.innerWidth > 820;
  const center = V3(cx + right.x * (wide ? 2.6 : 0) + look.x * 2.5, gy + 1.9, cz + right.z * (wide ? 2.6 : 0) + look.z * 2.5);
  N.rig.camera.position.set(cx - look.x * 8, gy + 2.9, cz - look.z * 8);
  N.rig.target.copy(center);
  N.rig.startOrbit(center, 10, 1.0, N.settings.reducedMotion ? 0 : 0.1, 0.38);
};

N.cine = cine;
})();
