# BUILD PROMPT — «ნაცარქექია სქრამის მიხედვით» (Natsarkekia by the Scrum Guide) — 3D Open-World Edition

> **How to use this file:** paste everything below the line into a new Claude Code session, and attach the existing 2D game file `ნაცარქექია-და-დევი_გასწორებული.html` (it contains the six character/scene images as base64 WebP, and is the reference for every rule). Appendices A–E at the end contain every text string, the exact scoring code and the test vectors, so nothing has to be guessed.

---

## 0. YOUR ROLE AND HOW TO WORK

You are a senior web-game developer (Three.js / WebGL, game feel, UI) building a **3D open-world version** of an existing, finished 2D branching-story game. The 2D game teaches the Scrum Guide through a retold Georgian folk tale: the hero Natsarkekia must defeat the giant Devi, and at ten crossroads the player picks one of three answers (one Scrum-aligned, two weaker). Points are hidden until the final screen.

**What changes:** the player now *walks* Natsarkekia freely through a 3D world. The game gives hints and directions about where to go next; when he reaches the right place, the next question appears and the player makes the choice.
**What must not change:** the structure, the rules, the scoring, the story, every Georgian text (see §1).

**Before writing any code**, post a build plan of at most 20 lines (milestones from §17, the stack you will use, any risk you see) and **wait for my go-ahead**. I prefer to be asked before code is written. After that, work autonomously through the milestones, verify each one yourself in a real browser with screenshots (§16), and only come back to me with questions that block you.

---

## 1. NON-NEGOTIABLES (keep exactly as in the 2D game)

1. **10 decision stages, one per Scrum concept, none skipped, in Scrum Guide order:** transparency → commitment → empiricism → verification (inspection) → adaptation → lean thinking → focus → respect → openness → courage. (The category labels are exactly those in Appendix A, including `ლინ-აზროვნება` with a hyphen.)
2. **Three choices per stage**, worth **1000 / 500 / 300** (best / medium / weak). Every stage has the same ceiling (1000). Scores are **never shown** during play, only on the final screen as a per-category score table.
3. **Branching that splits and re-merges:** the only real fork is stage 2 (team-full / team-weak / solo). Team path = stages `t3…t10`, solo path = `u3…u10`. The solo path has a **merge point at `u4`**: if the player picks the best answer there, Natsarkekia admits the mistake, returns to the village, rebuilds the team and joins the team line at `t5` (path becomes `team-delayed`). Full graph in §6.
4. **Result rules** (exact code in Appendix D): thresholds 60/80/90 %, the "last two stages" adjustments, the catastrophe rule (any weak answer at stage 9 or 10), the **solo ceiling** (a solo run can never exceed "heavy-damage victory" and only if every other crossroads was best), and the solo/“team-delayed” distinction. The final screen must still spell out *why* an impressive victory was impossible when the solo ceiling applied.
5. **All Georgian texts are fixed.** Use Appendix A–C verbatim. Do **not** rewrite, “improve” or re-translate any story/choice/bridge/closing text. (They were just grammar-corrected by the author.)
6. **The personal fairy tale** at the end: the ten chosen `story` fragments + bridge texts, assembled in play order between the fixed opening line and the closing paragraphs, with a **copy button**. Unchanged.
7. **Back / change-answer mechanic** (added in the latest 2D version): on every stage the player can go back to the previous decision stage and change the answer; state is restored exactly (score history, story, path, roster, time of day). From a bridge or the final screen, back returns to the stage whose answer led there. The previously chosen answer is marked “შენი წინა არჩევანი”. See §12 for how this works in an open world.
8. **UI language is Georgian.** Fonts: Noto Serif Georgian (display) + Noto Sans Georgian (body). Title screen keeps the wording `ნაცარქექია` / `სქრამის მიხედვით` and the footer `ნაცარქექია სქრამის მიხედვით`.
9. **All three choices visible at once without scrolling** in the dialogue panel, on desktop and on phones (landscape and portrait). This was an explicit requirement of the author.

---

## 2. DELIVERABLE AND TECH CONSTRAINTS

- **One self-contained HTML file**, `natsarkekia-3d.html`, that opens by double-click and also works when uploaded to any static host. No server, no build step for the user. Target ≤ 3 MB.
- **Three.js** (r160 or newer, pinned). Preferred: install `three` with npm and bundle with esbuild/vite into a single inlined HTML so the game works **offline with zero CDN dependency**. Acceptable fallback: ES-module import + importmap from cdnjs, pinned version. Google Fonts via `<link>` is fine (fallback to system serif/sans if offline).
- Re-use the **six embedded images** from the 2D file (extract the base64 WebP strings; do not redraw characters). Specs in Appendix E.
- **No external audio/model/texture files.** Everything else is procedural: terrain, trees, houses, props, sky, water, particles, and audio (WebAudio synthesis).
- **Platforms:** modern desktop Chrome/Edge/Firefox/Safari, and phones/tablets (touch controls, §13). Provide a graceful message if WebGL is unavailable. Pixel ratio capped at 2. Provide an automatic quality governor (drops shadow resolution, grass density, post effects if FPS < 40 for 3 s) and a Low/Medium/High setting in the pause menu.
- **Target:** ≥ 55 fps on an integrated-GPU laptop at 1080p on Medium; ≥ 30 fps on a mid-range phone on Low. Draw calls < 300 (use `InstancedMesh` for trees, rocks, grass, houses’ repeated parts).
- Clean code: single `<script type="module">` section organised into clearly commented modules (data, state, world, characters, camera/controls, guidance, UI, cinematics, audio, scoring, boot). The **game data and scoring are plain data/pure functions, separate from rendering**, so they can be tested without WebGL.
- Expose a **debug/test API** `window.__NATS__` (also in production; harmless): `getState()`, `getObjective()`, `teleportToSite(stageId)`, `interact()`, `answer(index)`, `back()`, `skipCinematic()`, `setQuality(level)`, `fps()`. Automated tests rely on it.

---

## 3. ART DIRECTION

The supplied characters are **clay-figurine / stop-motion miniature** style (warm, hand-modelled, slightly glossy, painterly village photo). The 3D world must look like **a living miniature diorama made of the same material**:

- Stylised, soft, rounded low-poly forms; no photorealism. Slightly exaggerated proportions (fat tree crowns, chunky rocks, small houses with big roofs).
- Warm, saturated-but-earthy palette: ochre, terracotta, moss green, slate, deep teal water, aged wood. Georgian mountain-village feel: stone-and-wood houses with wooden balconies, flat stone roofs, dry-stone walls, wooden fences, haystacks, a stone bridge, oak/pine/beech forest, rocky Caucasus-like peaks to the west.
- Lighting carries the mood (see §10). Soft shadows, subtle ambient occlusion feel (baked into vertex colours or a cheap SSAO), gentle bloom on the sun, beacons and fire; mild vignette and film grain; optional very subtle tilt-shift blur at the screen edges to sell the “miniature” look (must be cheap and switchable).
- Everything has slight idle life: swaying trees (vertex shader), drifting clouds, chimney smoke, birds by day, fireflies and stars by night, water shimmer.
- **Characters are camera-facing billboards** (Y-axis-locked planes with the supplied transparent WebP cut-outs), drawn with alpha-test (no sorting artefacts), lit/tinted by the current scene light so they sit in the world at every time of day, with a soft blob shadow on the ground *and* a real alpha-tested shadow caster so cast shadows have the character’s silhouette. Add a faint warm rim/outline so they pop against dark scenery. Walk animation is procedural on the billboard: step-synced vertical bob, slight roll, squash-and-stretch, a small hop on stopping, horizontal flip toward lateral movement direction. Idle: gentle breathing bob (reuse the 2D `bob` feel: ~3.2 s ease-in-out, ±5 px equivalent).

---

## 4. THE WORLD

**Scale and layout.** An open play area of about **700 × 700 world units** (1 unit ≈ 1 m), ringed by impassable mountains, cliffs, deep water and fog so the edge is never visible. Coordinates: **+x = east, +z = south**, origin at the map centre, so the map spans roughly x, z ∈ [−350, 350]. The journey runs **east → west**, following the sun: the village is on the east side at dawn, Devi’s mountain (cave) is in the far north-west at deep night. The route winds (never a straight line) up through river valley, forest and foothills toward Devi’s cave. Terrain is a deterministic, seeded procedural heightmap (fixed seed, same world every time) with hand-placed constraints so the ten sites are exactly where listed in §5.

**Free roaming.** Natsarkekia can walk anywhere that is not blocked: slopes steeper than ~40° are impassable (walk-around, no falling, no death, no fall damage); deep water is blocked, shallow water/fords can be waded (slower, splash particles); trees, houses, big rocks and walls have simple circle/box colliders; camera never clips into terrain or buildings. **No combat, no health, no timers, no fail states while exploring.** If the player gets stuck, press **R** (or the button in the pause menu): fade out → back to the last safe point near the current objective.

**Optional exploration rewards without game rules** (so the world feels open, but nothing affects scoring): a waterfall and mountain lake, a ruined chapel/tower on a ridge with a view, a shepherd’s flock (animated low-poly sheep), a fishing hut by the river, wildflower meadows, a hidden spring. These have *no* text, no pickups and no effect on the score. Do not add collectibles, inventory, quests or XP.

**Roads and landmarks.** A worn dirt road (painted terrain splat + slightly sunk mesh) links the ten sites in order; the player may leave it anywhere. Signposts with carved arrows at junctions are decoration (no text needed; icons only).

### 4.1 The ten sites (positions are approximate, spacing matters)

Spacing rule: consecutive sites are **~90–140 units apart** (only site 1 → 2 is short, ~45 u, since the oak is just outside the gate), i.e. 20–40 s at walking speed; the next site’s beacon (§7) becomes visible when the previous decision is made, but the terrain should make the player *walk through the world* rather than see a straight line. Names are drafts for the objective HUD (**Georgian drafts — flag for the author’s grammar review**).

