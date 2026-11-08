# TBD/LAD implementation — native aero/rigid observation and official 9-inning receipt

Date: 2026-10-14
Branch: \`jolly/tbd-lad-native-browser-core-2026-10-14\`
Status: **Genuine Native bounded vertical slices proven; official mixed live-ball TBD/LAD exhibition NOT DONE**

## User product invariants

- One authoritative physical Match Core shared by Mini and future Natural; rendering does not choose legal baseball results.
- User-approved v23 PNG/B1 original appearance, 4px pixel grid and existing player image assets remain unchanged.
- PC and phone browser should eventually execute the **same physical Core**, locally/offline, with rendering quality profiles. A mobile-sized Chromium viewport PASS is **not** actual iOS/Android certification.
- A manager's new instruction is valid only on an unissued next pitch. There is no modification of an already accepted release/swing/umpire event.
- Authentic actor locomotion, field acquisition/catch/throw/transfer, umpire and scoring receipts are required for hits/outs. Never manufacture a flyout because an animation appears to catch the ball.

## 1. Actual source + browser-safe aero/rigid bridge

\`src/integration/browser/NativeAerodynamicObserver.ts\` and \`NativeAerodynamicSession.ts\` now observe real, source-owned:

1. \`resolveAndRecordAerodynamicRigidPitchAgainstBatter\` from existing \`src/core/sim/pitching/\`, not v23's approximate result engine;
2. actual RK4 aerodynamic pitch trajectory, spin and exact physical plate crossing;
3. genuine \`SwingKinematicsV1\` bat pose and rigid impulse/collision when produced;
4. original chronological \`TakenPitchPlateCrossed\`, \`PitchAdjudicated\`, \`SwingCompletedWithoutContact\`, \`BatBallContact\` with source identity;
5. original pitch-count rule, source MatchState applications for canonical K/BB, unmodified rendering-only Mini sample schedule and camera frames.

At the physical bat/ball contact tick, the old incoming pitch stops. Without accepted live-ball trajectory/defense/umpire producer, \`requiresOfficialLiveBallResolution=true\` and **no hit or out** is issued.

\`createNativeAerodynamicSession\` requires an external explicit physical source and read-only authoritative \`actorsAtTick\` function; never attempts to reverse player ratings from league names or invent a hitter's success. It snapshots each accepted command before issuing the next pitch, preserving immutable earlier events.

\`createReferenceAerodynamicPhysicalSource\` is a deliberately labeled **non-production demonstration fixture** for browser proof only: fixed caller-specified speed at most 151 km/h, documented sea-level baseball reference aerodynamics, test bat dimensions, player-independent aimed input. It does **not** implement NLB relative control 97 → true ability 250, pitcher/catcher authority, actual batter perception, scouting or validated Tikao/Ohtani behavior. \`actorAtTick\` for demo may legitimately provide an explicit empty array, but no production field result should use that.

The \`tools/browser-bridge/build-native.mjs\` script bundles the source-derived module into a standalone browser IIFE, with no \`node:sqlite\`, node:fs or required server, preserving original event authority. The source-boundary tests include changed command only next pitch, out-of-order rejection, seeded determinism, genuine spin/rigid contact and fail-closed missing actors.

## 2. Genuine Native official 9 innings — strictly non-live

\`src/integration/native-game/PhysicalGameSmoke.ts\` is a callback/source driven Node.js Native **host** orchestrator: it does not decide the game outcomes itself. Given authenticated physical pitch sources and closure publishers, it admits through existing:

- \`SqlitePhysicalPitchProgressStore.accept\` for real sampled physical K/BB pitches;
- \`SqlitePhysicalPlayClosureStore.submit\` for only genuine terminal physical strikeout/walk;
- official MatchState, workload, scoring, exact original source/receipt, replay and persisted SQLite lineage.

The dedicated test creates a genuine saved world and performs **58 plate appearances over all nine innings**: first four complete physical walks, with bases loaded and 1 forced run, plus 54 genuine physical strikeouts (178 actual physical pitches). This is NOT fabricated hit/out; the native DB supplies the events, owners, official final and every inning transition.

Evidence from isolated complete source checkout (Node 26.1.0, 2026-10-14):

- full \`tsc --noEmit\` PASS after running the official catalog compiler from complete tracked \`data\`;
- focused physical game Vitest test **1/1 PASS** (actual 406.80s, total 415.74s);
- final **away 1, home 0**, nine-inning \`BOTTOM_COMPLETE\`, official durable revision 58;
- independent SQLite disk close/reopen: \`PRAGMA integrity_check='ok'\`, foreign_key_check empty;
- 178 physical pitch records, 58 completed play closures, 58 original official applications and 58 official scoring applications, all exact saved receipt mirrors and final result matched.

The fixture uses test clubs and synthetic source *inputs*. It **does not** mean genuine TBD/LAD rosters, league 200–250 absolute ratings, home-field dimensions, catcher leadership or actual batted-ball innings are verified. Live contact must stop at true official fielding/umpire boundary. LAN01 original composite rights/terminal pathway still has uncompleted genuine end-to-end work; these 58 K/BB PAs do not replace that original acceptance.

## 3. Browser compatibility and bounded acceptance

- TypeScript strict scoped compile **PASS**; full repo compile PASS with tracked catalog data present and generated type catalog.
- Native browser Vitest focused observer/session/source adapter unit tests: **31/31 PASS** (five files; excluding the separate Native host physical-game suite).
- Browser IIFE executed in a Node \`vm\` context without Node module globals/require/fs/sqlite; same source seed and commands produced identical signed physical frames and events; original 18m real aero fixture accepted correct \`TakenPitchPlateCrossed\`/ \`PitchAdjudicated\`.
- The v24/v25 read-only bridge into v23 original PNG uses the existing \`window.matchPreview.nativePaintBall\` and \`nativePaintBat\` ports. It does not replace v23's complete offline prototype game mode with canonical mixed-play processing.

Known remaining contractual gaps:

1. Actual post-contact live ball/catcher/fielder/runner/umpire event chain in same game, including LAN01.
2. Turn the test fixture one-PA issuance into full TBD/LAD roster-, person-, venue-, participation-, actual practice/ability- and calendar-bound authorization and inning advancement.
3. Synchronized persistence on real standalone Android/iOS browser (IndexedDB/local WASM SQL or equivalent), versioned replay and recovery, benchmark and hardware quality gates.
4. Production pitch caller must implement pitcher/catcher/negotiated authority from personality/trust, true absolute command inputs, target/velocity/spin and physical batter decisions; demonstration numeric constants never become Tikao abilities.

## 4. Repeatable commands

\`\`\`powershell
npm ci
node tools/catalog/compile-catalog.mjs
npx tsc --noEmit --pretty false
npx vitest run src/integration/browser
node tools/browser-bridge/build-native.mjs
node tools/browser-bridge/check-native.mjs
node tools/browser-bridge/build-demo.mjs
# Optional for browser screenshot smoke: npm install --no-save --package-lock=false playwright-core@1.55.0
node tools/browser-bridge/smoke-demo.mjs
# Expensive ~7 min Native SQLite official 9-inning receipt gate, explicit opt-in for repeat:
npx vitest run src/integration/native-game/PhysicalGameSmoke.test.ts
\`\`\`

**Do not change main, unmerged source owner's native files, the original v23 PNG baseline, original user save files, or unapproved policy proposals as a side effect of this bridge.**
