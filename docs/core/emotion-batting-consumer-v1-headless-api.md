# Emotion batting consumer v1 — headless API

Approved continuation of PR38, using psychology05 at782f6b8 and the existing Swing Kinematics/rigid contact owners from PR27 at7b1b84a. UI/design/rendering remain excluded. The new public entry is `src/core/world/psychology/batting/index.ts`.

## Operations and adoption

`prepareBattingExecution(current)` consumes the CURRENT accepted emotion execution, matching gate/frame and actor-owned `BattingSource`. It returns a detached, deeply frozen proposal or structured issue. `WAITING`, `MISSED_WINDOW`, `MISSED_COMMITMENT`, `NO_OBSERVATION`, `STALE_PREDICTION`, `UNRESOLVED_PREDICTION` and `MOTOR_WINDOW_MISSED` are explicit non-ready results, NOT automatic takes/misses.

`acceptBattingExecution(current, proposal)` recomputes the complete proposal, requires READY, and returns the expected world/gate versions plus one physical-pitch action key. The host must atomically check versions, persist the complete commitment and globally deduplicate this key. Changing source IDs cannot create another action for the same career/match/player/play/pitch/ball. Consistency is not source authentication or a persistent exactly-once service.

`resolveBattingExecution(physical)` validates the saved acceptance, current scope/gate/frame and current canonical plate-appearance cursor, then resolves the frozen intent against separately supplied ACTUAL aerodynamic flight. Call it at the exact motor-onset tick, or decision tick for TAKE. It returns `BattingPhysicalForecast`, including the unchanged committed trajectory and the existing canonical take/contact/miss resolution. This forecasts future events: it does not insert a future strike/contact now, write a database or advance the entire world. Schedule/revalidate physical events at their own ticks, honor interrupts, and update Core truth and observation together.

## Temporal and information contract

`observedTick` is the newest underlying observation incorporated into a prediction, `availableTick` is when its result becomes usable, and `validUntilTick` is its decision-time validity. Choose the greatest observedTick among predictions delivered by the commitment cutoff. Late delivery of an older observation cannot displace a newer one. Future observations cannot change the frozen commitment. An expired latest usable prediction produces explicit unavailability, not fallback to actual flight.

Predicted future trajectories may extend beyond decision time; their INPUT evidence must not. The host authenticates this information cutoff, the complete observation set and timestamps. A stamped prediction cannot by itself prove that hidden true-ball information was excluded.

The existing planner produces the preferred motion from that prediction. Technical phase error shifts its whole trajectory independently. Actual motor onset is `max(preferredStart, bodyReady, decisionTick + motorLatency)`. Earlier commitment need not advance preferred onset; later readiness shifts start/contact/end together without changing corresponding phase geometry. Source/profile validity must still cover onset. Prediction expiry after commitment does not retroactively erase a frozen plan.

The same accepted gate influences commitment time and aggression only once. AUTO uses perceived swingScore plus the accepted change from the emotion-free aggression baseline, bounded to0..1. TAKE/SWING directives are caller-authorized intent, not computed rule permissions; forced SWING still needs prediction geometry. Aggression chooses one source-provided feasible profile. No trait-name ability bonus, contact probability, speed multiplier, new body simulation or actual-flight replanning is added.

## Physical contract and guardrails

All supplied clocks use source ticksPerSecond. Ball mass/radius, pitch identity, count, play and timeline cursor must agree. Body readiness, motor latency, repertoire, thresholds and nominal technical timing are versioned source/calibration inputs, not production defaults. The selected trajectory must fit the actual physical interval; interval exhaustion rejects rather than truncating the swing or silently awarding a result.

Sweet-spot speed is certified across BOTH continuous Hermite segments, not just the three knots. The quadratic derivative's convex hull is subdivided at most12 levels. An over-limit or numerically uncertifiable profile rejects; this conservative certification does not clamp speed or generate a second trajectory. Limits64 predictions,32 profiles and100000 integration steps per supplied flight are implementation work bounds, not baseball laws. Additional body/joint/pose feasibility is source-owned.

Contact uses the EXACT existing tapered rigid-bat search and `NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1` response. Its evidence ranges/default behavior are inherited, not recalibrated here. Optional undefined fields emitted by trusted Core output are omitted before finite/inert validation; undefined/functions/getters remain forbidden in external requests. Quaternion normalization and physical validators are reused.

## Integration and remaining responsibility

This is a working opt-in commitment + physical library consumer, not migration of all match coordinators. PR27 itself and its full commanded/catcher-led orchestration remain separate. See `emotion-batting-reused-sources-v1.json` for24 exact reused files, including five upstream test files. Twenty-three paths are new to this stack; existing `BatBallContact.ts` receives the upstream compatibility name plus retained old-name alias, with its legacy math unchanged. Other existing modules and all rendering remain untouched.

Host responsibilities: current authorized directive, genuine emotion-free baseline, immutable source/model IDs, physically feasible current batter pose/repertoire, perception generator, canonical history authenticity, whole-world scheduling/interruption, event application at physical time, cross-owner atomic persistence and global deduplication. Neither forecast equality nor test success supplies those services. Calibration, remaining traits/team systems, competitions, development/scouting, manager/world/economy and end-to-end career verification remain queued.
