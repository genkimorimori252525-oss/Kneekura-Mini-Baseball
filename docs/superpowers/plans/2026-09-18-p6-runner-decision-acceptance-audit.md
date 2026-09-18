# P6 Runner Decision / Special Play Acceptance Audit — 2026-09-18

**Status:** IMPLEMENTATION COMPLETE FOR FOUNDATION; GitHub Actions remains pre-step blocked.

**Parent roadmap:** P6 — individual baserunning and special plays.

## Acceptance map

| Requirement | State | Evidence | Boundary |
| --- | --- | --- | --- |
| runner decision layer separate from RunnerMotion | **implemented** | `RunnerDecision`, `RunnerDecisionTiming` | cognitive issue time and physical motor reaction delay are separate |
| advance / hold / retreat decisions | **implemented** | `RunnerDecision` | outputs existing `RunnerMotionIntent` |
| runner ability changes decision timing, not speed | **implemented** | `P6RunnerDecisionMotionVerticalSlice.test.ts` | same motion parameters, different intent issue tick |
| outs / score / inning change advance risk | **implemented** | `RunnerRiskPolicy` | changes required perceived safety margin only |
| defensive coverage gap changes runner choice | **implemented** | `P6DefensiveGapRunnerDecisionAcceptance.test.ts` | same runner arrival, different perceived defender control |
| base-coach information | **implemented** | existing Communication + RunnerDecision coach instruction | only already received communications are actionable |
| tag-up waiting | **implemented** | `awaiting_first_touch` runner knowledge | no future first-touch tick stored |
| tag-up retouch | **implemented** | `must_retouch` | retreat outranks optional advance |
| steal perception | **implemented** | `PerceivedStealRace` | perceived pitcher/catcher/throw/tag timing -> next-base race cue |
| pickoff perception | **implemented** | `PerceivedPickoffThreat` | perceived pickoff move/throw/tag timing -> current-base threat cue |
| steal / pickoff decisions feed existing motion | **implemented** | `P6StealPickoffVerticalSlice.test.ts`, `P6StealPickoffDecisionAcceptance.test.ts` | no new runner locomotion engine |
| rundown direction choice | **implemented** | `RundownDecision` | compares perceived forward/back tag margins with hysteresis |
| rundown choice feeds existing motion | **implemented** | `P6RundownMotionVerticalSlice.test.ts` | physical reversal uses RunnerMotion |
| physical steal-defense timing | **implemented** | `StealDefenseTimeline` | catcher possession -> transfer -> actual receiver possession -> tag action |
| physical tag contact after steal | **implemented** | `StealControlledTagAdapter` | reuses existing TagContact solver |
| steal safe/out uses existing RuleEngine fact | **implemented source acceptance** | adapter test -> `TagArrivalRule` | actual tag tick vs runner base-touch tick |

## Architecture

```text
runner perception / received coach signal
        ↓
perceived race cues
        ↓
game-state risk policy
        ↓
RunnerDecision
        ↓
cognitive decision tick
        ↓
existing RunnerMotionIntent
        ↓
existing RunnerMotion reaction delay
        ↓
RunnerRoute / BaseTouch / BodyContact
        ↓
physical rule facts
        ↓
existing RuleEngine
```

No duplicate running-physics engine was introduced.

## Decision skill boundary

`RunnerDecisionTiming` maps decision ability only into cognitive delay.

It does not change:
- top speed;
- acceleration;
- braking;
- slide deceleration;
- runner body reach.

The existing RunnerMotion motor reaction delay remains a second, separate physical latency.

## Game-state risk policy

`RunnerRiskPolicy` changes only the minimum perceived safety margin required for an optional advance.

Inputs:
- outs;
- inning;
- score from batting-team perspective;
- explicit calibration.

Examples in source acceptance:
- neutral state -> baseline margin;
- two outs + late trailing -> smaller required margin;
- late lead -> larger required margin.

This is not a direct safe/out modifier.

## No future tag-up knowledge

The initial design briefly considered storing a future `legalAdvanceFromTick` in runner knowledge.

That was rejected and removed.

Current tag-up runner knowledge is:
- `none`;
- `must_retouch`;
- `awaiting_first_touch`.

A runner waiting for first touch knows only that the touch has not yet been perceived.

The decision layer never receives a future true first-touch time.

## Defensive-gap interaction

A next-base race cue may have:
- a perceived defender control tick; or
- `null` when the base is perceived uncovered.

The same runner arrival estimate can therefore produce:
- hold against an early cover;
- advance against a late cover;
- advance through a perceived coverage gap.

