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
  const c = cine.active; if(!c) return false;
  for(const tm of c.timers) if(!tm.done){ tm.done = true; tm.fn(); }
  if(c.skipFn) c.skipFn();
  c.t = Math.max(c.t, c.cardAt);
  cine.showCard();
  return true;
};
cine.update = function(dt){
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
cine.stop = function(){
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
