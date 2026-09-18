# P4 Scouting / Defensive Alignment Foundation — 2026-09-18

**Status:** IMPLEMENTATION IN PROGRESS.

## Goal

Create the pre-pitch defensive strategy layer without giving the defense access to future truth.

## Architecture

```text
BatterTrueTendency
  (offense-owned latent truth)
        X  no direct read
ObservedBattedBallSample[]
        ↓
ScoutingEstimate
  direction distribution
  trajectory distribution
  uncertainty
  effective sample size
  sample age
        ↓
DefensiveAlignment candidates
  9 registered defenders
  arbitrary continuous-world start coordinates
        ↓
existing NPB alignment legality rules
        ↓
chosen canonical pre-pitch world positions
```

## Permanent constraints

- Scouting code must not accept `BatterTrueTendency` as an input to estimate building.
- Estimates may be wrong.
- Small/old samples must remain uncertain.
- Manager quality may improve observation weighting / candidate comparison, never reveal true future batted-ball outcome.
- `registeredPosition` and `start` world coordinate remain separate.
- A CF may be placed in shallow/infield-like coordinates if the active rule profile permits it.
- Alignment strategy does not alter player speed, catch skill, or batted-ball trajectory after alignment is chosen.
- Existing RuleProfile alignment evaluators remain the authority for legality.

## First slice

1. validated true tendency model;
2. validated scouting estimate model;
3. estimate builder from observed batted balls only;
4. arbitrary-coordinate nine-player `DefensiveAlignment`;
5. regressions proving the same true hitter can yield different estimates from different observation histories.
