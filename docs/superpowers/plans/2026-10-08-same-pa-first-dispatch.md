Approved implementation inventory: parent acceptance 2026-10-08 17:26 UTC. Original reviewed document SHA-256: `3d4c27a2539806ae11855fa0859b5787cb6158f2a44507f10a666cec40f91fe1`. Numerical calibration selection and genuine execution remain behind concrete accepted packets.

# First same-PA dispatch: concrete implementation inventory

This is a review proposal for the next implementation step under the accepted `0a663946e80992636c8a5e68d2355d1e219dddf043c6d160a8186133edd7d3da` contract. It selects no numerical calibration or fixture values and enables no kernel. Historical evidence is separately implemented at source tree `32e3b09c540c870361a7df897ee080b8a4e61c28`; current empty-prefix preparation remains unchanged. The genuine empty prefix has closed successfully. Its ten TOTALs and all-ten execution view still require their own normal owner gates.

## Exact namespace and ownership order

Use only these ten new tables in the `pa_dispatch_v1_` family:

1. `pa_dispatch_v1_action_plans`
2. `pa_dispatch_v1_execution_calibrations`
3. `pa_dispatch_v1_consumer_sets`
4. `pa_dispatch_v1_episodes`
5. `pa_dispatch_v1_rights`
6. `pa_dispatch_v1_consumer_actions`
7. `pa_dispatch_v1_pitch_actions`
8. `pa_dispatch_v1_pitch_heads`
9. `pa_dispatch_v1_consumptions`
10. `pa_dispatch_v1_episode_admissions`

There are no new objects in either `same_pa_*` or `reserved_pa_*`. All ten absent is pristine; successful first accepted action bootstraps all ten exact schemas in its owned transaction. Partial, extra, malformed, view, trigger, case-alias and temporary-shadow objects reject; reads/open never install or repair. Exact DDL, column order and autoindex census become code constants with RED tests before the first owner is implemented. No mutable status is added to the old blocked first-pitch slot.

Every immutable record has its own accepted Source identity and source/result hashes, with indexed career, game, play, enrollment and reserved first-pitch identity. Role records also index player and route. Heads are the sole mutable projection and must equal the one accepted pitch. Typed raw identity discovery covers all source/result mirrors and prospective references. New mandatory guard calls precede the old guards' absent-namespace early returns. They inspect surviving dispatch claims even when an older enrollment/provisional root or index disappears; no writer receives a caller-selected exemption. A provisional right/episode never counts as a completed workload charge.

The order is action/calibration -> consumer set -> prospective episode -> immutable right -> execution -> pitch/consumer result rows -> consumption and episode admission. Action/calibration references may precede each other only through immutable enrollment/view and nominal owners, never through a future consumer-set or right. A consumer result may name the already accepted prospective pitch Source identity and right, but cannot reference its future pitch result hash. The pitch result may therefore pin consumer-result hashes; consumption/admission pin the final pitch and consumer results afterward without a cycle. The append, head, consumer results, consumption and admission are one owned transaction.

Canonical keys are: action `(enrollment, first_pitch)`; calibration `(view, player, route, nominal_parameter_identity)`; consumer set `(enrollment, view)`; episode/right `(enrollment, first_pitch)`; pitch `(enrollment, progress_revision=1)`; head `(enrollment)`; consumption `(right)` and `(pitch)`; admission `(episode)` and `(pitch)`; consumer action `(right, player, route, action_ordinal)`. Alternate Source IDs for those meanings reject; exact retries retain original hashes. Action ordinal is derived from the code-owned invocation order, never supplied to omit a consumer.

## Closed Source schemas

All objects require exact keys, inert data, validated integer/domain values and full reference equality. `OwnerRef<T>` is the existing exact `{owner:T, sourceId, sourceHash, snapshotHash}` shape. `Member` is `{playerId, bindingHash, personHash, baselineSourceId, reservedRevision, reservedStateHash, projectedStateHash}` derived from the exact view; the projected revision is never a global revision selector. `Base` is `{sourceId, sourceVersion, enrollmentReference, viewReference, firstPhysicalPitchSourceId}`. Accepted Sources carry no cached actor, World, state, proof, physical AFTER or authoritative output.

