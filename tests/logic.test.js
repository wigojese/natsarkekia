/* Node tests for the pure data + scoring layer (no WebGL needed).
   Run:  node tests/logic.test.js [path/to/2D-game.html]
   1. text integrity — STAGES / BRIDGES / presets vs. docs/build-prompt.md (Appendix A–C)
   2. optional: deep comparison with the original 2D game file (data + closing texts)
   3. Appendix D scoring vectors */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const D = require("../js/data.js");
const SC = require("../js/scoring.js");
let fails = 0, passes = 0;
function check(name, fn){ try{ fn(); passes++; } catch(e){ fails++; console.log("FAIL", name, "\n   ", e.message.split("\n").slice(0,6).join("\n    ")); } }

/* ---------- 1. Appendix A/B/C parse ---------- */
const md = fs.readFileSync(path.join(__dirname, "../docs/build-prompt.md"), "utf8");
const appA = md.slice(md.indexOf("## APPENDIX A"), md.indexOf("## APPENDIX B"));
const blocks = appA.split(/\n### /).slice(1);
check("appendix A has 18 stages", () => assert.strictEqual(blocks.length, 18));
for(const b of blocks){
  const head = b.split("\n")[0];
  const m = head.match(/^`(\w+)` — step (\d+) — (.+?) · (.+?)(?:  — \*\*Devi visible\*\*)?$/);
  const id = m[1];
  check(`stage ${id} header`, () => {
    const st = D.STAGES[id];
    assert.ok(st, "missing stage");
    assert.strictEqual(st.step, +m[2]); assert.strictEqual(st.category, m[3]); assert.strictEqual(st.tag, m[4]);
    assert.strictEqual(!!st.devi, /Devi visible/.test(head));
  });
  const setup = b.match(/- \*\*setup:\*\* (.*)/)[1], question = b.match(/- \*\*question:\*\* (.*)/)[1];
  check(`stage ${id} setup/question`, () => { assert.strictEqual(D.STAGES[id].setup, setup); assert.strictEqual(D.STAGES[id].question, question); });
  const ch = b.split(/\n- \*\*choice \d\*\*/).slice(1);
  check(`stage ${id} choices`, () => {
    assert.strictEqual(ch.length, 3);
    ch.forEach((c, i) => {
      const sc = +c.match(/score \*\*(\d+)\*\*/)[1], next = c.match(/→ `([\w-]+)`/)[1];
      const eff = c.match(/effect: `(\{.*?\})`/);
      const label = c.match(/label: (.*)/)[1], story = c.match(/story: (.*)/)[1];
      const real = D.STAGES[id].choices[i];
      assert.strictEqual(real.score, sc); assert.strictEqual(real.next, next);
      assert.strictEqual(real.label, label); assert.strictEqual(real.story, story);
      assert.deepStrictEqual(real.effect || null, eff ? JSON.parse(eff[1]) : null);
    });
  });
}
const appB = md.slice(md.indexOf("## APPENDIX B"), md.indexOf("## APPENDIX C"));
appB.split(/\n### /).slice(1).forEach(b => {
  const id = b.match(/^`([\w-]+)`/)[1];
  check(`bridge ${id}`, () => {
    assert.strictEqual(D.BRIDGES[id].heading, b.match(/\*\*heading:\*\* (.*)/)[1]);
    assert.strictEqual(D.BRIDGES[id].text, b.match(/\*\*text:\*\* (.*)/)[1]);
    assert.strictEqual(D.BRIDGES[id].next, b.match(/\*\*next:\*\* `(\w+)`/)[1]);
  });
});
const appC = md.slice(md.indexOf("## APPENDIX C"), md.indexOf("## APPENDIX D"));
check("title texts", () => {
  assert.ok(appC.includes(D.TEXT.intro1)); assert.ok(appC.includes(D.TEXT.intro2));
  assert.ok(appC.includes(D.TEXT.taleOpening)); assert.ok(appC.includes(D.TEXT.taleHint));
});
check("presets", () => {
  const rows = appC.split("\n").filter(l => /^\| `\w+` \| #/.test(l));
  assert.strictEqual(rows.length, 14);
  rows.forEach(r => {
    const c = r.split("|").map(s => s.trim());
    const key = c[1].replace(/`/g, ""), p = D.PRESETS[key];
    assert.deepStrictEqual(c[2].split(" / "), p.sky, key);
    const cel = c[3].split(", ");
    assert.strictEqual(cel[0], p.sun.type); assert.strictEqual(cel[1], p.sun.left + "%"); assert.strictEqual(cel[2], p.sun.top + "%");
    assert.strictEqual(cel[3], p.sun.color); assert.strictEqual(cel[4], p.sun.color2); assert.strictEqual(cel[5], "glow " + p.sun.glow);
    assert.strictEqual(c[4], p.phase); assert.strictEqual(c[5].replace(/`/g, ""), p.tint);
  });
});
/* closing paragraphs: every closing string produced must appear in Appendix C */
function stateFor(scores, path, roster){
  const S = SC.newState();
  scores.forEach((s, i) => S.history.push({ category: "x", score: s, max: 1000, step: i + 1 }));
  S.path = path; S.roster = roster; return S;
}
check("closing texts appear verbatim in Appendix C", () => {
  const variants = [];
  for(const [path, roster] of [["solo", []], ["team-full", ["hunter","elderwoman","blacksmith"]]])
    for(const scores of [Array(10).fill(1000), Array(10).fill(500), [...Array(8).fill(1000), 500, 1000], [...Array(9).fill(1000), 300],
                         [1000,300,1000,500,...Array(6).fill(1000)], [1000,300,1000,500,1000,500,...Array(4).fill(1000)], [...Array(8).fill(1000),500,500]])
      variants.push(stateFor(scores, path, roster));
  for(const S of variants){
    const res = SC.computeResult(S);
    SC.closingText(S, res).forEach(p => {
      const generic = p.replace(/ნაცარქექია და მონადირე, დარბაისელი ქალი და მჭედლის ბიჭი/, "{ჯგუფი}");
      const parts = generic.split(/(?<=\.) /);  // paragraph-1 strings in Appendix C are given as one line
      assert.ok(appC.includes(generic) || appC.includes(generic.replace(/^(დევი ბოლომდე არ დამარცხებულა\. )/, "")), "missing: " + generic.slice(0, 80));
    });
  }
});

