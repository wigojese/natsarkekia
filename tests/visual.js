/* visual check: node tests/visual.js outdir [quality]
   screenshots of places/times of day using the debug API */
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const out = process.argv[2] || ".", q = process.argv[3] || "high";
  const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on("console", m => { if((m.type() === "error" || m.type() === "warning") && !/ERR_CERT|net::ERR|fonts/.test(m.text())) errs.push(m.text()); });
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  await p.goto("file://" + path.resolve(__dirname, "../index.html"));
  await p.waitForFunction(() => window.__NATS__ && !document.getElementById("title").hidden, null, { timeout: 180000 });
  await p.screenshot({ path: out + "/00-title.png" });
  await p.evaluate(() => document.getElementById("start-btn").click());
  await p.waitForTimeout(4500);
  await p.screenshot({ path: out + "/01-intro.png" });
  await p.evaluate((q) => { __NATS__.setQuality(q); NATS.cine.endFly(); NATS.ui.closeTutorial(); }, q);
  /* [name, preset, player x, z, camera yaw, pitch, dist] */
  const shots = [
    ["sunrise-village", "dawn", 262, 92, -1.9, 0.18, 9],
    ["morning-oak", "morning", 268, 106, -1.2, 0.25, 9],
    ["lookout-top", "midday1", 186, 36, 2.2, 0.35, 9],
    ["sheep-meadow", "midday2", 62, 140, 0.8, 0.35, 10],
    ["mill", "afternoon1", -22, 128, -1.0, 0.3, 14],
    ["chapel", "afternoon2", -228, 72, 0.2, 0.25, 14],
    ["sunset-hill", "evening", -160, 105, 1.4, 0.15, 9],
    ["dusk-cabin", "dusk", 52, -112, -0.4, 0.25, 13],
    ["night-camp", "night", -268, -178, 0.6, 0.3, 10],
    ["deepnight-cave", "deepnight", -326, -284, 0.7, 0.2, 12],
    ["lodge", "afternoon1", -170, -36, -0.7, 0.3, 13],
    ["tower-hill", "evening", 252, -60, 3.0, 0.18, 12],
  ];
  for(const [name, preset, x, z, yaw, pitch, dist] of shots){
    await p.evaluate(([preset, x, z, yaw, pitch, dist]) => {
      NATS.sky.setPreset(preset, 0);
      NATS.chars.player.actor.place(x, z);
      NATS.rig.mode = "follow"; NATS.rig.yaw = yaw; NATS.rig.pitch = pitch; NATS.rig.wantDist = NATS.rig.curDist = dist;
      NATS.rig.target.set(x, NATS.terrain.walkHeight(x, z) + 1.5, z);
    }, [preset, x, z, yaw, pitch, dist]);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${out}/${name}.png` });
  }
  console.log("fps", await p.evaluate(() => __NATS__.fps()), JSON.stringify(await p.evaluate(() => __NATS__.info())), "animals", await p.evaluate(() => NATS.fauna.count()));
  console.log(errs.slice(0, 10).join("\n"));
  await b.close();
})();