| # | Stage ids | Scrum concept | Site (KA draft / EN) | What it looks like | Who is present | Devi visible | Time-of-day preset |
|---|---|---|---|---|---|---|---|
| 1 | `s1` | გამჭვირვალობა | **სოფლის მოედანი** / Village square (east side, ~(320, 120)) | Stone well, notice board showing the village painting (the supplied `village` image as a wooden-framed mural), houses on a terraced plateau, ambient crowd of simple low-poly villagers and chimney smoke. Player spawns at the edge of the square. | Natsarkekia; ambient villagers | no | `dawn` |
| 2 | `s2` | ვალდებულება | **გზაგასაყარი ძველ მუხასთან** / Crossroads at the old oak (just outside the village gate, ~(280, 100)) | One huge oak, three worn paths fanning out. The three companions already stand here, each with their own prop: hunter with bow by the mountain path, elder woman with herbs/basket by the garden path, blacksmith’s boy with the trap cart. **All four characters visible** (as in 2D). | Natsarkekia + hunter + elder woman + blacksmith’s boy | no | `morning` |
| 3 | `t3` / `u3` | ემპირიულობა | **საგუშაგო ბორცვი** / Lookout hill (~(190, 40), elevated ~+18 u) | Rocky hill with a stone lookout and a wooden observation rail; wide view over Devi’s valley (Devi himself is not shown). | Roster from path | no | `midday1` |
| 4 | `t4` / `u4` | შემოწმება | **საცდელი მდელო** / Test meadow (~(110, 80)) | Flat meadow with a half-sprung wooden trap, torn net, scuffed grass. On the solo line (`u4`, ⭐ merge point) it feels like Natsarkekia nearly fell into his own trap. | Roster from path; **on `u4` Devi visible** | `u4` only | `midday2` |
| 5 | `t5` / `u5` | ადაპტაცია | **დევის ბილიკი** / Devi’s trail (~(30, 10), pine forest) | Giant footprints on a *different* path than the signposts say, broken trees, old plan boards crossed out. | Roster; **Devi visible** far away on a ridge | yes | `afternoon1` |
| 6 | `t6` / `u6` | ლინ-აზროვნება | **სამგზავრო ბანაკი** / Travel camp (~(−40, −70), forest clearing at a ford) | Team: a heap of villagers’ gifts (cart, huge iron trap, a ritual circle). Solo: his own backpack emptied in front of a campfire — ropes, axe, two traps, bread, grandmother’s amulet. | Roster | no | `afternoon2` |
| 7 | `t7` / `u7` | ფოკუსი | **ვაჭრის კარავი** / Merchant’s tent (~(−130, −40), by an old stone bridge) | Striped tent, crates, vials, a merchant NPC. No art was supplied for the merchant: build him as a low-poly clay-style 3D figure (or a simple billboard drawn procedurally) that matches the world. | Roster + merchant | no | `evening` |
| 8 | `t8` / `u8` | პატივისცემა | **ბანაკი მთის ძირას** / Foothill camp (~(−210, −110)) | Team: council fire, tree-stump seats, a forge cart (roles are shared here). Solo: an empty camp; **the elder woman walks in from the path** and stands near him (on `u8` *only Natsarkekia + elder woman are on stage*, as in 2D); she leaves after the choice. | Team: roster. Solo: elder woman only | no | `dusk` |
| 9 | `t9` / `u9` | ღიაობა ⚠ | **ღამის კოცონი** / Night campfire (~(−280, −190), rock terrace under stars) | Team: the hunter sits slightly apart from the fire (confession scene). Solo: Natsarkekia alone, tired, with a faint lantern-lit window far below. | Roster | no | `night` |
| 10 | `t10` / `u10` | გამბედაობა ⚠ | **დევის მღვიმე** / Devi’s cave (~(−330, −290), black cliffs) | Cave mouth, ridge path, a “signal stone”. Dramatic red-tinted fog. | Roster; **Devi visible** | yes | `deepnight` |

The `⚠` marks after “ღიაობა” and “გამბედაობა” are part of the original tag text — keep them. Stages 9 and 10 are the two “last-two” stages that drive catastrophe/tier adjustments (§11).

**Enforced order, free movement.** Only the *current* site is active (see §7). The player may visit any other place at will; walking up to a later site shows a gentle “not yet” message but nothing else happens. This guarantees the Scrum-Guide order while keeping the world open.

---

## 5. CHARACTERS

All art is provided (Appendix E). Human characters are drawn at the same world height (~1.8 u, keep each sprite’s aspect ratio); **Devi is much larger in 3D (~4× human height)** so he reads as a giant (this intentionally replaces the 2D “×1.32”).

- **Natsarkekia** — the player avatar; always present. Third-person, camera-relative movement. Walk 4.5 u/s, run (Shift) 7.5 u/s, smooth acceleration.
- **Hunter (მონადირე)** — “mountain-trail expert”. **Elder woman (დარბაისელი ქალი)** — “plants/herbs expert”. **Blacksmith’s boy (მჭედლის ბიჭი)** — “trap master”. The roster chips (top right) use their portraits, names and these role tags exactly as in the 2D game.
- **Roster rules (unchanged):** `team-full` → all three follow; `team-weak` → only the hunter; `solo` → nobody; `team-delayed` → all three (after the merge). On `u8` the elder woman appears *temporarily* (she is not added to the roster).
- **Companion behaviour:** follow Natsarkekia with a loose formation (2–3.5 u behind/beside, spring-damped, naturally staggered), match his speed, wait when he stops, never block him, teleport-catch-up if > 40 u away. At a site during a dialogue they take scripted positions (listed in §4.1). When a companion joins (bridge cinematic §9) they walk over from where they stood; the ones left behind stay at the oak, waving then idling, and later vanish out of the world quietly. Hunter/elder/boy have no new dialogue lines (do not invent Georgian text for them).
- **Devi (დევი)** — appears only where the 2D game showed him: **`t5`, `t10`, `u4`, `u5`, `u10`, the final battle bridge, and the final scene if tier 0 or catastrophe.** In free roaming he is a distant, slowly bobbing silhouette on a ridge/at the cave with a pulsing red glow and a low rumble; fade in when the stage becomes active, fade out when it ends. **He never chases, attacks or blocks the player.** In the battle bridge he rises to full size (five heads “standing up out of the darkness”) with camera shake and red light.
- **Ambient villagers / merchant / sheep** are non-interactive decoration made procedurally in the same clay style.

---

## 6. FLOW AND STATE MACHINE

Screens/states: `TITLE → EXPLORE ⇄ DIALOGUE (stage) → [CINEMATIC (bridge)] → EXPLORE … → FINAL`. Plus `PAUSE` overlay from anywhere except cinematics.

**Graph (identical to 2D):**

```
s1 → s2 ─┬─ choice "all three" (1000) → bridge-team-full → t3 → t4 → t5 → t6 → t7 → t8 → t9 → t10 ─┐
         ├─ choice "hunter only" (500) → bridge-team-weak → t3 (same team line)                     │
         └─ choice "nobody" (300)      → bridge-solo → u3 → u4 ─┬─ best (1000) → bridge-delayed → t5 …┤
                                                                 └─ other (500/300) → u5 → u6 → … → u10 ┤
                                                                                                        ↓
                                                      bridge-battle → FINAL (result screen + "your fairy tale")
```

Each stage’s `choices[i].next`, `.effect` (path/roster) and `.score` are in Appendix A. After a bridge: `bridge-team-full`/`bridge-team-weak` → `t3`; `bridge-solo` → `u3`; `bridge-delayed` → `t5`; `bridge-battle` → FINAL.

**Game state `S`** (keep this shape): `{ history:[{category, score, max:1000, step}], roster:[...], path: null|"team-full"|"team-weak"|"solo"|"team-delayed", story:[{id, text}] }`.

**Loop per stage:** (1) previous decision confirmed → time of day starts transitioning to the new stage’s preset, objective updates, beacon for the new site appears; (2) player walks there; (3) at the trigger radius (~6 u) the prompt “E / tap” appears; (4) interaction opens the dialogue panel (§8) and locks movement, camera eases to a framing shot of the scene; (5) player picks; `choose()` runs exactly as in 2D (push history, push story, apply effect, snapshot for back); (6) either the next stage’s objective is set, or a bridge cinematic plays.

---

## 7. GUIDANCE SYSTEM (hints and directions) — the heart of the open-world design

The player must **always be able to tell where to go next**, without a quest log, and **hints must never reveal scores or which answer is best** — they only say *where*.

1. **Objective line (HUD, top-left under the progress trail):** `მიზანი:` + site name + distance (`მიდი: საგუშაგო ბორცვი · 84 მ`). Updates the moment a decision is made.
2. **Beacon:** a tall soft golden light pillar (additive, bloom-friendly) over the active site, visible from very far (above the horizon/fog); pulses slowly. Within ~40 u a ground ring appears; within the trigger radius the ring brightens and the interaction prompt shows. Inactive future sites have no beacon.
3. **Compass strip** (top centre) with a small icon for the active site and, if off-screen, an arrow at the screen edge.
4. **Mini-map** (bottom-left, circular, rotating with camera, fog-of-war that reveals as you explore): the road as a faint dotted line, the active site as a star, completed sites as small ticks, companions as dots, Devi’s mountain as a red mark (once seen). Tap/M opens the larger map.
5. **Breadcrumb trail:** press **H** (or the hint button) → a glowing line on the terrain from the player to the beacon for ~8 s (follows the road/terrain, not through cliffs).
6. **Escalating idle hints** (only if hints are ON): no progress toward the objective for 25 s → compass + ring pulse; 60 s → short line at the bottom, `მიჰყევი შუქის სვეტს.`, and if the hunter is in the roster he faces/points toward the beacon (billboard flips + small arrow icon).
7. **World cues:** the light of the time-of-day, smoke columns, birds and the road itself lean toward the next site; signposts at junctions point along the road.
8. **“Not yet” message** when entering a later site’s trigger area: `ახლა სხვა ადგილზე უნდა წახვიდე` (draft) — never a blocker, just info.
9. **Hints toggle** in the pause menu (default ON). With hints OFF only the beacon and objective line remain (they are part of the core UX).
10. **Pacing:** the first objective is shown with a short, skippable on-screen tutorial (movement, camera, interact, hint key), not repeated.

