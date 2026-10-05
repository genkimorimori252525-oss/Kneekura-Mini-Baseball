# Owned batting intent and same-PA foul continuation

Status: the original-intent opt-in is approved for test-first contracts only. Its 20 Native Source contracts produced the intended behavioral RED at `0688071`; the explicit original-intent implementation is now a candidate awaiting source review and GREEN. No same-PA continuation behavior has been added. The later same-PA lifecycle/workload contract requires another review before implementation. Source audit base: `11b5571975b75ab8de6c3f8bb8eb9f30550daa04`. The completed venue evidence candidate remains separately frozen at `40e3ad5`, with its cumulative runner integration at `b3ac543`. This document does not change either source or its qualification.

## Bounded outcome

Connect an explicitly accepted batting attempt to its actual original pitch/contact, derive the existing settled-foul count consequence, and resume a new pitch within the same plate appearance only after the prior foul episode has an authenticated legal handoff, physical setup and workload basis. The first scope is the already supported untouched settled foul, an unchanged batter and nine defenders, and empty bases. Other venue categories, general interference, substitutions, multiple runners and new effort calibration are excluded.

A generic swing is not an authenticated non-bunt. Unknown intent remains unknown. An ordinary foul does not manufacture a plate-appearance closure, next batter, OUT or first-base PlayEnd. Physical end, official consequence, reset readiness and next-pitch admission are distinct proofs.

## Existing authority and concrete gaps

| Source at the audit base | Established behavior | Missing connection |
| --- | --- | --- |
| `src/core/sim/pitching/PitchAgainstBatter.ts:27` and `:37` | Physical actions are `take` or a generic `swing` curve | No bunt/non-bunt discriminator |
| `src/host/world/SqlitePhysicalPitchProgressStore.ts:28`; `PhysicalPitchEvidenceFromSqlite.ts:85` | The original accepted Source, frame, action and resulting timeline are immutable and replayed | Extra intent fields currently reject; no batting-decision Source is referenced |
| `src/core/world/psychology/batting/BattingTypes.ts:17` and `:33` | Batting planning has AUTO/TAKE/SWING and physical commitment data | No bunt attempt, and no Native original-pitch adoption link |
| `src/core/world/control/ControlTypes.ts:55`; `DecisionEvidence.ts:10` | Generic selected action and executed-event attribution | Action IDs such as `bunt` in Core tests are not authenticated pitch execution; Native dispatch found here is roster dispatch |
| `src/core/sim/plateAppearance/CanonicalPlateAppearanceTimeline.ts:585` | `recordFoulBattedBall` derives `active` count or foul-bunt strikeout through existing rules | Requires explicit intent and an owned Native adoption path |
| `src/host/world/SqlitePhysicalPitchProgressStore.ts:179`; `PhysicalPitchEvidenceFromSqlite.ts:134` | Next pitch and replay use the preceding saved physical timeline | That timeline remains `batted_ball_pending`; external foul disposition is not interleaved |
| `src/host/world/ActualLivePlayRuntime.ts:23`; `SqliteActualLivePlayRuntimeStore.ts:51`; `ActualLivePlayFence.ts:68` | v1 supports first-base live rules, one runtime per game/play, and bars a new original pitch after registration | No closed foul episode to same-PA next-pitch handoff |
| `src/host/world/ActualLiveRuleConsumptionFromSqlite.ts:10` | One confirmed capture followed by an owned first-base race | Cannot serve as foul/dead-ball consumption |
| `src/core/adjudication/PhysicalNonLiveClosure.ts:62`; `NonLiveOfficialApplication.ts:17` | Terminal walk/strikeout closure | No ordinary-foul same-PA official continuation |
| `src/host/world/ActualRoleWorkloadAssessment.ts:5` and `:38` | First-base physical-end reference; TOTAL closed-play effort; one canonical career/game/play/player activity | Foul episodes cannot be relabeled as those closures or charged repeatedly |
| `src/host/world/ActualRoleWorkloadChargeGuard.ts` | Bidirectional exclusion of actual-role and legacy pitch charges, including raw/archived claims | New PA continuation ownership must preserve and extend these proofs |

