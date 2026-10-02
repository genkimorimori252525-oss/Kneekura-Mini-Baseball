# Actual batted World continuation — reconstruction status

Base: PR #246 exact head `e2cbf66b985f8b011d0a388e495c658ef1943718`.

The prior local `codex/batted-world-continuation-2026-10-02` working tree was uncommitted and is not recoverable from GitHub or the current runner-evidence surface. Its old live session therefore is not counted as verification. This branch reconstructs the recorded scope from the published #246 Source.

## Reconstructed implementation

- Added a post-response BallFlight boundary for actual `ground` and `rebound` response states.
- Preserved `capture_candidate` as acquisition-pending, airborne no-contact horizon as World-extension-pending, and simultaneous/degenerate response as unresolved.
- Added a Native SQLite owner with revisioned prefixes, original-response re-derivation, historical replay, current World/flight/workload fences, peer comparison, full snapshots/hashes and transactional rollback checks.
- Exposed the existing batted-response SQLite evidence reader so later Native owners can re-derive the original response on their own connection instead of trusting a cached peer.
- Added the recorded accelerated-collision numeric-limit error-bound regression: finite squared terms are scaled before summation.
- No UI/Presentation, rules outcome, official scoring, workload closure, merge or workflow YAML was added.

## Verification in progress

The first reconstruction gate reached TypeScript and found one local union-narrowing error in the new Core boundary; it was reproduced from CI and fixed without changing semantics. A second full gate is running against the Core+Native reconstruction. Final GREEN evidence must replace this section before the slice is published as complete.

## Remaining full-goal work

Actual uninterrupted acquisition/shared World geometry, actual rolling pickup and subsequent transfer/throw/reception/base/running, foul whole-play replay and official/scoring/actual-role workload closure remain required. The full confirmed nonvisual goal remains active.
