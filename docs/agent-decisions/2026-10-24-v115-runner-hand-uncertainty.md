# V115 — preserve uncertified hand transitions in runner defense estimates

- Recorded: 2026-10-24T04:48:41.864128+09:00
- Task: `MB-20261024-V115` (original investigation receipts remain `MB-20261024-V114`; V114 is separately used by the portrait UI task).
- Scope: `LiveDefenseControlEstimateV95.ts`, its focused unit test, and `LiveRunnerObservationReviewV95.test.ts`. No raw fixture, public ability, SI capacity, park, actual Source, charge, global safety margin or physical guard changes.
- Authorization: parent delegated the three files and explicitly approved a minimal C1 uncertainty fix plus causality-based replacement of the incompatible legacy base2 assertions. Parent then approved preserving a separately supported later home decision rather than forcing an observed final base.

## Decision and technical basis

A normal hand's C1 preparation can be uncertified while the actor has glove-toss eligibility. Eligibility alone is not proof that an executable alternative exists. For the deep RF legacy observer snapshot, ordinary hand preparation failed and the glove alternative was out of range. The transfer planner returned `NORMAL_HAND_PREPARATION_UNAVAILABLE_V110`; the aerodynamic inverse solver was never called. Nevertheless the estimator classified the attempt as an aerodynamic failure, recorded no hand failure, and certified a slow carry as the only return. This incorrectly justified rolling second-to-home.

The change retains the ordinary preparation failure if the actual transfer alternative is also unplanned. Existing `uncertifiedCarry` handling then returns unknown/null. A genuinely planned short glove alternative remains executable. No C1/range/speed bound is relaxed. Cached unknown results retain that uncertainty when aged.

Alternatives rejected: raw ability changes; uniform safety-margin increases; free overlap/removal of V103 charge; forcing every runner to stay at second; treating an observed final outcome as the new expectation without examining the modeled race.

## Why legacy base2 assertions change

With the current authored V103 model, the two RF→SS→3B estimates include per-leg transfer and charge. Deep defense is5.643132592s and middle5.363294982s against runner4.648897137s, margins.994235455/.714397845 > authored.35. Rotation/posture is absent in these body-model-less fixtures; hand preparation is absorbed inside transfer; receiver waiting is zero. A broader diagnostic relay shortlist does not close the margin. The initial third-base departure is supported by the existing model and causal observation cutoff.

The minimal source fix removes deep's unsupported2→home extension at5.317911. It does not guarantee a final stop at third: after actually touching third, the runner makes a separate decision at10.091408 with a newly observed finite relay estimate5.061922969s versus runner4.648897137s, margin.413025832 >.35. Therefore a blanket prohibition on all home motion would contradict the same retained physical/tactical model. The test now requires the C1-uncertain window to block extension, an actual third touch before any home departure, a separate finite safe-race decision with causal cutoff, and actual touches3/4 for any score. It does not merely accept any base>=2.

## Evidence retained

- Original frozen V111 / current-equivalent legacy failures: V113 evidence remains untouched (`legacy-runner-baseline-1`).
- Two actual-field V114 diagnostic runs: `MB-20261024-V114_c5455c1586784c4aa5d517a9ab1c0ce0`.
- Pure snapshot contrasts and exact failure reasons: `MB-20261024-V114_668bfb9c75394725a6cc5153e21f0099`, `MB-20261024-V114_9d637c74517243fe91fa071ae702e444`.
- RED: `MB-20261024-V114_2cdb96d2d82149fb822fd25829f00d97` — long-range glove eligibility incorrectly returned carry13.643s; short genuine glove feed passed.
- Intermediate expectation failures retained: `MB-20261024-V115_5d431e61b0e340dfae66579a1ec3590a`, `MB-20261024-V115_156257cfa6b14f368ac1b0b45d329b5b`.
- Full estimator unit GREEN: `MB-20261024-V115_d568baf5272b4d2bb62900a331ce21e5` —11 tests.
- Final focused field GREEN: `MB-20261024-V115_196fc150079947d087d29c637b0af28e` —4 tests (two actual legacy fixtures and two glove regressions),30.250s. Input/source SHA before and after are asserted and emitted by the two fixture checks. Readback is stored in `docs/verification/releases/v115/runner-c1-final.json`.

## Impact, limits and recovery

This correction changes observer uncertainty, not real custody, ball flight or adjudication. Other bounded inverse failures are not a global proof of unreachable defense; broader uncertainty semantics remain outside this narrow correction. The common V103 model still determines the timing and may be revisited by the separate action-controller task. Restore only these three scoped diffs to undo, preserving all raw inputs, receipts, diagnostics and unrelated shared work. No deployment/merge/push is part of this delegation.

## Final readback and freeze

Deep: actual third touch9.846808447s precedes separate home decision10.091408242s; that decision has finite margin.413025832. Actual home touch14.740305379s precedes the scored final state. The old C1-gap2→home extension is absent. Middle: actual third touch9.656340119s, no home commitment, final third. Both checks enforce reaction cutoffs and unknown-forecast holds.

Input JSON SHA deep `03b893ca38dec9664a7986305844d3bb060f1dc5cd3fac1dd62ddb7eda8a0add` and middle `287aa81463c0f9686232390a166e015e9a22f7f4e5f616532a6ab8e5397a7830` remained identical before/after. Raw fixture bytes remained unchanged (deep `21eac7754c9fa5c000b2a8f9b31adb4fc37cc2fbece0bd41f9c48fbef02729e3`; middle `957f29b964901819b6c5fcb1d233cbfd8e47090f12e918e70e963f7aede8ef63`).

Owned three files frozen before the new action integration. Full estimator11-test unit suite and the final four focused checks passed under pinned Node24. No full type/build/broad suite is claimed here; root owns subsequent integration and those checks. No Git staging/commit/rollback was performed by this helper.