Presentation's bunt labels, batting traits and a low-speed bat curve are not intent authority. A search for `bunt` in the audited production Native sources found no original batting-intent owner.

## Lifecycle requirements

`05-world-first-live-ball-architecture.md` §4.1 requires RuleProfile-authorized `rule_system` provenance for discontinuous dead-ball/reset effects. `06-world-first-runtime-contracts.md` §§9.5–10 distinguishes physical action windows from post-play adjudication and requires the same-tick event watermark even for a dead ball. `07-world-first-adjudication-contracts.md` §§9–9.1 requires an official handoff, canonical setup and retirement of stale controllers before activation.

Therefore authenticated dead-ball truth may end physical action after its authoritative event watermark is settled. Missing bunt/count consequences must still block official continuation/reset/next pitch. They must not be disguised as fictional physical work, nor silently discarded because physical action has ended. The v1 first-base guards and their unresolved facts remain unchanged.

## Contract 1: original owned batting intent

The smallest owner is the existing accepted physical pitch action, which already freezes the actual batter action before execution. Add an explicit versioned optional member to that Source, for example:

```ts
battingIntent?: {
  version: 'original_batting_intent_v1';
  actorSourceId: string;
  attempt: 'ordinary_swing' | 'bunt';
}
```

The name is proposed; the authority conditions are mandatory:

1. The member is accepted with the original pitch action before any execution. It is part of the exact Source/hash and replay, not a later interpretation attachment. Legacy absence means unresolved intent, including a generic `swing`.
2. The actor Source must resolve to the actual accepted physical plate-appearance actor and its original game/play/player/person/fixture binding. The explicit attempt must accompany an actual swing action; a take plus a declared attempt rejects.
3. After execution, intent evidence binds the physical pitch Source/version/hash, progress revision, actor reference, original action hash, BatBallContact sequence/tick and result-timeline hash. The contact must be the newly appended contact of that exact accepted action.
4. Same-Source mutation, conflicting attempt aliases, foreign actor or pitch, post-execution attachment, active/getter inputs and caller-supplied result/count fields reject. No historical row or physical contact is rewritten.
5. Human/manager/AI decision attribution can be added only when an existing decision execution owner is actually bound to this Source. A bare generic `ControlledDecision.actionId`, prediction, or Presentation label is not an alternate authority route. The first slice accepts explicit actor inputs through the existing pitch-action authority and claims no new AI decision capability.

Proposed files: `src/host/world/OriginalBattingIntent.ts` and its tests; versioned opt-in validation/replay in `PhysicalPitchEvidenceFromSqlite.ts` and `SqlitePhysicalPitchProgressStore.ts`. No bat collision equation or numeric calibration changes.

## Contract 2: immutable foul episode and count consequence

Retain the PA identity `(gameId, playId, firstPhysicalPitchSourceId)`. A foul episode is separately identified by its original physical pitch Source and contact sequence. Each physical pitch remains in the original ordered progress lineage; an episode is not another PA.

A proposed accepted foul-resolution Source owns references only: its own ID/version, original physical pitch Source, venue-policy Source, explicit field/execution cut, and original runtime episode. It accepts no `buntAttempt`, count result, dead flag, OUT, contact time, replacement prefix or supplied timeline. The owner rederives:

- original physical pitch and complete PA prefix;
- the previously verified venue-bound untouched settled-foul evidence;
- the exact original intent above, if present;
- actual stop occurrence, consumer availability and complete same-tick event/consumer coverage;
- all original participants and physical owner identities through that episode.

The durable result has distinct parts:

- a causally registered dead-ball cause with original policy/contact/raw-origin references and exact unrounded occurrence;
- count status: unresolved intent, or the result of existing `recordFoulBattedBall`/`resolveFoulBallRule`/`resolvePitchCountRule`;
- an immutable composed timeline extending the original contact timeline, never replacing the physical pitch archive;
- official-continuation readiness and participant-work coverage, which are separately pending until proved.

Use the actual stop's canonical tick for the foul event, retaining its unrounded occurrence and the possibly later availability separately. No arbitrary caller clock establishes the cause. Unresolved legacy intent may support the already established dead-ball fact, but cannot select `foul` versus `foul_bunt` or certify count/reset readiness.

