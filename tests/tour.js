/* visual tour: node tests/tour.js outdir [answers e.g. 2,0,0,0,...] [w] [h] */
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const out = process.argv[2] || ".";
  const answers = (process.argv[3] || "2,0,0,0,1,1,1,2,0,0").split(",").map(Number);
  const W = +(process.argv[4] || 1280), H = +(process.argv[5] || 720);
  const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const logs = [];
  p.on("console", m => { if((m.type() === "error" || m.type() === "warning") && !/ERR_CERT|fonts/.test(m.text())) logs.push(m.type() + ": " + m.text()); });
  p.on("pageerror", e => logs.push("pageerror: " + e.message));
  await p.goto("file://" + path.resolve(__dirname, "../index.html"));
  await p.waitForFunction(() => window.__NATS__ && !document.getElementById("title").hidden, null, { timeout: 120000 });
  await p.click("#start-btn");
  await p.waitForFunction(() => __NATS__.getState().mode === "EXPLORE");
  await p.evaluate((q) => q && __NATS__.setQuality(q), process.env.Q || "");
  await p.waitForTimeout(3000);
  const st = () => p.evaluate(() => __NATS__.getState());
  let n = 0;
  for(let k = 0; k < 14; k++){
    const s = await st();
    if(s.mode === "FINAL") break;
    if(s.mode === "CINEMATIC"){
      await p.waitForTimeout(1500);
      await p.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}-bridge-${s.current}.png` });
      await p.evaluate(() => __NATS__.skipCinematic());
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}-bridgecard-${s.current}.png` });
      await p.evaluate(() => __NATS__.continue());
      await p.waitForFunction(() => ["EXPLORE", "FINAL"].includes(__NATS__.getState().mode), null, { timeout: 30000 });
      await p.waitForTimeout(2500);
      continue;
    }
    const obj = s.objective;
    await p.evaluate((id) => __NATS__.teleportToSite(id), obj);
    await p.waitForTimeout(6000);   // time of day transition
    await p.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}-explore-${obj}.png` });
    const ok = await p.evaluate(() => __NATS__.interact());
    if(obj === "t3" || obj === "u3"){ await p.waitForTimeout(4000); await p.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}-observe-${obj}.png` }); await p.waitForTimeout(3500); await p.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}-observe2-${obj}.png` }); await p.evaluate(() => __NATS__.skipCinematic()); await p.waitForFunction(() => __NATS__.getState().dialogueOpen, null, { timeout: 30000 }); }
    if(!ok){ console.log("interact failed at", obj, JSON.stringify(await p.evaluate(() => __NATS__.getObjective()))); break; }
    await p.waitForTimeout(2600);
    await p.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}-dialogue-${obj}.png` });
    const step = (await p.evaluate((id) => NATS.data.STAGES[id].step, obj));
    await p.evaluate((i) => __NATS__.answer(i), answers[step - 1]);
    await p.waitForTimeout(1200);
    if(step === 4 || step === 8){ await p.waitForTimeout(2600); await p.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}-flyover-after-${obj}.png` }); }
  }
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}-final.png` });
  const s = await st();
  console.log("final", s.mode, JSON.stringify(s.result), s.S.path, s.S.roster, "fps", await p.evaluate(() => __NATS__.fps()), JSON.stringify(await p.evaluate(() => __NATS__.info())));
  console.log(logs.slice(0, 30).join("\n"));
  await b.close();
})();
