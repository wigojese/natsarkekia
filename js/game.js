/* =====================================================================
   GAME FLOW — state machine TITLE → EXPLORE ⇄ DIALOGUE → [CINEMATIC] →
   … → FINAL (+ PAUSE overlay). Same data model as the 2D game: S, NAV,
   PREV; choose() / goBack() behave exactly like the 2D versions.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const D = N.data, SC = N.scoring, T = N.terrain, TX = D.TEXT;
const { clamp, lerp, smoothstep } = N;
const COMP = ["hunter", "elderwoman", "blacksmith"];

const game = {
  mode: "TITLE", S: SC.newState(), NAV: [], PREV: null,
  objective: null, current: null, result: null, paused: false, busy: false,
  leftGone: false, notYet: {}, preset: "dawn"
};

/* ---------------- helpers ---------------- */
const stepOf = (id) => D.STAGES[id] ? D.STAGES[id].step : null;
const frame = (step) => N.world.frames[step];
const actor = (k) => k === "natsarkekia" ? N.chars.player.actor : k === "devi" ? N.chars.devi.actor : N.chars.byKey[k];
game.stepOf = stepOf;

function setPreset(key, dur){ game.preset = key; N.sky.setPreset(key, dur); N.audio.setChord(key); }

/* where Devi stands for a stage/bridge/final (§5) */
function deviSpotFor(id){
  if(id === "FINAL") return N.world.devSpots.final;
  if(id === "bridge-battle") return N.world.devSpots[10];
  const st = stepOf(id);
  return N.world.devSpots[st] || null;
}
function updateDevi(id, instant){
  const dv = N.chars.devi;
  const show = id === "FINAL" ? !!(game.result && (game.result.tier === 0 || game.result.catastrophe)) : D.deviVisibleFor(id);
  if(show){
    const sp = deviSpotFor(id);
    if(sp && (dv.actor.opacity < 0.05 || instant || !dv.spot || Math.hypot(dv.spot[0] - sp[0], dv.spot[2] - sp[2]) > 30)){
      dv.setSpot(sp);
      const st = stepOf(id);
      if(id !== "FINAL" && (st === 4 || st === 5)){                      // far away on his ridge: he paces slowly
        const rd = st === 5 ? [-0.88, 0.48] : [0.96, -0.24];
        dv.walk(sp[0] - rd[0] * 9, sp[2] - rd[1] * 9, sp[0] + rd[0] * 9, sp[2] + rd[1] * 9, 1.4, true, 0.5);
      }
    }
    dv.rise = 1;
  }
  dv.actor.show(show, instant);
}

/* companions follow / stand at the oak / vanish, based on S (§5) */
function syncCompanions(instant){
  const S = game.S, s2done = S.history.length >= 2, P = N.chars.player.actor;
  N.chars.companions.following = new Set();
  for(const k of COMP){
    const a = actor(k); a.scripted = false; a.wave = false; a.walkTo = null; a.lookAt = null;
    if(S.roster.includes(k)){
      N.chars.companions.following.add(k);
      if(instant || a.opacity < 0.05 || Math.hypot(a.x - P.x, a.z - P.z) > 40){ const s = N.chars.safeNear(P.x - Math.sin(N.chars.player.heading) * 2.5 + (COMP.indexOf(k) - 1) * 1.5, P.z - Math.cos(N.chars.player.heading) * 2.5, P); a.place(s[0], s[1]); }
      a.show(true, instant);
    } else if(!s2done || (!game.leftGone && stepOf(game.objective) <= 3 && game.mode !== "FINAL")){
      const o = N.world.oakSpots[k];
      if(instant || a.opacity < 0.05) a.place(o[0], o[1]);
      a.home = o; a.show(true, instant); a.lookAt = [P.x, P.z];
    } else a.show(false, instant);
  }
  N.ui.setRoster(S.roster);
}
function syncVariants(){
  const solo = game.S.path === "solo";
  N.world.setVariant(6, solo ? "solo" : "team"); N.world.setVariant(8, solo ? "solo" : "team");
}

function placePlayerAtSite(step, back){
  const f = frame(step), p = f.at(0, -(back == null ? 3 : back)), s = N.chars.safeNear(p[0], p[1], { x: f.x, z: f.z });
  N.chars.player.actor.place(s[0], s[1]);
  N.chars.player.heading = Math.atan2(f.bx, f.bz);
  N.rig.target.set(s[0], T.walkHeight(s[0], s[1]) + 1.5, s[1]);
  N.rig.yaw = Math.atan2(-f.bx, -f.bz); N.rig.pitch = 0.3; N.rig.wantDist = N.rig.curDist = 7.5;
}

