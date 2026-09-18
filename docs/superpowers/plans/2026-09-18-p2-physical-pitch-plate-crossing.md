# P2 Physical Pitch / Plate Crossing Plan

**Status:** IMPLEMENTATION IN PROGRESS.

**Parent roadmap:** P2 — canonical time / world / plate appearance.

**Acceptance condition closed by this slice:** a taken pitch reaches the plate through an authoritative numerical trajectory and produces ball/called-strike from physical plate-crossing geometry rather than an injected count result.

## Architecture

```text
PitchWorldState at release/window start
 + constant acceleration over one continuous flight segment
        ↓
PitchTrajectory
        ↓
exact front-of-plate plane crossing tick
        ↓
sampled ball center + velocity + spin
        ↓
StrikeZoneRegion + ball radius overlap
        ↓
TakenPitchPhysicalResult
  ball | called_strike
        ↓
CanonicalPlateAppearanceTimeline
        ↓
existing PitchCountRule
```

## Constraints

- No direct strike-probability or command-roll at the rule boundary.
- Pitch location is a physical result.
- This first trajectory slice uses constant acceleration over one uninterrupted segment. Future Magnus/drag integration may subdivide into continuous segments without changing the plate-crossing API.
- Plate plane Z is explicit input; do not hard-code a renderer coordinate.
- Strike zone geometry is explicit input.
- Ball radius participates in the zone decision: any part of the ball overlapping the horizontal/vertical strike-zone bounds at plate crossing counts geometrically as in-zone.
- The crossing solver must support zero or non-zero Z acceleration and return the first forward-time crossing within the segment.
- Authoritative crossing time is quantized with existing exact-event tick policy.
- A pitch that never reaches the plate within the segment returns null, not ball/strike.
- The physical result does not model umpire error yet. P2 canonical truth and later umpire judgment remain separate.
- Presentation never participates.
- Swing/contact integration is a follow-up slice; this first slice handles a taken pitch only.

### Task 1: Pitch trajectory and exact plate crossing

Add `sim/pitching/PitchTrajectory.ts`.

### Task 2: Physical strike-zone geometry

Add `sim/pitching/TakenPitchPhysicalResult.ts`.

### Task 3: Timeline adapter

Add a function that records a taken physical pitch into `CanonicalPlateAppearanceTimeline` by delegating to existing `recordCountedPitch`.

### Task 4: Regression fixtures

Cover:
- straight pitch crosses at exact expected tick;
- accelerated Z motion crosses correctly;
- miss/no crossing returns null;
- center inside zone => called strike;
- ball edge clipping zone => called strike;
- ball fully outside => ball;
- timeline count changes from the physical result;
- same inputs are deterministic.

### Task 5: Next slice

Connect a batter swing window to the same pitch trajectory:
- physical BatBallContact => batted-ball pending;
- swing with no contact => swinging strike;
- taken pitch => physical zone result above.
