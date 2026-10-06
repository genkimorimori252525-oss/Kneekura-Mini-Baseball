# Visible contact → partial tag-up wait → future Native runner braking

**Status: proposed contract for independent review; production forbidden until review and relevant observed RED.** Source base is frozen readiness `e67d74dba5e7253f7bfd14e50ab2d0eead167efc`. This new branch adds contract/spec/test-only files. It does not change that source, its held controls, legacy data or any production behavior. No runtime, compiler, SQLite or locks have run here. Revision follows scoped review of preserved contract 201543d; changes are confined to this spec and test-only interface definitions.

## Intent and bounded choice

The existing general runner plan needs a genuine first selected decision that can feed owned motor adoption. The smallest recommended positive is conservative `hold/tag_up_wait` from recipient-owned recognized bat contact and a potential-fly interpretation. That decision must eventually feed the planned future Native runner issuance/adoption owner in general runner plan §3, using the existing Core braking/controller kernels and original route. Native runner issuance/adoption does not exist on this cut; defender locomotion is not a substitute. `tag_up_wait` remains active policy work even after velocity reaches zero; it is never SAFE, retirement, settled-for-play or PlayEnd.

Visible bat contact does not prove fair live force. The initial original public occupancy remains a prior, not an activated rule result. Keep fair/foul and force explicitly unavailable. Nondetection does not establish no catch, no force, no restriction or an uncovered base.

Two options were compared:

| Option | Result | Additional dependencies |
| --- | --- | --- |
| Versioned partial wait path (recommended) | Actual existing hold/wait choice while lower-priority force/cues remain unavailable | Recipient contact/loft recognition, prospective event view/model, explicit partial-context guard |
| Wait for full perceived fair/force context | Preserve current all-boolean input interface | Genuine perceived fair/ground-versus-first-touch knowledge, appropriate belief transitions, self contact history where needed, and a real threat/race producer before general empty-cue fallback |

The second option remains necessary for later ordinary advance/hold decisions. It need not block a fully justified higher-priority conservative wait. The first option has strictly less decision authority and must reject access to the lower-priority branches.

## Core contract: additive partial entry, shared selector and timing

`RunnerPartialTagUpWaitContracts.test-support.ts` defines the proposed shapes. The existing `RunnerDecisionInput`, boolean `forcedToAdvance` contexts and existing `decideRunnerMotionIntent` behavior remain supported unchanged.

Add a versioned partial entry `decideRunnerMotionIntentFromPartialContext`, accepting `RunnerPartialTagUpWaitInput`. Its known context has original current/next base, justified `awaiting_first_touch`, and tagged unavailable force with reason `fair_foul_unresolved`. Cue production is explicitly unavailable. It has **no `forcedToAdvance` boolean and no `perceivedCues:[]` success claim**.

The implementation must extract/reuse the existing tag-up priority choice and final timing/result construction inside `RunnerDecision.ts`. Both legacy and partial paths call the same hold/retouch priority logic and `resolveRunnerDecisionTiming`; do not reproduce their algorithm in a second selector or convert partial input into legacy input with a made-up boolean. Version 1 accepts only `awaiting_first_touch`. Legacy `must_retouch` remains unchanged; a later partial-retouch version requires genuine available own departure/retouch and first-touch evidence and is outside this slice.

Validate exact version/fields, original adjacent base context, observer/runner identity, available observation time, existing decision parameters and the two tagged unavailable states. Reject unknown versions, `none`/`must_retouch` in this version, any supplied force boolean, inline cues or substituted cue status. Unavailable force can never enter forced-advance, coach/race selection or `no_actionable_evidence`. A wait-only source cannot clear its tag-up state into a generic ready input.

The partial result is the existing complete `RunnerMotionDecision`: hold, tag_up_wait, recipient evidence availability, existing cognitive delay and decision tick, null perceived race margin. Preserve separate future motor reaction delay. Do not issue/adopt a motor before its actual decision/reaction time.

## Explicit Player sensor policy