---

## 8. DIALOGUE / CHOICE PANEL (reuse the 2D look)

- Parchment-style panel docked at the bottom of the screen (colours from the 2D CSS: parchment `#ece0c4`/`#e2d3ab`, edge `#c9b784`, ink `#2c2013`/`#5a4c36`, gold `#b3852c`/`#dcae4f`, ember `#9c3d24`/`#6e2c19`, HUD bg `#161119`), max ~45 % of screen height, the 3D scene stays visible above it.
- Contents in this order: **kicker** (category + small tag pill, back button at the right), **setup** paragraph, **question** (serif italic, gold left rule), **three choice buttons**. All visible without scrolling at 1280×720, 390×844 (portrait) and 844×390 (landscape): use `clamp()` font sizes and compact paddings; on short landscape screens place the setup text in a left column and the choices in a right column.
- Choose by click/tap, or keys **1 / 2 / 3**. Hover/focus states as in 2D. No score, no colour hint, no ordering hint (keep the original option order from Appendix A).
- After choosing: panel fades, a very short “story fragment” toast is **not** needed; the fragment is silently added to the personal tale.
- The panel shows `← წინა ეტაპი` when at least one answer exists (not on stage 1), and the marker `შენი წინა არჩევანი` on the earlier pick after going back.
- HUD during exploration: top-left progress trail `გზა · ეტაპი N / 10` with ten dots (done = gold, current = ember), objective line below; top-right roster chips; bottom-left mini-map; interaction prompt near the bottom centre.

---

## 9. BRIDGE CINEMATICS (the five bridges become short in-engine scenes)

Each bridge = fade/camera move → letterbox bars → parchment card with `heading` + `text` (Appendix B) and a single button (`გაგრძელება`, or `შედეგის ნახვა` for the last one) → after it, control returns to the player with the next objective. The text is also appended to the personal tale (once). Each bridge card has `← პასუხის შეცვლა`.

| Bridge | Scene |
|---|---|
| `bridge-team-full` | At the oak: hunter shoulders his bow, elder woman ties her herb bundle, blacksmith’s boy gathers his tools; all three step to Natsarkekia; camera slow orbit; then they set off together through the gate. Morning light. |
| `bridge-team-weak` | Only the hunter steps forward; the other two stay at the oak (wave, idle). Camera pulls back to show the two leaving. |
| `bridge-solo` | Natsarkekia alone at the village gate with a backpack; camera slowly pulls back and up; empty road ahead. Dawn light. |
| `bridge-delayed` | Fade to the village gate at dusk: the three companions pack bags and gather around him; text; fade; then the world resumes at `t5` (Devi’s trail) with the full team. |
| `bridge-battle` (Devi visible) | At the cave: moon slips behind clouds; Devi’s five heads rise out of the darkness (scale/rise, shake, red light, rumble); text card; button leads to FINAL. |

---

## 10. TIME OF DAY (progress-driven, not real-time)

Time changes **only when the player confirms a decision** (and in bridges/final): lighting, sky, fog, sun/moon, stars and tint blend to the next preset over ~5 s. Walking between sites never changes the hour. Sequence by stage `step`: 1 dawn → 2 morning → 3 midday1 → 4 midday2 → 5 afternoon1 → 6 afternoon2 → 7 evening → 8 dusk → 9 night → 10 deepnight. Bridge presets: `team-full: morning`, `team-weak: morning`, `solo: dawn`, `delayed: dusk`, `battle: deepnight`. Final presets: catastrophe → `catastrophe`; tier 0 → `defeatashen`; tier 1 → `victorydamaged`; tier 2–3 → `victorydawn`.

Preset colour/position data is in Appendix C. Mapping to 3D: the three `sky` colours are the gradient stops of the sky dome, **first = zenith (top), second = mid-sky, third = horizon (bottom)**; `sun.left` (0–100 %) is the position along the east→west arc (azimuth 90° → 270°); sun height: `elevation° = clamp((70 − sun.top) × 1.3, −5, 85)`; `sun.type` “moon” swaps the disc/lighting to cool moonlight; `glow` drives bloom/halo; `phase` (`day`/`dusk`/`night`) controls stars (0/0.35/1) and cloud opacity (0.5/0.22/0.08); `tint` is a multiply/colour-grade overlay over the whole scene (and scales fog colour). Fog distance shrinks at night and in catastrophe.

---

## 11. SCORING AND RESULTS (unchanged — see Appendix D for the exact code)

Short version: percentage = total / (10×1000). Base tier: <60 → 0 (defeat), 60–79 → 1 (victory, heavy damage), 80–89 → 2 (victory, minor damage), ≥90 → 3 (full victory). “Last two” (stages 9 & 10): any weak (≤300) → **catastrophe** (tier 0); both best → no change; one medium + one best → −1; both medium → −2. **Solo ceiling:** if `path === "solo"` and no catastrophe, tier = allIdeal ? min(tier, 1) : 0, where “ideal” = stage 2 always, stage 4 if score ≥ 500, other stages must be 1000. `team-delayed` is not capped. The `closingText` paragraphs, solo/team variants, `{ჯგუფი}` group phrase and the extra solo-ceiling paragraph are in Appendix C.

**Final screen (same content as 2D, laid over the 3D scene):** seal with % and `score / max`, title (`სრული კატასტროფა` or the tier name), path label (`pathLabel()` strings), score table “გზის ანგარიში — 10 პრინციპი” with bar per category and total, closing paragraphs, the **“შენი ზღაპარი”** card with copy button (`ზღაპრის დაკოპირება` → `დაკოპირდა ✓`), buttons `← ბოლო პასუხის შეცვლა` and `თავიდან დაწყება`. Panel scrolls inside an overlay (max 90 vh).
**Scene behind the final panel:** a slow camera orbit around Natsarkekia + roster (+ Devi if tier 0 or catastrophe) lit by the final preset. **Should-have:** also show the village’s fate from a distant lookout shot via damage states of the houses (tier 3 intact; tier 2 a few roofs missing + a thin smoke trail; tier 1 heavy damage; tier 0 ruins; catastrophe burnt out with ember particles). **Minimum:** sky/tint/Devi presence + smoke particles.

---

## 12. BACK / CHANGE-ANSWER MECHANIC IN THE OPEN WORLD

Same data model as the 2D version: before every `choose()`, push `{stageId, choiceIdx, state: deepCopy(S)}` onto `NAV`. `goBack()` pops the top entry, restores `S`, restores the time-of-day preset of that stage, reconstructs the roster (companions leave/appear with a fade), **teleports Natsarkekia (fade out/in) to that stage’s site**, and re-opens that stage’s dialogue with the earlier pick marked “შენი წინა არჩევანი”.
Where the button lives: in the dialogue panel (`← წინა ეტაპი`, hidden on stage 1), on every bridge card (`← პასუხის შეცვლა`), on the final panel (`← ბოლო პასუხის შეცვლა`), and in the pause menu (“წინა ეტაპზე დაბრუნება”). Going back from `t5` after `bridge-delayed` returns to `u4` with path `solo` and an empty roster. `startGame()` clears `NAV`.

---

## 13. CONTROLS

- **Desktop:** `W A S D` / arrows move (camera-relative), mouse = camera (click the canvas to capture the pointer; Esc releases and opens pause), `Shift` run, `E` or `Enter` interact, `1 2 3` choose, `H` breadcrumb hint, `M` map, `R` unstick, `Esc` pause. Scroll wheel zooms the third-person camera (4–12 u), camera collides with terrain/walls.
- **Touch:** left virtual joystick (camera-relative), drag on the right half to rotate camera, large `საუბარი` interact button that appears when in range, small hint and map buttons, pause button. Joystick must not trigger page scrolling/zoom. Safe-area insets respected; works in portrait and landscape.
- Optional gamepad support (left stick, right stick, A = interact).
- Accessibility: all key actions have on-screen buttons; reduced-motion setting disables camera shake, bob and heavy bloom; HUD text ≥ 14 px; focus-visible outlines on all buttons.

---

## 14. AUDIO (procedural, mute-able)

WebAudio only, starts after the first user gesture, master mute in HUD/pause. Layers: day ambience (wind + birds), night ambience (crickets + low wind), fire crackle near campfires/forge, footsteps (grass/stone/wood variants tied to terrain splat and walk bob), UI click, soft chime when the beacon activates, ambient low drone that grows near Devi, thunder-like rumble in `bridge-battle`, a gentle pad that changes key with the time-of-day preset. No speech.

---

## 15. UI STRINGS NOT PRESENT IN THE 2D GAME (Georgian drafts — please flag for the author’s grammar review; keep this list short, don’t add more)

