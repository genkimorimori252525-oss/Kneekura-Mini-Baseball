# Continuous actual foot/base contact — execution status

Authority: approved Foundation44b9f5de7b9d87e649f12f1af78c202f2b5ab44d and Realism4f0a60a3818926327b6bf5877ab3dec456a76530. Baseba0d4a11cea21235c228ad398d7a068bed126313. This is an additive physical contact dependency; Presentation remains disconnected.

## Source implementation

- Expose the existing rotated base/top-height foot center point solver in continuous seconds. Its existing Tick entrypoint delegates to the same solver and quantizes the final contact once. Preserve the established foot point approximation and normal outputs.
- Add a BallWorld actor adapter using the original integer clock and true primitive start offset. Return contact identity, continuous elapsed time and recorded tick; do not accept or derive caller possession, OUT/SAFE or game closure.
- Reject invalid coverage and unrepresentable projected geometry. Keep the full original coverage check before reconciling equivalent global/local clock arithmetic.

## Verification

- Missing-entrypoint/module tracked RED preceded implementation.
- One fresh readonly reviewer found a valid original endpoint whose global-to-local subtraction exceeded the duration by one ULP. Four tracked regressions reproduced RED, including instantaneous endpoint searches at short and two-second intervals.
- The fix bounds both converted query endpoints by the duration computed from the integer tick difference after validating original coverage. No tolerance or coverage extension is introduced. The same reviewer confirmed its independent reproduction now exits0, with no additional concrete P1/P2 finding.
- Final related Core gate:8files70tests GREEN,1.17seconds, exit0. Existing foot/controlled-base/throw-reception/runner-evidence/World motion/exact-time regressions included. Final TypeScript typecheck:exit0.
- This dependency and its actual Native fixture geometry/secured contact connection passed frozen whole gate60151:593files3832tests GREEN,6110.71seconds, exit0, ended2026-10-03T11:21:09.2124544Z. Verified commit21f1fe245438c42ecbfec1c81f96457b570991d8;24Source hashes unchanged. Subsequent parent documentation merge preserves Source treeaf221142a158d892f12ce09c10adc44872d0ec43.

## Remaining full goal

Own accepted actual venue/base geometry now consumes this contact for actual secured Native observation; full running history and adjudication remain separate dependencies. Actual reception, runner execution, foul/next-pitch/between-pitch continuation, official/scoring/actual-role workload and the other current approved nonvisual tasks remain required. This dependency does not claim full implementation. Active whole gates, review artifacts and dependency storage remain protected.