`AcceptedRunnerVisibleContactWaitPolicy` is an immutable, prospectively accepted Player policy linked to original career/Player/Person/day and an already accepted `PlayerObservationModel`. No coefficient, confidence or time is a production default. Spatial geometry/quality/error/refresh/memory comes directly from that existing model; it is not rebuilt from runner decision ability or borrowed from the umpire.

The required additional fields are explicit:

| Parameter | Validation and purpose |
| --- | --- |
| `minimumContactRecognitionConfidence` | Finite [0,1]; recognition gate for both observed collision features |
| `maximumEstimatedContactGapMeters` | Finite nonnegative; distinguish recognizable paired ball/bat contact estimates |
| `minimumLoftRecognitionConfidence` | Finite [0,1]; required confidence of the fresh outgoing ball estimate |
| `minimumHeightAboveGroundMeters` | Finite nonnegative; estimated height must strictly exceed it |
| `minimumUpwardVelocityMps` | Finite nonnegative; estimated upward speed must strictly exceed it |
| `groundReferenceHeightMeters` | Finite accepted field reference; never assumed zero |
| `timingErrorParameters` | Existing `TemporalObservationErrorParameters`, with explicit detection threshold and finite ordered nonnegative error range |
| `sensorDelayTicks` | Explicit nonnegative safe integer; sensor availability after capture, separate from cognitive and motor delay |
| `ticksPerSecond` | Positive safe integer, equal to original physical/model clock |

The policy's `paired_visible_contact_and_loft_estimates_v1` semantics are deliberately limited. A fully authenticated actual BatBallContact is a **sensor candidate**. The sensor obtains actual ball and bat-contact-point geometry/velocity at that event from its owned original physical inputs. Both features must have modeled surface visibility and nonzero FOV/occlusion visibility. Reuse `evaluateObservationGeometry`, `estimateOcclusionVisibility`, `composeObservationQuality` with instantaneous duration zero, and the existing spatial and temporal capture laws. **Every required spatial and temporal capture independently requires totalQuality > 0**, in addition to nonzero visibility and its accepted detection/recognition thresholds. Zero thresholds never authorize a zero-total-quality capture. Required captures are outgoing ball, bat contact point and contact timing. A missing temporal sample blocks recognition/readiness even when both spatial samples exist. Do not interpret a missing timing estimate as exact time, a zero error or an available event.

Only the recipient's detected estimates/confidence reach classification. Recognition requires both features to meet the accepted contact confidence and their estimated separation to meet the accepted gap threshold. Potential-fly wait requires the fresh noisy outgoing ball estimate to meet the accepted height/upward-motion/confidence criteria. It means **potential catch requiring conservative first-touch waiting**, not a confirmed catch, fair ball, true future trajectory or true ground history. A miss, stale/predicted-only sample, unclear contact, blocked visibility, zero total quality, missing temporal sample or unrecognized loft cannot be promoted into this ready branch. Temporal quality is the minimum of the two required feature total qualities, then checked independently for strict positivity and the accepted temporal threshold; use that quality in captureTemporalObservation. The strict loft comparisons preserve positive estimated height/upward speed even when both accepted thresholds are zero.

This policy must be independently reviewed as new sensor interpretation before implementation. Existing spatial sampling alone does not establish it. It may be fallible under noise; rule truth is never substituted to make classification correct. Dedicated recipient/perception RNG streams preserve replay and keep physics independent.

`captureTemporalObservation` supplies the existing timing-error law; its estimate may lie before the clock origin. Preserve that estimate without clamping/backdating and use **actual sensor availability**, not the estimated event time, to schedule decisions. Native communication laws remain separate: an actual OUT/SAFE callout is never cast into coach advice or a bat-contact message.

## Prospective view and non-backdated availability

`AcceptedRunnerEventView` binds the original open actor, game/Player, policy, body-relative eye and world-axis forward direction, contact attention and an exact validity interval. Its owner must accept the policy/model and view **before the dependent pitch/action is admitted**. Validate Person/day/clock through existing owners and original actor/current frame. A Source with a past validFrom tick accepted after that action/event already exists must reject.