/* ---------------- objective ---------------- */
game.setObjective = function(id, opts){
  opts = opts || {};
  game.objective = id; game.current = null;
  const step = stepOf(id);
  setPreset(D.STEP_PRESET[step], opts.instant ? 0 : 5);
  N.guide.setObjective(step);
  N.guide.setDone(game.S.history.map(h => h.step).filter(s => s < step));
  N.ui.setTrail(step);
  syncVariants();
  syncCompanions(opts.instant);
  updateDevi(id, opts.instant);
  if(!opts.instant && !opts.silent) N.audio.chime();
  game.notYet = {};
};
game.objectiveInfo = function(){
  if(!game.objective) return null;
  const step = stepOf(game.objective), p = D.SITES[step].pos, P = N.chars.player.actor;
  return { stageId: game.objective, step, site: D.SITES[step].name, pos: p.slice(), distance: Math.hypot(p[0] - P.x, p[1] - P.z) };
};

/* ---------------- start ---------------- */
game.start = async function(){
  await N.ui.fade(true, 350);
  N.cine.stop();
  game.S = SC.newState(); game.NAV = []; game.PREV = null; game.result = null; game.leftGone = false; game.paused = false; game.busy = false;
  N.ui.hideFinal(); N.ui.hideBridge(); N.ui.hidePause(); N.ui.letterbox(false);
  document.getElementById("dialogue").hidden = true;
  N.world.setVillageDamage("intact");
  N.guide.resetFog();
  N.chars.player.locked = false;
  N.chars.player.actor.place(334, 126); N.chars.player.heading = -Math.PI / 2;
  N.rig.mode = "follow"; N.rig.yaw = Math.PI / 2 - 0.25; N.rig.pitch = 0.28; N.rig.wantDist = N.rig.curDist = 7.5;
  N.rig.target.set(334, T.walkHeight(334, 126) + 1.5, 126);
  for(const k of COMP){ const a = actor(k); const o = N.world.oakSpots[k]; a.place(o[0], o[1]); }
  N.chars.devi.actor.show(false, true); N.chars.devi.rise = 1; N.sky.moonCover = 0;
  game.mode = "EXPLORE";
  game.setObjective("s1", { instant: true, silent: true });
  N.ui.hud(true); document.body.classList.add("exploring");
  N.cine.intro(() => { if(!N.settings.tutorialSeen && game.mode === "EXPLORE") N.ui.showTutorial(); });
  await N.ui.fade(false, 600);
};