| Key | Draft (KA) | Meaning |
|---|---|---|
| objective label | `მიზანი:` | Objective |
| go-to | `მიდი: {ადგილი} · {n} მ` | Go to: {place} · {n} m |
| interact (desktop / touch) | `დააჭირე E-ს` / `საუბარი` | Press E / Talk |
| not-yet | `ახლა სხვა ადგილზე უნდა წახვიდე` | You need to go somewhere else now |
| idle hint | `მიჰყევი შუქის სვეტს.` | Follow the pillar of light. |
| controls hint (title/tutorial) | `მართვა: W A S D — სიარული · მაუსი — კამერა · Shift — სირბილი · E — ურთიერთქმედება` | Controls |
| pause menu | `პაუზა` · `გაგრძელება` · `წინა ეტაპზე დაბრუნება` · `თავიდან დაწყება` · `მინიშნებები: ჩართ. / გამორთ.` · `ხმა: ჩართ. / გამორთ.` · `გრაფიკა: დაბალი / საშუალო / მაღალი` | Pause · Resume · Back to previous stage · Restart · Hints on/off · Sound on/off · Graphics low/med/high |
| loading | `იტვირთება…` | Loading… |
| WebGL error | `ამ მოწყობილობაზე 3D გრაფიკა ვერ ჩაირთო.` | 3D graphics could not start on this device. |
| site names | see §4.1 | |

---

## 16. QUALITY BAR AND TESTS (you must run these yourself in a real browser, e.g. Playwright + Chromium with SwiftShader, and show screenshots)

1. **Text integrity:** all strings in `STAGES`, `BRIDGES`, closing texts equal Appendix A–C character for character (automated diff).
2. **Scoring vectors** (Appendix D) produce exactly the listed results.
3. **Eight storylines reach FINAL** through the debug API, including `team-full`, `team-weak`, `solo`, `team-delayed`; and the back chain from FINAL down to stage 1 restores state at every step (history length, story, roster, path, time-of-day preset).
4. **Beacon/objective correctness:** at every stage the objective site equals the table in §4.1 for that path; after `teleportToSite`, the interact prompt appears and the dialogue opens; interacting at a non-active site does nothing.
5. **Layout:** dialogue panel with all three choices visible with no scrolling at 1280×720, 1920×1080, 390×844, 844×390, 768×1024. Longest choice texts (e.g. `t10` best, `t4` best) are the test cases.
6. **Visual checks:** one screenshot at each of the ten sites (with the correct time of day), each bridge, and each of the 5 end states (catastrophe, tier 0–3). Inspect them yourself; fix washed-out, flickering, floating, clipping or unreadable results.
7. **Stability:** zero console errors/warnings during a full run; no memory growth > 20 % over three consecutive restarts; no NaN positions; companions never stuck inside geometry; player cannot leave the map.
8. **Performance:** report measured FPS on Medium and Low (SwiftShader numbers are only a lower bound — say so).

---

## 17. BUILD ORDER (post the plan first, wait for go-ahead, then do the milestones; show screenshots at each)

1. **M1 Greybox:** renderer, seeded terrain, player controller + camera, billboard Natsarkekia, ten site markers at the §4.1 positions, state/data layer from the appendices, dialogue panel with all texts, scoring/final screen (no art polish). Playable end to end.
2. **M2 Guidance:** objective HUD, beacon, compass, mini-map, breadcrumb, idle hints, “not yet”, pause menu, back mechanic, tutorial.
3. **M3 World dressing:** road, village, forest, rivers, fords, rocks, sites’ props and landmarks, ambient life, sky dome with the presets, stars/clouds/fog, time-of-day transitions.
4. **M4 Characters:** all billboards, shadows, companions’ follow AI, joins/leaves, elder woman’s arrival at `u8`, Devi’s placements and glow, merchant and villagers.
5. **M5 Cinematics + final:** five bridge scenes, letterbox, final tableau with damage states, personal-tale card and copy button.
6. **M6 Polish and QA:** audio, post effects, quality governor, mobile controls, accessibility, all tests of §16, single-file bundle ≤ 3 MB.

**Final report (≤ 12 lines):** file path and size, what is complete, what was left out and why, measured FPS, the list of Georgian draft strings from §15 that I should review.

---

*Everything below is data. Treat it as the source of truth.*




## APPENDIX A — STAGES (exact data; order of choices must be kept)

Field meaning: `step` = stage number (1–10) shown in the HUD; `category` and `tag` form the kicker; `devi:true` = Devi is visible in that scene; `score` is hidden from the player; `next` = next stage/bridge; `effect` = changes to path/roster applied when chosen; `story` = fragment added to the personal fairy tale.


### `s1` — step 1 — გამჭვირვალობა · საერთო ყველასთვის

- **setup:** ნაცარქექიამ გადაწყვიტა, დევს დაუპირისპირდეს. სანამ პირველ ნაბიჯს გადადგამდა, უმთავრესი კითხვა გაჩნდა: ვის რა უნდა სცოდნოდა მისი ჩანაფიქრის შესახებ?
- **question:** სოფელს ჯერ არაფერი გაუგია შენი გეგმის თაობაზე. რას იზამ?
- **choice 1** — score **500** → `s2`
  - label: გაანდობ მხოლოდ საკუთარ ოჯახს და ერთ-ორ ახლო მეგობარს, დანარჩენებს კი მოგვიანებით შეატყობინებ.
  - story: ნაცარქექიამ თავისი ჩანაფიქრი მხოლოდ ოჯახსა და ორ ახლო მეგობარს გაანდო, დანარჩენებს კი მოგვიანებით შეატყობინა.
- **choice 2** — score **300** → `s2`
  - label: არავის არაფერს ეტყვი — გეგმას ბოლომდე სრულ საიდუმლოდ შეინახავ.
  - story: ნაცარქექიამ არავის არაფერი უთხრა — გეგმა ბოლომდე სრულ საიდუმლოდ შეინახა.
- **choice 3** — score **1000** → `s2`
  - label: მოაწყობ სოფლის საერთო შეკრებას და ღიად განაცხადებ გეგმის შესახებ.
  - story: ნაცარქექიამ სოფლის საერთო შეკრება მოაწყო და თავისი გეგმის შესახებ ღიად განაცხადა.

### `s2` — step 2 — ვალდებულება · აქ გზა განიტოტება

- **setup:** დროა, ვალდებულებები გადანაწილდეს. სოფელში სამი გამორჩეული ადამიანი ცხოვრობს, რომელთაგან თითოეული მზადაა, საკუთარი წილი ვალდებულება იკისროს: მონადირე (მთის ბილიკების მცოდნე), დარბაისელი ქალი (მცენარეებისა და წამლების მცოდნე) და მჭედლის ბიჭი (ხაფანგების ოსტატი).
- **question:** ვის გაუზიარებ ამ ვალდებულებას?
- **choice 1** — score **1000** → `bridge-team-full` · effect: `{"path": "team-full", "roster": ["hunter", "elderwoman", "blacksmith"]}`
  - label: სამივეს — თითოეულს ისეთი უნარი აქვს, რომელიც შენ გაკლია.
  - story: საერთო ვალდებულება სამივეს გაუზიარა — მონადირეს, დარბაისელ ქალსა და მჭედლის ბიჭს, რადგან თითოეულს ისეთი უნარი ჰქონდა, რომელიც მას აკლდა.
- **choice 2** — score **300** → `bridge-solo` · effect: `{"path": "solo", "roster": []}`
  - label: არავის — გადაწყვეტ, რომ ყველაფერს მარტომ გაართვა თავი.
  - story: გადაწყვიტა, რომ ყველაფრისთვის მარტოს გაერთმია თავი.
- **choice 3** — score **500** → `bridge-team-weak` · effect: `{"path": "team-weak", "roster": ["hunter"]}`
  - label: მხოლოდ მონადირეს — დანარჩენების მოძებნა სხვა დროისთვის გადადე.
  - story: სიტყვა მხოლოდ მონადირესთან შეკრა — დანარჩენების მოძებნა კი სხვა დროისთვის გადადო.

### `t3` — step 3 — ემპირიულობა · ცოდნა გამოცდილებიდან

- **setup:** გუნდი მსჯელობს, თუ საიდან დაიწყოს საქმე. დევზე ბევრი რამ ითქმის სოფელში, მაგრამ ნანახი არავის ჰყავს.
- **question:** რაზე დავაფუძნებთ ჩვენს ცოდნას?
- **choice 1** — score **1000** → `t4`
  - label: პირველ პერიოდს მთლიანად დაკვირვებას დავუთმობთ — საკუთარი თვალით შევისწავლით დევის ჩვევებს და, ვიდრე არ ვნახავთ, არაფერს შევცვლით.
  - story: პირველი პერიოდი მთლიანად დაკვირვებას დაუთმეს: საკუთარი თვალით შეისწავლეს დევის ჩვევები და, ვიდრე არ იხილეს, არაფერი შეუცვლიათ.
- **choice 2** — score **300** → `t4`
  - label: დაკვირვებაზე დროს აღარ დავახარჯავთ — რაც უხუცესებს უთქვამთ, იმას მივიჩნევთ ჭეშმარიტებად და მოქმედებას დაუყოვნებლივ შევუდგებით.
  - story: დაკვირვებას დრო აღარ დაახარჯეს — რაც უხუცესებს ეთქვათ, ის მიიღეს ჭეშმარიტებად და მოქმედებას დაუყოვნებლივ შეუდგნენ.
- **choice 3** — score **500** → `t4`
  - label: ნაწილობრივ დავაკვირდებით, ნაწილობრივ კი სოფლის ძველ ნაამბობს მივენდობით.
  - story: ნაწილობრივ დააკვირდნენ, ნაწილობრივ კი სოფლის ძველ ნაამბობს მიენდნენ.

### `t4` — step 4 — შემოწმება · პირველი ცდის შემდეგ

- **setup:** პირველი მცირე ცდის, ანუ ხაფანგის დაყენების შემდეგ, რომელიც ბოლომდე წარმატებული არ აღმოჩნდა:
- **question:** რას გავაკეთებთ?
- **choice 1** — score **500** → `t5`
  - label: შედეგს მხოლოდ გუნდის შიგნით განვიხილავთ, სოფელს კი არაფერს ვეტყვით.
  - story: ცდის შედეგი მხოლოდ გუნდის შიგნით განიხილეს, სოფელს კი არაფერი უთხრეს.
