# P6 Runner Perception / Decision Foundation — 2026-09-18

**Status:** IMPLEMENTATION IN PROGRESS.

## Goal

Add the missing decision layer in front of the existing runner physics.

Reuse:
- RunnerMotion;
- RunnerRoute;
- RunnerBaseTouch;
- RunnerBodyContact;
- RunnerWorldProjection;
- tag-up / appeal rules.

Do not replace those systems.

## Causal path

```text
runner perceived world
  + perceived next-base race
  + perceived current-base threat
  + tag-up / force context
  + received base-coach instruction
        ↓
RunnerDecision
        ↓
RunnerMotionIntent
        ↓
existing RunnerMotion reaction gate
        ↓
route / base touch / tag physics
```

## Permanent constraints

- runner decisions must not read future true defender contact;
- use perceived / predicted arrival ticks only;
- decision skill must not directly change top speed;
- cognitive decision delay and physical RunnerMotion reaction delay remain separate;
- force obligations may require advance even when the perceived race is bad;
- tag-up restrictions can require hold/retreat before legal advance;
- a current-base pickoff/tag threat can override an optional advance;
- coach instructions arrive through existing communication timing and confidence;
- coach signals are advice, not telepathy or guaranteed correct action;
- final safe/out remains physical + RuleEngine, never a decision-layer roll.

## First slice

1. RunnerDecisionTiming;
2. RunnerKnownContext;
3. perceived next-base race cue;
4. perceived current-base threat cue;
5. coach action communication;
6. deterministic action selection:
   retreat / advance / hold / slide;
7. output directly as existing `RunnerMotionIntent`.

## Later P6 slices

- steal authorization and start timing;
- pickoff throw/reception/return race;
- tag-up perception;
- rundown two-direction replanning;
- coach observation generation;
- runner-specific risk policy derived from score/outs/inning.
