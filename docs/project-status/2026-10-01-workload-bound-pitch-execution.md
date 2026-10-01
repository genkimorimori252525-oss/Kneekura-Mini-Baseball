# Workload-bound physical pitch execution — 2026-10-01

## Approved scope

Current foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`, documents14/32/53/55. Realism `a39951526e1e541c457d8616dcebe474847e1225` adds only visual assets relative to the previous frozen source; nonvisual contracts are unchanged. User-authorized nonvisual implementation; no design/Presentation, obsolete plan or merge.

## Implementation

- Existing global workload storage selects an exact historical revision only after validating the whole accepted baseline/activity/head chain. Missing/future revisions and corrupted history fail. Baseline and original fatigue states remain available after later recovery and offline reopening.
- Core derives temporary normal-motion/follow-through durations and release velocity/spin from actual fatigue and independently accepted explicit continuous response calibration. Fresh fatigue preserves the original execution; integer duration overflow and invalid/future policy or malformed physics are rejected. Long-term ability, body, release coordinates, timing variation budget and classification history stay with their existing owners.
- A Native calibration owner freezes policy Source/version and contents, detects changed live facts, stored corruption and same-version conflicts, and rolls back late altered/failed writes. Original reads/retries work without live policy authority. No implicit production numerical defaults are introduced.
- A new Host entry point pins actual workload revision and accepted policy Source, reads actual Native timing/release histories and delegates canonical delivery/trajectory/take/swing to the existing Core. Serializable requests contain a match seed reference instead of a SeedRoot object; no caller fatigue field is accepted. The result includes detached workload/policy provenance, and execution does not apply activity or change the global workload head.

## Verification

Separate missing Core/selector, Native policy owner and Host runtime RED were captured. Parent related 7 files /22 tests passed in1.33s; typecheck/catalog compilation passed after correcting a test-only closure narrowing error.

Actual Native integration generates MATCH activity from the accepted three-physical-pitch official play of PR236, applies it to the global workload owner, and uses the resulting historical fatigue in the next physical pitch. Explicit fixture calibration changes motion duration, velocity/spin and actual plate arrival time. Recovery changes future execution; the original request reproduces its original pitch after recovery and after reopening all histories without live authority. The timing/release heads and workload revision remain unchanged by execution. Numerical calibration values are synthetic verification inputs, not production defaults.

One fresh reviewer found an Important valid provenance rewrite after COMMIT: changing both stored SourceVersion fields bypassed their mutual comparison. Parent captured corrective RED, added a SHA256 digest of the entire original canonical accepted policy and verifies it during reads/retries, while preserving the original detached acceptance guard. Parent affected 7 files /23 tests passed in1.34s and typecheck/catalog compilation passed. The same reviewer confirmed the finding resolved with no additional findings; independent 2 files /5 tests passed.

Whole `npm run verify` passed 535 files /3,165 tests in636.34s, including typecheck/catalog compilation and actual Native regional/WBC/World population gates. Publication and exact-SHA P0 follow.

## Remaining overall goal

Initial pregame evidence, workload within a play, other action/travel/rest Sources, evolving recovery/health/injury and complete autonomous Career/Match orchestration remain active. Nominal physical inputs and response calibration require independently accepted content; this slice does not fabricate production balance or a full autonomous game.
