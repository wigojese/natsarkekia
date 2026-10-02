/* =====================================================================
   CAMERA RIG — third-person orbit (4–12 u, collides with terrain and
   buildings), eased framing shots for dialogues/cinematics, shake.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const T = N.terrain;
const { clamp, lerp, damp, easeInOut } = N;

const rig = {
  camera: null, yaw: 0.9, pitch: 0.32, dist: 7.5, wantDist: 7.5, curDist: 7.5,
  target: new THREE.Vector3(), mode: "follow", shot: null, shake: 0, orbit: null,
  init(camera){ this.camera = camera; },
  /* collision: march from the target toward the wanted camera position */
  clip(tx, ty, tz, dx, dy, dz, maxD){
    let ok = maxD;
    for(let d = 0.6; d <= maxD; d += 0.35){
      const x = tx + dx * d, y = ty + dy * d, z = tz + dz * d;
      if(T.ground(x, z) + 0.45 > y){ ok = Math.max(1.2, d - 0.4); break; }
      let hit = false;
      for(const c of T.collidersAround(x, z, 1)){
        if((c.tag === "house" || c.tag === "wall" || c.tag === "tower" || c.tag === "tent" || c.tag === "chapel" || c.tag === "hut" || c.tag === "oak" || c.tag === "gate")
           && Math.hypot(x - c.x, z - c.z) < c.r + 0.3 && y < T.ground(c.x, c.z) + (c.tag === "tower" ? 17 : c.tag === "oak" ? 12 : 7.5)){ hit = true; break; }
      }
      if(hit){ ok = Math.max(1.2, d - 0.4); break; }
    }
    return ok;
  },
  /* ease to a framing shot: pos/look are THREE.Vector3 */
  shotTo(pos, look, dur){
    this.mode = "shot";
    this.shot = { p0: this.camera.position.clone(), l0: this.target.clone(), p1: pos.clone(), l1: look.clone(), t: 0, dur: dur == null ? 1.2 : dur };
    if(this.shot.dur <= 0){ this.shot.t = 1; }
  },
  follow(){
    if(this.mode === "follow") return;
    /* derive orbit params from the current camera so there is no jump */
    const p = this.camera.position, f = N.chars.player.actor;
    const dx = p.x - f.x, dz = p.z - f.z, dy = p.y - (f.y + 1.5), d = Math.hypot(dx, dy, dz);
    this.yaw = Math.atan2(dx, dz); this.pitch = clamp(Math.asin(clamp(dy / Math.max(d, 0.01), -1, 1)), -0.1, 1.05);
    this.wantDist = this.curDist = this.dist = clamp(d, 4, 12);
    this.mode = "follow"; this.shot = null; this.orbit = null;
  },
  startOrbit(center, radius, height, speed, arc){ this.mode = "orbit"; this.orbit = { c: center.clone(), r: radius, h: height, sp: speed, a: Math.atan2(this.camera.position.x - center.x, this.camera.position.z - center.z), arc: arc || 0, a0: null, t: 0 }; },
  update(dt, look, focus){
    const cam = this.camera;
    if(this.mode === "follow"){
      this.yaw -= look[0]; this.pitch = clamp(this.pitch + look[1], -0.12, 1.05);
      this.wantDist = clamp(this.wantDist + look[2], 4, 12);
      const tx = focus.x, ty = focus.y + 1.5, tz = focus.z;
      this.target.x = damp(this.target.x, tx, 14, dt); this.target.y = damp(this.target.y, ty, 10, dt); this.target.z = damp(this.target.z, tz, 14, dt);
      const cp = Math.cos(this.pitch), dx = Math.sin(this.yaw) * cp, dy = Math.sin(this.pitch), dz = Math.cos(this.yaw) * cp;
      const allowed = this.clip(this.target.x, this.target.y, this.target.z, dx, dy, dz, this.wantDist);
      this.curDist = allowed < this.curDist ? damp(this.curDist, allowed, 20, dt) : damp(this.curDist, allowed, 3, dt);
      cam.position.set(this.target.x + dx * this.curDist, this.target.y + dy * this.curDist, this.target.z + dz * this.curDist);
      const gmin = T.ground(cam.position.x, cam.position.z) + 0.4; if(cam.position.y < gmin) cam.position.y = gmin;
      cam.lookAt(this.target);
    } else if(this.mode === "shot" && this.shot){
      const s = this.shot; s.t = Math.min(1, s.t + dt / Math.max(s.dur, 1e-3));
      const e = easeInOut(s.t);
      cam.position.lerpVectors(s.p0, s.p1, e); this.target.lerpVectors(s.l0, s.l1, e);
      cam.lookAt(this.target);
    } else if(this.mode === "orbit" && this.orbit){
      const o = this.orbit; o.t += dt;
      let a;
      if(o.arc){ if(o.a0 === null) o.a0 = o.a; a = o.a0 + Math.sin(o.t * o.sp) * o.arc; } else { o.a += o.sp * dt; a = o.a; }
      cam.position.set(o.c.x + Math.sin(a) * o.r, o.c.y + o.h, o.c.z + Math.cos(a) * o.r);
      const g = T.ground(cam.position.x, cam.position.z) + 1; if(cam.position.y < g) cam.position.y = g;
      this.target.lerp(o.c, 1 - Math.exp(-3 * dt)); cam.lookAt(this.target);
    }
    if(this.shake > 0 && !N.settings.reducedMotion){
      const k = this.shake;
      cam.position.x += (Math.random() - 0.5) * k * 0.5; cam.position.y += (Math.random() - 0.5) * k * 0.4; cam.position.z += (Math.random() - 0.5) * k * 0.5;
      this.shake = Math.max(0, this.shake - dt * 0.7);
    } else this.shake = Math.max(0, this.shake - dt);
  },
  groundYaw(){ return Math.atan2(this.camera.position.x - this.target.x, this.camera.position.z - this.target.z); }
};
N.rig = rig;
})();