- **choice 2** — score **300** → `t5`
  - label: არაფერს განვიხილავთ — უბრალოდ, ზუსტად იმავე ცდას გავიმეორებთ.
  - story: არაფერი განუხილავთ — უბრალოდ, ზუსტად იგივე ცდა გაიმეორეს.
- **choice 3** — score **1000** → `t5`
  - label: დავბრუნდებით სოფელში, ღიად მოვყვებით, რა გამოგვივიდა და რა — არა, ვიკითხავთ რჩევებს და ამის მიხედვით დავაზუსტებთ გეგმას.
  - story: ცდის შემდეგ სოფელში დაბრუნდნენ, ღიად მოჰყვნენ, რა გამოუვიდათ და რა — არა, რჩევებიც იკითხეს და გეგმა დააზუსტეს.

### `t5` — step 5 — ადაპტაცია · ახალი ინფორმაცია  — **Devi visible**

- **setup:** გაირკვა, რომ დევი ღამით სულ სხვა ბილიკს იყენებს — თავდაპირველი გეგმა აღარ გამოგვადგება.
- **question:** როგორ მოვიქცევით ახალი ინფორმაციის მიღების შემდეგ?
- **choice 1** — score **500** → `t6`
  - label: ძველ გეგმას მცირედით შევასწორებთ, ახალ ინფორმაციას კი არსებით მნიშვნელობას არ მივანიჭებთ.
  - story: ახალი ამბის მიუხედავად, ძველ გეგმაში მხოლოდ მცირედი შესწორება შეიტანეს.
- **choice 2** — score **1000** → `t6`
  - label: მთლიანად გადავხედავთ გეგმას ახალი ინფორმაციის საფუძველზე, თუნდაც ეს ორი კვირის შრომის დაკარგვას ნიშნავდეს.
  - story: როცა გაირკვა, რომ დევი ღამით სულ სხვა ბილიკს იყენებდა, გეგმას მთლიანად გადახედეს — თუნდაც ორი კვირის შრომა დაკარგულიყო.
- **choice 3** — score **300** → `t6`
  - label: გავაგრძელებთ მუშაობას ძველი გეგმის მიხედვით, იმ იმედით, რომ დევი მაინც დაბრუნდება ძველ ბილიკზე.
  - story: მუშაობა ძველი გეგმით განაგრძეს იმ იმედით, რომ დევი ძველ ბილიკს დაუბრუნდებოდა.

### `t6` — step 6 — ლინ-აზროვნება · ზედმეტის მოკვეთა

- **setup:** სოფელმა გეგმის ამბავი შეიტყო და დახმარება მოიწადინა: ერთმა ურემი გამოაგორა, მეორემ რკინის უზარმაზარი ხაფანგი მოათრია, მესამემ კი ძველი რიტუალი გაიხსენა, რომლის შესრულებასაც სამი დღე და სამი ღამე სჭირდება.
- **question:** რას წავიღებთ თან და რას დავტოვებთ?
- **choice 1** — score **300** → `t7`
  - label: ყველაფერს წავიღებთ და რიტუალსაც შევასრულებთ — რაც მეტია, მით უკეთესიო.
  - story: ყველაფერი წაიღეს და რიტუალიც შეასრულეს — რაც მეტია, მით უკეთესიო.
- **choice 2** — score **1000** → `t7`
  - label: მხოლოდ იმას წავიღებთ, რაც უშუალოდ ემსახურება მიზანს — დანარჩენს კი სოფელს დავუბრუნებთ.
  - story: თან მხოლოდ ის წაიღეს, რაც უშუალოდ ემსახურებოდა მიზანს — დანარჩენი კი სოფელს დაუბრუნეს.
- **choice 3** — score **500** → `t7`
  - label: ძირითადს წავიღებთ და თან რამდენიმე „ყოველი შემთხვევისთვის საჭირო“ ნივთსაც გავიყოლებთ.
  - story: ძირითადი წაიღეს და თან რამდენიმე „ყოველი შემთხვევისთვის საჭირო“ ნივთიც გაიყოლეს.

### `t7` — step 7 — ფოკუსი · ცდუნება

- **setup:** სოფლის ვაჭარი პრობლემის მოგვარების სრულიად სხვა, „სწრაფ“ გზას გვთავაზობს — უცხო ჯადოქრისგან საწამლავის ყიდვას, რაც ჩვენი გეგმისგან რადიკალურად განსხვავდება.
- **question:** მივიღებთ თუ არა ამ შემოთავაზებას?
- **choice 1** — score **500** → `t8`
  - label: პარალელურად ორივეს ვცდით — ძალების ნახევარს ახალი შემოთავაზებისკენ მივმართავთ.
  - story: ორივე გზა პარალელურად სცადა — ძალების ნახევარი ვაჭრის შემოთავაზებაზე მიმართა.
- **choice 2** — score **1000** → `t8`
  - label: თავაზიანად ვეტყვით უარს და გუნდთან ერთად შემუშავებულ გეგმას ბოლომდე გავყვებით.
  - story: ვაჭრის შემოთავაზებაზე — უცხო ჯადოქრის საწამლავზე — თავაზიანად თქვა უარი და გუნდთან ერთად შემუშავებული გეგმა ბოლომდე გააგრძელა.
- **choice 3** — score **300** → `t8`
  - label: მთლიანად მივატოვებთ გუნდურ გეგმას და ვაჭრის შემოთავაზებულ გზას დავადგებით.
  - story: გუნდური გეგმა მთლიანად მიატოვა და ვაჭრის შემოთავაზებულ გზას დაადგა.

### `t8` — step 8 — პატივისცემა · როლების განაწილება

- **setup:** დადგა როლების საბოლოო განაწილების დრო.
- **question:** როგორ გავანაწილებ როლებს?
- **choice 1** — score **500** → `t9`
  - label: ძირითად როლებს მე და მონადირეს დავიტოვებთ, დანარჩენებს კი უმნიშვნელო დავალებებს მივცემთ.
  - story: ძირითადი როლები თავისთვის და მონადირისთვის დაიტოვა, დანარჩენებს კი უმნიშვნელო დავალებები მისცა.
- **choice 2** — score **300** → `t9`
  - label: ყველაზე „საპატიო“ ნაწილს მხოლოდ ჩემთვის დავიტოვებ, დანარჩენებს კი, უბრალოდ, გვერდში დგომას ვთხოვ.
  - story: ყველაზე საპატიო ნაწილი მხოლოდ თავად დაიტოვა, დანარჩენებს კი გვერდში დგომა სთხოვა.
- **choice 3** — score **1000** → `t9`
  - label: თითოეულს იმ როლს ჩავაბარებ, რომელშიც ყველაზე ძლიერია — ჩემთვის კი მხოლოდ იმას დავიტოვებ, რაც უშუალოდ მე შემეფერება.
  - story: როლები ისე გაანაწილა, რომ თითოეულს ის საქმე ერგო, რომელშიც ყველაზე ძლიერი იყო; თავად კი მხოლოდ ის დაიტოვა, რაც უშუალოდ მას შეეფერებოდა.

### `t9` — step 9 — ღიაობა · აღიარება ⚠

- **setup:** ბრძოლის წინა ღამეს მონადირე აღიარებს, რომ შიშის გამო თავისი დავალება ბოლომდე ვერ შეასრულა.
- **question:** როგორი იქნება ჩემი რეაქცია?
- **choice 1** — score **1000** → `t10`
  - label: მადლობას გადავუხდი გულწრფელობისთვის და ერთად გადავწყვეტთ, თუ როგორ გამოვასწოროთ ხარვეზი დარჩენილ დროში.
  - story: როცა მონადირემ ბრძოლის წინა ღამეს აღიარა, რომ შიშის გამო დავალება ვერ შეასრულა, ნაცარქექიამ გულწრფელობისთვის მადლობა გადაუხადა და ერთად გადაწყვიტეს, თუ როგორ გამოესწორებინათ ხარვეზი დარჩენილ დროში.
- **choice 2** — score **500** → `t10`
  - label: გავღიზიანდები, მაგრამ საბოლოოდ დავთმობ და გეგმაში მცირე ცვლილებებს შევიტან.
  - story: მონადირის აღიარებაზე გაღიზიანდა, მაგრამ საბოლოოდ დათმო და გეგმაში მცირე ცვლილება შეიტანა.
- **choice 3** — score **300** → `t10`
  - label: ყველას წინაშე შევარცხვენ მონადირეს და დავალებას მის ნაცვლად თავად შევასრულებ.
  - story: მონადირე ყველას წინაშე შეარცხვინა და დავალება მის ნაცვლად თავად შეასრულა.

### `t10` — step 10 — გამბედაობა · გადამწყვეტი წამი ⚠  — **Devi visible**

- **setup:** ბრძოლის გადამწყვეტ წამს მოულოდნელი, გეგმისგან განსხვავებული შესაძლებლობა გამოჩნდა — შანსი მეძლევა, რომ დევს მარტომ შევუტიო, გუნდის სიგნალის მოლოდინის გარეშე.
- **question:** რას მოვიმოქმედებ ბოლო წუთს?
- **choice 1** — score **1000** → `bridge-battle`
  - label: გავბედავ და ერთგულად მივყვები შეთანხმებულ გეგმას: დაველოდები გუნდის სიგნალს და საკუთარ როლს ზუსტად ისე შევასრულებ, როგორც წინასწარ იყო დაგეგმილი.
  - story: გადამწყვეტ წამს ცდუნებას არ აჰყვა: გაბედა და ერთგულად მიჰყვა შეთანხმებულ გეგმას — დაელოდა გუნდის სიგნალს და საკუთარი როლი ზუსტად ისე შეასრულა, როგორც წინასწარ იყო დაგეგმილი.
