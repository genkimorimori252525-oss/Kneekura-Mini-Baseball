# ActiveEmotion gate implementation plan

> For agentic workers: execute task-by-task with superpowers:executing-plans and test-driven-development.

Goal: implement the already-approved activation / hysteresis / dominant-emotion / clearance and replay boundary, without deciding appraisal formulas or wiring UI/physics.
Spec: docs/game-design/05-psychology-emotion.md §§2–3,6–8,12–13 at approved design 782f6b8ef2406839de5678b00040001111cd8f77. Pressure-Trait source ownership: 08 §15.50 and 09 §10.1. Full psychology and Trait lifecycle are not this slice.
Architecture: pure input/state/output functions. An upstream appraisal service supplies a complete five-candidate snapshot and bounded decision/timing effects. This module gates exactly one bundle, not all abilities. Host persists state and receipt atomically; downstream reads the same active identity and effects. No rendering or wall clock authority.

## Global constraints
- Shared Core owns canonical integer tick + sequence; 55ms display cadence never drives state.
- No unconditional Trait/name/big-stage outcome bonus. No RNG or I/O here.
- No automatic appraisal/importance scores or production calibration invented. Explicit versioned policy supplied by host; candidates must include nonzero effects for activation.
- Scope every request to career, match and player; revision/chronology protect state.
- Inputs are inert JSON-like data, copied and frozen. Wrong input yields structured rejection.
- Inactive influence is exactly empty. Clearing never retains an earlier effect.
- Preserve PR30 b423709 and independent swing PR25/27; publish new branch only, no merge.

## Review focus
- An unqualified challenger below activation cannot borrow incumbent sustain eligibility.
- Every candidate is reevaluated; an active effect is never copied from stale appraisal.
- A repeated appraisal cannot count twice toward clearance.
- Exact-impact ties keep the incumbent; otherwise use candidate ID only as deterministic tie-break, never a preferred emotion order.
- Replayed receipts must match recomputed state and scope; malformed data cannot partially mutate input.

## Task 1: State and inert-data contract
Files: EmotionTypes.ts, EmotionValidation.ts, EmotionState.ts, EmotionState.test.ts, EmotionFixtures.test-support.ts.
Produces: createEmotionState(input), restoreEmotionState(input), getEmotionInfluence(state).
Checks: neutral creation; per-emotion enter>sustain policy; valid source refs; malformed/NaN/sparse/getter rejection; detached deep freeze; active/current/calm-state consistency; empty influence when inactive.
Test first, observe missing-feature/behavior failure, implement, rerun supplementary strict TS/Node assertions. Native full suite remains mandatory at published head.

## Task 2: Transition evaluation
Files: EmotionGate.ts, EmotionGate.test.ts.
Consumes validated state; produces evaluateEmotion(state, request) with state + immutable receipt or original state + rejection.
Checks: all five candidates required; activation inclusive; sustain inclusive; clearance only after configured consecutive canonical calm observations; no source-less or zero-effect activation; maximum comparable behavioralImpact selection; incumbent tie stability; same-tick sequence ordering; stale scope/revision/duplicate/backdate/overflow; current effects on maintained state; individual appraisal produces distinct response.
Each receipt stores normalized appraisal, previous/next revisions, transition, active record and calm count, enabling replay.

## Task 3: Replay and adversarial checks
Files: EmotionReplay.ts, EmotionReplay.test.ts, index.ts.
Consumes a checkpoint and receipts; recomputes each transition and rejects mismatches without mutating checkpoint. No catalog/current person lookup, randomness, or full event log in state.
Checks: exact round-trip, JSON serialization, zero-effect gating invariance, tampered receipt/source/policy/state rejection, out-of-order/duplicate replay, long sequence with mid-match checkpoint. Review inline (no independent agent tool available).

## Task 4: Docs, publish, verify
Files: docs/core/active-emotion-gate-v1-headless-api.md, docs/project-status/2026-09-22-active-emotion-gate.md, branch-only verification workflow.
Run strict local supplemental tests; publish to dedicated branch; native npm ci / npm run verify on exact final SHA. Inspect full test results. Report calibration, appraisal, consumer integration and existing dependency warnings separately. Keep draft if verification cannot complete.

## Implementation rulings
- Threshold equality enters/sustains. This pins numeric boundary semantics without choosing production thresholds.
- Use event-count clearance (allowed by §6), not renderer frames or elapsed real time. Host must only send genuine canonical appraisal events.
- At equal impact, retain eligible incumbent; without one, candidate-ID tie-break is deterministic, not an emotion priority. An impact-zero or all-zero-effect candidate cannot remain active.
- Candidate decision effects are numerical offers, NOT proof a running game applied them. This slice is a gate; upstream appraisal and downstream execution/observer consumers must be integrated together later.
- The current match profile is pinned. Mid-match policy migration is not supported; future migration must be explicit and preserve old replay.
