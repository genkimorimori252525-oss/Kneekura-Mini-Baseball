# Actual batted World continuation — integrated execution status

Base is PR247 exact6f9d893d24697151ddeb7f603002ca52eed6224f, independently verified P0 run37055766746 completed/success. Current design refs remain Foundation44b9f5de7b9d87e649f12f1af78c202f2b5ab44d and Realism4f0a60a3818926327b6bf5877ab3dec456a76530. The original recovered local implementation is preserved in recovery commit784edc846759d7914afff13f031a40e4a6d3298a; the earlier recovery status is historical evidence, not validation of this integration.

## Integrated Source

- Preserve the published post-response flight projection and its Native prefix. Add actual post-response World continuation, including all original moving actor primitives, finite-panel contacts, true continuous time, actual departure/re-entry, persistent constraints, ground/bounce/rolling/resting phases and response ownership.
- Preserve the published legacy tick sphere numeric-limit fix. The new continuous API owns its separate coefficient/root tolerances and refinement.
- The shared original-response reader validates saved downstream evidence on its own SQLite connection. Fresh response insertion validates actual touch/model evidence before the response exists, then re-reads the full saved response after insertion. Published projection and actual World owners both use this reader without weakening original/history/current fences.
- Add a Native shared-response regression and prove a corrupted projection archive cannot substitute for actual World-contact proof. Both owners preserve their distinct immutable histories and retries.
- Retention results remain capture candidates; no possession, rules outcome, official/scoring/workload closure or UI/Presentation connection is written.

## Verification

- Initial integration typecheck GREEN.
- Related Core/Native/WAL for both owners:12files164tests GREEN,334.38seconds.
- One fresh readonly reviewer reproduced a P3 continuous-root defect: acceleration-2/horizon1e30 missed contact1second, and acceleration-2e60/horizon1 missed contact1e-30seconds. Both were tracked RED (21tests/2failed). New-only bisection now terminates at adjacent floating-point times rather than a fixed80 budget. Legacy helper iteration semantics remain unchanged.
- After refinement, Core/legacy and new Native integration:7files78tests GREEN,7.85seconds. Relative-time assertions check the tiny contact as a ratio rather than an absolute tolerance that could admit zero/null.
- Final typecheck GREEN. The same fresh reviewer independently reran outside-repository reproductions/coexistence checks:2files6tests GREEN; P3 resolved, no further concrete findings.
- Frozen whole `npm run verify -- -- --maxWorkers=2 --minWorkers=1` on87a31a5171a0a9c58a398d42c4077a2fb88a3983 completed2026-10-03T06:23:04Z with actual exit0:582files3596tests GREEN,4445.31seconds. Source572files3569tests; untracked scratch10files27tests. All13 changed Source/test hashes match. Process-local TEMP/TMP was on K:. The subsequent status-only commit preserves the verified Source tree; this is integration validation, not completion of the remaining full goal.

## Remaining full goal

Actual uninterrupted acquisition, later accepted motion/controller coverage, rolling pickup/transfer/throw/reception/base/running, owned foul/next-pitch/between-pitch World replay, official/scoring/actual-role workload closure and other confirmed nonvisual Source generation/integration remain required. No PR merge or unapproved design revival is authorized by this status.