/* ---------------- staging for a dialogue (scripted positions) ---------------- */
const LAT = { blacksmith: -3.4, natsarkekia: -1.1, hunter: 1.1, elderwoman: 3.2 };
const DEP = { blacksmith: 0.9, natsarkekia: 0, hunter: 0.6, elderwoman: 0.9 };
function staging(id){
  const step = stepOf(id), f = frame(step), S = game.S;
  let look = { x: f.bx, z: f.bz };
  const deviNear = id === "t10" || id === "u10";
  const devFar = D.deviVisibleFor(id) && !deviNear;
  if(devFar){ const sp = deviSpotFor(id); const dx = sp[0] - f.x, dz = sp[2] - f.z, L = Math.hypot(dx, dz); look = { x: dx / L, z: dz / L }; }
  const right = { x: -look.z, z: look.x };
  const who = id === "s2" ? ["natsarkekia", ...COMP] : id === "u8" ? ["natsarkekia", "elderwoman"] : ["natsarkekia", ...S.roster];
  const spots = {};
  const base = [f.x - look.x * 1.5, f.z - look.z * 1.5];
  for(const k of who){
    if(id === "s2" && k !== "natsarkekia"){ spots[k] = N.world.oakSpots[k].slice(); continue; }
    let lat = LAT[k], dep = DEP[k];
    if(id === "u8" && k === "elderwoman"){ lat = 1.4; dep = 0.4; }
    if(id === "t9" && k === "hunter"){ lat = 4.6; dep = 4.2; }
    if(S.roster.length === 1 && k === "hunter"){ lat = 1.0; }
    spots[k] = [base[0] + right.x * lat + look.x * dep, base[1] + right.z * lat + look.z * dep];
  }
  return { step, f, look, right, who, spots, deviNear, devFar };
}
/* fraction of the screen height covered by the dialogue panel (measured when visible) */
function panelFrac(){
  const el = document.getElementById("dialogue");
  if(!el.hidden && el.offsetHeight) return clamp((window.innerHeight - el.getBoundingClientRect().top) / window.innerHeight, 0.2, 0.75);
  const W = window.innerWidth, H = window.innerHeight;
  return H > W ? 0.56 : H < 560 ? 0.62 : 0.4;
}
/* place the camera so the staged characters stand above the dialogue panel (and Devi fits too) */
function frameShot(st, dur){
  const pts = st.who.map(k => st.spots[k]);
  let cx = 0, cz = 0; pts.forEach(p => { cx += p[0]; cz += p[1]; }); cx /= pts.length; cz /= pts.length;
  let spread = 0, nearest = 0;
  pts.forEach(p => { spread = Math.max(spread, Math.abs((p[0] - cx) * st.right.x + (p[1] - cz) * st.right.z)); nearest = Math.min(nearest, (p[0] - cx) * st.look.x + (p[1] - cz) * st.look.z); });
  const cam = N.rig.camera, tanV = Math.tan((N.rig.baseFov || cam.fov) * Math.PI / 360), tanH = tanV * cam.aspect;
  const gy = T.ground(cx, cz);
  const feetNDC = -1 + 2 * panelFrac() + 0.06;
  /* things whose tops must stay in frame: heads, and Devi when he is on stage */
  const tops = [{ h: 2.0, d: 0 }];
  if(st.deviNear || st.devFar){
    const sp = deviSpotFor(N.game.current || N.game.objective);
    if(sp) tops.push({ h: sp[1] - gy + 7.2 * 0.97, d: Math.max(0, (sp[0] - cx) * st.look.x + (sp[2] - cz) * st.look.z) });
  }
  let dist = Math.max(6.5, (spread + 1.6) / tanH + 1.2), h = 2.3, pitch = 0;
  for(let it = 0; it < 16; it++){
    h = 1.6 + dist * 0.12;
    const feetAng = Math.atan2(-h, dist + nearest);
    pitch = feetAng - Math.atan(feetNDC * tanV);
    let ok = true;
    for(const tp of tops){ const ang = Math.atan2(tp.h - h, dist + tp.d) - pitch; if(Math.tan(ang) / tanV > 0.8) ok = false; }
    if(ok) break;
    dist += 1.4;
  }
  const camPos = new THREE.Vector3(cx - st.look.x * dist, gy + h, cz - st.look.z * dist);
  const gc = T.ground(camPos.x, camPos.z) + 1.2; if(camPos.y < gc){ camPos.y = gc; }
  const tgt = new THREE.Vector3(camPos.x + st.look.x * Math.cos(pitch) * 10, camPos.y + Math.sin(pitch) * 10, camPos.z + st.look.z * Math.cos(pitch) * 10);
  N.rig.shotTo(camPos, tgt, dur == null ? 1.3 : dur);
  return { cam: camPos, tgt };
}
game.reframe = function(){ if(game.mode === "DIALOGUE" && game.stage) frameShot(game.stage, 0.7); };

/* ---------------- dialogue ---------------- */
game.openDialogue = function(id, prevIdx, instant, observed){
  N.cine.endFly && N.cine.endFly();
  /* stage 3 (empiricism): first watch Devi walk through the valley from the lookout */
  if((id === "t3" || id === "u3") && !instant && !observed){
    game.mode = "DIALOGUE"; game.current = id; game.busy = true; game.observing = true;
    document.body.classList.remove("exploring");
    N.controls.releasePointer(); N.controls.clear();
    N.chars.player.locked = true; N.ui.prompt(false); N.ui.closeTutorial(); N.ui.hintLine(null); N.guide.hide();
    N.cine.observe(id, () => { game.observing = false; game.openDialogue(id, prevIdx, false, true); });
    return;
  }
  game.mode = "DIALOGUE"; game.current = id; game.busy = false;
  document.body.classList.remove("exploring");
  N.controls.releasePointer(); N.controls.clear();
  N.chars.player.locked = true; N.ui.prompt(false); N.ui.closeTutorial(); N.ui.hintLine(null);
  N.guide.hide();
  const st = staging(id);
  game.stage = st;
  /* the elder woman walks in from the path on u8 (she is not added to the roster) */
  if(id === "u8"){
    const ew = actor("elderwoman"), from = st.f.at(3.5, 10);
    if(instant) ew.place(st.spots.elderwoman[0], st.spots.elderwoman[1]); else ew.place(from[0], from[1]);
    ew.show(true, false);
  }
  for(const k of st.who){
    const a = actor(k), sp = st.spots[k];
    a.scripted = k !== "natsarkekia";
    if(instant){ a.place(sp[0], sp[1]); a.walkTo = null; }
    else { a.walkTo = sp; a.walkSpeed = k === "elderwoman" && id === "u8" ? 3.2 : 3.6; a.ghost = true; a.onArrive = () => { a.ghost = false; }; }
    a.lookAt = null;
  }
  /* everyone turns toward Natsarkekia; he faces the scene */
  setTimeout(() => { for(const k of st.who) if(k !== "natsarkekia"){ const p = st.spots.natsarkekia; actor(k).lookAt = p; } }, 900);
  frameShot(st, instant ? 0.01 : 1.3);
  N.audio.click();
  const show = () => {
    if(game.mode !== "DIALOGUE" || game.current !== id) return;
    N.ui.showDialogue(id, prevIdx == null ? -1 : prevIdx, game.NAV.length > 0, game.choose, game.goBack);
    requestAnimationFrame(() => frameShot(st, instant ? 0.01 : 0.8));     // re-aim with the measured panel height
  };
  if(instant) show(); else setTimeout(show, 650);
};

