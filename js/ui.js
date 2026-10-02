/* =====================================================================
   UI — DOM screens: title, HUD, dialogue panel, bridge card, final
   screen with the personal fairy tale, pause menu, tutorial, toasts.
   ===================================================================== */
(function(){
"use strict";
const N = window.NATS;
const D = N.data, SC = N.scoring, TX = D.TEXT;
const $ = (id) => document.getElementById(id);
const ui = {};

const esc = (s) => String(s);   // all texts are our own fixed data

ui.init = function(){
  document.body.classList.toggle("touch", N.isTouch);
  $("btn-pause").addEventListener("click", () => N.emit("pause"));
  $("btn-sound").addEventListener("click", () => N.emit("togglesound"));
  $("btn-hint").addEventListener("click", () => N.emit("hint"));
  $("btn-map").addEventListener("click", () => N.emit("map"));
  $("btn-talk").addEventListener("click", () => N.emit("interact"));
  $("btn-talk").textContent = TX.interactTouch;
  $("minimap-wrap").addEventListener("click", () => N.emit("map"));
  $("bigmap").addEventListener("click", () => N.emit("map"));
  ui.updateSoundBtn();
  window.addEventListener("resize", () => { if(!$("dialogue").hidden) ui.fitDialogue(); });
};
ui.updateSoundBtn = function(){ $("btn-sound").textContent = N.settings.sound ? "♪" : "♪̸"; $("btn-sound").style.opacity = N.settings.sound ? 1 : 0.55; };

/* ---------------- title ---------------- */
ui.showTitle = function(onStart){
  const el = $("title");
  el.innerHTML = `
    <div class="title-wrap">
      <div class="title-hero">
        <img src="${N.IMG.village}" alt="">
        <div class="title-hero-text"><h1>${TX.title}</h1><h2>${TX.subtitle}</h2></div>
      </div>
      <div class="title-body">
        <p>${TX.intro1}</p>
        <p>${TX.intro2}</p>
        <div class="controls-hint">${TX.controls}</div>
        <button class="btn" id="start-btn">${TX.start}</button>
        <footer class="credit">${TX.footer}</footer>
      </div>
    </div>`;
  el.hidden = false;
  $("start-btn").addEventListener("click", () => { el.hidden = true; onStart(); });
  setTimeout(() => { try{ $("start-btn").focus({ preventScroll: true }); }catch(e){} }, 50);
};

/* ---------------- HUD ---------------- */
ui.hud = function(on){ $("hud").hidden = !on; };
ui.setTrail = function(step){
  if(!step){ $("trail").style.display = "none"; return; }
  let marks = "";
  for(let i = 1; i <= D.TOTAL_STEPS; i++) marks += `<span class="mark${i < step ? " done" : i === step ? " current" : ""}"></span>`;
  $("trail").style.display = "";
  $("trail").innerHTML = `<span>${TX.trail(step)}</span><span class="marks">${marks}</span>`;
};
ui.setObjective = function(text){
  const el = $("objective");
  if(!text){ el.style.display = "none"; return; }
  el.style.display = "";
  el.querySelector(".obj-label").textContent = TX.objectiveLabel;
  el.querySelector(".obj-text").textContent = text;
};
ui.pulseObjective = function(){ const el = $("objective"); el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); const c = $("compass"); c.classList.remove("pulse"); void c.offsetWidth; c.classList.add("pulse"); };
ui.setRoster = function(roster){
  $("roster").innerHTML = roster.map(k => {
    const r = D.ROSTER_INFO[k];
    return `<span class="chip" title="${r.tag}"><img src="${N.IMG[k]}" alt="${r.name}"><span>${r.name}<small>${r.tag}</small></span></span>`;
  }).join("");
};
let promptState = null;
ui.prompt = function(on){
  if(on === promptState) return; promptState = on;
  const el = $("prompt");
  if(on){ el.innerHTML = N.isTouch ? "" : `<kbd>E</kbd>${TX.interactDesktop}`; el.classList.toggle("on", !N.isTouch); }
  else el.classList.remove("on");
  $("btn-talk").classList.toggle("on", !!on);
};
let toastT = null;
ui.toast = function(text, ms){
  const el = $("toast"); el.textContent = text; el.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), ms || 2600);
};
ui.hintLine = function(text){ const el = $("hint-line"); if(text){ el.textContent = text; el.classList.add("on"); } else el.classList.remove("on"); };

/* ---------------- fade / letterbox ---------------- */
ui.fade = function(on, ms){
  const el = $("fade"); el.style.transitionDuration = (ms == null ? 450 : ms) + "ms";
  el.classList.toggle("on", on);
  return new Promise(r => setTimeout(r, ms == null ? 460 : ms + 10));
};
ui.letterbox = function(on){ $("letterbox").classList.toggle("on", on); };

