# Runner decision consumption: source audit and staged test contract

> **For agentic workers:** Use the approved parent execution lane to execute this handoff. This package is source-only preparation, not permission to start runtime gates while the cumulative verification owns them.

**Goal:** Connect the existing owned runner's accepted knowledge/model and actual body to the existing Core decision, controller, physical adoption and policy-settlement machinery, without inventing information or a second locomotion engine.

**Architecture:** Reconstruct all dependencies on the existing Native owner's connection. A read-only input adapter distinguishes unimplemented knowledge producers from missing accepted inputs; it creates no durable pending owner. The actual deliverable remains selected decision → issued motor → adopted physical motion, followed separately by policy-backed PlayEnd.

**Tech stack:** TypeScript, Vitest, Node native SQLite, existing World-first Core kernels.

**Authority:** Existing remaining plan `docs/project-status/2026-10-04-nonvisual-implementation-checkpoint.md` §5.7; current matrix §7; `docs/game-design/05-world-first-live-ball-architecture.md`; runtime contract 06 §§1–3, 9.2–9.6, 10.1–10.3; adjudication contract 07. Existing P6 plans explain already implemented Core inputs, not proof of their Native production.

## Status and source identity

- Audited checkout HEAD `115e5d79fbe6f484c3c4684d4af87d60a39c5832`, src tree `183e367eda89426b32707bb1d5d5e108ddc59455`
- Public-baseline prerequisite is the separate candidate HEAD `df7f488de0f26fd378a98aba7d91b7642bfe5b92`, plus an **unapplied** reviewed repair with SHA-256 `2f6ad862f76415e68684e25c085af401d27c92d528d1b2942855a14b76fb25a3`
- That repair is not applied by this package. Its new acceptance must preserve the original open actor frame and stable game/play/player ownership, while saved historical reads remain valid
- No test, compiler, runtime, SQLite connection, or production mutation was executed for this package. Every test below is **staged / unrun**, including the intended RED. There is no observed RED or GREEN result
- No external publication. The files are an overlay for a later isolated verification cut, not additions to the currently running cumulative source

## Global constraints

- Preserve immutable original inputs, Player/Person/roster/day validation, history, bounded historical reads, currentness and complete dependency rederivation
- No caller positions, outcomes, knowledge, guessed tactic/calibration/body values, or extra hidden accepted fields
- No future true contacts, route endpoints, umpire truth or later MatchState enter a Player decision
- Existing pending knowledge is not `forcedToAdvance:false`, `tagUp:{kind:'none'}`, an uncovered-base cue or a hold decision
- Preserve the eleven existing bodies and all 55 parts. Selecting a motor does not execute it
- Keep original retirement-only PlayEnd archives byte-compatible; do not make SAFE into retirement
- Do not add a table merely to save pending readiness

## Source map: existing mechanisms and missing consumers

| Boundary | Existing source | Exact present limitation |
|---|---|---|
| Explicit policy/motion input | `PlayerRunnerDecisionMotionModel.ts`; `SqlitePlayerRunnerDecisionMotionModelStore.ts` | One immutable accepted model per Player; it does not create knowledge, decision, or command |
| Original public facts | Separate `OriginalRunnerPublicKnowledge.ts` candidate | Original inning/half/outs/score/starting base and next base; `liveContext` stays pending |
| Player sensory history | `OwnedRunnerFieldObservation.ts`; `SqliteOwnedRunnerFieldObservationStore.ts` | Retains own samples and predecessor history; live force, tag-up, cues and consumed signals are unavailable |
| Sensory kernel | `ExecutedFieldObservation.ts` | Captures/predicts ball/player position and velocity. No grounded/fly/catch/first-touch/base-touch event interpretation; `knownContext:null` |
| Actual current self | `SqliteActualPlayerKinematicsReader.ts:readOwnedRunnerFieldPieces` | Authenticates actual endpoint only. No future sample argument; no new command |
| Core choice | `RunnerDecision.ts:decideRunnerMotionIntent` | Already selects retreat/hold/advance/slide from explicit inputs. Not connected to Native runner knowledge |
| Core controller | `RunnerLocomotionController.ts:buildRouteFollowingController`; `RunnerMotion.ts` | Existing route authority, motion revision, separate decision/reaction delay, acceleration/braking/slide segments |
| Original body/controller ownership | `PrePitchRunnerExecution.ts`; `PrePitchRunnerFieldPieces.ts` | Owns an explicitly accepted straight upright route and five original body parts. Rejects slide/body transition and route exhaustion |
| Retained actual execution | `OwnedRunnerFieldPieces.ts`; `ActualPlayerKinematicsFromRunnerFieldPieces.ts` | Executes original controller phases. Later field rows do not renew the runner |
| Native motor/adoption | `SqliteActualLocomotionStore.ts`; `OwnedScheduledMotionComposition.ts`; `OwnedMotionKnownWorkFromSqlite.ts`; `OwnedMotionCausality.ts` | Only `initial_defender_step_v1`; composition binds ten players. No runner issuance/adoption capability |
| Runtime membership | `ActualLivePlayScope.ts` | Ten participants, 50 primitives; rejects pre-pitch runner field participation; missing batter/runner decision and motor producers |
| Policy settlement | `core/sim/liveAction/ActorPolicySettlement.ts:resolveLivePlayFromActorPolicies` | Existing Core finalizer input bridge, with no Native caller found in audited production source |