- Action Source: `Base + {capability:'same_pa_first_pitch_action_v1', variant:'declared_take_v1', pitcherPlayerId, batterPlayerId, nominalPitch, timingReference, releaseReference, pitchResponseReference, batterModelReference, geometryReference}`. `nominalPitch` contains only the existing delivery intent/physics, flight parameters and TAKE physical geometry inputs, with exact nested v1 domains; career/player/game day/play/pitch index/timeline come from original owners. It excludes workload revision, legacy effort policy, global fatigue, expected result and any geometry synthesized from a former batter. The Source parser rejects extra or missing fields. A swinging action remains typed pending until accepted original intent and per-pitch geometry owners are available; it is not normalized to TAKE.
- Calibration Source: `Base + {capability:'same_pa_execution_calibration_v1', member, route, nominalReference, nominalParameterReference, acceptedAtDay, provenance, response}`. `provenance` is exact `{assessmentSourceId, assessmentVersion, calibrationSourceId, calibrationVersion}`. `nominalReference` pins a real existing model owner; for embedded batting parameters, `nominalParameterReference` is `{parameterKey, sourceId, sourceVersion, sourceHash}` authenticated through that complete batting-model owner, without inventing a standalone parameter owner. Other model routes use `nominalParameterReference:null`. `acceptedAtDay` must not follow the authenticated game day.
- Consumer-set Source: `Base + {capability:'same_pa_consumer_set_v1', actionReference, participantInputs}`. Exactly ten `participantInputs` each contain `{member, calibrationReferences}`. Required role/route membership and canonical order come from the registry below; the Source has no `skip`, `notApplicable`, caller role or caller producer-domain list. Missing accepted inputs yield exact player/route prerequisites; malformed/foreign/duplicate inputs reject.
- Episode Source: `Base + {capability:'same_pa_first_pitch_episode_v1', actionReference, consumerSetReference}`. Its result derives the full immutable role/producer inventory and prospective first-pitch name. No future physical payload is read.
- Right Source: `Base + {capability:'same_pa_first_pitch_right_v1', prefixReference, actionReference, consumerSetReference, episodeReference}`. Result declares only `expectedProgressRevision:0` and one reserved pitch identity. It contains no future result or mutable consumed flag.
- Physical Source: `{sourceId, sourceVersion, capability:'same_pa_physical_pitch_v1', rightReference, actionReference}`. Source ID equals the original reserved pitch ID. Expected revision is code-owned zero. A source hash/ref is never a replacement for the private fresh-admission proof.
- Consumer-action Sources are code-derived accepted-operation inputs under that Physical Source, not caller-supplied receipts. Exact shared fields are `{sourceId, sourceVersion, capability:'same_pa_consumer_action_v1', rightReference, physicalSourceReference, member, route, calibrationReferences, originalInputReferences, actionOrdinal}`; each route has an exact additional input union using its existing Core input domains. Their results retain original and effective references separately and expose which actual calculation ran. No arbitrary callback, cached model or returned physical path is accepted.
- Consumption and episode-admission Sources are code-derived from the accepted Physical Source and right/episode; exact fields are `{sourceId, sourceVersion, capability, rightReference, episodeReference, physicalSourceReference}` with distinct capability literals. Their results reference the committed candidate pitch and invoked consumer rows. Neither is accepted independently to repair a partial commit.

`physicalSourceReference` above is `{sourceId, sourceVersion, sourceHash}` because the prospective Source has no result yet. It is never represented as an owner-result reference until the pitch row exists. Generated Source IDs are deterministic from the accepted Physical Source and code-owned route/ordinal; they do not introduce another user authority or depend on a future result hash.

## Discriminated numerical response domains

The calibration `route` determines `response`, with no generic bag of numbers:

| Route | Exact response variant and existing domain |
| --- | --- |
| `pitch_delivery` | `{kind:'accepted_pitch_response_v1', policyReference}`; existing `PitchFatigueExecution` policy acts on the exact projected pitcher fatigue |
| `batter_observation` | `{kind:'accepted_execution_values_v1', values: AcceptedBattingObservationCalibration['values']}` |
| `batter_decision` | `{kind:'accepted_execution_values_v1', values: AcceptedBattingDecisionModel['values']}` |
| `batter_motor` | `{kind:'accepted_execution_values_v1', values: AcceptedBattingCapability['values']}` |
| `batter_swing` | `{kind:'accepted_execution_values_v1', values: AcceptedBattingRepertoire['values']}` |
| `defender_observation` | `{kind:'accepted_execution_values_v1', values: PlayerObservationCalibration}` |
| `defender_decision` | `{kind:'accepted_execution_values_v1', values: PlayerDecisionCalibration}` |
| `defender_locomotion` | `{kind:'accepted_execution_values_v1', values: PlayerLocomotionCalibration}` |

Use the existing strict validators and numerical domains. No nominal-value copy, interpolation, inferred retention factor or new fatigue curve is allowed. Body, equipment, pose, nominal skill and nominal parameter Sources remain independently authenticated. Actual execution parameters may differ only through the independently accepted effective Source for that exact projected state. A route without a supported Core adapter is reported unsupported before admission and receives no consumption credit.

## Code-owned original-ten route inventory

Membership is the actor's batter plus the original nine defenders. Defender roles come from `actor.world.defenders[].registeredPosition`, with exactly one each of `P,C,1B,2B,3B,SS,LF,CF,RF`; the Source cannot rename or drop them. The pitcher's identity is the original `P`. Existing role/Person/fixture validation stays mandatory.