Ordinary foul at two strikes remains active at two strikes. An explicitly owned two-strike bunt foul derives strikeout and cannot obtain a same-PA resume receipt. Its eventual terminal official application must use a versioned authenticated non-live closure input over the composed timeline; the current raw-pitch closure must not be fed a fabricated pitch snapshot.

Proposed files: `ActualFoulResolutionFromSqlite.ts`, `SqliteActualFoulResolutionStore.ts`, associated Source types/tests. This is a new concrete consumption kind, not reuse of `actual_first_base_rule_consumption_v1`.

## Same-PA resume ownership

A resume Source references the completed foul consequence and explicit accepted canonical setup. It never supplies a replacement count or says that a player is settled. A complete resume receipt must carry:

- the original PA and latest pitch/progress head, original-count chain and every prior episode/resume reference;
- immutable composed timeline and ordinary-foul `continue` result;
- authenticated physical end/dead-ball cause, generation/consumption watermark and required official consequence/window completion;
- original participant bindings and exact physical-work manifests, retaining each episode's own time origin;
- rule-system reset/setup, retirement of the preceding episode's controllers, and the exact starting World for the next pitch;
- authenticated participant workload views and a canonical accounting reservation;
- a unique next-pitch admission right consumed transactionally by one original Source.

Only that owner can authorize the transition to the next pitch under the same PA. The next physical action explicitly references the resume receipt; its replay rederives that receipt and uses the composed timeline as `beforeTimeline`. The PA frame and per-pitch starting World must remain separately authenticated: the later reset World cannot be retrospectively labeled the original pitch frame. No caller-supplied timeline is admitted.

The registered episode must exist before its physical work. The completed historical foul fixture can prove evidence, but cannot be retroactively registered as causally owned. A causal test needs a fresh original execution with the new runtime capability accepted before field/controller work.

The v1 runtime's `(gameId, playId)` uniqueness and permanent admission fence cannot express this handoff. Add an explicit versioned episode lifecycle whose identity includes the original physical pitch, with one predecessor resume and one successor pitch. It must retain the old runtime/admission/fence archives and reject aliasing across the PA. Do not delete a runtime, drop a fence, loosen v1 uniqueness, omit a producer from membership, or grant a generic bypass. A legacy source without the new capability must continue to reject after the original registration.

This requires scoped changes in the physical pitch replay/admission owner plus `ActualLivePlayRuntime`, `SqliteActualLivePlayRuntimeStore`, `ActualLivePlayFence`, `ActualLivePlayOwnerMetadata`, `ActualLiveRuntimeRegistration` and queue/consumer census. Proposed concrete coordinator: `SamePlateAppearanceContinuation` with Native reader/store and explicit versioned runtime origin. It does not call `ActualFirstBasePlayEnd` or increment PA identity to escape the fence.

## Participant work and fatigue: one accounting path

The current continuous-pitch runtime computes temporary pitcher fatigue from the authenticated active physical pitch prefix; it writes no global workload. Its existing count-chain validator already accepts actual ordinary-foul timeline events. The current actual-role owner instead applies one independently accepted TOTAL closed-play assessment per participant. These are different execution/accounting contracts, not quantities to add together.

For the new same-PA capability:

1. Retain all accepted physical pitch sequences and all actual participant work across foul episodes in a PA coverage manifest. Each episode keeps its exact original prefix/whole-history references and origin; a reset never erases work or manufactures traversed paths.
2. Require explicit accepted cumulative TOTAL effort assessments for all original participants when the new actual-role execution basis is selected. Bind each to the exact covered PA prefix, participant/person, assessment and calibration provenance. Missing assessment or workload baseline leaves resume readiness pending. No effort estimator, weighting, default zero, fatigue threshold or new policy value is introduced.
3. Before the new PA capability begins physical work, reserve the workload scope for every original participant and freeze its actual global baseline revision/hash. A provisional view always derives from that same reserved baseline plus the authenticated cumulative unsettled TOTAL, using the existing workload/recovery calculation. Never rebase over an intervening global activity/recovery or apply the cumulative total to a previous provisional AFTER. The view is not a persisted revision. Every participant execution route must require the current authenticated view; an uncharged global baseline is not an alternate body/decision/pitch execution input after work has accrued.
4. For this versioned execution basis, cumulative actual-role effort already includes prior pitch work. Do not additionally add the legacy `effortUnitsPerPhysicalPitch` prefix. Keep the legacy continuous-pitch path unchanged for legacy sources; forbid ambiguous/mixed execution bases.
5. Foul resolution/resume itself writes no global `MATCH` workload activity. Retain one final durable PA charge per participant, derived from the final total coverage and existing accepted calibration. Under the reservation, final settlement must prove its actual BEFORE still equals the reserved baseline and apply through the existing Player workload owner exactly once. The final durable AFTER must exactly equal the projected AFTER computed for that same baseline, final TOTAL, activity identity/day and policy. The existing v1 settlement-time contract remains unchanged; this stronger condition is explicit for the new reserved PA variant.
6. Keep the canonical career/game/PA/player charge identity and bidirectional actual-role/legacy exclusion. Extend raw-mirror/archive guards for the new versioned references; moving IDs or corrupting one producer row must not permit a second charge. Replays/retries neither reapply prior episode work nor charge both the legacy pitch aggregate and actual-role TOTAL.

The reservation is an owned durable capability, not a comment or unchecked mutex. Its identity includes career/participant and PA lineage. All relevant global workload writers, including recovery and the legacy pitch producer, must reject conflicting writes while it is active. All body/decision/pitch execution admission paths must reject an absent, stale or foreign reserved execution view. Merely noticing a changed head at final settlement is insufficient. The reservation is released only after all required participants have the exact final durable effects and the PA transition is complete; crash/retry during partial settlement keeps the fence and authenticates already applied rows.

The first version explicitly leaves interleaved global work/recovery unsupported and pending. It must not silently defer an event to a different effective time, discard it, or treat recovery as commutative with accumulated effort. Any future ordered-recovery support needs an authenticated event sequence and proof that folding the same ordered work/recovery inputs yields the exact eventual durable settlement; that is a separate reviewed extension. Reservation acquisition after earlier unreserved PA work cannot retroactively prove exclusion. A new complete same-PA fixture must opt in from PA start.

The existing actual-role Source is hard-coded to an actual first-base end and closure. Its new PA/episode reference variant must be explicit; a foul end is never labeled `actual_first_base_play_ends`. Reuse the settlement/recovery mechanics and qualified workload ownership, not that first-base proof. This extends `ActualRoleWorkloadAssessment`, its context reader/metadata/charge guards, and the versioned continuous-pitch execution basis. No global Player workload engine replacement is needed.


## Repeated batted pitches retain a separate geometry constraint

A second batted pitch cannot yet reuse the first episode's bound field geometry. `SqliteBattedWorldBaseGeometryStore.ts:121` has a per-game UNIQUE owner whose Source pins `flightSourceId`. `SqliteBattedWorldFieldStore.ts:308` likewise has per-game UNIQUE geometry, and its root validation requires that bound flight to equal the actual new flight. `SqliteBattedWorldContactStore.ts:213` and `SqliteBattedContactResponseStore.ts:134` also freeze game-level world/response models. Flight histories themselves are scoped per physical pitch, but that does not remove the geometry/model ownership restriction.

The first original-intent slice changes none of these owners. Before claiming two real foul episodes under one PA, the lifecycle work needs a separately reviewed versioned per-pitch/episode binding that can reuse explicitly accepted venue calibration without reusing an old flight's dynamic context. Keep every v1 uniqueness constraint, archived model, geometry and flight reference intact. Do not drop a UNIQUE constraint, overwrite an existing game model, rotate geometry, or relabel the second pitch as the first. This is a required dependency of the repeated-foul acceptance test, not an already supported case.

## Ordered implementation boundaries and acceptance