## Every RunnerDecisionInput field and its legitimate producer

The missing items below are code connections, unless an exact accepted input is listed as absent. They are not a reason to wait permanently for a caller to supply an invented `RunnerKnownContext`.

| Field | Valid producer/input | What still needs implementation |
|---|---|---|
| `runnerId`, observer identity | Original pre-pitch binding, observation recipient, Player/Person model and actual self | Same-connection identity join; reject cross-pitch, cross-player, future-day or changed roster evidence |
| observation time, attention, ball and player memories | Exact `observation.receipt.perceived` from retained history | Preserve exact receipt time and memories; do not rebuild them from current truth |
| `currentBase`, `nextBase` | Original known starting/normal-next base for the initial ordinary adjacent-base decision | A later update needs the runner's consumed own-touch/departure knowledge. Actual coordinates or latest official occupancy do not directly supply it |
| `forcedToAdvance` | Original public occupancy establishes the conditional force chain. Existing `createInitialForceObligationState`, `deriveCurrentForceObligations`, `retireForceParticipant`, `satisfyForceParticipantObligation` define its rule algebra | Missing bridge must activate/update the runner's believed force state from actually available ball-in-play and relevant retirement/satisfaction information. The initial public baseline alone does not prove a live force. Do not run the rule-truth history secretly on the Player's behalf |
| `tagUp` | Perceived applicability, perceived first fielder touch, and the runner's consumed departure/retouch knowledge | `awaiting_first_touch` means not yet perceived; no future legal-advance tick. Known early departure gives `must_retouch`; confirmed no applicable restriction or satisfied retouch permits `none`. No production semantic event/perceived-self-contact bridge exists |
| `perceivedCues` | Perceived/predicted arrival/control/threat evidence at or before the receipt time | `PerceivedStealRace` and `PerceivedPickoffThreat` combine **already perceived** timing estimates, not generic field observations. Their timing inputs have no Native runner producer here. General batted-ball race/threat estimator remains missing. `defenderControlTick:null` means perceived uncovered, never mere nondetection |
| received communications | Same-recipient, available communication/perception receipts | Runner history Source currently accepts no communication dependency. Add an explicit compatible history variant when the producer is supported. Core accepts only `coach_signal` + `{kind:'runner_action', action}` as advice; actual umpire OUT/SAFE payload is a different semantic type |
| confidence, trust, safety margin, decision ability and timing | Exact accepted runner decision-motion model | No missing coefficients when a valid model is present. Wire it directly. Original inning/score do not authorize synthesizing `RunnerRiskPolicyCalibration`; that is a separate explicit input if risk adaptation is used |

### What the rule kernels do and do not solve

`ForceObligation` is usable algebra, not an observer. Once the runner has a causally justified interpretation of the relevant events, reuse the algebra on that belief state. For the supported one-existing-runner fixture: an initially occupied first base produces a conditional obligation to second while the batter remains active; an isolated second/third runner has no such initial force. A recognized force removal must be processed before a new decision. Unseen removal must not telepathically update the runner.

`TagUpCompliance` compares actual first-touch/departure/retouch facts for rules. It is not a ready `PlayerPerceivedWorldState` generator. Its `legalAdvanceFromTick` must not leak into runner knowledge. Existing P6 acceptance explicitly removed a future true first-touch time and uses `none`, `must_retouch`, `awaiting_first_touch`.

