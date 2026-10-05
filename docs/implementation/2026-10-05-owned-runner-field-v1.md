# Owned runner field continuation v1 implementation plan

**Goal:** Execute the original pre-pitch runner's already accepted motion through the existing physical field owner, with eleven active Player/Person identities and fifty-five body parts.

**Architecture:** Add tagged Sources to the existing original-touch, response and field tables. Authenticate the original pitch/controller and use the existing field collision kernel. The runner is retained from its original controller; the caller still commands only the original batter and nine defenders.

**Tech stack:** TypeScript, existing deterministic Core, node:sqlite, Vitest. No dependency, schema-owner, workflow or UI change.

**Spec:** [Approved remaining plan §5](../project-status/2026-10-04-nonvisual-implementation-checkpoint.md), [recovery priority 3](../project-status/2026-10-04-nonvisual-recovery-checkpoint.md), runtime contract 06 §§2–4/7 and architecture 05 §3.3. Foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`; Realism `4f0a60a3818926327b6bf5877ab3dec456a76530`. Implementation base `44b0401cf6f22aa154dbd2e420851652f41a28ef`.

## Constraints

- Keep this change isolated from the physical-end → official/workload/next-pitch integration and its fixed verification sources.
- Observe the intended failing tests before changing production code.
- Preserve legacy no-runner Source/snapshot bytes and all existing ownership/seal/currentness/WAL fences.
- No guessed coefficients, additional simulation engine, autonomous-motion claim, UI/design work, draft32 implementation, home-PC CI, merge or deployment.
- This version supports one original upright runner on one straight route, inside the analytic segment containing original contact. It cannot cross that segment's end or extend the accepted coverage.
- Existing `ActualLivePlayScope`, End, runtime, original ten-player motor composition, general kinematics, field execution, whole-play and rule consumers remain unsupported for this branch.

## Review focus

1. A sub-tick collision must not use its rounded tick to cross a runner acceleration boundary; test actual elapsed coverage and a noninteger boundary.
2. Replaying a source-derived runner must not drop any of its five parts or add an eleventh caller command; test exact participant/role membership and rejected overrides.
3. Opening the response root must not silently open territory, old continuation or custody; test each public consumer fence.
4. A later malformed payload must not invalidate an earlier historical cut, while corrupt sequence/head metadata must; test bounded replays separately.
5. A failed field append must roll back row/head state and preserve original runner binding; test a same-transaction trigger and reopen/retry.

## Task 1: explicit field calibration root

Files: modify `src/host/world/SqliteBattedFirstFielderTouchStore.ts`, `SqliteBattedContactResponseStore.ts`; create `OwnedRunnerFieldRoot.ts`. Tests: `OwnedRunnerFieldRoot.test.ts`, shared `OwnedRunnerFieldFixtures.test-support.ts`.

Interface: accepted touch and response Sources gain an additive tagged form `{ kind: 'owned_runner_field_root_v1', prePitchRunnerSourceId: string, ...legacyFields }`. Untagged Sources retain exact legacy shape and rejection behavior. `assertOwnedRunnerFieldRoot(world: DurableBattedWorldContact): void` authenticates `battedWorldOriginalContactPrefix`, zero search duration, null original contact predecessor, and unchanged airborne original ball. Tagged response must name the tagged touch and same runner Source. The existing first-touch/response kernels produce the actual zero-horizon results; never fabricate them.

- [ ] Author positive tagged zero-root touch/response tests and missing/wrong-owner, progressed-root, untagged and mismatched-profile regressions.
- [ ] Run the focused tests and confirm that the positive cases fail at the current explicit runner guard; fix test setup errors before production edits.
- [ ] Implement the narrow source forms and root validator. Keep `assertSupportedBattedWorldConsumer` unchanged.
- [ ] Verify positives and adversarial cases, then commit the coherent root change.

## Task 2: original runner curves in the field owner

Files: modify `SqliteBattedWorldFieldStore.ts`; create `OwnedRunnerFieldMotion.ts`. Tests: `OwnedRunnerFieldMotion.test.ts`, the shared source fixture.

Interface: accepted field action gains `{ kind: 'owned_runner_field_v1', prePitchRunnerSourceId: string, ...legacyFields }`. The ten `commands` remain unchanged. `deriveOwnedRunnerFieldMotion(source: AcceptedBattedWorldFieldAction, root: { response: DurableBattedContactResponse; geometry: DurableBattedWorldFieldGeometry }, previous: DurableBattedWorldFieldAction | null): BattedWorldFieldMotion` validates the versioned root and composes the runner's retained five source-derived acceleration inputs with the ten accepted commands, then calls the existing `deriveInitialBattedWorldFieldMotion` or `deriveBattedWorldFieldMotion`.

The runner's body/relative motion is derived from its frozen `RunnerLocomotionController`, original pose and actual predecessor. No accepted runner command, motor receipt, World reset or additional controller is manufactured. Authenticate prior runner curves and all original identities before execution. Keep response-profile filtering against the original active actor set: registered inactive players can remain in the calibration model, but the field receives exactly the active fifty-five profiles. Do not normalize the canonical root using primitive cleanup. Every requested endpoint must lie within the original contact's analytic segment and `coverageThroughTick`; compare exact elapsed time against original World time, not only `ball.tick`. Resume from a genuine fractional collision/rebound cursor and test position/velocity continuity at that exact time.

- [ ] Author a moving-runner collision and stationary counterfactual, two-field-action continuation, five-part evolution, route/coverage/boundary and command-override tests.
- [ ] Observe the intended failing cases before production work.
- [ ] Implement the tagged branch through existing field tables, root, row/hash/predecessor validation and collision kernel. Legacy branch statements and serialization remain unchanged.
- [ ] Verify each source case, currentness checks and fixed legacy hashes, then commit.

## Task 3: preserve unsupported consumers and transaction ownership

Files: modify `BattedWorldFieldTerritoryFromPrefix.ts` to reject runner field interpretation explicitly and `SqliteBattedPostResponseFlightStore.ts` to reject the runner branch in both archive reads and fresh derivation. Leave generic continuation/motion/acquisition, `BattedWorldFieldPhysicalPrefix`, field execution, Scope/End and general kinematics closed. Tests: `OwnedRunnerFieldBoundary.test.ts`, `OwnedRunnerFieldNative.test.ts` and its test-only fixture.

The existing Core may report a physical runner-body rebound or glove candidate. Neither is legal interference, possession, catch or an official result. No runner legal policy is supplied in this slice. Field `read` returns physical evidence; `interpret` rejects this unsupported participation. Existing first-base physical/official/workload work stays independent.

- [ ] Author explicit downstream rejection tests using complete genuine Core field evidence, so failures cannot be incidental missing geometry errors.
- [ ] Author one Native legal walk → next batter → prospectively owned runner pitch → zero-root → two field actions case. Reuse one fixture and saved values for related assertions; do not reconstruct the whole legal chain once per failure mutation.
- [ ] Test reopen/idempotent retry, rejected stale append, bound historical read versus corrupt future metadata, and trigger rollback of action/head/binding. Keep official Match/revision unchanged.
- [ ] Observe the intended Native failure before changing persistence code. Rerun affected failures and the final fixed-source acceptance.
- [ ] Review independently, run focused tests, typecheck and the appropriate full suite, and record each actual terminal result. Do not transfer prior source counts.

## Planned verification and resource limits

The first pre-implementation RED batch ran on source `25bcca61faa4b6aeb7bb91d5e1757bc141c44973` on 2026-10-05 at 05:59 UTC: three source/boundary files, 37 cases, 25 passed and 12 failed for the intended missing capability/fence behavior. No fixture/setup failure or skipped case occurred. This establishes the initial RED; subsequent implementation verification is recorded below.

The batch used one worker, requested 1024 MiB old-space and verified a 1120 MiB actual heap limit in every Node process, including workers. The full guarded operation took 6.70 seconds with a sampled aggregate peak of 419,004 KiB. All 2,107 source hashes and control hashes remained unchanged; all child processes were reaped. These tests use small SQLite fixtures without reconstructing the legal producer chain. Ensure that the required catalog is available before invoking Vitest directly; `npm test` also runs catalog compilation.

Native: one new test with one legal producer fixture and one worker. The proposed initial budget is **1120 MiB for the actual test-isolate heap and 1536 MiB aggregate process memory**, including the parent process and worker. A parent Node command-line flag alone does not establish the test isolate's heap limit or the aggregate ceiling. Record the effective isolate limit and measured peak aggregate memory. Runtime and memory use are unmeasured; use the existing fixture's 180-second timeout initially, and diagnose exhaustion before proposing a larger measured budget. No home-PC CI execution is included.

The new Native fixture selects the registered `npb-2026` profile through the explicit initial-fixture option introduced in `b55d10a`. Selection occurs before creating the original Match; existing fixture defaults remain unchanged. No saved database is rewritten and no profile alias is introduced. The Native test asserts the profile on both the original Match and the physical pitch frame.

Before completion, require typecheck and focused tests on the exact final source, original legacy byte regressions, appropriate cumulative verification, and fresh review. Record commands, effective resource limits, source identities and terminal results separately for each verification stage.

### Prepared test checkpoint

Authored: 13 root-admission cases, 14 field-motion/replay cases, 11 explicit consumer-boundary cases, and one Native case (39 total). The original 37 small cases ran before implementation: two positive root admissions and seven positive field/coverage cases failed at the existing explicit runner guards; three territory/post-response read/admission cases failed because the required rejection did not occur. The additional review regression has now produced its intended RED on `12b58bb`; Native remains unrun.

The preparation changed this document, four `OwnedRunnerField*.test.ts` files, and two `OwnedRunnerField*Fixtures.test-support.ts` files. Independent source review added exact fractional-cursor continuation, inactive-profile filtering and explicit acquisition/post-response fences. Production implementation began only after the intended RED was observed. Later verification is recorded in the follow-up below; Native and cumulative acceptance remain outstanding.

Independent review of implementation `49a3b38` identified two issues. The actor array now has an explicit `BallWorldMotionActor[]` type so the optional continuous start offset survives union inference; compiler confirmation is pending. The numerical regression on `12b58bb` ran at 07:17 UTC: 14 cases, 13 passed and one intended failure, `invalid accepted batted motion interval`, at the same-rounded-tick continuation. No case was skipped. The guarded operation took 6.722 seconds with a sampled aggregate peak of 422,312 KiB and verified 1120 MiB heaps; all 2,109 source hashes/control hashes stayed unchanged and all children were reaped.

After that RED was observed, the independently reviewed repair replaced only the tagged continuation call with the existing exact-coverage field checkpoint executor. Coverage and executed endpoint both remain the accepted Source tick. Untagged legacy and tagged initial execution are unchanged; tagged contact-free endpoints become exactly normalized, while collision occurrences remain untouched. The repair itself did not change tests. Its subsequent verification and test-only compiler correction are recorded below. No other concrete authentication, active-profile, ownership/replay or consumer-fence issue was found by the static reviews.

### Focused GREEN and compiler follow-up

Source `aec06e0953a97431f3ed37a207c9be4e19b48675` passed the seven-file focused/legacy batch: 66/66 cases, no skips, 11.286 seconds and a sampled 427,552 KiB aggregate peak, with actual 1120 MiB heaps. Source/control hashes remained unchanged and processes were reaped. This includes the reviewed final-covered-tick regression, legacy contact snapshot hashes and existing runner/field Core boundaries.

The full compiler on that same source failed with one TS2345 at `ActualPlayerKinematicsFromPrefix.test.ts:152`. Its legacy Source map was correctly narrowed to the untagged form, but the test spread the wider saved field Source union into it. The correction checks the actual saved Source's `kind` before creating the second legacy action; it introduces no cast and does not weaken the production union. The failed compiler receipt remains a failure: 32.351 seconds, 1,355,808 KiB sampled aggregate peak, actual 1504 MiB heap, no resource guard trip. Corrected compiler, the affected existing eight-case file and Native acceptance remain unrun. The 66-case pass belongs to `aec06e0`; it is not relabeled as a pass on later source.

The focused command, with the test-isolate memory limit independently checked, is:

```sh
NODE_OPTIONS=--max-old-space-size=1024 node node_modules/vitest/vitest.mjs run src/host/world/OwnedRunnerFieldRoot.test.ts src/host/world/OwnedRunnerFieldMotion.test.ts src/host/world/OwnedRunnerFieldBoundary.test.ts --maxWorkers=1 --minWorkers=1
```

Read each terminal result and distinguish implementation failures from fixture/import/type/setup errors. Preserve source `25bcca6` as the pre-implementation baseline for additional legacy response/field archive comparisons; retain the existing `OriginalContactLegacyBytes.test.ts` hashes. Source-local implementation is not acceptance evidence.

## Explicit remaining work

This slice is accepted-input execution, not autonomous running. Remaining work includes piecewise progression across real controller boundaries; versioned exact-state rebase and renewed commands; free/curved routes, slides and player contacts; general runner self-state, observation/decision/motor generation; multiple runners; base relation/force/retouch/interference policy; custody and throw continuation with all actors; runtime producer/consumer coverage; genuine multi-actor PlayEnd/official closure; workload and next-play adoption. The original ten-player physical-end integration is not modified by this plan.
