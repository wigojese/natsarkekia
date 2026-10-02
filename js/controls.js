/* =====================================================================
   CONTROLS — keyboard, mouse (pointer lock), wheel, touch joystick +
   right-half look, gamepad. Discrete actions are emitted as events:
   interact, choose(i), hint, map, unstick, pause.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const input = { x: 0, y: 0, run: false, lookX: 0, lookY: 0, zoom: 0, active: false };
const keys = new Set();
let canvas = null, joy = null, joyId = null, lookId = null, lookLast = null, dragMouse = null;

function onKey(e, down){
  const k = e.code;
  if(down){
    if(e.repeat && !["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) return;
    const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    if(typing) return;
    if(k === "KeyE" || k === "Enter" || k === "NumpadEnter"){ if(document.activeElement && document.activeElement.tagName === "BUTTON" && k !== "KeyE") return; N.emit("interact"); }
    else if(k === "Digit1" || k === "Numpad1") N.emit("choose", 0);
    else if(k === "Digit2" || k === "Numpad2") N.emit("choose", 1);
    else if(k === "Digit3" || k === "Numpad3") N.emit("choose", 2);
    else if(k === "KeyH") N.emit("hint");
    else if(k === "KeyM") N.emit("map");
    else if(k === "KeyR") N.emit("unstick");
    else if(k === "Escape" || k === "KeyP") N.emit("pause");
    if(k.startsWith("Arrow") || k === "Space") e.preventDefault();
    keys.add(k);
  } else keys.delete(k);
  N.emit("anyinput");
}

function setupTouch(){
  const zone = document.getElementById("touch-zone");
  joy = { base: document.getElementById("joy-base"), knob: document.getElementById("joy-knob"), cx: 0, cy: 0, x: 0, y: 0 };
  const R = 52;
  zone.addEventListener("touchstart", (e) => {
    for(const t of e.changedTouches){
      if(t.clientX < window.innerWidth * 0.45 && joyId === null){
        joyId = t.identifier; joy.cx = t.clientX; joy.cy = t.clientY; joy.x = joy.y = 0;
        joy.base.style.left = (t.clientX - R) + "px"; joy.base.style.top = (t.clientY - R) + "px"; joy.base.classList.add("on");
        joy.knob.style.transform = "translate(0px,0px)";
      } else if(lookId === null){ lookId = t.identifier; lookLast = [t.clientX, t.clientY]; }
    }
    e.preventDefault(); N.emit("anyinput");
  }, { passive: false });
  zone.addEventListener("touchmove", (e) => {
    for(const t of e.changedTouches){
      if(t.identifier === joyId){
        let dx = t.clientX - joy.cx, dy = t.clientY - joy.cy; const d = Math.hypot(dx, dy);
        if(d > R){ dx *= R / d; dy *= R / d; }
        joy.x = dx / R; joy.y = -dy / R;
        joy.knob.style.transform = `translate(${dx}px,${dy}px)`;
      } else if(t.identifier === lookId){
        input.lookX += (t.clientX - lookLast[0]) * 0.006; input.lookY += (t.clientY - lookLast[1]) * 0.005; lookLast = [t.clientX, t.clientY];
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    for(const t of e.changedTouches){
      if(t.identifier === joyId){ joyId = null; joy.x = joy.y = 0; joy.base.classList.remove("on"); }
      if(t.identifier === lookId){ lookId = null; }
    }
  };
  zone.addEventListener("touchend", end); zone.addEventListener("touchcancel", end);
}

const controls = {
  input,
  pointerLocked: false,
  init(cv){
    canvas = cv;
    window.addEventListener("keydown", e => onKey(e, true));
    window.addEventListener("keyup", e => onKey(e, false));
    window.addEventListener("blur", () => keys.clear());
    canvas.addEventListener("click", () => {
      if(N.isTouch || !N.game || N.game.mode !== "EXPLORE") return;
      if(canvas.requestPointerLock){ try{ const p = canvas.requestPointerLock(); if(p && p.catch) p.catch(() => {}); }catch(e){} }
    });
    document.addEventListener("pointerlockchange", () => {
      const was = controls.pointerLocked;
      controls.pointerLocked = document.pointerLockElement === canvas;
      if(was && !controls.pointerLocked && !controls._releasing && N.game && N.game.mode === "EXPLORE") N.emit("pause");
      controls._releasing = false;
    });
    document.addEventListener("mousemove", (e) => {
      if(controls.pointerLocked){ input.lookX += e.movementX * 0.0028; input.lookY += e.movementY * 0.0024; }
      else if(dragMouse){ input.lookX += (e.clientX - dragMouse[0]) * 0.005; input.lookY += (e.clientY - dragMouse[1]) * 0.004; dragMouse = [e.clientX, e.clientY]; }
    });
    canvas.addEventListener("mousedown", (e) => { if(!controls.pointerLocked) dragMouse = [e.clientX, e.clientY]; });
    window.addEventListener("mouseup", () => { dragMouse = null; });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    canvas.addEventListener("wheel", (e) => { input.zoom += Math.sign(e.deltaY) * 0.9; e.preventDefault(); }, { passive: false });
    if(N.isTouch) setupTouch();
  },
  releasePointer(){ if(document.pointerLockElement){ controls._releasing = true; try{ document.exitPointerLock(); }catch(e){} } },
  update(){
    let x = 0, y = 0;
    if(keys.has("KeyW") || keys.has("ArrowUp")) y += 1;
    if(keys.has("KeyS") || keys.has("ArrowDown")) y -= 1;
    if(keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
    if(keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
    if(joy && joyId !== null){ x += joy.x; y += joy.y; }
    input.run = keys.has("ShiftLeft") || keys.has("ShiftRight") || (joy && joyId !== null && Math.hypot(joy.x, joy.y) > 0.95);
    /* gamepad */
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for(const gp of pads){
      if(!gp) continue;
      const dz = (v) => Math.abs(v) < 0.18 ? 0 : v;
      x += dz(gp.axes[0] || 0); y -= dz(gp.axes[1] || 0);
      input.lookX += dz(gp.axes[2] || 0) * 0.05; input.lookY += dz(gp.axes[3] || 0) * 0.04;
      const pressed = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      controls._gp = controls._gp || {};
      const edge = (i, ev, arg) => { if(pressed(i) && !controls._gp[i]) N.emit(ev, arg); controls._gp[i] = pressed(i); };
      edge(0, "interact"); edge(9, "pause"); edge(3, "hint"); edge(8, "map");
      if(pressed(10) || pressed(6)) input.run = true;
      break;
    }
    const m = Math.hypot(x, y); if(m > 1){ x /= m; y /= m; }
    input.x = x; input.y = y;
    input.active = m > 0.05;
  },
  consumeLook(){ const l = [input.lookX, input.lookY, input.zoom]; input.lookX = input.lookY = input.zoom = 0; return l; },
  clear(){ keys.clear(); input.x = input.y = 0; }
};
N.controls = controls;
})();