The smallest new semantic bridge should use authenticated, available observations/received signals tied to original physical events, plus owned self-contact history where perception is actually modeled. World truth can feed a sensor; only its recipient-specific result may feed choice. Current observation calibration covers spatial/velocity error and detection, not semantic first-touch timing error. Reuse an existing applicable accepted calibration when available; otherwise expose that particular missing accepted sensor parameter rather than inventing it. Adding an event-kind decoder from known typed content requires code, not an arbitrary coefficient. The precise sensor classification/timing policy beyond established kernels remains a prerequisite to agree within the approved scope before claiming a positive Native semantic receipt.

## Staged next interfaces

### 1. Read-only dependency bridge (staged executable contract)

Proposed additive export on existing `SqliteActualLocomotionStore.ts`:

`actualRunnerDecisionInputEvidenceFromSqlite(db: DatabaseSync).derive(source, current = false)`

The exact test-only Source/output types are in `ActualRunnerDecisionInputContracts.test-support.ts`. Source carries only original pitch/player, field, saved observation, saved public-baseline and saved runner-model references. It accepts neither a supplied context nor a ready result. The implementation can live in a small internal module and be re-exported; no writer/table is requested.

Consume `originalRunnerPublicKnowledgeEvidenceFromSqlite(db).read`, `ownedRunnerFieldObservationHistoryEvidenceFromSqlite(db).read`, `playerRunnerDecisionMotionModelEvidenceFromSqlite(db).read/selectAtDay`, and `actualPlayerKinematicsEvidenceFromSqlite(db).readOwnedRunnerFieldPieces` in one native read transaction. Validate original actor, game/play, pre-pitch source, recipient, Person, accepted day, physical clock and exact cut. Current mode also authenticates field/observation heads and open frame through existing owners. Historical mode must preserve earlier receipts after later accepted observations.

Return hashes of those four rederived dependencies and explicit `runner_live_context_unavailable` with null input/decision/motor. This is a preparatory executable invariant, not the final runner consumer, and should remain internal to the eventual decision path. Do not publish it as a completed feature or add a durable owner for it.

### 2. Semantic input → Core decision (positive contract to implement next)

The next version of the internal result should be a discriminated union. Its ready arm carries the exact `RunnerDecisionInput` constructed from owned Player knowledge and the accepted model; its pending arm identifies actual missing semantic evidence/calibration. The external Source refers to the semantic producer/history, never inline booleans, timing estimates or an action.

Keep the field/self dependency for identity, timing and motor preparation. Pass only the recipient's perception, known context and model decision fields to `decideRunnerMotionIntent`. Do not pass true ball, defenders, actual future contact or whole physical trajectories to that function.

Positive contracts grounded in existing Core semantics:

1. An available recognized live-force event with initial first-base public occupancy, no tag-up restriction and no perceived current-base threat yields `advance/forced_advance`. The same event received later delays availability and decision tick; its scheduled-but-unreceived version cannot alter knowledge
2. Authenticated `awaiting_first_touch` yields `hold/tag_up_wait`, even with a favorable next-base estimate or advance advice. It never yields settled-for-play
3. Authenticated early departure requiring retouch yields `retreat/tag_up_retouch`; a future/unperceived first touch does not clear it. A consumed fulfilled-retouch update may clear the restriction, after which the existing selector decides again
4. A causally received current-base threat overrides an optional advance; `forcedToAdvance:false` and `tagUp:{kind:'none'}` must come from a supported knowledge state, not absence. `defenderControlTick:null` separately means perceived uncovered
5. A recognized `coach_signal/runner_action` is filtered by recipient, received time, confidence and accepted coach trust. An actual OUT/SAFE call remains that call; do not cast it into coach advice
6. With an explicitly applicable and completed cue derivation that produces no actionable cue, non-forced/no-tag-up knowledge yields `hold/no_actionable_evidence`. An unwired cue generator is a different state and must not be relabeled a successful scan
7. Compare the entire resulting decision to `decideRunnerMotionIntent(ready.input)`, including reason, evidence time, decision tick and perceived margin. Preserve separate decision delay and motor reaction delay; reject backdated issuance and safe-integer overflow at real nonzero ticks

