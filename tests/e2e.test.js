/* End-to-end tests in a real browser (Playwright + Chromium/SwiftShader).
   Run:  node tests/e2e.test.js [screenshotDir]
   Covers §16: storylines → FINAL, back chain restores state, objective/beacon
   correctness, dialogue layout at 5 viewports, stability, FPS. */
"use strict";
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const URL = "file://" + path.resolve(__dirname, "../index.html");
const OUT = process.argv[2] || null;
if(OUT) fs.mkdirSync(OUT, { recursive: true });
const ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info", "--js-flags=--expose-gc"];

let passes = 0, fails = 0;
const ok = (cond, name, extra) => { if(cond){ passes++; } else { fails++; console.log("FAIL", name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ""); } };

/* expected site per stage step (§4.1) */
const SITE_NAMES = { 1: "სოფლის მოედანი", 2: "გზაგასაყარი ძველ მუხასთან", 3: "საგუშაგო ბორცვი", 4: "საცდელი მდელო", 5: "დევის ბილიკი",
  6: "სამგზავრო ბანაკი", 7: "ვაჭრის კარავი", 8: "ბანაკი მთის ძირას", 9: "ღამის კოცონი", 10: "დევის მღვიმე" };
const STEP_PRESET = { 1: "dawn", 2: "morning", 3: "midday1", 4: "midday2", 5: "afternoon1", 6: "afternoon2", 7: "evening", 8: "dusk", 9: "night", 10: "deepnight" };

/* choice index per stage id; 8 storylines */
const STORIES = {
  "team-full all best":      { s1: 2, s2: 0, t3: 0, t4: 2, t5: 1, t6: 1, t7: 1, t8: 2, t9: 0, t10: 0, expect: { path: "team-full", tier: 3, cat: false, pct: 100 } },
  "team-weak mixed":         { s1: 0, s2: 2, t3: 2, t4: 0, t5: 1, t6: 2, t7: 1, t8: 0, t9: 0, t10: 1, expect: { path: "team-weak", tier: 0, cat: false, pct: 65 } },
  "solo all ideal":          { s1: 2, s2: 1, u3: 1, u4: 2, u5: 0, u6: 2, u7: 1, u8: 2, u9: 0, u10: 1, expect: { path: "solo", tier: 1, cat: false, pct: 88, capped: true } },
  "team-delayed best":       { s1: 2, s2: 1, u3: 1, u4: 1, t5: 1, t6: 1, t7: 1, t8: 2, t9: 0, t10: 0, expect: { path: "team-delayed", tier: 3, cat: false, pct: 93 } },
  "team-full catastrophe":   { s1: 2, s2: 0, t3: 0, t4: 2, t5: 1, t6: 1, t7: 1, t8: 2, t9: 0, t10: 2, expect: { path: "team-full", tier: 0, cat: true, pct: 93 } },
  "solo non-ideal":          { s1: 2, s2: 1, u3: 1, u4: 2, u5: 0, u6: 0, u7: 1, u8: 2, u9: 0, u10: 1, expect: { path: "solo", tier: 0, cat: false, pct: 83, capped: true } },
  "team-full all mid":       { s1: 0, s2: 0, t3: 2, t4: 0, t5: 0, t6: 2, t7: 0, t8: 0, t9: 1, t10: 1, expect: { path: "team-full", tier: 0, cat: false, pct: 55 } },
  "solo catastrophe":        { s1: 1, s2: 1, u3: 0, u4: 0, u5: 1, u6: 1, u7: 0, u8: 0, u9: 2, u10: 2, expect: { path: "solo", tier: 0, cat: true, pct: 38 } }
};

async function newPage(browser, w, h){
  const p = await browser.newPage({ viewport: { width: w || 1280, height: h || 720 } });
  p.errors = [];
  p.on("console", m => { if((m.type() === "error" || m.type() === "warning") && !/ERR_CERT|ERR_NAME|fonts\.g|net::ERR/.test(m.text())) p.errors.push(m.type() + ": " + m.text()); });
  p.on("pageerror", e => p.errors.push("pageerror: " + e.message));
  await p.goto(URL);
  await p.waitForFunction(() => window.__NATS__ && document.getElementById("title") && !document.getElementById("title").hidden, null, { timeout: 180000 });
  return p;
}
const S = (p) => p.evaluate(() => __NATS__.getState());
const waitMode = (p, modes, t) => p.waitForFunction((m) => m.includes(__NATS__.getState().mode) && !__NATS__.getState().paused, modes, { timeout: t || 30000 });