/* ---------- 2. optional deep comparison with the original 2D file ---------- */
const orig = process.argv[2];
if(orig && fs.existsSync(orig)){
  const html = fs.readFileSync(orig, "utf8");
  const code = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
  const el = () => ({ innerHTML: "", style: {}, classList: { add(){}, remove(){} }, appendChild(){}, querySelectorAll(){ return []; } });
  const ctx = { document: { getElementById: el, createElement: el }, requestAnimationFrame(){}, setTimeout(){}, navigator: {} };
  vm.createContext(ctx);
  vm.runInContext(code + "\n;globalThis.__2D={STAGES,BRIDGES,PRESETS,STEP_PRESET,BRIDGE_PRESET,TIER_META,ROSTER_INFO,setS:(v)=>{S=v},computeResult,closingText,buildTale,pathLabel};", ctx);
  const R = ctx.__2D;
  const strip = (o) => JSON.parse(JSON.stringify(o));
  check("2D: STAGES identical", () => assert.deepStrictEqual(strip(D.STAGES), strip(R.STAGES)));
  check("2D: BRIDGES identical", () => assert.deepStrictEqual(strip(D.BRIDGES), strip(R.BRIDGES)));
  check("2D: PRESETS identical", () => assert.deepStrictEqual(strip(D.PRESETS), strip(R.PRESETS)));
  check("2D: step/bridge presets + tiers", () => { assert.deepStrictEqual(strip(D.STEP_PRESET), strip(R.STEP_PRESET)); assert.deepStrictEqual(strip(D.BRIDGE_PRESET), strip(R.BRIDGE_PRESET)); assert.deepStrictEqual(strip(D.TIER_META), strip(R.TIER_META)); });
  check("2D: roster names/tags", () => { for(const k in D.ROSTER_INFO){ assert.strictEqual(D.ROSTER_INFO[k].name, R.ROSTER_INFO[k].name); assert.strictEqual(D.ROSTER_INFO[k].tag, R.ROSTER_INFO[k].tag); } });
  check("2D: results/closing/tale/pathLabel identical over random games", () => {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for(let n = 0; n < 400; n++){
      const S = SC.newState(); let id = "s1";
      while(id !== "FINAL"){
        if(D.BRIDGES[id]){ SC.addBridgeStory(S, id); id = D.BRIDGES[id].next; continue; }
        id = SC.applyChoice(S, id, Math.floor(rnd() * 3)).next;
      }
      R.setS(strip(S));
      const a = SC.computeResult(S), b = R.computeResult();
      assert.deepStrictEqual(a, strip(b));
      assert.deepStrictEqual(SC.closingText(S, a), strip(R.closingText(b)));
      assert.deepStrictEqual(SC.buildTale(S, a), strip(R.buildTale(b)));
      assert.strictEqual(SC.pathLabel(S), R.pathLabel());
    }
  });
} else console.log("(skipping 2D comparison — pass the original 2D html path to enable)");

/* ---------- 3. Appendix D vectors ---------- */
const V = [
  ["team all best", Array(10).fill(1000), "team-full", [10000,100,3,false,false,true]],
  ["team 9th mid", [...Array(8).fill(1000),500,1000], "team-full", [9500,95,2,false,false,false]],
  ["team 9th&10th mid", [...Array(8).fill(1000),500,500], "team-full", [9000,90,1,false,false,false]],
  ["team 10th weak", [...Array(9).fill(1000),300], "team-full", [9300,93,0,true,false,false]],
  ["solo all ideal", [1000,300,1000,500,...Array(6).fill(1000)], "solo", [8800,88,1,false,true,true]],
  ["solo one non-ideal", [1000,300,1000,500,1000,500,...Array(4).fill(1000)], "solo", [8300,83,0,false,true,false]],
  ["delayed team", [1000,300,1000,1000,...Array(6).fill(1000)], "team-delayed", [9300,93,3,false,false,true]],
  ["team all mid", Array(10).fill(500), "team-full", [5000,50,0,false,false,false]]
];
for(const [name, scores, p, exp] of V) check("vector: " + name, () => {
  const r = SC.computeResult(stateFor(scores, p, []));
  assert.deepStrictEqual([r.totalScore, Math.round(r.pct), r.tier, r.catastrophe, r.soloCapped, r.allBest], exp);
});

console.log(`\nlogic tests: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