This is how P5 coverage quality becomes meaningful to P6 without adding a direct baserunning bonus.

## Steal perception

`PerceivedStealRace` composes the runner's estimate of:
- pitch commitment;
- pitcher-to-catcher time;
- catcher transfer time;
- throw flight;
- fielder tag time.

It outputs a normal `next_base_race` cue.

A quicker perceived battery can therefore turn the same runner arrival from advance to hold.

These are perceived timings, not actual defender ratings leaked to the runner.

## Pickoff perception

`PerceivedPickoffThreat` composes the runner's estimate of:
- pickoff commitment;
- pitcher release delay;
- throw flight;
- fielder tag delay.

It outputs a `current_base_threat` cue.

Current-base threat outranks an optional advance.

## Base-coach boundary

RunnerDecision may use an already received `coach_signal` with runner-action content.

The existing communication system owns:
- propagation delay;
- recognition delay;
- confidence;
- arrival time.

A message whose receive tick is after the current observation time is not actionable.

Coach information is advice, not telepathy.

## Rundown behavior

`RundownDecision` compares perceived safety margins in both directions:

```text
defenderTagTick - runnerArrivalTick
```

Direction changes only when the alternative exceeds the current direction by the configured hysteresis.

This prevents unstable every-tick direction flipping.

An unguarded perceived direction may use infinite safety margin without inventing a finite defender arrival.

## Physical steal-defense timeline

Canonical defense execution remains separate from runner perception.

`StealDefenseTimeline` uses actual upstream evidence:

```text
pitch commitment tick
  -> catcher secured possession
  -> catcher transfer rating
  -> throw-ready tick
  -> actual receiver secured possession
  -> receiver tag rating
  -> tag-action start tick
```

It does not declare an out.

Catcher transfer skill changes throw-ready time.
Tag skill changes tag-action start time.
Actual receiver possession remains external physical evidence from throw reception.

## Physical steal tag

`StealControlledTagAdapter` begins contact search no earlier than `tagActionStartTick`.

It reuses the existing `TagContact` physical solver.

Only an actual tag-hand/runner primitive contact produces `ControlledRunnerTagFact`.

That fact and an actual `RunnerBaseTouchFact` then feed the existing `TagArrivalRule`.

Therefore the final steal result is:
- tag first -> out;
- base touch first -> safe;
- equal tick -> simultaneous;

not a steal-success probability roll.

## Representative source acceptance

- `src/core/sim/running/RunnerDecisionTiming.test.ts`
- `src/core/sim/running/RunnerDecision.test.ts`
- `src/core/sim/running/P6RunnerDecisionMotionVerticalSlice.test.ts`
- `src/core/sim/running/RunnerRiskPolicy.test.ts`
- `src/core/sim/running/P6RunnerRiskDecisionAcceptance.test.ts`
- `src/core/sim/running/P6DefensiveGapRunnerDecisionAcceptance.test.ts`
- `src/core/sim/running/PerceivedStealRace.test.ts`
- `src/core/sim/running/PerceivedPickoffThreat.test.ts`
- `src/core/sim/running/P6StealPickoffDecisionAcceptance.test.ts`
- `src/core/sim/running/P6StealPickoffVerticalSlice.test.ts`
- `src/core/sim/running/RundownDecision.test.ts`
- `src/core/sim/running/P6RundownMotionVerticalSlice.test.ts`
- `src/core/sim/running/StealDefenseTimeline.test.ts`
- `src/core/sim/running/StealControlledTagAdapter.test.ts`

## Known extensions that do not reopen P6 foundation

- richer runner path-choice geometry beyond the existing route model;
- explicit physical pickoff throw vertical slice using the same TagContact / TagArrival pipeline;
- catcher pop-time calibration from full pitch reception geometry;
- runner-specific learning of pitcher/catcher tendencies;
- multi-runner coordination;
- coach observation-generation AI.

These should reuse the P6 decision/perception boundary.

## P7 handoff

P7 owns one-plate-appearance managerial commands.

It must:
1. accept a plate-appearance command once;
2. transform high-level pitcher/batter/runner instructions into internal intents;
3. preserve every pitch on the canonical P2 timeline;
4. avoid waiting for a new user command between pitches;
5. reject or explain internally impossible instructions;
6. stop applying the command when the plate appearance ends.

P7 must not directly alter resolved outcomes.

## CI caveat

Latest GitHub Actions evidence:
- run `35352671162`
- head `fe650779e12f2a1be852ce3d47b90b2249651a6f`
- verify job `105624304194`
- `steps=[]`

The workflow still fails before commands execute.

Repository GREEN is not claimed.
