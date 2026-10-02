/* quick smoke run: node tests/smoke.js [outdir] */
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const out = process.argv[2] || ".";
  const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  p.on("console", m => { if(m.type() === "error" || m.type() === "warning") logs.push(m.type() + ": " + m.text()); });
  p.on("pageerror", e => logs.push("pageerror: " + e.message));
  const t0 = Date.now();
  await p.goto("file://" + path.resolve(__dirname, "../index.html"));
  await p.waitForFunction(() => window.__NATS__ && document.getElementById("title") && !document.getElementById("title").hidden, null, { timeout: 120000 });
  console.log("boot ms", Date.now() - t0);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + "/01-title.png" });
  await p.click("#start-btn");
  await p.waitForTimeout(2500);
  await p.screenshot({ path: out + "/02-start.png" });
  console.log(JSON.stringify(await p.evaluate(() => ({ s: __NATS__.getState(), o: __NATS__.getObjective(), i: __NATS__.info(), fps: __NATS__.fps() }))).slice(0, 800));
  console.log(logs.slice(0, 30).join("\n"));
  await b.close();
})();
