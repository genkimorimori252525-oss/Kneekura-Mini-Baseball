# Defensive Base-Cover Body Target Separation Plan

**Status:** IMPLEMENTATION COMPLETE; GitHub Actions remains pre-step blocked.

**Parent roadmap:** P5 (Nine-defender decisions / coverage / throws), with P2 physical-world dependencies.

**Stop condition:** This sub-plan exists only to prove `base-cover decision -> body cover position -> body kinematics -> bounded foot reach -> actual base contact`. Once that vertical boundary is regression-fixed, do not deepen defender anatomy here. Return to the master focus rotation in `2026-09-18-core-realism-master-progress.md` (P1 gap audit, then P2 canonical plate-appearance timeline).

**Goal:** Stop sending defender body centers directly to the physical base center. Separate the immutable base landmark from the defender body cover target so body motion and foot/base contact can coexist physically.

## Architecture

```text
DefensiveFieldLandmarks
  basePositions              = actual bag geometry landmark
  baseCoverBodyPositions     = body-center cover anchor
        ↓
base_cover intent
        ↓
DefenderMotion toward body cover anchor
        ↓
DefenderBodyKinematics
        ↓
DefenderBaseFootReach
        ↓
foot reaches actual BaseTouchRegion
```

## Constraints

- `basePositions` remain actual physical base centers.
- `baseCoverBodyPositions` are explicit field/tactical calibration, not computed from a hidden fixed offset in Core.
- `resolveDefensiveMovementTarget(base_cover)` returns the body-cover target, never the physical base center.
- Foot/base adjudication continues to use the actual base geometry.
- Existing ball-handler / relay / backup / deep-coverage targets are unchanged.
- No probability is added.
- The separation must work for arbitrary defensive shifts and future alternate cover geometry.

### Task 1: Landmark boundary

Add required `baseCoverBodyPositions` to `DefensiveFieldLandmarks`.

### Task 2: Target semantics

Change `base_cover` target resolution to the body-cover position and validate all cover landmarks.

### Task 3: Vertical-slice regression

Update the first-base cover fixture so:
- defender body moves toward a point offset from first base;
- the foot reach planner can then reach the actual first-base center;
- body target and physical base are demonstrably different.

### Task 4: Core evidence

Preserve shared API and retry P0 Core CI.


---

## Completion evidence

Closed by vertical regression `958c768f236404257712eaa9fb25ec00fc38294c`.

The regression proves one causal chain:

```text
individual base-cover decision
  -> baseCoverBodyPositions target
  -> DefenderMotion segment
  -> projected DefenderBodyKinematics
  -> bounded foot reach
  -> exact first contact with the actual BaseTouchRegion
```

The body-cover target remains distinct from the physical base center. The defender body reaches the cover anchor while the generated foot primitive reaches the actual bag; no body-center teleport to the base is used.

Latest P0 Core GitHub Actions attempt:
- run `35329767846`
- job `105551167231`
- `steps=[]`

The workflow failed before commands executed, so full-repository GREEN is not claimed.

Per the parent stop condition, this closes the current defender-anatomy/base-cover deep-dive. Further defender realism work should only resume when it closes an explicit P5 acceptance requirement. The next master focus is P1 rule gap audit, followed by P2 canonical plate-appearance timeline.
