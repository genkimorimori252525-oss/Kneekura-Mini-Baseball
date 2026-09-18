# Rule Engine Third-Out Scoring Foundation Plan

**Status:** IMPLEMENTATION COMPLETE; full repository CI remains blocked before workflow steps start.

**Goal:** Introduce the first Correct Rule Result layer above canonical physical truth, beginning with batter-runner first-base outs and third-out scoring.

**Authoritative basis:** Current NPB official explanation confirms that when the third out is a force out, a run does not score even if the runner touched home earlier; a non-force timing play is instead decided by event time. This matches project rule priority R-06.

## Architecture

```text
Canonical Physical Truth
  secure ball + defender physically touching base
  runner physically touching base/home
            ↓
PhysicalRuleFacts
            ↓
Correct Rule Result        <- this phase
            ↓
Human Umpire Call          <- later
            ↓
Final Official Ruling      <- later
```

## Permanent constraints

- Rule code never reads Presentation state.
- Stable `sequence` ordering never invents physical precedence.
- Equal authoritative ticks remain physically simultaneous.
- Physical base control means secure ball possession plus physical base contact; it is not itself an out.
- Physical runner/base contact is not itself safe/out.
- This phase creates **Correct Rule Result only**. Umpire perception and official ruling remain downstream.
- No score is awarded by comparing only animation/event-array order.
- Rule-specific results remain derived and do not rewrite physical event ticks.

### Task 1: Physical rule facts + batter-runner first-base result

Create `src/core/rules/PhysicalRuleFacts.ts` and `BatterRunnerFirstBaseRule.ts`.

Physical facts:
- runner base touch: runner id, base, tick;
- defender controlled-base contact: defender id, base, tick, secure possession implied by the fact constructor/boundary.

First-base result:
- defender control strictly before batter-runner first touch -> `out`;
- batter-runner touch strictly before defender control -> `safe`;
- equal tick -> `simultaneous`;
- missing required physical facts -> `unresolved`.

The result records physical ticks and never consults `sequence`.

### Task 2: Third-out run scoring

Create `ThirdOutScoring.ts`.

Correct out classifications needed by scoring:
- `batter_runner_before_first`;
- `force`;
- `time_play`.

Given `outsAtStart`, a candidate third out, and runner home touches:
- if the play does not create the third out, scoring remains outside this evaluator;
- third out = batter-runner before first -> no run scores, regardless of earlier home touch;
- third out = force -> no run scores, regardless of earlier home touch;
- third out = time play -> home touch strictly before third-out tick scores;
- home touch strictly after does not;
- equal tick remains `simultaneous_unresolved` rather than using serialization order.

### Task 3: Minimal ground-ball first-base RuleEngine vertical slice

Create `RuleEngine.ts`.

Input:
- outs at start;
- batter-runner id;
- physical first-base control/touch facts;
- physical home-touch facts.

Pipeline:
1. derive batter-runner first-base result;
2. if it is the third out, classify it as `batter_runner_before_first`;
3. resolve candidate runs using third-out scoring;
4. return physical facts separately from the Correct Rule Result.

Acceptance fixture:
- two outs;
- runner from third touches home first;
- defender controls first before batter-runner touches;
- Correct Rule Result = batter-runner OUT, third out, zero runs.

Companion fixtures:
- one out -> same first-base out is only second out, so this evaluator must not suppress scoring as a third-out rule;
- batter-runner reaches first before defender control -> no out;
- equal first-base ticks -> simultaneous, no invented out from `sequence`.

### Task 4: Core API + verification

Export the rule foundation from `src/core/index.ts`.
Run local TypeScript/numeric tests.
Retry P0 Core CI, but do not claim full repository GREEN while Actions jobs fail before workflow steps.


---

## Implementation Evidence

Implemented through HEAD `97f952d1b6f0c23468097d8d7db242a0ee12a9e9`:
- physical runner-base and controlled-base facts;
- batter-runner first-base correct-rule result;
- exact simultaneous first-base state without serialization precedence;
- third-out scoring classification for batter-runner-before-first, force, and time-play outs;
- force/batter-runner third-out run suppression regardless earlier home touch;
- time-play scoring from authoritative physical ticks;
- simultaneous time-play home touch preserved as unresolved;
- ground-ball first-base RuleEngine vertical slice returning `physicalFacts` separately from `correctRuleResult`;
- shared Core API exports.

Independent verification:
- TypeScript 5.8 source-level typecheck: success;
- two-out ground-ball first-base third-out fixture: earlier home touch suppressed;
- one-out companion fixture: third-out suppression not applied;
- time-play earlier home touch: scored;
- equal authoritative tick: `simultaneous_unresolved`.

Repository CI:
- P0 Core run `35302808815` at the implementation HEAD failed before workflow steps were created;
- full repository GREEN is intentionally not claimed while the repository remains in the same `steps=null` condition.