View ownership is not a caller-supplied eye position or visibility boolean. At event time the sensor reads the actual owned body and adds the accepted relative eye offset. It must reject uncovered interval/attention, foreign identity, changed model and unsupported surfaces. A current endpoint pose cannot be used to reconstruct an earlier contact perception.

Register the event-time sensory receipt at the fresh zero-horizon original contact before dependent physical advance. The receipt owns the captured samples and availability. For nonzero explicit sensor delay it is scheduled until due; early knowledge/decision consumption rejects or remains specifically unavailable. Physical progress under an already owned old controller may establish due time, but it cannot be described as an advance caused by an unreceived decision. No receipt may be registered after an advance and then authorize that earlier motion.

Sensor eligibility is exact actual capture moment plus accepted delay, with safe-integer arithmetic and exact clock. The noisy contact-time estimate is metadata only and never determines capture, eligibility, registration or decision time. Stored receipt admission state/history is immutable. A later availability projection derives actual time from a references-only owned cut; it does not overwrite scheduled status or samples. The concrete Source, receipt, projection and consumer contracts below define ownership and timing.

## Concrete Native Source, receipt and consumer

The test-only contract declares RunnerContactPerceptionSource. It contains only source identity/version and references to physical pitch, original actor/runner, recipient, zero-horizon world contact, public baseline, prospective view, policy, observation model and runner decision-motion model; initial predecessor is null. No caller event label/index, clock, availability, eye position, estimate, force/tag-up, cue, action or result is accepted. The sole event is reconstructed from that contact root's actual BatBallContact and original accepted physical input.

RunnerContactPerceptionReceipt binds the original actor, pre-pitch runner/controller hash and motion revision, recipient game/play/career/Player/Person/link, actual event hash and ten rederived dependency hashes. Actual captureAt and registeredAt both equal the freshly admitted original-contact cut (elapsedSeconds=0); the stored receipt cannot claim an older registration clock. Required spatial/temporal samples are recipient estimates, never truth. Every successful required total quality is strictly positive.

- unavailable: an authentic capture attempt failed visibility, a required spatial/temporal capture or classification; recognizedEvent and availableAt are null; no decision input/result is exposed. Invalid/foreign/missing Source dependencies or missing accepted policy parameters reject instead of being relabeled a successful unavailable capture
- scheduled: every required sample/classification exists, but actual sensor delay is not yet due at admission; retain immutable samples/eligibility and expose no selectable Player input before due
- available: every required sample/classification exists and actual sensor eligibility has been reached at admission

These states describe actual sensor work; do not add an owner solely to save missing-calibration pending results. Persisting an authentic failed capture attempt is distinct from inventing a capture when its required model/view never existed.

RunnerContactPerceptionAtCut rederives the immutable receipt and projects availability using only an owned original-contact or retained-runner-field-pieces Source reference. Actual evaluatedAt comes from the reader; there is no caller time argument. Scheduled becomes available in that projection only when the exact actual cut reaches availableAt. The archived receipt/source/hash never change merely because time passes. Raw Native archive samples/classification remain internal: the recipient projection exposes only Source/hash/work status and due time while scheduled, with captures/recognizedEvent null. Unavailable projection likewise exposes no recognized event. Only the available arm releases captured estimates/classification; do not pass the raw scheduled archive to Core. Historical projection replays the same original capture and bounded cut; fresh consumption additionally authenticates current heads/open frame.

RunnerPartialWaitSelectionSource refers only to the perception receipt, public baseline, runner decision-motion model and actual evaluation cut. The consumer joins original event/actor/runner/controller, recipient/Person, game/play/day/clock and exact dependencies on one native connection. It reuses the same existing public/model/self owners; no new supplied dependency facade or global cache. Current mode rejects stale progress/cuts; historical mode rederives saved identity without granting a new late admission.