async function startGame(p){
  await p.evaluate(() => document.getElementById("start-btn").click());
  await waitMode(p, ["EXPLORE"]);
  await p.waitForTimeout(800);
}

/* plays one stage: teleport, check prompt + objective, interact, answer */
async function playStage(p, choices, snaps, name){
  const st = await S(p);
  const id = st.objective, step = await p.evaluate((i) => NATS.data.STAGES[i].step, id);
  const obj = await p.evaluate(() => __NATS__.getObjective());
  ok(obj.site === SITE_NAMES[step], `${name}: objective site for ${id}`, obj.site);
  ok(st.preset === STEP_PRESET[step], `${name}: preset at ${id}`, st.preset);
  /* interacting at a non-active site does nothing */
  if(step < 10){
    await p.evaluate((s) => __NATS__.teleportToSite(s), step + 1);
    await p.waitForTimeout(250);
    ok(await p.evaluate(() => __NATS__.interact()) === false, `${name}: interact at later site ${step + 1} ignored`);
    ok((await S(p)).mode === "EXPLORE", `${name}: still exploring`);
  }
  await p.evaluate((i) => __NATS__.teleportToSite(i), id);
  await p.waitForTimeout(350);
  ok((await S(p)).prompt === true, `${name}: prompt at ${id}`);
  snaps.push({ id, step, before: await S(p) });
  ok(await p.evaluate(() => __NATS__.interact()) === true, `${name}: interact opens ${id}`);
  await p.waitForFunction(() => __NATS__.getState().dialogueOpen, null, { timeout: 15000 });
  const fits = await p.evaluate(() => NATS.ui.dialogueFits());
  ok(fits, `${name}: dialogue fits at ${id}`);
  const next = await p.evaluate((i) => __NATS__.answer(i), choices[id]);
  ok(!!next, `${name}: answer ${id}`, next);
  await p.waitForTimeout(500);
  return next;
}

async function playStory(p, name, choices){
  const snaps = [];
  for(let guard = 0; guard < 20; guard++){
    const st = await S(p);
    if(st.mode === "FINAL") break;
    if(st.mode === "CINEMATIC"){
      await p.evaluate(() => __NATS__.skipCinematic());
      await p.waitForFunction(() => __NATS__.getState().bridgeOpen, null, { timeout: 10000 });
      snaps.push({ bridge: st.current, before: await S(p) });
      if(OUT && name === "team-full all best" || OUT && st.current === "bridge-delayed" || OUT && st.current === "bridge-team-weak" || OUT && st.current === "bridge-solo" && name === "solo all ideal")
        await p.screenshot({ path: `${OUT}/bridge-${st.current}.png` });
      await p.evaluate(() => __NATS__.continue());
      await waitMode(p, ["EXPLORE", "FINAL"], 30000);
      await p.waitForTimeout(500);
      continue;
    }
    if(st.mode !== "EXPLORE"){ await p.waitForTimeout(400); continue; }
    await playStage(p, choices, snaps, name);
  }
  return snaps;
}