/* ---------------- dialogue ---------------- */
ui.showDialogue = function(stageId, prevIdx, hasBack, onChoose, onBack){
  const st = D.STAGES[stageId];
  const el = $("dialogue");
  const choices = st.choices.map((c, idx) =>
    `<button class="choice-btn${idx === prevIdx ? " prev" : ""}" data-i="${idx}"><span class="key">${idx + 1}</span><span>${esc(c.label)}${idx === prevIdx ? `<span class="prev-note">${TX.prevPick}</span>` : ""}</span></button>`).join("");
  el.innerHTML = `
    <div class="dlg-grid">
      <div class="dlg-text">
        <div class="stage-kicker">${st.category} <span class="tag">${st.tag}</span>${hasBack ? `<button class="back-btn" id="dlg-back">${TX.stageBack}</button>` : ""}</div>
        <div class="stage-setup">${esc(st.setup)}</div>
        <div class="stage-question">${esc(st.question)}</div>
      </div>
      <div class="choices">${choices}</div>
    </div>`;
  el.classList.remove("leaving");
  el.hidden = false;
  el.querySelectorAll(".choice-btn").forEach(b => b.addEventListener("click", () => onChoose(+b.dataset.i)));
  if(hasBack) $("dlg-back").addEventListener("click", onBack);
  ui.fitDialogue();
  setTimeout(() => { const f = el.querySelector(".choice-btn"); if(f && !N.isTouch) try{ f.focus({ preventScroll: true }); }catch(e){} }, 60);
};
/* shrink the font until everything (all three choices) fits without scrolling */
ui.fitDialogue = function(){
  const el = $("dialogue");
  let fs = window.innerWidth < 420 ? 0.94 : window.innerHeight < 500 ? 0.9 : 1.0;
  el.style.setProperty("--fs", fs);
  for(let i = 0; i < 14 && el.scrollHeight > el.clientHeight + 1 && fs > 0.62; i++){ fs -= 0.03; el.style.setProperty("--fs", fs.toFixed(3)); }
  return fs;
};
ui.dialogueFits = function(){ const el = $("dialogue"); return el.scrollHeight <= el.clientHeight + 1; };
ui.hideDialogue = function(){
  const el = $("dialogue"); if(el.hidden) return Promise.resolve();
  el.classList.add("leaving");
  return new Promise(r => setTimeout(() => { el.hidden = true; el.classList.remove("leaving"); r(); }, 300));
};

/* ---------------- bridge card ---------------- */
ui.showBridge = function(id, onContinue, onBack){
  const b = D.BRIDGES[id], el = $("bridge");
  el.innerHTML = `
    <div class="bridge-heading">${b.heading}</div>
    <div class="bridge-text">${b.text}</div>
    <div class="bridge-actions"><button class="back-btn" id="br-back">${TX.bridgeBack}</button><button class="btn" id="br-next">${b.next === "FINAL" ? TX.seeResult : TX.cont}</button></div>`;
  el.style.setProperty("--fs", window.innerHeight < 500 ? 0.86 : 1);
  el.hidden = false; el.classList.remove("leaving");
  $("br-back").addEventListener("click", onBack);
  $("br-next").addEventListener("click", onContinue);
  setTimeout(() => { if(!N.isTouch) try{ $("br-next").focus({ preventScroll: true }); }catch(e){} }, 60);
};
ui.hideBridge = function(){ const el = $("bridge"); el.hidden = true; };