These contracts need a real semantic-producer fixture before they become Native positives. Handwritten `RunnerDecisionInput` proves Core interoperability only; `PlayerRunnerDecisionMotionModel.test.ts` already supplies that evidence and must not be relabeled Native knowledge consumption.

### 3. Decision → owned controller/motor → actual adoption

Proposed accepted motor Source contains references to the issued runner decision, runner model, current field/self cut and retained controller authority. It does not accept `startMotion`, route, body accelerations or predicted endpoint from the caller. The derived receipt can include their authenticated reconstruction.

Use the original accepted `runner.source.route`, controller, motion revision, body pose and physical model for a first **upright same-route** subset. Read `startMotion` from the owned controller at an actually executed exact integer boundary, then reconcile its position/velocity with the current actual root before calling `buildRouteFollowingController`. Keep world-space authority and exact residual/relative-part provenance. Never snap to route start, resample future self, use a base label as position, or silently renew exhausted route/body authority.

`RunnerMotion` already preserves old drive until `intent.issuedTick + reactionDelayTicks`, then brakes/accelerates analytically. An actual adoption must respect every resulting phase boundary. The retained-field path already demonstrates how to split such phases, but currently recognizes **only the original controller**. Introduce an explicit accepted runner controller/adoption version; do not hide renewal as another `owned_runner_field_pieces_v1` row.

Positive/adversarial contracts:

- Due hold with a nonzero inherited velocity produces gradual braking; no immediate zero velocity or position jump
- Before reaction time all five runner parts remain on the old actual command; at and after reaction the owned new segment applies, with the other ten bodies retained exactly
- New motion preserves original route, revision basis, top speed, explicit body radii, root/relative decomposition and accepted coverage. A turn/rebase beyond that subset remains explicit, not silently projected onto the line
- Shortest retained role/controller coverage truncates actual progress; a requested horizon grants no new coverage
- A physical contact before the command checkpoint stops at the actual contact and preserves pending physical successors; no forecast counts as adoption
- Duplicate motor/adoption, stale cut, changed model/Person, hidden ownership aliases or dependency mutation during INSERT reject and roll back. Prove the INSERT with `witnessSqliteWrite`, then retry and close every connection before file reopen
- `slide` may be selected by Core, but body-mode/pose/contact adoption stays pending until a genuinely accepted body-transition owner exists. The existing upright body's model cannot become a slide for free

Required integration edits include the explicit runner motor union, `OwnedMotionKnownWorkFromSqlite`, `OwnedMotionCausality`, physical composition/adoption and its kinematics reader, plus original runtime membership/admission. Merely relaxing the ten-player length check is insufficient. Every existing participant and all 55 parts must share the same authenticated original prefix and remain owned.

## SAFE, genuine terminal evidence and scoring

`ActualFirstBaseUmpire.ts:actualFirstBaseOffensiveDisposition` deliberately returns `active` for SAFE. At `ActualFirstBasePlayEndEvidenceFromSqlite.ts:140`, non-retired disposition yields `offensive_actor_still_active`. The current ended type requires `operativeRetirement`, and the finalizer invokes `all_offense_terminal`. That contract supports empty-base first-base retirement, not a surviving SAFE runner.

The extension needs a versioned active-safe terminal path, not a broader interpretation of retirement:

1. Reauthenticate the available original SAFE call and correct rule evidence without changing its `active` disposition
2. Consume relevant actual call information through the receiving player's supported semantic/controller path. The existing `received_call_controller_consumption_pending` boundary remains real
3. Show an actually issued due hold, actual braking/settled world state, completed owned producers and the full queue watermark. Use `resolveLivePlayFromActorPolicies` with `terminal:'none'`, genuine world/match scope, one policy per live actor, and an owned non-vacuous registry
4. Existing settlement kernel requires hold excluding `tag_up_wait`, stopped canonical velocity, and completion of every source before setting `settled_for_play`. The registry still checks all work/rule windows and same-tick watermark. It must not receive an empty fabricated source list merely because its Core unit tests can use one
5. Authenticate final base relation/entitlement from actual consumed touch/retouch/rule history; then feed physical PlayEnd to the existing OfficialPlayClosure/scoring path. Score/hit/error decisions do not close live physical work