1. Review this contract; implement only the original intent opt-in with test-first Source/replay contracts. Preserve all legacy pitch bytes. Prove two equal physical swing curves with separately accepted ordinary/bunt intents remain distinct owned choices, and that a legacy generic curve cannot provide either choice.
2. Implement the owned foul consequence over a new genuine registered physical fixture. Verify unknown intent stays pending; explicit ordinary and bunt cases use existing Core count behavior; original physical/policy/contact hashes remain unchanged; no first-base or official PA closure is produced as a shortcut.
3. Implement the versioned same-PA lifecycle, reset and pitch replay together with complete participant work/fatigue coverage. Until every required proof exists, next-pitch admission must fail. Prove a real third-pitch ordinary foul at two strikes followed by a real fourth pitch under the same PA and batter, with the full original event/count chain and one closed predecessor episode. A two-strike bunt foul must not resume.
4. Prove accounting on a PA containing more than one genuine foul episode: all actual pitch and role work remains in coverage, execution uses exactly one fatigue basis, global workload remains unapplied during continuation, and final PA settlement creates exactly one activity per participant. Missing participant evidence, stale baseline, incomplete settlement, duplicate/aliased assessment and both cross-owner charge directions must reject. No numeric fixture calibration is invented; reuse accepted fixture policy inputs or explicitly supply independently accepted assessment inputs.
5. Add WAL mutation, trigger rollback, same-Source retry, hidden scope mirrors, exact-time and complete real-file close/reopen checks at each concrete owner. A late same-tick event or unresolved official consequence must prevent the corresponding handoff. Keep v1 first-base/adjudication/fence tests unchanged and passing.

Only after those contracts and observed REDs support each slice should successful behavior be implemented. This plan deliberately exposes the lifecycle and workload work required for a real resume; a lone count write cannot complete it.

## Inputs still required

No new baseball rule value or venue treatment is needed. Future original executions must supply explicit owned batting intent. Resume also needs accepted canonical setup and original-participant workload baselines/assessments with real provenance. Existing generic-swing archives lack the first fact and cannot be repaired by choosing a default. Missing or unconnected inputs remain unresolved; they are not calibration values to invent.


## First slice contract cut

`OriginalBattingIntent.ts` currently exports only the proposed versioned input/result types and a throwing `deriveOriginalBattingIntentEvidence` scaffold. This extraction helper assumes its pitch was already authenticated by the existing Native owner; it cannot replace that read. The Native tests use actual owner reads, and complete close/reopen uses a new readonly file connection and original-prefix rederivation without callbacks.

`OriginalBattingIntentFixtures.test-support.ts` prepares the existing original actor/calibration and the same stationary bat placement as `BattedBallFlightFixtures`, with no new numerical values. It proves the physical contact preview before attempting the new Source. The new physical pitch is accepted inside each behavioral test, never hidden in successful-fixture setup.

`OriginalBattingIntent.test.ts` has 20 cases. At the current pre-implementation cut the exact intended result is eight failures at the existing `physicalPitchActionInput` rejection of the new valid intent member, one legacy-absence case failing at `ORIGINAL_BATTING_INTENT_NOT_IMPLEMENTED`, and eleven rejection-only passes. The eight Source failures cover both explicit attempts, full retry/reopen and post-acceptance integrity cases whose initial valid declaration cannot yet be accepted. Those later assertions remain unexecuted until GREEN. The fixture's actor/Core-contact preconditions must pass; any different error is not the intended RED. The eleven passes do not prove the new intent validation.

The first implementation is limited to that original-intent Source member, original actor/action/contact binding and extraction. No foul count, same-PA resume, workload reservation, geometry migration, new live capability or closure behavior is authorized by the first-slice review.


The corrected fixture-lifetime cut `0688071b2c05855e4343d6bbf26094e639795f8a` produced the expected 20-case RED: eight original Source-shape rejections, one extraction-scaffold failure, eleven rejection-only passes and no skipped/fixture/other errors. Source/control hashes were unchanged; actual heap was 1120 MiB, peak aggregate RSS 413,648 KiB, duration 9.956 seconds, and the process group was reaped. Receipt SHA256: `c8acb9c92d78c964c3e8beb7028139049060c8e2d8b1bd7169e355bd7be319bb`.

The implementation candidate adds only the optional versioned Source member, strict inert shape/action validation, a required match to the original frame actor before physical execution/replay, and extraction from the authenticated original contact event and physical contact result. Legacy absent members are not inserted or assigned a default. Existing immutable Source retry comparison rejects later attachment. The 20 tests remain unchanged for the first GREEN; all later lifecycle/workload/geometry changes remain unimplemented.
