# Retained original runner field pieces

## Goal and existing authority

Execute the remaining analytic pieces of an already accepted original runner controller through the existing free-ball field owner. Preserve the complete executed body history and exact endpoint kinematics for all eleven Player/Person identities and fifty-five parts. This connects the piecewise-progression gap in [remaining-plan §5, item 7](../project-status/2026-10-04-nonvisual-implementation-checkpoint.md) and [runtime contract 06 §§2–4 and §13.1](../game-design/06-world-first-runtime-contracts.md).

Preparation base: `49e1e98890ae52e17f51b2a658ba56f78f1fd4b7`. Its preceding field-cut kinematics connection has exact-source focused 60-case GREEN, full compiler, single registered-profile Native acceptance and the separate eight-case legacy gate. Current-base integration remains distinct evidence from these author-source results. This document adds no implementation or execution evidence for retained pieces.

`buildPrePitchRunnerController` already owns the full accepted `RunnerMotionTrajectory`, including reaction, acceleration, speed-limit and braking pieces. `prePitchRunnerContactPrimitives` deliberately exposes only one analytic interval. `RunnerLocomotionController` already owns basis/revision/rebase semantics; this connection does not rebuild them or issue a replacement controller.

The original runner Source continues to own intent, straight route, upright body mode, body pose, motion revision, parameters and `coverageThroughTick`. These are accepted inputs, not proof of autonomous runner perception, decision or calibrated generation. No new numerical tuning, route, intent, controller revision, body transition, actor force model or coverage is introduced.

## Versioned field action and persisted pieces

Add the explicit Source tag `owned_runner_field_pieces_v1` to the existing field owner. Its accepted fields match the current owned-runner field action: original runner Source ID, response/geometry IDs, predecessor ID, availability tick, requested through-tick and exactly ten existing player commands. The runner receives no eleventh caller command. Reject caller-supplied piece lists, curve coefficients, controller objects, sample times, actual endpoints and physical/rule results.

Use the existing field action table and transactional owner. A tagged row adds `pieceExecution`, versioned `owned_runner_field_pieces_execution_v1`, with an ordered nonempty `pieces` array. Every piece records:

- zero-based `ordinal` and the original `controllerSegmentIndex`
- exact `startMoment` and `throughElapsedSeconds`, in the original contact epoch and scale
- exact `coverageThroughElapsedSeconds`, bounded by that original analytic segment and original accepted coverage
- the actual `field` result from the existing field engine, including all fifty-five curves, the real world moment, response, cursor and base contacts

The existing top-level `field` remains an exact checked mirror of the final piece's field result for predecessor/cursor access. It is not the row's complete execution history. A new piece-aware projection must consume every piece; no reader may interpret this tag as a v1 single-curve row. Source history/revision still counts accepted actions, while piece ordinal counts physical analytic intervals within that action.

Each stored piece is rederived from original dependencies during owner replay. A source hash, snapshot hash or last-piece mirror alone cannot authenticate an omitted or altered earlier piece. No generated child action Source or additional accepted runner command is fabricated.

Existing untagged and `owned_runner_field_v1` rows retain their exact serialization and behavior. A piece action may start at the original zero-time root or continue an authenticated v1/piece predecessor sharing the same original runner, pitch, actors, response and geometry. The existing v1 path must not consume a piece predecessor or acquire piece semantics implicitly. Historical v1 cuts stay readable after later piece rows; later payloads remain opaque where the existing bounded reader requires metadata-only checks.

## Exact execution and state ownership