This also requires a batter-runner's post-SAFE route/context/body ownership. The existing additional pre-pitch runner input path is not automatically a batter-runner path: current `RunnerKnownContext.currentBase` is 1/2/3, while the original batter physical owner is swing/grip. Do not infer a new route, standing pose or base occupancy from SAFE.

Future SAFE positives must cover a runner that genuinely brakes, consumes its latest knowledge and settles on an owned legal base. Negatives must retain active/pending for SAFE alone, zero speed alone, tag-up wait, future decision/reaction, unadopted motor, remaining ball/custody work, due or causally in-flight received information, outstanding live-rule windows and unclosed watermark. The authentic OUT terminal remains a compatibility case. A post-play review window blocks official closure, not necessarily physical PlayEnd.

## Execution order and staged evidence

- [ ] Finish the public-baseline repair's own RED/fix/regression/compiler/Native proof on its assigned fixed Source; integrate it without borrowing old source results
- [ ] In the allowed verification lane, run `ActualRunnerDecisionInputBoundary.test.ts` first. Expected intended RED is its explicit missing-function assertion against an existing module, not import/compile/DB failure
- [ ] Run the Native input test only after repaired public-baseline acceptance is present. Its real prerequisite assertions must pass before the adapter assertion. Any earlier failure is a prerequisite/fixture failure, not adapter RED
- [ ] Implement the small same-connection dependency bridge as part of the decision work, then pass the input contracts and existing observation/model/kinematics regressions
- [ ] Implement and prove the smallest supported semantic-event/history bridge; promote the positive contracts above to real producer-backed tests. Do not stop the overall task at the pending adapter
- [ ] Wire the ready input into existing Core choice and own actual issuance; then implement upright controller/physical adoption with the stated runtime ownership changes
- [ ] Separately prove SAFE policy settlement and closure, reusing ActorPolicySettlement. Do not claim general runner, scoring or eleven-player PlayEnd until those respective actual gates pass

Run eventual focused files serially with the repository's approved single-worker command after shared runtime ownership is released. `npm test` and `npm run typecheck` invoke catalog pre-scripts; they were not run here. The Native fixture has a 180-second ceiling inherited from nearby tests, but elapsed timeout or pre-adapter failure is never intended RED.

## Fixture suitability and review focus

`ownedRunnerFieldNativeFixture({retainedSpeedBoundary:true, databasePath})` supplies one real legal walk → next actor → actual pitch/contact chain under registered `npb-2026`. The staged fixture accepts actual field/model/history owners and a public-baseline Source; no raw snapshot inserts or mock readers are used. Its source values are explicitly synthetic and are not production calibration.

The +100,000-tick field cut is before this fixture's +125,000 controller phase boundary and +200,000 body/ball impact. This provides an exact current body cut for input readiness. It is **not** a legal first-to-second route, safe base touch, catch interpretation, controller settlement or PlayEnd fixture; do not reuse it to prove those claims.

The staged Native contract checks independent owner identities, explicit model values, unavailable context, Source-injection rejection, historical/current head distinction and callback-free full-file reopen. Every adapter construction and derive is bracketed by row/schema, `total_changes()` and transaction-state baselines, including rejected, later-current and reopened calls. An outer transaction covers a successful derive, a same-connection uncommitted model mutation that must reject, a separate committed reader that must still derive the old value, and rollback restoring the original result. A second actual +110,000-tick cut paired with the older observation rejects; the old matching pair remains readable historically but not current. Accepted different-player, future-day and incompatible-clock models separately exercise compatibility checks; the latter two are prospectively accepted in separate real fixture files, never made by rewriting the original baseline. It intentionally requests no decision INSERT rollback because the adapter writes nothing. The later actual decision/motor owners require their own witnessed write/rollback/adoption tests.

A third accepted observation then advances only the observation head at the same latest field cut. The Native field owner separately confirms that cut is still current; the second observation's input remains historically readable but rejects current mode, while the third succeeds. Full reopen preserves the older field-pair distinction, mismatched field/observation rejection, observation-only stale rejection and newest current success.

Highest-risk subsequent reviews: belief/truth separation for first touch and force dissolution; backdated issue/reaction at nonzero exact times; residual/relative-body continuity; future prefix corruption versus immutable historical reads; and SAFE-as-retirement or vacuous-source closure. The positive/adversarial contracts above pin each boundary.
