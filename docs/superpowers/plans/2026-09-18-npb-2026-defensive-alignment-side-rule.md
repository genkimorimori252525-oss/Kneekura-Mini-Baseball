# NPB 2026 Defensive Alignment Side Rule Plan

**Goal:** Enforce the NPB 2026 second-base side restriction at pitch release from authoritative left/right foot placement facts, without approximating feet from defender center coordinates.

## RuleProfile refinement

NPB 2026 defensive alignment has two distinct timing/geometry requirements:

1. the four infielders must satisfy the infield-boundary requirement when the pitcher begins the relevant pitching action;
2. when the pitch leaves the pitcher's hand, two of the four infielders must be on each side of second base, with both feet on the side they occupy.

The infield-boundary requirement needs stadium-specific boundary geometry and remains declared-but-not-executed in this phase.

## Architecture

```text
Defender body/pose system
        ↓
DefenderFootPlacementFact[]
(leftFoot/rightFoot world contact points)
        +
SecondBaseDivisionReference
(secondBaseCenter + first-base-side unit normal)
        +
pitchReleaseTick
        +
RuleContext
        ↓
PitchReleaseInfieldSideRule
        ↓
legal
or
violation {
  firstBaseSideCount,
  thirdBaseSideCount,
  invalid/straddling infielders
}
```

## Permanent constraints

- Never classify an infielder from body-center position when the profile requires both feet.
- Only the four registered infielders (1B, 2B, 3B, SS) count toward the 2+2 restriction.
- An outfielder moved into the infield remains an outfielder for this rule and does not replace one of the four infielders.
- Every evaluated foot fact must be at the authoritative pitch-release tick.
- The second-base dividing direction is explicit field geometry, not hard-coded to world X/Z.
- Both feet must lie strictly on the same side. A straddling/on-divider placement is a violation state.
- This phase determines violation only; the NPB 2026 penalty branch based on which infielder first touches the ball is later work.
- The separate infield-boundary requirement remains deferred until `StadiumProfile` provides authoritative boundary geometry.

### Task 1: Refine NPB 2026 defensive-alignment policy

Change the profile field to declare:
- required infielder count = 4;
- infield-boundary requirement enabled, timing = `pitching_related_motion_start`, geometry source = `stadium_profile`;
- second-base side requirement enabled, timing = `pitch_release`, 2 per side, both-feet semantics;
- violation policy id = `npb_2026_5_02_c`.

### Task 2: Authoritative foot-placement facts

Create `DefensiveAlignmentFacts.ts`.

Types:
- `DefenderFootPlacementFact`: player id, registered position, tick, leftFoot, rightFoot;
- `SecondBaseDivisionReference`: second-base center + first-base-side unit normal.

Validate finite coordinates, safe tick, non-empty id, and unit normal.

### Task 3: Pitch-release side evaluator

Create `PitchReleaseInfieldSideRule.ts`.

Behavior:
- filter registered 1B/2B/3B/SS;
- require exactly four unique infielders;
- require all facts at pitchReleaseTick;
- classify each infielder:
  - both foot projections > epsilon => first-base side;
  - both < -epsilon => third-base side;
  - otherwise => invalid/straddling;
- legal only if exactly two on each side and no invalid placement.

### Task 4: Profile-aware match entry point

Add `evaluatePitchReleaseInfieldSideForMatch(match, context, ...)`.
It must:
- assert match/profile binding;
- verify profile enables pitch-release/both-feet side semantics;
- call the pure evaluator.

### Task 5: Core API + verification

Fixtures:
- standard 2+2 => legal;
- 3+1 => violation;
- one infielder straddling => violation;
- CF placed between second and short => ignored for the four-infielder count;
- same physical facts at wrong tick => reject;
- rotated field division axis => same logical result.

Run local TypeScript/runtime verification and retry P0 CI without claiming full repository GREEN while jobs remain pre-step blocked.
