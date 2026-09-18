# Batter Stance to First Base Geometry Plan

**Status:** IMPLEMENTATION COMPLETE; GitHub Actions remains pre-step blocked.

**Goal:** Make batter handedness affect the batter-runner's physical starting geometry so first-base distance and arrival-time differences emerge from the existing runner physics instead of a hidden handedness bonus.

## Reality basis

Professional baseball uses separate batter's boxes on the two sides of home plate. A resolved left-handed batter stands on the first-base side of the plate; a resolved right-handed batter stands on the opposite side. Real batting stance is player-specific: depth in the box and distance off the plate vary by hitter.

Therefore handedness alone must not assign a fixed time bonus. It only determines which side of the plate receives the player's stance offsets.

## Architecture

```text
resolved batting side (left/right)
        +
player stance geometry
  distance off plate
  depth relative to plate
        +
canonical home/first-base field frame
        ↓
BatterStanceFirstBaseGeometry
        ↓
world start position
distance to first base
run-through RunnerRoute
        ↓
existing RunnerMotion
        ↓
existing RunnerBaseTouch
        ↓
exact first-base touch tick
```

## Permanent constraints

- No `leftHandedFirstBaseBonus`, probability modifier, or direct tick adjustment.
- Handedness is resolved to `left | right` for the plate appearance; switch-hitter choice is upstream.
- Player-specific stance remains data, not a RuleProfile constant.
- `distanceOffPlateMeters` follows a physical stance meaning: body center distance from the corresponding inside edge of home plate.
- The field frame owns home-plate center, first-base center, plate half-width, the pitcher-forward unit vector, and the first-base-side unit vector.
- Field-frame axes must be orthonormal so handedness mirroring is deterministic.
- The first-base route begins at the authoritative stance/body start position and extends through first base; exact touch remains owned by `RunnerBaseTouch`.
- Equal running parameters may produce different first-base touch ticks solely because the generated routes have different physical lengths.
- A left-handed batter is not guaranteed to beat every right-handed batter: individual stance, reaction, acceleration, swing exit, and running skill remain causal inputs.

### Task 1: Batter stance geometry

Create `BatterStanceFirstBaseGeometry.ts`.

Provide:
- `ResolvedBatterSide = 'left' | 'right'`;
- canonical field frame validation;
- player stance geometry validation;
- world stance position;
- straight-line distance from stance/body start to first-base center;
- a run-through first-base `RunnerRoute`.

### Task 2: Geometry proof fixture

For a canonical 90-foot diamond and mirrored equal stance:
- left-handed start must lie on the first-base side;
- right-handed start must lie on the third-base side;
- left-handed route distance to first must be shorter.

The fixture uses a representative box-center-style distance-off-plate value only as test data, not a hard-coded player default.

### Task 3: Existing physics proof fixture

Feed both generated routes into the same:
- `RunnerMotionState`;
- `RunnerMotionIntent`;
- `RunnerMotionParameters`;
- `RunnerBodyContactParameters`;
- first-base touch region.

Require the left-handed fixture to produce an earlier exact first-base touch tick solely from geometry.

### Task 4: Core API + evidence

Export the geometry through Core and add API coverage.

Retry P0 Core CI. Do not claim executed GREEN while GitHub Actions continues to return `steps=[]`.


---

## Completion evidence

Implemented through the batter-geometry Core API slice ending at
`9709daa315bfecc19cfc1a59e3a3a2eac2add415`. A later unrelated
infield-boundary validation cleanup may move the branch HEAD without changing
this batter-geometry evidence.

Implemented:
- resolved batter side (`left | right`) mirrors player-specific stance geometry across home plate;
- field-frame axes are explicitly validated as orthonormal;
- player-specific distance off plate and pitcher-direction depth remain inputs rather than handedness constants;
- first-base distance is derived from canonical world geometry;
- the batter-runner route begins at the authoritative stance/body position and runs through first base;
- the existing `RunnerMotion` and `RunnerBaseTouch` pipeline consumes the generated route without a handedness time bonus;
- shared Core API exports the geometry boundary.

TDD checkpoints:
- `23a84dd644e774016ff83e27aee59365f1e0991e`: RED fixture for mirrored stance, route-distance difference, and exact first-base-touch ordering;
- `b0411450fafec4ce4eed265335ed67b704981df4`: stance-to-first geometry implementation;
- `8dec57e24a1764f3deed86936980e931f3a7181b`: Core API exposure requirement;
- `9709daa315bfecc19cfc1a59e3a3a2eac2add415`: Core API export.

Representative geometry fixture:
- left-handed route distance to first-base center: approximately `26.425 m`;
- right-handed route distance to first-base center: approximately `27.824 m`;
- difference: approximately `1.399 m` in favor of the left-side start.

These numbers are fixture-derived geometry, not production calibration and not
a universal left-handed bonus. The regression fixture additionally feeds both
routes through identical runner parameters and requires the left-side route to
produce an earlier exact first-base touch.

Repository CI:
- P0 Core run `35313668998` for `9709daa...` failed before any workflow command executed;
- job `105500662799` reports `steps=[]`;
- therefore executed repository GREEN is not claimed.
