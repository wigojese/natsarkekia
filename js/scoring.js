/* =====================================================================
   SCORING + STATE MODULE — pure functions, no rendering.
   Ported unchanged from the 2D game; the only difference is that the game
   state `S` is passed in instead of being read from a global.
   Works in the browser (window.NATS.scoring) and in Node (require).
   ===================================================================== */
(function(root){
"use strict";

const D = (typeof module !== "undefined" && module.exports) ? require("./data.js") : root.NATS.data;
const { STAGES, BRIDGES, ROSTER_INFO, TEXT } = D;

/* ---------- state ---------- */
function newState(){ return { history: [], roster: [], path: null, story: [] }; }
function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }

/* applies a choice exactly like the 2D choose(): returns { next, navEntry } */
function applyChoice(S, stageId, choiceIdx){
  const navEntry = { stageId: stageId, choiceIdx: choiceIdx, state: deepCopy(S) };
  const st = STAGES[stageId];
  const c = st.choices[choiceIdx];
  S.history.push({ category: st.category, score: c.score, max: c.max || 1000, step: st.step });
  if(c.story) S.story.push({ id: stageId, text: c.story });
  if(c.effect){
    if(c.effect.path) S.path = c.effect.path;
    if(c.effect.roster) S.roster = c.effect.roster.slice();
  }
  return { next: c.next, navEntry: navEntry };
}

/* adds the bridge text to the personal tale once (as renderBridge did) */
function addBridgeStory(S, id){
  if(!S.story.some(x => x.id === id)) S.story.push({ id: id, text: BRIDGES[id].text });
}

/* ============ SCORING (Appendix D) ============ */
function computeResult(S){
  const totalScore = S.history.reduce((a,h)=>a+h.score, 0);
  const totalMax = S.history.reduce((a,h)=>a+h.max, 0);
  const pct = (totalScore / totalMax) * 100;

  let tier;
  if(pct < 60) tier = 0;
  else if(pct < 80) tier = 1;
  else if(pct < 90) tier = 2;
  else tier = 3;

  const lastTwo = S.history.slice(-2);
  let catastrophe = false;
  const isWeak = (h) => h.score <= 300;
  const isMid  = (h) => h.score === 500;
  const isBest = (h) => h.score === 1000;

  if(lastTwo.some(isWeak)){ tier = 0; catastrophe = true; }
  else if(lastTwo.every(isBest)){ /* no change */ }
  else if(lastTwo.some(isMid) && lastTwo.some(isBest)){ tier = Math.max(tier - 1, 0); }
  else if(lastTwo.every(isMid)){ tier = Math.max(tier - 2, 0); }

  /* ბოლომდე მარტო გავლილ გზას ჭერი აქვს: უმაღლესი შესაძლო შედეგი
     მძიმედ მოპოვებული გამარჯვებაა და ისიც მხოლოდ მაშინ, თუ ყველა
     დანარჩენ გზაგასაყარზე საუკეთესო არჩევანი გაკეთდა. */
  const soloPath = S.path === "solo";
  /* მარტო მოსიარულისთვის „უმჯობესი არჩევანი“ ის არის, რაც მარტოობის
     პირობებში საერთოდ ხელმისაწვდომია: მე-2 ეტაპი თავად მარტო დარჩენის
     არჩევანია, მე-4-ზე კი ათასქულიანი პასუხი გუნდის შეკრებას ნიშნავს. */
  const soloIdeal = (h) => {
    if(h.step === 2) return true;
    if(h.step === 4) return h.score >= 500;
    return isBest(h);
  };
  const allBest = S.history.every(soloIdeal);
  let soloCapped = false;
  if(soloPath && !catastrophe){
    soloCapped = true;
    tier = allBest ? Math.min(tier, 1) : 0;
  }

  return { totalScore, totalMax, pct, tier, catastrophe, soloCapped, allBest };
}

function rosterNames(S){ return S.roster.map(k=>ROSTER_INFO[k].name); }
function joinGeorgian(list){
  if(list.length === 0) return "";
  if(list.length === 1) return list[0];
  return list.slice(0,-1).join(", ") + " და " + list[list.length-1];
}

function closingText(S, result){
  const { tier, catastrophe } = result;
  const isSolo = S.path === "solo";
  const names = rosterNames(S);
  const team = joinGeorgian(names);
  const groupPhrase = names.length ? `ნაცარქექია და ${team}` : "ნაცარქექია";

 if(catastrophe){
    const who = isSolo
      ? "მარტოობამ ბოლო წამს იმსხვერპლა — ერთმა დაუფიქრებელმა ნაბიჯმა ყველა წინა ძალისხმევა გადაფარა."
      : "ბოლო წამს ერთიანობა, რომლის ჩამოყალიბებასაც კვირები დასჭირდა, წამში დაინგრა — თითოეული, ვინც ბრძოლაში ერთად იყო, ბოლოს საკუთარი შიშის მიხედვით მოქმედებდა.";
    return [
      `დევი ბოლომდე არ დამარცხებულა. ${who}`,
      "დილისთვის სოფლიდან მხოლოდ ნაცარი და დამწვარი ბოძები დარჩა. ნაცარქექია ცოცხალია — მაგრამ სოფელი, რომლის დასაცავადაც იგი ბრძოლაში გავიდა, აღარ არსებობს."
    ];
  }

  const paths = {
    0: [ isSolo
        ? "დევმა გაიმარჯვა. ნაცარქექია მარტო იბრძოდა და დამარცხდა — ერთი კაცის ძალა საკმარისი არ აღმოჩნდა."
        : `დევმა გაიმარჯვა. ${groupPhrase} ბოლომდე გვერდიგვერდ იბრძოდნენ, მაგრამ მათი ერთობლივი გადაწყვეტილებები საკმარისად სქრამული არ აღმოჩნდა იმისთვის, რომ ბრძოლა მოეგოთ.`,
      "სოფელი მძიმედ დაზარალდა. გადარჩენილებს ცხოვრების თავიდან დაწყება ნანგრევებში მოუწევთ. ნაცარქექია ცოცხალი გადარჩა, მაგრამ მარცხის ტვირთის ტარება დიდხანს მოუწევს." ],
    1: [ isSolo
        ? "ბრძოლა უმძიმესი და თითქმის დამღუპველი აღმოჩნდა, თუმცა ნაცარქექიამ მარტოდმარტო იბრძოლა და საბოლოოდ დევი მაინც დაამარცხა."
        : `ბრძოლა მძიმე გამოდგა და არც მსხვერპლის გარეშე ჩაუვლია, მაგრამ ${groupPhrase} ბოლომდე გვერდიგვერდ იბრძოდნენ, სანამ დევი არ დაეცა.`,
      "სოფლის დიდი ნაწილი დაინგრა, თუმცა მოსახლეობა გადარჩა. ისინი ხვალიდანვე შეუდგებიან ნანგრევებში სახლების ხელახლა აშენებას — მთავარია, რომ სიცოცხლე გრძელდება." ],
    2: [ isSolo
        ? "ნაცარქექიამ დევს სძლია. მართალია, ცოტა უჩვეულო გზითა და, ნაწილობრივ, შემთხვევითობის წყალობით, მაგრამ გამარჯვება მაინც მან მოიპოვა."
        : `დევი დამარცხდა. ${groupPhrase} მთელი ამ ხნის განმავლობაში ბოლომდე ენდობოდა ერთმანეთს და ეს ნდობა ყველაზე მძიმე წამებშიც კი არ შერყეულა.`,
      "სოფელმა მხოლოდ მცირედი ზიანი განიცადა — ჩამოინგრა რამდენიმე ჭერი და დაიწვა ერთი-ორი ბეღელი, მაგრამ საცხოვრებელი სახლები გადარჩა. მოსახლეობა მადლიერებით შეეგებება შინ დაბრუნებულებს." ],
    3: [ isSolo
        ? "სრული გამარჯვება — მთელი სოფელი ისევ ლაპარაკობს იმაზე, თუ როგორ მოახერხა ერთმა კაცმა მარტომ, არც ერთი შეცდომის დაშვების გარეშე, დევის დამარცხება."
        : `სრული გამარჯვება. ${groupPhrase} ბოლომდე ერთმანეთს ენდობოდნენ — და ეს ნდობა ბოლო წამს გადამწყვეტი აღმოჩნდა.`,
      "სოფლის კედლებიდან ერთი ქვაც კი არ ჩამოვარდნილა. ამბავი იმის შესახებ, თუ როგორ დამარცხდა დევი ზიანის გარეშე, თაობებს გადაეცემა." ]
  };

  const arr = paths[tier].slice();

  if(result.soloCapped){
    arr.push(result.allBest
     ? "და მაინც, სოფლის უხუცესები დღემდე იმეორებენ ერთსა და იმავეს: ნაცარქექიამ ყველა გზაგასაყარზე საუკეთესო არჩევანი გააკეთა, ერთი შეცდომაც არ დაუშვია და სწორედ ამიტომ მოიპოვა გამარჯვება. მაგრამ, რაკი თავიდანვე მარტო დარჩენა არჩია, უფრო შორს ვერ წავიდოდა: ერთი კაცი ზიანის გარეშე ვერ დაასრულებდა საქმეს. შთამბეჭდავი, ბრწყინვალე გამარჯვების მოპოვება მხოლოდ გუნდს ხელეწიფებოდა."
      : "და მაინც — ყველაფერი პირველივე გზაგასაყარზე გადაწყდა: რაკი ნაცარქექიამ მარტო დარჩენა არჩია, ის, საუკეთესო შემთხვევაში, მძიმე დანაკარგებით მოიპოვებდა გამარჯვებას, ისიც მხოლოდ მაშინ, თუ ყოველ დანარჩენ გზაგასაყარზე საუკეთესო არჩევანს გააკეთებდა. ერთი შეცდომა და აღარაფერი გამოასწორებდა — და ასეც მოხდა.");
  }
  return arr;
}

function buildTale(S, result){
  const paras = [TEXT.taleOpening];
  S.story.forEach(x => paras.push(x.text));
  closingText(S, result).forEach(x => paras.push(x));
  return paras;
}

function pathLabel(S){
  switch(S.path){
    case "team-full": return "გუნდური გზა — სამივე თანამებრძოლთან ერთად";
    case "team-weak": return "გუნდური გზა — მხოლოდ მონადირესთან ერთად";
    case "team-delayed": return "დაგვიანებული შეერთება — გუნდი მოგვიანებით შეიკრიბა";
    case "solo": return "სუფთა სოლო გზა — ბოლომდე მარტო";
    default: return "";
  }
}

const scoring = { newState, deepCopy, applyChoice, addBridgeStory, computeResult,
  rosterNames, joinGeorgian, closingText, buildTale, pathLabel };

if(typeof module !== "undefined" && module.exports) module.exports = scoring;
else { root.NATS = root.NATS || {}; root.NATS.scoring = scoring; }
})(typeof window !== "undefined" ? window : globalThis);