| Original member | Required prepared calibration routes | Additional execution binding |
| --- | --- | --- |
| Batter | `batter_observation`, `batter_decision`, `batter_motor`, `batter_swing` | Original body/pose/geometry/model; original intent when an admitted action swings |
| Defender `P` | `pitch_delivery`, `defender_observation`, `defender_decision`, `defender_locomotion` | Timing/release/pitch policy; controller adoption/renewal and field execution |
| Each of `C,1B,2B,3B,SS,LF,CF,RF` | `defender_observation`, `defender_decision`, `defender_locomotion` | Controller adoption/renewal and field execution |

This is ten members and 32 prepared calibration bindings. Controller/field application does not apply a second numerical fatigue response: it requires the exact effective decision/motion receipt and the same member/view at the actual command boundary. A `hold` path still validates its actual availability, inherited kinematics, command ancestry and supported calibration. A declaration alone never claims a calculation or physical movement occurred.

The prepared registry and the invoked route set are different evidence. A declared TAKE does not execute swing and does not qualify swing or defender movement. Each actual invocation records its route, effective calibration owner/hash, nominal references, exact input ownership and calculated output. Later observation/decision/motion after pitch work cannot reuse the empty view: it requires supported nonempty-prefix coverage, and remains pending in this first cut. The implementation must still include and test the adapters for every listed route; no public kernel path is enabled while a required adapter is a stub.

## Concrete adapter seams

- Pitch delivery assembles a new versioned frame with separate reserved actual state and projected execution state, applies existing `PitchFatigueExecution`, and invokes the existing physical delivery calculation. It never calls the legacy per-physical-pitch effort increment or selects a global head using a projected revision.
- Observation separates the pure sensory calculation from the nominal durable-model wrapper in `ExecutedFieldObservation`: old callers retain original bytes; the new Native adapter supplies separately authenticated effective calibration and nominal ratings to the same Core geometry/quality/capture/memory functions. It must not fabricate a `DurablePlayerObservationModel` with altered v1 Source fields.
- Decision extracts/reuses the existing candidate selection, `resolveDefensiveDecisionTiming` and `resolveDefenderFirstStepTiming` calculations with explicit effective calibration and authenticated nominal ratings. It preserves perceived-only cues and availability; no World truth or made-up communication enters a decision.
- Locomotion uses the same `deriveRatedDefenderMotionParameters`, `planRatedDefenderRoute`, `buildDefenderMotionTrajectory` and finite trajectory checks with independently authenticated effective calibration. `SqliteActualLocomotionStore.ts` remains byte-protected. An additive adapter authenticates inputs and records new versioned outputs; it never relabels a modified v1 model or command.
- Batter observation/decision/motor/repertoire assemble a versioned execution input from the existing accepted batting-model parameters and the corresponding effective values. Existing Core batting decision/timing/speed/curve validation remains authoritative. Nominal body/pose/equipment stay distinct from the effective calculation; accepted original intent and geometry are prerequisites for an actual swing.
- Controller adoption, renewal and field execution accept only a private proof-bound new-version command derived from the corresponding actual effective receipt. Their public v1 writers remain fenced. The adapter checks that every applied participant command belongs to the canonical set and that its view covers the actual execution cut.

Pure calculation extraction must retain byte-identical v1 outputs under existing inputs. Private Native adapters own all scope and hash authentication; pure Core functions are never treated as durable ownership proof.

## Finite sequence and stopping boundaries

1. Review this exact inventory; implement strict Source/namespace/role validators and missing-input reports before any kernel call exists. Source-only fixtures use explicit accepted values only after their declarations are separately prepared; this document selects none.
2. Implement action/calibration/consumer/episode/right owners with canonical uniqueness and mandatory orphan guards. Test missing one original member, duplicate route, foreign nominal/projected state, moved raw claims, partial namespaces, exact retry and transaction replacement. No physical Source can be accepted yet.
3. Implement actual route adapters and finite output-sensitive tests for each response domain. Show an effective calibration changes the relevant existing Core calculation while original nominal hashes remain unchanged. Keep all-ten implementation and individual genuine qualification separate.
4. Implement the one TAKE physical append/replay with exact atomic row accounting and fresh proofs before/after each write and after COMMIT. The historical reader authenticates the original view for replay; the fresh reader gates admission. Preserve opaque future descendants and acyclic references.
5. Only after source qualification and genuine TOTAL/view prerequisites are closed, propose exact accepted action/calibration fixture Sources and a finite genuine dispatch packet. No new numerical values, physical execution or launch authority is implied here.

Second-pitch dispatch, nonempty prefix, foul resume, settlement and reservation release remain following dependencies of the executable same-PA flow. They cannot be approximated by a new PA, removed fence, substituted batter, default zero or mutation of the old receipt/slot.