- **choice 2** — score **500** → `bridge-battle`
  - label: ნაწილობრივ გადავუხვევ გეგმას და შევეცდები, ცოტა უფრო ადრე ვიმოქმედო.
  - story: გადამწყვეტ წამს გეგმას ნაწილობრივ გადაუხვია და ცოტა უფრო ადრე იმოქმედა.
- **choice 3** — score **300** → `bridge-battle`
  - label: მთლიანად უგულებელვყოფ გეგმას და დევს მარტო შევუტევ.
  - story: გადამწყვეტ წამს გეგმა მთლიანად უგულებელყო და დევს მარტო შეუტია.

### `u3` — step 3 — ემპირიულობა · ცოდნა გამოცდილებიდან

- **setup:** ნაცარქექია მარტოა. მან თავად უნდა გადაწყვიტოს, რას დაეყრდნოს — ნანახს თუ ნაამბობს.
- **question:** რაზე დააფუძნებს იგი თავის ცოდნას?
- **choice 1** — score **500** → `u4`
  - label: ცოტას დააკვირდება, ცოტასაც სოფლის ძველ ნაამბობს მიენდობა.
  - story: ცოტა დააკვირდა, ცოტაც სოფლის ძველ ნაამბობს მიენდო.
- **choice 2** — score **1000** → `u4`
  - label: საწყის ეტაპს მთლიანად დაკვირვებას დაუთმობს და მხოლოდ იმას ენდობა, რასაც საკუთარი თვალით ნახავს.
  - story: საწყისი ეტაპი მთლიანად დაკვირვებას დაუთმო და მხოლოდ იმას ენდო, რაც საკუთარი თვალით იხილა.
- **choice 3** — score **300** → `u4`
  - label: დაკვირვებაზე დროს აღარ დახარჯავს — რაც გაუგონია, იმას მიიღებს ჭეშმარიტებად.
  - story: დაკვირვებას დრო აღარ დაახარჯა — რაც გაეგონა, ის მიიღო ჭეშმარიტებად.

### `u4` — step 4 — შემოწმება · შერწყმის წერტილი ⭐  — **Devi visible**

- **setup:** ნაცარქექიამ მარტომ სცადა დევის მოტყუება, თუმცა არაფერი გამოუვიდა და კინაღამ თავად ჩავარდა ხაფანგში. დადგა დრო, ნანახსა და ნაცადს თვალი გაუსწოროს.
- **question:** ამ მარცხის შემოწმების შემდეგ რას გადაწყვეტს?
- **choice 1** — score **300** → `u5`
  - label: არაფერს შეამოწმებს — მარცხის მიუხედავად, ჯიუტად იმავე მეთოდს გაიმეორებს.
  - story: არაფერი შეუმოწმებია — მარცხის მიუხედავად, ჯიუტად იმავე მეთოდს იმეორებდა.
- **choice 2** — score **1000** → `bridge-delayed` · effect: `{"path": "team-delayed", "roster": ["hunter", "elderwoman", "blacksmith"]}`
  - label: გულწრფელად შეამოწმებს, რა არ გამოუვიდა, მიხვდება, რომ მარტო ვერაფერს გახდება — სოფელში დაბრუნდება და, დაგვიანებითაც რომ იყოს, გუნდს შეკრებს.
  - story: მარცხი გულწრფელად შეამოწმა და მიხვდა, რომ მარტო ვერაფერს გახდებოდა — სოფელში დაბრუნდა და, დაგვიანებითაც რომ იყო, გუნდი შეკრიბა.
- **choice 3** — score **500** → `u5`
  - label: მარტო დარჩება, თუმცა შეეცდება, რომ შეცდომებზე ისწავლოს და მეთოდი შეცვალოს.
  - story: მარცხის შემდეგ მარტო დარჩა, თუმცა შეცდომებზე სწავლასა და მეთოდის შეცვლას შეეცადა.

### `u5` — step 5 — ადაპტაცია · ახალი ინფორმაცია  — **Devi visible**

- **setup:** ირკვევა, რომ დევი ღამით სხვა ბილიკით დადის.
- **question:** როგორ მოიქცევა ნაცარქექია ამ ახალი ინფორმაციის ფონზე?
- **choice 1** — score **1000** → `u6`
  - label: მთლიანად გადახედავს გეგმას, თუნდაც ამის გამო ორი კვირა დაიკარგოს.
  - story: როცა გაირკვა, რომ დევი ღამით სხვა ბილიკით დადიოდა, გეგმას მთლიანად გადახედა — თუნდაც ამის გამო ორი კვირა დაკარგულიყო.
- **choice 2** — score **500** → `u6`
  - label: ძველ გეგმაში მცირე კორექტივებს შეიტანს.
  - story: ძველ გეგმაში მხოლოდ მცირე კორექტივები შეიტანა.
- **choice 3** — score **300** → `u6`
  - label: ძველი გეგმის მიხედვით იმოქმედებს.
  - story: ძველი გეგმის მიხედვით განაგრძო მოქმედება.

### `u6` — step 6 — ლინ-აზროვნება · ზედმეტის მოკვეთა

- **setup:** ნაცარქექიას ზურგჩანთა უკვე ძლივს იხურება: თოკები, ცული, ორი ხაფანგი, სამი დღის საგზალი, ბებიის ძველი ამულეტი და კიდევ ბევრი რამ, რაც „იქნებ გამოდგესო“, ჩაიდო.
- **question:** რას გაიყოლებს და რას დატოვებს?
- **choice 1** — score **500** → `u7`
  - label: ყველაზე მძიმეს დატოვებს, დანარჩენს კი ყოველი შემთხვევისთვის მაინც გაიყოლებს.
  - story: ყველაზე მძიმე ტვირთი დატოვა, დანარჩენი კი ყოველი შემთხვევისთვის მაინც გაიყოლა.
- **choice 2** — score **300** → `u7`
  - label: ყველაფერს წაიღებს — გზაში რა მოგივა, ვინ იცისო.
  - story: ყველაფერი წაიღო — გზაში რა მოგივა, ვინ იცისო.
- **choice 3** — score **1000** → `u7`
  - label: ჩანთას გადმოცლის და მხოლოდ იმას დაიტოვებს, რაც უშუალოდ ემსახურება მიზანს.
  - story: ჩანთა გადმოცალა და მხოლოდ ის დაიტოვა, რაც უშუალოდ ემსახურებოდა მიზანს.

### `u7` — step 7 — ფოკუსი · ცდუნება

- **setup:** ვაჭარი ნაცარქექიას სწრაფ, „ჯადოსნურ“ გზას სთავაზობს.
- **question:** დათანხმდება თუ არა?
- **choice 1** — score **500** → `u8`
  - label: ორივეს პარალელურად გამოსცდის.
  - story: ორივე გზა პარალელურად გამოსცადა.
- **choice 2** — score **1000** → `u8`
  - label: უარს ეტყვის და საკუთარ, გამოცდილებაზე დაფუძნებულ გეგმას გაჰყვება.
  - story: ვაჭრის „ჯადოსნურ“ გზაზე უარი თქვა და საკუთარ, გამოცდილებაზე დაფუძნებულ გეგმას მიჰყვა.
- **choice 3** — score **300** → `u8`
  - label: საკუთარ გეგმაზე მთლიანად უარს იტყვის.
  - story: საკუთარ გეგმაზე მთლიანად თქვა უარი.

### `u8` — step 8 — პატივისცემა · სხვისი ცოდნა

- **setup:** დარბაისელი ქალი, რომელიც ნაცარქექიას გუნდში არასოდეს მიუწვევია, მაინც მიდის მასთან და დევის სისუსტის შესახებ რჩევას აძლევს — წინაპრებისგან გადმოცემულ საიდუმლოს უზიარებს.
- **question:** როგორ მოეპყრობა იგი მის ცოდნას?
- **choice 1** — score **500** → `u9`
  - label: ზედაპირულად მოუსმენს და არსებითად არაფერს შეცვლის.
  - story: დარბაისელ ქალს ზედაპირულად მოუსმინა და არსებითად არაფერი შეცვალა.
- **choice 2** — score **300** → `u9`
  - label: თავაზიანად იტყვის უარს — „მარტო დავიწყე და მარტოც დავამთავრებო“.
  - story: დარბაისელი ქალის რჩევაზე თავაზიანად თქვა უარი — მარტო დავიწყე და მარტოც დავამთავრებო.
- **choice 3** — score **1000** → `u9`
  - label: პატივისცემით და ყურადღებით მოუსმენს და ამ ინფორმაციას გეგმაში გამოიყენებს.
  - story: დარბაისელი ქალი, რომელიც გუნდში არასოდეს მიუწვევია, მაინც მივიდა მასთან — ნაცარქექიამ პატივისცემით მოუსმინა და წინაპრებისგან გადმოცემული საიდუმლო გეგმაში გამოიყენა.

### `u9` — step 9 — ღიაობა · დაღლილობა ⚠

- **setup:** დევთან ბრძოლის წინ ნაცარქექია აცნობიერებს, რომ გადაიღალა და შეცდომებსაც უშვებს.
- **question:** გაუზიარებს თუ არა ამას ვინმეს?
- **choice 1** — score **1000** → `u10`
  - label: სოფელში ვინმეს გულწრფელად გაენდობა, ეტყვის, რომ ეშინია, დაღლილია და მცირედ დახმარებას მაინც სთხოვს.
  - story: თავისი დაღლილობა და შიში სოფელში ვინმეს გულწრფელად გაანდო და მცირედი დახმარება მაინც სთხოვა.
- **choice 2** — score **500** → `u10`
  - label: მხოლოდ ნაწილობრივ აღიარებს და დეტალებს არ გაამჟღავნებს.
  - story: დაღლილობა მხოლოდ ნაწილობრივ აღიარა და დეტალები არ გაუმხელია.
