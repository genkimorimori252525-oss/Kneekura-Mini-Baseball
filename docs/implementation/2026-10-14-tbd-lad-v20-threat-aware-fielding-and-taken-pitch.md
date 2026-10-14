# TBD v LAD v20: batter watches taken pitches / threat-aware throws / command boundary

Date: 2026-10-14
Status: **Browser v20 test evidence PASS; shared Native Match Core integration NOT DONE**
Branch: `jolly/tbd-lad-playable-2026-10-14`
Input: user's v19 review, 2026-10-14.

## Canonical user requests
- Batter-view head/camera follows any **unswung pitch** past the zone until the actual catch point in the catcher's mitt, **whether called ball or strike**.
- Evaluate fielder throws based on realistic advancement risk: protect an advancing first-base runner from first-to-third, home from second/third, or use appropriate second-base/cutoff prevention; still permit a genuine first-base force out. Do not assert all hits must be thrown to third.
- Distinguish **poor player situational awareness** from systemic lack of decision logic. Old browser v19 had a **hard-coded first-base throw target** even for safe hits, irrespective of fielder identity/ratings; it was NOT evidence that TBD players were unintelligent.
- Remove the transport seek/scrub timeline and redundant controls. Playback commands exactly `試合を進める`, `一球もどる`, `一球すすめる` (speed dropdown remains).
- On changing a manager command while playing, **complete the currently committed physical pitch and PA state**, stop before generating next pitch, apply changed decisions to the subsequent pitch only. Never retroactively modify historical actual-ball outcome or perception.

## Research and intent
- MLB Statcast *Baserunning/Throwing Value* models the chance of extra-base advances using actual runner speed, runner position, outfielder arm, distances to ball and target bases; rewards both putouts and runner advancement *deterred*:
  https://www.mlb.com/glossary/statcast/baserunning
- Coach Baseball Right describes distinct cutoff and relay assignments with runner on 1B and ball hit to RF:
  https://coachbaseballright.com/coaching-academy/cuts-and-relays/
- All Nine Baseball depicts RF -> SS cutoff -> 3B for first-to-third situations:
  https://www.baseballcoachlab.com/play.php?id=r1-single-rf-throw-third
- **Implementation principle**: compare time to field/carry/transfer/throw/base with observed runner intent + timing, opponent/trailing runner opportunity, legality and errors; rank physically feasible plans. Weak explicit `situationalAwareness` may change time of recognition / missed candidates, not arbitrarily reverse correct tactical objectives. An absent awareness input must *not* be misread as low IQ.

## v20 standalone browser slice changes
- `makeMotion` retains a taken ball through plate-crossing tick38 to catcher tick43 at world `z = -1.9`, then depicts the secured ball through the current pitch's end; batter POV yaw/pitch gradually turns toward that actual position. Renderer pitch is positive looking downward; camera can zoom out enough to show catcher.
- `planDefensiveThrow(rec,pa,secured,outcome,battingBases)` computes threat and time-of-arrival, possible home/third/second/first target, with measured throw projection and optional player-specific situationalAwareness; explicit neutral default when missing. Never automatically throws to first on safe outfield hits; 1B legitimate GO retains first-force option.
- `applyHit()` checks holding the lead runner or protecting the trailing runner, so throwing changes plausible runner decisions, not just decorative animation. Browser simulation is still an approximation: no true multi-player relay or official throw interception live-ball solver.
- Manager button choice is captured at *new pitch creation* in each pitch's `committedInput`. During autoplay a new instruction requests `pendingCommandPauseAt=currentPitch.end`; generated future pitches are blocked and playback pauses on that exact boundary; forward/resume generates subsequent pitch using current command.
- v19 PNG/B1 masks, font, ball surface rasterizer and pitch symbols byte-identical; retained existing five camera modes/foul skip/red runner labels/visible outfield labels and batter follow-through/runner tracking.
- HTML remains browser-only independent practice engine. No claim that this is exact Node.js/SQLite Match Core parity.

## Validation (standalone, 2026-10-14)
- `node tests/v20_headless_test.cjs`: 65 nine-inning game runs, 16,460 pitches, 5,780 PA, **71/71 PASS**.
- `node tests/v20_defensive_unit.cjs`: **11/11 PASS** for threatened R1→3B vs cutoff, legitimate 1B GO, R2/R3 lead threats, no flied-out throw, explicit IQ vs neutral, physical runner decision influence, behind-plate ball persistence, deterministic seeded replay.
- `node tests/v20_scene_regression.cjs`: 30 separate seeded 9-inning games, **23,340 scene assertions PASS**, 1,956 fair batted balls, 72 fouls, 3,302 unswung pitches; confirms follow-through, foul timing 2-5s, ball persists to play end, catcher receives unhit ball, threatened throw endpoints.
- Playwright Chromium on 1440x1000 desktop and 390x844 mobile-sized viewport: all 3 correct transport buttons, timeline absent, followed ball/strike to catcher, all five camera choices, LF/CF/RF name tags, red runner name, instruction changed during flight -> pause at tick71 (exact pitch end) with only one committed pitch -> next pitch picks slider only, full 9 innings, no page exception: **PASS**. Physical Android/iOS device hardware tests NOT RUN.
- Five approved source assets unchanged SHA-256: player masks, sprite palette, embedded WOFF, original baseball rasterizer, pitch symbols.
- Rebuild+tests, source and HTML shipped in v20 artifact ZIP with browser screenshots.

## Production Native integration gaps
- The current no-swing catcher-watching geometry is also prototyped as a **pure Presentation helper** in `src/presentation/mini/TakenPitchObserver.ts` and companion unit tests on this branch.
- Full canonical Match Core already has independent defense planner, movement, adjudication and immutable command channels under separate `codex/current-nonvisual-owner-integration-2026-10-08` branch. That authoritative source must be audited against the same R1/R2/R3 expected behavior before changes. Do **not** copy v20's simplified simulated `planDefensiveThrow` into Native as a substitute.
- Must implement an explicit canonical manager instruction approval/issuance boundary before new intent generation; an issued pitch's trajectory/perception must remain immutable, with command revision and correct event/tick lineage.
- Native catch-sample time and catcher mitt geometry should drive the observer rather than hard-coded v20 frame43.
- Cross-engine same-seed parity, production SQLite/or browser persistence, phone hardware and multi-device synchronization NOT RUN.

No `main`, Core Native integration owner files or original v16 PNG baseline were overwritten in this change.
