# TBD home vs LAD away — Native Match Core → browser Mini Presentation

Date: 2026-10-14
Branch: jolly/tbd-lad-native-browser-core-2026-10-14
Status: **TRUE NATIVE PHYSICAL PITCH / ONE-PLATE-APPEARANCE BROWSER CONNECTOR IMPLEMENTED; FULL GAME NOT CONNECTED**

## Why this separate connection exists

The approved PNG v23 one-file HTML remains a playable **standalone approximation**, not a wrapper over the real Native Match Core. It must **not** be called the authoritative rule/physics engine by virtue of passing its own 400-game consistency tests. The latest nonvisual Native branch also has unfinished genuine LAN01 original whole-case terminal/catch/appeal gates. This integration does not fabricate those missing claims.

## What is directly connected to real source

This branch is based on the latest \`codex/current-nonvisual-owner-integration-2026-10-08\` source and adds:

- \`src/integration/browser/NativePitchObserverAdapter.ts\`: consumes real \`PitchAgainstBatterInput\`, invokes **existing** \`resolveAndRecordPitchAgainstBatter\`, uses **existing** \`createMiniPresentationSampleSchedule\` and \`buildMiniPresentationTimeline\`, and samples the **identical accepted** ball trajectory with \`samplePitchTrajectorySegment\`. For bats, uses the underlying tested \`sampleBatterSwingState\` compatibility state instead of inventing a visual sweep. No score, putout, catch, defender, runner or future landing outcome is invented by the observer.
- For genuine **walk** and **strikeout**, only the production \`applyWalkPlateAppearanceToMatchState\` and \`applyStrikeoutPlateAppearanceToMatchState\` may advance MatchState. Walks with occupied bases score only as dictated by the original legal forced-advance code.
- **True contact** automatically stops the pitched-ball samples at the actual bat contact tick and reports \`requiresOfficialLiveBallResolution: true\`. There is no "fake flyout" or "simulated home run" fallback; a physically admitted acquisition/catch/throw/runner/umpire lineage must be wired next.
- \`issueNativeCommandPitch\` takes an accepted \`PlateAppearanceCommandSession\` and real \`CommandPitchEnvironment\` and delegates to the official \`PlateAppearanceCommandPitchAdapter\`. An instruction change is accepted at the **next unissued pitch** boundary only. Previously accepted event prefix and physical ball trace are immutable.
- \`NativeSinglePaSession\` is a **testing/exhibition one-PA** wrapper that uses the production Core with \`LAD 2025 Ohtani\` batting in the top first vs \`TBD Tikao\` pitching. The specific seed/geometry, NPB 2026 pitch-count rule profile, and empty field actor array are labeled **fixture-only**, not an assertion that the full TBD/LAD exhibition, or all true player ratings, are implemented.
- \`tools/browser-bridge/build-native.mjs\` bundles the **actual TypeScript source imports** to a single Node-free browser-compatible IIFE \`dist/native-match-core-browser.js\`. Building does not port SQLite stores; those retain their Native host ownership.

## Observability and falsification gates

Local Windows Node 26, TypeScript ~5.6 and Vitest:

\`\`\`powershell
npm ci
node_modules/.bin/tsc.cmd --project tsconfig.native-browser-bridge.json --pretty false
node_modules/.bin/vitest.cmd run src/integration/browser/NativePitchObserverAdapter.test.ts src/integration/browser/NativeSinglePaSession.test.ts
node tools/browser-bridge/build-native.mjs
node tools/browser-bridge/check-native.mjs
\`\`\`

Passing focused tests currently cover:

1. Same accepted canonical physical ball coordinates at every presentation sample and exact canonical event sample ticks.
2. Called balls/strikes and walk-on-loaded-bases official scoring with source MatchState code.
3. Actual bat-ball contact does **not** continue the original pitched trajectory through a fake flyout.
4. Changing a manager command after release changes only the next issued pitch.
5. Same seed/command reproduces the same physical ledger and renderer-neutral ball samples.
6. Missing real world observation is rejected, not replaced with an invented fielder location.
7. Browser IIFE executes without Node builtins, \`require\`, sqlite, or web requests.

This is a **bounded successful connection**, not 9-inning evidence. It should be used to build the browser↔Native interface incrementally while keeping every unimplemented native play visibly blocked.

## Remaining gates (NOT PASS)

- Fully verified genuine Native whole-case (especially LAN01 terminal continuation and legal appeals).
- Real 9-player physical field/runner states, all batted-ball/outfield/catch/fly/error/award decisions, inning-end and full-nine-inning Native official ledger.
- Actual player truth profiles, NLB dynamic absolute→relative rating calibration, Tikao's true pitching command & Tikao/Nappa battery leadership/temperament negotiation. **This one-PA fixture must not be used to claim control 97 = absolute 250 or one fixed glove-target error.**
- Approved PNG v23 renderer's **live** ingestion of the Native canonical event stream through each full play (a separate optical proof can be added while keeping the original v23 match simulator clearly labeled).
- Browser IndexedDB durable replay/rehydration and portable world/career serialization; actual iOS/Android hardware, thermal performance and simultaneous connection tests.

Never conflate this native physical-pitch bridge with the old self-contained v23 scripted source. Do not weaken Native acceptance gates to make the demo continue, and do not modify original approved PNG masks merely to get a passing preview.
