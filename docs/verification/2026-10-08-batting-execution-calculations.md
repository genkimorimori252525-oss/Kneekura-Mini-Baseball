# Pure batting execution calculations

The accepted first-dispatch dependency now has explicit Core calculation seams for batting observation, decision, motor and repertoire values. The implementation is at `88b2878e52e22386fb9782c5ce4823425cdf8d7a`, source tree `4a409152628b35dceff7a412338e248a6ac2a513`, based on `1a9c73220fc29dbc433a6ae3a9625e03979ca0a3`.

`calculateBattingExecution` preserves the complete nominal request and supplies the independently explicit effective values as separate arguments to the existing decision, profile-selection, swing-planning, motor-timing and speed-envelope calculations. It never constructs an altered nominal v1 Source. Existing `prepareBattingExecution` retains its result shape and the same shared calculation. Core prediction availability, actual-flight separation, equipment, pose, motor-window and curve validation remain in force.

`calculateBattingObservation` composes existing refresh, geometry, occlusion, quality, capture and memory calculations. It receives the original explicit attention target, one sampled sensory instant, physical clock, deterministic seed and delivery cut. Positive effective latency changes actual information availability; no delivered memory exists before that cut. It creates neither a pitch prediction nor a swing score. Native ownership, original-intent and per-pitch geometry authentication remain prerequisites outside these pure functions.

## Bounded source verification

All values are explicit synthetic fixtures, with no production fatigue-calibration claim. Twelve new cases establish actual output changes for decision threshold/aggression weight, motor latency/technical phase, speed-envelope rejection, swing curve, sensory capture/refresh/decay and delivery. They also establish nominal-input immutability, legacy calculation equivalence, exact effective-value domains, original attention, nondetection, chronology, no nominal fallback and finite-output rejection.

The final compatibility gate passed all 118 existing Core cases across seven files: BattingCommitment (23), BattingTiming (17), BattingAcceptance (13), BattingIntegrity (30), BattingNativeConnectionPrerequisites (10), BattingResolution (16), and BattingEventAdoption (9). The full root TypeScript compiler passed separately. This is bounded affected coverage, not a whole-repository test run.

| Qualified stage | Result | Terminal SHA-256 |
| --- | --- | --- |
| Initial seam RED | 10 expected assertion failures, exact missing-function markers | `e13bcfb34a1efd135b65db759bcd0ff1e4d51d86d2ff21bf20fbbe08a6cb1b02` |
| Initial seam GREEN | 10 passed | `3034a1293a828bcfabdc204d540a94af25cf30490fea80ffac70de3a399033cd` |
| Explicit attention/domain RED | 10 passed, 2 expected assertion failures | `b971921e9fcf32b94a811d0fe450e00172c8b4af40627b7c61feeab5929b4b92` |
| Final calculation GREEN | 12 passed | `642da91de9f65d9feded2b9383e036de2acb505bf60e67dda0d9e240c2b4c723` |
| Affected Core compatibility | 118 passed, 7 files | `17907a1476f35218ffb90cf88af7fe8ae1ee8b08c8df7f7a7883c589692f381f` |
| Full root TypeScript | Exit 0 | `02a09d0839bad9699e734697092dfdc43ebe68c5adfbf6c593cf57b25581633c` |

An earlier initial RED attempt observed the same ten failures but its control request omitted mandatory exact failure markers. Its supervisor rejected qualification; terminal `9882ef1b5b2e3d15abab1ef849124976b8d5efb57034192c086b879c282eed6b` is retained and receives no gate credit. The fresh marked RED above closed that control defect before implementation.

Each stage used a fresh capped supervisor, pinned source/dependencies/controls/runtime, the existing dependency symlink, inherited shared locks, Node 26.10.0, before/after identity checks, process ownership and reaping, and immediate admission plus continuous 4 GiB available-memory reserve. Tests used the 768/864/1536 MiB heap/measured-heap/RSS envelope and 180 seconds; the compiler used 1664/1760/2304 MiB and 180 seconds. Final test peak RSS was 279680 KiB, compatibility 283972 KiB and compiler 1664880 KiB. Qualified stages had zero pin changes, unhandled/suite errors, skipped cases or remaining owned processes.

The isolated shared-object sparse checkout omitted only unused tracked `artifacts/`. All fifteen catalog compiler/data inputs matched the existing qualified source before the unchanged ignored generated catalog was copied; the generator was not run. All eighteen protected files, including stance v1 and `SqliteActualLocomotionStore.ts`, retain their original Git blob identities.

No genuine database was opened or copied. No Native adapter, first-pitch append, public dispatch registration, all-ten execution claim, private remote publication, merge or deployment is included. The next dependency remains Native adapter authentication and invocation accounting for every required route, followed by the separately authorized atomic TAKE append/replay.
