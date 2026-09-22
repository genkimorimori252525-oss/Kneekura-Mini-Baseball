# 2026-09-23 — Action Frontier and exact batting event adoption

## Base and scope

Base is PR39 head `ee5f64873afb8dfdf12a3c9584bd5631e4f00ebf`. This slice implements the approved physical-live-action frontier and the first exact-tick event-adoption path. It does not claim whole-game orchestration or official closure.

## Implemented

- `LiveActionFrontier` with separate physical, intent, information, decision, live-rule-window and actor-disposition evidence.
- Explicit `settled_for_play`; stationary/zero velocity is not treated as settled.
- PlayEnd resolution that requires a queue watermark through the candidate tick and blocks on live rule windows.
- Explicit terminal exits that still wait for same-tick canonical settlement.
- Multi-source `EventQueueWatermark` with earliest-pending consistency.
- Batting forecast queue status and exact-tick adoption against the saved canonical cursor.
- Exact same-tick batching for take/miss physical fact + pitch adjudication.
- No backdating after a missed event tick.
- Unresolved batting physical forecasts keep the source watermark behind unknown future evidence.

## TDD and review record

The branch history preserves test-first commits before implementation. An additional failing regression was added after review showed an unresolved forecast could otherwise overstate its event watermark; the fix followed in a later commit.

The implementation was self-reviewed because no independent reviewer subagent is available in this harness. That is weaker than a fresh-context independent review and should be considered before merge.

Pre-closure exact-head native verification at `161169a266f5f7872a7d086620f0705632a146a8` succeeded with **295 files / 2,391 tests**. The final documentation/evidence commit requires another exact-head run; the PR record is the final verification authority.

## Deliberately unfinished

- OfficialPlayClosure and separate adjudication ledger.
- Appeals/reviews after physical PlayEnd.
- Durable next-play CanonicalMatchState activation.
- A general scheduler that owns all running/throwing/defense/batting event sources.
- Exact event adoption for runner motion, throw release/reception/tag and defensive replan.
- Persistence / crash recovery / global exactly-once event application.
- Production source generation/calibration and long-run match/career validation.
- UI and rendering.

Next dependency step: extend the same exact-tick adoption/frontier evidence to the connected running, throwing and defensive consumers, then implement the approved official-closure boundary only after all supported live actions can participate in the frontier.
