# NPB 2026 Infield Boundary Rule Plan

**Status:** IMPLEMENTATION IN PROGRESS.

**Goal:** Complete the remaining NPB 2026 RuleProfile defensive-alignment semantics by evaluating whether all four registered infielders have both feet fully inside the stadium-provided infield boundary when the pitcher begins the motion related to delivering the pitch.

## Rule basis

NPB 5.02(c)(i) retains the requirement that the four infielders have both feet completely before/inside the infield boundary when the pitcher begins the motion related to the pitch. The 2026 amendment removes the separate wording for ordinary pitching motion while retaining the pitching-related-motion trigger. The existing `NPB_2026_RULE_PROFILE` already declares:

- `defensiveAlignment.infieldBoundary.enabled = true`;
- `evaluationMoment = 'pitching_related_motion_start'`;
- `geometrySource = 'stadium_profile'`.

This phase implements that declared policy rather than adding another hidden season assumption.

## Architecture

```text
StadiumProfile infield boundary geometry
          +
DefenderFootPlacementFact @ pitching-related-motion start
          +
physical foot contact radius
          ↓
PitchingMotionInfieldBoundaryRule
          ↓
legal | violation { invalidInfielders }
          ↓
normalizeInfieldBoundaryViolation
          ↓
DefensiveAlignmentViolation { concrete_players }
          ↓
existing NPB2026AlignmentViolationPenalty
```

## Permanent constraints

- The rule evaluator does not own stadium shape. Boundary geometry is supplied by the stadium/profile layer.
- Boundary geometry is represented as a simple polygonal approximation in canonical world X/Z coordinates.
- A foot is modeled for this rule as a finite circular contact region, not a zero-size point.
- A foot merely touching/crossing the boundary is not fully inside.
- Exactly one registered 1B, 2B, 3B, and SS must be present at the authoritative evaluation tick.
- Outfielders do not count toward the four-infielder requirement.
- The evaluator remains independent from the second-base-side rule because their authoritative moments differ in NPB 2026.
- A boundary violation identifies the actual offending infielder(s), so it can feed the existing identity-aware 5.02(c) penalty resolver.
- CanonicalWorldSnapshot is not rewritten by rule adjudication.

### Task 1: Stadium-supplied boundary geometry

Create `InfieldBoundaryRegion.ts`.

Provide:
- `InfieldBoundaryRegion`;
- `createInfieldBoundaryRegion(vertices)`;
- strict finite/non-degenerate validation;
- deterministic foot-disc containment.

### Task 2: Boundary evaluator

Create `PitchingMotionInfieldBoundaryRule.ts`.

Input:
- authoritative evaluation tick;
- defender foot-placement facts;
- stadium boundary region;
- required infielder count from RuleProfile;
- physical foot contact radius.

Output:
- legal/violation;
- per-player left/right foot containment;
- concrete invalid infielder ids.

### Task 3: Profile-aware boundary

Add `evaluatePitchingMotionInfieldBoundaryForMatch`.

It must:
- bind match and RuleContext;
- require the boundary rule to be enabled;
- require `pitching_related_motion_start`;
- require `stadium_profile`;
- pass the profile's required infielder count to the pure evaluator.

### Task 4: Penalty normalization

Add `normalizeInfieldBoundaryViolation`.

A boundary violation always produces `DefensiveAlignmentViolation` with `identity: 'concrete_players'`, allowing the existing NPB 2026 penalty resolver to determine whether the violating infielder was the first infielder to touch the ball.

### Task 5: Core API + evidence

Expose the new boundary modules through Core and add API coverage.

Retry P0 Core CI. Do not claim repository GREEN while the Actions runner continues to terminate with no executed workflow steps.
