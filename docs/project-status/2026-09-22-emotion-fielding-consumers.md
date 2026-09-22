# 2026-09-22 — Emotion throwing and defensive replan consumers

## Baseline and scope

Parent PR37 `118d07bd448631952f0d97e7ebc7307caa9beafa`, tree `eaf5ae9707c99010be8af1bba4177d48d7e0befc`. New dedicated branch `jolly/confirmed-headless-fielding-2026-09-22`. User requested continued approved-plan execution and asked whether all plans were close to completion. No shared-branch merge or UI/design connection.

Frozen psychology05 at design SHA `782f6b8ef2406839de5678b00040001111cd8f77` is the behavior authority. Independent swing PR27 was re-read at `7b1b84aafa5d79499740d556fd44cef63b4f2c26`; it remains separate. Dependency ruling: implement the already available throwing/defender-motion owners first rather than silently combining independent physical branches or building another swing engine.

## Implemented

- Current-frame/current-gate scheduled-event validation of the existing PR37 accepted receipt; no second appraisal event.
- Explicit WAITING, MISSED_COMMITMENT, MISSED_WINDOW, NO_CONTROL and NO_NEW_TRIGGER; no retroactive execution.
- Source-bounded throw profile selection from accepted aggression; real existing transfer timing and rated launch with unchanged ability/isolated RNG.
- Stationary-holder throw plans only; actual release/possession/pose validation remains outside this plan boundary.
- Actual existing defensive candidate selection, trigger and first-step functions into continuous old-target -> new-target motion; current momentum preserved.
- Recomputed adoption bundle with current world/gate versions and a source-ID-independent action deduplication key.

## Local record

Reconstructed the source subset from previously verified GitHub artifacts and normalized CRLF to LF in an isolated local worktree. Publication overlays only new files onto the exact complete remote parent tree. No assumption that the local reconstruction is a full clone.

Supplementary strict TypeScript5.8.3/Node22.16 testing:392/392 pass (304 inherited psychology/appraisal/execution +88 new). Temporary test copies change only Vitest runner imports to node:test. Test progression:7/14 ->14/14;14/34 ->34/34;34/58 ->58/58; inline review87/88 ->88/88, then inherited suite392/392. One initial fixture shared current/source frames; detach them to test mismatch correctly. A TypeScript status-union inference error was corrected before the second GREEN. A local intermediate commit captured the fixture failure before its fix; it was never published or represented as a passing checkpoint. Offline npm install failed ENOTCACHED; a bounded online install attempt timed out. Dependencies/lockfiles were not changed.

Review reproduced a real numerical defect: tiny claimed release speed divided by a huge target distance underflowed to zero velocity in the existing launch computation. The new boundary rejects this inconsistent physical output; the existing launch owner is unchanged. Review is inline, not an independent-agent audit.

## Publication gate

Native full `npm ci` / `npm run verify` must run on the final published SHA. The PR's exact-head verification record closes this gate; do not infer success from this prepublication document or local supplementary counts. Inherited dependency warnings (3 moderate/1 high/1 critical) are not individually audited or repaired by this feature. No warning bypass or script permission change.

## Remaining

Batting commitment/perception cutoff and existing Swing Kinematics integration remain next in this subqueue. These two fielding consumers do not finish whole-game perception collection, scheduler/interruptions, production calibration, moving throws, pose/actual release validation, database transactions, team coordination or all psychology/traits.

The companion `2026-09-22-approved-plan-coverage.md` separates implemented components, missing game-wide integration and other approved systems. Plan-document count, PR count and test count are NOT percent-complete measures. Other remaining work: competitions/calendar, development/scouting, team traits/mood, manager market/evolution, world/economy and persistence. UI/design is another owner's work, not required here.
