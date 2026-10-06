# Native batting model/stance: held test-only contract

Base: `cc268e71f2a2d207de9ffcb66a00668ec84d784c`. This separate cut does not modify that frozen integration. Approved scope is the first model/stance cut of [the existing Native batting plan](../superpowers/plans/2026-10-05-native-batting-connection.md), within [nonvisual checkpoint §5.7–8](2026-10-04-nonvisual-implementation-checkpoint.md).

**All new tests are UNRUN and uncompiled.** Body source `1766ece3c8e66b443d617a8eab30e94ca98c8807` is an independently source-reviewed, unrun prerequisite, carried by the base. This contract is held until the combined body gate passes and the parent releases runtime ownership. No production code, compiler/catalog execution, Node, tests, SQLite opening, runtime lock, workflow, home CI or remote publication occurs in this preparation. No observed RED/GREEN, runtime PASS or live batting completion is claimed.

## Source inventory

| File | Static case count | Boundary |
|---|---:|---|
| `PlayerBattingModelNative.test.ts` | 30 | One real registered-body prerequisite, plus exact model acceptance, two actual Persons, missing/foreign/future input rejection, positive accepted latency, original-byte reopen, immutable retry, later applicable selection, mirror integrity and trigger rollback |
| `BattingStanceNative.test.ts` | 23 | Exact prospective actor/body/model stance, offline read/retry, scope/origin/day/start rejection, aliases, current admission versus historical read/retry, stale model selection, changed Source/moved mirror and atomic actor-deletion rollback |
| `NativeBattingModelStanceFixtures.test-support.ts` | — | Test-only proposed narrow owner contracts and real fixture construction; no producer implementation |

The ten Core preservation cases and four legacy Native compatibility cases from original contract `d9db9536189f2ecd6405423ab021ce7329043594` were carried forward **byte-for-byte**. They remain separate preservation evidence. This reviewed source cut has 53 newly authored cases, 14 preserved cases, 67 total source cases; these are inventory counts, not execution results.

The frozen original contract `c1989ad82de6d30d95ac9f743ec0ef20353b8c81` is preserved unchanged. A separate source-only follow-on addresses two review findings: preservation snapshots now include Match/fixture/season/actor-game rows, and ten targeted cases independently corrupt SQL scope/day/version or source/snapshot mirrors, recalculating changed JSON hashes. These are test-coverage corrections, not observed runtime failures or production changes.

## Fixture and API contract

The fixture accepts the existing `physicalPlateAppearanceActorFixture` actor for registered `away-1/person-away-1/intake-away-1`, game `game-1`, actual game day 10. It uses that database's existing body materialization owner with independently accepted test body/pose/reach Sources, `role:'batter'`, and null fielding/release pins. It asserts the nested `receipt.source/body/pose/reachCalibration/person` and absence of physical pitch rows **before** accessing the proposed batting opener. A second model uses the same fixture's actual registered `away-2` intake/body, rather than a synthetic foreign Person receipt.

The new model and stance factories are proposed facade exports on the already loaded `PlayerMaterializationRuntime`: `openSqlitePlayerBattingModelStore` and `openSqliteBattingStanceStore`. Their missing-function assertion gives a named capability diagnostic after successful body construction. This avoids an unresolved import of an unimplemented module. The test-only types specify `.accept/.read`, model `.selectAtDay`, exact immutable accepted parameters and returned original evidence. Proposed archive tables are `world_player_batting_models` and `world_batting_stances`; tests inspect their source/snapshot bytes and hashes and real dependency rows during rollback.

Model inputs independently pin capability, repertoire, decision, equipment, sensor calibration/delivery latency and observer-known prediction priors. They contain no observed sample, predicted trajectory, current emotion or completed swing. All numbers are explicit, labelled synthetic test inputs, never population defaults. Stance freezes accepted center-of-mass/eye coordinates, readiness and validity at the original initial-World tick. It does not infer an earlier body from a legacy swing or create an observation. This first bounded fixture covers initial World only; activation-origin handling stays a later explicit extension.

Historical model/stance read and same-source retry retain original evidence after legitimate newer applicable models or later legacy execution. New stance writes require the actual current pre-pitch actor and current applicable model. Source-only stance acceptance does not reserve a staged physical-pitch producer or execute a pitch; the plan's later prospective-release cut still owns symmetric staged/legacy admission fencing.

## Smallest eligible runtime sequence

1. Wait for the exact combined body-source gate to pass and for the parent's runtime release. A running or unchanged gate is not permission to start these tests.
2. Arrange the repository's parent-approved compiler/catalog/test inputs, then run the unchanged 14 preservation cases on this exact cut. Failures remain baseline/setup failures, not new-owner RED.
3. Run only `PlayerBattingModelNative.test.ts` filtered to `constructs the genuine registered batter body prerequisite`. This must establish real SQLite body construction first. If it fails, investigate that prerequisite; do not implement batting production to conceal it.
4. Run the model test filtered to `accepts the original Person-bound batting model`. Current source is expected to reach `BATTING_MODEL_OWNER_MISSING` (`undefined` versus `function`) **after** the body assertions. Record the observed failure and its cause. Compiler/import/body setup errors do not establish this RED. The later semantic assertion requires a real accepted/replayable model with exact original parameters and unchanged owner rows; factory existence alone cannot make the test green.
5. Implement only that owner after the relevant observed RED; qualify the model's complete focused contract and legacy preservation. Then run the first stance-positive case after model construction passes. Its distinct `BATTING_STANCE_OWNER_MISSING` diagnostic must follow successful body and model acceptance. Implement stance only after that observed RED, then qualify the remaining stance ownership/rollback cases.

Use the existing isolated Vitest form with `--maxWorkers=1 --minWorkers=1`; focused name filters are diagnostic stages, never a full source qualification. Required whole/archive checks and the final exact-source acceptance remain parent-owned. No new supervision framework is introduced.

This cut stops at accepted model/stance ownership. Prospective release, reached imperfect sensing, observer-only prediction, actual owned emotion execution, motor commitment and exact due-event adoption remain the plan's later cuts. Their absence cannot be filled by supplied prediction results, a neutral emotion fixture or the legacy caller-authored `BatterSwingWindow`.