- **choice 3** — score **300** → `u10`
  - label: არაფერს იტყვის და ყველაფერს გულში დაიტოვებს.
  - story: არაფერი უთქვამს — ყველაფერი გულში დაიტოვა.

### `u10` — step 10 — გამბედაობა · გადამწყვეტი წამი ⚠  — **Devi visible**

- **setup:** ბრძოლის გადამწყვეტი წამი დადგა — ნაცარქექია მარტოა. გეგმა, თუნდაც საკუთარი, დამოუკიდებლად შემუშავებული, არსებობს.
- **question:** რას მოიმოქმედებს იგი ბოლო წუთს?
- **choice 1** — score **500** → `bridge-battle`
  - label: გეგმას ნაწილობრივ გადაუხვევს და იმპროვიზაციას მიმართავს.
  - story: გადამწყვეტ წამს გეგმას ნაწილობრივ გადაუხვია და იმპროვიზაციას მიმართა.
- **choice 2** — score **1000** → `bridge-battle`
  - label: გაბედავს, პანიკას არ აჰყვება და ზუსტად გეგმის მიხედვით იმოქმედებს.
  - story: გადამწყვეტ წამს გაბედა, პანიკას არ აჰყვა და ზუსტად გეგმის მიხედვით იმოქმედა.
- **choice 3** — score **300** → `bridge-battle`
  - label: გეგმას მთლიანად მიატოვებს და შემთხვევითობას მიენდობა.
  - story: გადამწყვეტ წამს გეგმა მთლიანად მიატოვა და შემთხვევითობას მიენდო.


## APPENDIX B — BRIDGES


### `bridge-team-full`
- **heading:** გუნდი შეიკრიბა
- **text:** მონადირემ მხარზე მშვილდი გადაიკიდა, დარბაისელმა ქალმა სამკურნალო ბალახების ფუთა შეკრა, მჭედლის ბიჭმა კი თავისი ხელსაწყოები აიკრიფა. ოთხნი ერთად გაუყვნენ დევის ტყისკენ მიმავალ ბილიკს.
- **next:** `t3`  (button: გაგრძელება)

### `bridge-team-weak`
- **heading:** გზას ორნი გააგრძელებენ
- **text:** დარბაისელი ქალი და მჭედლის ბიჭი შინ დარჩნენ. ნაცარქექიამ განზრახვა მხოლოდ მონადირეს გაანდო — და ბილიკს მხოლოდ ორნი დაადგნენ.
- **next:** `t3`  (button: გაგრძელება)

### `bridge-solo`
- **heading:** მარტო გზაზე
- **text:** ნაცარქექიამ ზურგჩანთა მხარზე გადაიკიდა და სოფლის კარიბჭეს მარტოდმარტო გასცდა. არავინ იცოდა, უკან დაბრუნდებოდა თუ არა.
- **next:** `u3`  (button: გაგრძელება)

### `bridge-delayed`
- **heading:** დაგვიანებული შეკრება
- **text:** მარცხმა ნაცარქექიას ბევრი რამ ასწავლა, უპირველეს ყოვლისა კი ის, რომ მარტო ვერაფერს გახდებოდა. იგი სოფელში დაბრუნდა. იმავე საღამოს მონადირემ, დარბაისელმა ქალმა და მჭედლის ბიჭმა ბარგი შეკრეს.
- **next:** `t5`  (button: გაგრძელება)

### `bridge-battle`  — **Devi visible**
- **heading:** ბოლო ღამე დევის მღვიმესთან
- **text:** მთვარე ღრუბლებში მიიმალა. წყვდიადიდან დევის ხუთივე თავი ერთდროულად წამოიმართა. ორჭოფობის დრო აღარ იყო — რაც გადაწყდა, უნდა აღსრულდეს.
- **next:** `FINAL`  (button: შედეგის ნახვა)


## APPENDIX C — OTHER TEXTS, RESULT TEXTS, TIME-OF-DAY PRESETS

### Title screen
- title: `ნაცარქექია`
- subtitle: `სქრამის მიხედვით`
- text 1: წლებია, სოფელს დევი აწუხებს. ნაცარქექიამ გადაწყვიტა, ამ უბედურებისთვის ბოლო მოეღო. ამ მოგზაურობაში მის მაგივრად გადაწყვეტილებებს შენ იღებ: წინ ათი გზაგასაყარი და ათი არჩევანი გელის.
- text 2: დღე ღამეს ანაცვლებს. საბოლოო ბრძოლამდე, თითოეული შენი არჩევანით აგროვებ ქულას, რომელიც გზაში არსად ჩანს და მხოლოდ ბოლოს გამჟღავნდება.
- button: `მოგზაურობის დაწყება`
- footer (everywhere): `ნაცარქექია სქრამის მიხედვით`
- HUD trail text: `გზა · ეტაპი N / 10`

### Roster (chips and role tags)
- hunter: `მონადირე` — `მთის ბილიკების მცოდნე`
- elderwoman: `დარბაისელი ქალი` — `მცენარეთა ცოდნა`
- blacksmith: `მჭედლის ბიჭი` — `ხაფანგების ოსტატი`

### Path labels (final screen subtitle)
- team-full: `გუნდური გზა — სამივე თანამებრძოლთან ერთად`
- team-weak: `გუნდური გზა — მხოლოდ მონადირესთან ერთად`
- team-delayed: `დაგვიანებული შეერთება — გუნდი მოგვიანებით შეიკრიბა`
- solo: `სუფთა სოლო გზა — ბოლომდე მარტო`

### Tier names
- 0: `დამარცხება` · 1: `გამარჯვება — მძიმედ დაშავებული` · 2: `გამარჯვება — მცირედ დაშავებული` · 3: `სრული გამარჯვება` · catastrophe title: `სრული კატასტროფა`

### Final screen strings
- score table heading: `გზის ანგარიში — 10 პრინციპი` · total label: `ჯამური ქულა` (format `X / 10000 (NN%)`)
- tale card: heading `შენი ზღაპარი` · hint `ათივე არჩევანი ერთ ამბად შეიკრა — ეს ზღაპარი მხოლოდ შენია.`
- tale opening line (always first): `წლებია, სოფელს დევი აწუხებდა. ნაცარქექიამ გადაწყვიტა, ამ უბედურებისთვის ბოლო მოეღო.`
- copy button: `ზღაპრის დაკოპირება` → `დაკოპირდა ✓` (clipboard text begins `ნაცარქექია სქრამის მიხედვით — ჩემი ზღაპარი` + blank line + paragraphs separated by blank lines; error text `ვერ დაკოპირდა`)
- buttons: `← ბოლო პასუხის შეცვლა`, `თავიდან დაწყება`; stage back button `← წინა ეტაპი`; bridge back button `← პასუხის შეცვლა`; previous-pick marker `შენი წინა არჩევანი`
- Tale = opening line + all `story`/bridge texts in play order + closing paragraphs.

### Closing paragraphs (`closingText`) — `{ჯგუფი}` = “ნაცარქექია და {companions joined with “, ” and “ და ” before the last}” or just “ნაცარქექია” when alone


**CATASTROPHE (replaces tiers; tier 0 + catastrophe flag)**
- *solo variant, paragraph 1:* დევი ბოლომდე არ დამარცხებულა. მარტოობამ ბოლო წამს იმსხვერპლა — ერთმა დაუფიქრებელმა ნაბიჯმა ყველა წინა ძალისხმევა გადაფარა.
- *team variant, paragraph 1:* დევი ბოლომდე არ დამარცხებულა. ბოლო წამს ერთიანობა, რომლის ჩამოყალიბებასაც კვირები დასჭირდა, წამში დაინგრა — თითოეული, ვინც ბრძოლაში ერთად იყო, ბოლოს საკუთარი შიშის მიხედვით მოქმედებდა.
- *paragraph 2 (both):* დილისთვის სოფლიდან მხოლოდ ნაცარი და დამწვარი ბოძები დარჩა. ნაცარქექია ცოცხალია — მაგრამ სოფელი, რომლის დასაცავადაც იგი ბრძოლაში გავიდა, აღარ არსებობს.

**tier 0 — defeat**
- *solo variant, paragraph 1:* დევმა გაიმარჯვა. ნაცარქექია მარტო იბრძოდა და დამარცხდა — ერთი კაცის ძალა საკმარისი არ აღმოჩნდა.
- *team variant, paragraph 1:* დევმა გაიმარჯვა. {ჯგუფი} ბოლომდე გვერდიგვერდ იბრძოდნენ, მაგრამ მათი ერთობლივი გადაწყვეტილებები საკმარისად სქრამული არ აღმოჩნდა იმისთვის, რომ ბრძოლა მოეგოთ.
- *paragraph 2 (both):* სოფელი მძიმედ დაზარალდა. გადარჩენილებს ცხოვრების თავიდან დაწყება ნანგრევებში მოუწევთ. ნაცარქექია ცოცხალი გადარჩა, მაგრამ მარცხის ტვირთის ტარება დიდხანს მოუწევს.

**tier 1 — heavy damage**
- *solo variant, paragraph 1:* ბრძოლა უმძიმესი და თითქმის დამღუპველი აღმოჩნდა, თუმცა ნაცარქექიამ მარტოდმარტო იბრძოლა და საბოლოოდ დევი მაინც დაამარცხა.
- *team variant, paragraph 1:* ბრძოლა მძიმე გამოდგა და არც მსხვერპლის გარეშე ჩაუვლია, მაგრამ {ჯგუფი} ბოლომდე გვერდიგვერდ იბრძოდნენ, სანამ დევი არ დაეცა.
- *paragraph 2 (both):* სოფლის დიდი ნაწილი დაინგრა, თუმცა მოსახლეობა გადარჩა. ისინი ხვალიდანვე შეუდგებიან ნანგრევებში სახლების ხელახლა აშენებას — მთავარია, რომ სიცოცხლე გრძელდება.

