/* =====================================================================
   AUDIO — WebAudio synthesis only (no files). Starts on the first user
   gesture. Ambience (wind, birds / crickets), fire crackle, footsteps,
   UI click, beacon chime, Devi drone, battle rumble, time-of-day pad.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const A = { ctx: null, ready: false };
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
/* pad chords per preset (MIDI notes) */
const CHORDS = {
  dawn: [50, 57, 62, 66], morning: [55, 59, 62, 67], midday1: [48, 55, 60, 64], midday2: [53, 57, 60, 65],
  afternoon1: [55, 62, 67, 71], afternoon2: [50, 57, 60, 65], evening: [45, 52, 57, 60], dusk: [52, 55, 59, 64],
  night: [45, 52, 55, 60], deepnight: [38, 45, 50, 53], victorydawn: [50, 57, 62, 66], victorydamaged: [46, 53, 58, 62],
  defeatashen: [38, 45, 50, 53], catastrophe: [38, 44, 50, 53]
};

A.init = function(){
  if(A.ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
  try{ A.ctx = new AC(); }catch(e){ return; }
  const c = A.ctx;
  A.master = c.createGain(); A.master.gain.value = N.settings.sound ? 0.8 : 0; A.master.connect(c.destination);
  /* shared noise buffer */
  const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for(let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  A.noiseBuf = buf;
  const noise = () => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 1.9); return s; };
  /* wind (day: brighter, night: lower) */
  const mkWind = (freq, q) => { const n = noise(), f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0; n.connect(f); f.connect(g); g.connect(A.master); return { f, g }; };
  A.windDay = mkWind(700, 0.6); A.windNight = mkWind(260, 0.9);
  /* Devi drone */
  A.drone = c.createGain(); A.drone.gain.value = 0;
  const df = c.createBiquadFilter(); df.type = "lowpass"; df.frequency.value = 220; df.connect(A.drone); A.drone.connect(A.master);
  for(const fr of [41.2, 41.9, 61.7]){ const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = fr; const g = c.createGain(); g.gain.value = 0.18; o.connect(g); g.connect(df); o.start(); }
  /* pad */
  A.pad = c.createGain(); A.pad.gain.value = 0.0; const pf = c.createBiquadFilter(); pf.type = "lowpass"; pf.frequency.value = 900; A.pad.connect(pf); pf.connect(A.master);
  A.padOsc = [0, 1, 2, 3].map(i => { const o = c.createOscillator(); o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = NOTE(CHORDS.dawn[i]); const g = c.createGain(); g.gain.value = 0.25; o.connect(g); g.connect(A.pad); o.start(); return o; });
  /* fire crackle bus */
  A.fireBus = c.createGain(); A.fireBus.gain.value = 0; A.fireBus.connect(A.master);
  A.ready = true; A.t = 0; A.nextBird = 1; A.nextCricket = 0.5; A.nextCrackle = 0.2;
  A.setChord(N.sky ? N.sky.key : "dawn");
};
A.resume = function(){ if(!A.ctx) A.init(); if(A.ctx && A.ctx.state === "suspended") A.ctx.resume(); };
A.setMuted = function(m){ if(A.master) A.master.gain.setTargetAtTime(m ? 0 : 0.8, A.ctx.currentTime, 0.1); };
A.setChord = function(key){
  if(!A.ready) return; const ch = CHORDS[key] || CHORDS.dawn, t = A.ctx.currentTime;
  A.padOsc.forEach((o, i) => o.frequency.setTargetAtTime(NOTE(ch[i]), t, 1.2));
};

function env(node, t, a, peak, dcy){ node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); }
function burst(dest, type, freq, q, peak, a, dcy, rate){
  const c = A.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = A.noiseBuf; s.playbackRate.value = rate || 1;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); s.connect(f); f.connect(g); g.connect(dest);
  env(g, t, a, peak, dcy); s.start(t, Math.random()); s.stop(t + a + dcy + 0.05);
}
function tone(freq, type, peak, a, dcy, dest, glide){
  const c = A.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if(glide) o.frequency.exponentialRampToValueAtTime(glide, t + a + dcy);
  o.connect(g); g.connect(dest || A.master); env(g, t, a, peak, dcy); o.start(t); o.stop(t + a + dcy + 0.05);
}

A.step = function(surface){
  if(!A.ready) return;
  if(surface === "stone") burst(A.master, "bandpass", 1800 + Math.random() * 600, 1.2, 0.09, 0.003, 0.07);
  else if(surface === "wood") burst(A.master, "bandpass", 420, 3, 0.12, 0.003, 0.09);
  else if(surface === "water") burst(A.master, "highpass", 1400, 0.7, 0.07, 0.02, 0.22, 0.7);
  else burst(A.master, "lowpass", 900 + Math.random() * 300, 0.7, 0.07, 0.006, 0.09);
};
A.click = function(){ if(A.ready) tone(880, "sine", 0.08, 0.004, 0.08, null, 660); };
A.chime = function(){
  if(!A.ready) return;
  [[784, 0.09], [1175, 0.05], [1568, 0.03]].forEach(([f, p], i) => setTimeout(() => A.ready && tone(f, "sine", p, 0.01, 2.2), i * 140));
};
A.rumble = function(){
  if(!A.ready) return;
  burst(A.master, "lowpass", 140, 0.8, 0.8, 0.5, 4.5, 0.5);
  tone(46, "sine", 0.35, 0.6, 3.8);
  setTimeout(() => A.ready && burst(A.master, "lowpass", 90, 0.8, 0.6, 0.3, 3, 0.4), 1200);
};

A.update = function(dt, s){
  if(!A.ready) return;
  const c = A.ctx, t = c.currentTime, night = s.night;
  A.windDay.g.gain.setTargetAtTime((1 - night) * 0.05 * (s.paused ? 0.5 : 1), t, 0.5);
  A.windNight.g.gain.setTargetAtTime(night * 0.07, t, 0.5);
  A.windDay.f.frequency.setTargetAtTime(600 + Math.sin(t * 0.13) * 250, t, 0.8);
  A.drone.gain.setTargetAtTime(s.devi * 0.22, t, 0.6);
  A.pad.gain.setTargetAtTime(s.paused ? 0.01 : 0.022, t, 1.0);
  /* birds by day, crickets at night */
  A.nextBird -= dt; A.nextCricket -= dt; A.nextCrackle -= dt;
  if(A.nextBird <= 0){ A.nextBird = 1.5 + Math.random() * 4; if(night < 0.4 && !s.paused){ const f = 2200 + Math.random() * 2400; for(let k = 0; k < 2 + (Math.random() * 3 | 0); k++) setTimeout(() => A.ready && tone(f * (0.9 + Math.random() * 0.25), "sine", 0.018 * (1 - night), 0.01, 0.09, null, f * 1.3), k * 120); } }
  if(A.nextCricket <= 0){ A.nextCricket = 0.35 + Math.random() * 0.6; if(night > 0.5 && !s.paused) for(let k = 0; k < 3; k++) setTimeout(() => A.ready && tone(4300 + Math.random() * 300, "square", 0.006 * night, 0.003, 0.03), k * 45); }
  A.fireBus.gain.setTargetAtTime(s.fire * 0.9, t, 0.3);
  if(A.nextCrackle <= 0){ A.nextCrackle = 0.05 + Math.random() * 0.25; if(s.fire > 0.02) burst(A.fireBus, "highpass", 2500 + Math.random() * 2000, 0.8, 0.05 + Math.random() * 0.08, 0.001, 0.03 + Math.random() * 0.05); }
};

N.audio = A;
})();
