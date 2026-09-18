# P9 Statistical Validation / Natural Boundary — 2026-09-19

**Status:** FOUNDATION CLOSED AND VERIFIED; FIXED-SEED BASELINE FROZEN; INITIAL BATCH CALIBRATION GREEN.

## Goal

Turn the completed P0-P8 causal Core into a reproducible validation target and freeze the read-only boundary for future Natural rendering.

## Work order

1. canonical evidence serialization + deterministic regression fingerprint;
2. fixed-seed regression corpus contract;
3. causal debug trace from seed/input through strategy/execution/rules;
4. same-contact defensive-alignment comparison harness;
5. batch aggregate statistics (outs / hits / extra bases / runs);
6. performance measurement harness that does not use wall clock as simulation input;
7. Natural read-only presentation snapshot;
8. Mini/Natural presentation-isolation acceptance.

## Fingerprint boundary

Fingerprints are for regression evidence, not cryptographic security.

The canonical serializer must:
- sort object keys;
- preserve array order;
- preserve exact integer ticks;
- reject undefined / non-finite numeric evidence;
- never depend on object insertion order;
- never read wall-clock time or random state.

Representative bundle:

```text
match seed
play id
input / command
canonical events
canonical world samples
final match state
        ↓
stable canonical serialization
        ↓
regression fingerprint
```

## Fixed-seed corpus

Corpus entries should identify:
- scenario id;
- seed;
- play id / starting match state;
- scenario builder id;
- expected evidence class.

The corpus is data, not a list of hard-coded baseball results.

Expected fingerprints may be frozen only after the repository verify job actually executes successfully. That condition is now satisfied: the unfrozen corpus reproduced identical values on run `35394466844` attempts 1 and 2, the baseline was frozen at `c3a409cf...`, and run `35395593056` verified all frozen expectations as matches.

## Alignment comparison

P9 must compare the **same canonical contact inputs** across different defensive alignments.

No batter debuff is allowed.

Differences must emerge through:
- starting geometry;
- perception;
- coverage assignment;
- defender movement;
- catch / throw / base contact;
- runner reaction;
- rule result.

## Natural boundary

Natural rendering receives read-only:
- CanonicalMatchState;
- CanonicalWorldSnapshot;
- TimedMatchEvent[];
- optional public presentation metadata.

Natural must not:
- rerun physics;
- rerun AI;
- alter world coordinates;
- feed bones / meshes / animation contacts back into Core.

## Completion direction

P9 foundation is closed because:
- fixed-seed evidence is reproducible across repeated full CI executions;
- causal traces explain representative outcomes;
- same-contact alignment comparisons produce aggregate differences only through physical results;
- renderer ON/OFF and Mini/Natural adapters preserve canonical fingerprints;
- batch performance is measured separately from simulation semantics;
- an initial 1,024-contact deterministic calibration probe executes real `DefenderMotion` and records outs / hits / extra-base hits / runs without Presentation input.

Verification anchors:
- unfrozen fixed-seed head `83d01d52...`: run `35394466844` attempts 1 and 2, 228 files / 1065 tests green with identical fingerprints;
- frozen baseline head `c3a409cf...`: run `35395593056`, 228 files / 1065 tests green with all three scenarios matching;
- batch calibration head `8b306a15...`: run `35396396378`, 229 files / 1068 tests green;
- batch contact fingerprint `2f545c9acac3ab71`;
- batch calibration fingerprint `f5058efd2d23784c`.

The calibration result buckets remain validation-only. They are not a substitute for a future production path that causally resolves every hit type and run outcome.