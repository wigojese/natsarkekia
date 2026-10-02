# ნაცარქექია სქრამის მიხედვით — 3D

A browser game in 3D. It retells the Georgian folk tale of Natsarkekia and the giant Devi to teach the ten Scrum concepts. The player walks Natsarkekia through a clay-miniature world: the village at dawn in the east, then west to Devi's cave at night. At each of ten crossroads the player picks one of three answers. The answers are scored but the scores stay hidden until the final screen. The rules, scoring, branching and every Georgian text are the same as in the original 2D game.

## How to play

Open `index.html` by double-clicking it. You don't need a server or a build step, and it works offline. Only the Google Fonts need a network connection, and without it the page falls back to system fonts. You can also upload the folder as it is to any static host.

| Action | Desktop | Touch |
|---|---|---|
| Move | `W A S D` / arrows (relative to the camera) | left half: virtual joystick |
| Camera | mouse (click the scene to capture it), wheel = zoom | drag on the right half |
| Run | `Shift` | push the joystick to the edge |
| Talk / interact | `E` / `Enter` | **საუბარი** button |
| Choose an answer | `1` `2` `3` or click | tap |
| Path hint (glowing trail) | `H` | ✦ |
| Map | `M` | ◎ / tap the mini-map |
| Unstick | `R` | pause menu |
| Pause | `Esc` | ❚❚ |

A gamepad also works: left stick to move, right stick for the camera, A to interact and Start to pause.

## Exploring

- **Watching Devi (stage 3):** climb the lookout hill. When you talk there, you first watch Devi stride through the valley below, and then the question appears.
- **Viewpoint hills:** three hills (with a cairn and a bench) plus the chapel ridge. Climb up and press `E` for a slow panorama.
- **Forest buildings:** a woodcutter's cabin, a hunter's lodge, a watermill with a turning wheel, a ruined watchtower, a stone cross, beehives, a charcoal kiln, a small church and an old ruin.
- **Animals:** deer herds, rabbits, foxes, wild boars, bears, sheep, cows, horses, chickens, ducks, eagles and butterflies. Shy animals run away when you come close.
- **Cinematic shots:** a sunrise over the village at the start, and a short flyover to the next place after each decision. Any key or tap skips them; reduced motion turns them off.

## Project structure (one language per file)

```
index.html            page structure only
css/style.css         all styles (2D game palette: parchment / ink / gold / ember)
js/vendor/three.min.js  Three.js r170, pinned and vendored (offline), MIT licence alongside
js/vendor/three-addons.min.js  Three.js post-processing passes (bloom, composer) bundled for classic scripts
js/images.js          the six original images as data URIs (see below)
js/data.js            STAGES, BRIDGES, PRESETS, TIER_META copied verbatim from the 2D game + 3D UI strings, sites
js/scoring.js         pure functions: newState, applyChoice, computeResult, closingText, buildTale, pathLabel
js/core.js            namespace, math, seeded noise, settings, event bus
js/terrain.js         seeded heightmap with hand-placed constraints, road, rivers, fords, bridge, colliders
js/geom.js            low-poly part builder, instancing chunks, procedural canvas textures, sway shader
js/sky.js             sky dome with the 2D gradients, sun/moon, stars, clouds, fog, tint, preset blending
js/world.js           terrain mesh, road, water, forest, village (damage states), the ten sites, landmarks, mist, ambient life
js/structures.js      forest buildings: cabin, hunter's lodge, watermill, watchtower, stone cross, apiary, kiln, church, ruin, cairns
js/fauna.js           animals: deer, rabbits, foxes, boars, bears, sheep, cows, horses, chickens, ducks, eagles, butterflies
js/characters.js      camera-facing billboards (lit, rim, silhouette shadows), player, companions, Devi
js/controls.js        keyboard, mouse, touch, gamepad
js/camera.js          third-person rig with collision, framing shots, spline camera paths, orbit, shake
js/post.js            light rays from the sun/moon, lens flare, bloom (Medium/High quality)
js/audio.js           WebAudio synthesis (no audio files)
js/ui.js              title, HUD, dialogue panel (auto-fit), bridge card, final screen + tale, pause, tutorial
js/guidance.js        beacon, ground ring, compass, edge arrow, mini-map + fog of war, big map, A* breadcrumb, idle hints
js/cinematics.js      bridge scenes, final tableau, sunrise intro, flyovers to each new site, Devi observation, hill panoramas
js/game.js            state machine and flow: objective, dialogue, choose(), goBack(), final
js/main.js            boot, render loop, quality levels + automatic governor, debug API
tests/                Node logic tests and Playwright browser tests
docs/build-prompt.md  the specification this game was built from
```

The scripts are classic scripts (not ES modules) that share one `window.NATS` namespace. Browsers block ES modules and WebGL image textures on `file://`, so this keeps the double-click start working. For the same reason the images are kept as data URIs inside `js/images.js`.

## Tests

```bash
npm i -D playwright            # or use a global install
node tests/logic.test.js [path/to/original-2D.html]   # text integrity vs. Appendix A–C, scoring vectors, 2D parity
node tests/e2e.test.js [screenshot-dir]               # 8 storylines → FINAL, back chain, objectives, layout, stability, FPS
node tests/tour.js out-dir 2,0,0,0,1,1,1,2,0,0        # screenshot tour of one storyline
```

`logic.test.js` checks every stage, choice, bridge, preset and closing text against the spec, character for character. It also checks the eight Appendix D scoring vectors. If you give it the path of the original 2D HTML file, it also plays 400 random games through both implementations and compares the results, closing texts and tales.

## Debug / test API

`window.__NATS__` has `getState()`, `getObjective()`, `teleportToSite(stageId)`, `interact()`, `answer(i)`, `back()`, `skipCinematic()`, `continue()`, `start()`, `setQuality('low'|'medium'|'high')`, `fps()`, `hint()` and `info()`.

## Georgian draft strings for the author's review

These are new 3D-only UI strings. Everything else is copied unchanged from the 2D game.

- `მიზანი:` · `მიდი: {ადგილი} · {n} მ`
- `დააჭირე E-ს` / `საუბარი`
- `ახლა სხვა ადგილზე უნდა წახვიდე`
- `მიჰყევი შუქის სვეტს.`
- `მართვა: W A S D — სიარული · მაუსი — კამერა · Shift — სირბილი · E — ურთიერთქმედება`
- `პაუზა` · `გაგრძელება` · `წინა ეტაპზე დაბრუნება` · `თავიდან დაწყება` · `მინიშნებები: ჩართ. / გამორთ.` · `ხმა: ჩართ. / გამორთ.` · `გრაფიკა: დაბალი / საშუალო / მაღალი`
- `იტვირთება…` · `ამ მოწყობილობაზე 3D გრაფიკა ვერ ჩაირთო.`
- Site names: `სოფლის მოედანი`, `გზაგასაყარი ძველ მუხასთან`, `საგუშაგო ბორცვი`, `საცდელი მდელო`, `დევის ბილიკი`, `სამგზავრო ბანაკი`, `ვაჭრის კარავი`, `ბანაკი მთის ძირას`, `ღამის კოცონი`, `დევის მღვიმე`
- Two strings added for accessibility and the unstick button: `მოძრაობის შემცირება: ჩართ. / გამორთ.`, `გაჭედვისას დაბრუნება (R)`
