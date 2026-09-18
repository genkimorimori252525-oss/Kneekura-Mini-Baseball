# P4 Scouting / Defensive Alignment Acceptance Audit — 2026-09-18

**Status:** IMPLEMENTATION COMPLETE FOR FOUNDATION; GitHub Actions remains pre-step blocked.

**Parent roadmap:** P4 — scouting / pre-pitch defensive alignment.

## Acceptance map

| Requirement | State | Current evidence | Boundary |
| --- | --- | --- | --- |
| true batter tendency separated from defensive knowledge | **implemented** | `BatterTrueTendency` vs `ScoutingEstimate` | scouting builder has no true-tendency input |
| uncertainty and sample age | **implemented** | `ScoutingEstimate` | old observations are recency-decayed; zero sample => uncertainty 1 |
| manager information handling | **implemented** | `ManagerDefensiveStrategyRatings`, `deriveManagerScoutingParameters` | affects prior/recency handling only |
| arbitrary-coordinate nine-player alignment | **implemented** | `DefensiveAlignment` | registered position remains separate from world coordinate |
| extreme shift support | **implemented** | CF may start in infield-like coordinates | legality remains RuleProfile responsibility |
| compare multiple candidate alignments | **implemented** | `DefensiveAlignmentSelection` | uses scouting estimate, not future truth |
| uncertainty weakens aggressive shift confidence | **implemented** | estimate blended toward neutral distribution | no direct hit/out bonus |
| manager candidate-comparison quality | **implemented** | `ManagerAlignmentSelection` | changes candidate evaluation error only |
| chosen alignment -> canonical defender world state | **implemented** | `DefensiveAlignmentWorldAdapter` | zero velocity + hold assignment; no player physics bonus |
| same hitter truth can yield different defensive decisions from different observed histories | **implemented source acceptance** | `P4ScoutingAlignmentVerticalSlice.test.ts` | explicitly proves defensive fallibility |

## Causal architecture

```text
BatterTrueTendency
   (offense-owned latent truth)
          X
          X  not readable by defense
          X
ObservedBattedBallSample[]
          ↓
manager information handling
          ↓
ScoutingEstimate
  distribution + uncertainty + age
          ↓
candidate DefensiveAlignment[]
          ↓
estimated spatial coverage comparison
          ↓
manager comparison error
          ↓
chosen DefensiveAlignment
          ↓
Canonical defender start coordinates
          ↓
P5 player execution physics
```

## No truth leak

`buildScoutingEstimate` accepts only:
- observed batted-ball samples;
- current observation sequence;
- prior distribution;
- information-handling parameters.

It does not accept `BatterTrueTendency`.

The acceptance vertical slice keeps one true hitter tendency constant, supplies two different defensive observation histories, and obtains different scouting estimates and different selected alignments.

This is intentional: the defense may be wrong.

## Manager skill boundary

Manager strategy ratings:

- `informationUpdate`
- `sampleEvaluation`
- `alignmentComparison`

These do not alter:
- batted-ball trajectory;
- defender movement speed;
- player acceleration;
- catch skill;
- throw speed;
- runner behavior.

They alter:
- recency weighting;
- prior/sample handling;
- candidate comparison error.

Once the same alignment is chosen, manager ability is no longer a post-hoc player-performance modifier.

## Alignment geometry

`DefensiveAlignment` requires:
- exactly nine defenders;
- unique player identities;
- one registered defensive position each;
- arbitrary finite `start: Vec2` coordinates.

Registration and coordinate are distinct. A registered CF can occupy an infield-like coordinate without becoming a 2B/SS.

Existing NPB RuleProfile alignment modules remain the authority for whether the resulting physical foot placement is legal at the relevant rule tick.

P4 does not duplicate those rules.

## Candidate comparison foundation

The first comparison metric is deliberately interpretable and simple:

- caller supplies representative field anchors for pull/middle/opposite contact;
- uncertainty blends the scouting estimate back toward a neutral distribution;
- each candidate measures nearest eligible defender starting distance to those anchors;
- weighted expected nearest distance is compared.

This is a pre-pitch strategy metric, not an out probability.

Later P5/P9 work may replace or enrich this approximation with simulated play value while retaining the same no-truth-leak boundary.

## Position suitability boundary

P3 stores all nine position-suitability values.

P4 intentionally does not blindly multiply suitability into every candidate score.

Suitability must be applied at the actual assigned role/region in P5 so that an unusual shift can distinguish:
- playing normal registered-position geometry;
- covering an unfamiliar base/relay/ball-handler task;
- occupying an unusual field region.

This avoids double counting before role ownership exists.

## P5 handoff

P5 now owns team-wide post-contact coordination:

1. create a `CoveragePlan` from all nine defenders;
2. select one primary ball handler;
3. assign non-conflicting base-cover / relay / backup / deep-coverage / hold roles to the other eight;
4. preserve arbitrary shifted starting coordinates;
5. use each defender's perceived world and P3 execution ratings;
6. support deterministic replanning when the ball/runner state changes;
7. do not fall back to hard-coded registered-position coordinates.

Position suitability should first become active here, at a concrete role/task boundary.

## CI caveat

GitHub Actions has repeatedly failed before workflow commands execute with `steps=[]`.

Repository GREEN is not claimed until the verify job executes actual commands.