1. Authenticate the original controller, basis, Player/Person identities, body profiles, response and geometry through existing owners. Derive piece boundaries solely from that controller's original trajectory and accepted coverage.
2. Adopt the accepted ten-player field commands once at the action's actual starting cursor. Retain those players' resulting analytic curves across internal runner-piece boundaries; an internal piece is not another ten-player command adoption.
3. Derive the runner's five curves from the selected original analytic segment and original body-pose anchor. At a fractional boundary, use that segment's analytic data at the exact elapsed time. Do not pass a rounded boundary tick to the integer-only controller sampler, reset the runner root, or change the canonical motion revision.
4. Execute retained curves through `advanceBattedWorldFieldMotionExactCheckpointV1`. Its existing free-ball collision/response path remains authoritative. `queryPiecewiseFieldMotion` is glove-constrained and is not the executor for this connection.
5. Stop at the earliest actual physical boundary or requested endpoint. A contact-free analytic boundary permits the next retained piece; it does not assert a catch, completed decision, settled play or PlayEnd. A collision coincident with a controller boundary is recorded as the real boundary; subsequent continuation uses the actual response cursor and exact elapsed time.
6. Each piece's effective coverage is its exact interval. Integer `endTick` storage or an event's rounded tick cannot authorize the remaining fraction beyond that interval. Never extrapolate a constant-acceleration piece through a later controller phase. Apply existing reconciliation conventions without new epsilons, clamping or tuning.
7. Preserve genuine zero-duration boundary pieces, including an initial bag overlap. Do not skip an unresolved contact to make time advance. Requested motion beyond original coverage, route exhaustion, unsupported body transition or missing continuation authority fails closed.

Kinematics must sample the actual executed endpoint, including a fractional collision, using the recorded executed piece's coefficients. A cut stopped at a boundary retains the final executed piece; it does not substitute the following piece merely because the times coincide. The next piece's acceleration becomes observable when that piece is actually adopted/executed and recorded, without changing original controller authority or motion revision. Root, declared relative pose and canonical cleanup residual remain separately represented. The ten other players retain their own actual command provenance.

Add a separate `readOwnedRunnerFieldPieces(cut)` method, with exact cut `{ kind: 'owned_runner_field_pieces_v1', physicalPitchSourceId, fieldSourceId, playerId }`. It returns versioned `owned_runner_field_pieces_kinematics_v1` with original authority, executing field-row identity and separate dependency hashes, and a physical prefix versioned `owned_runner_field_pieces_prefix_v1`. That prefix retains the original zero-time contact plus every executed v1 interval and piece interval in order. Each interval's `execution` records `{ owner, sourceId, revision, pieceOrdinal }`: the original contact uses its contact owner and null ordinal; v1 field intervals use their field owner and null ordinal; piece intervals use their field row and actual zero-based ordinal. All intervals retain all fifty-five actors.

The existing `readOwnedRunnerField`, `readOriginalContact` and legacy ten-player `read` contracts keep their scope and output bytes. The new method accepts no sample time, current mode, caller state or result. It returns no motor-adoption capability, control window, rule fact or closure result. Integer-only canonical rebase remains a later connection and cannot use a merely rounded fractional event tick.

## Source map

| File | Responsibility |
| --- | --- |
| New `src/host/world/PrePitchRunnerFieldPieces.ts` | Project bounded runner curves from the existing original controller's analytic pieces and original body-pose anchor; preserve integer sampling APIs |
| New `src/host/world/OwnedRunnerFieldPieces.ts` | Compose actual piece execution with existing free-ball field functions; retain ten-player commands and stop at real boundaries |
| `src/host/world/SqliteBattedWorldFieldStore.ts` | Exact new Source admission, explicit piece snapshot validation/replay, predecessor/version rules and atomic persistence in existing tables |
| New `src/host/world/OwnedRunnerFieldPiecesPhysicalPrefix.ts` | Project every actual interval with its action/piece provenance; retain zero-time original contact and every active actor |
| New `src/host/world/ActualPlayerKinematicsFromRunnerFieldPieces.ts` | Sample piece-aware endpoint decomposition and authority without generating future motion |
| `src/host/world/SqliteActualPlayerKinematicsReader.ts` | Dedicated exact-cut method on the same readonly transaction/connection and bounded field traversal |
| Existing `PrePitchRunnerExecution.ts`, `RunnerMotion.ts`, `RunnerLocomotionController.ts` | Original input, trajectory and controller authority; expose the additive projection through `PrePitchRunnerExecution.ts` without replacing an engine or relaxing the v1 boundary |
| Existing `BattedWorldFieldMotion.ts`, `BattedWorldMotion.ts` | Exact free-ball continuation and canonical primitive continuity/adoption; retain existing numerical behavior |