/* ---------------- final ---------------- */
ui.showFinal = function(S, result, onBack, onRestart){
  const tierMeta = D.TIER_META[result.tier], pct = Math.round(result.pct);
  const rows = S.history.map(h => {
    const w = Math.round((h.score / h.max) * 100);
    return `<div class="score-row"><div class="label">${h.category}</div><div class="bar-wrap"><div class="bar" style="width:${w}%"></div></div><div class="num">${h.score} / ${h.max}</div></div>`;
  }).join("");
  const closing = SC.closingText(S, result).map(p => `<p>${p}</p>`).join("");
  const tale = SC.buildTale(S, result).map(p => `<p>${p}</p>`).join("");
  $("final-panel").innerHTML = `
    <div class="seal-row"><div class="seal tier-${result.tier}${result.catastrophe ? " catastrophe" : ""}"><div class="seal-pct">${pct}%</div><div class="seal-sub">${result.totalScore} / ${result.totalMax}</div></div></div>
    <h1 class="result-title">${result.catastrophe ? TX.catastropheTitle : tierMeta.name}</h1>
    <p class="result-sub">${SC.pathLabel(S)}</p>
    <div class="score-table"><h3>${TX.scoreHeading}</h3>${rows}
      <div class="score-total"><span class="k">${TX.totalLabel}</span><span class="v">${result.totalScore} / ${result.totalMax} (${pct}%)</span></div></div>
    <div class="closing-card">${closing}</div>
    <div class="tale-card"><h3>${TX.taleHeading}</h3><p class="tale-hint">${TX.taleHint}</p><div id="tale-body">${tale}</div>
      <div class="tale-actions"><button class="btn btn-ghost" id="copy-tale">${TX.copy}</button></div></div>
    <div class="final-actions"><button class="back-btn" id="fin-back">${TX.finalBack}</button><button class="btn" id="fin-restart">${TX.restart}</button></div>
    <footer class="credit">${TX.footer}</footer>`;
  $("final").hidden = false;
  $("final-panel").scrollTop = 0;
  $("copy-tale").addEventListener("click", ui.copyTale);
  $("fin-back").addEventListener("click", onBack);
  $("fin-restart").addEventListener("click", onRestart);
};
ui.hideFinal = function(){ $("final").hidden = true; };
ui.copyTale = function(){
  const body = $("tale-body"); if(!body) return;
  const text = TX.taleClipboardHead + "\n\n" + Array.from(body.querySelectorAll("p")).map(el => el.textContent).join("\n\n");
  const btn = $("copy-tale");
  ui.lastCopied = text;
  const done = () => { if(btn){ btn.textContent = TX.copied; setTimeout(() => { btn.textContent = TX.copy; }, 2200); } };
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand("copy") ? done() : (btn.textContent = TX.copyFail); }catch(e){ if(btn) btn.textContent = TX.copyFail; }
    document.body.removeChild(ta);
  };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback);
  else fallback();
};

/* ---------------- pause ---------------- */
ui.showPause = function(opts){
  const s = N.settings, card = $("pause").querySelector(".pause-card");
  card.innerHTML = `
    <h2>${TX.pause}</h2>
    <button class="menu-btn primary" data-a="resume">${TX.resume}</button>
    <button class="menu-btn" data-a="back" ${opts.canBack ? "" : "disabled"}>${TX.pauseBack}</button>
    <button class="menu-btn" data-a="unstick" ${opts.canUnstick ? "" : "disabled"}>⟲ ${TX.unstick}</button>
    <button class="menu-btn" data-a="restart">${TX.restart}</button>
    <hr>
    <button class="menu-btn" data-a="hints">${s.hints ? TX.hintsOn : TX.hintsOff}</button>
    <button class="menu-btn" data-a="sound">${s.sound ? TX.soundOn : TX.soundOff}</button>
    <button class="menu-btn" data-a="gfx">${TX.gfx[s.quality || "medium"]}</button>
    <button class="menu-btn" data-a="motion">${s.reducedMotion ? TX.motionOn : TX.motionOff}</button>
    <div class="controls-hint">${TX.controls}</div>
    <footer class="credit">${TX.footer}</footer>`;
  $("pause").hidden = false;
  card.querySelectorAll(".menu-btn").forEach(b => b.addEventListener("click", (e) => { e.stopPropagation(); opts.onAction(b.dataset.a); }));
  setTimeout(() => { try{ card.querySelector(".menu-btn").focus({ preventScroll: true }); }catch(e){} }, 30);
};
ui.hidePause = function(){ $("pause").hidden = true; };
ui.pauseOpen = () => !$("pause").hidden;

/* ---------------- tutorial (shown once) ---------------- */
ui.showTutorial = function(){
  const el = $("tutorial");
  el.innerHTML = `<button class="close" aria-label="×">×</button>${TX.controls}<div class="keys"><kbd>H</kbd> ✦ <kbd>M</kbd> ◎ <kbd>R</kbd> ⟲ <kbd>Esc</kbd> ❚❚</div>`;
  if(N.isTouch) el.innerHTML = `<button class="close" aria-label="×">×</button>◐ ✋ → ✦ ◎ · ${TX.interactTouch}`;
  el.hidden = false;
  const close = () => { el.hidden = true; N.settings.tutorialSeen = true; N.saveSettings(); };
  el.querySelector(".close").addEventListener("click", close);
  ui._tutClose = close;
  setTimeout(close, 14000);
};
ui.closeTutorial = function(){ if(ui._tutClose && !$("tutorial").hidden) ui._tutClose(); };

ui.loaded = function(){ $("loading").classList.add("done"); setTimeout(() => $("loading").remove(), 700); };
ui.error = function(msg){ const e = $("error"); e.textContent = msg; e.hidden = false; const l = $("loading"); if(l) l.remove(); };
ui.bigmapOpen = () => !$("bigmap").hidden;
ui.setBigmap = (on) => { $("bigmap").hidden = !on; };

N.ui = ui;
})();
