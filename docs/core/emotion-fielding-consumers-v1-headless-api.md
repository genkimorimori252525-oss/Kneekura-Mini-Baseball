# Emotion fielding consumers v1 — headless API

## Scope

Implements the approved decision-to-physical causality in psychology05 §§2,3.1,7,8,12,13. Builds on PR37 without changing the gate, ratings, launch or movement owners. It extends two channels: throw-intent time/throw aggression and defensive-replan time. The existing runner consumer remains unchanged. No batting consumer, renderer or UI is added.

Import `prepareFieldingExecution` / `acceptFieldingExecution` from `src/core/world/psychology/fielding`.

## Two different clocks / one gate

1. PR37 prepares and accepts a numerical emotion decision at its originating world frame.
2. The world scheduler invokes this consumer at the scheduled throw/replan commitment tick, with a current world frame, current gate state and current source.
3. Before the tick: `WAITING`; after the tick: `MISSED_COMMITMENT`. A previously missed input window remains `MISSED_WINDOW`. No past execution is fabricated.
4. The consumer checks the whole original acceptance and requires the current gate to be exactly its accepted state. It does not evaluate new emotions at the later tick. Recomputing the old acceptance is an integrity check only; it creates no additional gate revision or stored event.
5. New perception and body sources must be bound to the current frame. Observations/triggers/candidate evidence cannot be from after their declared observation cutoff, and the cutoff cannot be after commitment.

A new gate revision (even an unchanged active label), a changed context, or a mismatched current source requires a fresh plan. The host authenticates current state; this library cannot prove caller-supplied records actually occurred or were persisted.

## Throw source and output

`ThrowSource` supplies current ball holder, receiver and perceived target, possession tick, stationary pose, unchanged arm/accuracy/transfer ratings, transfer calibration, versioned feasible effort repertoire, physical speed ceiling and an isolated random seed.

The consumer chooses the highest declared `minimumAggression` threshold reached by the already accepted throw-aggression input. Thresholds must be increasing and start at zero; profiles have increasing speed ranges bounded by the supplied physical ceiling. This is a documented implementation choice with caller-supplied calibration, not an approved universal numeric threshold.

`resolveBallTransferTiming` computes hand readiness from possession. Motor start is `max(commitmentTick, throwReadyTick)`; completed transfer is not charged again. Release is motor start plus the selected source-owned motor duration. `createRatedThrowLaunch` computes the launch and aim error using unchanged ratings and its existing six random draws. No error/out/safe outcome is sampled. Underflow to a zero velocity while claiming positive speed is rejected; relative speed tolerance is a numerical consistency check (1e-10), not a baseball calibration.

`NO_CONTROL` produces no launch. A release beyond source validity is `MISSED_WINDOW`, not a backdated release. The returned `ThrowPhysicalPlan` is an initial physical launch PLAN, NOT evidence that a hand released the ball. This initial adapter supports only stationary holders; nonzero holder velocity rejects instead of quietly freezing a moving pose. At actual release the host/body/possession owners must still validate pose, hand constraint, interruption and target references. Moving throws and complete skeletal throwing mechanics remain separate work.

## Defensive replan source and output

`ReplanSource` supplies existing perceived intent candidates, known target geometry, recognized triggers, last decision time, CURRENT body position/velocity, previous movement target, first-step parameters and unchanged motion parameters. It does not generate omniscient candidates or change team assignment ownership.

The consumer reuses `findNextDefensiveReplanTick` and `chooseDefensiveIntentCandidate`. No new trigger produces `NO_NEW_TRIGGER`. The chosen target follows existing intent semantics: base-cover body position, supplied perceived ball position, relay/backup/deep target or hold. Missing ball perception never falls back to a true-world ball position.

The existing first-step function supplies motor latency. Old motion continues through that latency. Its exact final position/velocity becomes the next trajectory's initial state; hold brakes normally and a changed target cannot teleport velocity. The two stages both use `buildDefenderMotionTrajectory`. The movement output is a prediction horizon, not authorization to jump the world to its end.

A short prediction horizon may end before the planned movement change; the output then contains only old-target motion, with the later movement start still explicit. A per-proposal integration budget of 4096 segments bounds resource usage; longer forecasts must be split. This is a resource guard, not a change to physical time or ability.

## Adoption and side effects

Both APIs take unknown external input, reject non-inert shapes, and return immutable detached `EmotionResult` data. `acceptFieldingExecution(currentRequest, proposedResult)` recomputes from the CURRENT supplied request and accepts READY/non-null plans only. It returns the expected current frame, next world revision, unchanged emotion revision and an action key scoped to career/match/player/execution/channel. Changing source IDs does not create a new action key.

Host responsibilities: authenticate source/model/pose/possession/clock units; provide genuine emotion-free parent baselines; atomically compare world AND gate versions and persist the full adoption; globally deduplicate action keys; schedule/interrupt planned motion and revalidate at release. The API itself does not write a database, implement persistent exactly-once execution, update a world clock, adjudicate rules or draw anything. Unrelated missed numerical channels do not authorize execution of those channels.

## Verification

Tests use synthetic profiles, not population calibration. They compare neutral output to the actual existing launch/motion owners, show delay changing ball/defender position at a shared physical time, preserve motor/transfer/ability constraints, and cover source/gate/clock corruption. The exact published commit's full native-suite result is recorded on its PR; supplementary Node22/TypeScript5.8 tests do not replace native evidence.