Any shared helper extraction must preserve existing v1 and legacy outputs. The new source tag and its readers are the only admission expansion. Rule/custody/Scope/closure consumers remain explicitly unsupported for this runner path.

## Acceptance matrix

| Contract | Small Core/source evidence | Durable/compatibility evidence |
| --- | --- | --- |
| Original reaction boundary | Execute stationary reaction then original acceleration; exact segment identity and continuous position/velocity | Original runner Source, basis, revision and accepted coverage remain unchanged |
| Fractional top-speed boundary | Cross a noninteger-tick acceleration-to-cruise boundary; use the correct acceleration on each side | Stored/reopened pieces reproduce exact actual moments, not rounded samples |
| Braking and rest | Cross original braking-to-rest pieces and retain explicit stationary coverage | Exhausted coverage or missing stationary authority cannot create a padded future piece |
| Real collisions around a boundary | Contact before, after and coincident with a controller phase; stationary/wrong-acceleration counterfactual differs | Persist only actually executed pieces and the real final response/cursor |
| Fractional rebound | Resume from a genuine fractional collision, including another event within the same rounded tick | Reopen/retry starts at the same exact cursor without a gap, overlap or duplicated event |
| Zero-time unresolved contact | Initial bag overlap produces an actual zero-duration piece | It remains readable and pending; no artificial elapsed motion or discarded contact |
| All actor authority | Eleven identities and fifty-five parts through every piece; exactly ten caller commands | Reject changed Person, role/radius/profile, runner Source, model or geometry |
| Ten-player command retention | One action adoption; exact retained curves across its internal runner boundaries | Repeated internal adoption or new ten-player coverage is rejected |
| Root/pose/residual | Piece-aware runner roots and all five parts reconcile, including nonzero cleanup residual | Kinematics never keeps the prior phase's acceleration across an actual transition |
| Caller input fence | Reject piece/controller/curve/result/time injection and accessors without executing getters | No caller-provided snapshot can seed the authenticated owner traversal |
| Piece integrity | Reject altered order/index, missing piece, gap/overlap, backward time, mismatched final mirror and coverage extension | Rehashed corruption still fails fresh derivation; ordinal and row revision remain distinct |
| Historical cut | Earlier cut ignores opaque later payloads while checking complete future ownership metadata | Earlier v1 bytes and piece cuts remain stable; malformed later links/heads fail |
| Atomic persistence | Genuine accepted action succeeds only from the current predecessor and original dependencies | Trigger corruption rolls back row/head/admission effects; retry and reopen preserve exactly-once ownership |
| Genuine Native chain | Small fixtures explicitly identify substituted upstream readers | Extend the registered `npb-2026` fixture once; test real piece execution, readonly reopen, tamper and rollback without rebuilding the legal chain per negative |
| Legacy and unsupported consumers | Preserve original-contact legacy bytes, v1 motion/kinematics and canonical controller authority cases | No rule/territory, runner glove custody, acquisition/throw, scheduling, general Scope or closure guard is opened |

Proposed test files are `PrePitchRunnerFieldPieces.test.ts`, `OwnedRunnerFieldPieces.test.ts`, `OwnedRunnerFieldPiecesKinematics.test.ts`, `OwnedRunnerFieldPiecesReader.test.ts` and `OwnedRunnerFieldPiecesNative.test.ts`, alongside existing `OwnedRunnerFieldMotion.test.ts`, `OwnedRunnerFieldBoundary.test.ts`, `OriginalContactLegacyBytes.test.ts` and controller authority regressions. Tests must obtain each new capability before a hostile-input rejection assertion, so a missing method cannot masquerade as a passing negative case.