game.choose = function(i){
  if(game.mode !== "DIALOGUE" || game.busy || !game.current) return null;
  const id = game.current, st = D.STAGES[id];
  if(!st || !st.choices[i]) return null;
  if(document.getElementById("dialogue").hidden) return null;
  game.busy = true;
  N.audio.click();
  const r = SC.applyChoice(game.S, id, i);
  game.NAV.push(r.navEntry);
  game.PREV = null;
  N.ui.hideDialogue();
  /* release the staging */
  for(const k of game.stage.who){ const a = actor(k); a.scripted = false; a.walkTo = null; a.ghost = false; a.lookAt = null; }
  if(id === "u8"){                                         /* she leaves after the choice */
    const ew = actor("elderwoman"), away = game.stage.f.at(10, 30);
    ew.scripted = true; ew.walkTo = away; ew.walkSpeed = 2.8; ew.ghost = true;
    setTimeout(() => { if(!game.S.roster.includes("elderwoman")){ ew.show(false); ew.scripted = false; } }, 2600);
  }
  const next = r.next;
  if(D.BRIDGES[next]) N.cine.playBridge(next);
  else {
    game.mode = "EXPLORE"; document.body.classList.add("exploring");
    N.chars.player.locked = false;
    N.rig.follow();
    game.setObjective(next);
    N.cine.flyover(stepOf(next));
    game.busy = false;
  }
  return next;
};

/* back / change answer (§12) */
game.goBack = async function(){
  if(game.busy && game.mode !== "DIALOGUE" && game.mode !== "CINEMATIC" && game.mode !== "FINAL") return false;
  const e = game.NAV.pop(); if(!e) return false;
  game.busy = true;
  N.audio.click();
  await N.ui.fade(true, 380);
  N.cine.stop();
  N.ui.hideBridge(); N.ui.hideFinal(); N.ui.hidePause(); N.ui.letterbox(false); game.paused = false;
  document.getElementById("dialogue").hidden = true;
  game.S = e.state; game.PREV = { stage: e.stageId, idx: e.choiceIdx }; game.result = null;
  N.world.setVillageDamage("intact"); N.sky.moonCover = 0; N.sky.extraDark = 0; N.chars.devi.rise = 1;
  game.leftGone = false;
  const step = stepOf(e.stageId);
  placePlayerAtSite(step);
  game.mode = "EXPLORE";
  game.setObjective(e.stageId, { instant: true, silent: true });
  N.ui.hud(true);
  game.openDialogue(e.stageId, e.choiceIdx, true);
  await N.ui.fade(false, 450);
  game.busy = false;
  return true;
};

/* ---------------- bridges ---------------- */
game.continueBridge = async function(){
  if(game.mode !== "CINEMATIC" || !game.current || game.busy2) return;
  const id = game.current, b = D.BRIDGES[id];
  game.busy2 = true; N.audio.click();
  if(b.next === "FINAL"){ await game.showFinal(); game.busy2 = false; return; }
  await N.cine.finishBridge(id);
  N.ui.hideBridge(); N.ui.letterbox(false);
  game.mode = "EXPLORE"; document.body.classList.add("exploring");
  N.chars.player.locked = false;
  N.ui.hud(true);
  N.rig.follow();
  game.setObjective(b.next);
  if(id !== "bridge-delayed") N.cine.flyover(stepOf(b.next));
  game.busy = false; game.busy2 = false;
};