**tier 2 — minor damage**
- *solo variant, paragraph 1:* ნაცარქექიამ დევს სძლია. მართალია, ცოტა უჩვეულო გზითა და, ნაწილობრივ, შემთხვევითობის წყალობით, მაგრამ გამარჯვება მაინც მან მოიპოვა.
- *team variant, paragraph 1:* დევი დამარცხდა. {ჯგუფი} მთელი ამ ხნის განმავლობაში ბოლომდე ენდობოდა ერთმანეთს და ეს ნდობა ყველაზე მძიმე წამებშიც კი არ შერყეულა.
- *paragraph 2 (both):* სოფელმა მხოლოდ მცირედი ზიანი განიცადა — ჩამოინგრა რამდენიმე ჭერი და დაიწვა ერთი-ორი ბეღელი, მაგრამ საცხოვრებელი სახლები გადარჩა. მოსახლეობა მადლიერებით შეეგებება შინ დაბრუნებულებს.

**tier 3 — full victory**
- *solo variant, paragraph 1:* სრული გამარჯვება — მთელი სოფელი ისევ ლაპარაკობს იმაზე, თუ როგორ მოახერხა ერთმა კაცმა მარტომ, არც ერთი შეცდომის დაშვების გარეშე, დევის დამარცხება.
- *team variant, paragraph 1:* სრული გამარჯვება. {ჯგუფი} ბოლომდე ერთმანეთს ენდობოდნენ — და ეს ნდობა ბოლო წამს გადამწყვეტი აღმოჩნდა.
- *paragraph 2 (both):* სოფლის კედლებიდან ერთი ქვაც კი არ ჩამოვარდნილა. ამბავი იმის შესახებ, თუ როგორ დამარცხდა დევი ზიანის გარეშე, თაობებს გადაეცემა.

**Solo-ceiling extra paragraph (appended when `soloCapped`)**
- *if every other crossroads was ideal (`allBest`):* და მაინც, სოფლის უხუცესები დღემდე იმეორებენ ერთსა და იმავეს: ნაცარქექიამ ყველა გზაგასაყარზე საუკეთესო არჩევანი გააკეთა, ერთი შეცდომაც არ დაუშვია და სწორედ ამიტომ მოიპოვა გამარჯვება. მაგრამ, რაკი თავიდანვე მარტო დარჩენა არჩია, უფრო შორს ვერ წავიდოდა: ერთი კაცი ზიანის გარეშე ვერ დაასრულებდა საქმეს. შთამბეჭდავი, ბრწყინვალე გამარჯვების მოპოვება მხოლოდ გუნდს ხელეწიფებოდა.
- *otherwise:* და მაინც — ყველაფერი პირველივე გზაგასაყარზე გადაწყდა: რაკი ნაცარქექიამ მარტო დარჩენა არჩია, ის, საუკეთესო შემთხვევაში, მძიმე დანაკარგებით მოიპოვებდა გამარჯვებას, ისიც მხოლოდ მაშინ, თუ ყოველ დანარჩენ გზაგასაყარზე საუკეთესო არჩევანს გააკეთებდა. ერთი შეცდომა და აღარაფერი გამოასწორებდა — და ასეც მოხდა.


### Time-of-day presets (`PRESETS`)
Columns: sky gradient (zenith → mid → horizon) · celestial (type, left %, top %, colour, colour 2, glow) · phase · tint (RGBA multiply overlay).

| preset | sky (3 stops) | celestial | phase | tint |
|---|---|---|---|---|
| `dawn` | #2b3a55 / #8a7391 / #f2b28c | sun, 14%, 66%, #ffd28a, #ff9a4d, glow 26 | dusk | `rgba(255,190,140,0.10)` |
| `morning` | #3f6f9e / #8fc1e3 / #e9f4f7 | sun, 26%, 38%, #fff2b0, #ffe98a, glow 30 | day | `rgba(255,255,255,0.04)` |
| `midday1` | #2f6fae / #74bce0 / #eaf6ff | sun, 42%, 16%, #fff6d0, #fff0a8, glow 34 | day | `rgba(255,255,255,0.02)` |
| `midday2` | #2c6aa6 / #78bce0 / #eaf6ff | sun, 52%, 12%, #fff6d0, #fff0a8, glow 34 | day | `rgba(255,255,255,0.02)` |
| `afternoon1` | #3a72a8 / #8fb9d6 / #f4d9a8 | sun, 68%, 22%, #ffe9a8, #ffcf7a, glow 30 | day | `rgba(255,220,160,0.06)` |
| `afternoon2` | #3d5f8a / #a892a8 / #f2b384 | sun, 78%, 34%, #ffcf8a, #ff9a5c, glow 28 | dusk | `rgba(255,180,120,0.10)` |
| `dusk` | #332e57 / #9a5b72 / #f0925a | sun, 90%, 54%, #ff8a5c, #ff5c3c, glow 30 | dusk | `rgba(150,70,40,0.16)` |
| `evening` | #3b4570 / #b0707e / #f0a267 | sun, 84%, 44%, #ffb173, #ff7a48, glow 28 | dusk | `rgba(190,110,60,0.13)` |
| `night` | #0d1026 / #1c2340 / #33305a | moon, 70%, 20%, #e7ecff, #c7d0f0, glow 20 | night | `rgba(10,10,35,0.28)` |
| `deepnight` | #06070f / #10122a / #241236 | moon, 50%, 12%, #d6dcff, #a9b3e6, glow 16 | night | `rgba(70,10,15,0.22)` |
| `victorydawn` | #355a86 / #e2ad72 / #ffe9c4 | sun, 50%, 28%, #fff3c8, #ffd98a, glow 36 | day | `rgba(255,220,150,0.08)` |
| `victorydamaged` | #3a4f66 / #a98a72 / #e8c99c | sun, 50%, 30%, #ffe2a0, #e8b06a, glow 26 | dusk | `rgba(120,90,60,0.22)` |
| `defeatashen` | #1a1613 / #2b2420 / #3a2a22 | moon, 60%, 70%, #7a6255, #5a473c, glow 8 | night | `rgba(40,15,10,0.32)` |
| `catastrophe` | #120806 / #2a0c08 / #4a140a | sun, 55%, 74%, #ff5a2e, #c9280f, glow 22 | night | `rgba(90,20,10,0.38)` |

- Stage step → preset: 1: `dawn`, 2: `morning`, 3: `midday1`, 4: `midday2`, 5: `afternoon1`, 6: `afternoon2`, 7: `evening`, 8: `dusk`, 9: `night`, 10: `deepnight`
- Bridge → preset: `bridge-team-full`: `morning`, `bridge-team-weak`: `morning`, `bridge-solo`: `dawn`, `bridge-delayed`: `dusk`, `bridge-battle`: `deepnight`
- Final: catastrophe → `catastrophe`; tier 0 → `defeatashen`; tier 1 → `victorydamaged`; tier 2/3 → `victorydawn`.


## APPENDIX D — SCORING (exact code from the 2D game, port as a pure function) AND TEST VECTORS

```js
function computeResult(){
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
```

`history` entries are `{category, score, max:1000, step}` pushed by `choose()` in play order; `S.path` is set by the stage-2 and `u4` effects. (`TIER_META` names are in Appendix C.)

**Verified test vectors** (run against the 2D implementation; scores listed in play order for 10 answers):

| case | total | % | tier | catastrophe | solo-capped | allBest |
|---|---|---|---|---|---|---|
| team all best | 10000 | 100 | 3 | False | False | True |
| team, 9th mid(500), rest best | 9500 | 95 | 2 | False | False | False |
| team, 9th & 10th mid | 9000 | 90 | 1 | False | False | False |
| team, 10th weak | 9300 | 93 | 0 | True | False | False |
| solo all ideal (s1 best, s2 solo=300, u3 best, u4 mid=500, rest best) | 8800 | 88 | 1 | False | True | True |
| solo with one non-ideal (u6 mid) | 8300 | 83 | 0 | False | True | False |
| delayed team (s2 solo=300, u4 best=1000 -> team-delayed, rest best) | 9300 | 93 | 3 | False | False | True |
| team all mid | 5000 | 50 | 0 | False | False | False |

Answer lists used: team all best = 10×1000; “9th mid” = 8×1000, 500, 1000; “9th & 10th mid” = 8×1000, 500, 500; “10th weak” = 9×1000, 300; solo ideal = 1000, 300, 1000, 500, then 6×1000; solo non-ideal = 1000, 300, 1000, 500, 1000, 500, then 4×1000; delayed = 1000, 300, 1000, 1000, then 6×1000; all mid = 10×500.


## APPENDIX E — IMAGE ASSETS (embedded in the 2D file as `IMAGES = {village, hunter, elderwoman, blacksmith, natsarkekia, devi}` base64 `data:image/webp`)

| key | size (px) | alpha | use in 3D |
|---|---|---|---|
| `natsarkekia` | 225 × 443 | transparent cut-out | player billboard |
| `hunter` | 330 × 480 | transparent | companion billboard + roster portrait |
| `elderwoman` | 336 × 501 | transparent | companion billboard + roster portrait |
| `blacksmith` | 665 × 620 (wide: boy with a big trap) | transparent | companion billboard + roster portrait |
| `devi` | 445 × 484 | transparent | giant billboard (five heads) |
| `village` | 1024 × 572 | opaque painting | title-screen hero image; also the notice-board mural on the village square |

Extract them with a script (regex `(\w+): "data:image/webp;base64,([A-Za-z0-9+/=]+)"` over the 2D file) and keep their pixel aspect ratios when sizing the billboards. Portraits in the roster chips use `object-position: top center` in a 22 px circle.
