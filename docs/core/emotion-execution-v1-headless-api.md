# Emotion Execution v1 — nonvisual API

## Authority and scope

Entry: `src/core/world/psychology/execution/index.ts`.
Uses the existing PR36 source appraisal, existing EmotionGate, RunnerDecision and RunnerMotion. No alternate emotion/runner/swing engine. No UI, observer wiring, skill changes, RNG draws, hit/out probabilities, scoring or base-touch declarations.

Two operations return the existing `EmotionResult<T>` with structured issue code/path. Inputs and outputs are detached; successful outputs are deeply frozen. Functions perform no I/O and do not mutate a game world.

## prepareEmotionExecution(request)

The request binds `executionId`, `frame`, `beforeEmotion`, `appraisal`, `baseline`, `model`, and optional `runner`.

`frame` is a host-issued current world token: career/match/player scope, context ID, world snapshot ID, world revision and authoritative tick/sequence. `baseline.frame` and optional `runner.frame` must exactly match. The appraisal's scope/context/time must also match, and its revision/policy are checked by the existing appraisal and gate owners. A frame label alone does not authenticate the data behind it.

`baseline.basis` MUST be `WITHOUT_EMOTION`. It carries current source ID/revision, three decision timing windows (baseline tick, earliest feasible tick, latest applicable tick), dimensionless swing/throw aggressiveness and baseline minimum advance safety margin in Core ticks. Do not feed yesterday's modified output back as today's baseline, or relabel previously modified values as emotion-free.

`model` pins model ID/version, `runningRiskTicksPerUnit`, and a maximum safety margin. No production coefficients are provided. These are calibration contracts, not player ratings or real-world measurement standards.

Preparation recomputes the appraisal through the ONE existing gate, then consumes only its selected `influence.effects`. Candidate offers and long-term pressure Trait labels never bypass the gate. A neutral or cleared influence leaves all fresh baseline values unchanged.

### Numerical semantics

- Swing commitment, throw intent and defensive replan: `baseline + selected signed tick shift`. The minimum is the larger of the supplied earliest feasibility bound and current frame tick. The result records both requested/applied shift and whether earliest feasibility constrained it. A result beyond the latest tick is `MISSED_WINDOW`; it is NOT silently pulled back inside the window.
- Swing/throw aggression: add the selected dimensionless delta, constrain to [0,1], report the realized delta. These are future decision preferences, not speed, power or hit probabilities.
- Running risk: positive delta reduces demanded safety margin by `sign(delta)*round(abs(delta)*runningRiskTicksPerUnit)`, bounded to [0, supplied maximum]. Negative delta increases caution. Signed half-ticks round symmetrically. Checked integer arithmetic rejects overflow before clamping.
- Saturation can yield zero realized change in one channel despite an active emotion. The returned influence and realized deltas disclose this. An emotion need not change every possible action.

All six channels have numerical consumers. Only running risk is connected through concrete action/physical owners in this slice. The other five remain typed numerical outputs; no claim of a live batting, throwing or defensive-replan consumer is made.

### Optional real runner execution

`runner` carries source ID/revision/frame, the existing `RunnerDecisionInput`, current `RunnerMotionState`, unchanged `RunnerMotionParameters` and a trajectory horizon `endTick`.

Runner/observer IDs, observation time, body tick and frame must match. The supplied original safety margin must equal the unmodified baseline. Inputs must be inert finite data; fields consumed by the runner owner, attention target, communication chronology, cue kinds and current prediction times are checked. Other unused perception metadata is retained, not claimed to be semantically authenticated. The existing Core owners retain their physical range and decision validations.

Only `minimumAdvanceSafetyMarginTicks` is replaced before calling `decideRunnerMotionIntent`. The original current-base threat, force obligation, tag-up and recognized coach-signal priority remain intact. No new AI or arbitration scheme is inserted. The returned intent drives `buildRunnerMotionTrajectory`; acceleration, speed, reaction, braking, body state and perceived race estimates are unchanged. A decision that would be issued before the current frame is rejected, not backdated. A short horizon may legitimately end before the intent reacts.

The trajectory is a prediction/proposal, not permission to jump the whole game to its end state. Other world events, interruptions, collision/rule handling and later replanning remain with their owners.

## acceptEmotionExecution(currentRequest, savedProposal)

Recomputes the entire proposal from a CURRENT host-selected request and compares all normalized input, gate, output and trajectory fields. Changes to world revision/snapshot, baseline, model contents, appraisal source, runner physics or output reject the old proposal. Getters, extra fields, cycles and non-finite numbers cannot become accepted output.

Success returns `EmotionExecutionAccepted`, execution ID, expected current frame, before/after emotion revisions, after-world-revision and the complete recomputed proposal. The host must atomically compare-and-swap the expected world/gate versions and persist/adopt the source bundle, gate state, gate event and relevant decision/motion together. The revision increment is an adoption token, not a claim the world clock or runner position was advanced.

Repeat checking of the same unchanged request is pure and deterministic. This library does NOT provide database locking, global ID deduplication or persistent exactly-once execution. After adoption, the host must supply the new world/gate versions; reusing the old proposal then fails. The host must also revalidate/invalidate queued decisions when newer source/gate events supersede them before issuance.

A missed timing window remains visible in an accepted data bundle; downstream consumers must NOT execute that timed action. A valid running decision is not automatically rejected because an unrelated batting window expired. This slice does not invent a late-action fallback.

## Replay and future observer

The gate event is the existing `EmotionEvaluationEvent`; existing `replayEmotionEvents` reconstructs the same gate state. Saving the normalized request and checking it against the proposal reproduces numerical execution and runner motion without additional random draws. This is consistency checking, not cryptographic authentication or reconstruction of omitted global history.

Future observers must read the same accepted gate state/influence, not appraise again. No screen, mark or renderer is connected here. Consequently this PR alone is NOT a player-facing emotion-feature release.

## Swing boundary explicitly preserved

Production swing at `7b1b84aafa5d79499740d556fd44cef63b4f2c26` uses `timingOffsetTicks` to shift the entire rigid-bat trajectory. `swingDecisionShiftTicks` denotes decision commitment; it is not automatically the same quantity. This module never maps the two blindly and does not import compatibility swing resolvers. Observation cut-off, early commitment and physical phase coupling require a separately verified consumer. PR25/27 is not merged or reimplemented.

## Remaining host and model responsibilities

Authentic current source/event/model/version identities, common tick units, true emotion-free baselines, meaningful complete perception and legal opportunities, production calibration, world scheduling and atomic storage remain host-owned. Test data are synthetic. Whole-game behavior, population balance, physical throws/batting and on-screen feedback are not validated by these tests.