/* ---------------- final ---------------- */
const DAMAGE = (r) => r.catastrophe ? "burnt" : ["ruins", "heavy", "minor", "intact"][r.tier];
game.showFinal = async function(){
  game.result = SC.computeResult(game.S);
  await N.ui.fade(true, 600);
  N.cine.stop();
  N.ui.hideBridge(); N.ui.letterbox(false); N.ui.hud(false);
  document.body.classList.remove("exploring");
  game.mode = "FINAL"; game.current = "FINAL";
  N.sky.moonCover = 0;
  setPreset(D.FINAL_PRESET(game.result), 0);
  N.world.setVillageDamage(DAMAGE(game.result));
  N.cine.finalTableau(game.result);
  updateDevi("FINAL", true);
  N.ui.showFinal(game.S, game.result, game.goBack, game.restart);
  await N.ui.fade(false, 900);
  game.busy = false;
};
game.restart = async function(){ N.audio.click(); await game.start(); };

/* ---------------- interaction + per-frame ---------------- */
game.nearObjective = function(){
  if(!game.objective) return false;
  const p = D.SITES[stepOf(game.objective)].pos, P = N.chars.player.actor;
  return Math.hypot(p[0] - P.x, p[1] - P.z) <= D.TRIGGER_RADIUS + 0.5;
};
game.interact = function(){
  if(game.paused) return false;
  if(game.mode === "EXPLORE" && N.cine.flying()){ N.cine.endFly(); return false; }
  if(game.mode === "EXPLORE" && !game.nearObjective() && game.viewpoint){ N.cine.panorama(game.viewpoint); return false; }
  if(game.mode === "EXPLORE" && game.nearObjective()){ game.openDialogue(game.objective, game.PREV && game.PREV.stage === game.objective ? game.PREV.idx : -1); return true; }
  if(game.mode === "CINEMATIC" && !document.getElementById("bridge").hidden && document.activeElement !== document.getElementById("br-back")){ game.continueBridge(); return true; }
  return false;
};

game.unstick = async function(){
  if(game.mode !== "EXPLORE") return;
  await N.ui.fade(true, 350);
  const step = stepOf(game.objective), f = frame(step), t = T.roadT(f.x, f.z), p = T.roadPointAt(Math.max(0, t - 14));
  const s = N.chars.safeNear(p[0], p[1], { x: p[0], z: p[1] });
  N.chars.player.actor.place(s[0], s[1]);
  const nx = f.x - s[0], nz = f.z - s[1]; N.rig.yaw = Math.atan2(-nx, -nz); N.rig.target.set(s[0], T.walkHeight(s[0], s[1]) + 1.5, s[1]);
  syncCompanions(true);
  await N.ui.fade(false, 450);
};

game.update = function(dt){
  if(game.mode !== "EXPLORE" || game.paused || N.cine.flying()) { N.ui.prompt(false); return; }
  const P = N.chars.player.actor, info = game.objectiveInfo();
  /* viewpoints on the hills: climb up and press E to look around */
  game.viewpoint = null;
  for(const v of T.VIEWPOINTS) if(Math.hypot(v.x - P.x, v.z - P.z) < 5){ game.viewpoint = v; break; }
  if(info){
    N.ui.setObjective(TX.goTo(info.site, Math.max(0, Math.round(info.distance))));
    N.ui.prompt(info.distance <= D.TRIGGER_RADIUS + 0.5 || !!game.viewpoint);
    /* "not yet": entering a later site's trigger area (info only, never a blocker) */
    for(let s = info.step + 1; s <= 10; s++){
      const p = D.SITES[s].pos, d = Math.hypot(p[0] - P.x, p[1] - P.z);
      if(d < D.TRIGGER_RADIUS + 1){ if(!game.notYet[s]){ game.notYet[s] = true; N.ui.toast(TX.notYet, 2800); } }
      else if(d > D.TRIGGER_RADIUS + 6) game.notYet[s] = false;
    }
  }
  /* companions left behind at the oak quietly vanish once we are far away */
  if(game.S.history.length >= 2 && !game.leftGone){
    const o = N.world.oakPos;
    if(Math.hypot(o[0] - P.x, o[2] - P.z) > 75){ game.leftGone = true; for(const k of COMP) if(!game.S.roster.includes(k)) actor(k).show(false); }
  }
};

N.game = game;
})();