## Test-first implementation order

- [x] Finish the preceding kinematics legacy/integration gates; preserve their exact source identities
- [x] Author the bounded analytic-piece and Source/reader contracts, then independently review their fixtures and authority boundaries
- [x] Observe intended RED failures separately from fixture, compiler, unhandled or resource errors
- [x] Implement original-piece projection and explicit versioned field execution using existing numerical owners
- [x] Add durable piece replay and the dedicated physical prefix/kinematics reader; preserve v1 and legacy bytes
- [ ] Verify focused/legacy tests, full types and the single genuine Native chain against frozen sources and measured resource bounds
- [ ] Review and publish the logical change with exact evidence; leave autonomous runner decisions, rebase/adoption, general rule relations and Scope/closure explicitly outstanding

## Authored test checkpoint

Test-only interfaces define `prePitchRunnerFieldPieces(input)` through the existing execution module. Its internal input binds original Source, canonical state, controller, shapes, body height, original epoch, start elapsed time and requested elapsed endpoint. It returns ordered `{ controllerSegmentIndex, startElapsedSeconds, coverageThroughElapsedSeconds, actors }` projections. These internal analytic endpoints never become caller fields on an accepted field action. New reader tests use the separate method above; a missing capability is required before any rejection assertion can pass.

The independently reviewed test-only cut `6c227b13f140fb409acac66b152130e95370bc09` completed its intended RED: 16 missing analytic-projection capability failures, 30 missing piece-reader capability failures and 19 existing admission-fence failures. All 65 tests reached their expected failure, with no skipped tests, fixture/setup failures, suite errors or unhandled errors. This establishes the missing capabilities; physical assertions after those boundaries still need GREEN evidence.

The implementation adds the exact original-controller projection, explicit field pieces, authenticated replay and the separate prefix/kinematics reader. The existing 65 contracts are unchanged. A single additional Native test uses the existing registered-profile legal chain with a prospectively accepted synthetic acceleration-to-cruise trajectory. Its fixture retains the previous default trajectory and solves the optional piece trajectory toward the same existing physical target. It reuses one construction for rollback, durable retry/reopen and rehashed omitted-piece rejection. The later test-only correction uses an explicit temporary WAL file, witnesses the real field INSERT and trigger mutation in the same rejected acceptance attempt, and closes all construction handles before fresh readers and callback-free original stores reopen. The verification checkpoint below separates the observed results from pending gates.


## Author-source verification checkpoint

The fixed implementation and Native correction are
`2aae38a3cd8d805479011f5bb55778c7139a01c6`. Independent source review found no
remaining blocker after the explicit disk/full-close and INSERT-witness correction.
The frozen test-first cut and its RED evidence remain separate.

On 2026-10-05, the focused GREEN completed **139/139 tests across nine files**, with
zero skips, failures or unhandled errors. This includes all 65 retained-piece
contracts, the 60 existing kinematics/original-contact cases and 14 existing v1
field-motion cases. The newly admitted physical assertions passed, including
fractional/reaction/braking phases, exact endpoint selection, genuine zero-time
contact, same-rounded-tick rebound continuation, all eleven identities/fifty-five
parts, explicit piece provenance, hostile Sources and rehashed archive corruption.
The small source fixtures still substitute their documented upstream readers.

The measured phase took 74.833 seconds, reached 482,596 KiB aggregate RSS and used
an observed 1,120 MiB heap limit. All child processes exited zero and were reaped;
all 2,127 source files (including the generated catalog) and verification controls
were unchanged. The terminal receipt SHA-256 is
`02b81fd9a4389c6fff7b5cf1b594aa1e2914bba8b0a44656659d36b08de8392a`.

