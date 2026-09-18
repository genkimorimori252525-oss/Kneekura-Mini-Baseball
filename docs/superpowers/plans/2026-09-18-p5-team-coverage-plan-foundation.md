# P5 Team Coverage Plan Foundation — 2026-09-18

**Status:** IMPLEMENTATION IN PROGRESS.

## Goal

Promote existing per-defender intent candidates into one deterministic nine-player team plan.

## Existing inputs reused

- `generateDefensiveIntentCandidates`
- individual perceived-world state
- arbitrary shifted world coordinates
- P3 rating-driven decision timing/execution
- existing `DefensiveIntent` roles

## Team constraints

Each defender receives exactly one intent.

Exclusive team roles in the first slice:

- exactly one `ball_handler` when required;
- at most one defender covering each base.

Non-exclusive roles:

- relay;
- backup;
- deep coverage;
- hold.

A defender can never own two roles in the same plan.

## Selection

Do not greedily accept each player's local first choice.

Choose the combination that maximizes total local priority under team role constraints.

This allows cases such as:

```text
Defender A:
  ball handler 0.90
  cover first  0.89

Defender B:
  ball handler 0.88

greedy:
  A handles ball, B holds = 0.90

team plan:
  B handles ball, A covers first = 1.77
```

## Permanent constraints

- exactly nine unique defenders;
- deterministic result independent of input ordering;
- no hard-coded registered-position fallback;
- shifted CF/other unusual starting positions remain valid inputs;
- plan assignment does not alter movement/catch/throw ratings;
- selected intents later feed existing movement/physical execution;
- position suitability may enter candidate scoring only at a concrete role/task boundary, not as a blanket defense multiplier.