Only an available, recognized receipt can yield the partial input and existing Core hold decision. Prediction/memory is resolved at the actual evaluation/consumption cut, at or after sensor eligibility. That actual causal consumption availability is the perceived observationTime and tag-up-wait evidenceAvailableAt; neither is a noisy estimated event tick. If a new consumer first runs after eligibility, it uses its actual later cut and cannot backdate observation, cognitive decision or issuance. Preserve receipt Source/hash, selection Source hash, exact input/decision hashes, public/model hashes and evaluation cut/time for the later Native issuer. Selection has issuance/adoption explicitly not_owned; it is not an issued motor receipt. A future issuer must own selection/issuance causally and cannot create an earlier selection record retrospectively.

## Atomic fresh admission versus historical replay

readOriginalContact authenticates historical event-time bodies and is insufficient to authorize fresh registration. Fresh prospective-view/model and sensor writes must additionally use one BEGIN IMMEDIATE/native transaction with existing original actor open-frame and live-play fence/admission guards. Authenticate the current actor/Match revision/play and relevant physical_pitch_progress_heads, batted_ball_flight_heads and batted_world_contact_heads before and after owner INSERT and admission/journal writes. Reconstruct scoped ownership through existing owners/metadata discovery; changed indexes or aliases must not hide later progress.

Prospective view registration requires the dependent pitch/action not to exist in the original actor/play scope. Its policy/observation model must already be owned and the same hashes retained in the view. A model/view record inserted later with an old accepted day/validFrom timestamp cannot establish earlier ownership. Check this again inside and after the write, including trigger changes.

Fresh sensor registration requires the current pitch/contact/zero-search-flight heads to be exactly its original root, the original frame still open, and no relevant field, motion, continuation, execution/adoption or other dependent physical progress beyond that root. Compare exact moments and Source/revision/ordinal identities, not rounded tick alone. Capture/register before any dependent advance; opening a historical root after later field progress does not restore this eligibility. The guarded physical-head census must remain unchanged through receipt/admission writes; only declared own receipt/head/journal deltas are allowed. Recheck view, policy, models, actor, runner/controller, original public baseline and self/event dependencies after writes on the same connection.

Late fresh registration rejects without deleting later physical evidence. Same-attempt frame/head/dependency mutation during owner or journal INSERT must roll back every own row/head/journal delta. A qualified retry of an already saved unchanged receipt is historical/idempotent and creates no new backdated ownership; changed Source/dependencies reject. Historical read/replay of an authentically admitted receipt remains valid after lawful later progress and full close/reopen, subject to original immutable dependency verification.

## Required sensor/admission controls added by review

1. Visible features with positive visibilityQuality but zero totalQuality, with every detection/recognition/classification threshold zero: no required capture may qualify, no recognition, no input/decision. Configure valid explicit quality weights producing totalQuality=0; do not turn this into invalid-policy setup failure
2. Positive spatial captures but absent temporal sample: unavailable/temporal_not_detected, with null ready input/decision and no zero-time fallback
3. Sensor eligibility and first consumption at nonzero exact actual time; noisy event-time estimates on either side of that time do not change availability/decision timing. Scheduled/unreceived evidence cannot choose motion
4. Genuine root-time admission followed by later field advance: valid historical receipt/selection replay and full-close/reopen remain identical; fresh registration of the past event rejects
5. Physical head advance or original frame closure before sensor admission; same-attempt model/view/controller/frame/head mutation during receipt or journal INSERT; every failure preserves peer evidence and rolls back own deltas
6. Capture receipt and selected Core decision identity survive the handoff; no Native issuance/adoption claim until the future general-plan §3 owner has separately been implemented and verified

## Genuine zero-horizon fixture and staged gates

Base the new test fixture on the legal registered `npb-2026` walk → next actor flow from `OwnedRunnerFieldNativeFixtures.test-support.ts`, not on rewritten Match/World snapshots. Split the fixture construction at the prospective boundary rather than calling its completed helper and backfilling earlier inputs:

1. Use `physicalPlateAppearanceActorFixture`, accept the first actor, execute four real taken pitches producing a walk, and submit the lawful non-live closure/next activation. Accept the next actor with exactly one original first-base runner.
2. From that actor's original roster/Player/Person/day, prospectively accept the existing observation model, the explicit semantic policy and contact view/attention interval before accepting the next physical pitch. The new view owner must witness this ordering, not trust a caller's old timestamp.
3. Prospectively supply the original runner/controller and actual swing/pitch/world-model inputs. The fixture may choose explicitly synthetic measured/calibrated parameters, but may not mutate accepted sources or manufacture contact/capture results. Pin the actual intake available on this cut: the fixture supplies BatterSwingWindow to the existing sampleCompatibilityBatterSwingState (sampleBatterSwingState compatibility alias) through the existing continuous pitch/contact producer. This proves only that bounded, prospectively supplied compatibility-window intake and its actual contact. It does not prove newer SwingKinematicsV1/autonomous/native batter generation. A newer authority that is unsupported or not yet qualified is a separate setup prerequisite, never semantic RED. Do not replace the fixture producer or claim broader intake.
4. Execute the real physical pitch/contact. Accept flight with `searchDurationTicks:0` and `owned_runner_contact_v1` world-contact root. Assert original prefix and `readOriginalContact` are at elapsedSeconds=0, with eleven unique bodies/55 parts and exact original controller identity.
5. **Before any field advance**, authenticate and register the event-time sensor from that root and the preexisting view/model. Assert actual fresh detected paired features and the accepted loft interpretation. A prerequisite mismatch is setup failure, never intended capability RED or a forced desired classification. No positive loft/recognition fixture currently exists; construct and witness it honestly through this pinned compatibility-window intake. Failure of a proposed newer batter authority is setup failure and never satisfies semantic RED.
6. Consume the available recipient semantic receipt with original public current/next base and exact accepted runner decision parameters. Force/fair-foul and cue production remain tagged unavailable. Compare the whole selected hold decision to the shared Core wait/timing result.
7. Preserve that decision/perception identity for the subsequent owned decision issuance/motor slice. Advance only actual old motion to due decision time, authenticate the actual self/controller cut, hand the preserved identity to the planned future Native runner decision issuance/adoption owner (general-plan §3), which must issue the hold without backdating and separately prove adopted braking after motor reaction. That Native owner is missing here. Selecting a future decision is not already issuance/adoption.

Stage the missing partial-entry boundary on the existing `RunnerDecision` namespace first. It has no new production import, DB or fake implementation. After source review, run it only in a released bounded slot and qualify an actual missing-function assertion. Then stage guards/legacy compatibility around the Core partial path; sensor policy/view acceptance and genuine Native recognition need their own TDD controls before production behavior. No test or compiler was run for this contract.

Required adversarial controls include: no/bad/backdated prospective view; model accepted after the dependent action; missing temporal/recognition inputs; same-clock rounded-tick but different exact event; future/foreign event and recipient; zero FOV/occlusion even at zero detection threshold; unavailable surfaces; stale/predicted-only data; delayed/scheduled/unreceived recognition; unavailable force with generic tag-up state; injected booleans/cues/outcomes; unchanged legacy known-boolean choices; duplicate semantic ownership and trigger mutation/rollback; complete file close/reopen. A later actual first touch or retirement that was not received cannot silently clear wait or update force.

## Handoff and completion boundary

Approval of this contract does not prove sensor visibility or accept production calibration values. Implementation requires independent contract review and relevant observed RED on a new isolated cut; current e67d74d and its controls remain frozen. The first positive deliverable must include a genuine recipient receipt and actual Core hold decision, with a concrete identity-preserving handoff to the planned future Native runner issuance/adoption owner from general-plan §3. Existing Core braking/controller functions alone do not prove Native issuance or adoption, and initial defender locomotion must not be substituted. Generic advance, retouch adoption, cue/race scanning, fair/force completion and terminal SAFE settlement remain subsequent real dependencies, not defaults filled to escape pending.