(async () => {
  const browser = await chromium.launch({ args: ARGS });
  const t0 = Date.now();

  /* ---------- storylines + back chain ---------- */
  const p = await newPage(browser);
  let first = true;
  for(const [name, choices] of Object.entries(STORIES)){
    if(first){ await startGame(p); first = false; }
    else { await p.evaluate(() => __NATS__.start()); await waitMode(p, ["EXPLORE"]); await p.waitForTimeout(800); }
    const snaps = await playStory(p, name, choices);
    await p.waitForFunction(() => __NATS__.getState().finalOpen, null, { timeout: 20000 });
    const st = await S(p), r = st.result, e = choices.expect;
    ok(st.mode === "FINAL", `${name}: reached FINAL`);
    ok(st.S.path === e.path, `${name}: path`, st.S.path);
    ok(r.tier === e.tier && r.catastrophe === e.cat && Math.round(r.pct) === e.pct && (!!r.soloCapped) === !!e.capped, `${name}: result`, r);
    ok(st.S.history.length === 10, `${name}: 10 answers`);
    ok(st.S.story.length >= 11, `${name}: tale fragments`, st.S.story.length);
    const expectPreset = r.catastrophe ? "catastrophe" : ["defeatashen", "victorydamaged", "victorydawn", "victorydawn"][r.tier];
    ok(st.preset === expectPreset, `${name}: final preset`, st.preset);
    ok(st.devi === (r.tier === 0 || r.catastrophe), `${name}: Devi on final`);
    const tale = await p.evaluate(() => document.querySelectorAll("#tale-body p").length);
    ok(tale === st.S.story.length + 1 + (await p.evaluate(() => NATS.scoring.closingText(__NATS__.getState().S, __NATS__.getState().result).length)), `${name}: tale paragraphs`);
    if(OUT){ await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/final-${name.replace(/\s+/g, "_")}.png` }); }
    /* copy button */
    await p.evaluate(() => NATS.ui.copyTale());
    const copied = await p.evaluate(() => NATS.ui.lastCopied || "");
    ok(copied.startsWith("ნაცარქექია სქრამის მიხედვით — ჩემი ზღაპარი\n\n"), `${name}: clipboard text`);
    /* back chain FINAL → stage 1 (only for the first four, it is slow) */
    if(["team-full all best", "team-delayed best", "solo all ideal", "team-weak mixed"].includes(name)){
      const decisions = snaps.filter(s => s.id);
      for(let i = decisions.length - 1; i >= 0; i--){
        const d = decisions[i];
        await p.evaluate(() => __NATS__.back());
        await p.waitForFunction((id) => __NATS__.getState().dialogueOpen && __NATS__.getState().current === id && __NATS__.getState().mode === "DIALOGUE", d.id, { timeout: 20000 });
        await p.waitForTimeout(150);
        const now = await S(p), b = d.before;
        ok(now.S.history.length === b.S.history.length, `${name}: back→${d.id} history`, [now.S.history.length, b.S.history.length]);
        ok(JSON.stringify(now.S.story) === JSON.stringify(b.S.story), `${name}: back→${d.id} story`);
        ok(JSON.stringify(now.S.roster) === JSON.stringify(b.S.roster) && now.S.path === b.S.path, `${name}: back→${d.id} roster/path`, [now.S.roster, now.S.path, b.S.roster, b.S.path]);
        ok(now.preset === b.preset, `${name}: back→${d.id} preset`, [now.preset, b.preset]);
        ok(JSON.stringify(now.following.sort()) === JSON.stringify(b.S.roster.slice().sort()), `${name}: back→${d.id} companions`, now.following);
        const prevMarked = await p.evaluate(() => !!document.querySelector(".choice-btn.prev .prev-note"));
        ok(prevMarked, `${name}: back→${d.id} previous pick marked`);
        const hasBack = await p.evaluate(() => !!document.getElementById("dlg-back"));
        ok(hasBack === (i > 0), `${name}: back button visibility at ${d.id}`);
      }
    }
    if(name === "team-delayed best"){
      /* going back from t5 after bridge-delayed returns to u4 with path solo and no roster — covered above; check explicitly */
    }
  }
  ok(p.errors.length === 0, "no console errors/warnings during storylines", p.errors.slice(0, 5));

  /* ---------- stability: NaN, map bounds, memory over restarts ---------- */
  const mem = [];
  for(let k = 0; k < 4; k++){
    await p.evaluate(() => __NATS__.start()); await waitMode(p, ["EXPLORE"]); await p.waitForTimeout(600);
    await p.evaluate(() => { if(window.gc) gc(); });
    mem.push(await p.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : 0));
  }
  if(mem[1]) ok(mem[3] < mem[1] * 1.2, "memory growth < 20% over three restarts", mem.map(m => (m / 1e6).toFixed(1) + "MB"));
  /* walk east into the map edge for a while: must stay inside */
  await p.evaluate(() => { NATS.chars.player.actor.place(340, 120); NATS.rig.yaw = -Math.PI / 2; });
  await p.keyboard.down("KeyW"); await p.keyboard.down("ShiftLeft");
  await p.waitForTimeout(6000);
  await p.keyboard.up("KeyW"); await p.keyboard.up("ShiftLeft");
  let pos = (await S(p)).player;
  ok(isFinite(pos.x) && isFinite(pos.z) && isFinite(pos.y), "no NaN positions", pos);
  ok(await p.evaluate(({ x, z }) => NATS.terrain.superR(x, z) <= NATS.terrain.PLAY + 0.5, pos), "player cannot leave the map", pos);
  const comp = await p.evaluate(() => NATS.chars.list.map(a => [a.key, a.x, a.z]).filter(a => !isFinite(a[1]) || !isFinite(a[2])));
  ok(comp.length === 0, "no NaN on any character", comp);
  /* walking into deep water is blocked */
  await p.evaluate(() => { const T = NATS.terrain; NATS.chars.player.actor.place(-48, -140); NATS.rig.yaw = -Math.PI / 2; });
  await p.keyboard.down("KeyW"); await p.waitForTimeout(4000); await p.keyboard.up("KeyW");
  pos = (await S(p)).player;
  ok(await p.evaluate(({ x, z }) => NATS.terrain.waterDepth(x, z) < 1.0, pos), "deep water blocks the player", pos);

  /* ---------- FPS (SwiftShader = software rendering, lower bound only) ---------- */
  const fps = {};
  for(const q of ["medium", "low"]){
    await p.evaluate((q) => __NATS__.setQuality(q), q);
    await p.evaluate(() => __NATS__.teleportToSite("s2"));
    await p.waitForTimeout(4000);
    fps[q] = await p.evaluate(() => __NATS__.fps());
  }
  const calls = await p.evaluate(() => __NATS__.info());
  console.log("FPS (SwiftShader, lower bound):", JSON.stringify(fps), "render info:", JSON.stringify(calls));
  ok(calls.calls < 300, "draw calls < 300", calls.calls);
  ok(p.errors.length === 0, "no console errors/warnings overall", p.errors.slice(0, 5));
  await p.close();

  /* ---------- layout: all three choices visible without scrolling ---------- */
  for(const [w, h] of [[1280, 720], [1920, 1080], [390, 844], [844, 390], [768, 1024]]){
    const q = await newPage(browser, w, h);
    await startGame(q);
    for(const id of ["t10", "t4", "t6", "u4", "s2"]){
      await q.evaluate((id) => { NATS.ui.closeTutorial(); NATS.ui.showDialogue(id, 0, true, () => {}, () => {}); }, id);
      await q.waitForTimeout(500);
      const m = await q.evaluate(() => {
        const el = document.getElementById("dialogue"), r = el.getBoundingClientRect();
        const btns = [...el.querySelectorAll(".choice-btn")].map(b => b.getBoundingClientRect());
        return { fits: el.scrollHeight <= el.clientHeight + 1, inView: btns.every(b => b.top >= 0 && b.bottom <= innerHeight + 0.5 && b.right <= innerWidth + 0.5 && b.left >= -0.5),
                 n: btns.length, top: r.top, h: innerHeight, fs: getComputedStyle(el).getPropertyValue("--fs"), minFont: Math.min(...[...el.querySelectorAll(".choice-btn")].map(b => parseFloat(getComputedStyle(b).fontSize))) };
      });
      ok(m.fits && m.inView && m.n === 3, `layout ${w}x${h} ${id}: three choices visible, no scroll`, m);
      ok(m.minFont >= 11, `layout ${w}x${h} ${id}: readable font`, m.minFont);
      if(OUT && (id === "t10")) await q.screenshot({ path: `${OUT}/layout-${w}x${h}-${id}.png` });
    }
    ok(q.errors.length === 0, `layout ${w}x${h}: no console errors`, q.errors.slice(0, 3));
    await q.close();
  }

  await browser.close();
  console.log(`\ne2e: ${passes} passed, ${fails} failed  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
