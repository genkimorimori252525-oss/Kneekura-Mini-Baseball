# P5 Team Defense / Throw Planning Acceptance Audit — 2026-09-18

**Status:** IMPLEMENTATION COMPLETE FOR FOUNDATION; GitHub Actions remains pre-step blocked.

**Parent roadmap:** P5 — nine-player defense / situation-aware team planning.

## P5 acceptance map

| Requirement | State | Current evidence | Boundary |
| --- | --- | --- | --- |
| all nine defenders receive exactly one role | **implemented** | `TeamCoveragePlan` | exactly nine unique players and nine registered positions |
| one primary ball handler | **implemented** | coverage-state DP | required when `requireBallHandler=true` |
| non-conflicting base coverage | **implemented** | base bitmask constraints | at most one cover owner per base |
| relay / backup / deep coverage / hold | **implemented** | existing `DefensiveIntent` roles reused | non-exclusive by kind, but one role per player |
| team-global assignment instead of greedy local first choice | **implemented** | deterministic DP maximizing total candidate priority | test includes 0.90 greedy vs 1.77 team optimum |
| arbitrary shifted coordinates preserved | **implemented** | `TeamCoverageWorldAdapter` | assignments change; positions/velocities do not |
| position suitability applied at concrete role boundary | **implemented** | `CoveragePositionSuitability` | changes role selection priority only, not execution physics |
| local perception remains authoritative | **implemented** | `RatedTeamCoveragePlan` | team layer cannot invent a ball-handler candidate if a defender has no local ball perception |
| deterministic explicit replanning | **implemented** | `TeamCoverageReplan` | future evidence after revision tick is rejected |
| team plan -> physical base cover | **implemented source vertical slice** | `P5TeamCoveragePhysicalVerticalSlice.test.ts` | team assignment reaches BodyKinematics -> foot reach -> actual base contact |
| defender-oriented game context | **implemented** | `DefenseContext` | score/half/inning interpreted from defense perspective |
| throw candidates compared by game-state loss | **implemented** | `ThrowPlan` | no hard-coded "take easiest out first" |
| walk-off prevention outranks easy out | **implemented source acceptance** | `ThrowPlan.test.ts` | immediate-loss probability is first comparison key |
| throw receiver must own matching base cover | **implemented** | `CoverageThrowPlan` | CoveragePlan and ThrowPlan cannot disagree about receiver |
| chosen throw -> rated 3D launch | **implemented** | `CoverageThrowExecution` | strategy chooses target; P3 arm/accuracy own launch quality |

## Team coverage architecture

```text
per-defender perceived world
        ↓
generateDefensiveIntentCandidates
        ↓
position suitability at concrete role boundary
        ↓
9 candidate sets
        ↓
TeamCoveragePlan global optimization
        ↓
one role per defender
        ↓
Canonical DefenderWorldState.assignment
        ↓
existing movement / catch / base-cover physics
```

The team planner does not replace individual perception with omniscient truth. A role can only be selected from a defender's locally generated candidates.

## Why the planner is not greedy

Per-player first choice can produce a worse team plan.

Acceptance fixture:

```text
Defender A:
  ball handler = 0.90
  cover first = 0.89

Defender B:
  ball handler = 0.88

greedy:
  A handles ball, B holds
  total = 0.90

team plan:
  A covers first, B handles ball
  total = 1.77
```

`TeamCoveragePlan` solves the constrained combination deterministically.

Current exclusive team constraints:
- at most one ball handler;
- at most one owner per base-cover obligation.

When required, the final plan must contain one ball handler.

## Canonical nine-player validation

Coverage input requires:
- exactly nine defenders;
- unique player IDs;
- each registered defensive position exactly once:
  P / C / 1B / 2B / 3B / SS / LF / CF / RF;
- at least one candidate per defender;
- finite candidate priority;
- non-future/non-negative evidence tick;
- finite explicit relay/backup/deep-coverage targets.

This protects the team layer from malformed manual fixtures as well as generated candidates.

## Position suitability boundary

P3 deliberately deferred position suitability until a concrete role/task existed.

P5 activates it here.

`CoveragePositionSuitability` adjusts only candidate role priority.

It does not change:
- movement speed;
- acceleration;
- reach;
- catching;
- throw speed;
- throw accuracy;
- tag execution.

Role sensitivity is independently calibrated. `hold` can have zero sensitivity.

Thus position suitability affects **who should own a role**, not how physics behaves after assignment.

## Arbitrary shifts remain canonical

`TeamCoverageWorldAdapter` writes only `assignment`.

It preserves:
- registered position;
- arbitrary world position;
- current velocity.

A registered CF positioned near the infield stays a CF at that coordinate while receiving backup/deep/other coverage work.

There is no fallback to hard-coded "normal CF coordinates".

## Physical vertical slice

The P5 physical vertical slice proves:

```text
9-player candidate sets
  -> global CoveragePlan
  -> 1B = ball handler
  -> P = first-base cover
  -> world assignment
  -> first-base body-cover target
  -> DefenderMotion
  -> BodyKinematics
  -> foot reach primitive
  -> actual physical first-base contact
```

The defender body target remains distinct from the physical bag location.

The foot reaches the actual base through the existing 3D contact solver.

No 3D character model or animation contact is required.

## Replanning boundary

`TeamCoverageReplan` requires an explicit canonical revision tick.

Supported first-slice reasons:
- ball state changed;
- runner state changed;
- possession changed;
- communication received.

Candidate evidence after the revision tick is rejected.

The replan result records only player IDs whose actual role changed.

This keeps replanning deterministic and prevents future-information leakage.

## Throw planning architecture

```text
CoveragePlan
  -> current ball handler
  -> base-cover receivers

perceived / physical candidate estimates
  -> outProbability
  -> runner score probabilities
  -> expected extra bases
  -> estimated completion tick

DefenseContext
  -> inning / half
  -> score from defender perspective
  -> walk-off eligibility

ThrowPlan
  -> expected-loss ordering
  -> selected target

CoverageThrowExecution
  -> selected receiver target
  -> P3 armStrength / throwingAccuracy
  -> actual 3D ThrowLaunch
```

## Expected-loss ordering

The first implementation intentionally avoids one opaque weighted scalar.

Candidates are compared lexicographically:

1. minimize immediate game-ending loss probability;
2. minimize probability of allowing the critical tying/go-ahead score swing;
3. minimize expected runs allowed;
4. maximize out probability;
5. minimize expected extra bases allowed;
6. prefer earlier estimated completion;
7. stable candidate ID tie-break.

This directly satisfies the design requirement that preventing a walk-off loss outranks taking an easier unrelated out.

## Scoring-threat probability model

The first ThrowPlan slice combines per-runner scoring probabilities using an independent Bernoulli approximation.

This is a **candidate-evaluation estimate**, not the canonical play result.

Actual play execution still comes from:
- movement;
- transfer;
- rated throw launch;
- ball flight;
- receiver movement/catch;
- tag/base contact;
- RuleEngine.

P9 may replace/enrich the estimate with fixed-seed rollouts without changing the ThrowPlan boundary.

## Coverage / Throw consistency

`CoverageThrowPlan` requires:
- exactly one ball handler;
- every throw receiver exists in the CoveragePlan;
- the receiver owns `base_cover` for the exact target base.

A throw to a player who is not covering that base is rejected before execution.

## Strategy vs execution boundary

P5 strategy decides:
- who handles;
- who covers;
- who relays/backs up;
- which throw candidate is preferred.

P3/P2 physics decide:
- how quickly the player moves;
- whether the glove/foot reaches;
- transfer time;
- throw speed;
- throw target error;
- reception;
- tag/base contact;
- final rule outcome.

The team planner never adds an "out bonus" after choosing a good plan.

## Representative source acceptance

- `src/core/sim/fielding/TeamCoveragePlan.test.ts`
- `src/core/sim/fielding/CoveragePositionSuitability.test.ts`
- `src/core/sim/fielding/RatedTeamCoveragePlan.test.ts`
- `src/core/sim/fielding/TeamCoverageWorldAdapter.test.ts`
- `src/core/sim/fielding/TeamCoverageReplan.test.ts`
- `src/core/sim/fielding/P5TeamCoveragePhysicalVerticalSlice.test.ts`
- `src/core/sim/fielding/DefenseContext.test.ts`
- `src/core/sim/fielding/ThrowPlan.test.ts`
- `src/core/sim/fielding/CoverageThrowPlan.test.ts`
- `src/core/sim/fielding/CoverageThrowExecution.test.ts`

## Known extensions that do not reopen the P5 foundation

- richer expected-loss estimates from multi-rollout physical simulation;
- non-base throw targets such as intermediate relay throws;
- wall/cutoff-specific geometry;
- more detailed receiver glove target prediction;
- simultaneous multi-runner decision trees;
- P6 runner decision feedback into the candidate estimates.

These should reuse the same CoveragePlan / ThrowPlan / execution boundaries.

## P6 handoff

P6 now owns individual running and special-play behavior:

1. runner perception / knowledge boundary;
2. lead / start / advance / return decisions;
3. steal attempts;
4. pickoff interaction;
5. tag-up decisions;
6. rundown state and direction changes;
7. base-coach information;
8. runner decisions reacting to actual P5 coverage gaps / throw plans.

Existing RunnerMotion, route geometry, base touch, force, tag-up, and tag-contact physics should be reused.

## CI caveat

Latest GitHub Actions evidence:
- run `35351048901`
- head `9e1e58b16a355bfbfc8b9c32bd3ad6b8c0efd7f8`
- verify job `105619000191`
- `steps=[]`

The workflow still fails before commands execute.

Therefore repository GREEN is not claimed.