The full compiler on that same source found one test-only optional-property
narrowing error. Its failed receipt remains preserved; no production error was
reported. The additive correction `bc1e6bcbad0e4c92ceeaf18bd377f57396562416`
asserts the fixture-owned runner exists before comparing its original Source.

The exact net change was then applied to combined base
`a205481240c1233a3fa2cb300d8cc62156213473` as integration
`b8ab7ef94ffdd85795d54809c025ebf5680a1e04`. All fifteen changed paths match
the corrected candidate byte for byte, and all 2,180 unrelated base files remain
unchanged. Its complete source tree is `17ea5675e32aeb3bbb65138cafab6397c2254237`.
The current-base results below are separate from the earlier author-source
GREEN. The original failed compiler receipt is retained as SHA-256
`ed02348b6e8d25b2ae6ba3d6afdcaebcb213c8e3cd30c338260acd1a5def74e1`.
This slice does not establish autonomous runner decisions or calibrated motor
generation, a new controller/rebase authority, rule/custody support, general
Scope, or physical/official closure.


## Current combined-source verification

All following phases use exact integration
`b8ab7ef94ffdd85795d54809c025ebf5680a1e04`, complete source tree
`17ea5675e32aeb3bbb65138cafab6397c2254237` and full tested tree
`56628603329acf477e4e131d86bf25ad1ecea472`.

| Phase | Result | Seconds | Peak aggregate RSS (KiB) | Observed heap (MiB) |
| --- | --- | ---: | ---: | ---: |
| Full repository TypeScript compiler | PASS | 46.269 | 1,379,156 | 1,504 |
| Genuine real-file Native chain | 1/1 PASS, zero skips/unhandled errors | 25.888 | 507,256 | 1,120 |
| Focused retained-piece and existing kinematics/motion | 139/139 PASS, zero skips/unhandled errors | 46.971 | 481,672 | 1,120 |
| Existing eight-case kinematics regression | Interrupted at wall limit; not passed | 180.716 | 510,140 | 1,120 |

The new Native case constructs one registered `npb-2026` legal chain in an actual
WAL database file. It witnesses the successful INSERT and trigger mutation in the
same acceptance attempt that must roll back, then checks the original field
row/head/binding. After successful acceptance it closes all original writers,
dependency handles and the first reader. Fresh readonly kinematics and original
response/base/field stores reproduce the mixed v1/piece history, retry the saved
field action without accepted-Source callbacks, and reject a rehashed omitted
piece. Rows and official state remain unchanged after restoration.

All three completed phases exited zero and reaped all children. Their 2,196 source
files including generated catalog, controls and runtime profiles were unchanged.
Retained terminal SHA-256 values are:

- Focused 139: `a5f17d50bba6b29f12f8abeec159d4a434da5a43235335bdd7082c885ce5d1cf`
- Compiler: `27266b1443db4349c41b00ac9c8b0b815b789aefdb6b6c0e2f4db2c2d764307d`
- Real-file Native: `e832d1dcf7191bf825bcefa99c825c9885a1a2b5d8c4ddfd0801e1a858d4ea78`

The current eight-case regression was terminated at its 180-second wall limit.
Its child exited by signal, all processes were reaped, and source/control hashes
were unchanged. It produced neither a test-result JSON nor per-case completion
receipts, so no cases or assertions from that attempt are counted as passed.
Its interrupted terminal SHA-256 is
`e5408d1c4d3e460f1fed7adefffcd5b40ed6a59769e4fb98f018d5fc09988b6b`.
The earlier eight-case PASS on `49e1e98` took 122.126 seconds and remains evidence
only for that older source. The current graph includes subsequent official and
timing work; the interrupted attempt does not identify the cause of the longer
run. Source-path review and bounded per-case timing evidence must precede another
attempt. Publication remains Draft with this regression gap explicit.

The outstanding current eight-case regression, cumulative whole verification and
any later combined-source integration retain their own completion requirements.
