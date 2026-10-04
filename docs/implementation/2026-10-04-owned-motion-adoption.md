# Owned complete-motion adoption v1

## Contract

`owned_motion_v1` is an additive action of the existing SQLite field-execution owner. It contains exactly ten original Player contributions (including the actual batter), a requested integer checkpoint, and explicit source-local known decision/motor references. Each contribution names either one immutable initial defender motor receipt or the exact active physical command/adoption reference. It cannot provide positions, targets, accelerations, policy choices, results, or arbitrary actor snapshots.

The existing physical transaction owns the complete composition and adoption. Normal Source retry and bounded historical reads remain original-only. The immutable motor archive remains `adoption_pending`: physical adoption and actual executed-through belong to the physical execution snapshot. A motor can be newly adopted once; subsequent progress retains the accepted physical command. A first contact can consume zero duration or a strict prefix, and never consumes the proposed future tail.

All relative-role commands and original batter motion are preserved. One complete mixed rebase creates a physical segment bounded by the shortest contributor. It does not erase the longer original root/role authority of retained peers. Versioned kinematics coverage lineage exposes that original authority separately from complete-segment physical coverage. This initial capability cannot renew the initial motor root step when it expires, even where retained peer and relative-role authority remains longer. Completion of coverage is an unfinished controller handoff, not physical settlement.

## Exact ordering and causal replay

A fresh accepted action pins the real physical predecessor and relevant decision/motor heads. Before dereferencing any motor or decision, indexed and duplicate-aware typed identity metadata prove that all self, decision ancestors, observation ancestors, and plan-origin observations belong to the strictly earlier physical prefix. Selected motor self is exactly the current predecessor. A scoped private replay context reuses only already validated earlier execution snapshots, compares them to the same connection's exact stored bytes/hashes, and cannot supply a fabricated caller prefix.

Old accepted curves execute only through the earliest requested checkpoint, complete command coverage, or known individual decision/first-step deadline. Actual contacts at that endpoint remain physical-owner evidence. At a resolved exact boundary, the observation/decision owners record their actual revisions without moving time, then all due motors are adopted in one complete composition before positive progress. No epsilon or quantized-tick tie substitutes for this order.

The read-only `owned_motion_live_work_v1` projection separates actual executed-through, accepted complete-segment coverage, unexecuted tails, and pending contact/controller handoffs. Reaching a pinned decision or first-step deadline exposes an explicit pending decision-owner revision handoff, using exact elapsed time rather than the quantized tick. Simultaneous unresolved contact and due decision work remain visible together. A resolved contact with a non-null cursor retains its actual first-contact prefix and open physical continuation without inventing an unresolved contact owner. It identifies each consumed local motor-adoption event and keeps the known source set explicitly partial with unknown queue coverage.

Observation Sources whose bounded prefix contains `owned_motion_v1` use `owned_motion_observation_prefix_manifest_v1`: ordered, owner-qualified Source/revision references with rederived Source/snapshot hashes and an exact physical cut. This avoids cloning all repeated roots into one oversized hash input. Each original dependency is still rederived on the same connection. Prefixes without owned motion keep their original observation bytes and whole-prefix hash; future owned payloads do not switch an older bounded observation's convention. Physical ownership discovery includes the nested base-field Source mirror and indexed/body/history predecessor claims, so an off-namespace fork cannot hide before mirror validation.

## Admission fence and remaining capability

The first `owned_motion_v1` action opts that pitch into the guarded lifecycle. It can be all-retained while genuine coverage is available. Fresh raw physical motion, acquisition, throw, and scheduled advances cannot subsequently bypass the guard. Previously accepted raw rows remain readable/retryable and non-opted-in pitches retain their old behavior. Observer actions remain available.

The source list is explicitly partial. Missing decision/motor sources are not proof of global actor settlement, and there is no Native registry, global watermark, rule consumption, scoring, or PlayEnd claim. Pending scheduled capture/transfer and unresolved physical contact retain their existing exclusion. Continuing independently timed commands inside capture/transfer requires a separately versioned piecewise owner extension preserving original capture/transfer/RNG evidence. This action does not provide that extension, a runner policy, relative reach, a second position loop, or team assignments.

## Verification

Final source-frozen verification on Node 26.10.0 / npm 11.9.0 completed on 2026-10-04:

- `npm run typecheck`: exit 0
- Main focused gate: 27 files / 145 tests, exit 0, 2,636.69 seconds with two workers. This includes the adoption lifecycle/contact/WAL/live-work/manifest tests, both causal-rank and known-work helpers, and legacy checkpoint, field-execution, observation, kinematics, scheduled-history and original-archive compatibility regressions
- Separate same-source gate: `npm test -- src/host/world/OwnedBattedWorldMotionMultiPlayer.test.ts src/core/sim/ball/BattedWorldFieldMotionCheckpoint.test.ts --maxWorkers=1 --minWorkers=1`: 2 files / 13 tests, exit 0, 1,309.85 seconds
- All 1,807 tracked file hashes remained unchanged throughout both gates. The verified `src` tree is `fd9fb503d9bd94f103566cf7b964bccfb8d69cba`; only this verification record changed afterward
- Independent review reproduced and then cleared hidden nested-field/predecessor ownership claims, omitted due-decision handoffs, and the resolved-contact false blocker. Four independent Native regression tests, three projection tests, and reviewer typecheck passed

These are focused results, not a whole-suite result for this slice. Cumulative whole verification remains a separate integration responsibility. No prior stack's whole-suite success is asserted for this source.
